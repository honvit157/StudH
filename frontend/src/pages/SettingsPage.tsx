import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../api/client';
import { 
  Settings, Volume2, VolumeX, Moon, Sun, Smartphone, Download, 
  Upload, Trash2, Check, AlertTriangle, Clock, Calendar, Sparkles,
  LogOut, RefreshCw, ShieldCheck, Eye, EyeOff, ExternalLink, Key
} from 'lucide-react';
import { isSoundMuted, setSoundMuted, playSuccessSound, triggerHaptic } from '../utils/sound';

interface SettingsData {
  id: string;
  xp: number;
  streak: number;
  bestStreak: number;
  dailyGoalXp: number;
  timezone: string;
  soundEnabled: boolean;
  theme: string;
  dailyMinutes: number;
  examDate: string | null;
  activeCourseId: string | null;
  activeCourseTitle: string | null;
  hasGeminiKey?: boolean;
  geminiApiKey?: string;
}

interface SettingsPageProps {
  onLogout: () => void;
  onRefreshAll: () => void;
}

export default function SettingsPage({ onLogout, onRefreshAll }: SettingsPageProps) {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [soundOn, setSoundOn] = useState(!isSoundMuted());
  const [selectedTheme, setSelectedTheme] = useState('system');
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Áp dụng theme vào document element
  const applyThemeToDOM = (theme: string) => {
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('studyapp_theme', theme);
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<SettingsData>('/api/settings');
      setSettings(data);
      if (data.geminiApiKey) {
        setGeminiKeyInput(data.geminiApiKey);
      }
      setSoundOn(data.soundEnabled);
      setSelectedTheme(data.theme || 'system');
      applyThemeToDOM(data.theme || 'system');
    } catch (e: any) {
      console.error(e);
      setMessage({ text: 'Không thể tải cấu hình cài đặt', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleUpdate = async (patch: Partial<SettingsData>) => {
    if (!settings) return;
    try {
      setSaving(true);
      setMessage(null);
      const updated = await apiRequest<SettingsData>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      setSettings(updated);
      setMessage({ text: 'Đã lưu thay đổi thành công!', type: 'success' });
      triggerHaptic('success');
      setTimeout(() => setMessage(null), 3000);
    } catch (e: any) {
      console.error(e);
      setMessage({ text: e.message || 'Lỗi khi lưu cài đặt', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSound = (enabled: boolean) => {
    setSoundOn(enabled);
    setSoundMuted(!enabled);
    if (enabled) {
      playSuccessSound();
    }
    handleUpdate({ soundEnabled: enabled });
  };

  const handleChangeTheme = (theme: string) => {
    setSelectedTheme(theme);
    applyThemeToDOM(theme);
    handleUpdate({ theme });
  };

  // Xuất file JSON sao lưu
  const handleExportBackup = async () => {
    try {
      const data = await apiRequest<any>('/api/export');
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `studyapp-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage({ text: 'Đã tải xuống file sao lưu JSON an toàn!', type: 'success' });
    } catch (e: any) {
      console.error(e);
      setMessage({ text: 'Lỗi khi xuất file sao lưu', type: 'error' });
    }
  };

  // Khôi phục từ file JSON
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setMessage(null);
      const text = await file.text();
      const backupData = JSON.parse(text);

      if (!backupData || !backupData.version) {
        throw new Error('Định dạng file sao lưu không hợp lệ');
      }

      const res = await apiRequest<any>('/api/import', {
        method: 'POST',
        body: JSON.stringify(backupData),
      });

      setMessage({ text: res.message || 'Khôi phục dữ liệu thành công!', type: 'success' });
      triggerHaptic('success');
      await loadSettings();
      onRefreshAll();
    } catch (e: any) {
      console.error(e);
      setMessage({ text: e.message || 'Lỗi khi đọc file khôi phục', type: 'error' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Xóa toàn bộ dữ liệu (Reset)
  const handleResetData = async () => {
    try {
      setSaving(true);
      await apiRequest('/api/settings/reset', { method: 'POST' });
      setConfirmResetOpen(false);
      setMessage({ text: 'Đã xóa toàn bộ dữ liệu học tập!', type: 'success' });
      await loadSettings();
      onRefreshAll();
    } catch (e: any) {
      console.error(e);
      setMessage({ text: 'Lỗi khi xóa dữ liệu', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div className="w-10 h-10 border-4 border-duo-green border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-3 text-xs font-bold text-slate-400">Đang tải cài đặt...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-12">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center space-x-2">
            <Settings className="w-6 h-6 text-duo-green" />
            <span>Cài đặt & Tùy chọn</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Tùy biến nhịp học, giao diện và an toàn dữ liệu
          </p>
        </div>
      </div>

      {/* Thông báo phản hồi */}
      {message && (
        <div
          className={`p-3.5 rounded-2xl flex items-center space-x-2 text-xs font-bold ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Mục AI: Cấu hình Trí tuệ Nhân tạo Google Gemini */}
      <section className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-duo-dark-border pb-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-duo-green fill-duo-green" />
            <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
              Mô hình AI (Google Gemini)
            </h2>
          </div>
          <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
            settings?.hasGeminiKey
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700'
              : 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700'
          }`}>
            {settings?.hasGeminiKey ? '✓ Đang dùng Google Gemini' : 'Đang dùng Offline Engine'}
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Cấu hình API Key giúp StudyApp phân tích sâu bài học, tự động sinh các câu hỏi trắc nghiệm thông minh, câu hỏi giải thích thực tế và loại bỏ hoàn toàn các câu hỏi ngẫu nhiên.
        </p>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
            Khóa Google Gemini API Key
          </label>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <input
                type={showGeminiKey ? 'text' : 'password'}
                value={geminiKeyInput}
                onChange={(e) => setGeminiKeyInput(e.target.value)}
                placeholder="Dán mã API Key dạng AIzaSy..."
                className="w-full px-3 py-2.5 text-xs font-mono font-medium rounded-xl border-2 border-slate-200 dark:border-duo-dark-border bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-duo-green"
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={() => handleUpdate({ geminiApiKey: geminiKeyInput.trim() })}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-duo-green text-white font-black text-xs btn-duo-green flex items-center space-x-1"
            >
              <Check className="w-4 h-4" />
              <span>Lưu Key</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-bold text-duo-blue hover:underline flex items-center space-x-1"
            >
              <span>Lấy API Key miễn phí tại Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            {settings?.hasGeminiKey && (
              <button
                onClick={() => {
                  setGeminiKeyInput('');
                  handleUpdate({ geminiApiKey: '' });
                }}
                className="text-[11px] font-bold text-rose-500 hover:underline"
              >
                Xóa Key này
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Mục 1: Nhịp học & Mục tiêu */}
      <section className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-duo-dark-border pb-3">
          <Clock className="w-5 h-5 text-duo-blue" />
          <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
            Nhịp học & Mục tiêu hàng ngày
          </h2>
        </div>

        {/* Thời gian học mỗi ngày */}
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
            Thời lượng học mỗi ngày (Khóa học hiện tại)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[10, 15, 20, 30, 45, 60].map(mins => (
              <button
                key={mins}
                type="button"
                onClick={() => handleUpdate({ dailyMinutes: mins })}
                className={`py-2 px-3 rounded-xl text-xs font-black transition border-2 ${
                  settings?.dailyMinutes === mins
                    ? 'border-duo-green bg-emerald-50 text-duo-green dark:bg-emerald-950/50'
                    : 'border-slate-200 dark:border-duo-dark-border text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {mins} phút/ngày
              </button>
            ))}
          </div>
        </div>

        {/* Mục tiêu XP mỗi ngày */}
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
            Mục tiêu XP mỗi ngày
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[10, 20, 30, 50].map(xp => (
              <button
                key={xp}
                type="button"
                onClick={() => handleUpdate({ dailyGoalXp: xp })}
                className={`py-2 px-2 rounded-xl text-xs font-black transition border-2 flex items-center justify-center space-x-1 ${
                  settings?.dailyGoalXp === xp
                    ? 'border-amber-500 bg-amber-50 text-amber-600 dark:bg-amber-950/50'
                    : 'border-slate-200 dark:border-duo-dark-border text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 fill-amber-500" />
                <span>{xp} XP</span>
              </button>
            ))}
          </div>
        </div>

        {/* Ngày thi */}
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
            Ngày thi dự kiến
          </label>
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={settings?.examDate || ''}
              onChange={e => handleUpdate({ examDate: e.target.value || null })}
              className="px-3 py-2 text-xs font-bold rounded-xl border-2 border-slate-200 dark:border-duo-dark-border bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-duo-green"
            />
          </div>
        </div>
      </section>

      {/* Mục 2: Âm thanh & Giao diện */}
      <section className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-duo-dark-border pb-3">
          <Volume2 className="w-5 h-5 text-duo-green" />
          <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
            Hiệu ứng & Giao diện
          </h2>
        </div>

        {/* Âm thanh hiệu ứng */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-black text-slate-800 dark:text-white">Âm thanh vui tươi khi trả lời</div>
            <div className="text-[11px] text-slate-400">Tạo cảm giác sảng khoái và động lực khi đúng/sai</div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => playSuccessSound()}
              className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 dark:border-duo-dark-border text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Nghe thử
            </button>
            <button
              type="button"
              onClick={() => handleToggleSound(!soundOn)}
              className={`w-12 h-7 flex items-center rounded-full p-1 transition duration-300 ${
                soundOn ? 'bg-duo-green' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-5 h-5 rounded-full shadow-md transform transition duration-300 flex items-center justify-center ${
                  soundOn ? 'translate-x-5' : 'translate-x-0'
                }`}
              >
                {soundOn ? (
                  <Volume2 className="w-3 h-3 text-duo-green" />
                ) : (
                  <VolumeX className="w-3 h-3 text-slate-400" />
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Chế độ giao diện (Theme) */}
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
            Chế độ màu sắc
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'light', label: 'Sáng', icon: Sun },
              { id: 'dark', label: 'Tối', icon: Moon },
              { id: 'system', label: 'Hệ thống', icon: Smartphone },
            ].map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleChangeTheme(t.id)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition border-2 flex items-center justify-center space-x-1.5 ${
                    selectedTheme === t.id
                      ? 'border-duo-green bg-emerald-50 text-duo-green dark:bg-emerald-950/50'
                      : 'border-slate-200 dark:border-duo-dark-border text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Mục 3: Sao lưu & Phục hồi JSON */}
      <section className="bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-duo-dark-border pb-3">
          <ShieldCheck className="w-5 h-5 text-duo-blue" />
          <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
            Sao lưu & An toàn dữ liệu
          </h2>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Toàn bộ lịch sử học tập, câu hỏi, điểm SRS và chuỗi streak đều có thể xuất ra file JSON để lưu trữ an toàn hoặc chuyển sang thiết bị khác mà không sợ mất mát.
        </p>

        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Nút Xuất JSON */}
          <button
            type="button"
            onClick={handleExportBackup}
            className="py-3 px-3 rounded-2xl border-2 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-duo-blue font-black text-xs flex items-center justify-center space-x-1.5 hover:bg-blue-100 transition shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Xuất sao lưu (JSON)</span>
          </button>

          {/* Nút Nhập JSON */}
          <button
            type="button"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            className="py-3 px-3 rounded-2xl border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-duo-green font-black text-xs flex items-center justify-center space-x-1.5 hover:bg-emerald-100 transition shadow-sm disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>{importing ? 'Đang khôi phục...' : 'Khôi phục từ JSON'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </section>

      {/* Mục 3.5: Cài đặt ứng dụng trên Điện thoại (PWA) */}
      <section className="bg-gradient-to-br from-emerald-50 to-teal-50/40 dark:from-emerald-950/30 dark:to-teal-950/20 border-2 border-emerald-200 dark:border-emerald-800/60 rounded-3xl p-5 shadow-sm space-y-3.5">
        <div className="flex items-center space-x-2 border-b border-emerald-100 dark:border-emerald-900/40 pb-2.5">
          <Smartphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
            Cài đặt lên Điện thoại (Không cần bật máy chủ)
          </h2>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
          StudyApp đã tích hợp công nghệ PWA (Progressive Web App). Bạn có thể thêm trực tiếp ứng dụng ra màn hình chính điện thoại, mở lên học mượt như app native và học được ngay cả khi không có mạng!
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <div className="p-3 rounded-2xl bg-white dark:bg-duo-dark-card border border-emerald-200/80 dark:border-emerald-800/80 space-y-1">
            <div className="text-xs font-black text-emerald-700 dark:text-emerald-400 flex items-center space-x-1">
              <span>🍏 Trên iPhone (Safari)</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              1. Mở trang web bằng Safari.<br />
              2. Bấm nút <strong>Chia sẻ (Share ⬆️)</strong> ở dưới cùng.<br />
              3. Chọn <strong>"Thêm vào MH chính" (Add to Home Screen)</strong>.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-duo-dark-card border border-emerald-200/80 dark:border-emerald-800/80 space-y-1">
            <div className="text-xs font-black text-emerald-700 dark:text-emerald-400 flex items-center space-x-1">
              <span>🤖 Trên Android (Chrome)</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              1. Mở trang web bằng Chrome.<br />
              2. Bấm menu <strong>3 dấu chấm (⋮)</strong> góc trên.<br />
              3. Chọn <strong>"Cài đặt ứng dụng"</strong> hoặc <strong>"Thêm vào Màn hình chính"</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* Mục 4: Quản lý nguy hiểm & Đăng xuất */}
      <section className="bg-white dark:bg-duo-dark-card border-2 border-rose-100 dark:border-rose-950/50 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-black text-rose-600 dark:text-rose-400">Đặt lại toàn bộ tiến độ</div>
            <div className="text-[11px] text-slate-400">Xóa các câu hỏi và đưa dữ liệu học về mức 0</div>
          </div>
          <button
            type="button"
            onClick={() => setConfirmResetOpen(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition flex items-center space-x-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Đặt lại</span>
          </button>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-duo-dark-border flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Phiên bản: StudyApp v1.0.0 (PWA)
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-duo-dark-border hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center space-x-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </section>

      {/* Modal xác nhận đặt lại */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-duo-dark-card border-2 border-rose-200 dark:border-rose-900 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-black text-slate-800 dark:text-white">Bạn có chắc chắn muốn xóa?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Hành động này sẽ xóa sạch toàn bộ khóa học, thẻ kiến thức và lịch sử ôn tập. Bạn nên tải bản sao lưu JSON trước khi thực hiện.
              </p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-duo-dark-border text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleResetData}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black hover:bg-rose-700 transition"
              >
                {saving ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
