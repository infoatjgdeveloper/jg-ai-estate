import * as React from 'react';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import AuthModal from './ui/AuthModal';

const Home = lazy(() => import('./studio/Home'));
const BuilderPage = lazy(() => import('./studio/BuilderPage'));
const TourPage = lazy(() => import('./studio/TourPage'));
const Studio = lazy(() => import('./studio/Studio'));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="grid min-h-screen place-items-center bg-night text-sm font-bold text-white/70">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/builders/:id" element={<BuilderPage />} />
            <Route path="/tour/:id" element={<TourPage />} />
            <Route path="/studio/*" element={<Studio />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <AuthModal />
    </AuthProvider>
  );
}
