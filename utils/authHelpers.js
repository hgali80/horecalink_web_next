// utils/authHelpers.js

// Telefonu Firebase Auth için kullanılabilir "pseudo-email"e çeviriyoruz.
export function phoneToAuthEmail(rawPhone) {
  if (!rawPhone) return "";

  // Sadece rakamları al (boşluk, +, - vs. temizlenir)
  const digits = rawPhone.replace(/[^\d]/g, "");

  // Örn: phone_77004446911@phone.horecalink.kz
  return `phone_${digits}@phone.horecalink.kz`;
}

// Firestore doküman ID'si için de sadece rakamlı format kullanırız
export function normalizePhone(rawPhone) {
  if (!rawPhone) return "";
  return rawPhone.replace(/[^\d]/g, "");
}
