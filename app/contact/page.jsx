// app/contact/page.jsx
"use client";

import { Phone, Mail, MapPin } from "lucide-react";
import { useState } from "react";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { app } from "../../firebase";
import { useLang } from "../context/LanguageContext";

const MAX_MESSAGE_LENGTH = 500;

export default function ContactPage() {
  const { lang, t } = useLang();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const db = getFirestore(app);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "message" && value.length > MAX_MESSAGE_LENGTH) return;

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      await addDoc(collection(db, "contact_messages"), {
        ...form,
        lang,
        read: false,
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
      setForm({ name: "", email: "", phone: "", message: "" });
    } catch (err) {
      console.error("Contact form error:", err);
      alert(t("contact.form.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F8F9FA] text-gray-900">
      <section className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h1 className="mb-2 text-3xl font-bold">{t("contact.title")}</h1>
          <p className="text-gray-600">{t("contact.subtitle")}</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-2">
        <div className="space-y-6">
          <div className="flex items-start space-x-3">
            <MapPin className="mt-1 text-blue-600" />
            <p className="leading-relaxed text-gray-700">
              <strong>ТОО «Viroo Trade»</strong>
              <br />
              г. Алматы, индекс 050050
              <br />
              Жетысуский район,
              <br />
              ул. Черноморская дом 12
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Phone className="text-blue-600" />
            <span className="text-gray-700">+7 700 444 6 911</span>
          </div>

          <div className="flex items-center space-x-3">
            <Mail className="text-blue-600" />
            <span className="text-gray-700">info@horecalink.kz</span>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">{t("contact.form.title")}</h2>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder={t("contact.form.name")}
              className="w-full rounded-lg border px-4 py-2"
            />

            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder={t("contact.form.email")}
              className="w-full rounded-lg border px-4 py-2"
            />

            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              required
              placeholder={t("contact.form.phone")}
              className="w-full rounded-lg border px-4 py-2"
            />

            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              required
              rows={5}
              placeholder={`${t("contact.form.message")} (${form.message.length}/${MAX_MESSAGE_LENGTH})`}
              className="w-full rounded-lg border px-4 py-2"
            />

            <button
              disabled={loading}
              className="rounded-lg bg-blue-600 px-6 py-2 text-white transition hover:bg-blue-700"
            >
              {loading ? t("contact.form.sending") : t("contact.form.submit")}
            </button>

            {success ? (
              <p className="text-sm text-green-600">{t("contact.form.success")}</p>
            ) : null}
          </form>
        </div>
      </section>
    </main>
  );
}