import { Clinic, Doctor, Booking, UserSession, StaffAccount, DailyScheduleState, RolePermissionsMap, PermissionDefinition, UserRole, SystemPermission, SystemErrorLog, SystemErrorSource, ConsultationRegistryState, ConsultationStamp } from '../types';
import { INITIAL_CLINICS, INITIAL_DOCTORS, INITIAL_BOOKINGS } from '../data/mockData';
import * as XLSX from 'xlsx';

const STORAGE_KEYS = {
  CLINICS: 'sharaya_clinics_v2',
  DOCTORS: 'sharaya_doctors_v2',
  BOOKINGS: 'sharaya_bookings_v2',
  BOOKINGS_CUTOFF: 'sharaya_bookings_cutoff_v2',
  SESSION: 'sharaya_session_v2',
  THEME: 'sharaya_theme_v2',
  DAILY_SCHEDULE: 'sharaya_daily_schedule_v2',
  ROLE_PERMISSIONS: 'sharaya_role_permissions_v2',
  SUPPORT_INFO_TEXT: 'sharaya_support_info_text_v2',
  OFFICIAL_WORKING_HOURS: 'sharaya_official_working_hours_v2',
  STAFF_PASSWORDS: 'sharaya_staff_passwords_v2',
  LOGIN_ATTEMPTS: 'sharaya_login_attempts_v3',
  STAFF_ACCOUNTS: 'sharaya_staff_accounts_v2',
  DELETED_CLINICS: 'sharaya_deleted_clinics_v2',
  DELETED_DOCTORS: 'sharaya_deleted_doctors_v2',
  DELETED_BOOKINGS: 'sharaya_deleted_bookings_v2',
  ERROR_LOGS: 'sharaya_system_error_logs_v1',
  PENDING_ERROR_LOGS: 'sharaya_pending_error_logs_v1',
  CONSULTATION_REGISTRY: 'sharaya_consultation_registry_v1',
};

const CLOUD_CACHE_VERSION_KEY = 'sharaya_cloud_sync_version';
const CURRENT_CLOUD_CACHE_VERSION = 'v8_supabase_live_sync';

if (typeof window !== 'undefined') {
  try {
    const installedVersion = localStorage.getItem(CLOUD_CACHE_VERSION_KEY);
    if (installedVersion !== CURRENT_CLOUD_CACHE_VERSION) {
      const keysToReset = [
        STORAGE_KEYS.CLINICS,
        STORAGE_KEYS.DOCTORS,
        STORAGE_KEYS.BOOKINGS,
        STORAGE_KEYS.DAILY_SCHEDULE,
        STORAGE_KEYS.SUPPORT_INFO_TEXT,
        STORAGE_KEYS.OFFICIAL_WORKING_HOURS,
        STORAGE_KEYS.STAFF_PASSWORDS,
        STORAGE_KEYS.STAFF_ACCOUNTS,
        STORAGE_KEYS.DELETED_CLINICS,
        STORAGE_KEYS.DELETED_DOCTORS,
        STORAGE_KEYS.DELETED_BOOKINGS,
      ];
      for (const k of keysToReset) {
        localStorage.removeItem(k);
      }
      localStorage.setItem(CLOUD_CACHE_VERSION_KEY, CURRENT_CLOUD_CACHE_VERSION);
    }
  } catch {
    // ignore storage access errors
  }
}

export const DEFAULT_SUPPORT_INFO_TEXT = 'فريق الاستقبال في خدمتكم يومياً من 9:00 صباحاً حتى 10:00 مساءً للرد على كافة التساؤلات.';
export const DEFAULT_OFFICIAL_WORKING_HOURS = 'يومياً من 9:00 ص حتى 10:00 م';
export const DEFAULT_CONSULTATION_WINDOW_DAYS = 10;

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
    'confirm_payments_exemptions',
    'call_queue_patients',
    'manage_patient_exemptions',
  ],
  doctor: [],
  reception: [
    'manage_doctor_attendance', // الاستقبال مفوض افتراضياً بصلاحية تعديل حضور الأطباء
    'call_queue_patients',
  ],
  cashier: [
    'confirm_payments_exemptions',
    'manage_patient_exemptions',
  ],
};

