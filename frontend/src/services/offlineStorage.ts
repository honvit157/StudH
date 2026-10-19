import seedData from '../data/networkingCourseSeed.json';

// Interfaces matching the frontend API contracts
export interface OfflineItem {
  id: string;
  lessonId: string;
  sortOrder: number;
  prompt: string;
  intro: string;
  answer: string;
  distractors: string[];
  explanation: string;
  sourceQuote: string;
}

export interface OfflineItemState {
  itemId: string;
  introduced: boolean;
  repetitions: number;
  intervalDays: number;
  ease: number;
  dueAt: string; // ISO string
  lapses: number;
  failCount: number;
  lastResult?: 'CORRECT' | 'INCORRECT';
  lastReviewedAt?: string;
}

export interface OfflineLesson {
  id: string;
  sectionId: string;
  unitId: string;
  sortOrder: number;
  title: string;
  status: 'locked' | 'ready' | 'generating' | 'done';
  scheduledDate: string;
  bestScore?: number;
  itemCount: number;
  overview?: {
    title: string;
    description: string;
    keyPoints: string[];
    concepts: Array<{ term: string; explanation: string; tag: string }>;
  };
}

export interface OfflineSection {
  id: string;
  unitId: string;
  sortOrder: number;
  title: string;
  lessonIds: string[];
}

export interface OfflineUnit {
  id: string;
  sortOrder: number;
  title: string;
  sectionIds: string[];
}

export interface OfflineProfile {
  id: string;
  xp: number;
  streak: number;
  bestStreak: number;
  dailyGoalXp: number;
  xpToday: number;
  lastActiveDate: string | null; // YYYY-MM-DD
  timezone: string;
  soundEnabled: boolean;
  theme: string;
  dailyMinutes: number;
  examDate: string;
  isUnlockedMode: boolean; // false = sequential, true = free unlock
}

const STORAGE_KEY_PREFIX = 'studyapp_offline_';
const VERSION_KEY = STORAGE_KEY_PREFIX + 'version';
const CURRENT_VERSION = '2.0';

export function cleanChoiceText(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/\s*\((?:đúng|sai|dung|correct|true|false)\)\s*$/i, '')
    .replace(/\s*\[(?:x|v|đúng|correct)\]\s*$/i, '')
    .replace(/^[\*✓✔]\s*/, '')
    .replace(/[\*✓✔]$/, '')
    .trim();
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

class OfflineStorageService {
  private initialized = false;

  constructor() {
    this.ensureInitialized();
  }

  public ensureInitialized(forceReset = false): void {
    if (this.initialized && !forceReset) return;

    const storedVersion = localStorage.getItem(VERSION_KEY);
    if (!storedVersion || storedVersion !== CURRENT_VERSION || forceReset) {
      this.seedInitialData();
    }
    this.initialized = true;
  }

