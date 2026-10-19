import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { 
  Lock, Check, Star, Play, Sparkles, BookOpen, Unlock, Zap, X, 
  Trash2, ShieldCheck, Flame, Layers, ToggleLeft, ToggleRight 
} from 'lucide-react';
import { playTapSound, playToggleSound, triggerHaptic } from '../utils/sound';

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
  courseId?: string;
  onCourseDeleted?: () => void;
}

// BẢNG MÀU SẮC CHỦ ĐẠO TỪNG CHƯƠNG (Xóa bỏ sự đơn điệu một màu xanh)
const CHAPTER_THEMES: Record<number, {
  name: string;
  icon: string;
  headerGradient: string;
  bannerBorder: string;
  badgeBg: string;
  badgeText: string;
  nodeReadyBg: string;
  nodeReadyBorder: string;
  nodeReadyShadow: string;
  activeRing: string;
  accentText: string;
  tagBg: string;
}> = {
  1: {
    name: 'Tổng quan Mạng & Internet',
    icon: '🌐',
    headerGradient: 'from-emerald-500 via-emerald-600 to-teal-600',
    bannerBorder: 'border-emerald-400/40',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    nodeReadyBg: 'bg-emerald-500 hover:bg-emerald-400',
    nodeReadyBorder: 'border-emerald-300 dark:border-emerald-400',
    nodeReadyShadow: 'shadow-[0_6px_0_#047857]',
    activeRing: 'ring-emerald-400',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    tagBg: 'bg-emerald-500 text-white',
  },
  2: {
    name: 'Tầng Data Link & Switch',
    icon: '⚡',
    headerGradient: 'from-sky-500 via-sky-600 to-blue-600',
    bannerBorder: 'border-sky-400/40',
    badgeBg: 'bg-sky-50 dark:bg-sky-950/60',
    badgeText: 'text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    nodeReadyBg: 'bg-sky-500 hover:bg-sky-400',
    nodeReadyBorder: 'border-sky-300 dark:border-sky-400',
    nodeReadyShadow: 'shadow-[0_6px_0_#0369a1]',
    activeRing: 'ring-sky-400',
    accentText: 'text-sky-600 dark:text-sky-400',
    tagBg: 'bg-sky-500 text-white',
  },
  3: {
    name: 'Tầng Mạng, IP & Định tuyến',
    icon: '🧭',
    headerGradient: 'from-purple-500 via-indigo-600 to-violet-600',
    bannerBorder: 'border-purple-400/40',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/60',
    badgeText: 'text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    nodeReadyBg: 'bg-purple-500 hover:bg-purple-400',
    nodeReadyBorder: 'border-purple-300 dark:border-purple-400',
    nodeReadyShadow: 'shadow-[0_6px_0_#6d28d9]',
    activeRing: 'ring-purple-400',
    accentText: 'text-purple-600 dark:text-purple-400',
    tagBg: 'bg-purple-500 text-white',
  },
  4: {
    name: 'Tầng Giao vận & TCP/UDP',
    icon: '🚀',
    headerGradient: 'from-amber-500 via-orange-500 to-amber-600',
    bannerBorder: 'border-amber-400/40',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    nodeReadyBg: 'bg-amber-500 hover:bg-amber-400',
    nodeReadyBorder: 'border-amber-300 dark:border-amber-400',
    nodeReadyShadow: 'shadow-[0_6px_0_#b45309]',
    activeRing: 'ring-amber-400',
    accentText: 'text-amber-600 dark:text-amber-400',
    tagBg: 'bg-amber-500 text-white',
  },
  5: {
    name: '5 Bộ Đề Thi Tổng Hợp Toàn Diện',
    icon: '🏆',
    headerGradient: 'from-rose-500 via-pink-600 to-amber-500',
    bannerBorder: 'border-rose-400/40',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
    badgeText: 'text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    nodeReadyBg: 'bg-rose-500 hover:bg-rose-400',
    nodeReadyBorder: 'border-rose-300 dark:border-rose-400',
    nodeReadyShadow: 'shadow-[0_6px_0_#be123c]',
    activeRing: 'ring-rose-400',
    accentText: 'text-rose-600 dark:text-rose-400',
    tagBg: 'bg-rose-500 text-white',
  }
};

