import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';

function AppContent() {
  const { isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-duo-dark">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-duo-green border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-slate-500">Đang tải StudyApp...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-duo-dark text-slate-800 dark:text-slate-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-duo-dark-card/90 backdrop-blur border-b border-slate-200 dark:border-duo-dark-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xl font-black text-duo-green">StudyApp</span>
        </div>
        <button
          onClick={logout}
          className="text-xs font-bold px-3 py-1.5 rounded-xl border-2 border-slate-200 dark:border-duo-dark-border text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          Đăng xuất
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-lg mx-auto w-full p-4 pb-24">
        <Routes>
          <Route path="/" element={<HomePlaceholder />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function HomePlaceholder() {
  return (
    <div className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-6 text-center shadow-sm mt-4">
      <div className="text-4xl mb-3">🦉</div>
      <h2 className="text-xl font-black text-slate-800 dark:text-white">Chào mừng bạn đến với StudyApp!</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
        Hệ thống monorepo, xác thực mật khẩu qua Cookie HttpOnly và bảo mật đã hoạt động.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
