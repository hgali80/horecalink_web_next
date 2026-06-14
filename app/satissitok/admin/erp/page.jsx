"use client";

import {
  BarChart3,
  Boxes,
  Building2,
  CreditCard,
  FileText,
  Package,
  Settings,
  ShoppingBag,
} from "lucide-react";
import ErpModuleCard from "./_components/ErpModuleCard";
import ErpSectionHeader from "./_components/ErpSectionHeader";

const modules = [
  {
    title: "Satislar",
    desc: "Tum satis belge ve fatura evraklari, R/F belge akisi, tahsilat durumu ve platform bazli operasyon burada yonetilecek.",
    href: "/satissitok/admin/erp/sales",
    tone: "green",
    badge: "V1",
    icon: <ShoppingBag size={22} />,
  },
  {
    title: "Satinalmalar",
    desc: "Tum satinalma evraklari, tedarikci secimi, ek maliyet dagitimi ve R/F satinalma akislari bu modulde toplanacak.",
    href: "/satissitok/admin/erp/purchases",
    tone: "blue",
    badge: "V1",
    icon: <FileText size={22} />,
  },
  {
    title: "Stok",
    desc: "R/F stok havuzlari, urun bazli hareketler, negatif stoklar ve tedarikci alis gecmisi icin merkez ekran.",
    href: "/satissitok/admin/erp/stock",
    tone: "purple",
    badge: "V1",
    icon: <Package size={22} />,
  },
  {
    title: "Cariler",
    desc: "Musteri, tedarikci ve ortak cari kartlari; hareketler, acik belgeler ve urun iliskileri tek yerde izlenecek.",
    href: "/satissitok/admin/erp/caris",
    tone: "orange",
    badge: "V1",
    icon: <Building2 size={22} />,
  },
  {
    title: "Finans",
    desc: "Kasa ve banka hesaplari, tahsilat, odeme, belge kapama ve gider islemleri icin finans omurgasi.",
    href: "/satissitok/admin/erp/finance",
    tone: "red",
    badge: "V1",
    icon: <CreditCard size={22} />,
  },
  {
    title: "Raporlar",
    desc: "Stok, satis, satinalma, cari, finans ve platform kirilimli raporlar bu alandan erisilecek.",
    href: "/satissitok/admin/erp/reports",
    tone: "slate",
    badge: "V1",
    icon: <BarChart3 size={22} />,
  },
  {
    title: "Ayarlar",
    desc: "Depolar, satis platformlari, odeme yontemleri, vergi oranlari ve ERP numaralandirma ayarlari icin merkez alan.",
    href: "/satissitok/admin/erp/settings",
    tone: "blue",
    badge: "V1",
    icon: <Settings size={22} />,
  },
];

export default function ErpIndexPage() {
  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(29,50,70,0.12),_transparent_36%),linear-gradient(135deg,#ffffff_0%,#edf3f7_100%)] p-8 shadow-sm">
        <div className="flex flex-col gap-6">
          <ErpSectionHeader
            eyebrow="ERP Merkezi"
            title="HorecaLink ERP Modulu"
            description="Yeni satis, satinalma, stok, cari, finans ve rapor yapisinin tum ana elemanlari bu klasor ve bu panel altinda toplanacak. Amac, ERP tarafini tek bir izole bolgede buyutmek ve gerekirse kontrollu sekilde kaldirabilmek."
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <Boxes size={22} className="text-[#1d3246]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Modul Girisleri</h2>
            <p className="text-sm text-slate-500">
              ERP icindeki tum ana bolumleri burada gorecek ve zamanla bu kartlardan yoneteceksin.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <ErpModuleCard key={module.href} {...module} />
          ))}
        </div>
      </section>
    </div>
  );
}
