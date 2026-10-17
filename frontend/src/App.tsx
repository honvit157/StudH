import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import SessionPage from './pages/SessionPage';
import LearningPathPage from './pages/LearningPathPage';
import SchedulePage from './pages/SchedulePage';
import StatsPage from './pages/StatsPage';
import { apiRequest } from './api/client';
import { Flame, Sparkles, BookOpen, MapPin, BarChart3, Calendar, Play } from 'lucide-react';

type Tab = 'home' | 'path' | 'schedule' | 'stats';

function AppContent() {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [inSession, setInSession] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [course, setCourse] = useState<any>(null);

  const refreshData = async () => {
    try {
      const [statsRes, coursesRes] = await Promise.all([
        apiRequest<any>('/api/stats').catch(() => null),
        apiRequest<any[]>('/api/courses').catch(() => []),
      ]);
      if (statsRes) setStats(statsRes);
      if (coursesRes && coursesRes.length > 0) setCourse(coursesRes[0]);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshData();
    }
  }, [isAuthenticated, inSession]);

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

  if (inSession) {
    return (
      <SessionPage
        onFinish={() => {
          setInSession(false);
          refreshData();
        }}
        onExit={() => setInSession(false)}
      />
    );
  }

  const streak = stats?.streak ?? 1;
  const xp = stats?.xp ?? 20;
  const xpToday = stats?.xpToday ?? 0;
  const dailyGoalXp = stats?.dailyGoalXp ?? 20;
  const goalPercent = Math.min(100, Math.round((xpToday / Math.max(1, dailyGoalXp)) * 100));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-duo-dark text-slate-800 dark:text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-duo-dark-card/90 backdrop-blur border-b border-slate-200 dark:border-duo-dark-border px-4 py-3 flex items-center justify-between max-w-lg mx-auto w-full">
        <div className="flex items-center space-x-2">
          <span className="text-xl font-black text-duo-green tracking-tight">StudyApp</span>
        </div>

        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Streak indicator */}
          <div className="flex items-center space-x-1 font-black text-orange-500 text-xs sm:text-sm">
            <Flame className="w-5 h-5 fill-orange-500" />
            <span>{streak}</span>
          </div>

          {/* XP indicator */}
          <div className="flex items-center space-x-1 font-black text-amber-500 text-xs sm:text-sm">
            <Sparkles className="w-5 h-5 fill-amber-500" />
            <span>{xp} XP</span>
          </div>

          <button
            onClick={logout}
            className="text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-duo-dark-border text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-lg mx-auto w-full p-4 pb-28">
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* Course Card Banner */}
            <div className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-duo-blue">Khóa học hiện tại</span>
                  <h2 className="text-xl font-black text-slate-800 dark:text-white mt-0.5">
                    {course?.title || 'Kiến Thức Lập Trình Web & Thuật Toán'}
                  </h2>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-duo-blue flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-6 h-6" />
                </div>
              </div>

              {stats?.daysUntilExam > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-6">
                  Đếm ngược: Còn <strong>{stats.daysUntilExam} ngày</strong> tới kỳ thi. Đã sẵn sàng theo lịch ôn SRS.
                </p>
              )}

              {/* Nút lớn Học hôm nay */}
              <button
                onClick={() => setInSession(true)}
                className="w-full py-4 px-6 rounded-2xl font-black text-white uppercase tracking-wider text-sm flex items-center justify-center space-x-2 btn-duo-green"
              >
                <Play className="w-5 h-5 fill-white" />
                <span>Học hôm nay (Phiên học mới)</span>
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-2xl p-4">
                <span className="text-xs font-bold text-slate-400 uppercase">Mục tiêu hôm nay</span>
                <div className="text-lg font-black text-slate-800 dark:text-white mt-1">
                  {xpToday} / {dailyGoalXp} XP
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-duo-green rounded-full transition-all duration-300" style={{ width: `${goalPercent}%` }}></div>
                </div>
              </div>

              <div className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-2xl p-4">
                <span className="text-xs font-bold text-slate-400 uppercase">Đã nhớ vững</span>
                <div className="text-lg font-black text-emerald-600 mt-1">
                  {stats?.masteredItemsCount ?? 0} Item (≥21d)
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Thuật toán SM-2 Spaced Repetition</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'path' && (
          <LearningPathPage onStartLesson={() => setInSession(true)} />
        )}

        {activeTab === 'schedule' && (
          <SchedulePage />
        )}

        {activeTab === 'stats' && (
          <StatsPage />
        )}
      </main>

      {/* Bottom Navigation Bar (Mobile-first) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-duo-dark-card/95 backdrop-blur border-t-2 border-slate-200 dark:border-duo-dark-border z-30">
        <div className="max-w-lg mx-auto flex items-center justify-around py-2">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center p-2 font-bold text-[11px] transition-colors ${
              activeTab === 'home' ? 'text-duo-green' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-5 h-5 mb-0.5" />
            <span>Trang chủ</span>
          </button>

          <button
            onClick={() => setActiveTab('path')}
            className={`flex flex-col items-center p-2 font-bold text-[11px] transition-colors ${
              activeTab === 'path' ? 'text-duo-green' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <MapPin className="w-5 h-5 mb-0.5" />
            <span>Đường học</span>
          </button>

          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex flex-col items-center p-2 font-bold text-[11px] transition-colors ${
              activeTab === 'schedule' ? 'text-duo-green' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <Calendar className="w-5 h-5 mb-0.5" />
            <span>Lịch học</span>
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center p-2 font-bold text-[11px] transition-colors ${
              activeTab === 'stats' ? 'text-duo-green' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-5 h-5 mb-0.5" />
            <span>Thống kê</span>
          </button>
        </div>
      </nav>
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
