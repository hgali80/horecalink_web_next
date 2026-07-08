const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const localeDir = path.join(projectRoot, "app", "locales");

const localeFiles = {
  tr: path.join(localeDir, "tr.json"),
  ru: path.join(localeDir, "ru.json"),
  kz: path.join(localeDir, "kz.json"),
  en: path.join(localeDir, "en.json"),
};

const groupTranslations = {
  paslanmaz: {
    tr: "Paslanmaz Ekipmanlar",
    ru: "Нержавеющее оборудование",
    kz: "Тот баспайтын жабдықтар",
    en: "Stainless Steel Equipment",
  },
  accessories: {
    tr: "Aksesuar",
    ru: "Аксессуары",
    kz: "Аксессуарлар",
    en: "Accessories",
  },
};

const mainTranslations = {
  aspiratorler: {
    tr: "Aspiratörler",
    ru: "Вытяжные системы",
    kz: "Сорғыштар",
    en: "Hoods",
  },
  stantlar: {
    tr: "Stantlar",
    ru: "Подставки",
    kz: "Тұғырлар",
    en: "Stands",
  },
  "beverage-equipment": {
    tr: "İçecek Hazırlama",
    ru: "Приготовление напитков",
    kz: "Сусын дайындау",
    en: "Beverage Preparation",
  },
  cookware: {
    tr: "Tencere ve Tavalar",
    ru: "Кастрюли и сковороды",
    kz: "Кәстрөлдер мен табалар",
    en: "Cookware",
  },
  "prep-equipment": {
    tr: "Hazırlık Ekipmanları",
    ru: "Подготовительное оборудование",
    kz: "Дайындау жабдықтары",
    en: "Prep Equipment",
  },
  "prep-tools": {
    tr: "Hazırlık Araçları",
    ru: "Инструменты подготовки",
    kz: "Дайындау құралдары",
    en: "Prep Tools",
  },
  refrigeration: {
    tr: "Soğutma",
    ru: "Охлаждение",
    kz: "Салқындату",
    en: "Refrigeration",
  },
  "service-tools": {
    tr: "Servis",
    ru: "Сервис",
    kz: "Қызмет көрсету",
    en: "Service Tools",
  },
  "washing-equipment": {
    tr: "Yıkama",
    ru: "Мойка",
    kz: "Жуу",
    en: "Washing Equipment",
  },
  "prep-stations": {
    tr: "Hazırlık İstasyonları",
    ru: "Станции подготовки",
    kz: "Дайындау станциялары",
    en: "Prep Stations",
  },
  "spare-parts": {
    tr: "Yedek Parçalar",
    ru: "Запасные части",
    kz: "Қосалқы бөлшектер",
    en: "Spare Parts",
  },
  "evyeli-tezgahlar": {
    tr: "Evyeli Tezgahlar",
    ru: "Моечные столы",
    kz: "Жуғыш үстелдер",
    en: "Sink Tables",
  },
  "aspirator-ve-aydinlatma-sistemleri": {
    tr: "Aspiratör ve Aydınlatma Sistemleri",
    ru: "Вытяжные и осветительные системы",
    kz: "Сорғыш және жарықтандыру жүйелері",
    en: "Hood & Lighting Systems",
  },
  "kazan-ve-sebze-yikama-tezgahlari": {
    tr: "Kazan ve Sebze Yıkama Tezgahları",
    ru: "Столы для мойки котлов и овощей",
    kz: "Қазан және көкөніс жуу үстелдері",
    en: "Pot & Vegetable Washing Tables",
  },
  "bulasik-makinesi-tezgahlari": {
    tr: "Bulaşık Makinesi Tezgahları",
    ru: "Столы для посудомоечных машин",
    kz: "Ыдыс жуғыш машина үстелдері",
    en: "Dishwasher Tables",
  },
  "servis-raflari": {
    tr: "Servis Rafları",
    ru: "Сервисные полки",
    kz: "Сервис сөрелері",
    en: "Service Shelves",
  },
  "servis-hatlari": {
    tr: "Servis Hatları",
    ru: "Линии раздачи",
    kz: "Тарату желілері",
    en: "Service Lines",
  },
  dolaplar: {
    tr: "Dolaplar",
    ru: "Шкафы",
    kz: "Шкафтар",
    en: "Cabinets",
  },
  tezgahlar: {
    tr: "Tezgahlar",
    ru: "Рабочие столы",
    kz: "Жұмыс үстелдері",
    en: "Work Tables",
  },
  "raf-ve-dolap-sistemleri": {
    tr: "Raf ve Dolap Sistemleri",
    ru: "Стеллажные и шкафные системы",
    kz: "Сөре және шкаф жүйелері",
    en: "Shelving & Cabinet Systems",
  },
  "firin-stantlari": {
    tr: "Fırın Stantları",
    ru: "Подставки для печей",
    kz: "Пеш тұғырлары",
    en: "Oven Stands",
  },
  "tabla-ve-tepsi-arabalari": {
    tr: "Tabla ve Tepsi Arabaları",
    ru: "Тележки для подносов и противней",
    kz: "Науа және таба арбалары",
    en: "Tray & Pan Trolleys",
  },
  "bar-tezgahlari": {
    tr: "Bar Tezgahları",
    ru: "Барные стойки",
    kz: "Бар үстелдері",
    en: "Bar Counters",
  },
  "storage-and-transport": {
    tr: "Depolama ve Taşıma Ürünleri",
    ru: "Продукция для хранения и перевозки",
    kz: "Сақтау және тасымалдау өнімдері",
    en: "Storage & Transport Products",
  },
};