  private seedInitialData(): void {
    const units: OfflineUnit[] = [];
    const sections: OfflineSection[] = [];
    const lessons: Record<string, OfflineLesson> = {};
    const items: Record<string, OfflineItem> = {};
    const itemStates: Record<string, OfflineItemState> = {};

    let totalLessons = 0;
    const now = new Date();
    const todayStr = getTodayString();

    const rawUnits = (seedData as any).units || [];
    rawUnits.forEach((uNode: any, uIdx: number) => {
      const uSort = uNode.sortOrder || uIdx + 1;
      const unitId = `unit-${uSort}`;
      const secIds: string[] = [];

      (uNode.sections || []).forEach((sNode: any, sIdx: number) => {
        const sSort = sNode.sortOrder || sIdx + 1;
        const sectionId = `sec-${uSort}-${sSort}`;
        const lessonIds: string[] = [];

        (sNode.lessons || []).forEach((lNode: any, lIdx: number) => {
          totalLessons++;
          const lSort = lNode.sortOrder || lIdx + 1;
          const lessonId = `lesson-${uSort}-${lSort}`;
          lessonIds.push(lessonId);

          const lItems = lNode.items || [];
          const scheduledDateObj = new Date(now.getTime() + Math.floor((totalLessons - 1) / 2) * 86400000);
          const scheduledDate = scheduledDateObj.toISOString().split('T')[0];

          lessons[lessonId] = {
            id: lessonId,
            sectionId,
            unitId,
            sortOrder: lSort,
            title: lNode.title || `Bài ${lSort}`,
            status: totalLessons === 1 ? 'ready' : 'locked',
            scheduledDate,
            itemCount: lItems.length,
            overview: lNode.overview,
          };

          lItems.forEach((iNode: any, iIdx: number) => {
            const itemId = `item-${uSort}-${lSort}-${iIdx + 1}`;
            items[itemId] = {
              id: itemId,
              lessonId,
              sortOrder: iIdx + 1,
              prompt: iNode.prompt || '',
              intro: iNode.intro || '',
              answer: iNode.answer || '',
              distractors: iNode.distractors || [],
              explanation: iNode.explanation || '',
              sourceQuote: iNode.sourceQuote || 'Giáo trình Mạng máy tính',
            };

            itemStates[itemId] = {
              itemId,
              introduced: false,
              repetitions: 0,
              intervalDays: 1,
              ease: 2.5,
              dueAt: now.toISOString(),
              lapses: 0,
              failCount: 0,
            };
          });
        });

        sections.push({
          id: sectionId,
          unitId,
          sortOrder: sSort,
          title: sNode.title || `Chuyên đề ${sSort}`,
          lessonIds,
        });
        secIds.push(sectionId);
      });

      units.push({
        id: unitId,
        sortOrder: uSort,
        title: uNode.title || `Chương ${uSort}`,
        sectionIds: secIds,
      });
    });

    const examDate = new Date(now.getTime() + 9 * 86400000).toISOString().split('T')[0];

    const profile: OfflineProfile = {
      id: 'default',
      xp: 0,
      streak: 0,
      bestStreak: 0,
      dailyGoalXp: 20,
      xpToday: 0,
      lastActiveDate: null,
      timezone: 'Asia/Ho_Chi_Minh',
      soundEnabled: true,
      theme: 'system',
      dailyMinutes: 20,
      examDate,
      isUnlockedMode: false,
    };

    localStorage.setItem(STORAGE_KEY_PREFIX + 'units', JSON.stringify(units));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'sections', JSON.stringify(sections));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'lessons', JSON.stringify(lessons));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'items', JSON.stringify(items));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'item_states', JSON.stringify(itemStates));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'profile', JSON.stringify(profile));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'review_logs', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'auth', 'true');
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
  }

  // --- Profile & Settings Helpers ---
  public getProfile(): OfflineProfile {
    this.ensureInitialized();
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + 'profile');
    if (!raw) {
      this.seedInitialData();
      return JSON.parse(localStorage.getItem(STORAGE_KEY_PREFIX + 'profile')!);
    }
    const profile: OfflineProfile = JSON.parse(raw);
    const today = getTodayString();
    if (profile.lastActiveDate && profile.lastActiveDate !== today) {
      profile.xpToday = 0;
    }
    return profile;
  }

  public saveProfile(profile: OfflineProfile): void {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'profile', JSON.stringify(profile));
  }

  public getLessons(): Record<string, OfflineLesson> {
    this.ensureInitialized();
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + 'lessons');
    return raw ? JSON.parse(raw) : {};
  }

  public saveLessons(lessons: Record<string, OfflineLesson>): void {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'lessons', JSON.stringify(lessons));
  }

  public getItems(): Record<string, OfflineItem> {
    this.ensureInitialized();
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + 'items');
    return raw ? JSON.parse(raw) : {};
  }

  public getItemStates(): Record<string, OfflineItemState> {
    this.ensureInitialized();
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + 'item_states');
    return raw ? JSON.parse(raw) : {};
  }

  public saveItemStates(states: Record<string, OfflineItemState>): void {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'item_states', JSON.stringify(states));
  }

  // --- API Handlers ---
  public getAuthStatus() {
    return { authenticated: true };
  }

  public login(_password?: string) {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'auth', 'true');
    return { success: true, authenticated: true };
  }

  public logout() {
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'auth');
    return { success: true, authenticated: false };
  }

  public getCourses() {
    const profile = this.getProfile();
    return [
      {
        id: 'course-networking-eduso',
        title: (seedData as any).title || 'Mạng Máy Tính - Toàn Diện & Luyện Thi Eduso',
        examDate: profile.examDate,
        dailyMinutes: profile.dailyMinutes || 20,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  public getCoursePath(_courseId?: string) {
    this.ensureInitialized();
    const profile = this.getProfile();
    const rawUnits: OfflineUnit[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PREFIX + 'units') || '[]');
    const rawSections: OfflineSection[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PREFIX + 'sections') || '[]');
    const lessons = this.getLessons();

    const sectionsMap = new Map<string, OfflineSection>();
    rawSections.forEach((s) => sectionsMap.set(s.id, s));

    const units = rawUnits.map((u) => {
      const uSections = u.sectionIds
        .map((sId) => sectionsMap.get(sId))
        .filter(Boolean)
        .map((s) => {
          const sLessons = s!.lessonIds
            .map((lId) => lessons[lId])
            .filter(Boolean)
            .map((l) => ({
              id: l.id,
              sortOrder: l.sortOrder,
              title: l.title,
              status: l.status,
              scheduledDate: l.scheduledDate,
              bestScore: l.bestScore,
              itemCount: l.itemCount,
            }));
          return {
            id: s!.id,
            sortOrder: s!.sortOrder,
            title: s!.title,
            lessons: sLessons,
          };
        });

      return {
        id: u.id,
        sortOrder: u.sortOrder,
        title: u.title,
        sections: uSections,
      };
    });

    return {
      courseId: 'course-networking-eduso',
      courseTitle: (seedData as any).title || 'Mạng Máy Tính - Toàn Diện & Luyện Thi Eduso',
      examDate: profile.examDate,
      dailyMinutes: profile.dailyMinutes || 20,
      units,
    };
  }

  public relockCourse(courseId?: string) {
    const profile = this.getProfile();
    profile.isUnlockedMode = false;
    this.saveProfile(profile);

    const lessons = this.getLessons();
    const allLessonList = Object.values(lessons).sort((a, b) => {
      const uA = parseInt(a.unitId.replace(/\D/g, '') || '0');
      const uB = parseInt(b.unitId.replace(/\D/g, '') || '0');
      if (uA !== uB) return uA - uB;
      return a.sortOrder - b.sortOrder;
    });

    let foundFirstUnfinished = false;
    for (const l of allLessonList) {
      if (l.status === 'done') {
        continue;
      }
      if (!foundFirstUnfinished) {
        l.status = 'ready';
        foundFirstUnfinished = true;
      } else {
        l.status = 'locked';
      }
    }

    this.saveLessons(lessons);
    return this.getCoursePath(courseId);
  }

  public unlockAllCourse(courseId?: string) {
    const profile = this.getProfile();
    profile.isUnlockedMode = true;
    this.saveProfile(profile);

    const lessons = this.getLessons();
    for (const id in lessons) {
      if (lessons[id].status !== 'done') {
        lessons[id].status = 'ready';
      }
    }

    this.saveLessons(lessons);
    return this.getCoursePath(courseId);
  }

  public unlockLesson(lessonId: string) {
    const lessons = this.getLessons();
    if (lessons[lessonId] && lessons[lessonId].status === 'locked') {
      lessons[lessonId].status = 'ready';
      this.saveLessons(lessons);
    }
    return { success: true };
  }

  public getLessonSession(lessonId: string) {
    this.ensureInitialized();
    const lessons = this.getLessons();
    const lesson = lessons[lessonId];
    if (!lesson) {
      throw new Error('Không tìm thấy bài học: ' + lessonId);
    }

    const allItems = this.getItems();
    const itemStates = this.getItemStates();

    const lessonItems = Object.values(allItems)
      .filter((it) => it.lessonId === lessonId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const sessionItems = lessonItems.map((item) => {
      const state = itemStates[item.id] || {
        itemId: item.id,
        introduced: false,
        repetitions: 0,
        intervalDays: 1,
        ease: 2.5,
        dueAt: new Date().toISOString(),
        lapses: 0,
        failCount: 0,
      };

      const cleanAns = cleanChoiceText(item.answer);
      const cleanDistractors = (item.distractors || [])
        .map((d) => cleanChoiceText(d))
        .filter((d) => d && d.toLowerCase() !== cleanAns.toLowerCase());

      const uniqueOptions = Array.from(new Set([cleanAns, ...cleanDistractors]));
      const shuffledOptions = shuffle(uniqueOptions);

      return {
        itemId: item.id,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        prompt: item.prompt,
        intro: item.intro,
        answer: cleanAns,
        options: shuffledOptions,
        explanation: item.explanation,
        sourceQuote: item.sourceQuote,
        introduced: state.introduced,
        isReview: state.repetitions > 0,
      };
    });

    return {
      courseTitle: (seedData as any).title || 'Mạng Máy Tính - Toàn Diện & Luyện Thi Eduso',
      lessonTitle: lesson.title,
      items: sessionItems,
      overview: lesson.overview || null,
    };
  }

  public getTodaySession() {
    this.ensureInitialized();
    const allItems = this.getItems();
    const itemStates = this.getItemStates();
    const lessons = this.getLessons();

    const now = new Date();
    const dueItems: OfflineItem[] = [];
    const newItems: OfflineItem[] = [];

    const sortedItems = Object.values(allItems);

    for (const item of sortedItems) {
      const state = itemStates[item.id];
      if (!state) continue;

      if (state.introduced) {
        const dueDate = new Date(state.dueAt);
        if (dueDate <= now) {
          dueItems.push(item);
        }
      } else {
        const lesson = lessons[item.lessonId];
        if (lesson && (lesson.status === 'ready' || lesson.status === 'done')) {
          newItems.push(item);
        }
      }
    }

    const sessionItems: any[] = [];
    let reviewCount = 0;
    let newCount = 0;

    // Ưu tiên ôn tập câu đến hạn (tối đa 15 câu)
    for (const item of dueItems) {
      if (sessionItems.length >= 15) break;
      const lesson = lessons[item.lessonId];
      const state = itemStates[item.id];
      const cleanAns = cleanChoiceText(item.answer);
      const cleanDistractors = (item.distractors || [])
        .map((d) => cleanChoiceText(d))
        .filter((d) => d && d.toLowerCase() !== cleanAns.toLowerCase());
      const shuffledOptions = shuffle(Array.from(new Set([cleanAns, ...cleanDistractors])));

      sessionItems.push({
        itemId: item.id,
        lessonId: item.lessonId,
        lessonTitle: lesson ? lesson.title : 'Ôn tập Spaced Repetition',
        prompt: item.prompt,
        intro: item.intro,
        answer: cleanAns,
        options: shuffledOptions,
        explanation: item.explanation,
        sourceQuote: item.sourceQuote,
        introduced: true,
        isReview: true,
      });
      reviewCount++;
    }

    // Sau đó thêm câu mới (tối đa 10 câu)
    for (const item of newItems) {
      if (sessionItems.length >= 20) break;
      const lesson = lessons[item.lessonId];
      const state = itemStates[item.id];
      const cleanAns = cleanChoiceText(item.answer);
      const cleanDistractors = (item.distractors || [])
        .map((d) => cleanChoiceText(d))
        .filter((d) => d && d.toLowerCase() !== cleanAns.toLowerCase());
      const shuffledOptions = shuffle(Array.from(new Set([cleanAns, ...cleanDistractors])));

      sessionItems.push({
        itemId: item.id,
        lessonId: item.lessonId,
        lessonTitle: lesson ? lesson.title : 'Bài học mới',
        prompt: item.prompt,
        intro: item.intro,
        answer: cleanAns,
        options: shuffledOptions,
        explanation: item.explanation,
        sourceQuote: item.sourceQuote,
        introduced: !!state?.introduced,
        isReview: false,
      });
      newCount++;
    }

    // Nếu vẫn rỗng, fallback lấy 10 câu đầu tiên
    if (sessionItems.length === 0) {
      const fallbackList = sortedItems.slice(0, 10);
      for (const item of fallbackList) {
        const lesson = lessons[item.lessonId];
        const cleanAns = cleanChoiceText(item.answer);
        const cleanDistractors = (item.distractors || [])
          .map((d) => cleanChoiceText(d))
          .filter((d) => d && d.toLowerCase() !== cleanAns.toLowerCase());
        const shuffledOptions = shuffle(Array.from(new Set([cleanAns, ...cleanDistractors])));

        sessionItems.push({
          itemId: item.id,
          lessonId: item.lessonId,
          lessonTitle: lesson ? lesson.title : 'Ôn tập tự do',
          prompt: item.prompt,
          intro: item.intro,
          answer: cleanAns,
          options: shuffledOptions,
          explanation: item.explanation,
          sourceQuote: item.sourceQuote,
          introduced: true,
          isReview: true,
        });
        reviewCount++;
      }
    }

    const estimatedMinutes = Math.max(3, Math.ceil(reviewCount * 0.3 + newCount * 0.5));

    return {
      courseTitle: (seedData as any).title || 'Mạng Máy Tính - Toàn Diện & Luyện Thi Eduso',
      lessonTitle: 'Ôn tập hàng ngày (SRS ngắt quãng)',
      items: sessionItems,
      sessionQueueSize: sessionItems.length,
      reviewCount,
      newCount,
      estimatedMinutes,
      overview: null,
    };
  }

  public processAnswer(payload: {
    itemId: string;
    selectedAnswer: string;
    responseMs: number;
    isRetry?: boolean;
  }) {
    const items = this.getItems();
    const item = items[payload.itemId];
    if (!item) {
      throw new Error('Không tìm thấy câu hỏi: ' + payload.itemId);
    }

    const cleanDbAnswer = cleanChoiceText(item.answer);
    const cleanUserAnswer = cleanChoiceText(payload.selectedAnswer);
    const isCorrect = cleanDbAnswer.toLowerCase() === cleanUserAnswer.toLowerCase();

    // SM-2 SRS Logic
    const itemStates = this.getItemStates();
    let state = itemStates[item.id] || {
      itemId: item.id,
      introduced: false,
      repetitions: 0,
      intervalDays: 1,
      ease: 2.5,
      dueAt: new Date().toISOString(),
      lapses: 0,
      failCount: 0,
    };

    let quality = 0;
    if (isCorrect) {
      if (payload.responseMs < 5000) quality = 5;
      else if (payload.responseMs > 15000) quality = 3;
      else quality = 4;
    } else {
      quality = 0;
      state.failCount = (state.failCount || 0) + 1;
    }

    const now = new Date();
    state.lastResult = quality >= 3 ? 'CORRECT' : 'INCORRECT';
    state.lastReviewedAt = now.toISOString();

    if (quality < 3) {
      state.repetitions = 0;
      state.intervalDays = 1;
      if (state.introduced) {
        state.lapses = (state.lapses || 0) + 1;
      }
    } else {
      state.repetitions = (state.repetitions || 0) + 1;
      if (state.repetitions === 1) {
        state.intervalDays = 1;
      } else if (state.repetitions === 2) {
        state.intervalDays = 3;
      } else {
        const nextInt = Math.round(state.intervalDays * state.ease);
        state.intervalDays = Math.max(1, nextInt);
      }
      const newEase = state.ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
      state.ease = Math.max(1.3, Math.round(newEase * 100) / 100);
    }

    state.introduced = true;
    const dueTime = new Date(now.getTime() + state.intervalDays * 86400000);
    state.dueAt = dueTime.toISOString();

    itemStates[item.id] = state;
    this.saveItemStates(itemStates);

    const xpEarned = isCorrect ? (payload.isRetry ? 5 : 10) : 0;

    return {
      correct: isCorrect,
      correctAnswer: cleanDbAnswer,
      explanation: cleanChoiceText(item.explanation),
      sourceQuote: item.sourceQuote,
      xpEarned,
      quality,
      shouldRepeat: !isCorrect,
    };
  }

  public finishSession(payload: {
    totalQuestions: number;
    correctCount: number;
    incorrectCount: number;
    totalXpEarned: number;
    isPerfect: boolean;
    failedItemIds?: string[];
    lessonId?: string;
  }) {
    const profile = this.getProfile();
    const today = getTodayString();

    // Streak Calculation
    if (!profile.lastActiveDate) {
      profile.streak = 1;
    } else if (profile.lastActiveDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (profile.lastActiveDate === yesterday) {
        profile.streak += 1;
      } else {
        profile.streak = 1;
      }
    }
    profile.bestStreak = Math.max(profile.bestStreak || 0, profile.streak);
    profile.lastActiveDate = today;

    const bonusXp = payload.isPerfect ? 20 : 0;
    const grandTotalXp = payload.totalXpEarned + bonusXp;
    profile.xp += grandTotalXp;
    profile.xpToday += grandTotalXp;
    this.saveProfile(profile);

    // Update Lesson Status
    if (payload.lessonId) {
      const lessons = this.getLessons();
      const currentLesson = lessons[payload.lessonId];
      if (currentLesson) {
        currentLesson.status = 'done';
        const score = payload.totalQuestions > 0
          ? Math.round((payload.correctCount / payload.totalQuestions) * 100)
          : 100;
        currentLesson.bestScore = Math.max(currentLesson.bestScore || 0, score);

        // Unlock next lesson if in sequential mode
        if (!profile.isUnlockedMode) {
          const allLessonList = Object.values(lessons).sort((a, b) => {
            const uA = parseInt(a.unitId.replace(/\D/g, '') || '0');
            const uB = parseInt(b.unitId.replace(/\D/g, '') || '0');
            if (uA !== uB) return uA - uB;
            return a.sortOrder - b.sortOrder;
          });

          const currentIdx = allLessonList.findIndex((l) => l.id === payload.lessonId);
          if (currentIdx >= 0 && currentIdx < allLessonList.length - 1) {
            const nextLesson = allLessonList[currentIdx + 1];
            if (nextLesson.status === 'locked') {
              nextLesson.status = 'ready';
            }
          }
        }

        this.saveLessons(lessons);
      }
    }

    return {
      totalQuestions: payload.totalQuestions,
      correctCount: payload.correctCount,
      incorrectCount: payload.incorrectCount,
      totalXpEarned: payload.totalXpEarned,
      bonusXp,
      grandTotalXp,
      streak: profile.streak,
      isPerfect: payload.isPerfect,
      failedItems: [],
    };
  }

  public getStats() {
    this.ensureInitialized();
    const profile = this.getProfile();
    const items = this.getItems();
    const itemStates = this.getItemStates();

    const totalItemsCount = Object.keys(items).length;
    let masteredItemsCount = 0;
    let learningItemsCount = 0;
    let newItemsCount = 0;

    const failedItemsWithCount: Array<{ item: OfflineItem; count: number }> = [];

    for (const id in items) {
      const state = itemStates[id];
      if (!state || !state.introduced) {
        newItemsCount++;
      } else if (state.intervalDays >= 21) {
        masteredItemsCount++;
      } else {
        learningItemsCount++;
      }

      if (state && state.failCount > 0) {
        failedItemsWithCount.push({
          item: items[id],
          count: state.failCount,
        });
      }
    }

    failedItemsWithCount.sort((a, b) => b.count - a.count);
    const topFailedItems = failedItemsWithCount.slice(0, 10).map((f) => ({
      prompt: f.item.prompt,
      answer: cleanChoiceText(f.item.answer),
      explanation: cleanChoiceText(f.item.explanation),
      failCount: f.count,
    }));

    // Calculate days until exam
    const today = new Date();
    const examDate = new Date(profile.examDate || new Date(Date.now() + 9 * 86400000));
    const diffTime = examDate.getTime() - today.getTime();
    const daysUntilExam = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    return {
      xp: profile.xp,
      streak: profile.streak,
      bestStreak: profile.bestStreak || profile.streak,
      dailyGoalXp: profile.dailyGoalXp,
      xpToday: profile.xpToday,
      masteredItemsCount,
      learningItemsCount,
      newItemsCount,
      totalItemsCount,
      daysUntilExam,
      topFailedItems,
    };
  }

  public getSchedule() {
    this.ensureInitialized();
    const profile = this.getProfile();
    const lessons = this.getLessons();
    const today = new Date();

    const allLessonList = Object.values(lessons).sort((a, b) => {
      const uA = parseInt(a.unitId.replace(/\D/g, '') || '0');
      const uB = parseInt(b.unitId.replace(/\D/g, '') || '0');
      if (uA !== uB) return uA - uB;
      return a.sortOrder - b.sortOrder;
    });

    const scheduleDays = [];
    // 9-day schedule breakdown
    for (let dayOffset = 0; dayOffset < 9; dayOffset++) {
      const dateObj = new Date(today.getTime() + dayOffset * 86400000);
      const dateStr = dateObj.toISOString().split('T')[0];

      // Distribute 32 lessons across the 9 days
      const lessonsForDay = allLessonList.filter((l, idx) => {
        if (dayOffset < 7) {
          // Days 1-7 cover chapters 1-4
          return Math.floor(idx / 4) === dayOffset;
        } else {
          // Days 8-9 cover Chapter 5 (the 5 full mock exams)
          return idx >= 27 && (dayOffset === 7 ? idx < 30 : idx >= 30);
        }
      });

      const isRevision = dayOffset >= 7;
      scheduleDays.push({
        date: dateStr,
        newLessonCount: lessonsForDay.length,
        reviewItemCount: dayOffset === 0 ? 0 : 15,
        estimatedMinutes: lessonsForDay.length * 8 + (dayOffset === 0 ? 0 : 5),
        isOverloaded: false,
        isRevisionOnlyDay: isRevision && lessonsForDay.length === 0,
        lessons: lessonsForDay.map((l) => ({
          id: l.id,
          title: l.title,
          status: l.status,
        })),
      });
    }

    return {
      dailyMinutes: profile.dailyMinutes || 20,
      hasOverload: false,
      scheduleDays,
    };
  }

  public getSettings() {
    const profile = this.getProfile();
    return {
      id: profile.id,
      xp: profile.xp,
      streak: profile.streak,
      bestStreak: profile.bestStreak,
      dailyGoalXp: profile.dailyGoalXp,
      timezone: profile.timezone,
      soundEnabled: profile.soundEnabled,
      theme: profile.theme,
      dailyMinutes: profile.dailyMinutes,
      examDate: profile.examDate,
      activeCourseId: 'course-networking-eduso',
      activeCourseTitle: (seedData as any).title || 'Mạng Máy Tính - Toàn Diện & Luyện Thi Eduso',
    };
  }

  public updateSettings(patch: Partial<OfflineProfile>) {
    const profile = this.getProfile();
    const updated = { ...profile, ...patch };
    this.saveProfile(updated);
    return this.getSettings();
  }

  public exportBackup() {
    this.ensureInitialized();
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      profile: this.getProfile(),
      lessons: this.getLessons(),
      item_states: this.getItemStates(),
    };
  }

  public importBackup(backupData: any) {
    if (!backupData || !backupData.profile || !backupData.lessons) {
      throw new Error('Dữ liệu sao lưu không đúng định dạng StudyApp');
    }

    if (backupData.profile) {
      localStorage.setItem(STORAGE_KEY_PREFIX + 'profile', JSON.stringify(backupData.profile));
    }
    if (backupData.lessons) {
      localStorage.setItem(STORAGE_KEY_PREFIX + 'lessons', JSON.stringify(backupData.lessons));
    }
    if (backupData.item_states) {
      localStorage.setItem(STORAGE_KEY_PREFIX + 'item_states', JSON.stringify(backupData.item_states));
    }

    return { message: 'Khôi phục toàn bộ tiến độ học tập thành công!' };
  }

  public resetAll() {
    this.seedInitialData();
    return { message: 'Đã thiết lập lại dữ liệu học tập ban đầu' };
  }
}

export const offlineStorage = new OfflineStorageService();
