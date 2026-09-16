import * as cheerio from 'cheerio';
import { cache, fetchWithRetry, getQuery, safeUrl, sendJson, withSafety } from './_lib.js';

const COMMON_PATHS = [
  '/feed/', '/feed', '/feed.xml', '/rss/', '/rss', '/rss.xml', '/rss2.xml', '/atom.xml',
  '/index.xml', '/feeds/rss.xml', '/feeds/atom.xml', '/rss/index.xml', '/rss/all.xml',
  '/export/rss2/archive/index.xml', '/feeds/posts/default?alt=rss', '/?feed=rss2',
  '/comments/feed/', '/wp-json/wp/v2/posts?per_page=1'
];

const looksLikeFeed = (t, contentType = '') =>
  /xml|rss|atom|json/i.test(contentType) &&
    (/<(?:rss|feed|rdf:RDF)\b/i.test(t) || /^\s*\{[\s\S]*"items"/.test(t)) ||
  /<(?:rss|feed|rdf:RDF)\b/i.test(t) || /^\s*\{[\s\S]*"items"/.test(t);

function normalizeCandidate(url, base) {
  try {
    const value = new URL(url, base);
    value.hash = '';
    return value.toString();
  } catch {
    return null;
  }
}

/** Быстрая проверка: действительно ли по адресу лента */
async function probe(url) {
  try {
    const { text, res } = await fetchWithRetry(url, { retries: 0, timeout: 4500 });
    if (!looksLikeFeed(text, res.headers.get('content-type') || '')) return null;
    const title =
      /<title[^>]*>([\s\S]*?)<\/title>/i.exec(text)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() ||
      new URL(url).hostname;
    return { url, title: title.slice(0, 120) };
  } catch {
    return null;
  }
}

async function handler(req, res) {
  const input = safeUrl(getQuery(req).url);
  if (!input) return sendJson(res, 400, { error: 'invalid_url' });

  const key = 'discover:' + input;
  if (cache.has(key)) return sendJson(res, 200, cache.get(key), 600);

  const found = new Map();

  // 1. Сам адрес уже может быть лентой
  const direct = await probe(input);
  if (direct) found.set(direct.url, direct);

  // 2. Метаданные страницы: rel может содержать несколько токенов, а RSS
  // часто объявляется через meta-теги или обычную ссылку без type.
  if (!found.size) {
    try {
      const { text } = await fetchWithRetry(input, { retries: 1, timeout: 8000 });
      const $ = cheerio.load(text);
      const candidates = new Map();
      $('link[href], meta[content], a[href]').each((_, el) => {
        const type = ($(el).attr('type') || '').toLowerCase();
        const rel = ($(el).attr('rel') || '').toLowerCase().split(/\s+/);
        const href = $(el).attr('href') || $(el).attr('content') || '';
        const label = `${href} ${$(el).attr('title') || ''} ${$(el).text()}`;
        const isTyped = /rss|atom|xml|json/.test(type);
        const isRel = rel.includes('alternate') || rel.includes('feed') || rel.includes('service.feed');
        const isGuess = /(?:^|[/._-])(rss|feed|atom)(?:[./_-]|$)/i.test(label);
        if (!href || (!isTyped && !isRel && !isGuess)) return;
        const candidate = normalizeCandidate(href, input);
        if (candidate && !candidates.has(candidate)) {
          candidates.set(candidate, $(el).attr('title') || $(el).text().trim());
        }
      });
      const results = await Promise.all([...candidates].slice(0, 16).map(async ([url, title]) => ({
        result: await probe(url), title
      })));
      results.forEach(({ result, title }) => {
        if (result) found.set(result.url, { ...result, title: title || result.title });
      });
    } catch {}
  }

  // 3. Перебор популярных путей
  if (!found.size) {
    const origin = new URL(input).origin;
    const candidates = [...new Set(COMMON_PATHS.map((path) => normalizeCandidate(path, origin)))];
    const results = await Promise.all(candidates.map((url) => probe(url)));
    results.filter(Boolean).forEach((r) => found.set(r.url, r));
  }

  const payload = { ok: found.size > 0, feeds: [...found.values()].slice(0, 10) };
  if (payload.ok) cache.set(key, payload);
  return sendJson(res, payload.ok ? 200 : 404, payload, payload.ok ? 600 : 0);
}

export default withSafety(handler);
