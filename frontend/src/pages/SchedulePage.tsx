import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { Calendar, Clock, AlertTriangle, BookOpen, RotateCcw, CheckCircle2 } from 'lucide-react';

interface LessonSummary {
  id: string;
  title: string;
  status: string;
}

interface DaySchedule {
  date: string;
  newLessonCount: number;
  reviewItemCount: number;
  estimatedMinutes: number;
  isOverloaded: boolean;
  isRevisionOnlyDay: boolean;
  lessons: LessonSummary[];
}

interface ScheduleData {
  dailyMinutes: number;
  hasOverload: boolean;
  warningMessage?: string;
  scheduleDays: DaySchedule[];
}

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState(false);

  const loadSchedule = async () => {
    try {
      const res = await apiRequest<ScheduleData>('/api/schedule');
      setSchedule(res);
    } catch (err) {
      console.error('Lỗi khi tải lịch học:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  const handleReschedule = async () => {
    setRescheduling(true);
    try {
      const courses = await apiRequest<any[]>('/api/courses');
      if (courses.length > 0) {
        await apiRequest(`/api/courses/${courses[0].id}/reschedule`, { method: 'POST' });
        await loadSchedule();
      }
    } catch (err) {
      console.error('Lỗi khi dồn lịch:', err);
    } finally {
      setRescheduling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="w-10 h-10 border-4 border-duo-green border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-400">Đang tải lịch học chi tiết...</p>
      </div>
    );
  }

  if (!schedule || schedule.scheduleDays.length === 0) {
    return (
      <div className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-8 text-center mt-6">
        <div className="text-4xl mb-3">📅</div>
        <h3 className="text-lg font-black text-slate-800 dark:text-white">Chưa có lịch học</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Reschedule action */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white">Kế Hoạch Từng Ngày</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Mục tiêu: {schedule.dailyMinutes} phút mỗi ngày</p>
        </div>

        <button
          onClick={handleReschedule}
          disabled={rescheduling}
          className="px-3.5 py-2 rounded-xl text-xs font-bold text-duo-blue border-2 border-duo-blue/30 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition flex items-center space-x-1.5"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${rescheduling ? 'animate-spin' : ''}`} />
          <span>Dồn lịch tự động</span>
        </button>
      </div>

      {/* Overload Alert Warning */}
      {schedule.hasOverload && schedule.warningMessage && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-start space-x-3 text-amber-800 dark:text-amber-200 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="font-medium">
            <span className="font-bold block mb-0.5">Cảnh báo tải học tập quá mức:</span>
            {schedule.warningMessage}
          </div>
        </div>
      )}

      {/* Days List */}
      <div className="space-y-3">
        {schedule.scheduleDays.map((day, idx) => {
          const isToday = idx === 0;
          return (
            <div
              key={day.date}
              className={`p-4 rounded-2xl border-2 transition-all ${
                isToday
                  ? 'bg-white dark:bg-duo-dark-card border-duo-green shadow-sm'
                  : 'bg-white/60 dark:bg-duo-dark-card/60 border-slate-200 dark:border-duo-dark-border'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                    isToday
                      ? 'bg-duo-green text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}>
                    {isToday ? 'Hôm nay' : day.date}
                  </span>

                  {day.isRevisionOnlyDay && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-900/50">
                      Ôn tập tổng hợp
                    </span>
                  )}

                  {day.isOverloaded && (
                    <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-md">
                      Quá tải
                    </span>
                  )}
                </div>

                <div className="flex items-center text-xs font-bold text-slate-500">
                  <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  <span>~{day.estimatedMinutes} phút</span>
                </div>
              </div>

              {/* Lesson Summaries */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                <span>
                  Bài mới: <strong className="text-slate-700 dark:text-slate-200">{day.newLessonCount}</strong> • Ôn tập: <strong className="text-slate-700 dark:text-slate-200">{day.reviewItemCount} Item</strong>
                </span>

                {day.lessons.length > 0 && (
                  <span className="text-[11px] font-semibold text-duo-blue">
                    {day.lessons[0].title} {day.lessons.length > 1 ? `(+${day.lessons.length - 1})` : ''}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
