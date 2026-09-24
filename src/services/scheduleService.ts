import { Doctor, Booking } from '../types';

export const ARABIC_DAYS = [
  'السبت',
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة'
] as const;

export type ArabicDay = typeof ARABIC_DAYS[number];

/**
 * توحيد صيغ أسماء الأيام بالعربية للتعامل مع الهمزات والاختلافات اللغوية
 */
export function normalizeArabicDay(day: string): string {
  if (!day) return '';
  return day.trim()
    .replace(/^الإثنين$/, 'الاثنين')
    .replace(/^إثنين$/, 'الاثنين')
    .replace(/^الأحد$/, 'الأحد')
    .replace(/^احد$/, 'الأحد')
    .replace(/^السبت$/, 'السبت')
    .replace(/^سبت$/, 'السبت')
    .replace(/^الثلاثاء$/, 'الثلاثاء')
    .replace(/^ثلاثاء$/, 'الثلاثاء')
    .replace(/^الأربعاء$/, 'الأربعاء')
    .replace(/^اربعاء$/, 'الأربعاء')
    .replace(/^الخميس$/, 'الخميس')
    .replace(/^خميس$/, 'الخميس')
    .replace(/^الجمعة$/, 'الجمعة')
    .replace(/^جمعة$/, 'الجمعة');
}

/**
 * تحويل تاريخ إلى كائن Date بأمان في التوقيت المحلي عند منتصف النهار لتجنب أي إزاحة زمنية
 */
export function parseDateSafe(dateInput: Date | string): Date {
  if (dateInput instanceof Date) return dateInput;
  if (!dateInput) return new Date();
  if (dateInput.includes('T')) return new Date(dateInput);
  const parts = dateInput.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  }
  return new Date(dateInput);
}

/**
 * الحصول على سلسلة التاريخ المحلي بصيغة YYYY-MM-DD
 */
export function getLocalDateStr(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * استخراج اسم اليوم بالعربية لتاريخ محدد
 */
export function getArabicDayName(dateInput: Date | string): string {
  const d = parseDateSafe(dateInput);
  const dayIndex = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const mapping: { [key: number]: string } = {
    0: 'الأحد',
    1: 'الاثنين',
    2: 'الثلاثاء',
    3: 'الأربعاء',
    4: 'الخميس',
    5: 'الجمعة',
    6: 'السبت'
  };
  return mapping[dayIndex] || 'السبت';
}

/**
 * تحويل وقت بنظام 24 ساعة (HH:mm) إلى نص عربي مقروء (مثال: "14:00" -> "02:00 ظهراً")
 */
export function format24To12Arabic(time24: string): string {
  if (!time24 || !time24.includes(':')) return time24;
  const parts = time24.split(':');
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1] || '00';
  
  if (isNaN(hours)) return time24;

  let period = 'صباحاً';
  if (hours >= 12 && hours < 16) {
    period = 'ظهراً';
  } else if (hours >= 16 && hours < 19) {
    period = 'عصراً';
  } else if (hours >= 19 || hours === 0) {
    period = 'مساءً';
  }

  let h12 = hours % 12;
  if (h12 === 0) h12 = 12;

  const hFormatted = h12.toString().padStart(2, '0');
  return `${hFormatted}:${minutes} ${period}`;
}

export interface ParsedShiftTimes {
  startTime: string;      // 24h e.g. "14:00"
  endTime: string;        // 24h e.g. "20:00"
  startMinutes: number;   // Minutes from midnight e.g. 840
  endMinutes: number;     // Minutes from midnight e.g. 1200
  formattedDisplay: string; // e.g. "من 02:00 ظهراً إلى 08:00 مساءً"
}

/**
 * تحليل واستخراج أوقات مناوبة الطبيب (البداية والنهاية) بدقة بالدقائق
 */