export default function LearningPathPage({ onStartLesson, courseId, onCourseDeleted }: LearningPathPageProps) {
  const [pathData, setPathData] = useState<PathData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlockModalLesson, setUnlockModalLesson] = useState<Lesson | null>(null);
  const [togglingMode, setTogglingMode] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadPath = async () => {
    try {
      setLoading(true);
      let targetId = courseId;
      if (!targetId) {
        const courses = await apiRequest<any[]>('/api/courses');
        if (courses.length > 0) {
          targetId = courses[0].id;
        }
      }
      if (targetId) {
        const res = await apiRequest<PathData>(`/api/courses/${targetId}/path`);
        setPathData(res);
      } else {
        setPathData(null);
      }
    } catch (err) {
      console.error('Lỗi khi tải đường học:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPath();
  }, [courseId]);

  const handleDeleteCourse = async () => {
    if (!pathData) return;
    playTapSound();
    if (!window.confirm(`Bạn có chắc chắn muốn xóa môn học "${pathData.courseTitle}"? Toàn bộ lộ trình và câu hỏi sẽ bị xóa.`)) {
      return;
    }
    try {
      setDeleting(true);
      await apiRequest(`/api/courses/${pathData.courseId}`, { method: 'DELETE' });
      if (onCourseDeleted) {
        onCourseDeleted();
      } else {
        await loadPath();
      }
    } catch (e: any) {
      alert('Không thể xóa môn học: ' + (e.message || 'Lỗi mạng'));
    } finally {
      setDeleting(false);
    }
  };

  const handleUnlockSingle = async (lesson: Lesson) => {
    try {
      playTapSound();
      setTogglingMode(true);
      await apiRequest(`/api/lessons/${lesson.id}/unlock`, { method: 'POST' });
      setUnlockModalLesson(null);
      await loadPath();
      onStartLesson(lesson.id);
    } catch (e: any) {
      console.error(e);
      alert('Không thể mở khóa bài học: ' + (e.message || 'Lỗi mạng'));
    } finally {
      setTogglingMode(false);
    }
  };

  // BẬT / TẮT CHẾ ĐỘ MỞ KHÓA TẤT CẢ VS HỌC TUẦN TỰ
  const handleToggleLockMode = async (currentIsAllUnlocked: boolean) => {
    if (!pathData || togglingMode) return;
    try {
      setTogglingMode(true);
      playToggleSound(!currentIsAllUnlocked);
      triggerHaptic('click');

      if (currentIsAllUnlocked) {
        // Chuyển sang CHẾ ĐỘ TUẦN TỰ (Khóa các bài học sau bài đang học)
        const res = await apiRequest<any>(`/api/courses/${pathData.courseId}/relock`, { method: 'POST' });
        setMessage(res.message || 'Đã bật chế độ học tuần tự (khóa các bài học chưa tới)!');
      } else {
        // Chuyển sang CHẾ ĐỘ MỞ KHÓA TỰ DO
        const res = await apiRequest<any>(`/api/courses/${pathData.courseId}/unlock-all`, { method: 'POST' });
        setMessage(res.message || 'Đã mở khóa tự do toàn bộ 32 bài học & đề thi!');
      }

      setTimeout(() => setMessage(null), 4000);
      await loadPath();
    } catch (e: any) {
      console.error(e);
      alert('Không thể chuyển đổi chế độ khóa: ' + (e.message || 'Lỗi mạng'));
    } finally {
      setTogglingMode(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3 animate-in fade-in duration-300">
        <div className="w-10 h-10 border-4 border-duo-green border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-400">Đang tải đường học sắc màu Duolingo...</p>
      </div>
    );
  }

  if (!pathData || pathData.units.length === 0) {
    return (
      <div className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-8 text-center mt-6 animate-in fade-in zoom-in-95">
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
  
  // Kiểm tra xem hiện tại toàn bộ các bài có đang mở khóa hay không
  const isAllUnlocked = allLessons.length > 0 && !allLessons.some(l => l.status === 'locked');

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* Course Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-6 rounded-3xl shadow-xl border-2 border-emerald-400/30 relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-100 bg-emerald-800/60 px-3 py-1 rounded-full border border-emerald-400/30">
              Lộ trình học Mạng Máy Tính
            </span>
            <span className="text-xs font-black text-emerald-100 bg-emerald-900/40 px-2.5 py-1 rounded-lg">
              {doneLessonsCount}/{totalLessonsCount} bài ({progressPercent}%)
            </span>
          </div>

          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">{pathData.courseTitle}</h1>
            <button
              onClick={handleDeleteCourse}
              disabled={deleting}
              title="Xóa môn học này"
              className="text-xs font-bold text-emerald-100 hover:text-white hover:bg-emerald-700/60 px-2.5 py-1.5 rounded-xl transition flex items-center space-x-1 border border-emerald-400/40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xóa</span>
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full h-3 bg-emerald-950/50 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-amber-300 to-yellow-400 rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* THANH ĐIỀU KHIỂN BẬT / TẮT MỞ KHÓA BÀI HỌC */}
          <div className="pt-2 bg-emerald-950/40 rounded-2xl p-3 border border-emerald-400/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-lg">{isAllUnlocked ? '🔓' : '🔒'}</span>
              <div>
                <div className="text-xs font-black text-white flex items-center space-x-1.5">
                  <span>Chế độ:</span>
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider ${
                    isAllUnlocked 
                      ? 'bg-amber-400 text-amber-950 shadow-sm' 
                      : 'bg-emerald-500 text-white shadow-sm'
                  }`}>
                    {isAllUnlocked ? 'Mở khóa tự do' : 'Học tuần tự'}
                  </span>
                </div>
                <p className="text-[10px] text-emerald-200 mt-0.5">
                  {isAllUnlocked 
                    ? 'Tất cả 32 bài đã mở sẵn để bạn ôn luyện cấp tốc.' 
                    : 'Mở khóa từng bài khi hoàn thành bài trước (kỷ luật 9 ngày).'}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleToggleLockMode(isAllUnlocked)}
              disabled={togglingMode}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-2 shadow-sm active:scale-95 ${
                isAllUnlocked
                  ? 'bg-white hover:bg-slate-100 text-emerald-800'
                  : 'bg-amber-400 hover:bg-amber-300 text-amber-950'
              }`}
            >
              {isAllUnlocked ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Khóa lại (Tuần tự)</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Mở khóa tất cả</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="absolute -right-4 -bottom-6 text-emerald-300 opacity-20 text-9xl font-black select-none pointer-events-none">
          🦉
        </div>
      </div>

      {/* Thông báo thông tin sinh động */}
      {message && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-4 py-3 rounded-2xl text-xs font-bold flex items-center space-x-2 shadow-sm animate-in fade-in slide-in-from-top-2">
          <Zap className="w-4 h-4 flex-shrink-0 text-duo-green animate-bounce" />
          <span>{message}</span>
        </div>
      )}

      {/* Danh sách 5 Chương với 5 Bảng Màu Rực Rỡ Khác Nhau */}
      {pathData.units.map((unit) => {
        const theme = CHAPTER_THEMES[unit.sortOrder] || CHAPTER_THEMES[1];

        return (
          <div key={unit.id} className="space-y-6">
            {/* Unit Header Card Đa Sắc Màu */}
            <div className={`bg-gradient-to-r ${theme.headerGradient} text-white rounded-3xl p-4 sm:p-5 shadow-lg border-2 ${theme.bannerBorder} flex items-center justify-between`}>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">{theme.icon}</span>
                  <span className="text-[11px] font-black uppercase tracking-wider text-white/90 bg-white/20 px-2.5 py-0.5 rounded-full">
                    Chương {unit.sortOrder}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight drop-shadow-sm">
                  {unit.title}
                </h2>
              </div>
              
              <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur text-white flex items-center justify-center font-black text-base shadow-inner flex-shrink-0 ml-3">
                #{unit.sortOrder}
              </div>
            </div>

            {/* Sections & Vertical Duolingo Nodes */}
            {unit.sections.map((section) => (
              <div key={section.id} className="space-y-4">
                <div className="flex items-center space-x-2 pl-2">
                  <span className={`w-2 h-2 rounded-full ${theme.tagBg}`}></span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {section.title}
                  </h3>
                </div>

                {/* Vertical Path Connector */}
                <div className="flex flex-col items-center space-y-7 py-2 relative">
                  {section.lessons.map((lesson, lIdx) => {
                    const isDone = lesson.status === 'done';
                    const isReady = lesson.status === 'ready';
                    const isLocked = lesson.status === 'locked';
                    const isCurrentActive = lesson.id === firstActiveReadyLessonId;

                    // Zig-zag offset for authentic Duolingo feeling
                    const offsets = ['translate-x-0', '-translate-x-6', 'translate-x-6', 'translate-x-0'];
                    const offsetClass = offsets[lIdx % offsets.length];

                    return (
                      <div key={lesson.id} className={`flex flex-col items-center ${offsetClass} transition-transform`}>
                        <button
                          onClick={() => {
                            playTapSound();
                            triggerHaptic('click');
                            if (isLocked) {
                              setUnlockModalLesson(lesson);
                            } else {
                              onStartLesson(lesson.id);
                            }
                          }}
                          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 relative ${
                            isDone
                              ? 'bg-amber-400 text-white shadow-[0_6px_0_#b45309] border-4 border-amber-300 hover:scale-105 active:scale-95 active:translate-y-1 active:shadow-none'
                              : isReady && isCurrentActive
                              ? `${theme.nodeReadyBg} text-white ${theme.nodeReadyShadow} border-4 ${theme.nodeReadyBorder} ring-4 ${theme.activeRing} ring-offset-2 animate-bounce cursor-pointer active:translate-y-1 active:shadow-none`
                              : isReady
                              ? `${theme.nodeReadyBg} text-white ${theme.nodeReadyShadow} border-4 ${theme.nodeReadyBorder} hover:scale-105 active:scale-95 active:translate-y-1 active:shadow-none cursor-pointer`
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-[0_6px_0_#94a3b8] dark:shadow-[0_6px_0_#1e293b] hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer active:translate-y-1 active:shadow-none'
                          }`}
                          title={isLocked ? 'Bấm để mở khóa học sớm' : lesson.title}
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
                            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1 border-2 border-white dark:border-duo-dark-card shadow-sm">
                              <Star className="w-3 h-3 fill-white" />
                            </div>
                          )}

                          {/* Indicator tag for currently active lesson */}
                          {isCurrentActive && (
                            <div className={`absolute -top-7 ${theme.tagBg} text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border border-white/60 shadow-md animate-pulse whitespace-nowrap`}>
                              BẮT ĐẦU
                            </div>
                          )}
                        </button>

                        <div className="mt-2.5 text-center max-w-[150px]">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200 line-clamp-1">
                            {lesson.title}
                          </span>
                          <span className="text-[10px] font-bold block mt-0.5">
                            {isDone ? (
                              <span className="text-amber-500">Điểm: {lesson.bestScore ?? 100}%</span>
                            ) : isReady ? (
                              <span className={theme.accentText}>Sẵn sàng học</span>
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
        );
      })}

      {/* Modal Mở khóa bài học sớm */}
      {unlockModalLesson && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center font-black">
                <Unlock className="w-6 h-6" />
              </div>
              <button
                onClick={() => {
                  playTapSound();
                  setUnlockModalLesson(null);
                }}
                className="p-1 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-white">
                Mở khóa bài học sớm?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Bạn đang chọn: <strong>{unlockModalLesson.title}</strong>. Bạn có muốn mở khóa ngay bài này để vào làm bài tập không?
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={() => {
                  playTapSound();
                  setUnlockModalLesson(null);
                }}
                className="flex-1 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => handleUnlockSingle(unlockModalLesson)}
                disabled={togglingMode}
                className="flex-1 py-3 rounded-2xl bg-duo-green hover:bg-emerald-400 text-white text-xs font-black uppercase tracking-wider shadow-[0_4px_0_#047857] active:translate-y-1 active:shadow-none transition"
              >
                Mở khóa ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