const subTranslations = {
  "bulasik-makinesi-basketi-rafi": {
    tr: "Bulaşık Makinesi Basketi Rafı",
    ru: "Полка для корзин посудомоечной машины",
    kz: "Ыдыс жуғыш машина кәрзеңке сөресі",
    en: "Dishwasher Basket Shelf",
  },
  "bulasik-siyirma-tezgahi": {
    tr: "Bulaşık Sıyırma Tezgahı",
    ru: "Стол для соскребания посуды",
    kz: "Ыдыс қырнау үстелі",
    en: "Dish Scrapping Table",
  },
  "depo-istif-tablasi": {
    tr: "Depo İstif Tablası",
    ru: "Складская штабелируемая платформа",
    kz: "Қойма жинақтау платформасы",
    en: "Storage Stacking Platform",
  },
  "grill-master-standi": {
    tr: "Grill Master Standı",
    ru: "Подставка Grill Master",
    kz: "Grill Master тұғыры",
    en: "Grill Master Stand",
  },
  "mop-evye-tazgahi": {
    tr: "Mop Evye Tezgahı",
    ru: "Стол-мойка для мопов",
    kz: "Моп жуу үстелі",
    en: "Mop Sink Table",
  },
  "premix-tezgahi": {
    tr: "Premix Tezgahı",
    ru: "Премикс-стол",
    kz: "Premix үстелі",
    en: "Premix Counter",
  },
  "1-evyeli-tezgahlar": {
    tr: "1 Evyeli Tezgahlar",
    ru: "Односекционные моечные столы",
    kz: "1 секциялы жуу үстелдері",
    en: "Single-Bowl Sink Tables",
  },
  "1-evyeli-tezgahlar-kaynakli-evyeli": {
    tr: "1 Evyeli Tezgahlar (Kaynaklı Evyeli)",
    ru: "Односекционные столы с цельносварной мойкой",
    kz: "1 секциялы дәнекерленген жуу үстелдері",
    en: "Single-Bowl Tables with Welded Sink",
  },
  "2-evyeli-tezgahlar": {
    tr: "2 Evyeli Tezgahlar",
    ru: "Двухсекционные моечные столы",
    kz: "2 секциялы жуу үстелдері",
    en: "Double-Bowl Sink Tables",
  },
  "3-evyeli-tezgahlar": {
    tr: "3 Evyeli Tezgahlar",
    ru: "Трехсекционные моечные столы",
    kz: "3 секциялы жуу үстелдері",
    en: "Triple-Bowl Sink Tables",
  },
  "ada-tipi-davlumbaz": {
    tr: "Ada Tipi Davlumbaz",
    ru: "Островные вытяжные зонты",
    kz: "Арал типті сорғыш қалқандар",
    en: "Island Type Hoods",
  },
  "aspirator-aydinlatmasi": {
    tr: "Aspiratör Aydınlatması",
    ru: "Подсветка вытяжки",
    kz: "Сорғыш жарығы",
    en: "Hood Lighting",
  },
  "aspirator-rafi": {
    tr: "Aspiratör Rafı",
    ru: "Полки для вытяжки",
    kz: "Сорғыш сөрелері",
    en: "Hood Shelves",
  },
  "balik-isleme-tezgahi": {
    tr: "Balık İşleme Tezgahı",
    ru: "Столы для обработки рыбы",
    kz: "Балық өңдеу үстелдері",
    en: "Fish Processing Tables",
  },
  "bulasik-makinesi-cikis-tezgahlari": {
    tr: "Bulaşık Makinesi Çıkış Tezgahları",
    ru: "Выходные столы для посудомоечной машины",
    kz: "Ыдыс жуғыш машина шығу үстелдері",
    en: "Dishwasher Outlet Tables",
  },
  "bulasik-makinesi-giris-tezgahlari": {
    tr: "Bulaşık Makinesi Giriş Tezgahları",
    ru: "Входные столы для посудомоечной машины",
    kz: "Ыдыс жуғыш машина кіру үстелдері",
    en: "Dishwasher Inlet Tables",
  },
  "bulasik-siyirma-tezgahlari": {
    tr: "Bulaşık Sıyırma Tezgahları",
    ru: "Столы для удаления остатков посуды",
    kz: "Ыдыс қырнау үстелдері",
    en: "Dish Scrapping Tables",
  },
  "cift-katli-isitmali-servis-rafi": {
    tr: "Çift Katlı Isıtmalı Servis Rafı",
    ru: "Подогреваемые двухъярусные сервисные полки",
    kz: "Жылытылатын екі қабатты сервис сөрелері",
    en: "Heated Double-Tier Service Shelves",
  },
  "cift-katli-servis-rafi": {
    tr: "Çift Katlı Servis Rafı",
    ru: "Двухъярусные сервисные полки",
    kz: "Екі қабатты сервис сөрелері",
    en: "Double-Tier Service Shelves",
  },
  "corba-unitesi": {
    tr: "Çorba Ünitesi",
    ru: "Суповые модули",
    kz: "Сорпа модульдері",
    en: "Soup Units",
  },
  "depolama-dolabi": {
    tr: "Depolama Dolabı",
    ru: "Шкафы для хранения",
    kz: "Сақтау шкафтары",
    en: "Storage Cabinets",
  },
  "diz-kontrollu-el-yikama-unitesi": {
    tr: "Diz Kontrollü El Yıkama Ünitesi",
    ru: "Рукомойники с коленным управлением",
    kz: "Тіземен басқарылатын қол жуу модульдері",
    en: "Knee-Controlled Hand Wash Units",
  },
  "dolapli-tezgah-carpma-kapi": {
    tr: "Dolaplı Tezgah Çarpma Kapı",
    ru: "Шкаф-столы с распашными дверями",
    kz: "Айқара есікті шкафты үстелдер",
    en: "Cabinet Tables with Swing Doors",
  },
  "dolapli-tezgah-surgulu-kapi": {
    tr: "Dolaplı Tezgah Sürgülü Kapı",
    ru: "Шкаф-столы с раздвижными дверями",
    kz: "Жылжымалы есікті шкафты үстелдер",
    en: "Cabinet Tables with Sliding Doors",
  },
  "duvar-dolap-kapakli": {
    tr: "Duvar Dolap Kapaklı",
    ru: "Навесные шкафы с дверцами",
    kz: "Есікті қабырға шкафтары",
    en: "Wall Cabinets with Doors",
  },
  "duvar-rafi": {
    tr: "Duvar Rafı",
    ru: "Настенные полки",
    kz: "Қабырға сөрелері",
    en: "Wall Shelves",
  },
  "duvar-tipi-davlumbuz": {
    tr: "Duvar Tipi Davlumbuz",
    ru: "Пристенные вытяжные зонты",
    kz: "Қабырға типті сорғыш қалқандар",
    en: "Wall Type Hoods",
  },
  "ekipman-standi": {
    tr: "Ekipman Standı",
    ru: "Подставки для оборудования",
    kz: "Жабдық тұғырлары",
    en: "Equipment Stands",
  },
  "ekmek-dolabi": {
    tr: "Ekmek Dolabı",
    ru: "Хлебные шкафы",
    kz: "Нан шкафтары",
    en: "Bread Cabinets",
  },
  "endustriyel-raf-sistemleri": {
    tr: "Endüstriyel Raf Sistemleri",
    ru: "Промышленные стеллажные системы",
    kz: "Өнеркәсіптік сөре жүйелері",
    en: "Industrial Shelving Systems",
  },
  "evyeli-tezgah-dolapli": {
    tr: "Evyeli Tezgah Dolaplı",
    ru: "Шкафы-столы с мойкой",
    kz: "Шкафты жуу үстелдері",
    en: "Cabinet Sink Tables",
  },
  "firin-standi": {
    tr: "Fırın Standı",
    ru: "Подставки для печей",
    kz: "Пеш тұғырлары",
    en: "Oven Stands",
  },
  "gastro-kap-tepsili-arabalar": {
    tr: "Gastro Kap Tepsili Arabalar",
    ru: "Тележки для гастроемкостей и противней",
    kz: "Гастроқап пен науа арбалары",
    en: "GN Pan & Tray Trolleys",
  },
  "isitmali-dolapli-tezgah": {
    tr: "Isıtmalı Dolaplı Tezgah",
    ru: "Подогреваемые шкаф-столы",
    kz: "Жылытылатын шкафты үстелдер",
    en: "Heated Cabinet Tables",
  },
  "istif-raflari": {
    tr: "İstif Rafları",
    ru: "Стеллажи для штабелирования",
    kz: "Жинақтау сөрелері",
    en: "Stacking Shelves",
  },
  "kahve-hazirlama-tezgahi": {
    tr: "Kahve Hazırlama Tezgahı",
    ru: "Стойки для приготовления кофе",
    kz: "Кофе дайындау үстелдері",
    en: "Coffee Preparation Counters",
  },
  "kasa-unitesi": {
    tr: "Kasa Ünitesi",
    ru: "Кассовые модули",
    kz: "Касса модульдері",
    en: "Cashier Units",
  },
  "kazan-arabasi": {
    tr: "Kazan Arabası",
    ru: "Тележки для котлов",
    kz: "Қазан арбалары",
    en: "Pot Trolleys",
  },
  "kazan-raflari": {
    tr: "Kazan Rafları",
    ru: "Полки для котлов",
    kz: "Қазан сөрелері",
    en: "Pot Shelves",
  },
  "kazan-yikama-servis-masasi": {
    tr: "Kazan Yıkama Servis Masası",
    ru: "Сервисные столы для мойки котлов",
    kz: "Қазан жуу сервистік үстелдері",
    en: "Pot Washing Service Tables",
  },
  "kazan-yikama-tezgahi": {
    tr: "Kazan Yıkama Tezgahı",
    ru: "Столы для мойки котлов",
    kz: "Қазан жуу үстелдері",
    en: "Pot Washing Tables",
  },
  "kokteyl-hazirlama-tezgahi": {
    tr: "Kokteyl Hazırlama Tezgahı",
    ru: "Стойки для приготовления коктейлей",
    kz: "Коктейль дайындау үстелдері",
    en: "Cocktail Preparation Counters",
  },
  "kuver-unitesi": {
    tr: "Küver Ünitesi",
    ru: "Модули для приборов",
    kz: "Аспап модульдері",
    en: "Cutlery Units",
  },
  "mermer-tablali-tezgahlar": {
    tr: "Mermer Tablalı Tezgahlar",
    ru: "Столы с мраморной столешницей",
    kz: "Мәрмәр үстелді үстелдер",
    en: "Marble Top Tables",
  },
  "notr-servis-unitesi": {
    tr: "Nötr Servis Ünitesi",
    ru: "Нейтральные сервисные модули",
    kz: "Бейтарап сервис модульдері",
    en: "Neutral Service Units",
  },
  "pe-polietilen-tablali-tezgahlar": {
    tr: "PE Polietilen Tablalı Tezgahlar",
    ru: "Столы со столешницей из PE-полиэтилена",
    kz: "PE-полиэтилен үстелді үстелдер",
    en: "PE Polyethylene Top Tables",
  },
  "pizza-firini-standi": {
    tr: "Pizza Fırını Standı",
    ru: "Подставки для печей для пиццы",
    kz: "Пицца пеші тұғырлары",
    en: "Pizza Oven Stands",
  },
  "platform-arabasi": {
    tr: "Platform Arabası",
    ru: "Платформенные тележки",
    kz: "Платформа арбалары",
    en: "Platform Trolleys",
  },
  "premix-hazirlik-unitesi": {
    tr: "Premix Hazırlık Ünitesi",
    ru: "Модули подготовки премикса",
    kz: "Премикс дайындау модульдері",
    en: "Premix Preparation Units",
  },
  "raf-kesme-tahtasi-icin": {
    tr: "Raf (Kesme Tahtası İçin)",
    ru: "Полки для разделочных досок",
    kz: "Кесу тақтасына арналған сөрелер",
    en: "Shelves for Cutting Boards",
  },
  "sebze-yikama-tezgahi": {
    tr: "Sebze Yıkama Tezgahı",
    ru: "Столы для мойки овощей",
    kz: "Көкөніс жуу үстелдері",
    en: "Vegetable Washing Tables",
  },
  "servis-arabalari-2-katli": {
    tr: "Servis Arabaları 2 Katlı",
    ru: "Двухъярусные сервисные тележки",
    kz: "2 қабатты сервис арбалары",
    en: "2-Tier Service Trolleys",
  },
  "servis-arabalari-3-katli": {
    tr: "Servis Arabaları 3 Katlı",
    ru: "Трехъярусные сервисные тележки",
    kz: "3 қабатты сервис арбалары",
    en: "3-Tier Service Trolleys",
  },
  "sicak-servis-unitesi": {
    tr: "Sıcak Servis Ünitesi",
    ru: "Модули горячей раздачи",
    kz: "Ыстық сервис модульдері",
    en: "Hot Service Units",
  },
  "soguk-servis-unitesi": {
    tr: "Soğuk Servis Ünitesi",
    ru: "Модули холодной раздачи",
    kz: "Суық сервис модульдері",
    en: "Cold Service Units",
  },
  "tabak-arabasi": {
    tr: "Tabak Arabası",
    ru: "Тележки для тарелок",
    kz: "Тәрелке арбалары",
    en: "Plate Trolleys",
  },
  "tabak-kurutma-raflari": {
    tr: "Tabak Kurutma Rafları",
    ru: "Полки для сушки тарелок",
    kz: "Тәрелке кептіру сөрелері",
    en: "Plate Drying Shelves",
  },
  "taban-ara-rafli-tezgahlar": {
    tr: "Taban Ara Raflı Tezgahlar",
    ru: "Столы с промежуточной полкой",
    kz: "Аралық сөрелі үстелдер",
    en: "Tables with Mid-Shelf Base",
  },
  "taban-rafli-tezgahlar": {
    tr: "Taban Raflı Tezgahlar",
    ru: "Столы с нижней полкой",
    kz: "Төменгі сөрелі үстелдер",
    en: "Bottom Shelf Tables",
  },
  "tek-katli-servis-rafi": {
    tr: "Tek Katlı Servis Rafı",
    ru: "Одноярусные сервисные полки",
    kz: "Бір қабатты сервис сөрелері",
    en: "Single-Tier Service Shelves",
  },
  "temizlik-evyesi": {
    tr: "Temizlik Evyesi",
    ru: "Моечные ванны для уборки",
    kz: "Тазалық жуғыштары",
    en: "Cleaning Sinks",
  },
  "tepsi-arabalari": {
    tr: "Tepsi Arabaları",
    ru: "Тележки для подносов",
    kz: "Науа арбалары",
    en: "Tray Trolleys",
  },
  "tezgahlar-1-cekmeceli": {
    tr: "Tezgahlar 1 Çekmeceli",
    ru: "Столы с 1 выдвижным ящиком",
    kz: "1 жәшікті үстелдер",
    en: "Tables with 1 Drawer",
  },
  "tezgahlar-cekmece-blogu": {
    tr: "Tezgahlar Çekmece Bloğu",
    ru: "Столы с блоком выдвижных ящиков",
    kz: "Жәшік блогы бар үстелдер",
    en: "Tables with Drawer Block",
  },
  "tezgahlar-tekerlekli": {
    tr: "Tezgahlar Tekerlekli",
    ru: "Столы на колесах",
    kz: "Дөңгелекті үстелдер",
    en: "Tables with Wheels",
  },
};