export function parseDoctorShiftTimes(doctor: Partial<Doctor>): ParsedShiftTimes {
  // 1. إذا كانت القيم محددة بصيغة 24 ساعة بشكل صريح
  if (doctor.shiftStartTime && doctor.shiftEndTime && doctor.shiftStartTime.includes(':') && doctor.shiftEndTime.includes(':')) {
    const [sH, sM] = doctor.shiftStartTime.split(':').map(n => parseInt(n, 10));
    const [eH, eM] = doctor.shiftEndTime.split(':').map(n => parseInt(n, 10));
    const startMinutes = (isNaN(sH) ? 14 : sH) * 60 + (isNaN(sM) ? 0 : sM);
    const endMinutes = (isNaN(eH) ? 20 : eH) * 60 + (isNaN(eM) ? 0 : eM);

    return {
      startTime: doctor.shiftStartTime,
      endTime: doctor.shiftEndTime,
      startMinutes,
      endMinutes,
      formattedDisplay: `من ${format24To12Arabic(doctor.shiftStartTime)} إلى ${format24To12Arabic(doctor.shiftEndTime)}`
    };
  }

  // 2. تحليل النص العربي الموجود في scheduleHours (مثلاً: "من 04:00 عصراً إلى 09:00 مساءً")
  const rawText = doctor.scheduleHours || '';
  const timeRegex = /(\d{1,2}):(\d{2})/g;
  const matches = [...rawText.matchAll(timeRegex)];

  if (matches.length >= 2) {
    const sHourStr = matches[0][1];
    const sMinStr = matches[0][2];
    const eHourStr = matches[1][1];
    const eMinStr = matches[1][2];

    let sHour = parseInt(sHourStr, 10);
    const sMin = parseInt(sMinStr, 10);
    let eHour = parseInt(eHourStr, 10);
    const eMin = parseInt(eMinStr, 10);

    // تحديد الفترة الصباحية/المسائية من سياق النص
    const textLower = rawText.toLowerCase();
    const firstHalf = rawText.substring(0, matches[1].index || 20);
    const secondHalf = rawText.substring(matches[1].index || 20);

    if ((firstHalf.includes('مساء') || firstHalf.includes('عصر') || firstHalf.includes('ظهر')) && sHour < 12) {
      sHour += 12;
    }
    if ((secondHalf.includes('مساء') || secondHalf.includes('عصر') || secondHalf.includes('ظهر') || secondHalf.includes('ليل')) && eHour < 12) {
      eHour += 12;
    }

    const startMinutes = sHour * 60 + sMin;
    const endMinutes = eHour * 60 + eMin;
    const startTime = `${sHour.toString().padStart(2, '0')}:${sMin.toString().padStart(2, '0')}`;
    const endTime = `${eHour.toString().padStart(2, '0')}:${eMin.toString().padStart(2, '0')}`;

    return {
      startTime,
      endTime,
      startMinutes,
      endMinutes,
      formattedDisplay: `من ${format24To12Arabic(startTime)} إلى ${format24To12Arabic(endTime)}`
    };
  }

  // 3. القيم الافتراضية إذا لم يتوفر أي نمط (من 02:00 ظهراً حتى 08:00 مساءً)
  return {
    startTime: '14:00',
    endTime: '20:00',
    startMinutes: 14 * 60,
    endMinutes: 20 * 60,
    formattedDisplay: 'من 02:00 ظهراً إلى 08:00 مساءً'
  };
}

/**
 * فحص هل اليوم يقع ضمن أيام جدول العمل الأسبوعي للطبيب
 */
export function isDoctorScheduledOnDate(doctor: Doctor, targetDateStr?: string): boolean {
  if (!doctor.scheduleDays || doctor.scheduleDays.length === 0) {
    return true; // إذا لم يُحدد أيام، يعتبر متاحاً كافتراضي
  }
  const dayName = getArabicDayName(targetDateStr || new Date());
  const normalizedTarget = normalizeArabicDay(dayName);
  return doctor.scheduleDays.some(d => normalizeArabicDay(d) === normalizedTarget);
}

/**
 * فحص هل انتهى وقت مناوبة العيادة اليوم (اعتماداً على الوقت والتاريخ الحقيقيين)
 */
