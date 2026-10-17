import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { Flame, Sparkles, CheckCircle, Clock, Calendar, AlertTriangle, Trophy } from 'lucide-react';

interface FailedItem {
  prompt: string;
  answer: string;
  explanation: string;
  failCount: number;
}

interface StatsData {
  xp: number;
  streak: number;
  bestStreak: number;
  dailyGoalXp: number;
  xpToday: number;
  masteredItemsCount: number;
  learningItemsCount: number;
  newItemsCount: number;
  totalItemsCount: number;
  daysUntilExam: number;
  topFailedItems: FailedItem[];
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await apiRequest<StatsData>('/api/stats');
        setStats(res);
      } catch (err) {
        console.error('Lỗi khi tải thống kê:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="w-10 h-10 border-4 border-duo-green border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-400">Đang tải dữ liệu học tập...</p>
      </div>
    );
  }

  if (!stats) return null;

  const goalPercent = Math.min(100, Math.round((stats.xpToday / Math.max(1, stats.dailyGoalXp)) * 100));

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-800 dark:text-white">Thống Kê Học Tập</h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">Tiến độ ghi nhớ ngắt quãng SRS và chuỗi học tập</p>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Streak Card */}
        <div className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-5 shadow-sm">
          <div className="flex items-center space-x-2 text-orange-500 mb-2">
            <Flame className="w-6 h-6 fill-orange-500" />
            <span className="text-xs font-black uppercase tracking-wider">Streak</span>
          </div>
          <div className="text-3xl font-black text-slate-800 dark:text-white">
            {stats.streak} <span className="text-sm font-bold text-slate-400">ngày</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Kỷ lục tốt nhất: {stats.bestStreak} ngày</p>
        </div>

        {/* Total XP Card */}
        <div className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-5 shadow-sm">
          <div className="flex items-center space-x-2 text-amber-500 mb-2">
            <Sparkles className="w-6 h-6 fill-amber-500" />
            <span className="text-xs font-black uppercase tracking-wider">Tổng điểm</span>
          </div>
          <div className="text-3xl font-black text-slate-800 dark:text-white">
            {stats.xp} <span className="text-sm font-bold text-slate-400">XP</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Hôm nay: +{stats.xpToday} XP</p>
        </div>
      </div>

      {/* Daily Goal Card */}
      <div className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-duo-green" />
            <span className="text-sm font-black text-slate-800 dark:text-white">Mục tiêu hằng ngày</span>
          </div>
          <span className="text-xs font-black text-duo-green">{stats.xpToday} / {stats.dailyGoalXp} XP</span>
        </div>

        <div className="w-full h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full bg-duo-green rounded-full transition-all duration-500"
            style={{ width: `${goalPercent}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-400 mt-2 font-medium">
          {goalPercent >= 100 ? '🎉 Bạn đã hoàn thành xuất sắc mục tiêu hôm nay!' : `Còn ${Math.max(0, stats.dailyGoalXp - stats.xpToday)} XP để hoàn thành mục tiêu ngày.`}
        </p>
      </div>

      {/* Spaced Repetition Mastery Breakdown */}
      <div className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-6 shadow-sm">
        <h3 className="text-sm font-black text-slate-800 dark:text-white mb-4">
          Cấp độ ghi nhớ kiến thức (SRS SM-2)
        </h3>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
            <span className="text-2xl font-black text-emerald-600 block">{stats.masteredItemsCount}</span>
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 uppercase">Nhớ vững (≥21d)</span>
          </div>

          <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
            <span className="text-2xl font-black text-duo-blue block">{stats.learningItemsCount}</span>
            <span className="text-[11px] font-bold text-blue-800 dark:text-blue-400 uppercase">Đang ghi nhớ</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-duo-dark-border">
            <span className="text-2xl font-black text-slate-600 dark:text-slate-300 block">{stats.newItemsCount}</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Chưa học</span>
          </div>
        </div>

        {stats.daysUntilExam > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-duo-dark-border flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium flex items-center">
              <Calendar className="w-4 h-4 mr-1.5 text-duo-blue" />
              Đếm ngược ngày thi:
            </span>
            <span className="font-black text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
              Còn {stats.daysUntilExam} ngày
            </span>
          </div>
        )}
      </div>

      {/* Top Failed Items */}
      {stats.topFailedItems && stats.topFailedItems.length > 0 && (
        <div className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-6 shadow-sm">
          <div className="flex items-center space-x-2 text-rose-500 mb-3">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-sm font-black text-slate-800 dark:text-white">Top câu hỏi hay trả lời sai</h3>
          </div>

          <div className="space-y-3">
            {stats.topFailedItems.map((item, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-duo-dark-border text-xs">
                <div className="flex items-start justify-between">
                  <p className="font-bold text-slate-800 dark:text-white flex-1 mr-2">{item.prompt}</p>
                  <span className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 px-2 py-0.5 rounded font-black text-[10px] flex-shrink-0">
                    Sai {item.failCount} lần
                  </span>
                </div>
                <p className="text-emerald-600 font-bold mt-1.5">✓ Đáp án: {item.answer}</p>
                {item.explanation && (
                  <p className="text-slate-400 italic mt-0.5 text-[11px]">"{item.explanation}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
