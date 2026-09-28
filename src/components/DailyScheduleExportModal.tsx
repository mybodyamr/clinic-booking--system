import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toPng } from 'html-to-image';
import { 
  X, 
  Download, 
  Calendar, 
  CalendarDays,
  CheckCircle2, 
  Eye, 
  Loader2,
  Stethoscope,
  Clock,
  ShieldCheck,
  MapPin,
  Sparkles,
  Check
} from 'lucide-react';
import { Clinic, Doctor, DailyClinicScheduleItem } from '../types';
import { 
  ARABIC_DAYS, 
  getArabicDayName, 
  formatArabicFullDate, 
  isDoctorScheduledOnDate, 
  normalizeArabicDay, 
  parseDoctorShiftTimes,
  getLocalDateStr
} from '../services/scheduleService';

export type ScheduleExportMode = 'daily' | 'weekly';

interface DailyScheduleExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinics: Clinic[];
  doctors: Doctor[];
  scheduleItems: DailyClinicScheduleItem[];
  scheduleDate: string;
  initialMode?: ScheduleExportMode;
  officialWorkingHours?: string;
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
  initialMode = 'daily',
  officialWorkingHours = 'يومياً من 9:00 صباحاً حتى 10:00 مساءً',
  onSuccess,
  onError
}) => {
  const [exportMode, setExportMode] = useState<ScheduleExportMode>(initialMode);
  const [isExportingDaily, setIsExportingDaily] = useState(false);
  const [isExportingWeekly, setIsExportingWeekly] = useState(false);

  const dailyPosterRef = useRef<HTMLDivElement>(null);
  const weeklyPosterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setExportMode(initialMode);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const actualTodayStr = scheduleDate || getLocalDateStr(new Date());
  const todayDayName = getArabicDayName(actualTodayStr);
  const todayFullArabic = formatArabicFullDate(actualTodayStr);

  // ============================================================================
  // 1. استخراج العيادات المفتوحة والعاملة في اليوم الفعلي فقط (بدون أي عيادة مغلقة أو غير مجدولة اليوم)
  // ============================================================================
  const openDailyRows = clinics
    .filter(clinic => {
      if (clinic.active === false || clinic.isActive === false) return false;
      const schedItem = scheduleItems.find(i => i.clinicId === clinic.id);
      const isOpenToday = schedItem ? schedItem.isOpen : (clinic.isOpenToday !== false);
      return isOpenToday;
    })
    .map(clinic => {
      const schedItem = scheduleItems.find(i => i.clinicId === clinic.id);
      const scheduledDoc = schedItem?.doctorId
        ? doctors.find(d => d.id === schedItem.doctorId && d.clinicId === clinic.id)
        : undefined;

      // يجب أن يكون الطبيب متاحاً اليوم (ليس offline) ومجدولاً في اليوم الفعلي من الأسبوع
      const activeDoctor =
        (scheduledDoc && scheduledDoc.status !== 'offline' && isDoctorScheduledOnDate(scheduledDoc, actualTodayStr)
          ? scheduledDoc
          : undefined) ||
        doctors.find(
          d => d.clinicId === clinic.id && d.status !== 'offline' && isDoctorScheduledOnDate(d, actualTodayStr)
        );

      if (!activeDoctor) return null;

      const shift = parseDoctorShiftTimes(activeDoctor);
      const locationParts = [
        clinic.room ? (clinic.room.includes('غرفة') ? clinic.room : `غرفة ${clinic.room}`) : '',
        clinic.floor ? (clinic.floor.includes('الطابق') || clinic.floor.includes('الدور') ? clinic.floor : `الطابق ${clinic.floor}`) : ''
      ].filter(Boolean);

      return {
        clinicId: clinic.id,
        clinicName: clinic.name,
        specialty: clinic.specialty || clinic.department || 'عيادة تخصصية',
        location: locationParts.join(' • ') || 'المبنى الرئيسي',
        doctorName: activeDoctor.name.startsWith('د.') ? activeDoctor.name : `د. ${activeDoctor.name}`,
        doctorTitle: activeDoctor.title || 'استشاري / أخصائي',
        timing: shift.formattedDisplay || activeDoctor.scheduleHours || clinic.workingHours || 'من 09:00 صباحاً إلى 03:00 عصراً',
        fee: `${clinic.fee} ج.م`
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  // ============================================================================
  // 2. استخراج الجدول الأسبوعي الكامل لجميع أيام الأسبوع (السبت — الجمعة)
  // ============================================================================
  const activeClinics = clinics.filter(c => c.active !== false && c.isActive !== false);

  const weeklyClinicRows = activeClinics.flatMap(clinic => {
    const clinicDocs = doctors.filter(d => d.clinicId === clinic.id);
    const docsToUse = clinicDocs.length > 0 ? clinicDocs : [undefined];

    const locationParts = [
      clinic.room ? (clinic.room.includes('غرفة') ? clinic.room : `غرفة ${clinic.room}`) : '',
      clinic.floor ? (clinic.floor.includes('الطابق') || clinic.floor.includes('الدور') ? clinic.floor : `الطابق ${clinic.floor}`) : ''
    ].filter(Boolean);

    return docsToUse.map(doc => {
      const normalizedDocDays = (doc?.scheduleDays || clinic.workingDays || [])
        .map(d => normalizeArabicDay(d))
        .filter(Boolean);
      const workingDays = normalizedDocDays.length > 0
        ? ARABIC_DAYS.filter(day => normalizedDocDays.includes(day))
        : [...ARABIC_DAYS];

      const shift = doc ? parseDoctorShiftTimes(doc) : null;

      return {
        clinicId: clinic.id,
        clinicName: clinic.name,
        location: locationParts.join(' • ') || 'المبنى الرئيسي',
        doctorName: doc ? (doc.name.startsWith('د.') ? doc.name : `د. ${doc.name}`) : 'طبيب مناوب',
        doctorTitle: doc?.title || clinic.specialty || 'أخصائي',
        workingDays,
        timing: shift?.formattedDisplay || doc?.scheduleHours || clinic.workingHours || 'من 09:00 صباحاً إلى 03:00 عصراً',
        fee: `${clinic.fee} ج.م`
      };
    });
  });

  // توزيع العيادات حسب كل يوم من أيام الأسبوع السبعة
  const weeklyByDay = ARABIC_DAYS.map(dayName => {
    const dayClinics = weeklyClinicRows.filter(row => row.workingDays.includes(dayName));
    return {
      dayName,
      isToday: dayName === todayDayName,
      clinics: dayClinics
    };
  });

  // ============================================================================
  // الرسم الاحتياطي عالي الدقة بالكانفاس (للأجهزة التي تمنع SVG foreignObject)
  // ============================================================================
  const exportDailyViaCanvas = async (fileName: string) => {
    const width = 1280;
    const padding = 52;
    const rowHeight = 84;
    const headerHeight = 220;
    const tableHeaderHeight = 58;
    const footerHeight = 96;
    const rowsCount = Math.max(1, openDailyRows.length);
    const totalHeight = headerHeight + tableHeaderHeight + (rowsCount * rowHeight) + footerHeight + 40;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('تعذر إنشاء الكانفاس');

    // خلفية عامة
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, totalHeight);

    // ترويسة زمردية ملكية
    const grad = ctx.createLinearGradient(0, 0, width, headerHeight);
    grad.addColorStop(0, '#022c22');
    grad.addColorStop(0.5, '#064e3b');
    grad.addColorStop(1, '#065f46');
    ctx.fillStyle = grad;
    ctx.fillRect(padding, 36, width - padding * 2, 160);

    // شريط ذهبي علوي
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(padding, 36, width - padding * 2, 6);

    ctx.direction = 'rtl';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillText('مجمع عيادات الجمعية الشرعية التخصصية', width - padding - 32, 82);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
    ctx.fillText(`جدول العيادات المفتوحة اليوم (${todayDayName})`, width - padding - 32, 126);

    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 19px system-ui, -apple-system, sans-serif';
    ctx.fillText(`التاريخ الفعلي: ${todayFullArabic} (${actualTodayStr}) • العيادات العاملة اليوم فقط (${openDailyRows.length})`, width - padding - 32, 166);

    // رأس الجدول
    const tableTop = 216;
    const tableWidth = width - padding * 2;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(padding, tableTop, tableWidth, tableHeaderHeight);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    const colNumX = width - padding - 24;
    const colClinicX = width - padding - 85;
    const colDocX = width - padding - Math.round(tableWidth * 0.42);
    const colTimeX = width - padding - Math.round(tableWidth * 0.72);
    const colFeeX = padding + 110;

    ctx.fillText('م', colNumX, tableTop + 36);
    ctx.fillText('العيادة التخصصية', colClinicX, tableTop + 36);
    ctx.fillText('الطبيب المعالج', colDocX, tableTop + 36);
    ctx.fillText('مواعيد العمل اليوم', colTimeX, tableTop + 36);
    ctx.fillText('الكشف', colFeeX, tableTop + 36);

    let currentY = tableTop + tableHeaderHeight;
    openDailyRows.forEach((row, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f0fdf4';
      ctx.fillRect(padding, currentY, tableWidth, rowHeight);

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(padding, currentY, tableWidth, rowHeight);

      ctx.fillStyle = '#065f46';
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      ctx.fillText(String(idx + 1).padStart(2, '0'), colNumX, currentY + 48);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 21px system-ui, -apple-system, sans-serif';
      ctx.fillText(row.clinicName, colClinicX, currentY + 36);
      ctx.fillStyle = '#64748b';
      ctx.font = '15px system-ui, -apple-system, sans-serif';
      ctx.fillText(row.location, colClinicX, currentY + 64);

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      ctx.fillText(row.doctorName, colDocX, currentY + 36);
      ctx.fillStyle = '#047857';
      ctx.font = '15px system-ui, -apple-system, sans-serif';
      ctx.fillText(row.doctorTitle, colDocX, currentY + 64);

      ctx.fillStyle = '#065f46';
      ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
      ctx.fillText(row.timing, colTimeX, currentY + 48);

      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 19px system-ui, -apple-system, sans-serif';
      ctx.fillText(row.fee, colFeeX, currentY + 48);

      currentY += rowHeight;
    });

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(`مواعيد المركز: ${officialWorkingHours} • الحجز والكشف بأولوية الحضور في نفس يوم العيادة`, width - padding - 20, currentY + 52);

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    link.click();
  };

  const exportWeeklyViaCanvas = async (fileName: string) => {
    const width = 1400;
    const padding = 48;
    const rowHeight = 90;
    const headerHeight = 220;
    const tableHeaderHeight = 58;
    const footerHeight = 96;
    const rowsCount = Math.max(1, weeklyClinicRows.length);
    const totalHeight = headerHeight + tableHeaderHeight + (rowsCount * rowHeight) + footerHeight + 40;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('تعذر إنشاء الكانفاس');

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, totalHeight);

    const grad = ctx.createLinearGradient(0, 0, width, headerHeight);
    grad.addColorStop(0, '#022c22');
    grad.addColorStop(0.5, '#064e3b');
    grad.addColorStop(1, '#065f46');
    ctx.fillStyle = grad;
    ctx.fillRect(padding, 36, width - padding * 2, 160);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(padding, 36, width - padding * 2, 6);

    ctx.direction = 'rtl';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillText('مجمع عيادات الجمعية الشرعية التخصصية', width - padding - 32, 82);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
    ctx.fillText('الجدول الأسبوعي الشامل لعمل العيادات والأطباء (السبت — الجمعة)', width - padding - 32, 126);

    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 19px system-ui, -apple-system, sans-serif';
    ctx.fillText(`جميع أيام الأسبوع • تحديث معتمد بتاريخ ${actualTodayStr}`, width - padding - 32, 166);

    const tableTop = 216;
    const tableWidth = width - padding * 2;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(padding, tableTop, tableWidth, tableHeaderHeight);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 19px system-ui, -apple-system, sans-serif';
    const colClinicX = width - padding - 28;
    const colDocX = width - padding - Math.round(tableWidth * 0.28);
    const colDaysX = width - padding - Math.round(tableWidth * 0.52);
    const colTimeX = width - padding - Math.round(tableWidth * 0.78);
    const colFeeX = padding + 95;

    ctx.fillText('العيادة التخصصية', colClinicX, tableTop + 36);
    ctx.fillText('الطبيب المعالج', colDocX, tableTop + 36);
    ctx.fillText('أيام العمل الأسبوعية', colDaysX, tableTop + 36);
    ctx.fillText('مواعيد المناوبة', colTimeX, tableTop + 36);
    ctx.fillText('الكشف', colFeeX, tableTop + 36);

    let currentY = tableTop + tableHeaderHeight;
    weeklyClinicRows.forEach((row, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f0fdf4';
      ctx.fillRect(padding, currentY, tableWidth, rowHeight);

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(padding, currentY, tableWidth, rowHeight);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      ctx.fillText(row.clinicName, colClinicX, currentY + 38);
      ctx.fillStyle = '#64748b';
      ctx.font = '15px system-ui, -apple-system, sans-serif';
      ctx.fillText(row.location, colClinicX, currentY + 66);

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 19px system-ui, -apple-system, sans-serif';
      ctx.fillText(row.doctorName, colDocX, currentY + 38);
      ctx.fillStyle = '#047857';
      ctx.font = '15px system-ui, -apple-system, sans-serif';
      ctx.fillText(row.doctorTitle, colDocX, currentY + 66);

      ctx.fillStyle = '#065f46';
      ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
      ctx.fillText(row.workingDays.join(' • '), colDaysX, currentY + 52);

      ctx.fillStyle = '#0f766e';
      ctx.font = 'bold 17px system-ui, -apple-system, sans-serif';
      ctx.fillText(row.timing, colTimeX, currentY + 52);

      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
      ctx.fillText(row.fee, colFeeX, currentY + 52);

      currentY += rowHeight;
    });

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(`مواعيد المركز الرسمية: ${officialWorkingHours} • يفتح باب الحجز إلكترونياً وحضورياً في صباح نفس يوم العيادة`, width - padding - 20, currentY + 52);

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    link.click();
  };

  // ============================================================================
  // دوال التصدير الفعلي (اليومي والأسبوعي)
  // ============================================================================
  const handleDownloadDailyImage = async () => {
    if (openDailyRows.length === 0) {
      onError(`لا توجد عيادات مفتوحة وعاملة في هذا اليوم الفعلي (${todayDayName} ${actualTodayStr}).`);
      return;
    }

    try {
      setIsExportingDaily(true);
      setExportMode('daily');
      // إتاحة لحظة للتأكد من رسم حاوية اليوم الفعلي
      await new Promise(r => setTimeout(r, 80));

      const fileName = `جدول_العيادات_المفتوحة_${todayDayName}_${actualTodayStr}.png`;

      if (dailyPosterRef.current) {
        try {
          const dataUrl = await toPng(dailyPosterRef.current, {
            cacheBust: true,
            backgroundColor: '#ffffff',
            pixelRatio: 3
          });
          const link = document.createElement('a');
          link.download = fileName;
          link.href = dataUrl;
          link.click();

          onSuccess(`تم تنزيل صورة جدول العيادات المفتوحة لليوم الفعلي (${todayDayName}) بنجاح.`);
          return;
        } catch (err) {
          console.warn('التبديل للرسم بالكانفاس لجدول اليوم:', err);
        }
      }

      await exportDailyViaCanvas(fileName);
      onSuccess(`تم تنزيل صورة جدول العيادات المفتوحة لليوم الفعلي (${todayDayName}) بنجاح.`);
    } catch (err) {
      console.error(err);
      onError('حدث خطأ أثناء إنشاء صورة جدول اليوم.');
    } finally {
      setIsExportingDaily(false);
    }
  };

  const handleDownloadWeeklyImage = async () => {
    if (weeklyClinicRows.length === 0) {
      onError('لا توجد عيادات مسجلة لتصدير الجدول الأسبوعي.');
      return;
    }

    try {
      setIsExportingWeekly(true);
      setExportMode('weekly');
      await new Promise(r => setTimeout(r, 80));

      const fileName = `الجدول_الأسبوعي_الكامل_للعيادات_${actualTodayStr}.png`;

      if (weeklyPosterRef.current) {
        try {
          const dataUrl = await toPng(weeklyPosterRef.current, {
            cacheBust: true,
            backgroundColor: '#ffffff',
            pixelRatio: 3
          });
          const link = document.createElement('a');
          link.download = fileName;
          link.href = dataUrl;
          link.click();

          onSuccess('تم تنزيل صورة الجدول الأسبوعي الكامل لجميع أيام الأسبوع بنجاح.');
          return;
        } catch (err) {
          console.warn('التبديل للرسم بالكانفاس للجدول الأسبوعي:', err);
        }
      }

      await exportWeeklyViaCanvas(fileName);
      onSuccess('تم تنزيل صورة الجدول الأسبوعي الكامل لجميع أيام الأسبوع بنجاح.');
    } catch (err) {
      console.error(err);
      onError('حدث خطأ أثناء إنشاء صورة الجدول الأسبوعي.');
    } finally {
      setIsExportingWeekly(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]"
        >
          {/* رأس النافذة */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-950 text-amber-300 flex items-center justify-center shadow-md border border-emerald-700">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                  مركز تصدير وتنزيل جداول العيادات كـ صورة (PNG عالية الدقة)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  اختر تنزيل جدول العيادات المفتوحة في اليوم الفعلي فقط أو الجدول الشامل لأيام الأسبوع كاملة
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* محتوى النافذة القابل للتمرير */}
          <div className="p-4 sm:p-6 space-y-6 overflow-y-auto">
            
            {/* بطاقتا التحميل المباشر: 1) جدول اليوم الفعلي 2) جدول أيام الأسبوع كاملة */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* البطاقة الأولى: جدول العيادات المفتوحة في اليوم الفعلي فقط */}
              <div
                onClick={() => setExportMode('daily')}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                  exportMode === 'daily'
                    ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/35 shadow-md ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:border-emerald-400'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-800 text-amber-300">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>اليوم الفعلي: {todayDayName}</span>
                    </span>
                    <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                      {openDailyRows.length} عيادة مفتوحة اليوم
                    </span>
                  </div>

                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    1. تنزيل جدول العيادات المفتوحة اليوم كـ صورة
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    يعرض <strong className="text-emerald-800 dark:text-emerald-300">فقط العيادات المفتوحة والعاملة في اليوم الفعلي ({todayDayName})</strong> ويستبعد تلقائياً أي عيادة مغلقة أو غير مجدولة اليوم.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadDailyImage();
                  }}
                  disabled={isExportingDaily || openDailyRows.length === 0}
                  className="w-full py-3 px-4 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isExportingDaily ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      <span>جاري تجهيز صورة جدول اليوم...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-amber-300" />
                      <span>تنزيل صورة جدول عيادات اليوم ({openDailyRows.length})</span>
                    </>
                  )}
                </button>
              </div>

              {/* البطاقة الثانية: جدول أيام الأسبوع كاملة (السبت — الجمعة) */}
              <div
                onClick={() => setExportMode('weekly')}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                  exportMode === 'weekly'
                    ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/25 shadow-md ring-2 ring-amber-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:border-amber-400'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-400/40">
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>السبت — الجمعة (7 أيام)</span>
                    </span>
                    <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400">
                      شامل جميع العيادات
                    </span>
                  </div>

                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    2. تنزيل جدول أيام الأسبوع كاملة كـ صورة
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    بوستر شامل عالي الدقة يعرض <strong className="text-amber-800 dark:text-amber-300">مواعيد وأيام حضور جميع العيادات والأطباء طوال الأسبوع</strong> مع خريطة توزيع الأيام.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadWeeklyImage();
                  }}
                  disabled={isExportingWeekly || weeklyClinicRows.length === 0}
                  className="w-full py-3 px-4 bg-gradient-to-l from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-slate-950 text-xs font-extrabold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isExportingWeekly ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>جاري تجهيز صورة الجدول الأسبوعي...</span>
                    </>
                  ) : (
                    <>
                      <CalendarDays className="w-4 h-4 text-slate-950" />
                      <span>تنزيل صورة جدول الأسبوع كاملاً (PNG)</span>
                    </>
                  )}
                </button>
              </div>

            </div>

            {/* شريط التبديل بين معاينة البوستر اليومي والبوستر الأسبوعي */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-200">
                <Eye className="w-4 h-4 text-emerald-600" />
                <span>
                  {exportMode === 'daily'
                    ? `معاينة بوستر العيادات المفتوحة في اليوم الفعلي (${todayDayName} — ${openDailyRows.length} عيادات):`
                    : `معاينة بوستر جدول أيام الأسبوع كاملة (السبت إلى الجمعة):`}
                </span>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setExportMode('daily')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    exportMode === 'daily'
                      ? 'bg-emerald-800 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  معاينة جدول اليوم الفعلي
                </button>
                <button
                  type="button"
                  onClick={() => setExportMode('weekly')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    exportMode === 'weekly'
                      ? 'bg-amber-500 text-slate-950 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  معاينة جدول الأسبوع كاملاً
                </button>
              </div>
            </div>

            {/* ===================================================================== */}
            {/* المعاينة 1: بوستر جدول العيادات المفتوحة في اليوم الفعلي فقط (Daily Poster) */}
            {/* ===================================================================== */}
            {exportMode === 'daily' && (
              <div className="overflow-x-auto pb-2">
                <div
                  ref={dailyPosterRef}
                  dir="rtl"
                  className="min-w-[680px] bg-gradient-to-b from-[#F7FAF8] via-white to-[#F2F7F4] text-slate-900 rounded-3xl border-2 border-emerald-900/15 shadow-lg overflow-hidden"
                >
                  {/* الشريط الذهبي العلوي */}
                  <div className="h-2.5 bg-gradient-to-l from-amber-400 via-amber-300 to-emerald-700" />

                  {/* ترويسة البوستر الفخمة */}
                  <div className="bg-gradient-to-l from-[#03251C] via-[#064E3B] to-[#04392A] text-white p-6 sm:p-7 flex items-center justify-between gap-6 relative overflow-hidden">
                    <div className="flex items-center gap-4 z-10">
                      <div className="w-16 h-16 rounded-2xl bg-white/10 border-2 border-amber-400/60 flex items-center justify-center shadow-lg shrink-0">
                        <Stethoscope className="w-8 h-8 text-amber-300" />
                      </div>
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-300 text-[11px] font-extrabold">
                          <Sparkles className="w-3 h-3" />
                          <span>مجمع عيادات الجمعية الشرعية التخصصية</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                          جدول العيادات المفتوحة والعاملة اليوم
                        </h2>
                        <p className="text-xs text-emerald-200 font-medium">
                          بيان رسمي بالعيادات المتاحة لاستقبال المرضى في اليوم الفعلي فقط
                        </p>
                      </div>
                    </div>

                    {/* بطاقة التاريخ الفعلي */}
                    <div className="z-10 bg-white/10 backdrop-blur-md border border-amber-400/40 rounded-2xl px-4 py-3 text-center shrink-0 min-w-[175px]">
                      <div className="text-[11px] font-bold text-amber-300">
                        اليوم الفعلي للتشغيل
                      </div>
                      <div className="text-base font-black text-white mt-0.5">
                        {todayFullArabic}
                      </div>
                      <div className="mt-1.5 pt-1.5 border-t border-white/15 flex items-center justify-between text-[11px] text-emerald-200 font-mono">
                        <span>{actualTodayStr}</span>
                        <span className="bg-emerald-500/30 text-emerald-100 px-2 py-0.5 rounded-full font-sans font-bold">
                          {openDailyRows.length} عيادة عاملة
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* جسم جدول اليوم الفعلي */}
                  <div className="p-6 space-y-5">
                    {openDailyRows.length === 0 ? (
                      <div className="p-10 text-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                        <p className="font-extrabold text-sm">
                          لا توجد عيادات مفتوحة ومجدولة للعمل في هذا اليوم الفعلي ({todayDayName})
                        </p>
                        <p className="text-xs text-amber-700">
                          يمكنك فتح العيادات أو تعديل جدول أيام حضور الأطباء، أو تنزيل «جدول أيام الأسبوع كاملة».
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-emerald-900/15 overflow-hidden shadow-xs bg-white">
                        <table className="w-full text-right border-collapse">
                          <thead>
                            <tr className="bg-[#073B2C] text-white text-xs font-extrabold">
                              <th className="py-3.5 px-3 text-center w-12 text-amber-300">م</th>
                              <th className="py-3.5 px-4">العيادة التخصصية</th>
                              <th className="py-3.5 px-4">الطبيب المسؤول</th>
                              <th className="py-3.5 px-4">مواعيد العمل اليوم</th>
                              <th className="py-3.5 px-4 text-center">قيمة الكشف</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/80 text-xs">
                            {openDailyRows.map((row, idx) => (
                              <tr
                                key={row.clinicId}
                                className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F4F9F6]'}
                              >
                                <td className="py-4 px-3 text-center">
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-900 text-amber-300 font-mono font-extrabold text-xs shadow-2xs">
                                    {String(idx + 1).padStart(2, '0')}
                                  </span>
                                </td>

                                <td className="py-4 px-4">
                                  <div className="font-extrabold text-sm text-slate-900">
                                    {row.clinicName}
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1 font-medium">
                                    <MapPin className="w-3 h-3 text-emerald-700 shrink-0" />
                                    <span>{row.location}</span>
                                    <span className="mx-1 text-slate-300">•</span>
                                    <span className="text-emerald-700 font-bold">مفتوحة اليوم ✓</span>
                                  </div>
                                </td>

                                <td className="py-4 px-4">
                                  <div className="font-extrabold text-sm text-emerald-950 flex items-center gap-1.5">
                                    <Stethoscope className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                    <span>{row.doctorName}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-1 font-medium">
                                    {row.doctorTitle}
                                  </div>
                                </td>

                                <td className="py-4 px-4">
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-extrabold text-xs">
                                    <Clock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                    <span>{row.timing}</span>
                                  </span>
                                </td>

                                <td className="py-4 px-4 text-center">
                                  <span className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-amber-50 border border-amber-300/80 text-amber-900 font-mono font-extrabold text-xs">
                                    {row.fee}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* تذييل البوستر اليومي */}
                    <div className="bg-emerald-950/5 border border-emerald-900/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 text-slate-700 font-bold">
                        <ShieldCheck className="w-4 h-4 text-emerald-800 shrink-0" />
                        <span>مواعيد العمل الرسمية للمركز: {officialWorkingHours}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-600 font-bold">
                        <span>• الدخول بأولوية الحجز وتأكيد الخزينة</span>
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-900 text-amber-300 font-extrabold">
                          معتمد • إدارة عيادات الجمعية الشرعية
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===================================================================== */}
            {/* المعاينة 2: بوستر الجدول الأسبوعي الكامل لجميع أيام الأسبوع (Weekly Poster) */}
            {/* ===================================================================== */}
            {exportMode === 'weekly' && (
              <div className="overflow-x-auto pb-2">
                <div
                  ref={weeklyPosterRef}
                  dir="rtl"
                  className="min-w-[760px] bg-gradient-to-b from-[#F7FAF8] via-white to-[#F2F7F4] text-slate-900 rounded-3xl border-2 border-emerald-900/15 shadow-lg overflow-hidden"
                >
                  {/* الشريط الذهبي العلوي */}
                  <div className="h-2.5 bg-gradient-to-l from-amber-500 via-amber-300 to-emerald-800" />

                  {/* ترويسة البوستر الأسبوعي */}
                  <div className="bg-gradient-to-l from-[#03251C] via-[#064E3B] to-[#04392A] text-white p-6 sm:p-7 flex items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-amber-400/15 border-2 border-amber-400/70 flex items-center justify-center shadow-lg shrink-0">
                        <CalendarDays className="w-8 h-8 text-amber-300" />
                      </div>
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-300 text-[11px] font-extrabold">
                          <Sparkles className="w-3 h-3" />
                          <span>مجمع عيادات الجمعية الشرعية التخصصية</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                          الجدول الأسبوعي الشامل لعمل العيادات والأطباء
                        </h2>
                        <p className="text-xs text-emerald-200 font-medium">
                          دليل مواعيد وأيام حضور الأطباء الاستشاريين والأخصائيين طوال أيام الأسبوع (السبت — الجمعة)
                        </p>
                      </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md border border-amber-400/40 rounded-2xl px-4 py-3 text-center shrink-0 min-w-[175px]">
                      <div className="text-[11px] font-bold text-amber-300">
                        نطاق الجدول المعتمد
                      </div>
                      <div className="text-base font-black text-white mt-0.5">
                        أيام الأسبوع كاملة
                      </div>
                      <div className="mt-1.5 pt-1.5 border-t border-white/15 flex items-center justify-between text-[11px] text-emerald-200">
                        <span>7 أيام</span>
                        <span className="bg-amber-400/25 text-amber-200 px-2 py-0.5 rounded-full font-bold">
                          {weeklyClinicRows.length} عيادة تخصصية
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* القسم الأول: جدول العيادات ومصفوفة أيام الأسبوع السبعة */}
                  <div className="p-6 space-y-6">
                    <div className="rounded-2xl border border-emerald-900/15 overflow-hidden shadow-xs bg-white">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-[#073B2C] text-white text-xs font-extrabold">
                            <th className="py-3.5 px-3.5">العيادة التخصصية</th>
                            <th className="py-3.5 px-3.5">الطبيب المعالج</th>
                            <th className="py-3.5 px-3.5 text-center">أيام الحضور الأسبوعية (السبت — الجمعة)</th>
                            <th className="py-3.5 px-3.5">مواعيد المناوبة</th>
                            <th className="py-3.5 px-3 text-center">الكشف</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/80 text-xs">
                          {weeklyClinicRows.map((row, idx) => (
                            <tr
                              key={`${row.clinicId}-${idx}`}
                              className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F4F9F6]'}
                            >
                              <td className="py-4 px-3.5">
                                <div className="font-extrabold text-sm text-slate-900">
                                  {row.clinicName}
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1 font-medium">
                                  <MapPin className="w-3 h-3 text-emerald-700 shrink-0" />
                                  <span>{row.location}</span>
                                </div>
                              </td>

                              <td className="py-4 px-3.5">
                                <div className="font-extrabold text-sm text-emerald-950 flex items-center gap-1.5">
                                  <Stethoscope className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                  <span>{row.doctorName}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1 font-medium">
                                  {row.doctorTitle}
                                </div>
                              </td>

                              {/* شريط أيام الأسبوع السبعة البصري */}
                              <td className="py-4 px-3.5">
                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                  {ARABIC_DAYS.map(day => {
                                    const isWorking = row.workingDays.includes(day);
                                    return (
                                      <span
                                        key={day}
                                        className={`px-2 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-0.5 border ${
                                          isWorking
                                            ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                                            : 'bg-slate-100 text-slate-400 border-slate-200/80 opacity-65'
                                        }`}
                                      >
                                        {isWorking && <Check className="w-3 h-3 text-amber-300 stroke-[3]" />}
                                        <span>{day}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              </td>

                              <td className="py-4 px-3.5">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-extrabold text-[11px]">
                                  <Clock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                  <span>{row.timing}</span>
                                </span>
                              </td>

                              <td className="py-4 px-3 text-center">
                                <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-300/80 text-amber-900 font-mono font-extrabold text-xs">
                                  {row.fee}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* القسم الثاني: خريطة العيادات العاملة موزعة حسب كل يوم من أيام الأسبوع */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-xs text-emerald-950 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-emerald-700" />
                          <span>توزيع العيادات العاملة حسب أيام الأسبوع:</span>
                        </h4>
                        <span className="text-[11px] text-slate-500 font-medium">
                          يُفتح باب الحجز إلكترونياً وحضورياً في صباح نفس يوم العيادة
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                        {weeklyByDay.map(dayGroup => (
                          <div
                            key={dayGroup.dayName}
                            className={`rounded-2xl border p-3 flex flex-col justify-between space-y-2 ${
                              dayGroup.clinics.length > 0
                                ? 'bg-white border-emerald-200 shadow-2xs'
                                : 'bg-slate-50 border-slate-200 opacity-75'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                <span className="font-black text-xs text-emerald-950">
                                  {dayGroup.dayName}
                                </span>
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                                  {dayGroup.clinics.length} عيادة
                                </span>
                              </div>

                              {dayGroup.clinics.length === 0 ? (
                                <div className="text-[11px] text-slate-400 py-3 text-center font-medium">
                                  إجازة أسبوعية
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {dayGroup.clinics.map((c, i) => (
                                    <div
                                      key={i}
                                      className="p-1.5 rounded-xl bg-[#F4F9F6] border border-emerald-100 text-[10px] space-y-0.5"
                                    >
                                      <div className="font-extrabold text-slate-900 leading-snug">
                                        {c.clinicName.replace('عيادة ', '')}
                                      </div>
                                      <div className="text-emerald-800 font-bold truncate">
                                        {c.doctorName}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* تذييل البوستر الأسبوعي */}
                    <div className="bg-emerald-950/5 border border-emerald-900/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 text-slate-700 font-bold">
                        <ShieldCheck className="w-4 h-4 text-emerald-800 shrink-0" />
                        <span>مواعيد العمل الرسمية للمركز: {officialWorkingHours}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-600 font-bold">
                        <span>• الحجز متاح في صباح يوم تواجد العيادة</span>
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-900 text-amber-300 font-extrabold">
                          الجدول الأسبوعي المعتمد • عيادات الجمعية الشرعية
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* تذييل النافذة */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              يتم تصدير الصور بجودة فائقة الوضوح (3x Ultra HD PNG) جاهزة للطباعة أو النشر على واتساب وفيسبوك
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-extrabold rounded-xl transition-all cursor-pointer"
            >
              إغلاق النافذة
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
