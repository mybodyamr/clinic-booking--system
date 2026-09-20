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
 * استخراج اسم اليوم بالعربية لتاريخ محدد
 */
export function getArabicDayName(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' 
    ? new Date(dateInput.includes('T') ? dateInput : `${dateInput}T00:00:00`)
    : dateInput;
  
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
  isShiftEnded: boolean;
  isFullyBooked: boolean;
  shift: ParsedShiftTimes;
  currentCount: number;
  maxAllowed: number;
}

/**
 * الفحص الشامل لتوافر العيادة للحجز بناءً على الركائز الأربعة المطلوبة:
 * 1. حالة التواجد اليومية للطبيب (متاح / غير متاح)
 * 2. الجدول الأسبوعي (أيام العمل)
 * 3. انتهاء وقت العيادة الحقيقي
 * 4. اكتمال العدد الأقصى للحجوزات
 */
export function checkClinicAvailability(
  doctor: Doctor,
  clinicId: string,
  dateStr: string,
  bookings: Booking[],
  currentTime?: Date
): ClinicAvailabilityResult {
  const now = currentTime || new Date();
  const shift = parseDoctorShiftTimes(doctor);
  const currentCount = getDoctorBookingsCount(doctor.id, clinicId, dateStr, bookings);
  const maxAllowed = doctor.maxDailyBookings || 20;

  // 1. حالة التواجد اليومية
  const isOffline = doctor.status !== 'available';
  if (isOffline) {
    const absenceReason = doctor.unavailableReason ? ` (${doctor.unavailableReason})` : '';
    return {
      allowed: false,
      reason: `الطبيب غير متاح للعمل اليوم${absenceReason}.`,
      isOffline: true,
      isNotScheduledToday: false,
      isShiftEnded: false,
      isFullyBooked: false,
      shift,
      currentCount,
      maxAllowed
    };
  }

  // 2. الجدول الأسبوعي
  const isNotScheduledToday = !isDoctorScheduledOnDate(doctor, dateStr);
  if (isNotScheduledToday) {
    const dayName = getArabicDayName(dateStr);
    return {
      allowed: false,
      reason: `العيادة غير مجدولة للعمل في هذا اليوم (${dayName}) وفقاً للجدول الأسبوعي للطبيب.`,
      isOffline: false,
      isNotScheduledToday: true,
      isShiftEnded: false,
      isFullyBooked: false,
      shift,
      currentCount,
      maxAllowed
    };
  }

  // 3. انتهاء وقت العيادة
  const shiftEnded = isClinicShiftEnded(doctor, dateStr, now);
  if (shiftEnded) {
    return {
      allowed: false,
      reason: `انتهت مناوبة العيادة اليوم في تمام الساعة (${format24To12Arabic(shift.endTime)}). توقف استقبال الحجوزات.`,
      isOffline: false,
      isNotScheduledToday: false,
      isShiftEnded: true,
      isFullyBooked: false,
      shift,
      currentCount,
      maxAllowed
    };
  }

  // 4. اكتمال العدد الأقصى للحجوزات
  const fullyBooked = currentCount >= maxAllowed;
  if (fullyBooked) {
    return {
      allowed: false,
      reason: `اكتمل العدد الأقصى لحجوزات العيادة اليوم (${maxAllowed} حالة).`,
      isOffline: false,
      isNotScheduledToday: false,
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
    isShiftEnded: false,
    isFullyBooked: false,
    shift,
    currentCount,
    maxAllowed
  };
}
