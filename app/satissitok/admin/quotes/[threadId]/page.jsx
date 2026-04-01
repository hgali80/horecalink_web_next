"use client";

import { useEffect, useState } from "react";
import { db } from "@/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";

export default function ThreadDetailPage() {
  const { threadId } = useParams();
  const router = useRouter();
  const [quotes, setQuotes] = useState([]);

  useEffect(() => {
    async function load() {
      const q = query(
        collection(db, "quote_requests"),
        where("threadId", "==", threadId),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);

      setQuotes(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }))
      );
    }

    if (threadId) load();
  }, [threadId]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">Müşteri Teklifleri</h1>

      <div className="space-y-4">
        {quotes.map((q) => (
          <div
            key={q.id}
            onClick={() =>
              router.push(`/satissitok/admin/quotes/request/${q.id}`)
            }
            className="p-4 bg-white rounded-lg shadow cursor-pointer hover:bg-gray-50"
          >
            <div className="flex justify-between">
              <div>
                <div className="font-semibold">{q.customer?.name}</div>
                <div className="text-sm text-gray-500">
                  {q.customer?.phone} - {q.customer?.email}
                </div>
              </div>

              <div className="text-sm font-medium">
                {q.status}
              </div>
            </div>

            <div className="mt-2 text-sm text-gray-600">
              Toplam: {q.pricing?.finalAmount || 0} KZT
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
