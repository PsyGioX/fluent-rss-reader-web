import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { safeUrl, sendJson, withSafety } from './_lib.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseAttributeValue: false,
  trimValues: true
});

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

/** Рекурсивно обходим outline-дерево: категории могут быть вложенными */
function walk(outlines, category, out) {
  for (const node of asArray(outlines)) {
    const url = node['@xmlUrl'] || node['@xmlurl'] || node['@url'];
    const title = node['@title'] || node['@text'] || '';
    if (url) {
      const clean = safeUrl(url);
      if (clean) out.push({ url: clean, title: String(title).trim() || clean, category });
    } else if (node.outline) {
      walk(node.outline, String(title).trim() || category, out);
    }
  }
  return out;
}

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });

  const raw = await readBody(req);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return sendJson(res, 400, { error: 'bad_json' });
  }

  // --- Экспорт: массив лент -> OPML ---
  if (body.mode === 'export') {
    const byCategory = new Map();
    for (const f of asArray(body.feeds)) {
      const cat = f.category || 'Без категории';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push({
        '@type': 'rss',
        '@text': f.title || f.url,
        '@title': f.title || f.url,
        '@xmlUrl': f.url,
        '@htmlUrl': f.link || f.url
      });
    }
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@',
      format: true,
      suppressEmptyNode: true
    });
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      builder.build({
        opml: {
          '@version': '2.0',
          head: {
            title: body.title || 'Fluent RSS Reader',
            dateCreated: new Date().toUTCString()
          },
          body: {
            outline: [...byCategory.entries()].map(([cat, items]) => ({
              '@text': cat,
              '@title': cat,
              outline: items
            }))
          }
        }
      });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/x-opml; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="fluent-rss-feeds.opml"');
    return res.end(xml);
  }

  // --- Импорт: OPML/XML -> массив лент ---
  try {
    const doc = parser.parse(String(body.xml || ''));
    const root = doc.opml?.body?.outline ?? doc.body?.outline ?? doc.outline;
    const feeds = walk(root, 'Без категории', []);
    if (!feeds.length) return sendJson(res, 422, { error: 'no_feeds_found' });
    // Уникализируем по URL
    const unique = [...new Map(feeds.map((f) => [f.url, f])).values()];
    return sendJson(res, 200, { ok: true, feeds: unique, count: unique.length });
  } catch (error) {
    return sendJson(res, 422, { error: 'parse_error', message: String(error?.message || error) });
  }
}

export default withSafety(handler);