// ==================== أمان وتنقية البيانات (Security & Sanitization) ====================

/**
 * تنقية وتطهير النصوص لمنع هجمات حقن الأكواد XSS والمحارف التحكمية
 */
export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u001F\u007F]/g, '') // إزالة المحارف التحكمية المخفية
    .replace(/[<>]/g, '') // إزالة وسوم HTML
    .replace(/(?:javascript|data|vbscript):/gi, '') // إزالة البروتوكولات الخطرة
    .replace(/\bon\w+\s*=/gi, '') // إزالة محاولات حقن الأحداث
    .trim();
}

/**
 * حماية خلايا Excel / CSV من هجمات حقن المعادلات (CSV / Formula Injection)
 * بمنع بدء الخلية برموز التنفيذ التلقائي (=, +, -, @, Tab, CR)
 */
export function sanitizeSpreadsheetCell(value: unknown): string | number {
  if (typeof value === 'number') return value;
  const str = String(value ?? '').trim();
  if (!str) return '';
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
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

export function getDeletedClinicIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_CLINICS);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function markClinicDeletedLocally(clinicId: string): void {
  try {
    const set = getDeletedClinicIds();
    set.add(clinicId);
    localStorage.setItem(STORAGE_KEYS.DELETED_CLINICS, JSON.stringify(Array.from(set)));
  } catch {}
}

export function unmarkClinicDeletedLocally(clinicId: string): void {
  try {
    const set = getDeletedClinicIds();
    if (set.has(clinicId)) {
      set.delete(clinicId);
      localStorage.setItem(STORAGE_KEYS.DELETED_CLINICS, JSON.stringify(Array.from(set)));
    }
  } catch {}
}

export function getDeletedDoctorIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_DOCTORS);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function markDoctorDeletedLocally(doctorId: string): void {
  try {
    const set = getDeletedDoctorIds();
    set.add(doctorId);
    localStorage.setItem(STORAGE_KEYS.DELETED_DOCTORS, JSON.stringify(Array.from(set)));
  } catch {}
}

export function unmarkDoctorDeletedLocally(doctorId: string): void {
  try {
    const set = getDeletedDoctorIds();
    if (set.has(doctorId)) {
      set.delete(doctorId);
      localStorage.setItem(STORAGE_KEYS.DELETED_DOCTORS, JSON.stringify(Array.from(set)));
    }
  } catch {}
}

export function getDeletedBookingIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_BOOKINGS);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function markBookingDeletedLocally(bookingId: string): void {
  try {
    const set = getDeletedBookingIds();
    set.add(bookingId);
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(STORAGE_KEYS.DELETED_BOOKINGS, JSON.stringify(arr));
  } catch {}
}

export function unmarkBookingDeletedLocally(bookingId: string): void {
  try {
    const set = getDeletedBookingIds();
    if (set.has(bookingId)) {
      set.delete(bookingId);
      localStorage.setItem(STORAGE_KEYS.DELETED_BOOKINGS, JSON.stringify(Array.from(set)));
    }
  } catch {}
}

