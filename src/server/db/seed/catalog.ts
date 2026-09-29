/**
 * Reference data: cities, districts and the service taxonomy.
 * Used by the seed script; safe to re-run (upserts by slug).
 */

export const CITIES = [
  { slug: "saratov", name: "Саратов", nameIn: "в Саратове", region: "Саратовская область", lat: 51.5331, lng: 46.0342, isActive: true, sortOrder: 0 },
  { slug: "engels", name: "Энгельс", nameIn: "в Энгельсе", region: "Саратовская область", lat: 51.4855, lng: 46.1265, isActive: false, sortOrder: 1 },
  { slug: "samara", name: "Самара", nameIn: "в Самаре", region: "Самарская область", lat: 53.1959, lng: 50.1002, isActive: false, sortOrder: 2 },
  { slug: "volgograd", name: "Волгоград", nameIn: "в Волгограде", region: "Волгоградская область", lat: 48.708, lng: 44.5133, isActive: false, sortOrder: 3 },
  { slug: "kazan", name: "Казань", nameIn: "в Казани", region: "Республика Татарстан", lat: 55.7961, lng: 49.1064, isActive: false, sortOrder: 4 },
];

/** Administrative districts of Saratov (approximate centroids). */
export const SARATOV_DISTRICTS = [
  { slug: "volzhsky", name: "Волжский", lat: 51.5335, lng: 46.0455 },
  { slug: "frunzensky", name: "Фрунзенский", lat: 51.5287, lng: 46.0208 },
  { slug: "oktyabrsky", name: "Октябрьский", lat: 51.5452, lng: 46.0095 },
  { slug: "kirovsky", name: "Кировский", lat: 51.5611, lng: 45.9892 },
  { slug: "leninsky", name: "Ленинский", lat: 51.5905, lng: 45.9551 },
  { slug: "zavodskoy", name: "Заводской", lat: 51.4851, lng: 45.9868 },
  { slug: "gagarinsky", name: "Гагаринский", lat: 51.6408, lng: 45.9421 },
];

type Svc = [slug: string, name: string, priceFrom: number, unit: string, popular?: boolean, keywords?: string];
type Sub = { slug: string; name: string; plural: string; icon: string; keywords: string; services: Svc[] };
type Cat = { slug: string; name: string; icon: string; emoji: string; tone: string; description: string; subs: Sub[] };

