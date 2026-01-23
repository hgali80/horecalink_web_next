//app/profile/page.jsx

"use client";

import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import {
  Mail,
  Phone,
  Calendar,
  User,
  Heart,
  ShoppingBag,
  MapPin,
  Settings,
  Gift,
  History,
  LogOut
} from "lucide-react";
import { auth } from "../../firebase/index";

export default function ProfileHome() {
  const { user } = useAuth();
  const { t } = useLang();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        {t("profile.loading")}
      </div>
    );
  }

  const formatDate = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleDateString();
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-4">
      <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 md:max-w-4xl md:mx-auto">

        <h1 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4">
          {t("profile.title")}
        </h1>

        {/* PROFİL KARTI */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 bg-gray-50 rounded-lg border">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-indigo-200 flex items-center justify-center">
            <User className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-700" />
          </div>

          <div className="text-center sm:text-left">
            <div className="text-base sm:text-lg font-semibold text-gray-900">
              {user.fullName || t("profile.card.defaultName")}
            </div>

            {user.email && (
              <div className="flex items-center justify-center sm:justify-start text-gray-600 text-sm mt-1 break-all">
                <Mail className="w-4 h-4 mr-2 shrink-0" />
                {user.email}
              </div>
            )}

            {(user.phone || user.phoneNumber) && (
              <div className="flex items-center justify-center sm:justify-start text-gray-600 text-sm">
                <Phone className="w-4 h-4 mr-2 shrink-0" />
                {user.phone || user.phoneNumber}
              </div>
            )}

            <div className="flex items-center justify-center sm:justify-start text-gray-500 text-sm mt-1">
              <Calendar className="w-4 h-4 mr-2 shrink-0" />
              {t("profile.card.registerDate")}: {formatDate(user.createdAt)}
            </div>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-gray-800 mt-6 mb-3">
          {t("profile.menu.title")}
        </h2>

        {/* MENU GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <ProfileMenuCard icon={<User size={20} />} title={t("profile.menu.personalInfo")} href="/profile/details" />
          <ProfileMenuCard icon={<ShoppingBag size={20} />} title={t("profile.menu.orders")} href="/profile/orders" />
          <ProfileMenuCard icon={<ShoppingBag size={20} />} title={t("profile.menu.basket")} href="/profile/basket" />
          <ProfileMenuCard icon={<Heart size={20} />} title={t("profile.menu.favorites")} href="/profile/favorites" />
          <ProfileMenuCard icon={<MapPin size={20} />} title={t("profile.menu.addresses")} href="/profile/address" />
          <ProfileMenuCard icon={<History size={20} />} title={t("profile.menu.history")} href="/profile/history" />
          <ProfileMenuCard icon={<Gift size={20} />} title={t("profile.menu.rewards")} href="/profile/rewards" />
          <ProfileMenuCard icon={<Settings size={20} />} title={t("profile.menu.settings")} href="/profile/edit" />

          <LogoutButton label={t("profile.menu.logout")} />
        </div>
      </div>
    </div>
  );
}

function ProfileMenuCard({ icon, title, href }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 border rounded-xl bg-gray-50 hover:bg-gray-100 transition shadow-sm"
    >
      <div className="text-blue-600 shrink-0">{icon}</div>
      <div className="text-sm font-medium text-gray-800">
        {title}
      </div>
    </Link>
  );
}

function LogoutButton({ label }) {
  return (
    <button
      onClick={() => auth.signOut().then(() => (window.location.href = "/login"))}
      className="flex items-center gap-3 p-3 border rounded-xl bg-red-50 hover:bg-red-100 transition shadow-sm w-full"
    >
      <LogOut className="text-red-600 shrink-0" size={20} />
      <span className="text-sm font-medium text-red-700">{label}</span>
    </button>
  );
}
