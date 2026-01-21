//app/profile/address/new/page.jsx

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useLang } from "../../../context/LanguageContext";
import { getT } from "../../../lib/i18n";
import { db } from "../../../../firebase";

import {
  collection,
  addDoc,
  doc,
  updateDoc
} from "firebase/firestore";

import { useRouter } from "next/navigation";

import regionsData from "../../../../public/data/kz_address.json";

export default function NewAddressPage() {
  const { user } = useAuth();
  const { lang } = useLang();
  const t = getT(lang);
  const router = useRouter();

  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");

  const [cityList, setCityList] = useState([]);
  const [districtList, setDistrictList] = useState([]);

  const [form, setForm] = useState({
    street: "",
    apartment: "",
    note: "",
    isDefault: false,
  });

  // Region seçilince şehirler
  useEffect(() => {
    if (!region) {
      setCityList([]);
      setCity("");
      return;
    }

    const regionObj = regionsData.find((x) => x.region === region);
    setCityList(regionObj?.cities || []);
    setCity("");
    setDistrict("");
  }, [region]);

  // City seçilince ilçeler
  useEffect(() => {
    if (!city || !region) {
      setDistrictList([]);
      setDistrict("");
      return;
    }

    const regionObj = regionsData.find((x) => x.region === region);
    const cityObj = regionObj?.cities.find((c) => c.city === city);

    setDistrictList(cityObj?.districts || []);
    setDistrict("");
  }, [city]);

  // Kaydet
  const saveAddress = async (e) => {
    e.preventDefault();
    if (!user) return;

    const addressesRef = collection(db, "users", user.uid, "addresses");

    const newAddress = {
      region,
      city,
      district,
      street: form.street,
      apartment: form.apartment || "",
      note: form.note || "",
      createdAt: Date.now(),
    };

    const docRef = await addDoc(addressesRef, newAddress);

    // Varsayılan adres olarak işaretlendiyse
    if (form.isDefault) {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        defaultAddressId: docRef.id,
      });
    }

    router.push("/profile/address");
  };

  return (
    <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow-sm border">

      <h1 className="text-xl font-semibold mb-4">
        {t("address.newTitle")}
      </h1>

      <form onSubmit={saveAddress} className="space-y-4">

        {/* Region */}
        <div>
          <label className="text-sm font-medium">
            {t("address.region")}
          </label>
          <select
            className="w-full border rounded px-3 py-2 mt-1"
            value={region}
            required
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="">
              {t("common.select")}
            </option>
            {regionsData.map((r) => (
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
            onChange={(e) => setCity(e.target.value)}
            disabled={!region}
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
            disabled={!city}
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

        {/* Street */}
        <div>
          <label className="text-sm font-medium">
            {t("address.street")}
          </label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2 mt-1"
            required
            onChange={(e) =>
              setForm({ ...form, street: e.target.value })
            }
          />
        </div>

        {/* Apartment */}
        <div>
          <label className="text-sm font-medium">
            {t("address.apartment")}
          </label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2 mt-1"
            onChange={(e) =>
              setForm({ ...form, apartment: e.target.value })
            }
          />
        </div>

        {/* Note */}
        <div>
          <label className="text-sm font-medium">
            {t("address.noteOptional")}
          </label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2 mt-1"
            onChange={(e) =>
              setForm({ ...form, note: e.target.value })
            }
          />
        </div>

        {/* Default */}
        <div className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
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