export const CATALOG: Cat[] = [
  {
    slug: "remont",
    name: "Ремонт",
    icon: "Wrench",
    emoji: "🔧",
    tone: "amber",
    description: "Сантехника, электрика, мастер на час и ремонт квартир",
    subs: [
      {
        slug: "santehnik", name: "Сантехник", plural: "Сантехники", icon: "Droplets",
        keywords: "сантехник сантехника труба трубы течет течёт протечка кран смеситель унитаз раковина засор канализация водопровод бойлер",
        services: [
          ["ustranit-protechku", "Устранить протечку", 800, "за выезд", true, "течет протекает капает протечка"],
          ["ustanovit-smesitel", "Установить смеситель", 900, "за работу", true, "смеситель кран"],
          ["prochistit-zasor", "Прочистить засор", 1000, "за работу", true, "засор канализация забилась"],
          ["ustanovit-unitaz", "Установить унитаз", 2500, "за работу", false, "унитаз"],
          ["razvodka-trub", "Разводка труб", 6000, "за точку", false, "трубы разводка"],
        ],
      },
      {
        slug: "elektrik", name: "Электрик", plural: "Электрики", icon: "Zap",
        keywords: "электрик электрика проводка розетка выключатель свет люстра автомат щиток замыкание",
        services: [
          ["ustanovit-rozetku", "Установить розетку", 400, "за точку", true, "розетка"],
          ["povesit-lyustru", "Повесить люстру", 900, "за работу", true, "люстра светильник"],
          ["zamenit-provodku", "Заменить проводку", 15000, "за квартиру", false, "проводка"],
          ["sobrat-shitok", "Собрать электрощиток", 5000, "за работу", false, "щиток автомат"],
          ["nayti-zamykanie", "Найти короткое замыкание", 1500, "за выезд", false, "замыкание выбивает"],
        ],
      },
      {
        slug: "master-na-chas", name: "Мастер на час", plural: "Мастера на час", icon: "Hammer",
        keywords: "мастер на час муж на час повесить полку карниз мелкий ремонт",
        services: [
          ["povesit-polku", "Повесить полку или карниз", 600, "за работу", true, "полка карниз"],
          ["melkiy-remont", "Мелкий бытовой ремонт", 1200, "за час", true, ""],
          ["povesit-tv", "Повесить телевизор", 1500, "за работу", false, "телевизор кронштейн"],
        ],
      },
      {
        slug: "remont-kvartir", name: "Ремонт квартир", plural: "Бригады по ремонту", icon: "PaintRoller",
        keywords: "ремонт квартиры отделка косметический капитальный под ключ бригада",
        services: [
          ["kosmeticheskiy-remont", "Косметический ремонт", 2500, "за м²", true, "косметический"],
          ["remont-pod-klyuch", "Ремонт под ключ", 9000, "за м²", true, "под ключ капитальный"],
          ["remont-vannoy", "Ремонт ванной", 60000, "за работу", false, "ванная санузел"],
        ],
      },
      {
        slug: "plitochnik", name: "Плиточник", plural: "Плиточники", icon: "Grid3x3",
        keywords: "плитка плиточник кафель керамогранит укладка",
        services: [
          ["ukladka-plitki", "Укладка плитки", 1200, "за м²", true, "плитка кафель"],
          ["zatirka-shvov", "Затирка швов", 300, "за м²", false, ""],
        ],
      },
      {
        slug: "maliar", name: "Маляр-штукатур", plural: "Маляры", icon: "Paintbrush",
        keywords: "покраска стены штукатурка шпаклевка обои поклейка маляр",
        services: [
          ["pokleyka-oboev", "Поклейка обоев", 250, "за м²", true, "обои"],
          ["pokraska-sten", "Покраска стен", 300, "за м²", false, "покраска"],
          ["shtukaturka", "Штукатурка стен", 500, "за м²", false, "штукатурка шпаклевка"],
        ],
      },
    ],
  },
  {
    slug: "dom",
    name: "Дом",
    icon: "House",
    emoji: "🏠",
    tone: "sage",
    description: "Уборка, бытовая техника, климат, окна и мебель",
    subs: [
      {
        slug: "uborka", name: "Уборка", plural: "Клинеры", icon: "Sparkles",
        keywords: "уборка клининг помыть квартиру генеральная мытьё окон чистота",
        services: [
          ["podderzhivayushchaya-uborka", "Поддерживающая уборка", 2000, "за квартиру", true, "уборка"],
          ["generalnaya-uborka", "Генеральная уборка", 5000, "за квартиру", true, "генеральная"],
          ["uborka-posle-remonta", "Уборка после ремонта", 7000, "за квартиру", false, "после ремонта"],
          ["myte-okon", "Мытьё окон", 400, "за окно", false, "окна мытье"],
        ],
      },
      {
        slug: "himchistka", name: "Химчистка мебели", plural: "Химчистка", icon: "SprayCan",
        keywords: "химчистка диван ковер матрас пятна",
        services: [
          ["himchistka-divana", "Химчистка дивана", 2500, "за диван", true, "диван"],
          ["himchistka-kovra", "Химчистка ковра", 250, "за м²", false, "ковер"],
        ],
      },
      {
        slug: "remont-tehniki", name: "Ремонт бытовой техники", plural: "Мастера по технике", icon: "WashingMachine",
        keywords: "стиральная машина холодильник посудомойка ремонт техники духовка плита микроволновка",
        services: [
          ["remont-stiralnoy", "Ремонт стиральной машины", 1200, "диагностика", true, "стиральная машинка"],
          ["remont-holodilnika", "Ремонт холодильника", 1200, "диагностика", true, "холодильник"],
          ["remont-posudomoyki", "Ремонт посудомоечной машины", 1200, "диагностика", false, "посудомойка"],
        ],
      },
      {
        slug: "kondicionery", name: "Кондиционеры", plural: "Монтажники кондиционеров", icon: "AirVent",
        keywords: "кондиционер сплит система монтаж заправка чистка климат",
        services: [
          ["ustanovka-kondicionera", "Установка кондиционера", 6000, "за работу", true, "установка"],
          ["chistka-kondicionera", "Чистка кондиционера", 2000, "за блок", false, "чистка обслуживание"],
          ["zapravka-kondicionera", "Заправка фреоном", 2500, "за работу", false, "фреон заправка"],
        ],
      },
      {
        slug: "okna", name: "Окна и балконы", plural: "Мастера по окнам", icon: "AppWindow",
        keywords: "окна пластиковые регулировка балкон остекление москитная сетка стеклопакет",
        services: [
          ["regulirovka-okon", "Регулировка окон", 500, "за створку", true, "регулировка продувает"],
          ["osteklenie-balkona", "Остекление балкона", 35000, "за работу", false, "балкон"],
        ],
      },
      {
        slug: "dveri", name: "Двери и замки", plural: "Мастера по дверям", icon: "DoorOpen",
        keywords: "дверь двери установка межкомнатные входная замок вскрытие",
        services: [
          ["ustanovka-dveri", "Установка межкомнатной двери", 3000, "за дверь", true, "межкомнатная"],
          ["vskrytie-zamka", "Вскрытие замка", 1500, "за выезд", false, "вскрыть замок захлопнулась"],
        ],
      },
      {
        slug: "mebel", name: "Мебель", plural: "Мебельщики", icon: "Sofa",
        keywords: "мебель сборка шкаф кухня на заказ перетяжка",
        services: [
          ["sborka-mebeli", "Сборка мебели", 800, "за час", true, "сборка икеа шкаф"],
          ["kuhnya-na-zakaz", "Кухня на заказ", 60000, "за проект", false, "кухня"],
          ["peretyazhka", "Перетяжка мебели", 5000, "за изделие", false, "перетяжка"],
        ],
      },
    ],
  },
  {
    slug: "avto",
    name: "Авто",
    icon: "Car",
    emoji: "🚗",
    tone: "slate",
    description: "Автосервис, шиномонтаж, эвакуатор и детейлинг",
    subs: [
      {
        slug: "avtoservis", name: "Автосервис", plural: "Автосервисы", icon: "Car",
        keywords: "автосервис сто ремонт авто машины двигатель подвеска то замена масла диагностика",
        services: [
          ["zamena-masla", "Замена масла", 700, "за работу", true, "масло"],
          ["diagnostika-avto", "Компьютерная диагностика", 1000, "за работу", true, "диагностика"],
          ["remont-podveski", "Ремонт подвески", 2500, "за работу", false, "подвеска стучит"],
        ],
      },
      {
        slug: "shinomontazh", name: "Шиномонтаж", plural: "Шиномонтажи", icon: "CircleDot",
        keywords: "шиномонтаж шины колеса переобуть резина балансировка прокол",
        services: [
          ["pereobuvka", "Сезонная переобувка", 1600, "за комплект", true, "переобуть резина"],
          ["remont-proloka", "Ремонт прокола", 400, "за колесо", false, "прокол"],
          ["vyezdnoy-shinomontazh", "Выездной шиномонтаж", 2000, "за выезд", false, "выездной"],
        ],
      },
      {
        slug: "evakuator", name: "Эвакуатор", plural: "Эвакуаторы", icon: "Truck",
        keywords: "эвакуатор эвакуация буксир перевезти машину дтп",
        services: [["evakuaciya-legkovogo", "Эвакуация легкового авто", 2500, "по городу", true, "эвакуация"]],
      },
      {
        slug: "avtoelektrik", name: "Автоэлектрик", plural: "Автоэлектрики", icon: "BatteryCharging",
        keywords: "автоэлектрик аккумулятор прикурить сигнализация проводка авто",
        services: [
          ["prikurit", "Прикурить автомобиль", 800, "за выезд", true, "прикурить аккумулятор сел"],
          ["ustanovka-signalizacii", "Установка сигнализации", 4000, "за работу", false, "сигнализация"],
        ],
      },
      {
        slug: "deteyling", name: "Детейлинг и мойка", plural: "Детейлинг-студии", icon: "Droplet",
        keywords: "мойка детейлинг полировка химчистка салона керамика",
        services: [
          ["himchistka-salona", "Химчистка салона", 6000, "за работу", true, "салон"],
          ["polirovka", "Полировка кузова", 8000, "за работу", false, "полировка"],
        ],
      },
    ],
  },
  {
    slug: "krasota",
    name: "Красота",
    icon: "Sparkle",
    emoji: "💆",
    tone: "rose",
    description: "Волосы, ногти, макияж, массаж и уход",
    subs: [
      {
        slug: "parikmaher", name: "Парикмахер", plural: "Парикмахеры", icon: "Scissors",
        keywords: "парикмахер стрижка окрашивание волосы укладка прическа",
        services: [
          ["zhenskaya-strizhka", "Женская стрижка", 1200, "за услугу", true, "стрижка"],
          ["okrashivanie", "Окрашивание", 3500, "за услугу", true, "окрашивание цвет"],
          ["ukladka", "Укладка", 1500, "за услугу", false, "укладка"],
        ],
      },
      {
        slug: "barber", name: "Барбер", plural: "Барберы", icon: "Scissors",
        keywords: "барбер мужская стрижка борода бритье",
        services: [["muzhskaya-strizhka", "Мужская стрижка", 900, "за услугу", true, "мужская"], ["boroda-modelirovanie", "Моделирование бороды", 600, "за услугу", false, "борода"]],
      },
      {
        slug: "manikyur", name: "Маникюр и педикюр", plural: "Мастера маникюра", icon: "Hand",
        keywords: "маникюр педикюр ногти гель лак наращивание",
        services: [
          ["manikyur-pokrytie", "Маникюр с покрытием", 1500, "за услугу", true, "гель-лак"],
          ["pedikyur", "Педикюр", 1800, "за услугу", false, "педикюр"],
          ["narashchivanie-nogtey", "Наращивание ногтей", 2500, "за услугу", false, "наращивание"],
        ],
      },
      {
        slug: "vizazhist", name: "Визажист", plural: "Визажисты", icon: "Palette",
        keywords: "визажист макияж свадебный вечерний образ брови",
        services: [["vecherniy-makiyazh", "Вечерний макияж", 2500, "за образ", true, "макияж"], ["svadebnyy-obraz", "Свадебный образ", 6000, "за образ", false, "свадебный"]],
      },
      {
        slug: "massazh", name: "Массаж", plural: "Массажисты", icon: "HandHeart",
        keywords: "массаж массажист спина шея расслабляющий спортивный лимфодренажный",
        services: [
          ["massazh-spiny", "Массаж спины", 1500, "за сеанс", true, "спина"],
          ["obshchiy-massazh", "Общий массаж", 3000, "за сеанс", false, "общий"],
        ],
      },
      {
        slug: "kosmetolog", name: "Косметолог", plural: "Косметологи", icon: "Flower2",
        keywords: "косметолог чистка лица уход кожа пилинг",
        services: [["chistka-lica", "Чистка лица", 2500, "за процедуру", true, "чистка"], ["piling", "Пилинг", 2000, "за процедуру", false, "пилинг"]],
      },
    ],
  },
  {
    slug: "obuchenie",
    name: "Обучение",
    icon: "GraduationCap",
    emoji: "📚",
    tone: "indigo",
    description: "Репетиторы, языки, музыка и подготовка к экзаменам",
    subs: [
      {
        slug: "repetitor-matematika", name: "Репетитор по математике", plural: "Репетиторы по математике", icon: "Sigma",
        keywords: "репетитор математика алгебра геометрия егэ огэ",
        services: [["podgotovka-ege-matematika", "Подготовка к ЕГЭ", 1200, "за 60 мин", true, "егэ"], ["matematika-shkola", "Школьная программа", 900, "за 60 мин", false, "школа"]],
      },
      {
        slug: "angliyskiy", name: "Английский язык", plural: "Преподаватели английского", icon: "Languages",
        keywords: "английский язык репетитор english разговорный ielts",
        services: [["razgovornyy-angliyskiy", "Разговорный английский", 1200, "за 60 мин", true, "разговорный"], ["angliyskiy-deti", "Английский для детей", 900, "за 45 мин", false, "дети"]],
      },
      {
        slug: "muzyka", name: "Музыка", plural: "Преподаватели музыки", icon: "Music",
        keywords: "гитара фортепиано вокал музыка уроки пианино",
        services: [["uroki-gitary", "Уроки гитары", 1000, "за 60 мин", true, "гитара"], ["vokal", "Вокал", 1200, "за 60 мин", false, "вокал пение"]],
      },
      {
        slug: "logoped", name: "Логопед", plural: "Логопеды", icon: "MessageCircleHeart",
        keywords: "логопед речь постановка звуков дети",
        services: [["postanovka-zvukov", "Постановка звуков", 1200, "за занятие", true, "звуки р"]],
      },
    ],
  },
  {
    slug: "sport",
    name: "Спорт",
    icon: "Dumbbell",
    emoji: "🏋️",
    tone: "lime",
    description: "Персональные тренеры, единоборства, йога",
    subs: [
      {
        slug: "trener", name: "Персональный тренер", plural: "Тренеры", icon: "Dumbbell",
        keywords: "тренер фитнес персональный похудение тренировки зал",
        services: [["personalnaya-trenirovka", "Персональная тренировка", 1500, "за занятие", true, "тренировка"], ["programma-pitaniya", "Программа питания", 3000, "за программу", false, "питание"]],
      },
      {
        slug: "boks", name: "Бокс и единоборства", plural: "Тренеры по единоборствам", icon: "Swords",
        keywords: "бокс кикбоксинг единоборства тренер по боксу самооборона мма",
        services: [["trenirovka-boks", "Тренировка по боксу", 1300, "за занятие", true, "бокс"]],
      },
      {
        slug: "yoga", name: "Йога", plural: "Инструкторы йоги", icon: "Flower",
        keywords: "йога растяжка стретчинг медитация пилатес",
        services: [["individualnaya-yoga", "Индивидуальная йога", 1500, "за занятие", true, "йога"]],
      },
      {
        slug: "plavanie", name: "Плавание", plural: "Тренеры по плаванию", icon: "Waves",
        keywords: "плавание бассейн научить плавать тренер",
        services: [["obuchenie-plavaniyu", "Обучение плаванию", 1400, "за занятие", true, "плавание"]],
      },
    ],
  },
  {
    slug: "foto-video",
    name: "Фото и видео",
    icon: "Camera",
    emoji: "📸",
    tone: "violet",
    description: "Фотографы, видеографы, монтаж",
    subs: [
      {
        slug: "fotograf", name: "Фотограф", plural: "Фотографы", icon: "Camera",
        keywords: "фотограф фотосессия свадьба портрет семейная съемка",
        services: [
          ["svadebnaya-semka", "Свадебная фотосъёмка", 15000, "за день", true, "свадьба свадебный"],
          ["portretnaya-fotosessiya", "Портретная фотосессия", 3500, "за час", true, "портрет"],
          ["predmetnaya-semka", "Предметная съёмка", 300, "за кадр", false, "товары предметная"],
        ],
      },
      {
        slug: "videograf", name: "Видеограф", plural: "Видеографы", icon: "Video",
        keywords: "видеограф видеосъемка клип свадебное видео reels",
        services: [["svadebnoe-video", "Свадебное видео", 20000, "за день", true, "свадьба"], ["reels", "Съёмка Reels", 3000, "за ролик", false, "reels ролики"]],
      },
      {
        slug: "montazh", name: "Монтаж видео", plural: "Монтажёры", icon: "Clapperboard",
        keywords: "монтаж видео обработка цветокоррекция",
        services: [["montazh-rolika", "Монтаж ролика", 2000, "за минуту", true, "монтаж"]],
      },
    ],
  },
  {
    slug: "it",
    name: "IT и гаджеты",
    icon: "Laptop",
    emoji: "💻",
    tone: "cyan",
    description: "Ремонт телефонов и компьютеров, сайты, дизайн",
    subs: [
      {
        slug: "remont-telefonov", name: "Ремонт телефонов", plural: "Мастера по телефонам", icon: "Smartphone",
        keywords: "ремонт телефона айфон iphone экран замена стекла аккумулятор android смартфон",
        services: [
          ["zamena-ekrana", "Замена экрана", 2500, "за работу", true, "экран стекло разбил"],
          ["zamena-akkumulyatora", "Замена аккумулятора", 1500, "за работу", true, "аккумулятор батарея"],
        ],
      },
      {
        slug: "remont-kompyuterov", name: "Ремонт компьютеров", plural: "Компьютерные мастера", icon: "Monitor",
        keywords: "компьютер ноутбук ремонт windows переустановка вирусы чистка",
        services: [["ustanovka-windows", "Установка Windows", 1200, "за работу", true, "windows"], ["chistka-noutbuka", "Чистка ноутбука", 1500, "за работу", false, "чистка перегрев"]],
      },
      {
        slug: "sayty", name: "Сайты и боты", plural: "Разработчики", icon: "Code",
        keywords: "сайт разработка лендинг telegram бот интернет магазин программист",
        services: [["lending", "Лендинг", 25000, "за проект", true, "лендинг сайт"], ["telegram-bot", "Telegram-бот", 20000, "за проект", false, "бот"]],
      },
      {
        slug: "dizayner", name: "Дизайнер", plural: "Дизайнеры", icon: "PenTool",
        keywords: "дизайнер логотип дизайн интерьера графический баннер",
        services: [["logotip", "Логотип", 8000, "за проект", true, "логотип"], ["dizayn-interera", "Дизайн интерьера", 1500, "за м²", true, "интерьер"]],
      },
    ],
  },
  {
    slug: "dostavka",
    name: "Доставка и переезды",
    icon: "Package",
    emoji: "📦",
    tone: "orange",
    description: "Курьеры, грузоперевозки, грузчики",
    subs: [
      {
        slug: "kurer", name: "Курьер", plural: "Курьеры", icon: "Bike",
        keywords: "курьер доставка документы отвезти забрать",
        services: [["srochnaya-dostavka", "Срочная доставка по городу", 400, "за заказ", true, "доставка"]],
      },
      {
        slug: "gruzoperevozki", name: "Грузоперевозки", plural: "Перевозчики", icon: "Truck",
        keywords: "грузоперевозки газель переезд перевезти мебель квартирный",
        services: [
          ["kvartirnyy-pereezd", "Квартирный переезд", 3500, "от", true, "переезд"],
          ["gazel-s-gruzchikami", "Газель с грузчиками", 1200, "за час", true, "газель"],
        ],
      },
      {
        slug: "gruzchiki", name: "Грузчики", plural: "Грузчики", icon: "PackageOpen",
        keywords: "грузчики разгрузка погрузка поднять вынести мусор",
        services: [["gruzchiki-chas", "Грузчики", 450, "за час", true, "грузчик"], ["vyvoz-musora", "Вывоз мусора", 2500, "за рейс", false, "мусор"]],
      },
    ],
  },
  {
    slug: "biznes",
    name: "Деловые услуги",
    icon: "Scale",
    emoji: "⚖️",
    tone: "stone",
    description: "Юристы, бухгалтеры, переводчики",
    subs: [
      {
        slug: "yurist", name: "Юрист", plural: "Юристы", icon: "Scale",
        keywords: "юрист консультация договор суд адвокат иск наследство",
        services: [["konsultaciya-yurista", "Консультация юриста", 1500, "за час", true, "консультация"], ["sostavlenie-dogovora", "Составление договора", 3000, "за документ", false, "договор"]],
      },
      {
        slug: "buhgalter", name: "Бухгалтер", plural: "Бухгалтеры", icon: "Calculator",
        keywords: "бухгалтер отчетность ип ооо налоги декларация 3-ндфл",
        services: [["deklaraciya-3ndfl", "Декларация 3-НДФЛ", 1500, "за документ", true, "декларация вычет"], ["vedenie-ip", "Ведение ИП", 3000, "в месяц", false, "ип"]],
      },
      {
        slug: "perevodchik", name: "Переводчик", plural: "Переводчики", icon: "Languages",
        keywords: "переводчик перевод документов нотариальный английский немецкий",
        services: [["perevod-dokumentov", "Перевод документов", 600, "за страницу", true, "перевод"]],
      },
    ],
  },
  {
    slug: "meropriyatiya",
    name: "Мероприятия",
    icon: "PartyPopper",
    emoji: "🎉",
    tone: "fuchsia",
    description: "Ведущие, DJ, организация праздников",
    subs: [
      {
        slug: "vedushchiy", name: "Ведущий", plural: "Ведущие", icon: "Mic",
        keywords: "ведущий тамада свадьба корпоратив юбилей",
        services: [["vedushchiy-svadba", "Ведущий на свадьбу", 20000, "за вечер", true, "свадьба"], ["vedushchiy-korporativ", "Ведущий корпоратива", 15000, "за вечер", false, "корпоратив"]],
      },
      {
        slug: "dj", name: "DJ", plural: "Диджеи", icon: "Disc3",
        keywords: "dj диджей музыка на праздник звук",
        services: [["dj-na-prazdnik", "DJ на праздник", 10000, "за вечер", true, "диджей"]],
      },
      {
        slug: "organizaciya", name: "Организация мероприятий", plural: "Организаторы", icon: "CalendarHeart",
        keywords: "организация праздника день рождения декор оформление шары детский праздник",
        services: [["detskiy-prazdnik", "Детский праздник", 8000, "за программу", true, "детский аниматор"], ["oformlenie-sharami", "Оформление шарами", 3000, "за заказ", false, "шары декор"]],
      },
    ],
  },
  {
    slug: "stroitelstvo",
    name: "Строительство",
    icon: "HardHat",
    emoji: "🏗️",
    tone: "clay",
    description: "Дома, кровля, фундаменты, заборы",
    subs: [
      {
        slug: "stroitelstvo-domov", name: "Строительство домов", plural: "Строительные бригады", icon: "Building2",
        keywords: "строительство дом баня коттедж пристройка каркасный",
        services: [["karkasnyy-dom", "Каркасный дом", 25000, "за м²", true, "каркасный"], ["banya", "Строительство бани", 400000, "за объект", false, "баня"]],
      },
      {
        slug: "krovlya", name: "Кровельщик", plural: "Кровельщики", icon: "Tent",
        keywords: "кровля крыша ремонт кровли металлочерепица протекает крыша",
        services: [["remont-krovli", "Ремонт кровли", 700, "за м²", true, "крыша"]],
      },
      {
        slug: "zabory", name: "Заборы и фундаменты", plural: "Мастера по заборам", icon: "Fence",
        keywords: "забор фундамент профнастил ворота бетон",
        services: [["zabor-iz-profnastila", "Забор из профнастила", 1500, "за п.м.", true, "забор"], ["lentochnyy-fundament", "Ленточный фундамент", 6000, "за м³", false, "фундамент"]],
      },
    ],
  },
];