export function getStoredClinics(): Clinic[] {
  try {
    const deletedIds = getDeletedClinicIds();
    const raw = localStorage.getItem(STORAGE_KEYS.CLINICS);
    if (!raw) {
      const initial = INITIAL_CLINICS.filter(c => !deletedIds.has(c.id));
      localStorage.setItem(STORAGE_KEYS.CLINICS, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    const legacyIds = new Set(['1', '2', '3', '4']);
    if (
      !Array.isArray(parsed) ||
      parsed.some((c: any) => !c || typeof c.id !== 'string' || typeof c.name !== 'string' || legacyIds.has(c.id))
    ) {
      const initial = INITIAL_CLINICS.filter(c => !deletedIds.has(c.id));
      localStorage.setItem(STORAGE_KEYS.CLINICS, JSON.stringify(initial));
      return initial;
    }
    if (parsed.length === 0 && deletedIds.size === 0) {
      localStorage.setItem(STORAGE_KEYS.CLINICS, JSON.stringify(INITIAL_CLINICS));
      return INITIAL_CLINICS;
    }
    return parsed.filter(
      (c: any) => !String(c.id).startsWith('_system') && !deletedIds.has(c.id) && c.description !== '__DELETED_CLINIC__'
    );
  } catch (e) {
    console.error('فشل قراءة بيانات العيادات:', e);
    return INITIAL_CLINICS;
  }
}

export function saveClinics(clinics: Clinic[]): void {
  try {
    const deletedIds = getDeletedClinicIds();
    const filtered = (clinics || []).filter(
      c => !String(c.id).startsWith('_system') && !deletedIds.has(c.id) && c.description !== '__DELETED_CLINIC__'
    );
    localStorage.setItem(STORAGE_KEYS.CLINICS, JSON.stringify(filtered));
  } catch (e) {
    console.error('فشل حفظ بيانات العيادات:', e);
  }
}

export function getStoredDoctors(): Doctor[] {
  try {
    const deletedIds = getDeletedDoctorIds();
    const raw = localStorage.getItem(STORAGE_KEYS.DOCTORS);
    if (!raw) {
      const initial = INITIAL_DOCTORS.filter(d => !deletedIds.has(d.id));
      localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    const legacyIds = new Set(['1', '2', '3', '4']);
    if (
      !Array.isArray(parsed) ||
      parsed.some((d: any) => !d || typeof d.id !== 'string' || typeof d.name !== 'string' || legacyIds.has(d.id))
    ) {
      const initial = INITIAL_DOCTORS.filter(d => !deletedIds.has(d.id));
      localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(initial));
      return initial;
    }
    if (parsed.length === 0 && deletedIds.size === 0) {
      localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(INITIAL_DOCTORS));
      return INITIAL_DOCTORS;
    }
    return parsed.filter((d: any) => !deletedIds.has(d.id) && d.bio !== '__DELETED_DOCTOR__');
  } catch (e) {
    console.error('فشل قراءة بيانات الأطباء:', e);
    return INITIAL_DOCTORS;
  }
}

export function saveDoctors(doctors: Doctor[]): void {
  try {
    const deletedIds = getDeletedDoctorIds();
    const filtered = (doctors || []).filter(d => !deletedIds.has(d.id) && d.bio !== '__DELETED_DOCTOR__');
    localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(filtered));
  } catch (e) {
    console.error('فشل حفظ بيانات الأطباء:', e);
  }
}

export function getStoredBookingsCutoffDate(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.BOOKINGS_CUTOFF) || '';
  } catch {
    return '';
  }
}

export function saveStoredBookingsCutoffDate(dateStr: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.BOOKINGS_CUTOFF, dateStr);
  } catch {}
}

function isBookingBeforeCutoff(b: Booking, cutoffDate: string): boolean {
  if (!cutoffDate) return false;
  if (cutoffDate.includes('T')) {
    const cutoffMs = new Date(cutoffDate).getTime();
    const createdMs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (!Number.isNaN(cutoffMs) && createdMs > 0 && createdMs <= cutoffMs) {
      return true;
    }
    return false;
  }
  if (cutoffDate === '9999-12-31') return false;
  const cleanDate = typeof b.date === 'string' ? b.date.split('T')[0] : String(b.date || '');
  return Boolean(cleanDate && cleanDate < cutoffDate);
}

export function getStoredBookings(): Booking[] {
  try {
    const deletedIds = getDeletedBookingIds();
    const cutoffDate = localStorage.getItem(STORAGE_KEYS.BOOKINGS_CUTOFF) || '';
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    // تصفية أي حجوزات محذوفة صراحة أو تسبق تاريخ/لحظة القطع
    const filtered = parsed.filter((b: Booking) => {
      if (!b) return false;
      if (deletedIds.has(String(b.id))) return false;
      if (b.notes === '__PURGED_PAST_BOOKING__') return false;
      if (isBookingBeforeCutoff(b, cutoffDate)) return false;
      return true;
    });
    return filtered;
  } catch (e) {
    console.error('فشل قراءة بيانات الحجوزات:', e);
    return [];
  }
}

