import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { GoogleUserProfile } from '../types';

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
provider.addScope('https://www.googleapis.com/auth/userinfo.email');

let isSigningIn = false;
// Token guardado únicamente en memoria (nunca en localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

async function fetchGooglePeopleAvatar(accessToken: string, firebaseUser: User): Promise<GoogleUserProfile> {
  let displayName = firebaseUser.displayName || 'Usuario de Google';
  let email = firebaseUser.email || '';
  let photoUrl = firebaseUser.photoURL || null;

  try {
    const res = await fetch(
      'https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,photos',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    if (res.ok) {
      const data = (await res.json()) as {
        names?: Array<{ displayName?: string }>;
        emailAddresses?: Array<{ value?: string }>;
        photos?: Array<{ url?: string; default?: boolean }>;
      };

      const apiName = data.names?.[0]?.displayName;
      const apiEmail = data.emailAddresses?.[0]?.value;
      const apiPhoto = data.photos?.find((p) => p.url && !p.default)?.url || data.photos?.[0]?.url;

      if (apiName) displayName = apiName;
      if (apiEmail) email = apiEmail;
      if (apiPhoto) photoUrl = apiPhoto;
    }
  } catch {
    // Fallback automático a los datos básicos de Firebase Auth si la consulta falla
  }

  return {
    uid: firebaseUser.uid,
    displayName,
    email,
    photoUrl
  };
}

export function initGoogleAuth(
  onUserSignedIn: (profile: GoogleUserProfile) => void,
  onUserSignedOut: () => void
): () => void {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        const profile = await fetchGooglePeopleAvatar(cachedAccessToken, user);
        onUserSignedIn(profile);
      } else if (!isSigningIn) {
        // Sesión persistente de Firebase Auth: usa photoURL real de Google sin almacenar token en localStorage
        onUserSignedIn({
          uid: user.uid,
          displayName: user.displayName || 'Usuario de Google',
          email: user.email || '',
          photoUrl: user.photoURL || null
        });
      }
    } else {
      cachedAccessToken = null;
      onUserSignedOut();
    }
  });
}

export async function signInWithGoogle(): Promise<GoogleUserProfile> {
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      return await fetchGooglePeopleAvatar(cachedAccessToken, result.user);
    }
    return {
      uid: result.user.uid,
      displayName: result.user.displayName || 'Usuario de Google',
      email: result.user.email || '',
      photoUrl: result.user.photoURL || null
    };
  } finally {
    isSigningIn = false;
  }
}

export async function signOutGoogle(): Promise<void> {
  cachedAccessToken = null;
  await signOut(auth);
}

export function getGoogleAccessToken(): string | null {
  return cachedAccessToken;
}
