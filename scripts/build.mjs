/**
 * Сборка: минификация + генерация языковых страниц и SEO-файлов.
 *
 *   node scripts/build.mjs
 *
 * Источник — src/, результат — public/ (его и раздаёт Vercel).
 * Минифицирует esbuild; если он недоступен (например, установка без
 * devDependencies), файлы копируются как есть — сборка не падает.
 */
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_LANG, LANGS, LOCALES, SITE, urlFor } from './seo.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'src');
const OUT = join(root, 'public');

let esbuild = null;
try {
  esbuild = await import('esbuild');
} catch {
  console.warn('! esbuild не найден — файлы будут скопированы без минификации');
}

const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 8);

async function minify(code, loader) {
  if (!esbuild) return code;
  const result = await esbuild.transform(code, {
    loader,
    minify: true,
    legalComments: 'none',
    target: loader === 'css' ? 'chrome100' : 'es2020',
    charset: 'utf8'
  });
  return result.code;
}

/** Минифицирует файл и кладёт его под именем с хешем содержимого */
async function asset(name, loader, ext) {
  const source = await readFile(join(SRC, name), 'utf8');
  const code = await minify(source, loader);
  const file = `${name.replace(/\.(js|css)$/, '')}.${hash(code)}.min.${ext}`;
  await writeFile(join(OUT, file), code);
  return { path: '/' + file, bytes: Buffer.byteLength(code), was: Buffer.byteLength(source) };
}

/* ---------- Bootstrap Icons ---------- */
/**
 * Шрифт берётся из npm-пакета bootstrap-icons и кладётся в public/vendor,
 * то есть раздаётся с нашего же домена (CSP: font-src 'self').
 * Из полного CSS (около 2000 классов) оставляем только реально
 * используемые классы — их список собирается из исходников.
 */
async function icons() {
  const pkg = join(root, 'node_modules', 'bootstrap-icons', 'font');
  const dest = join(OUT, 'vendor', 'bootstrap-icons');

  let full;
  try {
    full = await readFile(join(pkg, 'bootstrap-icons.min.css'), 'utf8');
  } catch {
    console.warn('! bootstrap-icons не установлен — запустите npm install');
    return { path: '/vendor/bootstrap-icons/bootstrap-icons.min.css', bytes: 0, was: 0 };
  }

  await mkdir(dest, { recursive: true });
  await cp(join(pkg, 'fonts'), join(dest, 'fonts'), { recursive: true });

  // Какие иконки мы вообще используем
  const sources = await Promise.all(
    ['index.html', 'app.js', 'styles.css', 'feeds-catalog.js'].map((f) => readFile(join(SRC, f), 'utf8'))
  );
  const used = new Set(sources.join('\n').match(/bi-[a-z0-9-]+/g) || []);

  // @font-face + .bi базовый класс оставляем всегда
  const base = full.slice(0, full.indexOf('.bi-') === -1 ? full.length : full.indexOf('.bi-'));
  const rules = [...full.matchAll(/\.(bi-[a-z0-9-]+)::before\{[^}]*\}/g)]
    .filter((m) => used.has(m[1]))
    .map((m) => m[0])
    .join('');

  const subset = (base + rules).replace(/@font-face\{/, '@font-face{font-display:swap;');
  const code = await minify(subset, 'css');
  const file = `bootstrap-icons.${hash(code)}.min.css`;
  await writeFile(join(dest, file), code);

  return {
    path: `/vendor/bootstrap-icons/${file}`,
    bytes: Buffer.byteLength(code),
    was: Buffer.byteLength(full),
    count: used.size
  };
}

/* ---------- SEO-голова страницы ---------- */
function seoHead(lang, assets) {
  const meta = LOCALES[lang];
  const url = urlFor(lang);

  const alternates = LANGS.map(
    (l) => `<link rel="alternate" hreflang="${l}" href="${urlFor(l)}">`
  ).join('\n');

  const ogLocales = LANGS.filter((l) => l !== lang)
    .map((l) => `<meta property="og:locale:alternate" content="${LOCALES[l].locale}">`)
    .join('\n');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': SITE + '/#app',
        name: 'Fluent RSS Reader',
        url,
        inLanguage: lang,
        applicationCategory: 'NewsApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript',
        description: meta.description,
        image: SITE + '/preview.jpg',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: [
          'RSS, Atom, JSON Feed',
          'OPML import and export',
          'Offline reading',
          'Categories',
          'Dark theme',
          '7 interface languages'
        ],
        author: { '@type': 'Person', name: 'PsyGioX' }
      },
      {
        '@type': 'WebSite',
        '@id': SITE + '/#website',
        url: SITE + '/',
        name: 'Fluent RSS Reader',
        inLanguage: lang,
        potentialAction: {
          '@type': 'SubscribeAction',
          target: `${SITE}/?feed={feed_url}`,
          'query-input': 'required name=feed_url'
        }
      },
      {
        '@type': 'FAQPage',
        '@id': url + '#faq',
        inLanguage: lang,
        mainEntity: meta.faq.map(([question, answer]) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer }
        }))
      }
    ]
  };

  return `<title>${meta.title}</title>
<meta name="description" content="${meta.description}">
<meta name="keywords" content="${meta.keywords}">
<meta name="author" content="PsyGioX">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<meta name="googlebot" content="index, follow">
<meta name="yandex" content="index, follow">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="theme-color" content="#fbfafc" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#17151d" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Fluent RSS">
<meta name="yandex-verification" content="d3afa32d7eb50e33">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-src https:; base-uri 'self'; form-action 'self'">

<link rel="canonical" href="${url}">
${alternates}
<link rel="alternate" hreflang="x-default" href="${urlFor(DEFAULT_LANG)}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="Fluent RSS Reader">
<meta property="og:locale" content="${meta.locale}">
${ogLocales}
<meta property="og:title" content="${meta.ogTitle}">
<meta property="og:description" content="${meta.description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/preview.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${meta.ogTitle}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${meta.ogTitle}">
<meta name="twitter:description" content="${meta.description}">
<meta name="twitter:image" content="${SITE}/preview.jpg">

<link rel="manifest" href="/manifest.${lang}.json">
<link rel="icon" href="/favicon/favicon.ico" sizes="any">
<link rel="icon" href="/favicon/favicon-32x32.png" type="image/png">
<link rel="apple-touch-icon" href="/favicon/apple-icon-180x180.png">
<link rel="preload" as="style" href="${assets.css.path}">
<link rel="preload" as="style" href="${assets.icons.path}">
<link rel="preload" as="script" href="${assets.app.path}">

<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
}

/* ---------- Файлы SEO ---------- */
function sitemap() {
  const entries = LANGS.map((lang) => {
    const alternates = LANGS.map(
      (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${urlFor(l)}"/>`
    ).join('\n');
    return `  <url>
    <loc>${urlFor(lang)}</loc>
${alternates}
    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor(DEFAULT_LANG)}"/>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${lang === DEFAULT_LANG ? '1.0' : '0.8'}</priority>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries}
</urlset>
`;
}

