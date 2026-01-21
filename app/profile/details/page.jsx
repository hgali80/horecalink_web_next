//app/profile/details/page.jsx

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useLang } from "../../context/LanguageContext";
import { db } from "../../../firebase";

import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import {
  Mail,
  Phone,
  User,
  MapPin,
  Calendar,
  Building2,
  Briefcase
} from "lucide-react";

export default function ProfileDetailsPage() {
  const { user } = useAuth();
  const { t } = useLang();

  const [data, setData] = useState(null);
  const [defaultAddress, setDefaultAddress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    (async () => {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const u = snap.data();
        setData(u);

        if (u.defaultAddressId) {
          const addrRef = doc(db, "users", user.uid, "addresses", u.defaultAddressId);
          const addrSnap = await getDoc(addrRef);
          if (addrSnap.exists()) {
            setDefaultAddress(addrSnap.data());
          }
        }
      }

      setLoading(false);
    })();
  }, [user]);

  if (loading || !data) {
    return <div className="p-6 text-gray-600">{t("profile.loading")}</div>;
  }

  return (
    <div className="w-full max-w-3xl mx-auto bg-white rounded-xl shadow-sm border p-4 md:p-6">

      {/* BAŞLIK */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold">
          {t("profile.details.title")}
        </h1>

        <Link
          href="/profile/edit"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          {t("profile.details.edit")}
        </Link>
      </div>

      {/* KİŞİSEL BİLGİLER */}
      <div className="space-y-4 mb-10">
        <Item icon={<User />} label={t("profile.details.fullName")} value={data.fullName || "-"} />

        {!data.email?.includes("@phone.horecalink.kz") && (
          <Item icon={<Mail />} label={t("profile.details.email")} value={data.email || "-"} />
        )}

        <Item icon={<Phone />} label={t("profile.details.phone")} value={data.phone || "-"} />
        <Item icon={<MapPin />} label={t("profile.details.city")} value={data.city || "-"} />
      </div>

      {/* AKTİF ADRES */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold mb-3">
          {t("profile.details.activeAddress")}
        </h2>

        {defaultAddress ? (
          <div className="border rounded-lg p-4 bg-gray-50 space-y-1">
            <div className="font-semibold text-gray-800">
              {defaultAddress.title}
            </div>
            <div className="text-gray-700 text-sm">{defaultAddress.receiverName}</div>
            <div className="text-gray-700 text-sm">{defaultAddress.phone}</div>
            <div className="text-gray-700 text-sm">
              {defaultAddress.region}, {defaultAddress.city}, {defaultAddress.district}
            </div>
            <div className="text-gray-700 text-sm">
              {defaultAddress.street} {defaultAddress.apartment}
            </div>
          </div>
        ) : (
          <div className="text-gray-500 italic">
            {t("profile.details.noAddress")}
          </div>
        )}
      </div>

      {/* FİRMA BİLGİLERİ */}
      <div className="space-y-4 mb-10">
        <h2 className="text-lg font-semibold">
          {t("profile.details.companyInfo")}
        </h2>

        <Item icon={<Building2 />} label={t("profile.details.companyName")} value={data.businessName || "-"} />
        <Item icon={<Briefcase />} label={t("profile.details.companyType")} value={data.businessType || "-"} />
        <Item icon={<User />} label={t("profile.details.position")} value={data.position || "-"} />
      </div>

      {/* HESAP BİLGİLERİ */}
      <div className="space-y-2 mb-10">
        <h2 className="text-lg font-semibold">
          {t("profile.details.accountInfo")}
        </h2>

        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Calendar size={16} />
          {t("profile.details.registerDate")}:{" "}
          {data.createdAt
            ? new Date(data.createdAt).toLocaleDateString()
            : "-"}
        </div>

        <div className="text-sm text-gray-700">
          {t("profile.details.role")}: <strong>{data.role || "user"}</strong>
        </div>

        <Link
          href="/profile/security"
          className="inline-block mt-3 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          {t("profile.details.security")}
        </Link>
      </div>
    </div>
  );
}

function Item({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-gray-600">{icon}</div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-gray-900 font-medium">{value}</div>
      </div>
    </div>
  );
}
