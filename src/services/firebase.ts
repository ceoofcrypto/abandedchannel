import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import appletFirebaseConfig from '../../firebase-applet-config.json';
import { isAdminEmailAuthorized } from '../utils/channels.ts';

export const firebaseConfig = {
  apiKey: "AIzaSyCjmIsI4tcICSN01NO5u-chnuoxJBkeBP8",
  authDomain: "gen-lang-client-0781064726.firebaseapp.com",
  projectId: "gen-lang-client-0781064726",
  storageBucket: "gen-lang-client-0781064726.firebasestorage.app",
  messagingSenderId: "954807239586",
  appId: "1:954807239586:web:f082194d98ccc5870728fb"
};

export const FIRESTORE_DATABASE_ID =
  appletFirebaseConfig.firestoreDatabaseId || 'ai-studio-taskflow-59a83876-7941-4fb2-aa18-6eaf8796f970';

// Initialize Firebase SDK with the provided firebaseConfig
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app, FIRESTORE_DATABASE_ID);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function validateFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'settings', 'public'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export interface GoogleAdminAuthPayload {
  email: string;
  name: string;
  uid: string;
  idToken: string;
  photoURL: string | null;
}

/**
 * Initiates Firebase Google Sign-In popup and strictly verifies that the authenticated
 * Google account is the authorized administrator. Immediately signs out any other account.
 */
export async function signInWithGoogleAdminPopup(): Promise<GoogleAdminAuthPayload> {
  const credential = await signInWithPopup(auth, googleProvider);
  const user = credential.user;
  const email = user.email?.trim().toLowerCase() || '';

  if (!isAdminEmailAuthorized(email)) {
    await signOut(auth);
    throw new Error('Unauthorized account. Access denied.');
  }

  const idToken = await user.getIdToken();
  return {
    email,
    name: user.displayName || 'Administrator',
    uid: user.uid,
    idToken,
    photoURL: user.photoURL,
  };
}

export async function signOutFirebaseAdmin(): Promise<void> {
  try {
    await signOut(auth);
  } catch {
    // Ignore sign-out errors
  }
}

export { onAuthStateChanged };
export type { User };
export default app;
