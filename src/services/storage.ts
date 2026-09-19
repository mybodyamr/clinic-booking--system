import { Clinic, Doctor, Booking, UserSession, StaffAccount, DailyScheduleState, RolePermissionsMap, PermissionDefinition, UserRole, SystemPermission } from '../types';
import { INITIAL_CLINICS, INITIAL_DOCTORS, INITIAL_BOOKINGS } from '../data/mockData';
import * as XLSX from 'xlsx';

const STORAGE_KEYS = {
  CLINICS: 'sharaya_clinics_v2',
  DOCTORS: 'sharaya_doctors_v2',
  BOOKINGS: 'sharaya_bookings_v2',
  SESSION: 'sharaya_session_v2',
  THEME: 'sharaya_theme_v2',
  DAILY_SCHEDULE: 'sharaya_daily_schedule_v2',
  ROLE_PERMISSIONS: 'sharaya_role_permissions_v2',
  SUPPORT_INFO_TEXT: 'sharaya_support_info_text_v2',
  STAFF_PASSWORDS: 'sharaya_staff_passwords_v2',
  LOGIN_ATTEMPTS: 'sharaya_login_attempts_v2',
  STAFF_ACCOUNTS: 'sharaya_staff_accounts_v2',
};

export const DEFAULT_SUPPORT_INFO_TEXT = 'فريق الاستقبال في خدمتكم يومياً من 9:00 صباحاً حتى 10:00 مساءً للرد على كافة التساؤلات.';

export const AVAILABLE_PERMISSIONS: PermissionDefinition[] = [
  {
    key: 'manage_doctor_attendance',
    name: 'تعديل حالة حضور وغياب الأطباء',
    description: 'تسجيل الطبيب كـ (متواجد اليوم / معتذر / استراحة) نيابة عنه عند اللزوم'
  },
  {
    key: 'manage_daily_clinics',
    name: 'تحديد العيادات المفتوحة اليوم وتعيين الأطباء',
    description: 'اختيار العيادات المتاحة للحجز وتعيين الطبيب المسؤول عن كل عيادة'
  },
  {
    key: 'manage_clinic_fees',
    name: 'تعديل أسعار ورسوم الكشف',
    description: 'تغيير قيمة تذكرة الكشف لكل عيادة تخصصية'
  },
  {
    key: 'view_financial_reports',
    name: 'الاطلاع على التقارير المالية والإيرادات',
    description: 'استعراض سجلات التحصيل وحصيلة الخزينة وتصديرها إكسيل'
  },
  {
    key: 'manage_patient_exemptions',
    name: 'منح وتأكيد الإعفاءات الخيرية',
    description: 'إعفاء الحالات المتعففة وغير القادرة من رسوم الكشف'
  }
];

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsMap = {
  admin: [
    'manage_doctor_attendance',
    'manage_daily_clinics',
    'manage_clinic_fees',
    'view_financial_reports',
    'manage_patient_exemptions',
  ],
  doctor: [],
  reception: [
    'manage_doctor_attendance', // الاستقبال مفوض افتراضياً بصلاحية تعديل حضور الأطباء
  ],
  cashier: [
    'manage_patient_exemptions',
  ],
};

// ==================== أمان وتنقية البيانات (Security & Sanitization) ====================

/**
 * تنقية وتطهير النصوص لمنع هجمات حقن الأكواد XSS
 */
export function sanitizeText(input: string): string {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '') // إزالة وسوم HTML
    .replace(/javascript:/gi, '') // إزالة الروابط المشبوهة
    .trim();
}

/**
 * التحقق من صحة رقم الهاتف المحمول (صيغة أرقام الهواتف المصرية المكونة من 11 رقماً تبدأ بـ 010, 011, 012, 015)
 */
export function validateEgyptianPhone(phone: string): { valid: boolean; error?: string } {
  const cleanPhone = phone.replace(/[\s-]/g, '');
  const regex = /^01[0125][0-9]{8}$/;
  if (!cleanPhone) {
    return { valid: false, error: 'يرجى إدخال رقم الهاتف' };
  }
  if (!regex.test(cleanPhone)) {
    return { valid: false, error: 'رقم الهاتف يجب أن يتكون من 11 رقماً ويبدأ بـ (010 أو 011 أو 012 أو 015)' };
  }
  return { valid: true };
}

/**
 * التحقق من أن اسم المريض ثلاثي على الأقل (3 كلمات مفصولة بمسافة على الأقل، مثال: "محمد أحمد علي")
 */