export function saveBookings(bookings: Booking[]): void {
  try {
    const deletedIds = getDeletedBookingIds();
    const cutoffDate = localStorage.getItem(STORAGE_KEYS.BOOKINGS_CUTOFF) || '';
    const valid = (bookings || []).filter((b: Booking) => {
      if (!b) return false;
      if (deletedIds.has(String(b.id))) return false;
      if (b.notes === '__PURGED_PAST_BOOKING__') return false;
      if (isBookingBeforeCutoff(b, cutoffDate)) return false;
      return true;
    });
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(valid));
  } catch (e) {
    console.error('فشل حفظ بيانات الحجوزات:', e);
  }
}

export function removeBookingsBeforeDate(dateStr: string): Booking[] {
  try {
    const isPurgeAll = dateStr === '9999-12-31';
    const effectiveCutoff = isPurgeAll ? new Date().toISOString() : dateStr;
    localStorage.setItem(STORAGE_KEYS.BOOKINGS_CUTOFF, effectiveCutoff);
    if (isPurgeAll) {
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify([]));
      return [];
    }
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
    let current: Booking[] = [];
    if (raw) {
      try {
        current = JSON.parse(raw);
      } catch {}
    }
    const remaining = current.filter(
      b => b && !isBookingBeforeCutoff(b, effectiveCutoff) && b.notes !== '__PURGED_PAST_BOOKING__'
    );
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(remaining));
    return remaining;
  } catch (e) {
    return [];
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
      localStorage.removeItem(STORAGE_KEYS.SESSION);
      localStorage.removeItem(STORAGE_KEYS.BOOKINGS);
      localStorage.removeItem(STORAGE_KEYS.STAFF_PASSWORDS);
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

// تجزئات احتياطية مشفرة بـ SHA-256 لوضع عدم الاتصال المحلي فقط (بدون أي كلمات مرور نصية أو تخزين في المتصفح)
export const DEFAULT_PASSWORD_HASHES: Record<string, string> = {
  admin: '2e0ebbe2df13e248a1c1e9c1446a5d1a605484a416d66f4cc7802391d9a2b558',
  reception: '8d6a7d4173428e7073a5ad9b5209bc293336ed9ed5e08a25e0f82e6df653d804',
  cashier: '3a09f66bc67a9e66140e16d6e2279dd38dec038f51b01dcb2038a196fbef4ac6',
  doctor: '733d171967711964a0ea8dc5bbafa70e278008dbb225aaa23316f208e1e9f8c6',
  'doctor.pediatrics': '733d171967711964a0ea8dc5bbafa70e278008dbb225aaa23316f208e1e9f8c6',
  'doctor.ortho': '733d171967711964a0ea8dc5bbafa70e278008dbb225aaa23316f208e1e9f8c6',
  'doctor.dental': '733d171967711964a0ea8dc5bbafa70e278008dbb225aaa23316f208e1e9f8c6',
};

// ==================== قائمة حسابات الكادر والمستخدمين الديناميكية ====================
export const DEFAULT_STAFF_ACCOUNTS: StaffAccount[] = [
  {
    id: 'staff-admin',
    username: 'admin',
    displayName: 'د. أحمد الشناوي (مدير المنظومة)',
    role: 'admin',
  },
  {
    id: 'staff-reception',
    username: 'reception',
    displayName: 'أ. سارة مصطفى (مسؤولة الاستقبال)',
    role: 'reception',
  },
  {
    id: 'staff-cashier',
    username: 'cashier',
    displayName: 'أ. محمود إبراهيم (أمين الصندوق والخزينة)',
    role: 'cashier',
  },
  {
    id: 'staff-doctor',
    username: 'doctor',
    displayName: 'د. علي عبد الرحمن (عيادة الباطنة)',
    role: 'doctor',
    doctorId: 'doc-1',
    clinicId: 'clinic-internal',
  },
  {
    id: 'staff-doctor-pediatrics',
    username: 'doctor.pediatrics',
    displayName: 'د. فاطمة الزهراء كمال (عيادة الأطفال)',
    role: 'doctor',
    doctorId: 'doc-2',
    clinicId: 'clinic-pediatrics',
  },
  {
    id: 'staff-doctor-ortho',
    username: 'doctor.ortho',
    displayName: 'د. حسام الدين عبد الله (عيادة العظام)',
    role: 'doctor',
    doctorId: 'doc-3',
    clinicId: 'clinic-orthopedics',
  },
  {
    id: 'staff-doctor-dental',
    username: 'doctor.dental',
    displayName: 'د. منى الشاذلي (عيادة الأسنان)',
    role: 'doctor',
    doctorId: 'doc-4',
    clinicId: 'clinic-dental',
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
    // عدم تخزين البريد الإلكتروني للاستعادة (recoveryEmail) في localStorage لحماية خصوصية الحسابات
    const safeForLocalStorage = (accounts || []).map(({ recoveryEmail: _omitted, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEYS.STAFF_ACCOUNTS, JSON.stringify(safeForLocalStorage));
  } catch (e) {
    console.error('فشل حفظ حسابات الموظفين:', e);
  }
}

export function removeStaffPasswordHash(_username: string): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.STAFF_PASSWORDS);
  } catch {
    // ignore
  }
}

