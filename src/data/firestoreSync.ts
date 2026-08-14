// Thin Firestore persistence helpers. AppDataContext.tsx is the only
// caller -- nothing else in the app talks to Firestore directly. See
// docs/ARCHITECTURE.md "Firestore sync" for how this fits together with
// the pure reducer in AppDataContext.tsx.
import { collection, doc, onSnapshot, writeBatch } from 'firebase/firestore'
import type { DocumentData } from 'firebase/firestore'
import { db, firebaseInitError } from './firebase'

export { firebaseInitError }

/**
 * Subscribes to every document in a collection; calls onData on the
 * initial load and every change. `db` is non-null here as long as
 * Firebase initialized successfully -- callers should check
 * `firebaseInitError` first (see AppDataContext.tsx).
 */
export function subscribeCollection<T>(collectionName: string, onData: (items: T[]) => void): () => void {
  return onSnapshot(collection(db!, collectionName), (snapshot) => {
    onData(snapshot.docs.map((d) => d.data() as T))
  })
}

interface WithId {
  id: string
}

/**
 * Writes/deletes only the given documents -- never the whole collection.
 * Callers are expected to have already diffed old vs new state (see
 * diff.ts) so a personal-scale ledger stays well inside Firestore's free
 * daily read/write quota as transaction history grows.
 */
export async function syncCollection<T extends WithId>(
  collectionName: string,
  toWrite: T[],
  toDeleteIds: string[],
): Promise<void> {
  if (toWrite.length === 0 && toDeleteIds.length === 0) return
  const batch = writeBatch(db!)
  for (const item of toWrite) {
    batch.set(doc(db!, collectionName, item.id), item as DocumentData)
  }
  for (const id of toDeleteIds) {
    batch.delete(doc(db!, collectionName, id))
  }
  await batch.commit()
}