const existingAliasMap = {
  "tuvalet-kagitlari": "toilet_paper",
  "kagit-havlular": "paper_towels",
  peceteler: "napkins",
  "klozet-kapagi-hijyen-kagitlari": "toilet_seat_hygiene_covers",
  "sivi-ve-kopuk-sabunlar": "liquid_foam_soap",
  "sampuan-ve-dus-jelleri": "shampoo_shower_gel",
  "oda-kokulari": "air_fresheners",
  "islak-havlu-ve-mendiller": "wet_wipes",
  dezenfektanlar: "disinfectants",
  "mutfak-temizlik-ekipmanlari": "kitchen_cleaning_equipment",
  "yuzey-temizlik-bezleri": "surface_cleaning_cloths",
  "zemin-temizlik-ekipmanlari": "floor_cleaning_equipment",
  "cam-temizlik-ekipmanlari": "glass_cleaning_equipment",
  "wc-ve-banyo-temizlik-ekipmanlari": "wc_bathroom_cleaning_equipment",
  "mutfak-temizlik-urunleri": "kitchen_cleaning_chemicals",
  "zemin-temizlik-urunleri": "floor_cleaning_chemicals",
  "camasirhane-urunleri": "laundry_products",
  "wc-ve-banyo-temizlik-kimyasallari": "wc_bathroom_cleaning_chemicals",
  "cam-temizlik-urunleri": "glass_cleaning_chemicals",
  "havuz-urunleri": "pool_chemicals",
  maskeler: "masks",
  boneler: "hair_nets",
  onlukler: "aprons",
  galoslar: "shoe_covers",
  eldiven: "gloves",
  sekerler: "sugar_packets",
  "islak-mendiller": "wet_wipes_portion",
  bardaklar: "cups",
  "aluminyum-konteyner": "aluminum_containers",
  "catal-bicak-kasik": "cutlery_sets",
  kurdanlar: "toothpicks",
  "pipet-ve-karistirici": "stirrers_straws",
  "tuvalet-kagidi-dispenseri": "toilet_paper_dispensers",
  "kagit-havlu-dispenseri": "paper_towel_dispensers",
  "masaustu-pecete-dispenseri": "tabletop_napkin_dispensers",
  "sivi-sabun-dispenserleri": "liquid_soap_dispensers",
  "kopuk-sabun-dispenserleri": "foam_soap_dispensers",
  "klozet-kapagi-kagidi-dispenserleri": "toilet_seat_cover_dispensers",
  "airfresh-dispenserleri": "air_freshener_dispensers",
  "aluminyum-folyolar": "aluminum_foils",
  "strec-filmler": "stretch_films",
  "pisirme-kagitlari": "baking_paper",
  "cop-torbasi-ve-posetler": "trash_bags",
  "paketleme-strec-filmleri": "packaging_stretch_films",
  "koli-bantlari": "packing_tapes",
};

