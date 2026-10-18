import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { 
  X, CheckCircle2, XCircle, ArrowRight, Sparkles, Flame, 
  RotateCcw, BookOpen, HelpCircle, Trophy, Award 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { playSuccessSound, playFailureSound, playFanfareSound, triggerHaptic } from '../utils/sound';

interface SessionItem {
  itemId: string;
  lessonId: string;
  lessonTitle: string;
  prompt: string;
  intro: string;
  answer: string;
  options: string[];
  explanation: string;
  sourceQuote: string;
  introduced: boolean;
  isReview: boolean;
  isRetry?: boolean;
}

interface SessionPageProps {
  lessonId?: string | null;
  onFinish: () => void;
  onExit: () => void;
}

function cleanOptionText(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/\s*\((?:đúng|sai|dung|correct|true|false)\)\s*$/i, '')
    .replace(/\s*\[(?:x|v|đúng|correct)\]\s*$/i, '')
    .replace(/^[\*✓✔]\s*/, '')
    .replace(/[\*✓✔]$/, '')
    .trim();
}

export default function SessionPage({ lessonId, onFinish, onExit }: SessionPageProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SessionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isIntroMode, setIsIntroMode] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [answerDetails, setAnswerDetails] = useState<{
    correctAnswer: string;
    explanation: string;
    sourceQuote: string;
    xpEarned: number;
  } | null>(null);

  const [startTime, setStartTime] = useState<number>(Date.now());
  const [totalXp, setTotalXp] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [failedItemIds, setFailedItemIds] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const [finalSummary, setFinalSummary] = useState<any>(null);

  // Tải danh sách câu hỏi (theo bài học cụ thể hoặc hàng đợi ôn tập hôm nay)
  useEffect(() => {
    async function loadSession() {
      try {
        const endpoint = lessonId ? `/api/session/lesson/${lessonId}` : '/api/session/today';
        const data = await apiRequest<any>(endpoint);
        if (data.items && data.items.length > 0) {
          setItems(data.items);
          const firstItem = data.items[0];
          const hasOptions = firstItem.options && firstItem.options.length >= 2;
          setIsIntroMode(!firstItem.introduced && !hasOptions);
          setStartTime(Date.now());
        }
      } catch (err) {
        console.error('Lỗi khi tải phiên học:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [lessonId]);

  const currentItem = items[currentIndex];
  const progressPercent = items.length > 0 ? Math.min(100, Math.round((currentIndex / items.length) * 100)) : 0;

  // Xử lý nộp câu trả lời
  const handleSubmitAnswer = async () => {
    if (!selectedOption || hasAnswered || !currentItem) return;

    const responseMs = Date.now() - startTime;
    setHasAnswered(true);

    try {
      const res = await apiRequest<any>('/api/session/answer', {
        method: 'POST',
        body: JSON.stringify({
          itemId: currentItem.itemId,
          selectedAnswer: selectedOption,
          responseMs,
          isRetry: !!currentItem.isRetry,
        }),
      });

      setIsCorrect(res.correct);
      setAnswerDetails({
        correctAnswer: res.correctAnswer,
        explanation: res.explanation,
        sourceQuote: res.sourceQuote,
        xpEarned: res.xpEarned,
      });

      if (res.correct) {
        setCorrectCount(prev => prev + 1);
        setTotalXp(prev => prev + res.xpEarned);
        playSuccessSound();
        triggerHaptic('success');
      } else {
        setIncorrectCount(prev => prev + 1);
        playFailureSound();
        triggerHaptic('error');
        if (!failedItemIds.includes(currentItem.itemId)) {
          setFailedItemIds(prev => [...prev, currentItem.itemId]);
        }
        // Đẩy câu sai về cuối hàng đợi (tối đa 2 lần)
        if (res.shouldRepeatInSession) {
          const retryItem: SessionItem = {
            ...currentItem,
            isRetry: true,
            introduced: true,
          };
          setItems(prev => [...prev, retryItem]);
        }
      }
    } catch (err) {
      console.error('Lỗi khi chấm điểm:', err);
    }
  };

  // Chuyển sang câu tiếp theo hoặc kết thúc
  const handleNext = async () => {
    if (currentIndex + 1 < items.length) {
      const nextIdx = currentIndex + 1;
      const nextItem = items[nextIdx];
      setCurrentIndex(nextIdx);
      setSelectedOption(null);
      setHasAnswered(false);
      setIsCorrect(null);
      setAnswerDetails(null);
      const hasOptions = nextItem.options && nextItem.options.length >= 2;
      setIsIntroMode(!nextItem.introduced && !hasOptions);
      setStartTime(Date.now());
    } else {
      // Kết thúc phiên học
      const isPerfect = incorrectCount === 0;
      try {
        const summary = await apiRequest<any>('/api/session/finish', {
          method: 'POST',
          body: JSON.stringify({
            totalQuestions: items.length,
            correctCount,
            incorrectCount,
            totalXpEarned: totalXp,
            isPerfect,
            failedItemIds,
            lessonId: lessonId || undefined,
          }),
        });
        setFinalSummary(summary);
        setCompleted(true);
        playFanfareSound();
        triggerHaptic('success');
        // Bắn pháo hoa ăn mừng
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (err) {
        console.error('Lỗi khi kết thúc phiên:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-duo-dark">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-12 h-12 border-4 border-duo-green border-t-transparent rounded-full animate-spin"></div>
          <p className="font-bold text-slate-500">Đang chuẩn bị phiên học hôm nay...</p>
        </div>
      </div>
    );
  }

  if (!currentItem && !completed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-duo-dark">
        <div className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white">Bạn đã hoàn thành bài học!</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Không còn câu hỏi nào cần ôn tập hôm nay. Hãy quay lại vào ngày mai nhé!
          </p>
          <button
            onClick={onExit}
            className="w-full mt-6 py-3.5 rounded-2xl font-black text-white uppercase text-sm btn-duo-green"
          >
            Quay lại trang chủ
          </button>
        </div>
      </div>
    );
  }

  // MÀN HÌNH KẾT QUẢ (Session Summary)
  if (completed && finalSummary) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-duo-dark">
        <div className="w-full max-w-md bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-6 shadow-sm">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-500 mb-3">
              <Trophy className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white">
              {finalSummary.isPerfect ? 'Xuất sắc! Hoàn hảo!' : 'Hoàn thành phiên học!'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {finalSummary.isPerfect ? 'Bạn không sai câu nào (+20 XP thưởng)' : 'Kiến thức đã được cập nhật vào chu kỳ nhớ SRS'}
            </p>
          </div>

          {/* Thống kê nhanh */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-center">
              <div className="flex items-center justify-center text-amber-500 mb-1">
                <Sparkles className="w-5 h-5 mr-1" />
                <span className="font-black text-lg">+{finalSummary.grandTotalXp}</span>
              </div>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase">Tổng XP</span>
            </div>

            <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded-2xl text-center">
              <div className="flex items-center justify-center text-orange-500 mb-1">
                <Flame className="w-5 h-5 mr-1" />
                <span className="font-black text-lg">{finalSummary.currentStreak}</span>
              </div>
              <span className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase">Ngày Streak</span>
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-center">
              <div className="flex items-center justify-center text-emerald-600 mb-1">
                <Award className="w-5 h-5 mr-1" />
                <span className="font-black text-lg">{finalSummary.correctCount}</span>
              </div>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">Số câu đúng</span>
            </div>
          </div>

          {/* Danh sách câu sai nếu có */}
          {finalSummary.failedItems && finalSummary.failedItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Cần ôn lại ({finalSummary.failedItems.length} câu)
              </h3>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {finalSummary.failedItems.map((fi: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-duo-dark-border text-xs">
                    <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">{fi.prompt}</p>
                    <p className="text-emerald-600 font-semibold mb-1">✓ Đáp án: {cleanOptionText(fi.answer)}</p>
                    {fi.explanation && (
                      <p className="text-slate-500 dark:text-slate-400 italic">"{cleanOptionText(fi.explanation)}"</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onFinish}
            className="w-full py-4 rounded-2xl font-black text-white uppercase tracking-wider text-sm btn-duo-green"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-duo-dark">
      {/* Top Header: Close button & Progress bar */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-duo-dark-card/95 backdrop-blur border-b border-slate-200 dark:border-duo-dark-border px-4 py-3 flex items-center space-x-4 max-w-xl mx-auto w-full">
        <button
          onClick={onExit}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Progress Bar */}
        <div className="flex-1 h-3.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full bg-duo-green rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center space-x-1 font-bold text-xs text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-900/50">
          <Sparkles className="w-4 h-4" />
          <span>+{totalXp} XP</span>
        </div>
      </div>

      {/* Main Study Container */}
      <div className="flex-1 max-w-xl mx-auto w-full p-4 flex flex-col justify-between pb-32">
        {/* DẠNG 1: THẺ GIỚI THIỆU KHÁI NIỆM (Intro Card) */}
        {isIntroMode ? (
          <div className="flex-1 flex flex-col justify-center py-4">
            <div className="inline-flex items-center space-x-2 text-duo-blue font-bold text-xs uppercase tracking-wider mb-2">
              <BookOpen className="w-4 h-4" />
              <span>Khái niệm mới • {currentItem.lessonTitle}</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white mb-4">
              {currentItem.prompt}
            </h2>

            <div className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-6 shadow-sm mb-6 space-y-4">
              {currentItem.intro && (
                <div className="text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                  {currentItem.intro}
                </div>
              )}

              {currentItem.sourceQuote && (
                <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border-l-4 border-duo-blue rounded-r-xl text-xs text-slate-600 dark:text-slate-300 italic">
                  "{currentItem.sourceQuote}"
                </div>
              )}
            </div>

            <button
              onClick={() => setIsIntroMode(false)}
              className="w-full py-4 rounded-2xl font-black text-white uppercase tracking-wider text-sm btn-duo-blue"
            >
              Đã hiểu, kiểm tra thử!
            </button>
          </div>
        ) : (
          /* DẠNG 2: CÂU HỎI TRẮC NGHIỆM 4 ĐÁP ÁN */
          <div className="flex-1 flex flex-col justify-center py-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
              <span>{currentItem.lessonTitle}</span>
              {currentItem.isRetry && (
                <span className="flex items-center text-amber-500">
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Làm lại câu sai
                </span>
              )}
            </div>

            <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white mb-6">
              {currentItem.prompt}
            </h2>

            {/* 4 Options Grid */}
            <div className="space-y-3">
              {currentItem.options.map((option, idx) => {
                const isSelected = selectedOption === option;
                let btnStyle = "border-slate-200 dark:border-duo-dark-border bg-white dark:bg-duo-dark-card text-slate-800 dark:text-white";
                
                if (hasAnswered) {
                  if (cleanOptionText(option) === cleanOptionText(answerDetails?.correctAnswer)) {
                    btnStyle = "border-duo-green bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold";
                  } else if (isSelected && !isCorrect) {
                    btnStyle = "border-duo-red bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold";
                  } else {
                    btnStyle = "border-slate-100 dark:border-slate-800 opacity-40 text-slate-400";
                  }
                } else if (isSelected) {
                  btnStyle = "border-duo-blue bg-blue-50 dark:bg-blue-950/40 text-duo-blue font-bold shadow-duo-blue";
                }

                return (
                  <button
                    key={idx}
                    disabled={hasAnswered}
                    onClick={() => setSelectedOption(option)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between text-sm sm:text-base font-semibold ${btnStyle}`}
                  >
                    <span>{cleanOptionText(option)}</span>
                    <span className="w-6 h-6 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center text-xs font-bold text-slate-400 ml-3 flex-shrink-0">
                      {String.fromCharCode(65 + idx)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM ACTION BAR / FEEDBACK SHEET */}
      {!isIntroMode && (
        <div className={`fixed bottom-0 left-0 right-0 border-t-2 p-4 transition-all z-40 ${
          hasAnswered
            ? isCorrect
              ? 'bg-emerald-100 border-emerald-300 dark:bg-emerald-950 dark:border-emerald-800'
              : 'bg-rose-100 border-rose-300 dark:bg-rose-950 dark:border-rose-800'
            : 'bg-white dark:bg-duo-dark-card border-slate-200 dark:border-duo-dark-border'
        }`}>
          <div className="max-w-xl mx-auto flex flex-col space-y-3">
            {hasAnswered && (
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="w-6 h-6 text-duo-green" />
                      <span className="font-black text-emerald-800 dark:text-emerald-200 text-lg">
                        Chính xác! (+{answerDetails?.xpEarned} XP)
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-6 h-6 text-duo-red" />
                      <span className="font-black text-rose-800 dark:text-rose-200 text-lg">
                        Chưa chính xác!
                      </span>
                    </>
                  )}
                </div>

                {answerDetails?.explanation && (
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                    {answerDetails.explanation}
                  </p>
                )}

                {answerDetails?.sourceQuote && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    Trích dẫn tài liệu: "{answerDetails.sourceQuote}"
                  </p>
                )}
              </div>
            )}

            <div>
              {!hasAnswered ? (
                <button
                  disabled={!selectedOption}
                  onClick={handleSubmitAnswer}
                  className="w-full py-4 rounded-2xl font-black text-white uppercase tracking-wider text-sm btn-duo-green disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                >
                  Kiểm tra
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className={`w-full py-4 rounded-2xl font-black text-white uppercase tracking-wider text-sm ${
                    isCorrect ? 'btn-duo-green' : 'btn-duo-red'
                  }`}
                >
                  Tiếp tục
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
