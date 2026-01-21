//app/api/auth/login/route.js

import { NextResponse } from "next/server";
import { auth, db } from "../../../../firebase.js";
import { signInWithEmailAndPassword } from "firebase/auth";


export async function POST(req) {
  try {
    const { email, phone, password } = await req.json();

    let loginEmail = email;

    // Telefon ile giriş yapılıyorsa sanal email formatına çevir
    if (phone) {
      loginEmail = `${phone.replace(/\D/g, "")}@phone.horecalink.kz`;
    }

    const user = await signInWithEmailAndPassword(auth, loginEmail, password);

    return NextResponse.json({
      success: true,
      uid: user.user.uid,
      name: user.user.displayName || null,
    });
  } catch (error) {
    console.log("Login Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
