import React, { useState, useRef } from 'react';
import { apiRequest } from '../api/client';
import { 
  X, UploadCloud, FileText, Calendar, Clock, Sparkles, 
  CheckCircle2, AlertCircle, Plus, Trash2, Layers 
} from 'lucide-react';

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateCourseModal({ isOpen, onClose, onSuccess }: CreateCourseModalProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [rawText, setRawText] = useState('');
  const [title, setTitle] = useState('');
  const [examDate, setExamDate] = useState('');
  const [dailyMinutes, setDailyMinutes] = useState(20);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      apiRequest<any>('/api/settings').then(res => {
        setHasGeminiKey(!!res?.hasGeminiKey);
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddFiles = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    const newFiles = Array.from(filesList);
    const validFiles: File[] = [];
    let hasOversized = false;

    newFiles.forEach((file) => {
      if (file.size > 50 * 1024 * 1024) {
        hasOversized = true;
      } else {
        // Tránh trùng lặp tên và dung lượng
        const exists = selectedFiles.some(
          (f) => f.name === file.name && f.size === file.size
        );
        if (!exists) {
          validFiles.push(file);
        }
      }
    });

    if (hasOversized) {
      setError('Một số file vượt quá giới hạn 50MB và đã bị bỏ qua.');
    } else {
      setError(null);
    }

    if (validFiles.length > 0) {
      const updated = [...selectedFiles, ...validFiles];
      setSelectedFiles(updated);

      if (!title) {
        if (updated.length === 1) {
          setTitle(updated[0].name.replace(/\.[^/.]+$/, ''));
        } else {
          setTitle(`Bộ tài liệu ôn thi (${updated.length} tài liệu)`);
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleAddFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleAddFiles(e.dataTransfer.files);
  };

  const handleRemoveFile = (indexToRemove: number) => {
    const updated = selectedFiles.filter((_, idx) => idx !== indexToRemove);
    setSelectedFiles(updated);
    if (updated.length === 0 && title.startsWith('Bộ tài liệu ôn thi')) {
      setTitle('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Vui lòng nhập tên khóa học.');
      return;
    }
    if (activeTab === 'file' && selectedFiles.length === 0) {
      setError('Vui lòng chọn ít nhất một file tài liệu (.pdf, .docx, .txt, .md).');
      return;
    }
    if (activeTab === 'text' && !rawText.trim()) {
      setError('Vui lòng dán văn bản nội dung ôn thi.');
      return;
    }

    setError(null);
    setLoading(true);
    setProgress(15);
    setProgressMsg('Đang tải tài liệu lên máy chủ...');

    try {
      const formData = new FormData();
      if (activeTab === 'file' && selectedFiles.length > 0) {
        selectedFiles.forEach((file) => {
          formData.append('files', file);
        });
      }
      if (rawText.trim()) {
        formData.append('rawText', rawText);
      }
      formData.append('title', title);
      if (examDate) {
        formData.append('examDate', examDate);
      }
      formData.append('dailyMinutes', dailyMinutes.toString());

      const res = await fetch('/api/courses', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || 'Không thể tạo khóa học.');
      }

      const data = await res.json();
      const taskId = data.taskId;

      // Bắt đầu poll tiến độ tác vụ ngầm
      const interval = setInterval(async () => {
        try {
          const taskRes = await apiRequest<any>(`/api/tasks/${taskId}`);
          setProgress(taskRes.progress || 20);
          setProgressMsg(taskRes.message || 'Đang xử lý...');

          if (taskRes.status === 'COMPLETED') {
            clearInterval(interval);
            setProgress(100);
            if (taskRes.courseId) {
              localStorage.setItem('studyapp_active_course_id', taskRes.courseId);
            }
            setTimeout(() => {
              setLoading(false);
              onSuccess();
              onClose();
            }, 600);
          } else if (taskRes.status === 'FAILED') {
            clearInterval(interval);
            setLoading(false);
            setError(taskRes.error || taskRes.message || 'Có lỗi xảy ra khi tạo khóa học.');
          }
        } catch (pollErr) {
          console.error(pollErr);
        }
      }, 1000);

    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Lỗi khi gửi yêu cầu.');
    }
  };

  const totalSizeMB = (
    selectedFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)
  ).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-duo-dark-card border-2 border-slate-200 dark:border-duo-dark-border rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <div className="inline-flex items-center space-x-1.5 text-duo-green font-bold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>AI Course Generator</span>
          </div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white">Tạo Khóa Học Từ Tài Liệu</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Tải lên cùng lúc nhiều tài liệu (PDF, Word, Text) để AI gộp kiến thức và xây dựng lộ trình Duolingo
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start space-x-2.5 text-red-600 dark:text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Loading Overlay with Progress */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="w-20 h-20 border-4 border-slate-200 dark:border-slate-800 rounded-full"></div>
              <div
                className="w-20 h-20 border-4 border-duo-green border-t-transparent rounded-full animate-spin absolute"
              ></div>
              <span className="font-black text-sm text-duo-green">{progress}%</span>
            </div>
            <div>
              <p className="font-black text-slate-800 dark:text-white text-base">{progressMsg}</p>
              <p className="text-xs text-slate-400 mt-1">Đang phân tích và bóc tách câu hỏi theo thuật toán SRS...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Tab switch */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl">
              <button
                type="button"
                onClick={() => setActiveTab('file')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1 ${
                  activeTab === 'file'
                    ? 'bg-white dark:bg-duo-dark-card text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Tải nhiều file (.pdf, .docx, .txt)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('text')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                  activeTab === 'text'
                    ? 'bg-white dark:bg-duo-dark-card text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Dán văn bản trực tiếp
              </button>
            </div>

            {/* Input File Zone */}
            {activeTab === 'file' ? (
              <div className="space-y-3">
                {/* Drag & Drop Area */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-duo-dark-border hover:border-duo-green rounded-3xl p-5 text-center cursor-pointer transition bg-slate-50/50 dark:bg-slate-900/30"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.docx,.txt,.md"
                    multiple
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-duo-green/10 text-duo-green flex items-center justify-center mx-auto mb-2">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-slate-700 dark:text-slate-300 block">
                      Kéo thả một hoặc nhiều file vào đây
                    </span>
                    <span className="text-xs text-slate-400 mt-1 block">
                      Hỗ trợ chọn nhiều file PDF, Word .docx, .txt, .md cùng lúc (Tối đa 50MB/file)
                    </span>
                  </div>
                </div>

                {/* Danh sách các file đã chọn */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        Đã chọn {selectedFiles.length} tài liệu ({totalSizeMB} MB)
                      </span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-bold text-duo-green hover:underline flex items-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm file khác</span>
                      </button>
                    </div>

                    <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                      {selectedFiles.map((file, idx) => (
                        <div
                          key={`${file.name}-${idx}`}
                          className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-duo-dark-border text-xs"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-2">
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-duo-green flex items-center justify-center flex-shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                {file.name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFile(idx);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition flex-shrink-0"
                            title="Xóa file này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Nội dung tài liệu ôn thi
                </label>
                <textarea
                  rows={5}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Dán nội dung giáo trình, đề cương ôn thi hoặc các câu hỏi vào đây..."
                  className="w-full p-3.5 rounded-2xl border-2 border-slate-200 dark:border-duo-dark-border bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-xs font-medium focus:outline-none focus:border-duo-green transition"
                />
              </div>
            )}

            {/* Course Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Tên khóa học
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Ôn Thi Chứng Chỉ AWS, Tiếng Anh B1..."
                className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 dark:border-duo-dark-border bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:border-duo-green transition"
              />
            </div>

            {/* Exam Date & Daily Minutes Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1" />
                  Ngày thi (Mục tiêu)
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-slate-200 dark:border-duo-dark-border bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:border-duo-green transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  Mỗi ngày học
                </label>
                <select
                  value={dailyMinutes}
                  onChange={(e) => setDailyMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-2xl border-2 border-slate-200 dark:border-duo-dark-border bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:border-duo-green transition"
                >
                  <option value={10}>10 phút / ngày</option>
                  <option value={15}>15 phút / ngày</option>
                  <option value={20}>20 phút / ngày</option>
                  <option value={30}>30 phút / ngày</option>
                  <option value={45}>45 phút / ngày</option>
                  <option value={60}>60 phút / ngày</option>
                </select>
              </div>
            </div>

            {/* AI Engine Status */}
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-duo-dark-border text-xs mt-1">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-duo-green" />
                <span className="font-bold text-slate-600 dark:text-slate-300">Công nghệ sinh câu hỏi:</span>
              </div>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${
                hasGeminiKey
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              }`}>
                {hasGeminiKey ? '✓ Google Gemini' : 'Offline Semantic Engine'}
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-4 rounded-2xl font-black text-white uppercase tracking-wider text-sm btn-duo-green flex items-center justify-center space-x-2 mt-2"
            >
              <Sparkles className="w-5 h-5" />
              <span>Bắt đầu tạo khóa học bằng AI</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
