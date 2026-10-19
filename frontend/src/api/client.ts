import { offlineStorage } from '../services/offlineStorage';

// Detection of backend server availability
let isBackendAvailable: boolean | null = null;
let backendCheckPromise: Promise<boolean> | null = null;

async function checkBackend(): Promise<boolean> {
  // If hosted outside localhost (e.g. Vercel, GitHub Pages), always use offline client engine
  if (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 800);
    const res = await fetch('/api/auth/status', {
      signal: controller.signal,
      credentials: 'include',
    });
    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function getBackendStatus(): Promise<boolean> {
  if (isBackendAvailable !== null) return isBackendAvailable;
  if (!backendCheckPromise) {
    backendCheckPromise = checkBackend().then((available) => {
      isBackendAvailable = available;
      if (!available) {
        console.log('⚡ [StudyApp] Khởi động chế độ Độc lập (Offline-First) - Không cần máy chủ.');
      }
      return available;
    });
  }
  return backendCheckPromise;
}

export function isOfflineMode(): boolean {
  return isBackendAvailable === false;
}

// Router for offline mock engine matching all REST endpoints
function handleOfflineRoute(endpoint: string, options: RequestInit = {}): any {
  const method = (options.method || 'GET').toUpperCase();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  let body: any = null;
  if (options.body && typeof options.body === 'string') {
    try {
      body = JSON.parse(options.body);
    } catch {
      body = options.body;
    }
  }

  // 1. Auth routes
  if (cleanEndpoint === '/api/auth/status') {
    return offlineStorage.getAuthStatus();
  }
  if (cleanEndpoint === '/api/login') {
    return offlineStorage.login(body?.password);
  }
  if (cleanEndpoint === '/api/logout') {
    return offlineStorage.logout();
  }

  // 2. Course & Path routes
  if (cleanEndpoint === '/api/courses' && method === 'GET') {
    return offlineStorage.getCourses();
  }
  if (cleanEndpoint.startsWith('/api/courses/') && cleanEndpoint.endsWith('/relock')) {
    const courseId = cleanEndpoint.split('/')[3];
    return offlineStorage.relockCourse(courseId);
  }
  if (cleanEndpoint.startsWith('/api/courses/') && cleanEndpoint.endsWith('/unlock-all')) {
    const courseId = cleanEndpoint.split('/')[3];
    return offlineStorage.unlockAllCourse(courseId);
  }
  if (cleanEndpoint.startsWith('/api/courses/') && cleanEndpoint.endsWith('/reschedule')) {
    return offlineStorage.getSchedule();
  }
  if (cleanEndpoint.startsWith('/api/courses/') && cleanEndpoint.endsWith('/path')) {
    const courseId = cleanEndpoint.split('/')[3];
    return offlineStorage.getCoursePath(courseId);
  }
  if (cleanEndpoint.startsWith('/api/courses/') && method === 'DELETE') {
    return { message: 'Đã xóa môn học' };
  }

  // 3. Lesson routes
  if (cleanEndpoint.startsWith('/api/lessons/') && cleanEndpoint.endsWith('/unlock')) {
    const lessonId = cleanEndpoint.split('/')[3];
    return offlineStorage.unlockLesson(lessonId);
  }

  // 4. Session routes
  if (cleanEndpoint.startsWith('/api/session/lesson/')) {
    const lessonId = cleanEndpoint.replace('/api/session/lesson/', '');
    return offlineStorage.getLessonSession(lessonId);
  }
  if (cleanEndpoint === '/api/session/today') {
    return offlineStorage.getTodaySession();
  }
  if (cleanEndpoint === '/api/session/answer' && method === 'POST') {
    return offlineStorage.processAnswer(body);
  }
  if (cleanEndpoint === '/api/session/finish' && method === 'POST') {
    return offlineStorage.finishSession(body);
  }

  // 5. Stats & Schedule routes
  if (cleanEndpoint === '/api/stats') {
    return offlineStorage.getStats();
  }
  if (cleanEndpoint === '/api/schedule') {
    return offlineStorage.getSchedule();
  }

  // 6. Settings, Backup & Reset routes
  if (cleanEndpoint === '/api/settings') {
    if (method === 'PUT' || method === 'POST') {
      return offlineStorage.updateSettings(body);
    }
    return offlineStorage.getSettings();
  }
  if (cleanEndpoint === '/api/settings/reset') {
    return offlineStorage.resetAll();
  }
  if (cleanEndpoint === '/api/export') {
    return offlineStorage.exportBackup();
  }
  if (cleanEndpoint === '/api/import') {
    return offlineStorage.importBackup(body);
  }

  console.warn(`[StudyApp Offline] Tuyến đường chưa hỗ trợ: ${method} ${cleanEndpoint}`);
  return { success: true };
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const backendAvailable = await getBackendStatus();

  // If backend is not available, execute locally in browser immediately
  if (!backendAvailable) {
    try {
      const offlineResult = handleOfflineRoute(endpoint, options);
      return offlineResult as T;
    } catch (err: any) {
      console.error('[StudyApp Offline Error]', err);
      throw new Error(err.message || 'Lỗi xử lý dữ liệu offline');
    }
  }

  // Otherwise, backend is available on localhost -> send network fetch with fallback
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // Returned HTML or other format (e.g. 404 rewrite) -> fallback to offline
      return handleOfflineRoute(endpoint, options) as T;
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage = data?.message || `Lỗi hệ thống (${response.status})`;
      throw new Error(errorMessage);
    }

    return data as T;
  } catch (networkErr: any) {
    // If backend goes down during session, transparently handle with offline storage
    console.warn(`[StudyApp] Backend không phản hồi, tự động chuyển sang chế độ Offline cho: ${endpoint}`);
    isBackendAvailable = false;
    return handleOfflineRoute(endpoint, options) as T;
  }
}