const exactLabelTranslations = {
  "tea-coffee-dispensers": {
    tr: "İçecek Ekipmanları",
    ru: "Оборудование для напитков",
    kz: "Сусын жабдықтары",
    en: "Beverage Equipment",
  },
  "cookers-grills": {
    tr: "Pişirme Ekipmanları",
    ru: "Оборудование для приготовления пищи",
    kz: "Пісіру жабдықтары",
    en: "Cooking Equipment",
  },
  "pots-pans": {
    tr: "Tencere ve Tavalar",
    ru: "Кастрюли и сковороды",
    kz: "Кәстрөлдер мен табалар",
    en: "Pots & Pans",
  },
  "food-prep-machines": {
    tr: "Hazırlık Ekipmanları",
    ru: "Подготовительное оборудование",
    kz: "Дайындау жабдықтары",
    en: "Food Prep Machines",
  },
  "cutting-boards": {
    tr: "Kesme Tahtaları",
    ru: "Разделочные доски",
    kz: "Кесу тақталары",
    en: "Cutting Boards",
  },
  knives: {
    tr: "Bıçaklar",
    ru: "Ножи",
    kz: "Пышақтар",
    en: "Knives",
  },
  utensils: {
    tr: "Mutfak Aparatları",
    ru: "Кухонные принадлежности",
    kz: "Асүй құралдары",
    en: "Utensils",
  },
  "coolers-ice-machines": {
    tr: "Soğutma Ekipmanları",
    ru: "Холодильное оборудование",
    kz: "Салқындату жабдықтары",
    en: "Cooling Equipment",
  },
  "dispensers-containers": {
    tr: "Servis Kapları",
    ru: "Сервировочные ёмкости",
    kz: "Сервис ыдыстары",
    en: "Dispensers & Containers",
  },
  "gastronorm-pans": {
    tr: "Gastronorm Küvetler",
    ru: "Гастроемкости",
    kz: "Gastronorm ыдыстары",
    en: "Gastronorm Pans",
  },
  "dishwashers-sterilizers": {
    tr: "Yıkama Ekipmanları",
    ru: "Моечное оборудование",
    kz: "Жуу жабдықтары",
    en: "Dishwashers & Sterilizers",
  },
  "worktables-stands": {
    tr: "Tezgah ve Standlar",
    ru: "Столы и подставки",
    kz: "Үстелдер мен тіректер",
    en: "Worktables & Stands",
  },
  "equipment-accessories": {
    tr: "Cihaz Aksesuarları",
    ru: "Аксессуары для оборудования",
    kz: "Жабдық аксессуарлары",
    en: "Equipment Accessories",
  },
  "duz-tezgahlar": {
    tr: "Düz Tezgahlar",
    ru: "Прямые рабочие столы",
    kz: "Түзу үстелдер",
    en: "Flat Tables",
  },
};

