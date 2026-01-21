//app/api/auth/registerPhone/route.js

import { NextResponse } from "next/server";
import { auth, db } from "../../../../firebase.js";

import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

export async function POST(req) {
  try {
    const { name, phone, password } = await req.json();

    if (!name || !phone || !password) {
      return NextResponse.json(
        { error: "Eksik bilgi var." },
        { status: 400 }
      );
    }

    // phone örneğin: "+77004446911"
    // sadece rakamları alıyoruz: "77004446911"
    const clean = phone.replace(/\D/g, "");

    // sanal email: 77004446911@phone.horecalink.kz
    const fakeEmail = `${clean}@phone.horecalink.kz`;

    // Firebase kullanıcı oluştur
    const userCred = await createUserWithEmailAndPassword(
      auth,
      fakeEmail,
      password
    );

    // Profil adı ayarla
    await updateProfile(userCred.user, { displayName: name });

    // Firestore user kaydı
    await setDoc(doc(db, "users", userCred.user.uid), {
      uid: userCred.user.uid,
      name,
      email: null,
      phone,           // "+77004446911" olarak saklanıyor
      authType: "phone",
      createdAt: Date.now(),
      role: "user",
      isActive: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("Phone Register Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
