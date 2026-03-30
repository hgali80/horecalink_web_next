// firebase/index.js

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDEvNdJPgHhu8ZWHRATzBkLQDDcNed8qQU",
  authDomain: "horecakatalog-e2d10.firebaseapp.com",
  projectId: "horecakatalog-e2d10",
  storageBucket: "horecakatalog-e2d10.firebasestorage.app",
  messagingSenderId: "50523543457",
  appId: "1:50523543457:web:e75910f82dce067ebbdde0",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };