import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Owner email gets the admin role by default on first sign-in/sign-up, regardless
// of which auth method (Google or email/password) they use.
const isAdminEmail = (email: string | null | undefined) => email === 'GajjarJay79@gmail.com';

const createDefaultProfile = (uid: string, email: string | null, displayName: string) => ({
  uid,
  email,
  displayName,
  role: isAdminEmail(email) ? 'admin' : 'investor',
  region: 'Global',
  currency: 'INR',
  createdAt: new Date().toISOString(),
});

type AuthModalTab = 'signin' | 'signup';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAuthReady: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  isAuthModalOpen: boolean;
  authModalTab: AuthModalTab;
  openAuthModal: (tab?: AuthModalTab) => void;
  closeAuthModal: () => void;
  setAuthModalTab: (tab: AuthModalTab) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<AuthModalTab>('signin');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data());
        } else {
          // Default to admin for the owner, investor for others. This fires for
          // every first-time sign-in regardless of provider (Google or email/password) —
          // signUpWithEmail below also writes this doc directly so the display name is
          // correct immediately, but this fallback covers Google sign-in and any edge
          // case where the doc write didn't happen yet.
          const newProfile = createDefaultProfile(user.uid, user.email, user.displayName || user.email?.split('@')[0] || 'User');
          await setDoc(docRef, newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
    await signInWithPopup(auth, new GoogleAuthProvider());
    setIsAuthModalOpen(false);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    await signInWithEmailAndPassword(auth, email, password);
    setIsAuthModalOpen(false);
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const name = displayName.trim() || email.split('@')[0];
    await updateProfile(cred.user, { displayName: name });
    // Write the profile doc ourselves (rather than relying solely on the
    // onAuthStateChanged fallback above) so the display name is correct from the
    // very first render instead of a generic placeholder.
    const newProfile = createDefaultProfile(cred.user.uid, email, name);
    await setDoc(doc(db, 'users', cred.user.uid), newProfile);
    setProfile(newProfile);
    setIsAuthModalOpen(false);
  };

  const resetPassword = async (email: string) => {
    const { sendPasswordResetEmail } = await import('firebase/auth');
    await sendPasswordResetEmail(auth, email);
  };

  const signOutUser = async () => {
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
  };

  const openAuthModal = (tab: AuthModalTab = 'signin') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => setIsAuthModalOpen(false);

  return (
    <AuthContext.Provider value={{
      user, profile, loading, isAuthReady,
      signIn, signOut: signOutUser, signInWithEmail, signUpWithEmail, resetPassword,
      isAuthModalOpen, authModalTab, openAuthModal, closeAuthModal, setAuthModalTab,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
