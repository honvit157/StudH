import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import SessionPage from './pages/SessionPage';
import LearningPathPage from './pages/LearningPathPage';
import SchedulePage from './pages/SchedulePage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';
import CreateCourseModal from './pages/CreateCourseModal';
import { apiRequest } from './api/client';
import { Flame, Sparkles, BookOpen, MapPin, BarChart3, Calendar, Play, Plus, UploadCloud, Settings, ChevronDown, Trash2 } from 'lucide-react';

type Tab = 'home' | 'path' | 'schedule' | 'stats' | 'settings';

function AppContent() {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [inSession, setInSession] = useState(false);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [coursesList, setCoursesList] = useState<any[]>([]);
  const [course, setCourse] = useState<any>(null);
  const [firstReadyLesson, setFirstReadyLesson] = useState<{ id: string; title: string } | null>(null);

  const refreshData = async () => {
    try {
      const [statsRes, coursesRes] = await Promise.all([
        apiRequest<any>('/api/stats').catch(() => null),
        apiRequest<any[]>('/api/courses').catch(() => []),
      ]);
      if (statsRes) setStats(statsRes);
      const list = coursesRes || [];
      setCoursesList(list);

      let selectedCourse = null;
      const savedCourseId = localStorage.getItem('studyapp_active_course_id');
      if (savedCourseId && list.length > 0) {
        selectedCourse = list.find((c: any) => c.id === savedCourseId);
      }
      if (!selectedCourse && list.length > 0) {
        selectedCourse = list[0];
      }
      setCourse(selectedCourse);

      if (selectedCourse) {
        try {
          const pathRes = await apiRequest<any>(`/api/courses/${selectedCourse.id}/path`);
          if (pathRes?.units) {
            const allLessons = pathRes.units.flatMap((u: any) => u.sections).flatMap((s: any) => s.lessons);
            const readyLesson = allLessons.find((l: any) => l.status === 'ready');
            if (readyLesson) {
              setFirstReadyLesson({ id: readyLesson.id, title: readyLesson.title });
            } else {
              setFirstReadyLesson(null);
            }
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        setFirstReadyLesson(null);
      }
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
        lessonId={currentLessonId}
        onFinish={() => {
          setInSession(false);
          setCurrentLessonId(null);
          refreshData();
        }}
        onExit={() => {
          setInSession(false);
          setCurrentLessonId(null);
        }}
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
          {coursesList.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setIsCourseDropdownOpen(!isCourseDropdownOpen)}
                className="flex items-center space-x-1 text-xs font-bold px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition max-w-[130px] sm:max-w-[170px]"
                title="Chọn môn học"
              >
                <span className="truncate">{course?.title || 'Chọn môn'}</span>
                <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
              </button>

              {isCourseDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-2xl shadow-xl p-2 z-50 space-y-1">
                  <div className="text-[10px] font-black uppercase text-slate-400 px-2 py-1">
                    Danh sách môn học ({coursesList.length})
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {coursesList.map((c) => {
                      const isActive = course?.id === c.id;
                      return (
                        <div
                          key={c.id}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer ${
                            isActive
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-duo-green font-black border border-emerald-200 dark:border-emerald-800'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold'
                          }`}
                          onClick={() => {
                            localStorage.setItem('studyapp_active_course_id', c.id);
                            setCourse(c);
                            setIsCourseDropdownOpen(false);
                            refreshData();
                          }}
                        >
                          <span className="truncate flex-1 pr-2">{c.title}</span>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm(`Xóa môn học "${c.title}"?`)) {
                                await apiRequest(`/api/courses/${c.id}`, { method: 'DELETE' });
                                if (localStorage.getItem('studyapp_active_course_id') === c.id) {
                                  localStorage.removeItem('studyapp_active_course_id');
                                }
                                refreshData();
                              }
                            }}
                            className="text-slate-300 hover:text-red-500 p-1 rounded-lg transition"
                            title="Xóa môn"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pt-1 border-t border-slate-100 dark:border-duo-dark-border">
                    <button
                      onClick={() => {
                        setIsCourseDropdownOpen(false);
                        setIsCreateModalOpen(true);
                      }}
                      className="w-full text-xs font-bold text-duo-green hover:bg-emerald-50 dark:hover:bg-emerald-950/40 p-2 rounded-xl flex items-center justify-center space-x-1.5 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm môn học mới</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2.5 sm:space-x-3">
          {/* New Course Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center space-x-1 text-xs font-bold px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tải tài liệu</span>
            <span className="sm:hidden">+</span>
          </button>

          {/* Streak indicator */}
          <div className="flex items-center space-x-1 font-black text-orange-500 text-xs sm:text-sm">
            <Flame className="w-4 h-4 sm:w-5 sm:h-5 fill-orange-500" />
            <span>{streak}</span>
          </div>

          {/* XP indicator */}
          <div className="flex items-center space-x-1 font-black text-amber-500 text-xs sm:text-sm">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-500" />
            <span>{xp} XP</span>
          </div>

          {/* Settings button */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`p-1.5 rounded-xl border transition ${
              activeTab === 'settings'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-duo-green text-duo-green'
                : 'border-slate-200 dark:border-duo-dark-border text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Cài đặt"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={logout}
            className="text-[11px] font-bold px-2 py-1.5 rounded-xl border border-slate-200 dark:border-duo-dark-border text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Thoát
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
                  <span className="text-xs font-bold uppercase tracking-wider text-duo-blue">Môn học đang chọn</span>
                  <h2 className="text-xl font-black text-slate-800 dark:text-white mt-0.5">
                    {course?.title || 'Chưa chọn môn học'}
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

              {/* Nút lớn Bắt đầu học */}
              <button
                onClick={() => {
                  if (firstReadyLesson) {
                    setCurrentLessonId(firstReadyLesson.id);
                  } else {
                    setCurrentLessonId(null);
                  }
                  setInSession(true);
                }}
                className="w-full py-4 px-6 rounded-2xl font-black text-white uppercase tracking-wider text-sm flex items-center justify-center space-x-2 btn-duo-green"
              >
                <Play className="w-5 h-5 fill-white" />
                <span className="truncate">
                  {firstReadyLesson ? `Học tiếp: ${firstReadyLesson.title}` : 'Học hôm nay (Phiên học mới)'}
                </span>
              </button>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-duo-dark-border flex justify-between items-center text-xs">
                <span className="text-slate-400">Muốn học môn khác?</span>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="font-bold text-duo-blue hover:underline flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tải lên tài liệu mới</span>
                </button>
              </div>
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
          <LearningPathPage
            courseId={course?.id}
            onCourseDeleted={refreshData}
            onStartLesson={(lessonId) => {
              setCurrentLessonId(lessonId);
              setInSession(true);
            }}
          />
        )}

        {activeTab === 'schedule' && (
          <SchedulePage />
        )}

        {activeTab === 'stats' && (
          <StatsPage />
        )}

        {activeTab === 'settings' && (
          <SettingsPage onLogout={logout} onRefreshAll={refreshData} />
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

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center p-2 font-bold text-[11px] transition-colors ${
              activeTab === 'settings' ? 'text-duo-green' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <Settings className="w-5 h-5 mb-0.5" />
            <span>Cài đặt</span>
          </button>
        </div>
      </nav>

      {/* Create Course Modal */}
      <CreateCourseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          refreshData();
          setActiveTab('path');
        }}
      />
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