export function deleteStaffAccountById(id: string): { success: boolean; error?: string; remainingAccounts: StaffAccount[] } {
  const current = getStoredStaffAccounts();
  const target = current.find(a => a.id === id);
  if (!target) {
    return { success: false, error: 'المستخدم غير موجود', remainingAccounts: current };
  }

  // منع حذف الحساب الرئيسي أو آخر حساب أدمن في المنظومة
  if (target.role === 'admin') {
    if (target.username.trim().toLowerCase() === 'admin') {
      return { success: false, error: 'لا يمكن حذف حساب المدير الرئيسي للمنظومة (admin).', remainingAccounts: current };
    }
    const adminCount = current.filter(a => a.role === 'admin').length;
    if (adminCount <= 1) {
      return { success: false, error: 'لا يمكن حذف آخر حساب مدير متبقٍ في المنظومة لضمان استمرارية الإدارة.', remainingAccounts: current };
    }
  }

  const updated = current.filter(a => a.id !== id);
  saveStaffAccounts(updated);
  removeStaffPasswordHash(target.username);
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
    // تنظيف أي تجزئات قديمة مخزنة في localStorage لمنع قراءتها من الكونسول
    localStorage.removeItem(STORAGE_KEYS.STAFF_PASSWORDS);
  } catch {}
  return { ...DEFAULT_PASSWORD_HASHES };
}

