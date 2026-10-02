import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toPng } from 'html-to-image';
import { 
  X, 
  Download, 
  Calendar, 
  CalendarDays,
  Eye, 
  Loader2,
  Stethoscope,
  MapPin,
  PhoneCall
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
  supportInfoText?: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * تحويل صيغة الموعد الطويلة إلى صيغة مختصرة وأنيقة مثل البوستر المرجعي:
 * مثال: "من 09:00 صباحاً إلى 06:00 عصراً" -> "9:00 ص - 6:00 م"
 */
function formatCompactPosterTiming(rawTiming: string): string {
  if (!rawTiming) return '9 ص - 9 م';
  let s = rawTiming.trim();
  s = s
    .replace(/من\s+/g, '')
    .replace(/\s+(إلى|الى|حتى)\s+/g, ' - ')
    .replace(/صباحاً|صباحا/g, 'ص')
    .replace(/ظهراً|ظهرا/g, 'ظ')
    .replace(/عصراً|عصرا/g, 'عصراً')
    .replace(/مساءً|مساءا|مساء/g, 'م')
    .replace(/\b0(\d):00\b/g, '$1')
    .replace(/\b(\d{2}):00\b/g, '$1')
    .replace(/\b0(\d):(\d{2})\b/g, '$1:$2');
  return s;
}

/**
 * اختصار اسم العيادة ليظهر كاسم تخصص أنيق ومباشر في عمود "التخصص"
 */
function formatSpecialtyDisplayName(clinicName: string): string {
  if (!clinicName) return 'عيادة تخصصية';
  const cleaned = clinicName.replace(/^عياد(ة|ات)\s+/i, '').trim();
  return cleaned || clinicName;
}

/**
 * اختصار عرض أيام العمل في الجدول الأسبوعي بشكل ملموم وأنيق
 */
function formatCompactWorkingDays(days: string[]): string {
  if (!days || days.length === 0) return 'طوال الأسبوع';
  if (days.length === 7) return 'يومياً (طوال الأسبوع)';
  if (days.length === 6 && !days.includes('الجمعة')) return 'يومياً عدا الجمعة';
  return days.join(' - ');
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
  supportInfoText = '01000000000',
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

  // استخراج رقم/نص التواصل والاستعلام بشكل نظيف للفوتر
  const contactDisplayLine = (() => {
    const raw = (supportInfoText || '').trim();
    if (!raw) return officialWorkingHours;
    // استخراج الأرقام الهاتفية إن وجدت أو عرض النص المختصر
    const phoneMatches = raw.match(/\d[\d\s-]{6,}\d/g);
    if (phoneMatches && phoneMatches.length > 0) {
      return phoneMatches.map(p => p.trim()).join(' - ');
    }
    return raw.length > 48 ? `${raw.slice(0, 48)}...` : raw;
  })();

  // ============================================================================
  // 1. استخراج صفوف جدول اليوم الفعلي (العيادات المفتوحة والأطباء المتاحين اليوم)
  // ============================================================================
  const openDailyRows = clinics
    .filter(clinic => {
      if (clinic.active === false || clinic.isActive === false) return false;
      const schedItem = scheduleItems.find(i => i.clinicId === clinic.id);
      const isOpenToday = schedItem ? schedItem.isOpen : (clinic.isOpenToday !== false);
      return isOpenToday;
    })
    .flatMap(clinic => {
      const schedItem = scheduleItems.find(i => i.clinicId === clinic.id);
      const scheduledDoc = schedItem?.doctorId
        ? doctors.find(d => d.id === schedItem.doctorId && d.clinicId === clinic.id)
        : undefined;

      // جمع كل أطباء العيادة المتاحين والمجدولين في هذا اليوم
      const clinicScheduledDocs = doctors.filter(
        d => d.clinicId === clinic.id && d.status !== 'offline' && isDoctorScheduledOnDate(d, actualTodayStr)
      );

      let docsForToday: Doctor[] = [];
      if (clinicScheduledDocs.length > 0) {
        docsForToday = clinicScheduledDocs;
      } else if (scheduledDoc && scheduledDoc.status !== 'offline' && isDoctorScheduledOnDate(scheduledDoc, actualTodayStr)) {
        docsForToday = [scheduledDoc];
      }

      return docsForToday.map(activeDoctor => {
        const shift = parseDoctorShiftTimes(activeDoctor);
        const rawTiming = shift.formattedDisplay || activeDoctor.scheduleHours || clinic.workingHours || '9:00 ص - 3:00 م';

        return {
          rowKey: `${clinic.id}-${activeDoctor.id}`,
          clinicId: clinic.id,
          clinicName: formatSpecialtyDisplayName(clinic.name),
          doctorName: activeDoctor.name.startsWith('د.') ? activeDoctor.name : `د. ${activeDoctor.name}`,
          timing: formatCompactPosterTiming(rawTiming),
          fee: `${clinic.fee} ج.م`
        };
      });
    });

  // ============================================================================
  // 2. استخراج الجدول الأسبوعي الكامل لجميع العيادات والأطباء
  // ============================================================================
  const activeClinics = clinics.filter(c => c.active !== false && c.isActive !== false);

  const weeklyClinicRows = activeClinics.flatMap(clinic => {
    const clinicDocs = doctors.filter(d => d.clinicId === clinic.id);
    const docsToUse = clinicDocs.length > 0 ? clinicDocs : [undefined];

    return docsToUse.map((doc, idx) => {
      const normalizedDocDays = (doc?.scheduleDays || clinic.workingDays || [])
        .map(d => normalizeArabicDay(d))
        .filter(Boolean);
      const workingDays = normalizedDocDays.length > 0
        ? ARABIC_DAYS.filter(day => normalizedDocDays.includes(day))
        : [...ARABIC_DAYS];

      const shift = doc ? parseDoctorShiftTimes(doc) : null;
      const rawTiming = shift?.formattedDisplay || doc?.scheduleHours || clinic.workingHours || '9:00 ص - 3:00 م';

      return {
        rowKey: `${clinic.id}-${doc?.id || idx}`,
        clinicId: clinic.id,
        clinicName: formatSpecialtyDisplayName(clinic.name),
        doctorName: doc ? (doc.name.startsWith('د.') ? doc.name : `د. ${doc.name}`) : 'طبيب مناوب',
        workingDays,
        workingDaysText: formatCompactWorkingDays(workingDays),
        timing: formatCompactPosterTiming(rawTiming),
        fee: `${clinic.fee} ج.م`
      };
    });
  });

  // ============================================================================
  // الرسم الاحتياطي عالي الدقة بالكانفاس (مطابق 100% للبوستر الكحلي الملكي)
  // ============================================================================
  const renderRoyalNavyPosterCanvas = async (
    mode: ScheduleExportMode,
    fileName: string
  ) => {
    const rows = mode === 'daily' ? openDailyRows : weeklyClinicRows;
    const width = mode === 'daily' ? 960 : 1120;
    const tableMarginX = 48;
    const tableWidth = width - tableMarginX * 2;
    const headerTopHeight = 230;
    const tableHeaderHeight = 58;
    const rowHeight = 56;
    const rowsCount = Math.max(1, rows.length);
    const tableHeight = tableHeaderHeight + rowsCount * rowHeight;
    const footerHeight = 92;
    const bottomSpaceBeforeFooter = 38;
    const totalHeight = headerTopHeight + tableHeight + bottomSpaceBeforeFooter + footerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('تعذر إنشاء الكانفاس');

    // 1. الخلفية العامة الفاتحة
    ctx.fillStyle = '#f2f6fb';
    ctx.fillRect(0, 0, width, totalHeight);

    // 2. الهيدر الكحلي الملكي المنحني
    const navyGrad = ctx.createLinearGradient(0, 0, width, headerTopHeight + 90);
    navyGrad.addColorStop(0, '#04162e');
    navyGrad.addColorStop(0.5, '#072448');
    navyGrad.addColorStop(1, '#0b3262');
    ctx.fillStyle = navyGrad;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width, headerTopHeight + 35);
    ctx.quadraticCurveTo(width / 2, headerTopHeight + 115, 0, headerTopHeight + 35);
    ctx.closePath();
    ctx.fill();

    // 3. شعار المعين الطبي على اليمين + الخط الفاصل الرأسي
    const logoCenterX = width - 125;
    const logoCenterY = 95;

    ctx.save();
    ctx.translate(logoCenterX, logoCenterY);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.fillRect(-44, -44, 88, 88);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-36, -36, 72, 72);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(logoCenterX, logoCenterY, 28, 0, Math.PI * 2);
    ctx.fillStyle = '#072448';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px Tahoma, Arial, sans-serif';
    ctx.fillText('عيادات الجمعية الشرعية', logoCenterX, 165);
    ctx.fillStyle = '#93c5fd';
    ctx.font = 'bold 12px Tahoma, Arial, sans-serif';
    ctx.fillText('بأوسيم', logoCenterX, 184);

    // الخط الرأسي الفاصل
    const dividerX = width - 235;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(dividerX, 45);
    ctx.lineTo(dividerX, 188);
    ctx.stroke();

    // العنوان الرئيسي على يسار الخط الفاصل
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Tahoma, Arial, sans-serif';
    ctx.fillText('عيادات الجمعية الشرعية -', dividerX - 24, 102);

    ctx.fillStyle = '#dbeafe';
    ctx.font = 'bold 31px Tahoma, Arial, sans-serif';
    const subHeaderTitle =
      mode === 'daily'
        ? `جدول مواعيد الأطباء [يوم ${todayDayName}]`
        : 'جدول مواعيد الأطباء [الأسبوعي الشامل]';
    ctx.fillText(subHeaderTitle, dividerX - 24, 154);

    // 4. الجدول المسطر الكلاسيكي
    const tableTop = 212;
    ctx.fillStyle = '#06203f';
    ctx.fillRect(tableMarginX, tableTop, tableWidth, tableHeaderHeight);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(tableMarginX, tableTop, tableWidth, tableHeaderHeight);

    // تقسيم الأعمدة من اليمين إلى اليسار
    const colRatios =
      mode === 'daily'
        ? [0.28, 0.34, 0.24, 0.14] // التخصص | اسم الطبيب | الموعد | الكشف
        : [0.22, 0.26, 0.24, 0.17, 0.11]; // التخصص | اسم الطبيب | أيام العمل | الموعد | الكشف
    const colHeaders =
      mode === 'daily'
        ? ['التخصص', 'اسم الطبيب', 'الموعد', 'الكشف']
        : ['التخصص', 'اسم الطبيب', 'أيام العمل', 'الموعد', 'الكشف'];

    const colBounds: { right: number; left: number; center: number }[] = [];
    let currentRight = width - tableMarginX;
    for (const ratio of colRatios) {
      const colW = Math.round(tableWidth * ratio);
      const left = currentRight - colW;
      colBounds.push({
        right: currentRight,
        left,
        center: left + colW / 2
      });
      currentRight = left;
    }
    if (colBounds.length > 0) {
      colBounds[colBounds.length - 1].left = tableMarginX;
      colBounds[colBounds.length - 1].center =
        (colBounds[colBounds.length - 1].right + tableMarginX) / 2;
    }

    // عناوين الأعمدة والخطوط الفاصلة البيضاء
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Tahoma, Arial, sans-serif';
    colHeaders.forEach((h, i) => {
      const b = colBounds[i];
      ctx.fillText(h, b.center, tableTop + 37);
      if (i < colHeaders.length - 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(b.left, tableTop);
        ctx.lineTo(b.left, tableTop + tableHeaderHeight);
        ctx.stroke();
      }
    });

    // صفوف البيانات
    let curY = tableTop + tableHeaderHeight;
    rows.forEach((row: any, idx: number) => {
      ctx.fillStyle = idx % 2 === 0 ? '#e3eef9' : '#f1f7fd';
      ctx.fillRect(tableMarginX, curY, tableWidth, rowHeight);

      ctx.strokeStyle = '#7fa3c7';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(tableMarginX, curY, tableWidth, rowHeight);

      const cellValues =
        mode === 'daily'
          ? [row.clinicName, row.doctorName, row.timing, row.fee]
          : [row.clinicName, row.doctorName, row.workingDaysText, row.timing, row.fee];

      cellValues.forEach((val: string, colIdx: number) => {
        const b = colBounds[colIdx];
        ctx.fillStyle = '#071c35';
        ctx.font = colIdx === 0 || colIdx === 1 ? 'bold 20px Tahoma, Arial, sans-serif' : 'bold 18px Tahoma, Arial, sans-serif';
        ctx.fillText(val, b.center, curY + 35);

        if (colIdx < cellValues.length - 1) {
          ctx.strokeStyle = '#7fa3c7';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(b.left, curY);
          ctx.lineTo(b.left, curY + rowHeight);
          ctx.stroke();
        }
      });

      curY += rowHeight;
    });

    // إطار خارجي للجدول بالكامل
    ctx.strokeStyle = '#06203f';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(tableMarginX, tableTop, tableWidth, tableHeight);

    // 5. الشريط السفلي الكحلي الملكي (الفوتر)
    const footerTop = totalHeight - footerHeight;
    ctx.fillStyle = '#06203f';
    ctx.fillRect(0, footerTop, width, footerHeight);

    // يمين الفوتر: موقعنا
    ctx.textAlign = 'right';
    ctx.fillStyle = '#93c5fd';
    ctx.font = 'bold 17px Tahoma, Arial, sans-serif';
    ctx.fillText('موقعنا :', width - 48, footerTop + 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Tahoma, Arial, sans-serif';
    ctx.fillText('عيادات الجمعية الشرعية بأوسيم', width - 48, footerTop + 66);

    // منتصف الفوتر: شارة الوسط
    const badgeW = 230;
    const badgeH = 44;
    const badgeX = width / 2 - badgeW / 2;
    const badgeY = footerTop + (footerHeight - badgeH) / 2;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px Tahoma, Arial, sans-serif';
    ctx.fillText(actualTodayStr, width / 2, badgeY + 28);

    // يسار الفوتر: للتواصل والاستعلام
    ctx.textAlign = 'left';
    ctx.fillStyle = '#93c5fd';
    ctx.font = 'bold 17px Tahoma, Arial, sans-serif';
    ctx.fillText('للتواصل والاستعلام :', 48, footerTop + 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 19px Tahoma, Arial, sans-serif';
    ctx.fillText(contactDisplayLine, 48, footerTop + 66);

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
      await new Promise(r => setTimeout(r, 80));

      const fileName = `جدول_العيادات_المفتوحة_${todayDayName}_${actualTodayStr}.png`;

      if (dailyPosterRef.current) {
        try {
          const dataUrl = await toPng(dailyPosterRef.current, {
            cacheBust: true,
            backgroundColor: '#f2f6fb',
            pixelRatio: 3
          });
          const link = document.createElement('a');
          link.download = fileName;
          link.href = dataUrl;
          link.click();

          onSuccess(`تم تنزيل بوستر جدول مواعيد الأطباء [يوم ${todayDayName}] بنجاح.`);
          return;
        } catch (err) {
          console.warn('التبديل للرسم بالكانفاس لجدول اليوم:', err);
        }
      }

      await renderRoyalNavyPosterCanvas('daily', fileName);
      onSuccess(`تم تنزيل بوستر جدول مواعيد الأطباء [يوم ${todayDayName}] بنجاح.`);
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
            backgroundColor: '#f2f6fb',
            pixelRatio: 3
          });
          const link = document.createElement('a');
          link.download = fileName;
          link.href = dataUrl;
          link.click();

          onSuccess('تم تنزيل بوستر الجدول الأسبوعي الشامل للعيادات بنجاح.');
          return;
        } catch (err) {
          console.warn('التبديل للرسم بالكانفاس للجدول الأسبوعي:', err);
        }
      }

      await renderRoyalNavyPosterCanvas('weekly', fileName);
      onSuccess('تم تنزيل بوستر الجدول الأسبوعي الشامل للعيادات بنجاح.');
    } catch (err) {
      console.error(err);
      onError('حدث خطأ أثناء إنشاء صورة الجدول الأسبوعي.');
    } finally {
      setIsExportingWeekly(false);
    }
  };

  /**
   * مكون الهيدر الكحلي الملكي الموحد (مطابق للصورة المرجعية تماماً)
   */
  const renderPosterHeader = (subtitleBracketText: string) => (
    <div className="relative bg-gradient-to-b from-[#04152b] via-[#072448] to-[#0b3160] text-white pt-7 pb-16 px-7 overflow-hidden">
      {/* زخرفة هندسية طبية خفيفة في الخلفية */}
      <div className="absolute -left-10 -top-10 w-44 h-44 rotate-45 border-[16px] border-sky-400/5 pointer-events-none" />
      <div className="absolute left-12 top-16 w-28 h-28 rotate-45 bg-sky-400/5 pointer-events-none" />

      <div className="relative z-10 flex items-center justify-between gap-5">
        {/* يمين الهيدر: الشعار الهندسي المعين + اسم الجمعية */}
        <div className="flex items-center gap-5 shrink-0">
          <div className="flex flex-col items-center text-center">
            <div className="relative w-20 h-20 flex items-center justify-center">
              {/* المربعات المائلة (المعين الطبي) */}
              <div className="absolute inset-1.5 rotate-45 rounded-lg bg-sky-400/20 border-2 border-sky-300/70 shadow-md" />
              <div className="absolute inset-3 rotate-12 rounded-lg bg-blue-500/20 border border-white/30" />
              {/* الدائرة الطبية الوسطى */}
              <div className="relative z-10 w-12 h-12 rounded-full bg-[#06203f] border-2 border-white flex items-center justify-center shadow-inner">
                <Stethoscope className="w-6 h-6 text-sky-300" />
              </div>
            </div>
            <span className="text-[12px] font-extrabold text-white tracking-tight mt-1 leading-tight">
              عيادات الجمعية الشرعية
            </span>
            <span className="text-[10px] font-bold text-sky-300 leading-tight">
              بأوسيم
            </span>
          </div>

          {/* الخط الرأسي الأبيض الفاصل */}
          <div className="w-[2.5px] h-24 bg-white/80 rounded-full" />
        </div>

        {/* يسار الخط الفاصل: العنوان الرئيسي والفرعي */}
        <div className="flex-1 text-right space-y-2 pr-1">
          <h2 className="text-3xl sm:text-[34px] font-black text-white leading-tight tracking-tight drop-shadow-xs">
            عيادات الجمعية الشرعية -
          </h2>
          <div className="text-xl sm:text-[26px] font-extrabold text-sky-100 leading-snug">
            {subtitleBracketText}
          </div>
          <div className="text-xs font-bold text-sky-300/90 pt-0.5">
            التاريخ: {todayFullArabic} ({actualTodayStr})
          </div>
        </div>
      </div>

      {/* القوس المنحني السفلي للهيدر الكحلي */}
      <div
        className="absolute -bottom-8 left-0 right-0 h-16 bg-[#f2f6fb]"
        style={{
          borderTopLeftRadius: '50% 100%',
          borderTopRightRadius: '50% 100%'
        }}
      />
    </div>
  );

  /**
   * مكون الشريط السفلي الكحلي الملكي الموحد (الفوتر)
   */
  const renderPosterFooter = () => (
    <div className="bg-[#06203f] text-white px-6 py-4 border-t-2 border-[#0b3160] flex items-center justify-between gap-4">
      {/* اليمين: موقعنا */}
      <div className="flex items-center gap-2.5 text-right">
        <div className="w-9 h-9 rounded-full bg-white/10 border border-sky-300/40 flex items-center justify-center shrink-0">
          <MapPin className="w-5 h-5 text-sky-300" />
        </div>
        <div>
          <div className="text-xs font-extrabold text-sky-300 leading-tight">
            موقعنا :
          </div>
          <div className="text-sm sm:text-[15px] font-black text-white mt-0.5">
            عيادات الجمعية الشرعية بأوسيم
          </div>
        </div>
      </div>

      {/* المنتصف: شارة الحجز الرسمية */}
      <div className="px-5 py-1.5 rounded-full border-2 border-white/90 bg-[#072448] text-white font-black text-xs sm:text-sm tracking-wide shadow-sm shrink-0 text-center">
        عيادات الجمعية الشرعية بأوسيم
      </div>

      {/* اليسار: للتواصل والاستعلام */}
      <div className="flex items-center gap-2.5 text-left" dir="ltr">
        <div className="w-9 h-9 rounded-full bg-white/10 border border-sky-300/40 flex items-center justify-center shrink-0">
          <PhoneCall className="w-4 h-4 text-sky-300" />
        </div>
        <div dir="rtl" className="text-left">
          <div className="text-xs font-extrabold text-sky-300 leading-tight">
            للتواصل والاستعلام :
          </div>
          <div className="text-sm sm:text-[15px] font-black text-white font-mono mt-0.5" dir="ltr">
            {contactDisplayLine}
          </div>
        </div>
      </div>
    </div>
  );

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
              <div className="w-11 h-11 rounded-2xl bg-[#072448] text-sky-300 flex items-center justify-center shadow-md border border-sky-400/30">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                  تنزيل بوستر جدول مواعيد الأطباء (صورة PNG عالية الدقة)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  تصميم البوستر الكحلي الملكي المعتمد — جاهز للنشر المباشر أو الطباعة
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
              
              {/* البطاقة الأولى: جدول مواعيد الأطباء لليوم الفعلي */}
              <div
                onClick={() => setExportMode('daily')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3.5 ${
                  exportMode === 'daily'
                    ? 'border-[#072448] bg-sky-50/70 dark:bg-slate-800 shadow-md'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:border-sky-400'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-[#072448] text-sky-200">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>جدول مواعيد [يوم {todayDayName}]</span>
                    </span>
                    <span className="text-xs font-extrabold text-[#072448] dark:text-sky-300">
                      {openDailyRows.length} طبيب / عيادة
                    </span>
                  </div>

                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    1. تنزيل جدول مواعيد اليوم كـ صورة
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    بوستر كحلي ملكي يعرض العيادات والأطباء العاملين اليوم ({todayDayName}) مع الموعد وسعر الكشف.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadDailyImage();
                  }}
                  disabled={isExportingDaily || openDailyRows.length === 0}
                  className="w-full py-2.5 px-4 bg-[#072448] hover:bg-[#0b3160] disabled:opacity-50 text-white text-xs font-extrabold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isExportingDaily ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-sky-300" />
                      <span>جاري تجهيز صورة جدول اليوم...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-sky-300" />
                      <span>تنزيل بوستر جدول اليوم ({openDailyRows.length})</span>
                    </>
                  )}
                </button>
              </div>

              {/* البطاقة الثانية: جدول مواعيد الأسبوع كاملاً */}
              <div
                onClick={() => setExportMode('weekly')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3.5 ${
                  exportMode === 'weekly'
                    ? 'border-[#072448] bg-sky-50/70 dark:bg-slate-800 shadow-md'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:border-sky-400'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-[#0b3160] text-amber-300">
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>الجدول الأسبوعي الشامل</span>
                    </span>
                    <span className="text-xs font-extrabold text-[#072448] dark:text-sky-300">
                      {weeklyClinicRows.length} طبيب / عيادة
                    </span>
                  </div>

                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    2. تنزيل جدول الأسبوع كاملاً كـ صورة
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    نفس البوستر الكحلي الملكي في جدول واحد ملموم يضم التخصص، الطبيب، أيام العمل، الموعد، والكشف.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadWeeklyImage();
                  }}
                  disabled={isExportingWeekly || weeklyClinicRows.length === 0}
                  className="w-full py-2.5 px-4 bg-[#0b3160] hover:bg-[#072448] disabled:opacity-50 text-white text-xs font-extrabold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isExportingWeekly ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      <span>جاري تجهيز صورة الجدول الأسبوعي...</span>
                    </>
                  ) : (
                    <>
                      <CalendarDays className="w-4 h-4 text-amber-300" />
                      <span>تنزيل بوستر جدول الأسبوع كاملاً (PNG)</span>
                    </>
                  )}
                </button>
              </div>

            </div>

            {/* شريط التبديل بين المعاينة */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-200">
                <Eye className="w-4 h-4 text-[#072448] dark:text-sky-400" />
                <span>
                  {exportMode === 'daily'
                    ? `معاينة بوستر جدول مواعيد الأطباء [يوم ${todayDayName}]:`
                    : `معاينة بوستر جدول مواعيد الأطباء [الأسبوعي الشامل]:`}
                </span>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setExportMode('daily')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    exportMode === 'daily'
                      ? 'bg-[#072448] text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  معاينة جدول اليوم
                </button>
                <button
                  type="button"
                  onClick={() => setExportMode('weekly')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    exportMode === 'weekly'
                      ? 'bg-[#072448] text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  معاينة جدول الأسبوع
                </button>
              </div>
            </div>

            {/* ===================================================================== */}
            {/* المعاينة 1: البوستر اليومي الكحلي الملكي (Daily Royal Navy Poster) */}
            {/* ===================================================================== */}
            {exportMode === 'daily' && (
              <div className="overflow-x-auto pb-2 flex justify-center">
                <div
                  ref={dailyPosterRef}
                  dir="rtl"
                  className="w-[740px] shrink-0 bg-[#f2f6fb] text-slate-900 shadow-xl overflow-hidden border border-[#06203f]/25"
                >
                  {/* الهيدر الكحلي المنحني */}
                  {renderPosterHeader(`جدول مواعيد الأطباء [يوم ${todayDayName}]`)}

                  {/* الجدول المسطر المتداخل مع الهيدر مثل الصورة المرجعية */}
                  <div className="px-7 -mt-6 pb-7 relative z-20">
                    {openDailyRows.length === 0 ? (
                      <div className="p-10 text-center bg-white border-2 border-[#06203f] text-[#06203f] space-y-1 shadow-md">
                        <p className="font-extrabold text-base">
                          لا توجد عيادات مفتوحة ومجدولة للعمل في هذا اليوم ({todayDayName})
                        </p>
                        <p className="text-xs text-slate-600">
                          يمكنك تفعيل العيادات من جدول تشغيل اليوم أو تحميل «جدول الأسبوع كاملاً».
                        </p>
                      </div>
                    ) : (
                      <div className="border-2 border-[#06203f] shadow-md bg-white overflow-hidden">
                        <table className="w-full text-center border-collapse">
                          <thead>
                            <tr className="bg-[#06203f] text-white text-base font-black">
                              <th className="py-3 px-3 border-l-2 border-white/75 w-[29%]">
                                التخصص
                              </th>
                              <th className="py-3 px-3 border-l-2 border-white/75 w-[34%]">
                                اسم الطبيب
                              </th>
                              <th className="py-3 px-3 border-l-2 border-white/75 w-[24%]">
                                الموعد
                              </th>
                              <th className="py-3 px-2 w-[13%]">
                                الكشف
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {openDailyRows.map((row, idx) => (
                              <tr
                                key={row.rowKey}
                                className={`${
                                  idx % 2 === 0 ? 'bg-[#e1eef8]' : 'bg-[#f1f7fc]'
                                } border-t border-[#7fa3c7] text-[#071c35]`}
                              >
                                <td className="py-2.5 px-3 border-l border-[#7fa3c7] font-black text-[16px]">
                                  {row.clinicName}
                                </td>
                                <td className="py-2.5 px-3 border-l border-[#7fa3c7] font-extrabold text-[16px]">
                                  {row.doctorName}
                                </td>
                                <td className="py-2.5 px-3 border-l border-[#7fa3c7] font-extrabold text-[15px]">
                                  {row.timing}
                                </td>
                                <td className="py-2.5 px-2 font-black text-[15px] text-[#06203f]">
                                  {row.fee}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* الفوتر الكحلي السفلي */}
                  {renderPosterFooter()}
                </div>
              </div>
            )}

            {/* ===================================================================== */}
            {/* المعاينة 2: البوستر الأسبوعي الكحلي الملكي (Weekly Royal Navy Poster) */}
            {/* ===================================================================== */}
            {exportMode === 'weekly' && (
              <div className="overflow-x-auto pb-2 flex justify-center">
                <div
                  ref={weeklyPosterRef}
                  dir="rtl"
                  className="w-[820px] shrink-0 bg-[#f2f6fb] text-slate-900 shadow-xl overflow-hidden border border-[#06203f]/25"
                >
                  {/* الهيدر الكحلي المنحني */}
                  {renderPosterHeader('جدول مواعيد الأطباء [الأسبوعي الشامل]')}

                  {/* الجدول الأسبوعي الموحد بنفس التصميم المسطر الأنيق بدون الكروت الضخمة */}
                  <div className="px-7 -mt-6 pb-7 relative z-20">
                    <div className="border-2 border-[#06203f] shadow-md bg-white overflow-hidden">
                      <table className="w-full text-center border-collapse">
                        <thead>
                          <tr className="bg-[#06203f] text-white text-[15px] font-black">
                            <th className="py-3 px-3 border-l-2 border-white/75 w-[23%]">
                              التخصص
                            </th>
                            <th className="py-3 px-3 border-l-2 border-white/75 w-[26%]">
                              اسم الطبيب
                            </th>
                            <th className="py-3 px-2.5 border-l-2 border-white/75 w-[23%]">
                              أيام العمل
                            </th>
                            <th className="py-3 px-2.5 border-l-2 border-white/75 w-[17%]">
                              الموعد
                            </th>
                            <th className="py-3 px-2 w-[11%]">
                              الكشف
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {weeklyClinicRows.map((row, idx) => (
                            <tr
                              key={row.rowKey}
                              className={`${
                                idx % 2 === 0 ? 'bg-[#e1eef8]' : 'bg-[#f1f7fc]'
                              } border-t border-[#7fa3c7] text-[#071c35]`}
                            >
                              <td className="py-2.5 px-3 border-l border-[#7fa3c7] font-black text-[15px]">
                                {row.clinicName}
                              </td>
                              <td className="py-2.5 px-3 border-l border-[#7fa3c7] font-extrabold text-[15px]">
                                {row.doctorName}
                              </td>
                              <td className="py-2.5 px-2.5 border-l border-[#7fa3c7] font-bold text-[13px] text-[#0b3160]">
                                {row.workingDaysText}
                              </td>
                              <td className="py-2.5 px-2.5 border-l border-[#7fa3c7] font-extrabold text-[14px]">
                                {row.timing}
                              </td>
                              <td className="py-2.5 px-2 font-black text-[14px] text-[#06203f]">
                                {row.fee}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* الفوتر الكحلي السفلي */}
                  {renderPosterFooter()}
                </div>
              </div>
            )}

          </div>

          {/* تذييل النافذة */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              يتم تصدير البوستر بدقة (3x Ultra HD PNG) جاهز للنشر المباشر على فيسبوك وواتساب أو الطباعة
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
