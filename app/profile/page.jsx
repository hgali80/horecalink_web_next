"use client";

import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import {
  Boxes,
  Calendar,
  FileText,
  Heart,
  LogOut,
  Mail,
  MapPin,
  Settings,
  User,
} from "lucide-react";
import { auth } from "../../firebase";

export default function ProfileHome() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Yükleniyor...
      </div>
    );
  }

  const allowedEmails = [
    "+77004446911@temporary.com",
    "+77023940182@temporary.com",
    "hasanaligunay@gmail.com",
  ];

  const canAccessSalesStock = user?.email && allowedEmails.includes(user.email);

  const formatDate = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleDateString();
    } catch {
      return timestamp || "-";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl rounded-[32px] bg-white p-5 shadow-[0_24px_60px_rgba(15,35,35,0.08)] md:p-8">
        <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">Hesabım</h1>

        <div className="mt-6 flex flex-col gap-4 rounded-[28px] bg-slate-50 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-100 text-cyan-800">
              <User size={28} />
            </div>

            <div>
              <div className="text-lg font-semibold text-slate-900">{user.fullName || "Kullanıcı"}</div>
              {user.email ? (
                <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                  <Mail size={16} />
                  {user.email}
                </div>
              ) : null}
              {(user.phone || user.phoneNumber) ? (
                <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                  <MapPin size={16} />
                  {user.phone || user.phoneNumber}
                </div>
              ) : null}
              <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                <Calendar size={16} />
                Kayıt: {formatDate(user.createdAt)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            <div>Firma: <strong className="text-slate-900">{user.businessName || "-"}</strong></div>
            <div>Pozisyon: <strong className="text-slate-900">{user.position || "-"}</strong></div>
          </div>
        </div>

        <h2 className="mt-8 text-lg font-semibold text-slate-900">İşlemler</h2>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ProfileMenuCard icon={<FileText size={20} />} title="Teklif talep oluştur" href="/teklif-talep" />
          <ProfileMenuCard icon={<FileText size={20} />} title="Teklif geçmişi" href="/teklifler" />
          <ProfileMenuCard icon={<User size={20} />} title="Kişisel bilgiler" href="/profile/details" />
          <ProfileMenuCard icon={<Heart size={20} />} title="Favoriler" href="/profile/favorites" />
          <ProfileMenuCard icon={<MapPin size={20} />} title="Adresler" href="/profile/address" />
          <ProfileMenuCard icon={<Settings size={20} />} title="Profil ayarları" href="/profile/edit" />

          {canAccessSalesStock ? (
            <ProfileMenuCard icon={<Boxes size={20} />} title="Satış & Stok" href="/satissitok/admin" />
          ) : null}

          <LogoutButton label="Çıkış yap" />
        </div>
      </div>
    </div>
  );
}

function ProfileMenuCard({ icon, title, href }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-3xl bg-slate-50 p-4 text-slate-800 shadow-sm transition hover:bg-slate-100"
    >
      <div className="shrink-0 text-slate-700">{icon}</div>
      <div className="text-sm font-semibold">{title}</div>
    </Link>
  );
}

function LogoutButton({ label }) {
  return (
    <button
      onClick={() => auth.signOut().then(() => (window.location.href = "/login"))}
      className="flex items-center gap-3 rounded-3xl bg-red-50 p-4 text-red-700 shadow-sm transition hover:bg-red-100"
    >
      <LogOut size={20} className="shrink-0" />
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}
