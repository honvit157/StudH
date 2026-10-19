import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { 
  X, CheckCircle2, XCircle, ArrowRight, Sparkles, Flame, 
  RotateCcw, BookOpen, HelpCircle, Trophy, Award, ShieldCheck 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { playSuccessSound, playFailureSound, playFanfareSound, playTapSound, playOptionSelectSound, triggerHaptic } from '../utils/sound';

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

interface ConceptItem {
  term: string;
  explanation: string;
  tag: string;
}

interface LessonOverview {
  title: string;
  description: string;
  keyPoints: string[];
  concepts: ConceptItem[];
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

  const [lessonOverview, setLessonOverview] = useState<LessonOverview | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string>('');
  const [overviewModalOpen, setOverviewModalOpen] = useState(false);

  // Phân bổ kiến thức xen kẽ (Interleaved Micro-Learning Cards)
  const [activeMicroStage, setActiveMicroStage] = useState<'start' | 'mid' | 'late' | null>(null);
  const [hasShownMidCard, setHasShownMidCard] = useState(false);
  const [hasShownLateCard, setHasShownLateCard] = useState(false);

  // Chặng sửa câu sai ở cuối bài (Mistake Review Stage)
  const [mistakeQueue, setMistakeQueue] = useState<SessionItem[]>([]);
  const [isReviewingMistakes, setIsReviewingMistakes] = useState(false);
  const [showMistakeTransition, setShowMistakeTransition] = useState(false);
  const [mistakeIndex, setMistakeIndex] = useState(0);

  const [startTime, setStartTime] = useState<number>(Date.now());
  const [totalXp, setTotalXp] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [failedItemIds, setFailedItemIds] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const [finalSummary, setFinalSummary] = useState<any>(null);

  // Tải danh sách câu hỏi
  useEffect(() => {
    async function loadSession() {
      try {
        const endpoint = lessonId ? `/api/session/lesson/${lessonId}` : '/api/session/today';
        const data = await apiRequest<any>(endpoint);
        if (data.items && data.items.length > 0) {
          setItems(data.items);
          setSessionTitle(data.lessonTitle || data.courseTitle || '');
          if (data.overview && ((data.overview.keyPoints && data.overview.keyPoints.length > 0) || (data.overview.concepts && data.overview.concepts.length > 0))) {
            setLessonOverview(data.overview);
            setActiveMicroStage('start'); // Bắt đầu bằng thẻ kiến thức phần 1 (gọn gàng, vừa màn hình)
          } else {
            setActiveMicroStage(null);
          }
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

  const activeItem = isReviewingMistakes ? mistakeQueue[mistakeIndex] : items[currentIndex];

  const progressPercent = isReviewingMistakes
    ? (mistakeQueue.length > 0 ? Math.min(100, Math.round(((mistakeIndex + (hasAnswered ? 1 : 0)) / mistakeQueue.length) * 100)) : 100)
    : (items.length > 0 ? Math.min(100, Math.round(((currentIndex + (hasAnswered ? 1 : 0)) / items.length) * 100)) : 0);

  // Xử lý nộp câu trả lời
  const handleSubmitAnswer = async () => {
    if (!selectedOption || hasAnswered || !activeItem) return;
    playTapSound();

    const responseMs = Date.now() - startTime;
    setHasAnswered(true);

    try {
      const res = await apiRequest<any>('/api/session/answer', {
        method: 'POST',
        body: JSON.stringify({
          itemId: activeItem.itemId,
          selectedAnswer: selectedOption,
          responseMs,
          isRetry: isReviewingMistakes || !!activeItem.isRetry,
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
        if (!isReviewingMistakes) {
          setCorrectCount(prev => prev + 1);
          setTotalXp(prev => prev + res.xpEarned);
        } else {
          setTotalXp(prev => prev + 5); // Thưởng +5 XP khi sửa câu sai thành công
        }
        playSuccessSound();
        triggerHaptic('success');
      } else {
        if (!isReviewingMistakes) {
          setIncorrectCount(prev => prev + 1);
          if (!failedItemIds.includes(activeItem.itemId)) {
            setFailedItemIds(prev => [...prev, activeItem.itemId]);
          }
          // Lưu vào hàng đợi làm lại ở cuối bài học
          setMistakeQueue(prev => prev.some(x => x.itemId === activeItem.itemId) ? prev : [...prev, activeItem]);
        } else {
          // Trong chặng sửa sai nếu vẫn sai thì đẩy lại về cuối hàng đợi sửa sai
          setMistakeQueue(prev => [...prev, activeItem]);
        }
        playFailureSound();
        triggerHaptic('error');
      }
    } catch (err) {
      console.error('Lỗi khi chấm điểm:', err);
    }
  };

  // Hoàn tất phiên học và gọi API finish
  const finishSession = async () => {
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
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (err) {
      console.error('Lỗi khi kết thúc phiên:', err);
    }
  };

  // Chuyển sang câu tiếp theo, thẻ kiến thức xen kẽ hoặc chặng sửa câu sai
  const handleNext = async () => {
    playTapSound();
    if (!isReviewingMistakes) {
      // 1. Kiểm tra xem có cần hiển thị thẻ kiến thức chặng giữa (Mid Card) không
      const midPoint = Math.max(1, Math.floor(items.length / 2) - 1);
      if (currentIndex === midPoint && !hasShownMidCard && lessonOverview && 
          ((lessonOverview.keyPoints && lessonOverview.keyPoints.length > 1) || 
           (lessonOverview.concepts && lessonOverview.concepts.length > 1))) {
        setHasShownMidCard(true);
        setActiveMicroStage('mid');
        setSelectedOption(null);
        setHasAnswered(false);
        setIsCorrect(null);
        setAnswerDetails(null);
        return;
      }

      // 2. Kiểm tra xem có cần hiển thị thẻ kiến thức chặng cuối (Late Card) không
      const latePoint = Math.max(2, items.length - 2);
      if (currentIndex === latePoint && !hasShownLateCard && lessonOverview && 
          ((lessonOverview.keyPoints && lessonOverview.keyPoints.length > 2) || 
           (lessonOverview.concepts && lessonOverview.concepts.length > 2))) {
        setHasShownLateCard(true);
        setActiveMicroStage('late');
        setSelectedOption(null);
        setHasAnswered(false);
        setIsCorrect(null);
        setAnswerDetails(null);
        return;
      }

      // 3. Nếu còn câu hỏi chính tiếp theo
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
        return;
      }

      // 4. Đã làm hết toàn bộ câu hỏi chính thức!
      // Kiểm tra: Có câu nào làm sai cần làm lại ở cuối bài không?
      if (mistakeQueue.length > 0) {
        setIsReviewingMistakes(true);
        setShowMistakeTransition(true);
        setMistakeIndex(0);
        setSelectedOption(null);
        setHasAnswered(false);
        setIsCorrect(null);
        setAnswerDetails(null);
        return;
      }

      // Không có câu sai -> Hoàn thành xuất sắc!
      finishSession();

    } else {
      // Đang trong chặng sửa câu sai
      if (mistakeIndex + 1 < mistakeQueue.length) {
        const nextIdx = mistakeIndex + 1;
        setMistakeIndex(nextIdx);
        setSelectedOption(null);
        setHasAnswered(false);
        setIsCorrect(null);
        setAnswerDetails(null);
        setStartTime(Date.now());
      } else {
        // Đã sửa xong toàn bộ các câu sai!
        finishSession();
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

  if (!activeItem && !completed) {
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

  // MÀN HÌNH CHUYỂN TIẾP: CHẶNG SỬA CÂU SAI Ở CUỐI BÀI
  if (showMistakeTransition) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-duo-dark animate-in fade-in zoom-in-95 duration-200">
        <div className="w-full max-w-md bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-6 sm:p-8 shadow-sm text-center">
          <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-500 mx-auto mb-4 flex items-center justify-center animate-bounce">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-900/50">
            Chặng củng cố cuối bài
          </span>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white mt-3 mb-2">
            Cùng sửa lại các câu chưa đúng!
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
            Bạn có <strong>{mistakeQueue.length} câu</strong> cần làm lại để nắm chắc 100% kiến thức và hoàn thành xuất sắc bài học này.
          </p>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl flex items-center justify-center space-x-2 text-emerald-700 dark:text-emerald-300 text-xs font-bold mb-6">
            <Sparkles className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span>Thưởng thêm +5 XP cho mỗi câu sửa đúng</span>
          </div>
          <button
            onClick={() => {
              setShowMistakeTransition(false);
              setStartTime(Date.now());
              playSuccessSound();
              triggerHaptic('success');
            }}
            className="w-full py-4 rounded-2xl font-black text-white uppercase tracking-wider text-sm btn-duo-green flex items-center justify-center space-x-2 shadow-duo-green"
          >
            <span>Bắt đầu sửa lỗi ngay</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>
    );
  }

  // MÀN HÌNH THẺ KIẾN THỨC XEN KẼ (Interleaved Micro-Learning Cards - Vừa màn hình, không phải cuộn)
  if (activeMicroStage && lessonOverview) {
    let stageTitle = 'Khởi động bài học';
    let stageBadge = 'Chặng 1/3: Khởi động';
    let stageColor = 'text-duo-green bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50';
    let btnText = 'Bắt đầu làm bài tập';
    let points: string[] = [];
    let concepts: ConceptItem[] = [];

    const allPoints = lessonOverview.keyPoints || [];
    const allConcepts = lessonOverview.concepts || [];

    if (activeMicroStage === 'start') {
      stageTitle = 'Khởi động kiến thức';
      stageBadge = 'Chặng 1/3: Khởi động';
      stageColor = 'text-duo-green bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50';
      btnText = 'Bắt đầu vào bài tập';
      points = allPoints.slice(0, Math.min(2, allPoints.length));
      concepts = allConcepts.slice(0, 1);
    } else if (activeMicroStage === 'mid') {
      stageTitle = 'Tiếp sức kiến thức giữa bài';
      stageBadge = 'Chặng 2/3: Củng cố giữa bài';
      stageColor = 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50';
      btnText = 'Tiếp tục luyện tập';
      points = allPoints.slice(2, 4);
      concepts = allConcepts.slice(1, 2);
    } else if (activeMicroStage === 'late') {
      stageTitle = 'Điểm mấu chốt về đích';
      stageBadge = 'Chặng 3/3: Tăng tốc về đích';
      stageColor = 'text-duo-blue bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50';
      btnText = 'Về đích bài học';
      points = allPoints.slice(4);
      concepts = allConcepts.slice(2, 3);
    }

    // Nếu thẻ chặng giữa hoặc chặng cuối không có nội dung thì bỏ qua
    if (points.length === 0 && concepts.length === 0) {
      setActiveMicroStage(null);
    } else {
      return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-duo-dark justify-between p-4 max-w-md mx-auto w-full">
          {/* Top Bar */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={onExit}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              <X className="w-6 h-6" />
            </button>
            <span className={`text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${stageColor}`}>
              {stageBadge}
            </span>
            <div className="w-6" />
          </div>

          {/* Compact Card Content - Vừa vặn 1 màn hình */}
          <div className="my-auto py-4 space-y-4">
            <div>
              <span className="text-xs font-bold uppercase text-slate-400">
                {sessionTitle}
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white mt-1">
                {stageTitle}
              </h1>
              {activeMicroStage === 'start' && lessonOverview.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {lessonOverview.description}
                </p>
              )}
            </div>

            {/* Điểm cốt lõi rút gọn (1 - 2 ý) */}
            {points.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Điểm cần nhớ</span>
                </span>
                <div className="space-y-2">
                  {points.map((p, idx) => (
                    <div
                      key={idx}
                      className="flex items-start space-x-2.5 p-3 rounded-2xl bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border shadow-sm text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 leading-snug"
                    >
                      <span className="w-5 h-5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        ✓
                      </span>
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Thuật ngữ then chốt rút gọn (1 khái niệm) */}
            {concepts.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center space-x-1">
                  <BookOpen className="w-3.5 h-3.5 text-duo-blue" />
                  <span>Khái niệm then chốt</span>
                </span>
                {concepts.map((c, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border shadow-sm text-xs sm:text-sm"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-slate-900 dark:text-white">
                        {c.term}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-duo-blue border border-blue-200 dark:border-blue-900/50">
                        {c.tag || 'Trọng tâm'}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                      {c.explanation}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="pb-4">
            <button
              onClick={() => {
                setActiveMicroStage(null);
                setStartTime(Date.now());
                playSuccessSound();
                triggerHaptic('success');
              }}
              className="w-full py-4 rounded-2xl font-black text-white uppercase tracking-wider text-sm btn-duo-green flex items-center justify-center space-x-2 shadow-duo-green"
            >
              <span>{btnText}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-duo-dark">
      {/* Top Header: Close button & Progress bar */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-duo-dark-card/95 backdrop-blur border-b border-slate-200 dark:border-duo-dark-border px-4 py-3 flex items-center space-x-3 max-w-xl mx-auto w-full">
        <button
          onClick={onExit}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition flex-shrink-0"
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

        {/* Mistake Review Badge */}
        {isReviewingMistakes && (
          <div className="flex items-center space-x-1.5 font-black text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-900/50 flex-shrink-0 animate-pulse">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Sửa câu sai: {mistakeIndex + 1}/{mistakeQueue.length}</span>
          </div>
        )}

        {lessonOverview && !isReviewingMistakes && (
          <button
            onClick={() => setOverviewModalOpen(true)}
            title="Xem tóm tắt lý thuyết bài học"
            className="px-2.5 py-1.5 rounded-xl text-duo-blue bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex items-center space-x-1 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition flex-shrink-0"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Lý thuyết</span>
          </button>
        )}

        <div className="flex items-center space-x-1 font-bold text-xs text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-900/50 flex-shrink-0">
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
              <span>Khái niệm mới • {activeItem.lessonTitle}</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white mb-4">
              {activeItem.prompt}
            </h2>

            <div className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-6 shadow-sm mb-6 space-y-4">
              {activeItem.intro && (
                <div className="text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                  {activeItem.intro}
                </div>
              )}

              {activeItem.sourceQuote && (
                <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border-l-4 border-duo-blue rounded-r-xl text-xs text-slate-600 dark:text-slate-300 italic">
                  "{activeItem.sourceQuote}"
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
          <div key={activeItem.itemId || `${currentIndex}-${mistakeIndex}`} className="flex-1 flex flex-col justify-center py-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
              <span className="truncate max-w-[200px]">{activeItem.lessonTitle}</span>
              {isReviewingMistakes || activeItem.isRetry ? (
                <span className="flex items-center text-amber-500 font-bold">
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Sửa lại câu sai
                </span>
              ) : activeItem.isReview ? (
                <span className="flex items-center text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950/60 px-2.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-800/50 text-[11px] animate-pulse">
                  <Sparkles className="w-3 h-3 mr-1 text-purple-500" />
                  Lặp lại ngắt quãng
                </span>
              ) : null}
            </div>

            {activeItem.isReview && activeItem.sourceQuote && !isReviewingMistakes && !activeItem.isRetry && (
              <div className="text-[11px] text-purple-600 dark:text-purple-300 font-semibold mb-3 flex items-center space-x-1 bg-purple-50/60 dark:bg-purple-950/40 px-2.5 py-1 rounded-xl border border-purple-200/60 dark:border-purple-900/50 w-fit">
                <span>🔄 {activeItem.sourceQuote}</span>
              </div>
            )}

            <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white mb-6">
              {activeItem.prompt}
            </h2>

            {/* 4 Options Grid */}
            <div className="space-y-3">
              {activeItem.options.map((option, idx) => {
                const isSelected = selectedOption === option;
                let btnStyle = "border-slate-200 dark:border-duo-dark-border bg-white dark:bg-duo-dark-card text-slate-800 dark:text-white";
                
                if (hasAnswered) {
                  if (cleanOptionText(option) === cleanOptionText(answerDetails?.correctAnswer)) {
                    btnStyle = "border-duo-green bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold shadow-sm";
                  } else if (isSelected && !isCorrect) {
                    btnStyle = "border-duo-red bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold shadow-sm";
                  } else {
                    btnStyle = "border-slate-100 dark:border-slate-800 opacity-40 text-slate-400";
                  }
                } else if (isSelected) {
                  btnStyle = "border-duo-blue bg-blue-50 dark:bg-blue-950/40 text-duo-blue font-bold shadow-duo-blue scale-[1.01]";
                }

                return (
                  <button
                    key={idx}
                    disabled={hasAnswered}
                    onClick={() => {
                      if (!hasAnswered) {
                        playOptionSelectSound();
                        triggerHaptic('click');
                        setSelectedOption(option);
                      }
                    }}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-150 flex items-center justify-between text-sm sm:text-base font-semibold active:scale-[0.98] active:translate-y-0.5 ${btnStyle}`}
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
                        {isReviewingMistakes ? 'Tuyệt vời! Bạn đã sửa đúng (+5 XP)' : `Chính xác! (+${answerDetails?.xpEarned || 10} XP)`}
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-6 h-6 text-duo-red" />
                      <span className="font-black text-rose-800 dark:text-rose-200 text-lg">
                        {isReviewingMistakes ? 'Chưa chính xác! (Sẽ ôn lại đến khi nhớ vững)' : 'Chưa chính xác! (Sẽ sửa lại ở cuối bài)'}
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

      {/* Modal xem lại tóm tắt lý thuyết trong khi làm trắc nghiệm */}
      {overviewModalOpen && lessonOverview && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-xl max-h-[85vh] bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-duo-blue" />
                <h3 className="text-base font-black text-slate-800 dark:text-white">
                  Tóm tắt lý thuyết: {lessonOverview.title}
                </h3>
              </div>
              <button
                onClick={() => setOverviewModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto pr-1 space-y-4 flex-1">
              {lessonOverview.keyPoints && lessonOverview.keyPoints.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Điểm cốt lõi
                  </h4>
                  <div className="space-y-1.5">
                    {lessonOverview.keyPoints.map((p, idx) => (
                      <div key={idx} className="flex items-start space-x-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-duo-dark-border text-xs font-medium text-slate-700 dark:text-slate-200">
                        <span className="text-emerald-500 font-bold">✓</span>
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lessonOverview.concepts && lessonOverview.concepts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Thuật ngữ & Khái niệm
                  </h4>
                  <div className="space-y-2">
                    {lessonOverview.concepts.map((c, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-duo-dark-border text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-duo-blue dark:text-sky-400">{c.term}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">{c.tag}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">{c.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
              <button
                onClick={() => setOverviewModalOpen(false)}
                className="w-full py-3 rounded-xl font-black text-white uppercase tracking-wider text-xs btn-duo-blue"
              >
                Đóng và tiếp tục làm bài
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
