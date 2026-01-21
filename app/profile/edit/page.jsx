//app/profile/edit/page.jsx

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../../firebase";

import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs
} from "firebase/firestore";

import Link from "next/link";
import { Mail, Phone, MapPin, User, Calendar } from "lucide-react";

export default function ProfileDetailsPage() {
  const { user } = useAuth();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    city: "",
    businessName: "",
    businessType: "",
    position: "",
  });

  const [defaultAddress, setDefaultAddress] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔵 User verisini Firestore’dan çek
  useEffect(() => {
    if (!user) return;

    (async () => {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();

        setForm({
          fullName: data.fullName || "",
          email: data.email || "",
          phone: data.phone || "",
          city: data.city || "",
          businessName: data.businessName || "",
          businessType: data.businessType || "",
          position: data.position || "",
        });

        // Varsayılan adresi getir
        if (data.defaultAddressId) {
          const addrRef = doc(
            db,
            "users",
            user.uid,
            "addresses",
            data.defaultAddressId
          );
          const addrSnap = await getDoc(addrRef);
          if (addrSnap.exists()) {
            setDefaultAddress(addrSnap.data());
          }
        }
      }

      setLoading(false);
    })();
  }, [user]);

  // 🔵 Profil güncelleme
  const saveProfile = async () => {
    if (!user) return;

    const userRef = doc(db, "users", user.uid);

    await updateDoc(userRef, form);

    alert("Bilgileriniz güncellendi.");
  };

  if (loading) {
    return <div className="p-6 text-gray-600">Yükleniyor...</div>;
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden max-w-3xl mx-auto bg-white rounded-xl shadow-sm border p-4 md:p-6">

      <h1 className="text-xl font-semibold mb-4">Kişisel Bilgiler</h1>

      {/* ----------- PROFIL BILGILERI ----------- */}
      <div className="space-y-4 mb-10">
        <div>
          <label className="text-sm font-medium">Ad Soyad</label>
          <input
            className="w-full border rounded px-3 py-2 mt-1"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
        </div>

        {/* Email (fake email olan gösterilmeyecek) */}
        {!form.email.includes("@phone.horecalink.kz") && (
          <div>
            <label className="text-sm font-medium">E-posta</label>
            <input
              className="w-full border rounded px-3 py-2 mt-1"
              value={form.email}
              placeholder="E-posta ekleyin"
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        )}

        {/* Telefon (fake değilse gösterilecek) */}
        {!form.phone.includes("@") && (
          <div>
            <label className="text-sm font-medium">Telefon</label>
            <input
              className="w-full border rounded px-3 py-2 mt-1"
              value={form.phone}
              placeholder="Telefon ekleyin"
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        )}

        <div>
          <label className="text-sm font-medium">Şehir</label>
          <input
            className="w-full border rounded px-3 py-2 mt-1"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </div>
      </div>

      {/* ----------- AKTIF ADRES ----------- */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold mb-2">Aktif Adres</h2>

        {defaultAddress ? (
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex items-center gap-3 mb-2">
              <MapPin className="text-gray-600" />
              <div className="font-medium">{defaultAddress.title}</div>
            </div>

            <div className="text-sm text-gray-700">
              {defaultAddress.receiverName}
            </div>
            <div className="text-sm text-gray-700">
              {defaultAddress.phone}
            </div>
            <div className="text-sm text-gray-700">
              {defaultAddress.region}, {defaultAddress.city},{" "}
              {defaultAddress.district}
            </div>
            <div className="text-sm text-gray-700">
              {defaultAddress.street} {defaultAddress.apartment}
            </div>
          </div>
        ) : (
          <div className="text-gray-500 italic">Henüz adres eklenmemiş.</div>
        )}

        <Link
          href="/profile/address"
          className="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Adresleri Yönet
        </Link>
      </div>

      {/* ----------- FIRMA BILGILERI ----------- */}
      <div className="space-y-4 mb-10">
        <h2 className="text-lg font-semibold mb-2">Firma Bilgileri</h2>

        <div>
          <label className="text-sm font-medium">Firma Adı</label>
          <input
            className="w-full border rounded px-3 py-2 mt-1"
            value={form.businessName}
            onChange={(e) =>
              setForm({ ...form, businessName: e.target.value })
            }
          />
        </div>

        <div>
          <label className="text-sm font-medium">Firma Türü</label>
          <input
            className="w-full border rounded px-3 py-2 mt-1"
            value={form.businessType}
            onChange={(e) =>
              setForm({ ...form, businessType: e.target.value })
            }
          />
        </div>

        <div>
          <label className="text-sm font-medium">Pozisyon</label>
          <input
            className="w-full border rounded px-3 py-2 mt-1"
            value={form.position}
            onChange={(e) =>
              setForm({ ...form, position: e.target.value })
            }
          />
        </div>
      </div>

      {/* ----------- HESAP BILGILERI ----------- */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold mb-2">Hesap Bilgileri</h2>

        <div className="text-sm text-gray-700 flex items-center gap-2">
          <Calendar size={16} />
          Kayıt Tarihi:{" "}
          {user.createdAt
            ? new Date(user.createdAt).toLocaleDateString("tr-TR")
            : "-"}
        </div>

        <div className="text-sm text-gray-700 mt-2">
          Rol: <strong>{user.role}</strong>
        </div>

        <Link
          href="/profile/security"
          className="inline-block mt-3 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Şifre & Güvenlik Ayarları
        </Link>
      </div>

      {/* ----------- KAYDET BUTONU ----------- */}
      <button
        onClick={saveProfile}
        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
      >
        Kaydet
      </button>
    </div>
  );
}
