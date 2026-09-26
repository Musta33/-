import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Trash2, Copy, Image as ImageIcon, X, Loader2, HardDriveUpload, Check, Archive, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import JSZip from 'jszip';
import { api } from '../lib/api';

export function BatchUploader({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isUnzipping, setIsUnzipping] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadedResults, setUploadedResults] = useState<any[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const processIncomingFiles = async (fileList: File[]) => {
    const finalFiles: File[] = [];
    let zipCount = 0;

    for (const file of fileList) {
      if (file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
        zipCount++;
        setIsUnzipping(true);
        toast.loading(`جاري فك ضغط أرشيف الـ ZIP: ${file.name}...`, { id: 'unzip-toast' });
        try {
          const zip = await JSZip.loadAsync(file);
          const entries = Object.keys(zip.files);
          let extractedInZip = 0;

          for (const filename of entries) {
            const zipEntry = zip.files[filename];
            if (!zipEntry.dir && !filename.startsWith('__MACOSX/') && !filename.startsWith('.')) {
              const blob = await zipEntry.async('blob');
              const extractedFile = new File([blob], filename.split('/').pop() || filename, { type: blob.type || 'application/octet-stream' });
              finalFiles.push(extractedFile);
              extractedInZip++;
            }
          }
          toast.dismiss('unzip-toast');
          toast.success(`تم فك ضغط ${extractedInZip} ملف من أرشيف الـ ZIP بنجاح!`);
        } catch (err) {
          console.error('Failed to unzip file:', err);
          toast.dismiss('unzip-toast');
          toast.error(`تعذر فك ضغط ملف الـ ZIP: ${file.name}`);
        } finally {
          setIsUnzipping(false);
        }
      } else {
        finalFiles.push(file);
      }
    }

    if (finalFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...finalFiles]);
      if (zipCount === 0) {
        toast.success(`تم إدراج ${finalFiles.length} ملف بنجاح`);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files) as File[];
      await processIncomingFiles(fileList);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList = Array.from(e.dataTransfer.files) as File[];
      await processIncomingFiles(fileList);
    }
  };

  const handleDownloadSystemZip = async () => {
    setIsDownloadingZip(true);
    const toastId = toast.loading('جاري حزم وتحميل النسخة الاحتياطية للنظام بصيغة ZIP...');
    try {
      const token = localStorage.getItem('auth_token')?.replace(/^"|"$/g, '');
      const response = await fetch('/api/export-system-zip', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('فشل تحميل النسخة الاحتياطية');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `iraq_rental_backup_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.dismiss(toastId);
      toast.success('🎉 تم تحميل حزمة النظام ZIP بنجاح!');
    } catch (err: any) {
      console.error('ZIP download error:', err);
      toast.dismiss(toastId);
      toast.error('تعذر تنزيل النسخة الاحتياطية ZIP');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleStartUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('يرجى اختيار ملفات أولاً');
      return;
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: selectedFiles.length });

    try {
      const results = await api.uploadBatch(selectedFiles, (current, total) => {
        setUploadProgress({ current, total });
      });

      setUploadedResults(prev => [...results, ...prev]);
      toast.success(`🎉 اكتمل رفع ${results.length} ملف بنجاح!`);
      setSelectedFiles([]);
      setUploadProgress(null);
    } catch (err: any) {
      console.error('Batch upload failed:', err);
      toast.error(`حدث خطأ أثناء الرفع: ${err.message || 'فشل الاتصال'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyLink = (dataUrl: string, index: number) => {
    navigator.clipboard.writeText(dataUrl);
    setCopiedIndex(index);
    toast.success('تم نسخ رابط/بيانات الملف إلى الحافظة');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in" dir="rtl">
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30">
              <HardDriveUpload size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black leading-tight">مركز رفع الملفات المجمع (بدون حد 100 ملف)</h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">ارفع مئات الملفات، المستندات، وصور العقود والمركبات دفعة واحدة دون تقييد</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isUploading}
            className="p-2.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Dropzone */}
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={`border-3 border-dashed rounded-[2rem] p-8 text-center transition-all duration-300 flex flex-col items-center justify-center gap-3 relative cursor-pointer group ${
              isUploading 
                ? 'bg-slate-50 border-slate-300 opacity-60 pointer-events-none' 
                : 'border-blue-300 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/10 hover:bg-blue-50 hover:border-blue-500'
            }`}
          >
            <input 
              type="file" 
              multiple 
              id="bulk-file-input" 
              className="hidden" 
              onChange={handleFileChange}
              disabled={isUploading}
            />
            <label htmlFor="bulk-file-input" className="cursor-pointer flex flex-col items-center gap-3 w-full">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                <UploadCloud size={32} />
              </div>
              <div>
                <span className="text-base font-black text-slate-800 dark:text-neutral-100 block">اسحب وأسقط جميع ملفاتك أو ملفات المضغوطة ZIP هنا (100، 200، 500+ ملف)</span>
                <span className="text-xs text-slate-500 dark:text-neutral-400 font-bold block mt-1">أو اضغط لاختيار ملفات متعددة أو ملفات مضغوطة (.zip) من جهازك</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-full text-[11px] font-black border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 size={14} /> يدعم كل الصور والمستندات بدون حد أقصى
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-full text-[11px] font-black border border-amber-200 dark:border-amber-800">
                  <Archive size={14} /> فك ضغط واستخراج أوتوماتيكي لأرشيفات ZIP
                </span>
              </div>
            </label>
          </div>

          {/* Quick System Backup ZIP Export Action Bar */}
          <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                <Archive size={20} />
              </div>
              <div>
                <span className="text-xs font-black block">تحميل حزمة النظام الكاملة (تصدير النسخة الاحتياطية ZIP)</span>
                <span className="text-[10px] text-slate-300 font-bold block">تحميل جميع ملفات وقواعد بيانات النظام بحزمة ZIP مضغوطة واحدة</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadSystemZip}
              disabled={isDownloadingZip}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 shadow-sm"
            >
              {isDownloadingZip ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span>تنزيل النسخة الاحتياطية (ZIP)</span>
            </button>
          </div>

          {/* Upload Progress Bar */}
          {isUploading && uploadProgress && (
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-3 animate-pulse">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-blue-400" />
                  جاري معالجة ورفع الملفات إلى الخادم...
                </span>
                <span className="font-mono text-blue-400">
                  {uploadProgress.current} / {uploadProgress.total} ملف ({Math.round((uploadProgress.current / uploadProgress.total) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden p-0.5 border border-slate-700">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300" 
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Selected Files Queue */}
          {selectedFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-neutral-800">
                <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span>الملفات المجهزة للرفع:</span>
                  <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full text-xs font-mono">
                    {selectedFiles.length} ملف
                  </span>
                </h3>
                <button 
                  onClick={() => setSelectedFiles([])}
                  disabled={isUploading}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 hover:bg-rose-50 p-1.5 rounded-lg transition"
                >
                  <Trash2 size={14} /> مسح الكل
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-neutral-800/50 rounded-xl border border-slate-200/60 dark:border-neutral-800 text-xs font-bold">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-neutral-700 flex items-center justify-center shrink-0 text-slate-500">
                        {file.type.startsWith('image/') ? <ImageIcon size={16} className="text-blue-500" /> : <FileText size={16} />}
                      </div>
                      <span className="truncate max-w-xs text-slate-800 dark:text-neutral-200">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] text-slate-400 font-mono">{formatFileSize(file.size)}</span>
                      <button 
                        onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                        disabled={isUploading}
                        className="text-slate-400 hover:text-rose-600 transition"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Uploaded Files List */}
          {uploadedResults.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-neutral-800">
                <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  <span>الملفات المرفوعة بنجاح ({uploadedResults.length}):</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {uploadedResults.map((item, idx) => (
                  <div key={idx} className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold">
                    <div className="flex items-center gap-3 overflow-hidden">
                      {item.dataUrl && item.type?.startsWith('image/') ? (
                        <img src={item.dataUrl} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-emerald-300 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-700 shrink-0">
                          <FileText size={18} />
                        </div>
                      )}
                      <div className="truncate">
                        <span className="block truncate text-slate-900 dark:text-neutral-100">{item.name}</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono block mt-0.5">تم الرفع • {formatFileSize(item.size)}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleCopyLink(item.dataUrl, idx)}
                      className="p-2 bg-white dark:bg-neutral-800 hover:bg-emerald-100 text-slate-700 dark:text-neutral-200 rounded-xl border border-slate-200 dark:border-neutral-700 shrink-0 transition"
                      title="نسخ الرابط / البيانات"
                    >
                      {copiedIndex === idx ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 bg-slate-50 dark:bg-neutral-950 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <button 
            onClick={onClose}
            disabled={isUploading}
            className="px-6 py-2.5 bg-slate-200 dark:bg-neutral-800 hover:bg-slate-300 dark:hover:bg-neutral-700 text-slate-800 dark:text-neutral-200 rounded-xl text-xs font-black transition"
          >
            إغلاق
          </button>
          
          <button 
            onClick={handleStartUpload}
            disabled={isUploading || selectedFiles.length === 0}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-500/20 transition flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                جاري رفع {selectedFiles.length} ملف...
              </>
            ) : (
              <>
                <UploadCloud size={16} />
                بدء رفع {selectedFiles.length} ملف الآن
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
