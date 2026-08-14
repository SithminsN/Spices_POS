// Thin Firestore persistence helpers. AppDataContext.tsx is the only
// caller -- nothing else in the app talks to Firestore directly. See
// docs/ARCHITECTURE.md "Firestore sync" for how this fits together with
// the pure reducer in AppDataContext.tsx.
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { collection, doc, onSnapshot, writeBatch } from 'firebase/firestore'
import type { DocumentData } from 'firebase/firestore'
import { auth, db, firebaseInitError } from './firebase'

/**
 * Resolves once an (anonymous) auth session exists. Required before any
 * Firestore call -- the security rules require request.auth != null. This
 * never shows a login screen: sign-in happens silently in the background.
 *
 * If Firebase failed to initialize (bad/missing .env values), rejects
 * immediately with that error instead of touching `auth` -- everything
 * below this point assumes initialization succeeded, so `auth`/`db` are
 * asserted non-null rather than re-checked everywhere they're used.
 */
export function ensureAuthenticated(): Promise<void> {
  if (firebaseInitError) return Promise.reject(new Error(firebaseInitError))

  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth!,
      (user) => {
        if (user) {
          unsubscribe()
          resolve()
        }
      },
      reject,
    )
    if (!auth!.currentUser) {
      signInAnonymously(auth!).catch(reject)
    }
  })
}

/**
 * Subscribes to every document in a collection; calls onData on the
 * initial load and every change. Only ever called after
 * ensureAuthenticated() has resolved (see AppDataContext.tsx), so `db` is
 * guaranteed non-null here.
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
 * daily read/write quota as transaction history grows. Only ever called
 * after ensureAuthenticated() has resolved, so `db` is guaranteed non-null.
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
