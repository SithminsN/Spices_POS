// Firebase app initialization. This is the only file that reads VITE_FIREBASE_*
// env vars -- see .env.example and docs/ARCHITECTURE.md "Firestore sync".
//
// No Firebase Auth here -- single-user personal app, no login, no shared
// data. Firestore security rules are correspondingly wide open (`allow
// read, write: if true`) rather than gated on a signed-in session. See
// docs/ARCHITECTURE.md "Security model" for the tradeoff.
import { initializeApp } from 'firebase/app'
import type { FirebaseApp } from 'firebase/app'
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let app: FirebaseApp | null = null
let firestoreDb: Firestore | null = null
let initError: string | null = null

try {
  app = initializeApp(firebaseConfig)
  // A persistent local cache means reads/writes apply instantly against the
  // on-device cache (working offline too) and sync to Firestore's servers
  // in the background -- this is what gives onSnapshot listeners
  // near-instant optimistic updates without any custom optimistic-UI code.
  firestoreDb = initializeFirestore(app, { localCache: persistentLocalCache() })
} catch (error) {
  // A missing/malformed config (e.g. a blank VITE_FIREBASE_API_KEY in
  // .env) makes these calls throw SYNCHRONOUSLY, not via a rejected
  // promise -- left uncaught, that crashes the whole app at module load,
  // before React ever runs. Catching it here and exposing it as
  // firebaseInitError lets AppDataContext turn it into the same graceful
  // "couldn't connect" error the rest of the app already handles.
  initError = error instanceof Error ? error.message : 'Failed to initialize Firebase.'
}

export const firebaseApp = app
export const db = firestoreDb
export const firebaseInitError = initError
