import Link from "next/link";
import { ChevronRight, Building2, BriefcaseBusiness, ChefHat } from "lucide-react";

const groups = [
  {
    key: "institutional",
    title: "Kurumsal",
    description: "Hijyen, sarf ve işletme ihtiyaçları için kurumsal ürün grubu.",
    href: "/catalog/institutional",
    icon: Building2,
  },
  {
    key: "equipment",
    title: "Yatırım",
    description: "Profesyonel mutfak ekipmanları ve proje odaklı yatırım ürünleri.",
    href: "/catalog/equipment",
    icon: BriefcaseBusiness,
  },
  {
    key: "stainless",
    title: "Paslanmaz",
    description: "Paslanmaz üretim, servis hatları ve endüstriyel mutfak çözümleri.",
    href: "/catalog/stainless",
    icon: ChefHat,
  },
];

export default function CatalogLandingPage() {
  return (
    <main className="min-h-screen bg-[#f8f9fb] px-4 pb-16 pt-10 md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <nav className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          <Link href="/" className="transition hover:text-[#1d3246]">
            Ana Sayfa
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-[#1d3246]">Katalog</span>
        </nav>

        <header className="mb-10">
          <h1 className="text-[38px] font-extrabold tracking-[-0.05em] text-[#1d3246] md:text-[48px]">
            Katalog
          </h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-500">
            Ürün grubunu seçerek yeni katalog yapısında kategori ve ürünlere geçiş yapın.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {groups.map((group) => {
            const Icon = group.icon;
            return (
              <Link
                key={group.key}
                href={group.href}
                className="group rounded-[28px] border border-[#e5e7eb] bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef1f4] text-[#1d3246] transition group-hover:bg-[#1d3246] group-hover:text-white">
                  <Icon className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-extrabold tracking-[-0.03em] text-[#1d3246]">
                  {group.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {group.description}
                </p>
                <div className="mt-6 text-sm font-bold uppercase tracking-[0.14em] text-[#1d3246]">
                  Kataloğu Aç
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