export function saveStaffPasswordHash(_username: string, _newHash: string): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.STAFF_PASSWORDS);
  } catch {}
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
    localStorage.removeItem('sharaya_login_attempts_v2');
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
export function checkBookingRateLimit(
  patientName: string,
  phone: string,
  clinicId: string,
  date: string,
  timeSlot?: string,
  currentBookings?: Booking[]
): { allowed: boolean; reason?: string } {
  const bookings = currentBookings || getStoredBookings();
  const cleanPhone = phone.replace(/[\s-]/g, '');
  const normalizedNewName = patientName.trim().replace(/\s+/g, ' ').toLowerCase();

  // 1. فحص هل يوجد حجز نشط (غير ملغي وغير مكتمل) لنفس الاسم ونفس رقم الهاتف ونفس العيادة ونفس اليوم
  const duplicateBooking = bookings.find(
    b => b.patientPhone.replace(/[\s-]/g, '') === cleanPhone &&
         b.clinicId === clinicId &&
         b.date === date &&
         b.status !== 'cancelled' &&
         b.status !== 'completed' &&
         b.patientName.trim().replace(/\s+/g, ' ').toLowerCase() === normalizedNewName
  );

  if (duplicateBooking) {
    return {
      allowed: false,
      reason: `يوجد حجز نشط مسجل مسبقاً باسم (${patientName.trim()}) بنفس رقم الهاتف في هذه العيادة لليوم (تذكرة رقم: ${duplicateBooking.ticketNumber}). لا يمكن تكرار الحجز لنفس المريض.`
    };
  }

  // 2. منع تضارب المواعيد لنفس المريض في نفس الفترة الزمنية مع عيادة أخرى في نفس اليوم
  if (timeSlot) {
    const conflictBooking = bookings.find(
      b => b.patientPhone.replace(/[\s-]/g, '') === cleanPhone &&
           b.clinicId !== clinicId &&
           b.date === date &&
           b.timeSlot === timeSlot &&
           b.status !== 'cancelled' &&
           b.status !== 'completed' &&
           b.patientName.trim().replace(/\s+/g, ' ').toLowerCase() === normalizedNewName
    );

    if (conflictBooking) {
      return {
        allowed: false,
        reason: `يوجد تضارب في المواعيد: المريض (${patientName.trim()}) لديه حجز نشط آخر في (${conflictBooking.clinicName}) في نفس الفترة الزمنية (${timeSlot}). يرجى اختيار فترة زمنية مختلفة.`
      };
    }
  }

  // 3. حد أمان عام لمنع محاولات الإغراق الآلي (بحد أقصى 6 تذاكر يومياً للأسرة الواحدة عبر نفس الهاتف)
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
 * تصدير البيانات إلى ملف Excel بصيغة xlsx مع الحماية ضد حقن المعادلات (CSV/Excel Formula Injection)
 */
export function exportBookingsToExcel(bookings: Booking[], fileName = 'سجل_حجوزات_عيادات_الجمعية_الشرعية.xlsx'): void {
  const rows = bookings.map(b => ({
    'رقم التذكرة': sanitizeSpreadsheetCell(b.ticketNumber),
    'اسم المريض': sanitizeSpreadsheetCell(b.patientName),
    'رقم الهاتف': sanitizeSpreadsheetCell(b.patientPhone),
    'العيادة': sanitizeSpreadsheetCell(b.clinicName),
    'الطبيب المعالج': sanitizeSpreadsheetCell(b.doctorName),
    'تاريخ الكشف': sanitizeSpreadsheetCell(b.date),
    'الموعد التقريبي': sanitizeSpreadsheetCell(b.timeSlot),
    'رقم الدور': Number(b.queuePosition || 0),
    'حالة الكشف': b.status === 'completed' ? 'مكتمل' : b.status === 'in-progress' ? 'داخل العيادة' : b.status === 'waiting' ? 'في الانتظار' : 'ملغي',
    'حالة الدفع': b.paymentStatus === 'paid' ? 'تم السداد' : b.paymentStatus === 'exempt' ? 'إعفاء خيري' : 'غير مسدد',
    'قيمة الكشف (ج.م)': Number(b.fee || 0),
    'ملاحظات التشخيص': sanitizeSpreadsheetCell(b.doctorDiagnosis || b.notes || '—'),
    'وقت الحجز': sanitizeSpreadsheetCell(b.createdAt)
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'الحجوزات');
  
  // حفظ وتنزيل الملف
  XLSX.writeFile(workbook, fileName);
}

// ==================== إدارة جدول عيادات اليوم ====================

export function getStoredDailySchedule(clinics: Clinic[], doctors: Doctor[]): DailyScheduleState {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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

export function getStoredOfficialWorkingHours(): string {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.OFFICIAL_WORKING_HOURS);
    return val !== null && val.trim().length > 0 ? val : DEFAULT_OFFICIAL_WORKING_HOURS;
  } catch (e) {
    return DEFAULT_OFFICIAL_WORKING_HOURS;
  }
}

export function saveOfficialWorkingHours(text: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.OFFICIAL_WORKING_HOURS, text);
  } catch (e) {
    console.error('فشل حفظ مواعيد العمل الرسمية:', e);
  }
}

export function detectReadableDeviceInfo(): string {
  try {
    if (typeof navigator === 'undefined') return 'جهاز غير معروف';
    const ua = navigator.userAgent || '';
    let os = 'نظام غير محدد';
    if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';

    let browser = 'متصفح ويب';
    if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/Chrome\//i.test(ua)) browser = 'Chrome';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';
    else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';

    const screenInfo = typeof window !== 'undefined' && window.screen
      ? `${window.screen.width}x${window.screen.height}`
      : '';

    return `${os} • ${browser}${screenInfo ? ` (${screenInfo})` : ''}`;
  } catch {
    return 'متصفح ويب';
  }
}

export function getStoredErrorLogs(): SystemErrorLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ERROR_LOGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveErrorLogs(logs: SystemErrorLog[]): void {
  try {
    const trimmed = logs.slice(0, 100);
    localStorage.setItem(STORAGE_KEYS.ERROR_LOGS, JSON.stringify(trimmed));
  } catch (e) {
    console.error('فشل حفظ سجلات الأخطاء محلياً:', e);
  }
}