const extraCatalogCopy = {
  accessories: {
    groupCard: {
      tr: "👉 Yedek parça, servis ekipmanı aksesuarları ve tamamlayıcı parçalar.",
      ru: "👉 Запасные части, аксессуары сервисного оборудования и дополняющие компоненты.",
      kz: "👉 Қосалқы бөлшектер, сервис жабдықтарының аксессуарлары және толықтырушы бөлшектер.",
      en: "👉 Spare parts, service equipment accessories and complementary components.",
    },
    cta: {
      tr: "👉 Ürünleri Gör",
      ru: "👉 Смотреть товары",
      kz: "👉 Өнімдерді көру",
      en: "👉 View Products",
    },
  },
};

function sortObject(input) {
  return Object.keys(input)
    .sort((a, b) => a.localeCompare(b, "en"))
    .reduce((acc, key) => {
      acc[key] = input[key];
      return acc;
    }, {});
}

function getAliasValue(table, alias) {
  return (
    table[`categories.sub.${alias}`] ||
    table[`category.sub.${alias}`] ||
    null
  );
}

function setValue(table, key, value) {
  if (!value) return;
  table[key] = value;
}

const localeTables = Object.fromEntries(
  Object.entries(localeFiles).map(([lang, filePath]) => [
    lang,
    JSON.parse(fs.readFileSync(filePath, "utf8")),
  ])
);

