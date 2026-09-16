/**
 * SEO-данные для каждой языковой версии.
 * Каждый язык получает собственную статическую страницу /<lang>/index.html
 * с локализованными title/description, canonical и полным набором hreflang.
 */

export const SITE = 'https://fluent-rss-reader-web.vercel.app';
export const DEFAULT_LANG = 'ru';

/** locale — для og:locale, region — для hreflang и geo-таргетинга */
export const LOCALES = {
  ru: {
    locale: 'ru_RU',
    name: 'Русский',
    title: 'Fluent RSS Reader — лёгкая читалка RSS-лент без регистрации',
    description:
      'Бесплатный RSS-агрегатор: добавляйте любые RSS, Atom и JSON-ленты, раскладывайте по категориям, импортируйте OPML и читайте офлайн. Пастельный интерфейс, тёмная тема, 7 языков.',
    keywords:
      'rss читалка, rss агрегатор, чтение новостей, opml импорт, новостная лента, rss ридер онлайн, бесплатный feed reader',
    ogTitle: 'Fluent RSS Reader — лёгкая читалка RSS',
    heading: 'Fluent RSS Reader',
    tagline: 'Все ваши ленты в одном спокойном месте',
    faq: [
      ['Нужна ли регистрация?', 'Нет. Ленты хранятся в браузере, аккаунт не нужен.'],
      ['Можно ли перенести подписки из другой читалки?', 'Да, поддерживается импорт и экспорт OPML, а также JSON-бэкап.'],
      ['Работает ли приложение офлайн?', 'Да, последние загруженные материалы сохраняются и доступны без сети.']
    ]
  },
  en: {
    locale: 'en_US',
    name: 'English',
    title: 'Fluent RSS Reader — a light RSS feed reader, no sign-up',
    description:
      'Free RSS aggregator: follow any RSS, Atom or JSON feed, sort them into categories, import OPML and read offline. Pastel interface, dark theme, seven languages.',
    keywords:
      'rss reader, rss aggregator, news reader, opml import, feed reader online, free rss app, atom feed reader',
    ogTitle: 'Fluent RSS Reader — a light RSS reader',
    heading: 'Fluent RSS Reader',
    tagline: 'Every feed you follow, in one calm place',
    faq: [
      ['Do I need an account?', 'No. Feeds are stored in your browser, no sign-up required.'],
      ['Can I move my subscriptions from another reader?', 'Yes — OPML import and export are supported, plus a JSON backup.'],
      ['Does it work offline?', 'Yes, the most recent articles are cached and stay readable without a connection.']
    ]
  },
  uk: {
    locale: 'uk_UA',
    name: 'Українська',
    title: 'Fluent RSS Reader — легка читалка RSS-стрічок без реєстрації',
    description:
      'Безкоштовний RSS-агрегатор: додавайте будь-які RSS, Atom і JSON-стрічки, розкладайте по категоріях, імпортуйте OPML і читайте офлайн. Пастельний інтерфейс і темна тема.',
    keywords: 'rss читалка, rss агрегатор, читання новин, opml імпорт, стрічка новин, безкоштовний feed reader',
    ogTitle: 'Fluent RSS Reader — легка читалка RSS',
    heading: 'Fluent RSS Reader',
    tagline: 'Усі ваші стрічки в одному спокійному місці',
    faq: [
      ['Чи потрібна реєстрація?', 'Ні. Стрічки зберігаються у браузері.'],
      ['Чи можна перенести підписки?', 'Так, підтримується імпорт та експорт OPML.'],
      ['Чи працює офлайн?', 'Так, останні завантажені матеріали доступні без мережі.']
    ]
  },
  pl: {
    locale: 'pl_PL',
    name: 'Polski',
    title: 'Fluent RSS Reader — lekki czytnik RSS bez rejestracji',
    description:
      'Darmowy agregator RSS: dodawaj dowolne kanały RSS, Atom i JSON, porządkuj je w kategoriach, importuj OPML i czytaj offline. Pastelowy interfejs i tryb ciemny.',
    keywords: 'czytnik rss, agregator rss, czytanie wiadomości, import opml, darmowy feed reader',
    ogTitle: 'Fluent RSS Reader — lekki czytnik RSS',
    heading: 'Fluent RSS Reader',
    tagline: 'Wszystkie kanały w jednym spokojnym miejscu',
    faq: [
      ['Czy potrzebne jest konto?', 'Nie. Kanały są przechowywane w przeglądarce.'],
      ['Czy mogę przenieść subskrypcje?', 'Tak, obsługiwany jest import i eksport OPML.'],
      ['Czy działa offline?', 'Tak, ostatnio pobrane artykuły są dostępne bez sieci.']
    ]
  },
  cs: {
    locale: 'cs_CZ',
    name: 'Čeština',
    title: 'Fluent RSS Reader — lehká čtečka RSS bez registrace',
    description:
      'Bezplatná RSS čtečka: přidejte libovolné RSS, Atom nebo JSON kanály, roztřiďte je do kategorií, importujte OPML a čtěte offline. Pastelové rozhraní a tmavý režim.',
    keywords: 'rss čtečka, rss agregátor, čtení zpráv, import opml, feed reader zdarma',
    ogTitle: 'Fluent RSS Reader — lehká čtečka RSS',
    heading: 'Fluent RSS Reader',
    tagline: 'Všechny kanály na jednom klidném místě',
    faq: [
      ['Je potřeba registrace?', 'Ne. Kanály se ukládají do prohlížeče.'],
      ['Mohu přenést odběry?', 'Ano, podporujeme import i export OPML.'],
      ['Funguje offline?', 'Ano, poslední načtené články zůstanou dostupné.']
    ]
  },
  bg: {
    locale: 'bg_BG',
    name: 'Български',
    title: 'Fluent RSS Reader — лек четец за RSS без регистрация',
    description:
      'Безплатен RSS агрегатор: добавяйте всякакви RSS, Atom и JSON емисии, подреждайте ги по категории, импортирайте OPML и четете офлайн. Пастелен интерфейс и тъмна тема.',
    keywords: 'rss четец, rss агрегатор, четене на новини, opml импорт, безплатен feed reader',
    ogTitle: 'Fluent RSS Reader — лек четец за RSS',
    heading: 'Fluent RSS Reader',
    tagline: 'Всички емисии на едно спокойно място',
    faq: [
      ['Нужна ли е регистрация?', 'Не. Емисиите се пазят в браузъра.'],
      ['Мога ли да прехвърля абонаментите си?', 'Да, поддържа се импорт и експорт на OPML.'],
      ['Работи ли офлайн?', 'Да, последно заредените материали остават достъпни.']
    ]
  },
  sr: {
    locale: 'sr_RS',
    name: 'Српски',
    title: 'Fluent RSS Reader — лаган читач RSS извора без регистрације',
    description:
      'Бесплатан RSS агрегатор: додајте било који RSS, Atom или JSON извор, сложите их по категоријама, увезите OPML и читајте офлајн. Пастелни интерфејс и тамна тема.',
    keywords: 'rss читач, rss агрегатор, читање вести, opml увоз, бесплатан feed reader',
    ogTitle: 'Fluent RSS Reader — лаган читач RSS',
    heading: 'Fluent RSS Reader',
    tagline: 'Сви ваши извори на једном мирном месту',
    faq: [
      ['Да ли је потребна регистрација?', 'Не. Извори се чувају у прегледачу.'],
      ['Могу ли да пренесем претплате?', 'Да, подржан је увоз и извоз OPML-а.'],
      ['Да ли ради офлајн?', 'Да, последње преузети чланци остају доступни.']
    ]
  }
};

export const LANGS = Object.keys(LOCALES);

/** URL языковой версии: ru живёт в корне, остальные — в /<lang>/ */
export const urlFor = (lang) => (lang === DEFAULT_LANG ? SITE + '/' : `${SITE}/${lang}/`);
