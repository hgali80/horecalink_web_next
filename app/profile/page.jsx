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
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-6 border mt-6">

      <h1 className="text-2xl font-semibold text-gray-900 mb-4">
        {t("profile.title")}
      </h1>

      {/* PROFİL KARTI */}
      <div className="flex items-center gap-6 p-4 bg-gray-50 rounded-lg border">
        <div className="w-20 h-20 rounded-full bg-indigo-200 flex items-center justify-center">
          <User className="w-10 h-10 text-indigo-700" />
        </div>

        <div>
          <div className="text-lg font-semibold text-gray-900">
            {user.fullName || t("profile.card.defaultName")}
          </div>

          {user.email && (
            <div className="flex items-center text-gray-600 text-sm mt-1">
              <Mail className="w-4 h-4 mr-2" />
              {user.email}
            </div>
          )}

          {(user.phone || user.phoneNumber) && (
            <div className="flex items-center text-gray-600 text-sm">
              <Phone className="w-4 h-4 mr-2" />
              {user.phone || user.phoneNumber}
            </div>
          )}

          <div className="flex items-center text-gray-500 text-sm mt-1">
            <Calendar className="w-4 h-4 mr-2" />
            {t("profile.card.registerDate")}: {formatDate(user.createdAt)}
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mt-8 mb-4">
        {t("profile.menu.title")}
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

        <ProfileMenuCard icon={<User size={22} />} title={t("profile.menu.personalInfo")} href="/profile/details" />
        <ProfileMenuCard icon={<ShoppingBag size={22} />} title={t("profile.menu.orders")} href="/orders" />
        <ProfileMenuCard icon={<ShoppingBag size={22} />} title={t("profile.menu.basket")} href="/profile/basket" />
        <ProfileMenuCard icon={<Heart size={22} />} title={t("profile.menu.favorites")} href="/profile/favorites" />
        <ProfileMenuCard icon={<MapPin size={22} />} title={t("profile.menu.addresses")} href="/profile/address" />
        <ProfileMenuCard icon={<History size={22} />} title={t("profile.menu.history")} href="/profile/history" />
        <ProfileMenuCard icon={<Gift size={22} />} title={t("profile.menu.rewards")} href="/profile/rewards" />
        <ProfileMenuCard icon={<Settings size={22} />} title={t("profile.menu.settings")} href="/profile/edit" />

        <LogoutButton label={t("profile.menu.logout")} />
      </div>
    </div>
  );
}

function ProfileMenuCard({ icon, title, href }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-2 p-4 border rounded-xl bg-gray-50 hover:bg-gray-100 transition shadow-sm"
    >
      <div className="text-blue-600">{icon}</div>
      <div className="text-sm font-medium text-gray-800 text-center">
        {title}
      </div>
    </Link>
  );
}

function LogoutButton({ label }) {
  return (
    <button
      onClick={() => auth.signOut().then(() => (window.location.href = "/login"))}
      className="flex flex-col items-center justify-center gap-2 p-4 border rounded-xl bg-red-50 hover:bg-red-100 transition shadow-sm w-full"
    >
      <LogOut className="text-red-600" size={22} />
      <span className="text-sm font-medium text-red-700">{label}</span>
    </button>
  );
}
