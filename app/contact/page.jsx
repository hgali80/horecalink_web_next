// app/contact/page.jsx
"use client";

import { Phone, Mail, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { getT } from "../lib/i18n";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { app } from "../../firebase";

const SUPPORTED = ["tr", "ru", "kz", "en"];
const MAX_MESSAGE_LENGTH = 500;

export default function ContactPage() {
  const [lang, setLang] = useState("tr");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  useEffect(() => {
    const saved = localStorage.getItem("hl_lang");
    if (saved && SUPPORTED.includes(saved)) {
      setLang(saved);
    }
  }, []);

  const t = getT(lang);
  const db = getFirestore(app);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "message" && value.length > MAX_MESSAGE_LENGTH) return;

    setForm({ ...form, [name]: value });
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
      alert("Mesaj gönderilirken hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F8F9FA] text-gray-900">
      {/* HEADER */}
      <section className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-bold mb-2">
            {t("contact.title")}
          </h1>
          <p className="text-gray-600">
            {t("contact.subtitle")}
          </p>
        </div>
      </section>

      {/* CONTENT */}
      <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-12">
        {/* SOL */}
        <div className="space-y-6">
          <div className="flex items-start space-x-3">
            <MapPin className="text-blue-600 mt-1" />
            <p className="text-gray-700 leading-relaxed">
              <strong>ТОО «Viroo Trade»</strong><br />
              г. Алматы, индекс 050050<br />
              Жетысуский район,<br />
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

        {/* SAĞ – FORM */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            {t("contact.form.title")}
          </h2>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder={t("contact.form.name")}
              className="w-full border rounded-lg px-4 py-2"
            />

            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder={t("contact.form.email")}
              className="w-full border rounded-lg px-4 py-2"
            />

            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              required
              placeholder={t("contact.form.phone")}
              className="w-full border rounded-lg px-4 py-2"
            />

            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              required
              rows={5}
              placeholder={`${t("contact.form.message")} (${form.message.length}/${MAX_MESSAGE_LENGTH})`}
              className="w-full border rounded-lg px-4 py-2"
            />

            <button
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              {loading ? t("contact.form.sending") : t("contact.form.submit")}
            </button>

            {success && (
              <p className="text-green-600 text-sm">
                {t("contact.form.success")}
              </p>
            )}
          </form>
        </div>
      </section>
    </main>
  );
}