export function getPendingErrorLogs(): SystemErrorLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_ERROR_LOGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePendingErrorLogs(logs: SystemErrorLog[]): void {
  try {
    const trimmed = logs.slice(0, 50);
    localStorage.setItem(STORAGE_KEYS.PENDING_ERROR_LOGS, JSON.stringify(trimmed));
  } catch {}
}

export function recordLocalSystemError(input: {
  source: SystemErrorSource;
  message: string;
  stack?: string;
  componentStack?: string;
}): SystemErrorLog {
  const session = getStoredSession();
  const entry: SystemErrorLog = {
    id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    source: input.source,
    message: input.message || 'خطأ غير معروف في النظام',
    stack: input.stack,
    componentStack: input.componentStack,
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    deviceInfo: detectReadableDeviceInfo(),
    userRole: session?.role || 'patient_visitor',
    username: session?.username || 'زائر / مريض',
    timestamp: new Date().toISOString(),
    resolved: false,
    syncedToDb: false,
  };

  try {
    const existing = getStoredErrorLogs();
    saveErrorLogs([entry, ...existing]);

    const pending = getPendingErrorLogs();
    savePendingErrorLogs([entry, ...pending]);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sharaya:system-error-logged', { detail: entry }));
    }
  } catch {}

  return entry;
}

/**
 * تفريغ الذاكرة المؤقتة التالفة للتطبيق والـ Service Worker وإعادة التحميل التلقائي
 */
export function clearAppCacheAndReload(): void {
  try {
    // إزالة مفاتيح التخزين المؤقت للتطبيق مع الاحتفاظ بسجل الأخطاء وسجل الاستشارات النشطة
    Object.entries(STORAGE_KEYS).forEach(([keyName, storageKey]) => {
      if (
        keyName === 'ERROR_LOGS' ||
        keyName === 'PENDING_ERROR_LOGS' ||
        keyName === 'SESSION' ||
        keyName === 'CONSULTATION_REGISTRY'
      )
        return;
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {}
    });

    // مسح كاش الـ Service Worker
    if (typeof caches !== 'undefined') {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }

    // إلغاء تسجيل Service Worker القديم لإجبار المتصفح على سحب النسخة الأحدث
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => reg.unregister());
      });
    }
  } catch (e) {
    console.error('فشل تفريغ الذاكرة المؤقتة:', e);
  }

  // إعادة التحميل مع تجاوز الكاش
  setTimeout(() => {
    window.location.reload();
  }, 100);
}

// ==================== سجل الاستشارات المجانية ذاتي المسح (Auto-Pruning Consultation Registry) ====================

function getTodayCairoIsoDate(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {}
  return new Date().toISOString().split('T')[0];
}

