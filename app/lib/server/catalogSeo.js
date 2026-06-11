import { getCatalogLabels } from "../catalog/categoryLabels";
import { normalizeCatalogGroupKey } from "../catalog/catalogLabels";
import { getBaseUrl } from "./siteConfig";

function buildCanonical(pathname) {
  return `${getBaseUrl()}${pathname}`;
}

function buildDescription({ groupLabel, categoryLabel, subcategoryLabel }) {
  if (subcategoryLabel) {
    return `${subcategoryLabel} kategorisindeki profesyonel HoReCa urunlerini, teknik ekipmanlari ve tedarik cozumlerini HorecaLink'te inceleyin.`;
  }

  if (categoryLabel) {
    return `${categoryLabel} kategorisindeki profesyonel HoReCa urunlerini ve ilgili alt kategorileri HorecaLink'te kesfedin.`;
  }

  return `${groupLabel} grubundaki profesyonel HoReCa urunlerini, alt kategorileri ve tedarik cozumlerini HorecaLink'te kesfedin.`;
}

export function buildCatalogMetadata({ group, category = "", subcategory = "" }) {
  const normalizedGroup = normalizeCatalogGroupKey(group);
  const labels = getCatalogLabels({
    group: normalizedGroup,
    category,
    subcategory,
    lang: "ru",
  });

  const pageLabel = labels.subcategoryLabel || labels.categoryLabel || labels.groupLabel || "Catalog";
  const pathname = subcategory
    ? `/catalog/${normalizedGroup}/${category}/${subcategory}`
    : category
      ? `/catalog/${normalizedGroup}/${category}`
      : `/catalog/${normalizedGroup}`;
  const canonical = buildCanonical(pathname);
  const description = buildDescription(labels);
  const keywords = [labels.groupLabel, labels.categoryLabel, labels.subcategoryLabel, "HorecaLink", "HoReCa", "Kazakhstan"]
    .filter(Boolean);

  return {
    title: pageLabel,
    description,
    keywords,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      url: canonical,
      title: pageLabel,
      description,
      locale: "ru_KZ",
    },
    twitter: {
      card: "summary",
      title: pageLabel,
      description,
    },
  };
}
