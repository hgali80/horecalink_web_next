"use client";

import { useState } from "react";
import Link from "next/link";
import { useLang } from "../context/LanguageContext";
import { getProductFamilyTitle } from "../lib/catalog/productFamilies";
import { familyLabels } from "../lib/catalog/familyLabels";

export default function ProductFamilyVariants({ product, variants = [] }) {
  const { lang } = useLang();
  const labels = familyLabels[lang] || familyLabels.ru;
  const [search, setSearch] = useState("");
  if (!variants.length) return null;
  const matching = variants.filter((item) =>
    [item.dimensions, item.manufacturerCode, item.sku].join(" ").toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <section id="series-variants" className="mt-12 scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-4 sm:p-8">
      <h2 className="text-xl font-bold text-[#1d3246]">{labels.title}</h2>
      <p className="mt-2 text-sm text-slate-600">{getProductFamilyTitle(product)} · {labels.variants}: {variants.length}</p>
      <input aria-label={labels.search} placeholder={labels.search} value={search} onChange={(event) => setSearch(event.target.value)}
        className="my-5 w-full rounded-xl border border-slate-300 px-4 py-3 sm:max-w-md" />
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-100"><tr>
            {[labels.model, labels.size, labels.price, labels.select].map((label) => <th key={label} className="p-3">{label}</th>)}
          </tr></thead>
          <tbody>{matching.map((item) => {
            const selected = item.id === product.id;
            return <tr key={item.id} className={selected ? "bg-cyan-50" : "border-b border-slate-100"}>
              <td className="p-3 font-medium">{item.manufacturerCode}<span className="block text-xs text-slate-500">SKU: {item.sku || item.id}</span></td>
              <td className="whitespace-nowrap p-3">{item.dimensions || "—"}</td>
              <td className="whitespace-nowrap p-3">{Number(item.price) > 0 ? `${Number(item.price).toLocaleString("ru-RU")} ₸` : labels.quote}</td>
              <td className="p-3">{selected ? <span aria-current="true" className="font-semibold text-cyan-800">{labels.selected}</span> :
                <Link prefetch={false} href={`/products/${item.slug || item.id}#series-variants`} className="inline-block rounded-lg bg-[#1d3246] px-4 py-2 text-white">{labels.select}</Link>}</td>
            </tr>;
          })}</tbody>
        </table>
        {!matching.length && <p className="p-4 text-slate-500">{labels.empty}</p>}
      </div>
    </section>
  );
}