export function isClinicShiftEnded(doctor: Doctor, targetDateStr?: string, currentNow?: Date): boolean {
  const now = currentNow || new Date();
  const todayStr = now.toISOString().split('T')[0];
  const dateStr = targetDateStr || todayStr;

  // إذا كان الحجز في تاريخ مضى فيعتبر منتهياً
  if (dateStr < todayStr) return true;
  // إذا كان الحجز لتاريخ مستقبلي فلم ينتهِ وقتها بعد
  if (dateStr > todayStr) return false;

  const shift = parseDoctorShiftTimes(doctor);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // تنتهي العيادة عند بلوغ وقت نهاية المناوبة
  return currentMinutes >= shift.endMinutes;
}

/**
 * حساب عدد الحجوزات المؤكدة والنشطة للعيادة/الطبيب في تاريخ معين
 */
export function getDoctorBookingsCount(
  doctorId: string, 
  clinicId: string, 
  dateStr: string, 
  bookings: Booking[]
): number {
  return bookings.filter(
    b => (b.doctorId === doctorId || b.clinicId === clinicId) &&
         b.date === dateStr &&
         b.status !== 'cancelled'
  ).length;
}

/**
 * فحص هل اكتمل العدد الأقصى للحجوزات للطبيب اليوم
 */
export function isClinicFullyBooked(
  doctor: Doctor, 
  clinicId: string, 
  dateStr: string, 
  bookings: Booking[]
): boolean {
  const currentCount = getDoctorBookingsCount(doctor.id, clinicId, dateStr, bookings);
  const maxLimit = doctor.maxDailyBookings || 20;
  return currentCount >= maxLimit;
}

export interface ClinicAvailabilityResult {
  allowed: boolean;
  reason?: string;
  isOffline: boolean;
  isNotScheduledToday: boolean;
  isFutureDate: boolean;
  isShiftEnded: boolean;
  isFullyBooked: boolean;
  shift: ParsedShiftTimes;
  currentCount: number;
  maxAllowed: number;
}

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

export function formatArabicDateDisplay(dateInput: Date | string): string {
  const d = parseDateSafe(dateInput);
  const day = d.getDate();
  const month = ARABIC_MONTHS[d.getMonth()] || '';
  return `${day} ${month}`;
}

/**
 * تنسيق التاريخ كاملاً باليوم والشهر والسنة بالعربية (مثال: "الخميس، 24 سبتمبر 2026")
 */
export function formatArabicFullDate(dateInput: Date | string): string {
  const d = parseDateSafe(dateInput);
  const dayName = getArabicDayName(d);
  const day = d.getDate();
  const month = ARABIC_MONTHS[d.getMonth()] || '';
  const year = d.getFullYear();
  return `${dayName}، ${day} ${month} ${year}`;
}

export type ScheduleBadgeType = 
  | 'available' 
  | 'locked_future' 
  | 'not_scheduled' 
  | 'fully_booked' 
  | 'shift_ended' 
  | 'offline';

export interface DoctorDayScheduleItem {
  dateStr: string;        // '2026-09-24'
  dayName: string;        // 'الخميس'
  dayMonthStr: string;    // '24 سبتمبر'
  isToday: boolean;       // true if today
  isScheduled: boolean;   // true if doctor is present on this day of the week
  isBookingOpen: boolean; // true ONLY if isToday && isScheduled && doctor is available
  statusText: string;     // 'متاح للحجز اليوم ✅' or '🔒 متواجد (يُفتح الحجز في موعده)' or 'غير متواجد'
  badgeType: ScheduleBadgeType;
  helperText?: string;
}

/**
 * توليد جدول حضور الطبيب للأيام القادمة (اليوم + الأيام القادمة)
 * يعرض أيام حضور الطبيب القادمة بوضوح للمريض، مع قفل الحجز للأيام المستقبلية وفتحه تلقائياً في يوم الحضور فقط
 */
