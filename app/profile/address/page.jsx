//app/profile/address/page.jsx

"use client";

import { useEffect, useState } from "react";
import { db } from "../../../firebase";
import { useAuth } from "../../context/AuthContext";
import { useLang } from "../../context/LanguageContext";
import { getT } from "../../lib/i18n";

import {
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc
} from "firebase/firestore";

import Link from "next/link";
import { MapPin, Plus, Check, Trash2 } from "lucide-react";

export default function AddressListPage() {
  const { user } = useAuth();
  const { lang } = useLang();
  const t = getT(lang);

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Adresleri fetch et
  useEffect(() => {
    if (!user) return;

    (async () => {
      const ref = collection(db, "users", user.uid, "addresses");
      const snap = await getDocs(ref);

      let arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));

      // isDefault true olanı en üste al
      arr.sort((a, b) => (a.isDefault ? -1 : b.isDefault ? 1 : 0));

      setAddresses(arr);
      setLoading(false);
    })();
  }, [user]);

  // Varsayılan adres seçimi
  const setDefaultAddress = async (id) => {
    if (!user) return;

    const userRef = doc(db, "users", user.uid);

    // User dokümanına yaz (şimdilik kalsın)
    await updateDoc(userRef, {
      defaultAddressId: id,
    });

    // Tüm adreslerde isDefault güncelle
    const ref = collection(db, "users", user.uid, "addresses");
    const snap = await getDocs(ref);

    snap.forEach(async (d) => {
      const addrRef = doc(db, "users", user.uid, "addresses", d.id);

      await updateDoc(addrRef, {
        isDefault: d.id === id,
      });
    });

    // UI güncelle
    const updated = addresses.map((a) => ({
      ...a,
      isDefault: a.id === id,
    }));

    const sorted = updated.sort((a, b) =>
      a.isDefault ? -1 : b.isDefault ? 1 : 0
    );

    setAddresses(sorted);
  };

  // Silme işlemi
  const deleteAddress = async (id) => {
    if (!user) return;

    const confirmDelete = window.confirm(
      t("address.confirmDelete")
    );
    if (!confirmDelete) return;

    const ref = doc(db, "users", user.uid, "addresses", id);
    await deleteDoc(ref);

    // Listeden çıkar
    setAddresses(addresses.filter((a) => a.id !== id));
  };

  if (loading) {
    return (
      <div className="p-6 text-gray-500">
        {t("address.loading")}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow-sm border">

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          {t("address.title")}
        </h1>

        <Link
          href="/profile/address/new"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus size={18} /> {t("address.new")}
        </Link>
      </div>

      {addresses.length === 0 ? (
        <div className="text-gray-500 text-center py-10">
          {t("address.empty")}
        </div>
      ) : (
        <div className="space-y-4">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className="border rounded-lg p-4 bg-gray-50 flex justify-between items-start"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MapPin size={18} className="text-gray-600" />
                  <span className="font-semibold text-gray-800">
                    {addr.title || t("address.defaultTitle")}
                  </span>

                  {addr.isDefault && (
                    <span className="ml-2 text-xs bg-green-600 text-white px-2 py-1 rounded">
                      {t("address.default")}
                    </span>
                  )}
                </div>

                <div className="text-gray-700 text-sm">
                  {addr.receiverName}
                </div>

                <div className="text-gray-700 text-sm">
                  {addr.phone}
                </div>

                <div className="text-gray-700 text-sm">
                  {addr.region}, {addr.city}, {addr.district}
                </div>

                <div className="text-gray-700 text-sm">
                  {addr.street} {addr.apartment}
                </div>

                {addr.note && (
                  <div className="text-gray-500 text-sm italic mt-1">
                    {t("address.note")}: {addr.note}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 ml-4">

                {!addr.isDefault && (
                  <button
                    onClick={() => setDefaultAddress(addr.id)}
                    className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    <Check size={16} /> {t("address.makeDefault")}
                  </button>
                )}

                <button
                  onClick={() => deleteAddress(addr.id)}
                  className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  <Trash2 size={16} /> {t("address.delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
