import * as cheerio from 'cheerio';
import { cache, fetchWithRetry, getQuery, safeUrl, sendJson, withSafety } from './_lib.js';

const COMMON_PATHS = [
  '/rss', '/rss.xml', '/feed', '/feed.xml', '/feeds/posts/default?alt=rss',
  '/atom.xml', '/index.xml', '/rss/all.xml', '/export/rss2/archive/index.xml', '/?feed=rss2'
];

const looksLikeFeed = (t) => /<(rss|feed|rdf:RDF)[\s>]/i.test(t) || /^\s*\{[\s\S]*"items"/.test(t);

/** Быстрая проверка: действительно ли по адресу лента */
async function probe(url) {
  try {
    const { text } = await fetchWithRetry(url, { retries: 0, timeout: 7000 });
    if (!looksLikeFeed(text)) return null;
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

  // 2. <link rel="alternate" type="application/rss+xml">
  if (!found.size) {
    try {
      const { text } = await fetchWithRetry(input, { retries: 1, timeout: 10000 });
      const $ = cheerio.load(text);
      const candidates = [];
      $('link[rel="alternate"], link[rel="feed"], a[href]').each((_, el) => {
        const type = ($(el).attr('type') || '').toLowerCase();
        const href = $(el).attr('href') || '';
        const isTyped = /rss|atom|xml|json/.test(type);
        const isGuess = el.tagName === 'a' && /\/(rss|feed|atom)(\.xml|\/)?$/i.test(href);
        if (!href || (!isTyped && !isGuess)) return;
        try {
          candidates.push({
            url: new URL(href, input).toString(),
            title: $(el).attr('title') || ''
          });
        } catch {}
      });
      for (const c of candidates.slice(0, 8)) {
        const ok = await probe(c.url);
        if (ok) found.set(ok.url, { ...ok, title: c.title || ok.title });
      }
    } catch {}
  }

  // 3. Перебор популярных путей
  if (!found.size) {
    const origin = new URL(input).origin;
    const results = await Promise.all(COMMON_PATHS.map((p) => probe(origin + p)));
    results.filter(Boolean).forEach((r) => found.set(r.url, r));
  }

  const payload = { ok: found.size > 0, feeds: [...found.values()].slice(0, 10) };
  if (payload.ok) cache.set(key, payload);
  return sendJson(res, payload.ok ? 200 : 404, payload, payload.ok ? 600 : 0);
}

export default withSafety(handler);
