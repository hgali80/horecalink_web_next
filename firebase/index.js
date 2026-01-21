// firebase/index.js

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Firebase config — senin config'in
const firebaseConfig = {
  apiKey: "AIzaSyDEvNdJPgHhu8ZWHRATzBkLQDDcNed8qQU",
  authDomain: "horecakatalog-e2d10.firebaseapp.com",
  projectId: "horecakatalog-e2d10",
  storageBucket: "horecakatalog-e2d10.firebasestorage.app",
  messagingSenderId: "50523543457",
  appId: "1:50523543457:web:e75910f82dce067ebbdde0"
};

// 🔥 Eğer app zaten başlatılmışsa yeniden başlatma!
// Bu çok önemli — duplicate-app hatasını tamamen bitiriyor.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Modüller
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };


