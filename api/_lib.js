import iconv from 'iconv-lite';
import { LRUCache } from 'lru-cache';
import sanitizeHtml from 'sanitize-html';

/** Общий кеш в памяти инстанса (тёплый старт Vercel) */
export const cache = new LRUCache({ max: 200, ttl: 1000 * 60 * 5 });

export const UA =
  'Mozilla/5.0 (compatible; FluentRSSReader/2.0; +https://fluent-rss-reader-web.vercel.app)';

/** Разрешаем только публичный http(s), блокируем SSRF во внутреннюю сеть */
export function safeUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let value = raw.trim();
  if (!/^https?:\/\//i.test(value)) value = 'https://' + value.replace(/^\/+/, '');
  let u;
  try {
    u = new URL(value);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase();
  const blocked =
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^\[?::1\]?$/.test(host) ||
    /^\[?f[cd]/i.test(host);
  if (blocked) return null;
  return u.toString();
}

/** Определяем кодировку из заголовка / XML-пролога / meta и декодируем корректно */
export function decodeBuffer(buffer, contentType = '') {
  const bytes = Buffer.from(buffer);
  const ascii = bytes.subarray(0, 2048).toString('latin1');
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  const fromXml = /<\?xml[^>]*encoding=["']([\w-]+)["']/i.exec(ascii)?.[1];
  const fromMeta = /<meta[^>]*charset=["']?([\w-]+)/i.exec(ascii)?.[1];
  let enc = (fromXml || fromHeader || fromMeta || 'utf-8').toLowerCase();
  if (enc === 'utf8') enc = 'utf-8';
  if (!iconv.encodingExists(enc)) enc = 'utf-8';
  let text = iconv.decode(bytes, enc);
  // XML-пролог должен соответствовать фактической кодировке после декодирования
  text = text.replace(/^\uFEFF/, '').replace(/encoding=["'][\w-]+["']/i, 'encoding="UTF-8"');
  return text;
}

/** fetch с таймаутом, ретраями и экспоненциальной паузой */
export async function fetchWithRetry(url, { retries = 2, timeout = 12000, headers = {} } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': UA,
          Accept:
            'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json;q=0.9, text/html;q=0.8, */*;q=0.5',
          'Accept-Language': 'ru,en;q=0.8',
          ...headers
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      return { text: decodeBuffer(buf, res.headers.get('content-type') || ''), res };
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error('fetch failed');
}

const ALLOWED_TAGS = [
  'p','br','strong','b','em','i','u','s','blockquote','q','cite','code','pre','ul','ol','li',
  'h2','h3','h4','h5','h6','a','img','figure','figcaption','table','thead','tbody','tr','th','td','hr','span','video','source'
];

/** Чистим HTML статьи: без скриптов, трекеров и inline-стилей */
export function cleanArticleHtml(html, baseUrl) {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      video: ['src', 'poster', 'controls'],
      source: ['src', 'type'],
      '*': []
    },
    allowedSchemes: ['http', 'https', 'mailto', 'data'],
    transformTags: {
      a: (tag, attribs) => ({
        tagName: 'a',
        attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' }
      }),
      img: (tag, attribs) => {
        let src = attribs.src || attribs['data-src'] || '';
        try {
          if (src && baseUrl) src = new URL(src, baseUrl).toString();
        } catch {}
        return { tagName: 'img', attribs: { src, alt: attribs.alt || '', loading: 'lazy' } };
      }
    },
    exclusiveFilter: (frame) =>
      frame.tag === 'img' && (!frame.attribs.src || /1x1|pixel|spacer|doubleclick/i.test(frame.attribs.src))
  }).trim();
}

export function toPlainText(html, limit = 320) {
  const text = sanitizeHtml(html || '', { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= limit) return text;
  return text.slice(0, limit).replace(/\s+\S*$/, '') + '…';
}

/**
 * Ответ и разбор запроса — только через сырое Node http API (res.end,
 * res.statusCode, req.url). Помощники вида req.query / res.status().send()
 * Vercel добавляет не всегда — в частности, ненадёжно для ESM-функций
 * (у нас "type": "module"). Полагаться на них — значит рисковать тем,
 * что ЛЮБОЙ запрос будет падать с голым 500 ещё до нашего кода.
 */
export function sendJson(res, status, payload, cacheSeconds = 0) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Cache-Control',
    cacheSeconds
      ? `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 4}`
      : 'no-store'
  );
  res.end(JSON.stringify(payload));
}

/** Query-параметры из req.url — работает всегда, в отличие от req.query */
export function getQuery(req) {
  try {
    return Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
  } catch {
    return {};
  }
}

/**
 * Оборачивает обработчик: любое необработанное исключение (в том числе
 * ошибка импорта зависимости или баг, которого мы не предвидели) превращается
 * в диагностируемый JSON-ответ 500 вместо непрозрачного краша платформы.
 */
export function withSafety(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('Необработанная ошибка функции:', error);
      if (res.writableEnded) return;
      try {
        sendJson(res, 500, { error: 'internal_error', message: String(error?.message || error) });
      } catch {
        try {
          res.statusCode = 500;
          res.end('{"error":"internal_error"}');
        } catch {}
      }
    }
  };
}
