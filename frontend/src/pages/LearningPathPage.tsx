import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { Lock, Check, Star, Play, Sparkles, BookOpen } from 'lucide-react';

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

  useEffect(() => {
    async function loadPath() {
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
    }
    loadPath();
  }, []);

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
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Course Title */}
      <div className="bg-duo-green text-white p-6 rounded-3xl shadow-duo-green relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-100">Lộ trình học Duolingo</span>
          <h1 className="text-xl font-black mt-1">{pathData.courseTitle}</h1>
          <p className="text-xs text-emerald-100 mt-1 font-medium">Học tuần tự từng bài theo cơ chế mở khóa</p>
        </div>
        <div className="absolute -right-4 -bottom-6 text-emerald-300 opacity-20 text-9xl font-black select-none pointer-events-none">
          🦉
        </div>
      </div>

      {/* Units List */}
      {pathData.units.map((unit, uIdx) => (
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

                  // Zig-zag offset for authentic Duolingo feeling
                  const offsets = ['translate-x-0', '-translate-x-6', 'translate-x-6', 'translate-x-0'];
                  const offsetClass = offsets[lIdx % offsets.length];

                  return (
                    <div key={lesson.id} className={`flex flex-col items-center ${offsetClass} transition-transform`}>
                      <button
                        disabled={isLocked}
                        onClick={() => onStartLesson(lesson.id)}
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all relative ${
                          isDone
                            ? 'bg-amber-400 text-white shadow-duo border-4 border-amber-300'
                            : isReady
                            ? 'bg-duo-green text-white shadow-duo-green border-4 border-emerald-300 animate-bounce'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 shadow-duo cursor-not-allowed'
                        }`}
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
                      </button>

                      <div className="mt-2 text-center max-w-[130px]">
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300 line-clamp-1">
                          {lesson.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium block">
                          {lesson.itemCount} câu hỏi
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
    </div>
  );
}
