import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { Lock, Check, Star, Play, Sparkles, BookOpen, Unlock, Zap, X, AlertCircle } from 'lucide-react';

interface Lesson {
  id: string;
  sortOrder: number;
  title: string;
  status: 'locked' | 'ready' | 'generating' | 'done';
  scheduledDate?: string;
  bestScore?: number;
  itemCount: number;
}

interface Section {
  id: string;
  sortOrder: number;
  title: string;
  lessons: Lesson[];
}

interface Unit {
  id: string;
  sortOrder: number;
  title: string;
  sections: Section[];
}

interface PathData {
  courseId: string;
  courseTitle: string;
  examDate?: string;
  dailyMinutes: number;
  units: Unit[];
}

interface LearningPathPageProps {
  onStartLesson: (lessonId: string) => void;
}

export default function LearningPathPage({ onStartLesson }: LearningPathPageProps) {
  const [pathData, setPathData] = useState<PathData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlockModalLesson, setUnlockModalLesson] = useState<Lesson | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadPath = async () => {
    try {
      const courses = await apiRequest<any[]>('/api/courses');
      if (courses.length > 0) {
        const res = await apiRequest<PathData>(`/api/courses/${courses[0].id}/path`);
        setPathData(res);
      }
    } catch (err) {
      console.error('Lỗi khi tải đường học:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPath();
  }, []);

  const handleUnlockSingle = async (lesson: Lesson) => {
    try {
      setUnlocking(true);
      await apiRequest(`/api/lessons/${lesson.id}/unlock`, { method: 'POST' });
      setUnlockModalLesson(null);
      await loadPath();
      onStartLesson(lesson.id);
    } catch (e: any) {
      console.error(e);
      alert('Không thể mở khóa bài học: ' + (e.message || 'Lỗi mạng'));
    } finally {
      setUnlocking(false);
    }
  };

  const handleUnlockAll = async () => {
    if (!pathData) return;
    try {
      setUnlocking(true);
      const res = await apiRequest<any>(`/api/courses/${pathData.courseId}/unlock-all`, { method: 'POST' });
      setMessage(res.message || 'Đã mở khóa toàn bộ bài học thành công!');
      setTimeout(() => setMessage(null), 4000);
      await loadPath();
    } catch (e: any) {
      console.error(e);
      alert('Không thể mở khóa lộ trình: ' + (e.message || 'Lỗi mạng'));
    } finally {
      setUnlocking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="w-10 h-10 border-4 border-duo-green border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-400">Đang tải đường học Duolingo...</p>
      </div>
    );
  }

  if (!pathData || pathData.units.length === 0) {
    return (
      <div className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-8 text-center mt-6">
        <div className="text-4xl mb-3">🗺️</div>
        <h3 className="text-lg font-black text-slate-800 dark:text-white">Chưa có bài học trong lộ trình</h3>
        <p className="text-xs text-slate-400 mt-1">Hãy tải tài liệu lên để hệ thống sinh lộ trình học tập thông minh.</p>
      </div>
    );
  }

  // Thu thập thống kê bài học
  const allLessons = pathData.units.flatMap(u => u.sections).flatMap(s => s.lessons);
  const totalLessonsCount = allLessons.length;
  const doneLessonsCount = allLessons.filter(l => l.status === 'done').length;
  const progressPercent = totalLessonsCount > 0 ? Math.round((doneLessonsCount / totalLessonsCount) * 100) : 0;
  const firstActiveReadyLessonId = allLessons.find(l => l.status === 'ready')?.id;
  const hasLockedLessons = allLessons.some(l => l.status === 'locked');

  return (
    <div className="space-y-6 pb-12">
      {/* Course Header Banner */}
      <div className="bg-duo-green text-white p-6 rounded-3xl shadow-duo-green relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-100 bg-emerald-700/50 px-2.5 py-1 rounded-lg">
              Lộ trình học Duolingo
            </span>
            <span className="text-xs font-black text-emerald-100">
              {doneLessonsCount}/{totalLessonsCount} bài ({progressPercent}%)
            </span>
          </div>

          <h1 className="text-xl font-black">{pathData.courseTitle}</h1>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-emerald-800/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Quick Actions */}
          {hasLockedLessons && (
            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-emerald-100 font-medium">Học tuần tự hoặc mở khóa tự do:</span>
              <button
                onClick={handleUnlockAll}
                disabled={unlocking}
                className="text-xs font-black bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl flex items-center space-x-1.5 backdrop-blur transition active:scale-95"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Mở khóa tất cả bài</span>
              </button>
            </div>
          )}
        </div>
        <div className="absolute -right-4 -bottom-6 text-emerald-300 opacity-20 text-9xl font-black select-none pointer-events-none">
          🦉
        </div>
      </div>

      {/* Thông báo thông tin */}
      {message && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-2xl text-xs font-bold flex items-center space-x-2">
          <Zap className="w-4 h-4 flex-shrink-0 text-duo-green" />
          <span>{message}</span>
        </div>
      )}

      {/* Units List */}
      {pathData.units.map((unit) => (
        <div key={unit.id} className="space-y-6">
          {/* Unit Header Banner */}
          <div className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-duo-blue uppercase tracking-wider">Chương {unit.sortOrder}</span>
              <h2 className="text-base font-black text-slate-800 dark:text-white mt-0.5">{unit.title}</h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-duo-blue flex items-center justify-center font-black text-sm">
              {unit.sortOrder}
            </div>
          </div>

          {/* Sections & Vertical Duolingo Nodes */}
          {unit.sections.map((section) => (
            <div key={section.id} className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pl-2">
                {section.title}
              </h3>

              {/* Vertical Path Connector */}
              <div className="flex flex-col items-center space-y-6 py-2 relative">
                {section.lessons.map((lesson, lIdx) => {
                  const isDone = lesson.status === 'done';
                  const isReady = lesson.status === 'ready';
                  const isLocked = lesson.status === 'locked';
                  // Chỉ cho bài học ĐẦU TIÊN đang ready nhún nhảy (authentic Duolingo feeling)
                  const isCurrentActive = lesson.id === firstActiveReadyLessonId;

                  // Zig-zag offset for authentic Duolingo feeling
                  const offsets = ['translate-x-0', '-translate-x-6', 'translate-x-6', 'translate-x-0'];
                  const offsetClass = offsets[lIdx % offsets.length];

                  return (
                    <div key={lesson.id} className={`flex flex-col items-center ${offsetClass} transition-transform`}>
                      <button
                        onClick={() => {
                          if (isLocked) {
                            setUnlockModalLesson(lesson);
                          } else {
                            onStartLesson(lesson.id);
                          }
                        }}
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all relative ${
                          isDone
                            ? 'bg-amber-400 text-white shadow-duo border-4 border-amber-300 hover:scale-105 active:scale-95'
                            : isReady && isCurrentActive
                            ? 'bg-duo-green text-white shadow-duo-green border-4 border-emerald-300 animate-bounce cursor-pointer'
                            : isReady
                            ? 'bg-duo-green text-white shadow-duo-green border-4 border-emerald-300 hover:scale-105 active:scale-95 cursor-pointer'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-duo hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer'
                        }`}
                        title={isLocked ? 'Bấm để mở khóa học vượt' : lesson.title}
                      >
                        {isDone ? (
                          <Check className="w-8 h-8 stroke-[3]" />
                        ) : isReady ? (
                          <Play className="w-7 h-7 fill-white ml-0.5" />
                        ) : (
                          <Lock className="w-6 h-6" />
                        )}

                        {/* Stars badge for finished lessons */}
                        {isDone && (
                          <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1 border-2 border-white dark:border-duo-dark-card">
                            <Star className="w-3 h-3 fill-white" />
                          </div>
                        )}

                        {/* Indicator tag for currently active lesson */}
                        {isCurrentActive && (
                          <div className="absolute -top-7 bg-duo-green text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border border-emerald-200 shadow-sm animate-pulse whitespace-nowrap">
                            BẮT ĐẦU
                          </div>
                        )}
                      </button>

                      <div className="mt-2 text-center max-w-[140px]">
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300 line-clamp-1">
                          {lesson.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium block">
                          {isDone ? (
                            <span className="text-amber-500 font-bold">Điểm: {lesson.bestScore ?? 100}%</span>
                          ) : isReady ? (
                            <span className="text-emerald-600 font-bold">Sẵn sàng học</span>
                          ) : (
                            <span className="text-slate-400">Khóa (Bấm mở)</span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Modal Mở khóa học vượt */}
      {unlockModalLesson && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center font-black">
                <Unlock className="w-5 h-5" />
              </div>
              <button
                onClick={() => setUnlockModalLesson(null)}
                className="p-1 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-white">
                Mở khóa bài học sớm?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Bài học <strong>"{unlockModalLesson.title}"</strong> được xếp lịch theo thuật toán ngắt quãng. Bạn có thể mở khóa để học trước ngay bây giờ.
              </p>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setUnlockModalLesson(null)}
                className="flex-1 py-3 rounded-2xl border-2 border-slate-200 dark:border-duo-dark-border font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50"
              >
                Để sau
              </button>
              <button
                disabled={unlocking}
                onClick={() => handleUnlockSingle(unlockModalLesson)}
                className="flex-1 py-3 rounded-2xl bg-duo-green text-white font-black text-xs btn-duo-green flex items-center justify-center space-x-1"
              >
                {unlocking ? (
                  <span>Đang mở...</span>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-white" />
                    <span>Học vượt ngay</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
