"use client";

import { collection, doc, getDocs, query, where, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/firebase";
import { ERP_COLLECTIONS } from "./erpCollections";

const text = value => String(value ?? "").trim();
const cents = value => Math.round(Number(value || 0) * 100);
const inactive = row => ["cancelled", "canceled", "void"].includes(row.status);

async function receiptRows(transaction, name, receiptNo) {
  const snap = await getDocs(query(collection(db, name), where("receiptNo", "==", receiptNo)));
  const rows = [];
  for (const item of snap.docs) {
    const ref = doc(db, name, item.id);
    const fresh = await transaction.get(ref);
    if (fresh.exists()) rows.push({ ...fresh.data(), id: item.id, ref });
  }
  return rows;
}

export async function cancelErpCashMovement({ movementId, reason }) {
  const cancellationReason = text(reason);
  if (!text(movementId) || !cancellationReason || cancellationReason.length > 1000) throw new Error("Hareketi seçin ve iptal gerekçesini girin (en fazla 1000 karakter).");
  const user = auth.currentUser;
  if (!user) throw new Error("İptal için oturum açmalısınız.");
  const cashRef = doc(db, ERP_COLLECTIONS.CASH_MOVEMENTS, movementId);
  return runTransaction(db, async transaction => {
    const snap = await transaction.get(cashRef);
    if (!snap.exists()) throw new Error("Finans hareketi bulunamadı.");
    const cash = snap.data();
    if (inactive(cash)) throw new Error("Bu hareket zaten iptal edilmiş.");
    if (!["manual", "document_settlement", "collection", "payment"].includes(cash.kind || "manual") || !["in", "out"].includes(cash.direction)) throw new Error("Bu hareket türü tahsilat/ödeme iptaline uygun değil.");
    const amount = cents(cash.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !cash.accountId || !cash.receiptNo) throw new Error("Hareketin tutar, hesap veya makbuz bilgisi eksik.");
    const accountRef = doc(db, ERP_COLLECTIONS.CASH_ACCOUNTS, cash.accountId);
    const accountSnap = await transaction.get(accountRef);
    if (!accountSnap.exists()) throw new Error("Hareketin kasa/banka hesabı bulunamadı.");
    const account = accountSnap.data();
    if (text(account.currency || "KZT") !== text(cash.currency || "KZT")) throw new Error("Hesap ve hareket para birimi uyuşmuyor.");

    // Legacy entries have no cashMovementId on the cari row. Match the unique
    // receipt and validate every financial field before accepting that link.
    const siblings = await receiptRows(transaction, ERP_COLLECTIONS.CASH_MOVEMENTS, cash.receiptNo);
    if (siblings.length !== 1 || siblings[0].id !== movementId) throw new Error("Makbuz birden fazla kasa hareketine bağlı; kayıtları kontrol edin.");
    const cariRows = await receiptRows(transaction, ERP_COLLECTIONS.CARI_MOVEMENTS, cash.receiptNo);
    const cariId = text(cash.cariId || cash.cariSnapshot?.id);
    if (cariRows.length !== (cariId ? 1 : 0)) throw new Error("Tahsilat/ödemenin cari kaydı doğrulanamadı.");
    const cari = cariRows[0];
    if (cari && (inactive(cari) || text(cari.cariId) !== cariId || cari.accountId !== cash.accountId
      || cents(cari.amount) !== amount || text(cari.currency || "KZT") !== text(cash.currency || "KZT")
      || cari.direction !== (cash.direction === "in" ? "alacak" : "borc")
      || text(cari.documentId) !== text(cash.documentId))) throw new Error("Kasa ve cari hareketleri uyuşmuyor; hiçbir kayıt değiştirilmedi.");

    let settlement, documentRef, documentData, documentPatch;
    if (cash.kind === "document_settlement" || cash.documentId || cash.settlementId) {
      if (![ERP_COLLECTIONS.SALES, ERP_COLLECTIONS.PURCHASES].includes(cash.documentCollection) || !cash.documentId) throw new Error("Bağlı fatura bilgisi eksik.");
      const settlements = await receiptRows(transaction, ERP_COLLECTIONS.DOCUMENT_SETTLEMENTS, cash.receiptNo);
      if (settlements.length !== 1) throw new Error("Belge ödeme kaydı doğrulanamadı.");
      settlement = settlements[0];
      if (inactive(settlement) || cents(settlement.amount) !== amount || settlement.accountId !== cash.accountId
        || settlement.documentId !== cash.documentId || settlement.documentCollection !== cash.documentCollection
        || settlement.direction !== cash.direction || text(settlement.cariId) !== cariId
        || text(settlement.currency || "KZT") !== text(cash.currency || "KZT")
        || (cash.settlementId && cash.settlementId !== settlement.id)
        || (cari && (cari.movementKind !== "document_settlement" || cari.documentCollection !== cash.documentCollection))) throw new Error("Fatura, kasa ve ödeme kayıtları uyuşmuyor.");
      documentRef = doc(db, cash.documentCollection, cash.documentId);
      const documentSnap = await transaction.get(documentRef);
      if (!documentSnap.exists()) throw new Error("Bağlı fatura bulunamadı.");
      documentData = documentSnap.data();
      const settled = cents(documentData.settlementSummary?.settledAmount);
      const total = cents(documentData.totalAmount);
      if (!["confirmed", "completed"].includes(documentData.status) || !Number.isFinite(settled) || !Number.isFinite(total)
        || settled < amount || settled > total || text(documentData.cariId || documentData.cariSnapshot?.id) !== cariId
        || cash.direction !== (cash.documentCollection === ERP_COLLECTIONS.SALES ? "in" : "out")) throw new Error("Faturanın ödeme bakiyesi doğrulanamadı; sayfayı yenileyin.");
      const nextSettled = settled - amount;
      const status = nextSettled === 0 ? "open" : "partial";
      documentPatch = { paymentStatus: status, settlementSummary: { invoiceAmount: total / 100, settledAmount: nextSettled / 100, outstandingAmount: (total - nextSettled) / 100, status } };
      if (documentData.payment?.receiptNo === cash.receiptNo || documentData.settlementId === settlement.id) {
        documentPatch.payment = { ...documentData.payment, enabled: false, paidAmount: 0 };
        documentPatch.originalPaymentBeforeCancellation = documentData.originalPaymentBeforeCancellation || documentData.payment || null;
      }
    } else if (cash.advanceFromCancellation && cash.originalDocumentId) {
      if (![ERP_COLLECTIONS.SALES, ERP_COLLECTIONS.PURCHASES].includes(cash.originalDocumentCollection)) throw new Error("Avansın kaynak faturası doğrulanamadı.");
      documentRef = doc(db, cash.originalDocumentCollection, cash.originalDocumentId);
      const origin = await transaction.get(documentRef);
      if (!origin.exists() || !inactive(origin.data()) || cents(origin.data().retainedAdvanceAmount) < amount) throw new Error("İptal edilen faturanın avans bakiyesi doğrulanamadı.");
      documentData = origin.data();
      documentPatch = { retainedAdvanceAmount: (cents(documentData.retainedAdvanceAmount) - amount) / 100,
        cancelledAdvanceAmount: (cents(documentData.cancelledAdvanceAmount) + amount) / 100 };
    }
    const oldBalance = cents(account.currentBalance ?? account.openingBalance);
    if (!Number.isFinite(oldBalance)) throw new Error("Hesap bakiyesi geçersiz.");
    const audit = { status: "cancelled", cancellationReason, cancelledAt: serverTimestamp(), cancelledBy: user.uid,
      cancelledByName: user.displayName || user.email || user.uid, updatedAt: serverTimestamp(), cancelledCashMovementId: movementId };
    transaction.set(cashRef, audit, { merge: true });
    if (cari) transaction.set(cari.ref, audit, { merge: true });
    if (settlement) transaction.set(settlement.ref, audit, { merge: true });
    transaction.set(accountRef, { currentBalance: (oldBalance + (cash.direction === "in" ? -amount : amount)) / 100, updatedAt: serverTimestamp() }, { merge: true });
    if (documentRef) transaction.set(documentRef, { ...documentPatch, updatedAt: serverTimestamp() }, { merge: true });
    return { id: movementId, receiptNo: cash.receiptNo };
  });
}