export function getUpcomingDoctorSchedule(
  doctor: Doctor, 
  daysAhead = 7, 
  fromDate?: Date,
  bookings: Booking[] = []
): DoctorDayScheduleItem[] {
  const baseDate = fromDate || new Date();
  const todayStr = getLocalDateStr(baseDate);
  const items: DoctorDayScheduleItem[] = [];

  for (let i = 0; i < daysAhead; i++) {
    const cur = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + i, 12, 0, 0);
    const dateStr = getLocalDateStr(cur);
    const dayName = getArabicDayName(cur);
    const dayMonthStr = formatArabicDateDisplay(cur);
    const isToday = (i === 0) || (dateStr === todayStr);
    const isScheduled = isDoctorScheduledOnDate(doctor, dateStr);

    let isBookingOpen = false;
    let statusText = '✕ غير متواجد';
    let badgeType: ScheduleBadgeType = 'not_scheduled';
    let helperText: string | undefined = 'خارج جدول الحضور المعتمد';

    if (isScheduled) {
      if (isToday) {
        const check = checkClinicAvailability(doctor, doctor.clinicId, dateStr, bookings, baseDate);
        if (check.allowed) {
          isBookingOpen = true;
          statusText = '✅ متاح للحجز اليوم';
          badgeType = 'available';
          helperText = 'اليوم الفعلي - باب الحجز مفتوح ومتاح للكشف الآن';
        } else if (check.isOffline) {
          statusText = '⚠️ معتذر اليوم';
          badgeType = 'offline';
          helperText = doctor.unavailableReason ? `اعتذار رسمي (${doctor.unavailableReason})` : 'الطبيب غير متواجد بالعيادة اليوم';
        } else if (check.isShiftEnded) {
          statusText = '⏱️ انتهت مناوبة اليوم';
          badgeType = 'shift_ended';
          helperText = `انتهى وقت استقبال الحالات اليوم (${format24To12Arabic(check.shift.endTime)})`;
        } else if (check.isFullyBooked) {
          statusText = '🔒 اكتمل العدد اليوم';
          badgeType = 'fully_booked';
          helperText = `اكتمل الحد الأقصى للحالات (${check.maxAllowed} حالة)`;
        } else {
          statusText = check.reason || 'غير متاح اليوم';
          badgeType = 'not_scheduled';
          helperText = check.reason;
        }
      } else {
        // الأيام المستقبلية: الطبيب متواجد في هذا اليوم ولكن الحجز مقفل ويفتح تلقائياً في صباح نفس اليوم
        isBookingOpen = false;
        statusText = '🔒 متواجد بالعيادة';
        badgeType = 'locked_future';
        helperText = `غير متاح للحجز حالياً — يُفتح الحجز تلقائياً صباح يوم ${dayName} (${dayMonthStr})`;
      }
    } else {
      statusText = '✕ غير متواجد';
      badgeType = 'not_scheduled';
      helperText = 'إجازة الطبيب وفقاً للجدول الأسبوعي';
    }

    items.push({
      dateStr,
      dayName,
      dayMonthStr,
      isToday,
      isScheduled,
      isBookingOpen,
      statusText,
      badgeType,
      helperText
    });
  }

  return items;
}

/**
 * الفحص الشامل لتوافر العيادة للحجز بناءً على الركائز الأساسية:
 * 1. التاريخ الحالي (الحجز متاح فقط لليوم الفعلي الحالي، ومواعيد الأيام القادمة تُفتح تلقائياً في صباح يوم الكشف)
 * 2. حالة التواجد اليومية للطبيب (متاح / غير متاح)
 * 3. الجدول الأسبوعي (أيام العمل المحددة من الإدارة)
 * 4. انتهاء وقت العيادة الحقيقي
 * 5. اكتمال العدد الأقصى للحجوزات
 */