export function calculateDaysBetweenDates(examDateStr: string, currentDateStr?: string): number {
  const refToday = (currentDateStr || getTodayCairoIsoDate()).split('T')[0];
  const cleanExam = String(examDateStr || '').split('T')[0];
  const [y1, m1, d1] = cleanExam.split('-').map(Number);
  const [y2, m2, d2] = refToday.split('-').map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 9999;
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

/**
 * تنظيف تلقائي لأي بصمة استشارة تجاوزت عدد الأيام المسموحة حتى لا تستهلك أي مساحة
 */
export function pruneConsultationRegistry(
  raw: Partial<ConsultationRegistryState> | null | undefined,
  todayStr?: string
): ConsultationRegistryState {
  const refToday = todayStr || getTodayCairoIsoDate();
  const rawDays = Number(raw?.windowDays);
  const windowDays =
    Number.isFinite(rawDays) && rawDays >= 1 && rawDays <= 90
      ? Math.round(rawDays)
      : DEFAULT_CONSULTATION_WINDOW_DAYS;

  const cleanClinicWindows: Record<string, number> = {};
  if (raw?.clinicWindows && typeof raw.clinicWindows === 'object') {
    for (const [cid, val] of Object.entries(raw.clinicWindows)) {
      const n = Number(val);
      if (cid && Number.isFinite(n) && n >= 1 && n <= 90) {
        cleanClinicWindows[cid] = Math.round(n);
      }
    }
  }

  const rawStamps = Array.isArray(raw?.stamps) ? raw!.stamps : [];
  const dedupMap = new Map<string, ConsultationStamp>();

  for (const item of rawStamps) {
    if (!item || typeof item !== 'object') continue;
    const cleanPhone = String(item.phone || '').replace(/\D/g, '');
    const cleanClinicId = String(item.clinicId || '').trim();
    const cleanExamDate = String(item.examDate || '').split('T')[0];
    if (cleanPhone.length < 10 || !cleanClinicId || !cleanExamDate) continue;

    const effectiveWindow = cleanClinicWindows[cleanClinicId] || windowDays;
    const daysAgo = calculateDaysBetweenDates(cleanExamDate, refToday);
    // إذا تجاوزت المدة المحددة (أو تاريخ غير منطقي)، تُحذف تلقائياً فوراً
    if (daysAgo < 0 || daysAgo > effectiveWindow) continue;

    const key = `${cleanPhone}__${cleanClinicId}`;
    const existing = dedupMap.get(key);
    const cleanPatientName = typeof item.patientName === 'string' ? item.patientName.trim() : undefined;
    if (!existing || cleanExamDate >= existing.examDate) {
      dedupMap.set(key, {
        phone: cleanPhone,
        patientName: cleanPatientName || existing?.patientName,
        clinicId: cleanClinicId,
        examDate: cleanExamDate,
        updatedAt: item.updatedAt || new Date().toISOString(),
      });
    }
  }

  const rawIds = Array.isArray(raw?.consultationBookingIds) ? raw!.consultationBookingIds : [];
  const cleanBookingIds = Array.from(
    new Set(rawIds.map((id) => String(id || '').trim()).filter(Boolean))
  ).slice(-250);

  return {
    windowDays,
    clinicWindows: cleanClinicWindows,
    stamps: Array.from(dedupMap.values()),
    consultationBookingIds: cleanBookingIds,
  };
}

export function getStoredConsultationRegistry(todayStr?: string): ConsultationRegistryState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONSULTATION_REGISTRY);
    if (!raw) {
      return {
        windowDays: DEFAULT_CONSULTATION_WINDOW_DAYS,
        stamps: [],
        consultationBookingIds: [],
      };
    }
    const parsed = JSON.parse(raw);
    const pruned = pruneConsultationRegistry(parsed, todayStr);
    return pruned;
  } catch {
    return {
      windowDays: DEFAULT_CONSULTATION_WINDOW_DAYS,
      stamps: [],
      consultationBookingIds: [],
    };
  }
}

export function saveConsultationRegistry(
  registry: ConsultationRegistryState,
  todayStr?: string
): ConsultationRegistryState {
  const pruned = pruneConsultationRegistry(registry, todayStr);
  try {
    localStorage.setItem(STORAGE_KEYS.CONSULTATION_REGISTRY, JSON.stringify(pruned));
  } catch {}
  return pruned;
}

export function checkPatientConsultationEligibility(
  phone: string,
  clinicId: string,
  registry: ConsultationRegistryState,
  todayStr?: string
): {
  eligible: boolean;
  examDate?: string;
  daysAgo?: number;
  remainingDays?: number;
  patientName?: string;
} {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const cleanClinicId = String(clinicId || '').trim();
  if (cleanPhone.length < 10 || !cleanClinicId) {
    return { eligible: false };
  }
  const refToday = todayStr || getTodayCairoIsoDate();
  const pruned = pruneConsultationRegistry(registry, refToday);
  const match = pruned.stamps.find(
    (s) => s.phone === cleanPhone && s.clinicId === cleanClinicId
  );
  if (!match) {
    return { eligible: false };
  }
  const effectiveWindow = pruned.clinicWindows?.[cleanClinicId] || pruned.windowDays;
  const daysAgo = calculateDaysBetweenDates(match.examDate, refToday);
  if (daysAgo < 0 || daysAgo > effectiveWindow) {
    return { eligible: false };
  }
  return {
    eligible: true,
    examDate: match.examDate,
    daysAgo,
    remainingDays: Math.max(0, effectiveWindow - daysAgo),
    patientName: match.patientName,
  };
}


