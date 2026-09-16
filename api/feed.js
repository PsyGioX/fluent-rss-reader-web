import Parser from 'rss-parser';
import { cache, cleanArticleHtml, fetchWithRetry, safeUrl, sendJson, toPlainText } from './_lib.js';

const parser = new Parser({
  customFields: {
    feed: ['image', 'icon', 'logo', 'language'],
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'dcCreator'],
      'enclosure',
      'category'
    ]
  }
});

function pickImage(item, html) {
  const media = []
    .concat(item.mediaContent || [], item.mediaThumbnail || [])
    .map((m) => m?.$?.url)
    .filter(Boolean);
  if (media.length) return media[0];
  if (item.enclosure?.url && /^image\//.test(item.enclosure.type || 'image/')) return item.enclosure.url;
  const match = /<img[^>]+src=["']([^"']+)["']/i.exec(html || '');
  return match ? match[1] : null;
}

/** JSON Feed (jsonfeed.org) — отдельная ветка, rss-parser его не понимает */
function parseJsonFeed(raw) {
  const data = JSON.parse(raw);
  if (!data.version || !Array.isArray(data.items)) throw new Error('not a json feed');
  return {
    title: data.title,
    description: data.description,
    link: data.home_page_url,
    items: data.items.map((i) => ({
      title: i.title,
      link: i.url || i.external_url,
      pubDate: i.date_published,
      author: i.author?.name,
      content: i.content_html || i.content_text,
      categories: i.tags || []
    }))
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });

  const url = safeUrl(req.query?.url);
  if (!url) return sendJson(res, 400, { error: 'invalid_url', message: 'Некорректный или запрещённый URL' });

  const fresh = req.query?.fresh === '1';
  const key = 'feed:' + url;
  if (!fresh && cache.has(key)) return sendJson(res, 200, { ...cache.get(key), cached: true }, 300);

  try {
    const { text } = await fetchWithRetry(url);
    let feed;

    if (/^\s*\{/.test(text)) {
      feed = parseJsonFeed(text);
    } else {
      feed = await parser.parseString(text);
    }

    const items = (feed.items || []).slice(0, 60).map((item) => {
      const rawHtml = item.contentEncoded || item['content:encoded'] || item.content || item.summary || '';
      const html = cleanArticleHtml(rawHtml, item.link || url);
      return {
        title: (item.title || 'Без заголовка').trim(),
        link: item.link || item.guid || '',
        guid: item.guid || item.link || item.title,
        pubDate: item.isoDate || item.pubDate || null,
        author: item.creator || item.dcCreator || item.author || null,
        categories: (Array.isArray(item.categories) ? item.categories : [])
          .map((c) => (typeof c === 'string' ? c : c?._ || ''))
          .filter(Boolean)
          .slice(0, 5),
        image: pickImage(item, rawHtml),
        excerpt: toPlainText(rawHtml),
        content: html
      };
    });

    if (!items.length) throw new Error('empty_feed');

    const payload = {
      ok: true,
      feed: {
        url,
        title: (feed.title || new URL(url).hostname).trim(),
        description: toPlainText(feed.description || '', 200),
        link: feed.link || new URL(url).origin,
        language: feed.language || null,
        icon: `https://www.google.com/s2/favicons?sz=64&domain=${new URL(url).hostname}`
      },
      items,
      fetchedAt: Date.now()
    };

    cache.set(key, payload);
    return sendJson(res, 200, payload, 300);
  } catch (error) {
    const message = String(error?.message || error);
    const status = /HTTP 4/.test(message) ? 404 : /abort|timeout/i.test(message) ? 504 : 502;
    return sendJson(res, status, { error: 'feed_error', message });
  }
}
