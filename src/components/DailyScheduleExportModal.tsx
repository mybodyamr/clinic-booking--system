import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toPng } from 'html-to-image';
import { 
  X, 
  Download, 
  Image as ImageIcon, 
  Calendar, 
  CheckCircle2, 
  Eye, 
  Loader2,
  Stethoscope
} from 'lucide-react';
import { Clinic, Doctor, DailyClinicScheduleItem } from '../types';

interface DailyScheduleExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinics: Clinic[];
  doctors: Doctor[];
  scheduleItems: DailyClinicScheduleItem[];
  scheduleDate: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const DailyScheduleExportModal: React.FC<DailyScheduleExportModalProps> = ({
  isOpen,
  onClose,
  clinics,
  doctors,
  scheduleItems,
  scheduleDate,
  onSuccess,
  onError
}) => {
  const [onlyOpenClinics, setOnlyOpenClinics] = useState(true);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const tableCardRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // إعداد البيانات المراد تصديرها وفق شرط الاختيار (اسم العيادة + الطبيب المسؤول + المعاد فقط)
  const filteredItems = scheduleItems.filter(item => {
    if (onlyOpenClinics) {
      return item.isOpen;
    }
    return true;
  });

  const exportRows = filteredItems.map(item => {
    const clinic = clinics.find(c => c.id === item.clinicId);
    const doctor = doctors.find(d => d.id === item.doctorId);
    return {
      clinicName: clinic?.name || 'العيادة التخصصية',
      doctorName: doctor ? doctor.name : 'طبيب مناوب',
      timing: doctor?.scheduleHours || clinic?.workingHours || '04:00 م - 09:00 م'
    };
  });

  // وظيفة بديلة لإنشاء الصورة عبر HTML5 Canvas بدقة فائقة
  const exportImageViaCanvas = async (fileName: string) => {
    const width = 1080;
    const padding = 48;
    const rowHeight = 56;
    const headerHeight = 180;
    const footerHeight = 80;
    const totalHeight = headerHeight + 50 + (exportRows.length * rowHeight) + footerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('تعذر إنشاء الكانفاس');

    // الخلفية
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, totalHeight);

    // ترويسة البطاقة
    ctx.fillStyle = '#065f46'; // emerald-800
    ctx.fillRect(padding, padding, width - (padding * 2), 120);

    ctx.direction = 'rtl';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
    ctx.fillText('عيادات الجمعية الشرعية التخصصية', width - padding - 30, padding + 52);

    ctx.font = '20px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#a7f3d0';
    ctx.fillText(`جدول تشغيل عيادات اليوم • ${scheduleDate}`, width - padding - 30, padding + 92);

    // ترويسة الجدول
    const tableTop = padding + 140;
    const tableWidth = width - (padding * 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(padding, tableTop, tableWidth, 50);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';

    // توزيع الأعمدة: اسم العيادة (40%)، الطبيب المسؤول (32%)، المعاد (28%)
    const col1X = width - padding - 24;
    const col2X = width - padding - (tableWidth * 0.42);
    const col3X = width - padding - (tableWidth * 0.74);

    ctx.fillText('اسم العيادة', col1X, tableTop + 33);
    ctx.fillText('الطبيب المسؤول', col2X, tableTop + 33);
    ctx.fillText('المعاد', col3X, tableTop + 33);

    // الصفوف
    let currentY = tableTop + 50;
    exportRows.forEach((row, i) => {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f1f5f9';
      ctx.fillRect(padding, currentY, tableWidth, rowHeight);

      // خط فاصل
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(padding, currentY, tableWidth, rowHeight);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
      ctx.fillText(row.clinicName, col1X, currentY + 35);

      ctx.fillStyle = '#334155';
      ctx.font = '17px system-ui, -apple-system, sans-serif';
      ctx.fillText(row.doctorName, col2X, currentY + 35);

      ctx.fillStyle = '#047857';
      ctx.font = '600 17px system-ui, -apple-system, sans-serif';
      ctx.fillText(row.timing, col3X, currentY + 35);

      currentY += rowHeight;
    });

    // التذييل
    ctx.fillStyle = '#64748b';
    ctx.font = '15px system-ui, -apple-system, sans-serif';
    ctx.fillText('الجمعية الشرعية لتعاون العاملين بالكتاب والسنة • خدمة ورعاية المرضى', width - padding - 20, currentY + 45);

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    link.click();
  };

  // 2. تصدير صورة (PNG)
  const handleExportImage = async () => {
    try {
      setIsExportingImage(true);
      const fileName = `جدول_عيادات_اليوم_${scheduleDate.replace(/\//g, '-')}.png`;

      if (tableCardRef.current) {
        try {
          const dataUrl = await toPng(tableCardRef.current, {
            cacheBust: true,
            backgroundColor: '#ffffff',
            pixelRatio: 2.5
          });

          const link = document.createElement('a');
          link.download = fileName;
          link.href = dataUrl;
          link.click();

          onSuccess(`تم تنزيل صورة جدول اليوم (${fileName}) بنجاح.`);
          onClose();
          return;
        } catch (toPngErr) {
          console.warn('تعذر استخدام html-to-image، التبديل للرسم بالكانفاس:', toPngErr);
        }
      }

      // إذا لم ينجح toPng يتم استخدام الكانفاس المباشر
      await exportImageViaCanvas(fileName);
      onSuccess(`تم تنزيل صورة جدول اليوم (${fileName}) بنجاح.`);
      onClose();
    } catch (err) {
      console.error('فشل تصدير الصورة:', err);
      onError('تعذر تنزيل الصورة، يرجى المحاولة مجدداً.');
    } finally {
      setIsExportingImage(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-slate-850 w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-6"
        >
          {/* رأس النافذة */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  تنزيل جدول عيادات اليوم
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  اختر الصيغة المناسبة لتنزيل جدول اليوم ({scheduleDate})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            
            {/* خيار تصفية العيادات المفتوحة اليوم */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  نطاق التصدير:
                </span>
                <span className="text-slate-500">
                  {onlyOpenClinics ? `العيادات المفتوحة اليوم (${exportRows.length})` : `جميع العيادات المسجلة (${exportRows.length})`}
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyOpenClinics}
                  onChange={(e) => setOnlyOpenClinics(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  العيادات العاملة اليوم فقط
                </span>
              </label>
            </div>

            {/* بطاقة تنزيل الصورة PNG */}
            <div className="p-5 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-right">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0 shadow-xs">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    تنزيل جدول عيادات اليوم كـ صورة (PNG)
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    جدول منسق عالي الدقة للمشاركة والطباعة يقتصر على: 
                    <strong className="text-emerald-800 dark:text-emerald-300 mx-1">اسم العيادة • الطبيب المسؤول • المعاد</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportImage}
                disabled={isExportingImage || exportRows.length === 0}
                className="w-full sm:w-auto shrink-0 py-3 px-6 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {isExportingImage ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
                    <span>جاري إنشاء الصورة...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>تنزيل الصورة الآن (PNG)</span>
                  </>
                )}
              </button>
            </div>

            {/* معاينة الجدول المنسق والمختصر */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <Eye className="w-4 h-4 text-emerald-600" />
                <span>معاينة الجدول المُراد تصديره ({exportRows.length} عيادات):</span>
              </div>

              {/* حاوية المعاينة والتقاط الصورة */}
              <div 
                ref={tableCardRef}
                className="bg-white text-slate-900 p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4"
                dir="rtl"
              >
                {/* ترويسة البطاقة */}
                <div className="bg-emerald-800 text-white p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-900/60 flex items-center justify-center">
                      <Stethoscope className="w-6 h-6 text-emerald-200" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm sm:text-base">
                        عيادات الجمعية الشرعية التخصصية
                      </h4>
                      <p className="text-xs text-emerald-200">
                        جدول تشغيل عيادات اليوم
                      </p>
                    </div>
                  </div>
                  <div className="text-left text-xs bg-emerald-900/80 px-3 py-1.5 rounded-lg border border-emerald-700 font-mono">
                    {scheduleDate}
                  </div>
                </div>

                {/* جدول الأعمدة الثلاثة بدقة وبدون أي بيانات زيادة */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                        <th className="py-2.5 px-3">اسم العيادة</th>
                        <th className="py-2.5 px-3">الطبيب المسؤول</th>
                        <th className="py-2.5 px-3">المعاد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {exportRows.length > 0 ? (
                        exportRows.map((row, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {row.clinicName}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              {row.doctorName}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-emerald-700">
                              {row.timing}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-slate-400">
                            لا توجد عيادات مسجلة حالياً
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* تذييل البطاقة */}
                <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                  <span>الجمعية الشرعية • خدمة ورعاية المرضى</span>
                  <span>معاد الكشوفات خاضع لأولوية الحجز والحضور</span>
                </div>
              </div>
            </div>

          </div>

          {/* تذييل النافذة */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              إلغاء وإغلاق
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
