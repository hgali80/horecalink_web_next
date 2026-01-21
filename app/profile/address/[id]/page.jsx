//profile/address/[id]/page.jsx

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useLang } from "../../../context/LanguageContext";
import { getT } from "../../../lib/i18n";
import { db } from "../../../../firebase";

import {
  doc,
  getDoc,
  updateDoc
} from "firebase/firestore";

import { useRouter, useParams } from "next/navigation";

import regionsData from "../../../../public/data/kz_address.json";

export default function EditAddressPage() {
  const { user } = useAuth();
  const { lang } = useLang();
  const t = getT(lang);
  const router = useRouter();
  const params = useParams(); // URL'den id alma

  const addressId = params.id;

  const [loading, setLoading] = useState(true);

  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");

  const [cityList, setCityList] = useState([]);
  const [districtList, setDistrictList] = useState([]);

  const [form, setForm] = useState({
    title: "",
    receiverName: "",
    phone: "",
    street: "",
    apartment: "",
    note: "",
    isDefault: false,
  });

  // 🔵 1) Adresi Firestore'dan çek
  useEffect(() => {
    if (!user || !addressId) return;

    (async () => {
      const ref = doc(db, "users", user.uid, "addresses", addressId);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        router.push("/profile/address");
        return;
      }

      const data = snap.data();

      setForm({
        title: data.title || "",
        receiverName: data.receiverName || "",
        phone: data.phone || "",
        street: data.street || "",
        apartment: data.apartment || "",
        note: data.note || "",
        isDefault: data.id === user.defaultAddressId,
      });

      setRegion(data.region);
      setCity(data.city);
      setDistrict(data.district);

      setLoading(false);
    })();
  }, [user, addressId]);

  // 🔵 Region değişince city listesi güncellenir
  useEffect(() => {
    if (!region) return;

    const r = regionsData.regions.find((x) => x.region === region);
    setCityList(r?.cities || []);
  }, [region]);

  // 🔵 City değişince district listesi güncellenir
  useEffect(() => {
    if (!region || !city) return;

    const r = regionsData.regions.find((x) => x.region === region);
    const c = r?.cities.find((x) => x.city === city);

    setDistrictList(c?.districts || []);
  }, [city]);

  // 🔵 Adresi kaydet
  const saveAddress = async (e) => {
    e.preventDefault();
    if (!user) return;

    const addressRef = doc(db, "users", user.uid, "addresses", addressId);

    await updateDoc(addressRef, {
      ...form,
      region,
      city,
      district,
    });

    // Eğer varsayılan adres seçildiyse
    if (form.isDefault) {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        defaultAddressId: addressId,
      });
    }

    router.push("/profile/address");
  };

  if (loading) {
    return (
      <div className="p-6 text-gray-500">
        {t("address.loadingSingle")}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow-sm border">

      <h1 className="text-xl font-semibold mb-4">
        {t("address.editTitle")}
      </h1>

      <form onSubmit={saveAddress} className="space-y-4">

        {/* Başlık */}
        <div>
          <label className="text-sm font-medium">
            {t("address.titleLabel")}
          </label>
          <input
            type="text"
            value={form.title}
            className="w-full border rounded px-3 py-2 mt-1"
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>

        {/* Alıcı */}
        <div>
          <label className="text-sm font-medium">
            {t("address.receiver")}
          </label>
          <input
            type="text"
            value={form.receiverName}
            className="w-full border rounded px-3 py-2 mt-1"
            onChange={(e) =>
              setForm({ ...form, receiverName: e.target.value })
            }
            required
          />
        </div>

        {/* Telefon */}
        <div>
          <label className="text-sm font-medium">
            {t("address.phone")}
          </label>
          <input
            type="tel"
            value={form.phone}
            className="w-full border rounded px-3 py-2 mt-1"
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
        </div>

        {/* Region */}
        <div>
          <label className="text-sm font-medium">
            {t("address.region")}
          </label>
          <select
            className="w-full border rounded px-3 py-2 mt-1"
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setCity("");
              setDistrict("");
            }}
            required
          >
            <option value="">
              {t("common.select")}
            </option>
            {regionsData.regions.map((r) => (
              <option key={r.region} value={r.region}>
                {r.region}
              </option>
            ))}
          </select>
        </div>

        {/* City */}
        <div>
          <label className="text-sm font-medium">
            {t("address.city")}
          </label>

          <select
            className="w-full border rounded px-3 py-2 mt-1"
            value={city}
            required
            onChange={(e) => {
              setCity(e.target.value);
              setDistrict("");
            }}
          >
            <option value="">
              {t("common.select")}
            </option>
            {cityList.map((c) => (
              <option key={c.city} value={c.city}>
                {c.city}
              </option>
            ))}
          </select>
        </div>

        {/* District */}
        <div>
          <label className="text-sm font-medium">
            {t("address.district")}
          </label>

          <select
            className="w-full border rounded px-3 py-2 mt-1"
            value={district}
            required
            onChange={(e) => setDistrict(e.target.value)}
          >
            <option value="">
              {t("common.select")}
            </option>
            {districtList.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Sokak */}
        <div>
          <label className="text-sm font-medium">
            {t("address.street")}
          </label>
          <input
            type="text"
            value={form.street}
            className="w-full border rounded px-3 py-2 mt-1"
            onChange={(e) => setForm({ ...form, street: e.target.value })}
            required
          />
        </div>

        {/* Apartment */}
        <div>
          <label className="text-sm font-medium">
            {t("address.apartment")}
          </label>
          <input
            type="text"
            value={form.apartment}
            className="w-full border rounded px-3 py-2 mt-1"
            onChange={(e) =>
              setForm({ ...form, apartment: e.target.value })
            }
          />
        </div>

        {/* Note */}
        <div>
          <label className="text-sm font-medium">
            {t("address.note")}
          </label>
          <input
            type="text"
            value={form.note}
            className="w-full border rounded px-3 py-2 mt-1"
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>

        {/* Varsayılan adres */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) =>
              setForm({ ...form, isDefault: e.target.checked })
            }
          />
          <span className="text-sm">
            {t("address.makeDefault")}
          </span>
        </div>

        <button
          type="submit"
          className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          {t("common.save")}
        </button>
      </form>
    </div>
  );
}
