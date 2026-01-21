// horecalink_web_next/app/context/AuthContext.jsx

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../../firebase/index";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        localStorage.removeItem("horecalink_user");
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(userRef);

        let firestoreUser = {};
        if (snap.exists()) firestoreUser = snap.data();

        const mergedUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || firestoreUser.email || "",
          phone: firebaseUser.phoneNumber || firestoreUser.phone || "",
          fullName: firestoreUser.fullName || firebaseUser.displayName || "",
          businessType: firestoreUser.businessType || "",
          businessName: firestoreUser.businessName || "",
          position: firestoreUser.position || "",
          city: firestoreUser.city || "",
          role: firestoreUser.role || "user",
          createdAt: firestoreUser.createdAt || "",
        };

        setUser(mergedUser);
        localStorage.setItem("horecalink_user", JSON.stringify(mergedUser));
      } catch (err) {
        console.error("AuthContext Firestore Error:", err);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Firebase signOut error:", e);
    }
    localStorage.removeItem("horecalink_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
