import fs from "node:fs";
import { categoryData } from "../app/data/categoryData.js";

// Explicit translations for the equipment taxonomy. Columns: key | en | ru | kz.
const rows = `
bakir-urunler-ve-sunum-ekipmanlari|Copperware and Presentation Equipment|Медная посуда и оборудование для подачи|Мыс ыдыстар және ұсыну жабдықтары
bicaklar-ve-kesici-el-aletleri|Knives and Cutting Tools|Ножи и режущие инструменты|Пышақтар және кесу құралдары
bulasik-ve-bar-ekipmanlari|Dishwashing and Bar Equipment|Посудомоечное и барное оборудование|Ыдыс жуу және бар жабдықтары
cay-kahve-ve-icecek-ekipmanlari|Tea, Coffee and Beverage Equipment|Оборудование для чая, кофе и напитков|Шай, кофе және сусын жабдықтары
gn-kaplar-ve-saklama-ekipmanlari|GN Containers and Storage Equipment|Гастроёмкости и оборудование для хранения|Гастросыйымдылықтар және сақтау жабдықтары
hazirlik-ekipmanlari|Food Preparation Equipment|Оборудование для подготовки продуктов|Азық-түлік дайындау жабдықтары
hijyen-ve-sterilizasyon-ekipmanlari|Hygiene and Sterilization Equipment|Оборудование для гигиены и стерилизации|Гигиена және зарарсыздандыру жабдықтары
kesim-levhalari-ve-tezgah-ustleri|Cutting Boards and Worktops|Разделочные доски и столешницы|Кесу тақталары және үстел беттері
pisirme-ekipmanlari|Cooking Equipment|Тепловое оборудование|Тағам пісіру жабдықтары
servis-ve-mutfak-el-aletleri|Serving and Kitchen Utensils|Сервировочные и кухонные принадлежности|Ас ұсыну және асүй құралдары
sicak-tutma-ve-servis-ekipmanlari|Food Warming and Serving Equipment|Оборудование для подогрева и раздачи|Тағамды жылы ұстау және тарату жабдықтары
sos-baharat-ve-servis-dispenserleri|Sauce, Spice and Serving Dispensers|Диспенсеры для соусов, специй и подачи|Тұздық, дәмдеуіш және ұсыну диспенсерлері
storage-and-transport|Storage and Transport|Хранение и транспортировка|Сақтау және тасымалдау
tencere-tava-ve-pisirme-kaplari|Pots, Pans and Cooking Vessels|Кастрюли, сковороды и посуда для приготовления|Кәстрөлдер, табалар және пісіру ыдыстары
yedek-parca-ve-aksesuarlar|Spare Parts and Accessories|Запасные части и аксессуары|Қосалқы бөлшектер және керек-жарақтар
bakir-cezveler|Copper Coffee Pots|Медные турки|Мыс түріктер
bakir-sunum-urunleri|Copper Serving Ware|Медная посуда для подачи|Мыс ұсыну ыдыстары
bakir-tavalar|Copper Pans|Медные сковороды|Мыс табалар
balik-bicaklari|Fish Knives|Ножи для рыбы|Балық пышақтары
bicak-bakim-ve-saklama|Knife Care and Storage|Уход и хранение ножей|Пышақтарды күту және сақтау
doner-bicaklari|Doner Knives|Ножи для донера|Дөнер пышақтары
et-ve-kasap-bicaklari|Meat and Butcher Knives|Мясные и разделочные ножи|Ет және қасапшы пышақтары
kasap-satirlari-ve-ozel-kesiciler|Meat Cleavers and Specialty Cutters|Мясницкие топорики и специальные резаки|Ет шапқыштар және арнайы кескіштер
mutfak-bicaklari|Kitchen Knives|Кухонные ножи|Асүй пышақтары
pasta-pizza-bicak-ve-spatulalari|Cake and Pizza Knives and Spatulas|Ножи и лопатки для тортов и пиццы|Торт пен пицца пышақтары және қалақшалары
sef-bicaklari|Chef's Knives|Поварские ножи|Аспаз пышақтары
bar-rinser-ekipmanlari|Bar Glass Rinsers|Ополаскиватели для бокалов|Бар стақандарын шаю жабдықтары
bulasik-makineleri|Dishwashers|Посудомоечные машины|Ыдыс жуғыш машиналар
bulasik-makinesi-sepetleri|Dishwasher Baskets|Корзины для посудомоечных машин|Ыдыс жуғыш машина себеттері
buz-makineleri|Ice Makers|Льдогенераторы|Мұз генераторлары
on-yikama-duslari|Pre-Rinse Sprays|Душирующие устройства|Алдын ала шаю душтары
ayran-makineleri|Ayran Machines|Аппараты для айрана|Айран аппараттары
bar-blenderleri|Bar Blenders|Барные блендеры|Бар блендерлері
cay-makineleri|Tea Machines|Аппараты для чая|Шай аппараттары
kahve-ekipmanlari|Coffee Equipment|Кофейное оборудование|Кофе жабдықтары
meyve-suyu-sogutuculari|Juice Coolers|Охладители соков|Шырын салқындатқыштары
slush-makineleri|Slush Machines|Граниторы|Мұзды сусын аппараттары
su-boilerleri|Water Boilers|Кипятильники|Су қайнатқыштары
gn-kapaklari|GN Lids|Крышки для гастроёмкостей|Гастросыйымдылық қақпақтары
gn-suzgec-kaplari|Perforated GN Pans|Перфорированные гастроёмкости|Тесікті гастросыйымдылықтар
paslanmaz-gn-kaplar|Stainless Steel GN Pans|Гастроёмкости из нержавеющей стали|Тот баспайтын болат гастросыйымдылықтар
polikarbon-gn-kaplar|Polycarbonate GN Pans|Поликарбонатные гастроёмкости|Поликарбонат гастросыйымдылықтар
dilimleme-makineleri|Slicers|Слайсеры|Тілімдеу машиналары
el-blenderleri|Hand Blenders|Погружные блендеры|Қол блендерлері
et-kemik-testereleri|Meat and Bone Saws|Пилы для мяса и костей|Ет және сүйек аралары
et-kiyma-makineleri|Meat Grinders|Мясорубки|Ет тартқыштар
hamburger-kofte-presleri|Burger and Meatball Presses|Прессы для бургеров и котлет|Бургер және котлет престері
hamur-acma-makineleri|Dough Sheeters|Тестораскаточные машины|Қамыр жаю машиналары
hamur-yogurma-makineleri|Dough Mixers|Тестомесы|Қамыр илегіштер
patates-kesme-makineleri|Potato Cutters|Картофелерезки|Картоп кескіштер
sebze-dograma-makineleri|Vegetable Cutters|Овощерезки|Көкөніс турағыштар
bicak-sterilizatorleri|Knife Sterilizers|Стерилизаторы ножей|Пышақ зарарсыздандырғыштары
kesim-tahtalari-ve-aksesuarlari|Cutting Boards and Accessories|Разделочные доски и аксессуары|Кесу тақталары және керек-жарақтары
mermer-tablalar|Marble Worktops|Мраморные столешницы|Мәрмәр үстел беттері
polietilen-tablalar|Polyethylene Worktops|Полиэтиленовые столешницы|Полиэтилен үстел беттері
doner-ocaklari|Doner Grills|Грили для донера|Дөнер грильдері
elektrikli-ocaklar|Electric Stoves|Электрические плиты|Электр плиталары
fritozler|Deep Fryers|Фритюрницы|Фритюрлер
gazli-ocaklar|Gas Stoves|Газовые плиты|Газ плиталары
hot-dog-makineleri|Hot Dog Machines|Аппараты для хот-догов|Хот-дог аппараттары
induksiyon-ocaklari|Induction Cookers|Индукционные плиты|Индукциялық плиталар
kontakt-grill-tost-makineleri|Contact Grills and Sandwich Toasters|Контактные грили и тостеры для сэндвичей|Контакт грильдері және сэндвич тостерлері
krep-pankek-makineleri|Crepe and Pancake Makers|Аппараты для блинов и панкейков|Құймақ және панкейк аппараттары
makarna-haslama-makineleri|Pasta Cookers|Макароноварки|Макарон пісіргіштер
pleyt-izgaralar|Griddles|Жарочные поверхности|Қуыру беттері
salamander-izgaralar|Salamander Grills|Грили саламандра|Саламандра грильдері
sosisli-roller-grill|Sausage Roller Grills|Роликовые грили для сосисок|Шұжыққа арналған роликті грильдер
waffle-makineleri|Waffle Makers|Вафельницы|Вафли пісіргіштер
buz-kaplari|Ice Buckets|Ёмкости для льда|Мұз ыдыстары
cirpicilar|Whisks|Венчики|Бұлғауыштар
elek-ve-suzgecler|Sieves and Strainers|Сита и дуршлаги|Електер және сүзгілер
et-dovme-ekipmanlari|Meat Tenderizers|Инструменты для отбивания мяса|Ет жұмсартқыш құралдар
et-ve-kebap-yardimci-ekipmanlari|Meat and Kebab Accessories|Принадлежности для мяса и кебаба|Ет және кәуапқа арналған керек-жарақтар
kepceler|Ladles|Половники|Ожаулар
kevgir-kepceler|Skimmers|Шумовки|Кепсерлер
konserve-acacaklari|Can Openers|Консервные ножи|Консерві ашқыштар
kurek-ve-savaklar|Kitchen Paddles and Scoops|Кухонные лопаты и совки|Асүй күректері және қалақтары
olcu-kaplari|Measuring Jugs|Мерные ёмкости|Өлшеу ыдыстары
rendeler|Graters|Тёрки|Үккіштер
sarimsak-eziciler|Garlic Presses|Прессы для чеснока|Сарымсақ езгіштер
servis-kasik-catal-spatulalari|Serving Spoons, Forks and Spatulas|Сервировочные ложки, вилки и лопатки|Ас ұсыну қасықтары, шанышқылары және қалақшалары
servis-masalari|Serving Tongs|Сервировочные щипцы|Ас ұсыну қысқыштары
spatula-ve-kaziyicilar|Spatulas and Scrapers|Лопатки и скребки|Қалақшалар және қырғыштар
sut-urunleri-suzgecleri|Dairy Strainers|Фильтры для молочных продуктов|Сүт өнімдеріне арналған сүзгілер
corba-kazanlari|Soup Kettles|Суповые котлы|Сорпа қазандары
marmitler|Bain-Maries|Мармиты|Мармиттер
patates-sicak-tutma-ekipmanlari|French Fry Warmers|Подогреватели картофеля фри|Фри картобын жылы ұстау жабдықтары
baharat-saklama-kaplari|Spice Storage Containers|Ёмкости для специй|Дәмдеуіш сақтау ыдыстары
sos-dispenserleri|Sauce Dispensers|Диспенсеры для соусов|Тұздық диспенсерлері
sos-siseleri|Sauce Bottles|Бутылки для соусов|Тұздық бөтелкелері
tuzluk-ve-biberlikler|Salt and Pepper Shakers|Солонки и перечницы|Тұз және бұрыш салғыштар
yag-siseleri|Oil Bottles|Бутылки для масла|Май бөтелкелері
dry-ingredient-bins|Dry Ingredient Storage Bins|Контейнеры для сыпучих продуктов|Құрғақ азық-түлік сақтау контейнерлері
krep-tavalari|Crepe Pans|Блинные сковороды|Құймақ табалары
mayonez-kaplari|Mayonnaise Bowls|Ёмкости для майонеза|Майонез ыдыстары
silindirik-tencereler|Cylindrical Stockpots|Цилиндрические кастрюли|Цилиндрлі кәстрөлдер
sos-tencereleri|Saucepans|Сотейники для соусов|Тұздық кәстрөлдері
suzgecler|Colanders|Дуршлаги|Сүзгіштер
tavalar|Frying Pans|Сковороды|Табалар
tencereler|Pots|Кастрюли|Кәстрөлдер
wok-tavalar|Wok Pans|Сковороды вок|Вок табалары
cay-kazani-boiler-yedek-parcalari|Tea Urn and Boiler Spare Parts|Запчасти для чайных аппаратов и кипятильников|Шай және су қайнатқыштарының қосалқы бөлшектері
doner-ocagi-yedek-parcalari|Doner Grill Spare Parts|Запчасти для грилей для донера|Дөнер грильдерінің қосалқы бөлшектері
et-isleme-makinesi-yedek-parcalari|Meat Processing Machine Spare Parts|Запчасти для мясоперерабатывающих машин|Ет өңдеу машиналарының қосалқы бөлшектері
fritoz-yedek-parcalari|Deep Fryer Spare Parts|Запчасти для фритюрниц|Фритюрлердің қосалқы бөлшектері
izgara-pleyt-yedek-parcalari|Grill and Griddle Spare Parts|Запчасти для грилей и жарочных поверхностей|Грильдер мен қуыру беттерінің қосалқы бөлшектері
kontakt-grill-yedek-parcalari|Contact Grill Spare Parts|Запчасти для контактных грилей|Контакт грильдерінің қосалқы бөлшектері
patates-kesme-makinesi-bicaklari|Potato Cutter Blades|Ножи для картофелерезок|Картоп кескіш пышақтары
`.trim().split("\n").map((row) => row.split("|"));

const translations = new Map(rows.map(([key, en, ru, kz]) => [key, { en, ru, kz }]));
const categories = categoryData.equipment.mainCategories;
for (const key of [...Object.keys(categories), ...Object.values(categories).flat()]) {
  if (!translations.has(key)) throw new Error(`Missing equipment translation: ${key}`);
}

for (const lang of ["en", "ru", "kz"]) {
  const file = new URL(`../app/locales/${lang}.json`, import.meta.url);
  const table = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const [key, subs] of Object.entries(categories)) {
    table[`category.main.${key}`] = translations.get(key)[lang];
    table[`category.main.${key.replace(/-/g, "_")}`] = translations.get(key)[lang];
    for (const sub of subs) {
      table[`category.sub.${sub}`] = translations.get(sub)[lang];
      table[`categories.sub.${sub}`] = translations.get(sub)[lang];
    }
  }
  fs.writeFileSync(file, `${JSON.stringify(table, null, 2)}\n`);
}
console.log(`Translated ${Object.keys(categories).length} equipment categories and ${Object.values(categories).flat().length} subcategories into EN, RU and KZ.`);
