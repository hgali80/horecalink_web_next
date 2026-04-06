"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCheck, Mail, Phone, RefreshCw } from "lucide-react";
import Link from "next/link";
import { auth } from "../../../../firebase/index";
import { useAuth } from "../../../context/AuthContext";

function formatDate(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("tr-TR");
  } catch {
    return "-";
  }
}

export default function AdminContactMessagesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [items, setItems] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const canView = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  const getIdTokenOrThrow = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("Oturum bulunamadi. Lutfen yeniden giris yapin.");
    }
    return currentUser.getIdToken(true);
  };

  const loadMessages = async () => {
    try {
      setListLoading(true);
      setError("");

      const idToken = await getIdTokenOrThrow();
      const res = await fetch("/api/admin/contact-messages", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Mesajlar alinamadi.");
      }

      setItems(Array.isArray(data?.messages) ? data.messages : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Mesajlar alinamadi.");
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      loadMessages();
    }
  }, [canView]);

  const toggleRead = async (item) => {
    try {
      setBusyId(item.id);
      setError("");

      const idToken = await getIdTokenOrThrow();
      const res = await fetch(`/api/admin/contact-messages/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ read: !item.read }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Mesaj guncellenemedi.");
      }

      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? { ...row, read: !row.read, updatedAt: new Date().toISOString() }
            : row
        )
      );
    } catch (err) {
      console.error(err);
      setError(err.message || "Mesaj guncellenemedi.");
    } finally {
      setBusyId("");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-sm text-slate-500">Yukleniyor...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Link
            href="/satissitok/admin"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Panele don
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Gelen Mesajlar</h1>
          <p className="text-sm text-slate-500">
            Iletisim sayfasindan gelen ziyaretci mesajlarini buradan okuyabilirsiniz.
          </p>
        </div>

        <button
          type="button"
          onClick={loadMessages}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Yenile
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {listLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Mesajlar yukleniyor...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500 shadow-sm">
          Henuz iletisim mesaji yok.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${
                item.read ? "border-slate-200" : "border-blue-200"
              }`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">{item.name || "-"}</h2>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        item.read
                          ? "bg-slate-100 text-slate-600"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {item.read ? "Okundu" : "Yeni"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      Dil: {(item.lang || "tr").toUpperCase()}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 text-sm text-slate-600">
                    <div className="inline-flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <span>{item.phone || "-"}</span>
                    </div>
                    <div className="inline-flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <span>{item.email || "-"}</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    {item.message || "-"}
                  </div>
                </div>

                <div className="flex min-w-[220px] flex-col gap-3 lg:items-end">
                  <div className="text-sm text-slate-500">
                    <div>Tarih: {formatDate(item.createdAt)}</div>
                    <div>Guncelleme: {formatDate(item.updatedAt)}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleRead(item)}
                    disabled={busyId === item.id}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCheck className="h-4 w-4" />
                    {busyId === item.id
                      ? "Guncelleniyor..."
                      : item.read
                        ? "Okunmadi Yap"
                        : "Okundu Yap"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