export function checkClinicAvailability(
  doctor: Doctor,
  clinicId: string,
  dateStr: string,
  bookings: Booking[],
  currentTime?: Date
): ClinicAvailabilityResult {
  const now = currentTime || new Date();
  const todayStr = getLocalDateStr(now);
  const shift = parseDoctorShiftTimes(doctor);
  const currentCount = getDoctorBookingsCount(doctor.id, clinicId, dateStr, bookings);
  const maxAllowed = doctor.maxDailyBookings || 20;

  // 1. فحص التاريخ: منع الحجز المسبق في الأيام المستقبلية مع عرضها كأيام حضور
  if (dateStr > todayStr) {
    const dayName = getArabicDayName(dateStr);
    const isDocWorking = isDoctorScheduledOnDate(doctor, dateStr);
    const dateDisplay = formatArabicDateDisplay(dateStr);
    return {
      allowed: false,
      reason: isDocWorking
        ? `🔒 الحجز غير متاح حالياً لهذا اليوم (${dayName} ${dateDisplay}). الطبيب متواجد ومسجل في هذا الموعد، وسيُفتح باب الحجز تلقائياً في صباح نفس اليوم.`
        : `العيادة غير مجدولة للعمل في هذا اليوم (${dayName} ${dateDisplay}) وفقاً للجدول الأسبوعي للطبيب.`,
      isOffline: false,
      isNotScheduledToday: !isDocWorking,
      isFutureDate: true,
      isShiftEnded: false,
      isFullyBooked: false,
      shift,
      currentCount,
      maxAllowed
    };
  }

  if (dateStr < todayStr) {
    return {
      allowed: false,
      reason: 'لا يمكن حجز موعد في تاريخ مضى.',
      isOffline: false,
      isNotScheduledToday: false,
      isFutureDate: false,
      isShiftEnded: true,
      isFullyBooked: false,
      shift,
      currentCount,
      maxAllowed
    };
  }

  // 2. حالة التواجد اليومية
  const isOffline = doctor.status !== 'available';
  if (isOffline) {
    const absenceReason = doctor.unavailableReason ? ` (${doctor.unavailableReason})` : '';
    return {
      allowed: false,
      reason: `الطبيب غير متاح للعمل اليوم${absenceReason}.`,
      isOffline: true,
      isNotScheduledToday: false,
      isFutureDate: false,
      isShiftEnded: false,
      isFullyBooked: false,
      shift,
      currentCount,
      maxAllowed
    };
  }

  // 3. الجدول الأسبوعي لليوم الحالي
  const isNotScheduledToday = !isDoctorScheduledOnDate(doctor, dateStr);
  if (isNotScheduledToday) {
    const dayName = getArabicDayName(dateStr);
    return {
      allowed: false,
      reason: `العيادة غير مجدولة للعمل اليوم (${dayName}) وفقاً لجدول الطبيب المعتمد.`,
      isOffline: false,
      isNotScheduledToday: true,
      isFutureDate: false,
      isShiftEnded: false,
      isFullyBooked: false,
      shift,
      currentCount,
      maxAllowed
    };
  }

  // 4. انتهاء وقت العيادة لليوم الحالي
  const shiftEnded = isClinicShiftEnded(doctor, dateStr, now);
  if (shiftEnded) {
    return {
      allowed: false,
      reason: `انتهت مناوبة العيادة اليوم في تمام الساعة (${format24To12Arabic(shift.endTime)}). توقف استقبال الحجوزات.`,
      isOffline: false,
      isNotScheduledToday: false,
      isFutureDate: false,
      isShiftEnded: true,
      isFullyBooked: false,
      shift,
      currentCount,
      maxAllowed
    };
  }

  // 5. اكتمال العدد الأقصى للحجوزات
  const fullyBooked = currentCount >= maxAllowed;
  if (fullyBooked) {
    return {
      allowed: false,
      reason: `اكتمل العدد الأقصى لحجوزات العيادة اليوم (${maxAllowed} حالة).`,
      isOffline: false,
      isNotScheduledToday: false,
      isFutureDate: false,
      isShiftEnded: false,
      isFullyBooked: true,
      shift,
      currentCount,
      maxAllowed
    };
  }

  return {
    allowed: true,
    isOffline: false,
    isNotScheduledToday: false,
    isFutureDate: false,
    isShiftEnded: false,
    isFullyBooked: false,
    shift,
    currentCount,
    maxAllowed
  };
}