for (const [lang, table] of Object.entries(localeTables)) {
  for (const [groupKey, labels] of Object.entries(groupTranslations)) {
    setValue(table, `category.group.${groupKey}`, labels[lang]);
  }

  setValue(table, "category.group.stainless_steel", groupTranslations.paslanmaz[lang]);

  for (const [mainKey, labels] of Object.entries(mainTranslations)) {
    setValue(table, `category.main.${mainKey}`, labels[lang]);
    setValue(table, `category.main.${mainKey.replace(/-/g, "_")}`, labels[lang]);
  }

  for (const [subKey, labels] of Object.entries(subTranslations)) {
    setValue(table, `category.sub.${subKey}`, labels[lang]);
    setValue(table, `categories.sub.${subKey}`, labels[lang]);
  }

  for (const [subKey, aliasKey] of Object.entries(existingAliasMap)) {
    const value = getAliasValue(table, aliasKey);
    if (!value) continue;
    setValue(table, `category.sub.${subKey}`, value);
    setValue(table, `categories.sub.${subKey}`, value);
  }

  for (const [subKey, labels] of Object.entries(exactLabelTranslations)) {
    setValue(table, `category.sub.${subKey}`, labels[lang]);
    setValue(table, `categories.sub.${subKey}`, labels[lang]);
  }

  fs.writeFileSync(localeFiles[lang], `${JSON.stringify(sortObject(table), null, 2)}\n`, "utf8");
}

console.log("Catalog locales synced.");
