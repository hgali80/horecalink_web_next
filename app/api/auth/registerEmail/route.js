// app/api/auth/registerEmail/route.js

import { NextResponse } from "next/server";
import { auth, db } from "../../../../firebase.js";

import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

export async function POST(req) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Eksik bilgi var." },
        { status: 400 }
      );
    }

    // Firebase kullanıcı oluştur
    const userCred = await createUserWithEmailAndPassword(auth, email, password);

    // Profil adı
    await updateProfile(userCred.user, { displayName: name });

    // Kullanıcıya doğrulama maili gönder
    try {
      await sendEmailVerification(userCred.user);
    } catch (err) {
      console.log("Send email verification error:", err);
    }

    // Firestore - User kaydı
    await setDoc(doc(db, "users", userCred.user.uid), {
      uid: userCred.user.uid,
      fullName: name,   // ← burada 'fullName' yaz ki AuthContext ile uyumlu olsun
      email,
      phone: null,
      authType: "email",
      createdAt: Date.now(),
      role: "user",
      isActive: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("Email Register Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
