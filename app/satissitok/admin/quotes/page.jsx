//app/satissitok/admin/quotes/page.jsx
"use client";

import { useEffect, useState } from "react";
import { db } from "@/firebase";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

function formatDate(value) {
  if (!value) return "-";

  try {
    if (value?.seconds) {
      return new Date(value.seconds * 1000).toLocaleString("tr-TR");
    }

    return new Date(value).toLocaleString("tr-TR");
  } catch {
    return "-";
  }
}

function getCustomerName(customer) {
  return customer?.name || customer?.fullName || "-";
}

function getCustomerCompany(customer) {
  return customer?.company || customer?.companyName || "-";
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        const q = query(
          collection(db, "quote_requests"),
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(q);

        setQuotes(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      } catch (error) {
        console.error("Teklifler yüklenemedi:", error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-bold">Teklif Gelen Kutusu</h1>

      {loading ? (
        <div className="text-sm text-gray-500">Yükleniyor...</div>
      ) : quotes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
          Henüz teklif talebi yok.
        </div>
      ) : (
        <div className="space-y-4">
          {quotes.map((q) => {
            const customer = q.customer || {};
            const customerName = getCustomerName(customer);
            const companyName = getCustomerCompany(customer);
            const phone = customer.phone || "-";
            const email = customer.email || "-";
            const itemCount =
              q.itemCount || q.items?.length || 0;
            const total =
              q.pricing?.finalAmount ??
              q.totalAmount ??
              q.grandTotal ??
              0;

            return (
              <div
                key={q.id}
                onClick={() =>
                  router.push(`/satissitok/admin/quotes/request/${q.id}`)
                }
                className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="text-lg font-semibold text-slate-800">
                      {customerName}
                    </div>

                    <div className="text-sm text-slate-500">
                      Firma: {companyName}
                    </div>

                    <div className="text-sm text-slate-500">
                      Telefon: {phone}
                    </div>

                    <div className="text-sm text-slate-500">
                      E-posta: {email}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm md:text-right">
                    <div>
                      <span className="font-medium text-slate-700">
                        Durum:
                      </span>{" "}
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                        {q.status || "new"}
                      </span>
                    </div>

                    <div className="text-slate-500">
                      Tarih: {formatDate(q.createdAt)}
                    </div>

                    <div className="text-slate-500">
                      Ürün Sayısı: {itemCount}
                    </div>

                    <div className="font-semibold text-slate-800">
                      Toplam: {Number(total || 0).toLocaleString("tr-TR")} KZT
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}