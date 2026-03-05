// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Firestore Utilities
// Generic CRUD wrappers for Firestore operations
// ═══════════════════════════════════════════════════════════

import {
  doc,
  getDoc as firestoreGetDoc,
  setDoc as firestoreSetDoc,
  updateDoc as firestoreUpdateDoc,
  deleteDoc as firestoreDeleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Get a single document
 */
export async function getDocument<T>(
  collectionName: string,
  docId: string
): Promise<T | null> {
  const docRef = doc(db, collectionName, docId);
  const docSnap = await firestoreGetDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as T;
  }
  return null;
}

/**
 * Set (create or overwrite) a document
 */
export async function setDocument(
  collectionName: string,
  docId: string,
  data: DocumentData
): Promise<void> {
  const docRef = doc(db, collectionName, docId);
  await firestoreSetDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update specific fields in a document
 */
export async function updateDocument(
  collectionName: string,
  docId: string,
  data: DocumentData
): Promise<void> {
  const docRef = doc(db, collectionName, docId);
  await firestoreUpdateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a document
 */
export async function deleteDocument(
  collectionName: string,
  docId: string
): Promise<void> {
  const docRef = doc(db, collectionName, docId);
  await firestoreDeleteDoc(docRef);
}

/**
 * Query a collection with constraints
 */
export async function queryCollection<T>(
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  const colRef = collection(db, collectionName);
  const q = query(colRef, ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

/**
 * Listen to a document in real-time
 */
export function listenToDocument<T>(
  collectionName: string,
  docId: string,
  callback: (data: T | null) => void
): Unsubscribe {
  const docRef = doc(db, collectionName, docId);
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() } as T);
    } else {
      callback(null);
    }
  });
}

/**
 * Listen to a collection query in real-time
 */
export function listenToCollection<T>(
  collectionName: string,
  constraints: QueryConstraint[],
  callback: (data: T[]) => void
): Unsubscribe {
  const colRef = collection(db, collectionName);
  const q = query(colRef, ...constraints);
  return onSnapshot(q, (snapshot) => {
    const results = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
    callback(results);
  });
}

// Re-export query helpers for convenience
export { where, orderBy, limit, collection, serverTimestamp };
