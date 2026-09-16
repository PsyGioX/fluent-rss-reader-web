const RECOMMENDED_FEEDS = {
    "Мировые новости": [
        // Россия
        {
            name: "Лента.ру",
            url: "https://lenta.ru/rss",
            domain: "lenta.ru",
            description: "Актуальные новости России и мира",
            country: "Россия",
            language: "ru",
            quality: 9
        },
        {
            name: "РИА Новости",
            url: "https://ria.ru/export/rss2/archive/index.xml",
            domain: "ria.ru",
            description: "Официальные новости от РИА",
            country: "Россия",
            language: "ru",
            quality: 8
        },
        {
            name: "Коммерсантъ",
            url: "https://www.kommersant.ru/RSS/main.xml",
            domain: "kommersant.ru",
            description: "Деловые новости и аналитика",
            country: "Россия",
            language: "ru",
            quality: 9
        },
        {
            name: "Медуза",
            url: "https://meduza.io/rss/all",
            domain: "meduza.io",
            description: "Независимые новости и журналистика",
            country: "Россия",
            language: "ru",
            quality: 9
        },
        // США
        {
            name: "CNN",
            url: "http://rss.cnn.com/rss/edition.rss",
            domain: "cnn.com",
            description: "Мировые новости от CNN",
            country: "США",
            language: "en",
            quality: 9
        },
        {
            name: "BBC News",
            url: "http://feeds.bbci.co.uk/news/rss.xml",
            domain: "bbc.com",
            description: "Международные новости BBC",
            country: "Великобритания",
            language: "en",
            quality: 10
        },
        {
            name: "Reuters",
            url: "https://feeds.reuters.com/reuters/topNews",
            domain: "reuters.com",
            description: "Мировые новости от Reuters",
            country: "Великобритания",
            language: "en",
            quality: 10
        },
        {
            name: "The Guardian",
            url: "https://www.theguardian.com/world/rss",
            domain: "theguardian.com",
            description: "Независимая журналистика",
            country: "Великобритания",
            language: "en",
            quality: 9
        },
        // Европа
        {
            name: "Deutsche Welle",
            url: "https://rss.dw.com/rdf/rss-en-all",
            domain: "dw.com",
            description: "Немецкие международные новости",
            country: "Германия",
            language: "en",
            quality: 9
        },
        {
            name: "France 24",
            url: "https://www.france24.com/en/rss",
            domain: "france24.com",
            description: "Французские международные новости",
            country: "Франция",
            language: "en",
            quality: 8
        },
        {
            name: "Euronews",
            url: "https://feeds.feedburner.com/euronews/en/home",
            domain: "euronews.com",
            description: "Европейские новости",
            country: "Европа",
            language: "en",
            quality: 8
        },
        // Азия
        {
            name: "NHK World",
            url: "https://www3.nhk.or.jp/rss/news/cat0.xml",
            domain: "nhk.or.jp",
            description: "Японские новости",
            country: "Япония",
            language: "en",
            quality: 8
        },
        {
            name: "Al Jazeera",
            url: "https://www.aljazeera.com/xml/rss/all.xml",
            domain: "aljazeera.com",
            description: "Ближневосточные новости",
            country: "Катар",
            language: "en",
            quality: 8
        }
    ],
    "Технологии": [
        // Русскоязычные
        {
            name: "Хабр",
            url: "https://habr.com/ru/rss/hub/programming/",
            domain: "habr.com",
            description: "IT-статьи и новости технологий",
            country: "Россия",
            language: "ru",
            quality: 9
        },
        {
            name: "CNews",
            url: "https://www.cnews.ru/inc/rss/news.xml",
            domain: "cnews.ru",
            description: "IT-новости и аналитика",
            country: "Россия",
            language: "ru",
            quality: 8
        },
        // Международные
        {
            name: "TechCrunch",
            url: "https://techcrunch.com/feed/",
            domain: "techcrunch.com",
            description: "Стартапы и технологические новости",
            country: "США",
            language: "en",
            quality: 10
        },
        {
            name: "Wired",
            url: "https://www.wired.com/feed/rss",
            domain: "wired.com",
            description: "Технологии, наука, культура",
            country: "США",
            language: "en",
            quality: 9
        },
        {
            name: "Ars Technica",
            url: "https://feeds.arstechnica.com/arstechnica/index",
            domain: "arstechnica.com",
            description: "Глубокая техническая аналитика",
            country: "США",
            language: "en",
            quality: 9
        },
        {
            name: "The Verge",
            url: "https://www.theverge.com/rss/index.xml",
            domain: "theverge.com",
            description: "Технологии и цифровая культура",
            country: "США",
            language: "en",
            quality: 9
        },
        {
            name: "Engadget",
            url: "https://www.engadget.com/rss.xml",
            domain: "engadget.com",
            description: "Гаджеты и потребительские технологии",
            country: "США",
            language: "en",
            quality: 8
        },
        {
            name: "MIT Technology Review",
            url: "https://www.technologyreview.com/feed/",
            domain: "technologyreview.com",
            description: "Передовые технологии от MIT",
            country: "США",
            language: "en",
            quality: 10
        }
    ],
    "Наука": [
        // Русскоязычные
        {
            name: "N+1",
            url: "https://nplus1.ru/rss",
            domain: "nplus1.ru",
            description: "Научно-популярные статьи",
            country: "Россия",
            language: "ru",
            quality: 9
        },
        {
            name: "ПостНаука",
            url: "https://postnauka.ru/rss",
            domain: "postnauka.ru",
            description: "Популярная наука от экспертов",
            country: "Россия",
            language: "ru",
            quality: 8
        },
        // Международные
        {
            name: "Nature",
            url: "https://www.nature.com/nature.rss",
            domain: "nature.com",
            description: "Ведущий научный журнал",
            country: "Великобритания",
            language: "en",
            quality: 10
        },
        {
            name: "Science Magazine",
            url: "https://www.science.org/rss/news_current.xml",
            domain: "science.org",
            description: "Научные исследования и открытия",
            country: "США",
            language: "en",
            quality: 10
        },
        {
            name: "Scientific American",
            url: "https://rss.sciam.com/ScientificAmerican-Global",
            domain: "scientificamerican.com",
            description: "Популярная наука",
            country: "США",
            language: "en",
            quality: 9
        },
        {
            name: "New Scientist",
            url: "https://www.newscientist.com/feed/home/",
            domain: "newscientist.com",
            description: "Научные новости и открытия",
            country: "Великобритания",
            language: "en",
            quality: 9
        },
        {
            name: "Phys.org",
            url: "https://phys.org/rss-feed/",
            domain: "phys.org",
            description: "Физика и технологии",
            country: "США",
            language: "en",
            quality: 8
        }
    ],
    "Спорт": [
        // Россия
        {
            name: "Спорт-Экспресс",
            url: "https://www.sport-express.ru/services/materials/rss/",
            domain: "sport-express.ru",
            description: "Спортивные новости России",
            country: "Россия",
            language: "ru",
            quality: 8
        },
        {
            name: "Чемпионат.com",
            url: "https://www.championat.com/rss/news.xml",
            domain: "championat.com",
            description: "Футбол и другие виды спорта",
            country: "Россия",
            language: "ru",
            quality: 8
        },
        // Международные
        {
            name: "ESPN",
            url: "https://www.espn.com/espn/rss/news",
            domain: "espn.com",
            description: "Американский спорт",
            country: "США",
            language: "en",
            quality: 9
        },
        {
            name: "BBC Sport",
            url: "http://feeds.bbci.co.uk/sport/rss.xml",
            domain: "bbc.com",
            description: "Мировой спорт от BBC",
            country: "Великобритания",
            language: "en",
            quality: 9
        },
        {
            name: "Sky Sports",
            url: "https://www.skysports.com/rss/12040",
            domain: "skysports.com",
            description: "Футбол и спорт",
            country: "Великобритания",
            language: "en",
            quality: 8
        },
        {
            name: "Goal.com",
            url: "https://www.goal.com/feeds/en/news",
            domain: "goal.com",
            description: "Мировой футбол",
            country: "Международный",
            language: "en",
            quality: 8
        }
    ],
    "Развлечения": [
        // Русскоязычные
        {
            name: "Кинопоиск",
            url: "https://www.kinopoisk.ru/rss/news.xml",
            domain: "kinopoisk.ru",
            description: "Новости кино и сериалов",
            country: "Россия",
            language: "ru",
            quality: 8
        },
        {
            name: "Игромания",
            url: "https://www.igromania.ru/rss/",
            domain: "igromania.ru",
            description: "Игровые новости и обзоры",
            country: "Россия",
            language: "ru",
            quality: 8
        },
        // Международные
        {
            name: "IGN",
            url: "https://feeds.ign.com/ign/games-all",
            domain: "ign.com",
            description: "Игровые новости и обзоры",
            country: "США",
            language: "en",
            quality: 9
        },
        {
            name: "GameSpot",
            url: "https://www.gamespot.com/feeds/mashup/",
            domain: "gamespot.com",
            description: "Видеоигры и развлечения",
            country: "США",
            language: "en",
            quality: 8
        },
        {
            name: "Entertainment Weekly",
            url: "https://ew.com/feed/",
            domain: "ew.com",
            description: "Голливуд и поп-культура",
            country: "США",
            language: "en",
            quality: 8
        },
        {
            name: "Variety",
            url: "https://variety.com/feed/",
            domain: "variety.com",
            description: "Индустрия развлечений",
            country: "США",
            language: "en",
            quality: 9
        }
    ],
    "Экономика": [
        // Россия
        {
            name: "РБК",
            url: "https://rssexport.rbc.ru/rbcnews/news/20/full.rss",
            domain: "rbc.ru",
            description: "Деловые новости России",
            country: "Россия",
            language: "ru",
            quality: 9
        },
        {
            name: "Ведомости",
            url: "https://www.vedomosti.ru/rss/news",
            domain: "vedomosti.ru",
            description: "Экономика и бизнес",
            country: "Россия",
            language: "ru",
            quality: 9
        },
        // Международные
        {
            name: "Financial Times",
            url: "https://www.ft.com/rss/home",
            domain: "ft.com",
            description: "Мировые финансовые новости",
            country: "Великобритания",
            language: "en",
            quality: 10
        },
        {
            name: "Bloomberg",
            url: "https://feeds.bloomberg.com/markets/news.rss",
            domain: "bloomberg.com",
            description: "Финансовые рынки",
            country: "США",
            language: "en",
            quality: 10
        },
        {
            name: "Wall Street Journal",
            url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml",
            domain: "wsj.com",
            description: "Деловые новости США",
            country: "США",
            language: "en",
            quality: 10
        },
        {
            name: "The Economist",
            url: "https://www.economist.com/rss/latest_updates_rss.xml",
            domain: "economist.com",
            description: "Экономическая аналитика",
            country: "Великобритания",
            language: "en",
            quality: 10
        }
    ],
    "Здоровье": [
        {
            name: "WebMD",
            url: "https://rssfeeds.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC",
            domain: "webmd.com",
            description: "Медицинские новости и советы",
            country: "США",
            language: "en",
            quality: 8
        },
        {
            name: "Mayo Clinic",
            url: "https://newsnetwork.mayoclinic.org/feed/",
            domain: "mayoclinic.org",
            description: "Медицинские исследования",
            country: "США",
            language: "en",
            quality: 9
        },
        {
            name: "Healthline",
            url: "https://www.healthline.com/rss",
            domain: "healthline.com",
            description: "Здоровье и медицина",
            country: "США",
            language: "en",
            quality: 8
        }
    ],
    "Экология": [
        {
            name: "National Geographic",
            url: "https://feeds.nationalgeographic.com/ng/News/News_Main",
            domain: "nationalgeographic.com",
            description: "Природа и экология",
            country: "США",
            language: "en",
            quality: 9
        },
        {
            name: "Environmental News Network",
            url: "https://www.enn.com/rss",
            domain: "enn.com",
            description: "Экологические новости",
            country: "США",
            language: "en",
            quality: 8
        },
        {
            name: "TreeHugger",
            url: "https://www.treehugger.com/feeds/rss",
            domain: "treehugger.com",
            description: "Устойчивое развитие",
            country: "США",
            language: "en",
            quality: 8
        }
    ]
};

window.RECOMMENDED_FEEDS = RECOMMENDED_FEEDS;

/* Иконки категорий: Bootstrap Icons вместо эмодзи */
window.CATEGORY_ICONS = {"Мировые новости": "bi-globe-americas", "Технологии": "bi-cpu", "Наука": "bi-eyedropper", "Спорт": "bi-trophy", "Развлечения": "bi-film", "Экономика": "bi-graph-up-arrow", "Здоровье": "bi-heart-pulse", "Экология": "bi-tree"};