export function validateTripleName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'يرجى إدخال اسم المريض' };
  }
  const clean = name.trim().replace(/\s+/g, ' ');
  const words = clean.split(' ').filter(w => w.length > 0);
  
  if (words.length < 3) {
    return {
      valid: false,
      error: 'يجب أن يكون اسم المريض ثلاثياً على الأقل (3 كلمات، مثال: محمد أحمد علي)'
    };
  }

  // التأكد من أن كل كلمة لا تقل عن حرفين لتجنب الحروف المنفردة العشوائية
  const invalidWord = words.find(w => w.length < 2);
  if (invalidWord) {
    return {
      valid: false,
      error: 'يرجى كتابة الاسم الثلاثي كاملاً دون اختصارات أو حروف مفردة'
    };
  }

  return { valid: true };
}

/**
 * إخفاء رقم الهاتف لحماية خصوصية المريض في الشاشات العامة
 * مثال: 01012345678 -> 010****5678
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 8) return phone;
  const prefix = phone.slice(0, 3);
  const suffix = phone.slice(-4);
  return `${prefix}****${suffix}`;
}

// ==================== التخزين المحلي واسترجاع البيانات ====================

export function getStoredClinics(): Clinic[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLINICS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CLINICS, JSON.stringify(INITIAL_CLINICS));
      return INITIAL_CLINICS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('فشل قراءة بيانات العيادات:', e);
    return INITIAL_CLINICS;
  }
}

export function saveClinics(clinics: Clinic[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CLINICS, JSON.stringify(clinics));
  } catch (e) {
    console.error('فشل حفظ بيانات العيادات:', e);
  }
}

export function getStoredDoctors(): Doctor[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DOCTORS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(INITIAL_DOCTORS));
      return INITIAL_DOCTORS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('فشل قراءة بيانات الأطباء:', e);
    return INITIAL_DOCTORS;
  }
}

export function saveDoctors(doctors: Doctor[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(doctors));
  } catch (e) {
    console.error('فشل حفظ بيانات الأطباء:', e);
  }
}

export function getStoredBookings(): Booking[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(INITIAL_BOOKINGS));
      return INITIAL_BOOKINGS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('فشل قراءة بيانات الحجوزات:', e);
    return INITIAL_BOOKINGS;
  }
}

export function saveBookings(bookings: Booking[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
  } catch (e) {
    console.error('فشل حفظ بيانات الحجوزات:', e);
  }
}

export function getStoredSession(): UserSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.SESSION);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function saveSession(session: UserSession | null): void {
  try {
    if (!session) {
      sessionStorage.removeItem(STORAGE_KEYS.SESSION);
    } else {
      sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    }
  } catch (e) {
    console.error('فشل حفظ الجلسة:', e);
  }
}

export function getStoredTheme(): 'light' | 'dark' {
  try {
    const t = localStorage.getItem(STORAGE_KEYS.THEME);
    return t === 'dark' ? 'dark' : 'light';
  } catch (e) {
    return 'light';
  }
}

export function saveTheme(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch (e) {
    console.error('فشل حفظ المظهر:', e);
  }
}

// ==================== أمان تسجيل الدخول ومكافحة التخمين (Auth Security & Brute Force Protection) ====================

/**
 * دالة تجزئة وتشفير لكلمات المرور أحادية الاتجاه (Cryptographic SHA-256 Hashing)
 * لمنع تخزين كلمات المرور كنص صريح (Cleartext) في المتصفح أو الذاكرة
 */
