function getCurrentLabel(labels) {
  return labels.subcategoryLabel || labels.categoryLabel || labels.groupLabel || "Catalog";
}

function getParentLabel(labels) {
  return labels.categoryLabel || labels.groupLabel || "Catalog";
}

function getContextType({ category, subcategory }) {
  if (subcategory) return "subcategory";
  if (category) return "category";
  return "group";
}

function buildRussianCopy({ currentLabel, parentLabel, type }) {
  const scopeMap = {
    subcategory: "подкатегории",
    category: "категории",
    group: "группы товаров",
  };

  return {
    intro: `${currentLabel} в каталоге HorecaLink: профессиональные товары и решения для HoReCa, которые удобно сравнивать, фильтровать и подбирать под задачи бизнеса.`,
    detailsTitle: `О категории «${currentLabel}»`,
    detailsBody:
      type === "group"
        ? `${currentLabel} объединяет ассортимент для профессионального использования в отелях, ресторанах, кафе и других коммерческих объектах. Вы можете перейти в нужные разделы, сравнить позиции и подобрать товары под регулярные закупки или проектные задачи.`
        : `${currentLabel} входит в раздел ${parentLabel} и помогает быстрее подобрать товары под конкретную зону применения. В каталоге представлены позиции для профессионального использования, регулярных закупок и подбора подходящих решений для HoReCa.`,
    faqTitle: "Частые вопросы",
    faqs: [
      {
        q: `Что входит в раздел «${currentLabel}»?`,
        a: `В этом разделе собраны товары, относящиеся к ${currentLabel.toLowerCase()}, с учетом профессионального использования и задач бизнеса.`,
      },
      {
        q: `Как быстрее выбрать товары в разделе «${currentLabel}»?`,
        a: `Используйте поиск, фильтры и соседние ${scopeMap[type]}, чтобы сузить выбор и найти подходящие позиции по назначению, бренду или коду товара.`,
      },
      {
        q: "Можно ли запросить предложение для оптовой закупки?",
        a: "Да. После выбора подходящих товаров вы можете отправить запрос на предложение и продолжить подбор под задачи вашего бизнеса.",
      },
    ],
  };
}

function buildTurkishCopy({ currentLabel, parentLabel, type }) {
  return {
    intro: `${currentLabel} sayfasinda HorecaLink katalogundaki profesyonel urunleri filtreleyebilir, karsilastirabilir ve isletmenize uygun secenekleri inceleyebilirsiniz.`,
    detailsTitle: `${currentLabel} kategorisi hakkinda`,
    detailsBody:
      type === "group"
        ? `${currentLabel}, otel, restoran, kafe ve diger profesyonel isletmeler icin ilgili urun gruplarini bir araya getirir. Alt kategorilere gecerek ihtiyaciniza uygun urunleri daha hizli bulabilir, duzenli tuketime uygun secenekleri karsilastirabilirsiniz.`
        : `${currentLabel}, ${parentLabel} yapisi altinda daha hedefli urun secimi yapmaniza yardimci olur. Bu sayfadaki urunler profesyonel kullanim, duzenli satin alma ve operasyonel ihtiyaclara gore incelenebilir.`,
    faqTitle: "Sik sorulan sorular",
    faqs: [
      {
        q: `${currentLabel} kategorisinde hangi urunler yer alir?`,
        a: `${currentLabel} ile ilgili urunler bu sayfada profesyonel kullanim amacina gore listelenir ve filtrelenebilir.`,
      },
      {
        q: `Bu kategoride dogru urunu nasil secebilirim?`,
        a: `Arama, filtre ve alt kategori baglantilarini kullanarak kullanim alaniniza, markaya veya urun koduna gore secimi daraltabilirsiniz.`,
      },
      {
        q: `Toplu alim veya teklif talebi verebilir miyim?`,
        a: `Evet. Uygun urunleri belirledikten sonra teklif surecini baslatarak isletmenize uygun alim plani olusturabilirsiniz.`,
      },
    ],
  };
}

function buildKazakhCopy({ currentLabel, parentLabel, type }) {
  return {
    intro: `${currentLabel} boliminde HorecaLink katalogindagi kasibi onimderdi qarap, filterlep jane oz isinizge saikes nusqalarni tanday alasyz.`,
    detailsTitle: `${currentLabel} bolimi turaly`,
    detailsBody:
      type === "group"
        ? `${currentLabel} otel, restoran, kafe jane basqa kasibi nysandar ushin tiisti onimderdi bir jerge jinaydi. Ishki bolimderge otip, kundelik satyp alu nemese jobalyk qajettilik ushin durys onimdi tanday alasyz.`
        : `${currentLabel} ${parentLabel} boliminin ishinde naqtyraq tandau jasauga komektesedi. Bul bettegi onimder kasibi paydalanu men turaqty satyp alu mindetterine saikes usynylgan.`,
    faqTitle: "Jii qoyylatyn suraktar",
    faqs: [
      {
        q: `${currentLabel} boliminde kandai onimder bar?`,
        a: `Bul bette ${currentLabel} bagytyna qatısty onimder kasibi qoldanysqa saikes top tastyrilgan.`,
      },
      {
        q: `Durys onimdi qalai tandaeimyn?`,
        a: `Izdeu, filter jane ishki bolimder arqyly qoldanu salasy, brend nemese onim kodyna qarap tandau jasay alasyz.`,
      },
      {
        q: `Kop molemde satyp alu ushin suranys jiberuge bolady ma?`,
        a: `Ia. Qajetti onimderdi tandap, usynys nemese kommertsiyalyq suranys jiberu arqyly satyp alu procesin bastauga bolady.`,
      },
    ],
  };
}

function buildEnglishCopy({ currentLabel, parentLabel, type }) {
  return {
    intro: `Browse ${currentLabel} products in the HorecaLink catalog, compare options and filter the range to match your business needs.`,
    detailsTitle: `About ${currentLabel}`,
    detailsBody:
      type === "group"
        ? `${currentLabel} brings together products for professional HoReCa use across hotels, restaurants, cafes and commercial facilities. You can move between subcategories, compare items and shortlist options for repeat purchasing or project-based sourcing.`
        : `${currentLabel} sits within ${parentLabel} and helps you find more relevant products for a specific use case. The items on this page are intended for professional selection, regular sourcing and business purchasing workflows.`,
    faqTitle: "Frequently asked questions",
    faqs: [
      {
        q: `What products are included in ${currentLabel}?`,
        a: `${currentLabel} includes products grouped for professional use and easier comparison inside the HorecaLink catalog.`,
      },
      {
        q: `How can I choose the right items on this page?`,
        a: `Use search, filters and nearby category links to narrow the list by use case, brand or product code.`,
      },
      {
        q: `Can I request a quotation for bulk purchasing?`,
        a: `Yes. After identifying suitable products, you can request an offer and continue the sourcing process for your business.`,
      },
    ],
  };
}

export function getCatalogSeoContent({ lang, labels, category, subcategory }) {
  const currentLabel = getCurrentLabel(labels);
  const parentLabel = getParentLabel(labels);
  const type = getContextType({ category, subcategory });

  if (lang === "tr") {
    return buildTurkishCopy({ currentLabel, parentLabel, type });
  }

  if (lang === "kz") {
    return buildKazakhCopy({ currentLabel, parentLabel, type });
  }

  if (lang === "en") {
    return buildEnglishCopy({ currentLabel, parentLabel, type });
  }

  return buildRussianCopy({ currentLabel, parentLabel, type });
}
