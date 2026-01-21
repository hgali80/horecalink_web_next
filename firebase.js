// firebase.js

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase console'dan aldığın güncel config
const firebaseConfig = {
  apiKey: "AIzaSyDEvNdJPgHhu8ZWHRATzBkLQDDcNed8qQU",
  authDomain: "horecakatalog-e2d10.firebaseapp.com",
  projectId: "horecakatalog-e2d10",
  storageBucket: "horecakatalog-e2d10.firebasestorage.app",
  messagingSenderId: "50525343457",
  appId: "1:50525343457:web:e75910f82dcee067ebbdde0"
};

// Çift initialize olmamasını sağlar
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { app };
