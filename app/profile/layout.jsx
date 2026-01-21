//app/profile/layout.jsx

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";

import {
  Menu,
  X,
  User,
  MapPin,
  ShoppingBag,
  Heart,
  History,
  MessageCircle,
  Shield,
  Gift,
  Settings,
  LogOut,
  LayoutDashboard
} from "lucide-react";

export default function ProfileLayout({ children }) {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const router = useRouter();
  const pathname = usePathname();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {t("profile.loading")}
      </div>
    );
  }

  const menuItems = [
    { key: "personalInfo", icon: <User />, href: "/profile/details" },
    { key: "addresses", icon: <MapPin />, href: "/profile/address" },
    { key: "orders", icon: <ShoppingBag />, href: "/profile/orders" },
    { key: "basket", icon: <ShoppingBag />, href: "/profile/basket" },
    { key: "favorites", icon: <Heart />, href: "/profile/favorites" },
    { key: "history", icon: <History />, href: "/profile/history" },
    { key: "support", icon: <MessageCircle />, href: "/profile/support" },
    { key: "security", icon: <Shield />, href: "/profile/security" },
    { key: "rewards", icon: <Gift />, href: "/profile/rewards" },
    { key: "settings", icon: <Settings />, href: "/profile/settings" }
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">

        {/* -------- DESKTOP SIDEBAR -------- */}
        <aside className="hidden md:block w-64 bg-white border-r shadow-sm p-4">

          <div className="text-lg font-semibold text-gray-800 mb-6">
            {t("profile.sidebar.title")}
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "text-gray-700 hover:bg-indigo-50 hover:text-indigo-700"
                  }`}
                >
                  {item.icon}
                  {t(`profile.sidebar.${item.key}`)}
                </Link>
              );
            })}

            {user.role === "admin" && (
              <Link
                href="/admin"
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
              >
                <LayoutDashboard />
                {t("profile.sidebar.admin")}
              </Link>
            )}

            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="w-full mt-6 flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 transition"
            >
              <LogOut />
              {t("profile.sidebar.logout")}
            </button>
          </nav>
        </aside>

        {/* -------- CONTENT -------- */}
        <div className="flex-1 p-4 md:p-6">
          <button
            className="md:hidden mb-4 flex items-center gap-2 text-gray-700"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
            {t("profile.sidebar.menu")}
          </button>

          {children}
        </div>
      </div>
    </div>
  );
}