export async function hashPassword(plainText: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`sharia_clinic_salt_${plainText}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// الكلمات السرية الافتراضية المحمية بالتجزئة للحسابات الإدارية والطبية (SHA-256 مضبوطة بـ 64 خانة مع الملح)
export const DEFAULT_PASSWORD_HASHES: Record<string, string> = {
  admin: '2e0ebbe2df13e248a1c1e9c1446a5d1a605484a416d66f4cc7802391d9a2b558', // Adm@Sharia2026!
  reception: '8d6a7d4173428e7073a5ad9b5209bc293336ed9ed5e08a25e0f82e6df653d804', // Rcp@Sharia2026!
  cashier: '3a09f66bc67a9e66140e16d6e2279dd38dec038f51b01dcb2038a196fbef4ac6', // Csh@Sharia2026!
  doctor: '733d171967711964a0ea8dc5bbafa70e278008dbb225aaa23316f208e1e9f8c6', // Doc@Sharia2026!
};

// ==================== قائمة حسابات الكادر والمستخدمين الديناميكية ====================
export const DEFAULT_STAFF_ACCOUNTS: StaffAccount[] = [
  {
    id: 'staff-admin',
    username: 'admin',
    displayName: 'د. أحمد الشناوي (مدير المنظومة)',
    role: 'admin',
    recoveryEmail: 'admin@sharia-clinics.eg'
  },
  {
    id: 'staff-reception',
    username: 'reception',
    displayName: 'أ. سارة مصطفى (مسؤولة الاستقبال)',
    role: 'reception',
    recoveryEmail: 'reception@sharia-clinics.eg'
  },
  {
    id: 'staff-cashier',
    username: 'cashier',
    displayName: 'أ. محمود إبراهيم (أمين الصندوق والخزينة)',
    role: 'cashier',
    recoveryEmail: 'cashier@sharia-clinics.eg'
  },
  {
    id: 'staff-doctor',
    username: 'doctor',
    displayName: 'د. علي عبد الرحمن (عيادة الباطنة)',
    role: 'doctor',
    doctorId: 'doc-1',
    clinicId: 'clinic-internal',
    recoveryEmail: 'doctor.internal@sharia-clinics.eg'
  }
];

export function getStoredStaffAccounts(): StaffAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STAFF_ACCOUNTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.STAFF_ACCOUNTS, JSON.stringify(DEFAULT_STAFF_ACCOUNTS));
      return DEFAULT_STAFF_ACCOUNTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_STAFF_ACCOUNTS;
  } catch (e) {
    console.error('فشل قراءة حسابات الموظفين:', e);
    return DEFAULT_STAFF_ACCOUNTS;
  }
}

export function saveStaffAccounts(accounts: StaffAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.STAFF_ACCOUNTS, JSON.stringify(accounts));
  } catch (e) {
    console.error('فشل حفظ حسابات الموظفين:', e);
  }
}

export function deleteStaffAccountById(id: string): { success: boolean; error?: string; remainingAccounts: StaffAccount[] } {
  const current = getStoredStaffAccounts();
  const target = current.find(a => a.id === id);
  if (!target) {
    return { success: false, error: 'المستخدم غير موجود', remainingAccounts: current };
  }

  // منع حذف آخر حساب أدمن في المنظومة
  if (target.role === 'admin') {
    const adminCount = current.filter(a => a.role === 'admin').length;
    if (adminCount <= 1) {
      return { success: false, error: 'لا يمكن حذف آخر حساب مدير متبقٍ في المنظومة لضمان استمرارية الإدارة.', remainingAccounts: current };
    }
  }

  const updated = current.filter(a => a.id !== id);
  saveStaffAccounts(updated);
  return { success: true, remainingAccounts: updated };
}

export function updateStaffAccountRecoveryEmail(id: string, email: string): StaffAccount[] {
  const current = getStoredStaffAccounts();
  const updated = current.map(acc => {
    if (acc.id === id) {
      return { ...acc, recoveryEmail: email.trim().toLowerCase() };
    }
    return acc;
  });
  saveStaffAccounts(updated);
  return updated;
}

export function getStoredStaffPasswordHashes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STAFF_PASSWORDS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.STAFF_PASSWORDS, JSON.stringify(DEFAULT_PASSWORD_HASHES));
      return DEFAULT_PASSWORD_HASHES;
    }
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_PASSWORD_HASHES;
  }
}

export function saveStaffPasswordHash(username: string, newHash: string): void {
  try {
    const current = getStoredStaffPasswordHashes();
    current[username.toLowerCase()] = newHash;
    localStorage.setItem(STORAGE_KEYS.STAFF_PASSWORDS, JSON.stringify(current));
  } catch (e) {
    console.error('فشل تحديث كلمة المرور:', e);
  }
}

interface LoginAttemptRecord {
  attempts: number;
  lockUntil?: number;
}

/**
 * فحص نظام الحماية من هجمات التخمين والقوة العمياء (Brute Force Protection & Rate Limiting)
 * يتم قفل المحاولات مؤقتاً لمدة 15 دقيقة بعد 5 محاولات متتالية خاطئة.
 */
export function checkLoginRateLimit(username: string): { allowed: boolean; remainingSeconds?: number } {
  try {
    const cleanUser = username.trim().toLowerCase();
    const raw = localStorage.getItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
    if (!raw) return { allowed: true };
    const attemptsMap: Record<string, LoginAttemptRecord> = JSON.parse(raw);
    const userRecord = attemptsMap[cleanUser];
    if (!userRecord) return { allowed: true };

    const now = Date.now();
    if (userRecord.lockUntil && userRecord.lockUntil > now) {
      const remainingSeconds = Math.ceil((userRecord.lockUntil - now) / 1000);
      return { allowed: false, remainingSeconds };
    }

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

export function recordFailedLogin(username: string): { locked: boolean; attempts: number; lockUntilMinutes?: number } {
  try {
    const cleanUser = username.trim().toLowerCase();
    const raw = localStorage.getItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
    const attemptsMap: Record<string, LoginAttemptRecord> = raw ? JSON.parse(raw) : {};
    const userRecord = attemptsMap[cleanUser] || { attempts: 0 };
    userRecord.attempts += 1;

    let locked = false;
    let lockUntilMinutes = 0;

    // إذا تجاوزت المحاولات 5 محاولات خاطئة متتالية يتم قفل الحساب مؤقتاً لمدة 15 دقيقة
    if (userRecord.attempts >= 5) {
      lockUntilMinutes = 15;
      userRecord.lockUntil = Date.now() + lockUntilMinutes * 60 * 1000;
      locked = true;
    }

    attemptsMap[cleanUser] = userRecord;
    localStorage.setItem(STORAGE_KEYS.LOGIN_ATTEMPTS, JSON.stringify(attemptsMap));
    return { locked, attempts: userRecord.attempts, lockUntilMinutes };
  } catch {
    return { locked: false, attempts: 1 };
  }
}

export function resetLoginAttempts(username: string): void {
  try {
    const cleanUser = username.trim().toLowerCase();
    const raw = localStorage.getItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
    if (!raw) return;
    const attemptsMap: Record<string, LoginAttemptRecord> = JSON.parse(raw);
    delete attemptsMap[cleanUser];
    localStorage.setItem(STORAGE_KEYS.LOGIN_ATTEMPTS, JSON.stringify(attemptsMap));
  } catch {}
}

/**
 * فحص الحد الأقصى للحجز والتحقق من عدم تكرار نفس الاسم لنفس الهاتف في نفس العيادة:
 * - يُسمح بأكثر من حجز بنفس رقم الهاتف في نفس العيادة لأسماء مرضى مختلفة (أفراد الأسرة).
 * - يُمنع تكرار حجز لنفس اسم المريض ونفس الهاتف في نفس العيادة لنفس اليوم (إذا كان الحجز نشطاً وغير ملغي).
 */
export function checkBookingRateLimit(patientName: string, phone: string, clinicId: string, date: string): { allowed: boolean; reason?: string } {
  const bookings = getStoredBookings();
  const cleanPhone = phone.replace(/[\s-]/g, '');
  const normalizedNewName = patientName.trim().replace(/\s+/g, ' ').toLowerCase();

  // فحص هل يوجد حجز نشط (غير ملغي) لنفس الاسم ونفس رقم الهاتف ونفس العيادة ونفس اليوم
  const duplicateBooking = bookings.find(
    b => b.patientPhone.replace(/[\s-]/g, '') === cleanPhone &&
         b.clinicId === clinicId &&
         b.date === date &&
         b.status !== 'cancelled' &&
         b.patientName.trim().replace(/\s+/g, ' ').toLowerCase() === normalizedNewName
  );

  if (duplicateBooking) {
    return {
      allowed: false,
      reason: `يوجد حجز نشط مسجل مسبقاً باسم (${patientName.trim()}) بنفس رقم الهاتف في هذه العيادة لليوم (تذكرة رقم: ${duplicateBooking.ticketNumber}). لا يمكن تكرار الحجز لنفس المريض.`
    };
  }

  // حد أمان عام لمنع محاولات الإغراق الآلي (بحد أقصى 6 تذاكر يومياً للأسرة الواحدة عبر نفس الهاتف)
  const allBookingsTodayForPhone = bookings.filter(
    b => b.patientPhone.replace(/[\s-]/g, '') === cleanPhone && b.date === date && b.status !== 'cancelled'
  );

  if (allBookingsTodayForPhone.length >= 6) {
    return {
      allowed: false,
      reason: 'تجاوزت الحد الأقصى اليومي المسموح به لهذا الهاتف (6 تذاكر كشف كحد أقصى يومياً لأسرة واحدة).'
    };
  }

  return { allowed: true };
}

/**
 * تصدير البيانات إلى ملف Excel بصيغة xlsx
 */
export function exportBookingsToExcel(bookings: Booking[], fileName = 'سجل_حجوزات_عيادات_الجمعية_الشرعية.xlsx'): void {
  const rows = bookings.map(b => ({
    'رقم التذكرة': b.ticketNumber,
    'اسم المريض': b.patientName,
    'رقم الهاتف': b.patientPhone,
    'العيادة': b.clinicName,
    'الطبيب المعالج': b.doctorName,
    'تاريخ الكشف': b.date,
    'الموعد التقريبي': b.timeSlot,
    'رقم الدور': b.queuePosition,
    'حالة الكشف': b.status === 'completed' ? 'مكتمل' : b.status === 'in-progress' ? 'داخل العيادة' : b.status === 'waiting' ? 'في الانتظار' : 'ملغي',
    'حالة الدفع': b.paymentStatus === 'paid' ? 'تم السداد' : b.paymentStatus === 'exempt' ? 'إعفاء خيري' : 'غير مسدد',
    'قيمة الكشف (ج.م)': b.fee,
    'ملاحظات التشخيص': b.doctorDiagnosis || b.notes || '—',
    'وقت الحجز': b.createdAt
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'الحجوزات');
  
  // حفظ وتنزيل الملف
  XLSX.writeFile(workbook, fileName);
}

// ==================== إدارة جدول عيادات اليوم ====================

export function getStoredDailySchedule(clinics: Clinic[], doctors: Doctor[]): DailyScheduleState {
  const todayStr = new Date().toISOString().split('T')[0];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DAILY_SCHEDULE);
    if (raw) {
      const parsed: DailyScheduleState = JSON.parse(raw);
      // إذا كان الجدول المحفوظ لنفس اليوم نرجعه، مع التأكد من شمول كافة العيادات
      if (parsed && parsed.date === todayStr && Array.isArray(parsed.items) && parsed.items.length > 0) {
        // مواءمة العيادات في حال إضافة عيادة جديدة
        const itemClinicIds = new Set(parsed.items.map(i => i.clinicId));
        const missingClinics = clinics.filter(c => !itemClinicIds.has(c.id));
        if (missingClinics.length > 0) {
          const additionalItems = missingClinics.map(c => {
            const doc = doctors.find(d => d.clinicId === c.id);
            return {
              clinicId: c.id,
              isOpen: true,
              doctorId: doc ? doc.id : ''
            };
          });
          const merged: DailyScheduleState = {
            date: todayStr,
            items: [...parsed.items, ...additionalItems]
          };
          localStorage.setItem(STORAGE_KEYS.DAILY_SCHEDULE, JSON.stringify(merged));
          return merged;
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('فشل قراءة جدول عيادات اليوم:', e);
  }

  // إنشاء جدول افتراضي لليوم: كافة العيادات مفتوحة مع أول طبيب مسجل لكل عيادة
  const defaultItems = clinics.map(clinic => {
    const doc = doctors.find(d => d.clinicId === clinic.id);
    return {
      clinicId: clinic.id,
      isOpen: true,
      doctorId: doc ? doc.id : ''
    };
  });

  const defaultSchedule: DailyScheduleState = {
    date: todayStr,
    items: defaultItems
  };

  try {
    localStorage.setItem(STORAGE_KEYS.DAILY_SCHEDULE, JSON.stringify(defaultSchedule));
  } catch (e) {
    console.error('فشل حفظ الجدول الافتراضي:', e);
  }

  return defaultSchedule;
}

export function saveDailySchedule(schedule: DailyScheduleState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DAILY_SCHEDULE, JSON.stringify(schedule));
  } catch (e) {
    console.error('فشل حفظ جدول عيادات اليوم:', e);
  }
}

// ==================== تفويض الصلاحيات ====================

export function getStoredRolePermissions(): RolePermissionsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ROLE_PERMISSIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ROLE_PERMISSIONS, JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
      return DEFAULT_ROLE_PERMISSIONS;
    }
    const parsed = JSON.parse(raw);
    return {
      admin: parsed.admin || DEFAULT_ROLE_PERMISSIONS.admin,
      doctor: parsed.doctor || DEFAULT_ROLE_PERMISSIONS.doctor,
      reception: parsed.reception || DEFAULT_ROLE_PERMISSIONS.reception,
      cashier: parsed.cashier || DEFAULT_ROLE_PERMISSIONS.cashier,
    };
  } catch (e) {
    console.error('فشل قراءة الصلاحيات:', e);
    return DEFAULT_ROLE_PERMISSIONS;
  }
}

export function saveRolePermissions(permissions: RolePermissionsMap): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ROLE_PERMISSIONS, JSON.stringify(permissions));
  } catch (e) {
    console.error('فشل حفظ الصلاحيات:', e);
  }
}

// ==================== نص المساعدة الفورية بالرئيسية ====================

export function getStoredSupportInfoText(): string {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.SUPPORT_INFO_TEXT);
    return val !== null ? val : DEFAULT_SUPPORT_INFO_TEXT;
  } catch (e) {
    return DEFAULT_SUPPORT_INFO_TEXT;
  }
}

export function saveSupportInfoText(text: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SUPPORT_INFO_TEXT, text);
  } catch (e) {
    console.error('فشل حفظ نص المساعدة:', e);
  }
}
