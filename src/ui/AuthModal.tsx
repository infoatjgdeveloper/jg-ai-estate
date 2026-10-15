import * as React from 'react';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../AuthContext';
import { input, label } from './kit';

const niceError = (e: any) => {
  const c = String(e?.code || '');
  if (c.includes('wrong-password') || c.includes('invalid-credential')) return 'Email or password is not right.';
  if (c.includes('user-not-found')) return 'No account with that email. Try creating one.';
  if (c.includes('email-already-in-use')) return 'That email already has an account. Try signing in.';
  if (c.includes('weak-password')) return 'Use a password with at least 6 characters.';
  if (c.includes('popup-closed')) return '';
  return 'Something went wrong. Please try again.';
};

export default function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, authModalTab, setAuthModalTab, signIn, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const signup = authModalTab === 'signup';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setMsg('');
    try { await fn(); } catch (e) { setMsg(niceError(e)); }
    setBusy(false);
  };

  return (
    <AnimatePresence>
      {isAuthModalOpen && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeAuthModal}>
          <motion.div onClick={(e) => e.stopPropagation()} initial={{ y: 24, scale: 0.97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ type: 'spring', damping: 24, stiffness: 260 }} className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl">
            <h2 className="font-serif text-2xl font-semibold text-brand-800">{signup ? 'Create your account' : 'Welcome back'}</h2>
            <p className="mt-1 text-sm font-medium text-stone-500">{signup ? 'Builders and buyers both start here.' : 'Sign in to continue.'}</p>
            <button onClick={() => run(signIn)} disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-full bg-white py-2.5 text-sm font-bold text-stone-800 ring-1 ring-stone-300 transition hover:bg-stone-50 disabled:opacity-50">
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
              Continue with Google
            </button>
            <div className="my-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-stone-400"><span className="h-px flex-1 bg-stone-200" />or<span className="h-px flex-1 bg-stone-200" /></div>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => (signup ? signUpWithEmail(email, password, name) : signInWithEmail(email, password))); }}>
              {signup && <div><span className={label}>Your name</span><input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>}
              <div><span className={label}>Email</span><input className={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
              <div><span className={label}>Password</span><input className={input} type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={signup ? 'new-password' : 'current-password'} /></div>
              {msg && <p className="text-xs font-bold text-red-600">{msg}</p>}
              <button disabled={busy} className="w-full rounded-full bg-brand-600 py-3 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50">{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}</button>
            </form>
            <div className="mt-4 flex items-center justify-between text-xs font-bold text-stone-500">
              <button onClick={() => setAuthModalTab(signup ? 'signin' : 'signup')} className="underline">{signup ? 'I already have an account' : 'Create an account'}</button>
              {!signup && <button onClick={() => email ? run(async () => { await resetPassword(email); setMsg('Reset link sent. Check your email.'); }) : setMsg('Type your email first.')} className="underline">Forgot password?</button>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
