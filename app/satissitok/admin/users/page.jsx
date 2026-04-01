//app/satissitok/admin/users/page.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  ArrowLeft,
  UserPlus,
  Users,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { auth } from "../../../../firebase/index";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "staff", label: "Staff" },
  { value: "sales", label: "Sales" },
  { value: "viewer", label: "Viewer" },
];

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const formRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("idle");

  const [users, setUsers] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [rowLoading, setRowLoading] = useState({});

  const isSuperAdmin = useMemo(() => user?.role === "super_admin", [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    if (!loading && user && !isSuperAdmin) {
      router.replace("/satissitok/admin");
    }
  }, [loading, user, isSuperAdmin, router]);

  const setRowBusy = (uid, value) => {
    setRowLoading((prev) => ({ ...prev, [uid]: value }));
  };

  const getIdTokenOrThrow = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("Oturum bulunamadı. Lütfen yeniden giriş yapın.");
    }
    return currentUser.getIdToken(true);
  };

  const loadUsers = async () => {
    try {
      setListLoading(true);
      setListError("");

      const idToken = await getIdTokenOrThrow();

      const res = await fetch("/api/admin/users/list", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Kullanıcı listesi alınamadı.");
      }

      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (err) {
      console.error(err);
      setListError(err.message || "Kullanıcı listesi alınamadı.");
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "super_admin") {
      loadUsers();
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setMessageType("idle");
    setSubmitting(true);

    try {
      const formData = new FormData(formRef.current);

      const payload = {
        fullName: String(formData.get("fullName") || "").trim(),
        email: String(formData.get("email") || "").trim().toLowerCase(),
        password: String(formData.get("password") || "").trim(),
        role: String(formData.get("role") || "staff").trim(),
        isActive: formData.get("isActive") === "on",
      };

      const idToken = await getIdTokenOrThrow();

      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Kullanıcı oluşturulamadı.");
      }

      setMessage("Yeni yetkili başarıyla oluşturuldu.");
      setMessageType("success");
      formRef.current?.reset();
      await loadUsers();
    } catch (err) {
      console.error(err);
      setMessage(err.message || "İşlem başarısız.");
      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (uid, role) => {
    setMessage("");
    setMessageType("idle");
    setRowBusy(uid, true);

    try {
      const idToken = await getIdTokenOrThrow();

      const res = await fetch(`/api/admin/users/${uid}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ role }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Rol güncellenemedi.");
      }

      setMessage("Kullanıcı rolü güncellendi.");
      setMessageType("success");
      await loadUsers();
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Rol güncellenemedi.");
      setMessageType("error");
    } finally {
      setRowBusy(uid, false);
    }
  };

  const handleToggleStatus = async (item) => {
    setMessage("");
    setMessageType("idle");
    setRowBusy(item.uid, true);

    try {
      const idToken = await getIdTokenOrThrow();

      const res = await fetch(`/api/admin/users/${item.uid}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ isActive: !item.isActive }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Durum güncellenemedi.");
      }

      setMessage("Kullanıcı durumu güncellendi.");
      setMessageType("success");
      await loadUsers();
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Durum güncellenemedi.");
      setMessageType("error");
    } finally {
      setRowBusy(item.uid, false);
    }
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(
      `${item.fullName || item.email} kullanıcısını silmek istediğine emin misin?`
    );

    if (!confirmed) return;

    setMessage("");
    setMessageType("idle");
    setRowBusy(item.uid, true);

    try {
      const idToken = await getIdTokenOrThrow();

      const res = await fetch(`/api/admin/users/${item.uid}/delete`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Kullanıcı silinemedi.");
      }

      setMessage("Kullanıcı silindi.");
      setMessageType("success");
      await loadUsers();
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Kullanıcı silinemedi.");
      setMessageType("error");
    } finally {
      setRowBusy(item.uid, false);
    }
  };

  const formatDate = (value) => {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-sm text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!user || !isSuperAdmin) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
            <ShieldCheck size={18} />
            Sadece super yönetici erişebilir
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Yetkili Yönetimi
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Bu ekrandan iç kullanıcıları görüntüleyebilir, rol değiştirebilir,
            aktif/pasif yapabilir ve yeni yetkili oluşturabilirsin.
          </p>
        </div>

        <Link
          href="/satissitok/admin"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
          Geri Dön
        </Link>
      </div>

      {message ? (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            messageType === "success"
              ? "border border-green-200 bg-green-50 text-green-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">
              Mevcut Yetkililer
            </h2>
          </div>

          <button
            type="button"
            onClick={loadUsers}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Yenile
          </button>
        </div>

        {listError ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {listError}
          </div>
        ) : null}

        {listLoading ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            Kullanıcı listesi yükleniyor...
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            Henüz kullanıcı bulunmuyor.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-4 py-3">Ad Soyad</th>
                  <th className="px-4 py-3">E-posta</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Oluşturulma</th>
                  <th className="px-4 py-3">Son Giriş</th>
                  <th className="px-4 py-3">İşlemler</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white text-sm text-slate-700">
                {users.map((item) => {
                  const busy = rowLoading[item.uid] === true;
                  const isSelf = item.uid === user.uid;
                  const isProtectedSuperAdmin = item.role === "super_admin";

                  return (
                    <tr key={item.uid}>
                      <td className="px-4 py-3 font-medium">
                        {item.fullName || "-"}
                      </td>

                      <td className="px-4 py-3">{item.email || "-"}</td>

                      <td className="px-4 py-3">
                        {item.role === "super_admin" ? (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                            super_admin
                          </span>
                        ) : (
                          <select
                            value={item.role || "staff"}
                            disabled={busy || isSelf}
                            onChange={(e) =>
                              handleRoleChange(item.uid, e.target.value)
                            }
                            className="rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-sky-600 disabled:opacity-60"
                          >
                            {ROLE_OPTIONS.map((roleItem) => (
                              <option
                                key={roleItem.value}
                                value={roleItem.value}
                              >
                                {roleItem.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {item.isActive ? (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                            Aktif
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                            Pasif
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">{formatDate(item.createdAt)}</td>
                      <td className="px-4 py-3">{formatDate(item.lastLoginAt)}</td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={busy || isSelf || isProtectedSuperAdmin}
                            onClick={() => handleToggleStatus(item)}
                            className={`rounded-lg px-3 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              item.isActive
                                ? "bg-amber-500 hover:bg-amber-600"
                                : "bg-emerald-600 hover:bg-emerald-700"
                            }`}
                          >
                            {busy
                              ? "Bekleyin..."
                              : item.isActive
                              ? "Pasife Al"
                              : "Aktif Et"}
                          </button>

                          <button
                            type="button"
                            disabled={busy || isSelf || isProtectedSuperAdmin}
                            onClick={() => handleDelete(item)}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 size={14} />
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <UserPlus size={18} className="text-sky-700" />
          <h2 className="text-lg font-semibold text-slate-900">
            Yeni Yetkili Ekle
          </h2>
        </div>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Ad Soyad
            </label>
            <input
              name="fullName"
              type="text"
              required
              placeholder="Örn: Ahmet Yılmaz"
              className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-sky-600"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              E-posta
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder="ornek@firma.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-sky-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Şifre
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="En az 6 karakter"
              className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-sky-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Rol
            </label>
            <select
              name="role"
              defaultValue="staff"
              className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-sky-600"
            >
              {ROLE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                name="isActive"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-slate-300"
              />
              Hesap aktif oluşturulsun
            </label>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Oluşturuluyor..." : "Yetkiliyi Oluştur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}