const robots = () => `User-agent: *
Allow: /
Disallow: /api/

# Служебные функции незачем индексировать, страницы — можно
User-agent: Yandex
Allow: /
Disallow: /api/
Clean-param: feed&lang

Host: ${SITE.replace('https://', '')}
Sitemap: ${SITE}/sitemap.xml
`;

/* ---------- Сборка ---------- */
async function build() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  // 1. Статика как есть
  await cp(join(SRC, 'static'), OUT, { recursive: true });

  // 2. Минифицированные ассеты с хешем в имени
  const assets = {
    icons: await icons(),
    css: await asset('styles.css', 'css', 'css'),
    app: await asset('app.js', 'js', 'js'),
    i18n: await asset('i18n.js', 'js', 'js'),
    catalog: await asset('feeds-catalog.js', 'js', 'js')
  };

  // 3. Service worker: знает точные имена ассетов этой сборки
  const shell = [
    '/',
    ...LANGS.filter((l) => l !== DEFAULT_LANG).map((l) => `/${l}/`),
    assets.css.path,
    assets.icons.path,
    assets.app.path,
    assets.i18n.path,
    assets.catalog.path,
    `/manifest.${DEFAULT_LANG}.json`
  ];
  const swSource = (await readFile(join(SRC, 'sw.js'), 'utf8'))
    .replace(/__ASSETS__/g, JSON.stringify(shell))
    .replace(/__BUILD__/g, hash(JSON.stringify(shell)));
  await writeFile(join(OUT, 'sw.js'), await minify(swSource, 'js'));

  // 4. Страницы и манифесты по языкам
  const template = await readFile(join(SRC, 'index.html'), 'utf8');
  const manifestBase = JSON.parse(await readFile(join(SRC, 'manifest.json'), 'utf8'));

  for (const lang of LANGS) {
    const meta = LOCALES[lang];
    const html = template
      .replace('{{LANG}}', lang)
      .replace('{{SEO}}', seoHead(lang, assets))
      .replace('{{ICONS}}', assets.icons.path)
      .replace('{{CSS}}', assets.css.path)
      .replace('{{I18N}}', assets.i18n.path)
      .replace('{{CATALOG}}', assets.catalog.path)
      .replace('{{APP}}', assets.app.path)
      .replace('{{HEADING}}', meta.heading)
      .replace('{{TAGLINE}}', meta.tagline);

    const dir = lang === DEFAULT_LANG ? OUT : join(OUT, lang);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.html'), html);

    await writeFile(
      join(OUT, `manifest.${lang}.json`),
      JSON.stringify(
        {
          ...manifestBase,
          lang,
          dir: 'ltr',
          name: meta.ogTitle,
          description: meta.description,
          start_url: lang === DEFAULT_LANG ? '/' : `/${lang}/`,
          scope: '/'
        },
        null,
        0
      )
    );
  }

  // Совместимость со старой ссылкой на /manifest.json
  await cp(join(OUT, `manifest.${DEFAULT_LANG}.json`), join(OUT, 'manifest.json'));

  // 5. SEO-файлы
  await writeFile(join(OUT, 'sitemap.xml'), sitemap());
  await writeFile(join(OUT, 'robots.txt'), robots());

  // 6. Отчёт
  const kb = (n) => (n / 1024).toFixed(1) + ' КБ';
  console.log(esbuild ? '✓ минификация: esbuild' : '! минификация пропущена');
  for (const [name, a] of Object.entries(assets)) {
    const saved = a.was ? Math.round((1 - a.bytes / a.was) * 100) : 0;
    console.log(`  ${name.padEnd(8)} ${kb(a.was)} → ${kb(a.bytes)}  (−${saved}%)  ${a.path}`);
  }
  if (assets.icons.count) console.log(`✓ иконок в подмножестве: ${assets.icons.count}`);
  console.log(`✓ страниц: ${LANGS.length} (${LANGS.join(', ')})`);
  console.log(`✓ файлов в public/: ${(await readdir(OUT)).length}`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
