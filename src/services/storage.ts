import {
  Clinic,
  Doctor,
  Booking,
  UserSession,
  StaffAccount,
  DailyScheduleState,
  RolePermissionsMap,
  PermissionDefinition,
  UserRole,
  SystemPermission,
  SystemErrorLog,
  SystemErrorSource,
  ConsultationRegistryState,
  ConsultationStamp,
  InsuranceCompanyContract,
  BookingInsuranceDetails,
  ShiftHandoverRecord,
  FinanceLedgerState,
  FinanceExpenseRecord,
  InsuranceClaimSettlementRecord,
  DoctorCommissionRule,
  SystemTrialLicenseConfig,
  SecurityAttemptType,
  SecurityIntrusionAttempt,
  BlockedSecurityEntity
} from '../types';
import { INITIAL_CLINICS, INITIAL_DOCTORS, INITIAL_BOOKINGS } from '../data/mockData';
import * as XLSX from 'xlsx';
import XLSXStyle from 'xlsx-js-style';

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
  INSURANCE_CONTRACTS: 'sharaya_insurance_contracts_v1',
  INSURANCE_BOOKINGS: 'sharaya_insurance_bookings_v1',
  SHIFT_HANDOVERS: 'sharaya_shift_handovers_v1',
  FINANCE_LEDGER: 'sharaya_finance_ledger_v1',
  TRIAL_LICENSE: 'sharaya_trial_license_v1',
};

const CLOUD_CACHE_VERSION_KEY = 'sharaya_cloud_sync_version';
const CURRENT_CLOUD_CACHE_VERSION = 'v22_supabase_live_sync';

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
  finance_manager: [
    'view_financial_reports',
    'manage_clinic_fees',
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
    const savedSeal = sessionStorage.getItem('sharaya_session_seal_v2');
    const expectedSeal = computeSyncSecuritySeal(raw);
    if (savedSeal && savedSeal !== expectedSeal) {
      sessionStorage.removeItem(STORAGE_KEYS.SESSION);
      sessionStorage.removeItem('sharaya_session_seal_v2');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sharaya:security-tamper-detected', {
            detail: {
              type: 'storage_tamper',
              label: 'محاولة تزوير جلسة الدخول (Session Storage Tampering)',
            },
          })
        );
      }
      return null;
    }
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function saveSession(session: UserSession | null): void {
  try {
    if (!session) {
      sessionStorage.removeItem(STORAGE_KEYS.SESSION);
      sessionStorage.removeItem('sharaya_session_seal_v2');
      localStorage.removeItem(STORAGE_KEYS.SESSION);
      localStorage.removeItem(STORAGE_KEYS.BOOKINGS);
      localStorage.removeItem(STORAGE_KEYS.STAFF_PASSWORDS);
    } else {
      const json = JSON.stringify(session);
      sessionStorage.setItem(STORAGE_KEYS.SESSION, json);
      sessionStorage.setItem('sharaya_session_seal_v2', computeSyncSecuritySeal(json));
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
  finance: '2e0ebbe2df13e248a1c1e9c1446a5d1a605484a416d66f4cc7802391d9a2b558',
  doctor: '733d171967711964a0ea8dc5bbafa70e278008dbb225aaa23316f208e1e9f8c6',
  'doctor.pediatrics': '733d171967711964a0ea8dc5bbafa70e278008dbb225aaa23316f208e1e9f8c6',
  'doctor.ortho': '733d171967711964a0ea8dc5bbafa70e278008dbb225aaa23316f208e1e9f8c6',
  'doctor.dental': '733d171967711964a0ea8dc5bbafa70e278008dbb225aaa23316f208e1e9f8c6',
};

// ==================== قائمة حسابات الكادر والمستخدمين الديناميكية ====================
export const DEFAULT_STAFF_ACCOUNTS: StaffAccount[] = [
  {
    id: 'staff-admin',
    authUserId: '00000000-0000-0000-0000-000000000101',
    username: 'admin',
    displayName: 'د. أحمد الشناوي (مدير المنظومة)',
    role: 'admin',
  },
  {
    id: 'staff-finance',
    authUserId: '00000000-0000-0000-0000-000000000101',
    username: 'finance',
    displayName: 'أ. خالد المنشاوي (مدير المالية والحسابات)',
    role: 'finance_manager',
  },
  {
    id: 'staff-reception',
    authUserId: '00000000-0000-0000-0000-000000000102',
    username: 'reception',
    displayName: 'أ. سارة مصطفى (مسؤولة الاستقبال)',
    role: 'reception',
  },
  {
    id: 'staff-cashier',
    authUserId: '00000000-0000-0000-0000-000000000103',
    username: 'cashier',
    displayName: 'أ. محمود إبراهيم (أمين الصندوق والخزينة)',
    role: 'cashier',
  },
  {
    id: 'staff-doctor',
    authUserId: '00000000-0000-0000-0000-000000000104',
    username: 'doctor',
    displayName: 'د. علي عبد الرحمن (عيادة الباطنة)',
    role: 'doctor',
    doctorId: 'doc-1',
    clinicId: 'clinic-internal',
  },
  {
    id: 'staff-doctor-pediatrics',
    authUserId: '00000000-0000-0000-0000-000000000105',
    username: 'doctor.pediatrics',
    displayName: 'د. فاطمة الزهراء كمال (عيادة الأطفال)',
    role: 'doctor',
    doctorId: 'doc-2',
    clinicId: 'clinic-pediatrics',
  },
  {
    id: 'staff-doctor-ortho',
    authUserId: '00000000-0000-0000-0000-000000000106',
    username: 'doctor.ortho',
    displayName: 'د. حسام الدين عبد الله (عيادة العظام)',
    role: 'doctor',
    doctorId: 'doc-3',
    clinicId: 'clinic-orthopedics',
  },
  {
    id: 'staff-doctor-dental',
    authUserId: '00000000-0000-0000-0000-000000000107',
    username: 'doctor.dental',
    displayName: 'د. منى الشاذلي (عيادة الأسنان)',
    role: 'doctor',
    doctorId: 'doc-4',
    clinicId: 'clinic-dental',
  }
];

function normalizeStaffAccountItem(acc: StaffAccount): StaffAccount {
  const cleanUser = String(acc?.username || '').trim().toLowerCase();
  const effectiveRole: UserRole =
    cleanUser === 'finance' || acc?.role === 'finance_manager'
      ? 'finance_manager'
      : acc.role;
  const fallbackAuthUid =
    acc.authUserId ||
    (effectiveRole === 'admin' || effectiveRole === 'finance_manager'
      ? '00000000-0000-0000-0000-000000000101'
      : effectiveRole === 'reception'
      ? '00000000-0000-0000-0000-000000000102'
      : effectiveRole === 'cashier'
      ? '00000000-0000-0000-0000-000000000103'
      : '00000000-0000-0000-0000-000000000104');
  return {
    ...acc,
    role: effectiveRole,
    authUserId: fallbackAuthUid,
  };
}

export function getStoredStaffAccounts(): StaffAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STAFF_ACCOUNTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.STAFF_ACCOUNTS, JSON.stringify(DEFAULT_STAFF_ACCOUNTS));
      return DEFAULT_STAFF_ACCOUNTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const normalized = parsed.map(normalizeStaffAccountItem);
      const hasFinance = normalized.some(
        (a: StaffAccount) => String(a.username || '').trim().toLowerCase() === 'finance'
      );
      if (!hasFinance) {
        const defaultFinance = DEFAULT_STAFF_ACCOUNTS.find(a => a.username === 'finance');
        if (defaultFinance) {
          normalized.splice(1, 0, defaultFinance);
        }
      }
      return normalized;
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
    const safeForLocalStorage = (accounts || [])
      .map(normalizeStaffAccountItem)
      .map(({ recoveryEmail: _omitted, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEYS.STAFF_ACCOUNTS, JSON.stringify(safeForLocalStorage));
  } catch (e) {
    console.error('فشل حفظ حسابات الموظفين:', e);
  }
}

const runtimeStaffPasswordHashes: Record<string, string> = {
  ...DEFAULT_PASSWORD_HASHES,
};

export function removeStaffPasswordHash(username: string): void {
  try {
    const cleanUser = String(username || '').trim().toLowerCase();
    if (cleanUser) {
      delete runtimeStaffPasswordHashes[cleanUser];
    }
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
  return { ...DEFAULT_PASSWORD_HASHES, ...runtimeStaffPasswordHashes };
}

export function saveStaffPasswordHash(username: string, newHash: string): void {
  try {
    const cleanUser = String(username || '').trim().toLowerCase();
    if (cleanUser && newHash) {
      runtimeStaffPasswordHashes[cleanUser] = newHash;
    }
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

    if (userRecord.attempts >= 3 && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sharaya:security-tamper-detected', {
          detail: {
            type: 'brute_force_login',
            label: `تخمين متكرر لكلمة المرور على حساب (${cleanUser}) — المحاولة رقم ${userRecord.attempts}`,
          },
        })
      );
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
 * دالة احترافية لبناء ورقة عمل إكسل (Worksheet) منسقة وملونة ومسطرة بالكامل باللغة العربية (من اليمين لليسار RTL)
 * مع تلوين الترويسة، وتسطير كافة الخلايا بحدود واضحة، وتوسيط النصوص والأرقام، وتظليل صفوف الإجمالي والصافي
 */
export function buildFormattedRtlWorksheet(
  rowsOrOptions:
    | Record<string, any>[]
    | {
        reportTitle: string;
        reportSubtitle: string;
        rows: Record<string, any>[];
        columns?: string[];
        totalsRow?: Record<string, any>;
        emptyMessage?: string;
        enableAutoFilter?: boolean;
        headerBgColor?: string;
      },
  maybeOptions?: {
    reportTitle?: string;
    reportSubtitle?: string;
    columns?: string[];
    totalsRow?: Record<string, any>;
    emptyMessage?: string;
    enableAutoFilter?: boolean;
    headerBgColor?: string;
  }
): XLSX.WorkSheet {
  const isArrayArg = Array.isArray(rowsOrOptions);
  const rows = isArrayArg ? rowsOrOptions : rowsOrOptions.rows;
  const explicitColumns = isArrayArg ? maybeOptions?.columns : rowsOrOptions.columns;
  const reportTitle = isArrayArg
    ? maybeOptions?.reportTitle || 'عيادات الجمعية الشرعية'
    : rowsOrOptions.reportTitle;
  const reportSubtitle = isArrayArg
    ? maybeOptions?.reportSubtitle || ''
    : rowsOrOptions.reportSubtitle;
  const totalsRow = isArrayArg ? maybeOptions?.totalsRow : rowsOrOptions.totalsRow;
  const emptyMessage = isArrayArg ? maybeOptions?.emptyMessage : rowsOrOptions.emptyMessage;
  const enableAutoFilter = isArrayArg
    ? Boolean(maybeOptions?.enableAutoFilter)
    : Boolean(rowsOrOptions.enableAutoFilter);
  const headerBgColor =
    (isArrayArg ? maybeOptions?.headerBgColor : rowsOrOptions.headerBgColor) || '0F766E';

  const hasDataRows = rows.length > 0;
  const headers: string[] =
    hasDataRows
      ? Object.keys(rows[0])
      : explicitColumns && explicitColumns.length > 0
      ? explicitColumns
      : ['م', 'البيان / التفاصيل', 'الحالة / القيمة'];

  const numCols = Math.max(1, headers.length);

  // بناء المصفوفة الثنائية (Array of Arrays) لضمان ترتيب الترويسة والجدول بدقة
  const aoa: (string | number)[][] = [];

  // الصف 1 (r=0): عنوان التقرير الرئيسي
  const titleRow: (string | number)[] = new Array(numCols).fill('');
  titleRow[0] = sanitizeSpreadsheetCell(reportTitle);
  aoa.push(titleRow);

  // الصف 2 (r=1): العنوان الفرعي وتفاصيل الفترة وتاريخ الاستخراج
  const subRow: (string | number)[] = new Array(numCols).fill('');
  subRow[0] = sanitizeSpreadsheetCell(reportSubtitle);
  aoa.push(subRow);

  // الصف 3 (r=2): صف فارغ للفصل البصري المريح
  aoa.push(new Array(numCols).fill(''));

  // الصف 4 (r=3): رؤوس الأعمدة الرسمية كاملة دائماً
  aoa.push(headers.map((h) => sanitizeSpreadsheetCell(h)));

  // الصفوف 5..N (r=4..): صفوف البيانات الفعلية أو صف تنبيه منسق مدمج عند عدم وجود سجلات
  if (hasDataRows) {
    for (const r of rows) {
      const isAllBlank = headers.every((h) => r[h] === '' || r[h] === undefined || r[h] === null);
      if (isAllBlank) {
        aoa.push(new Array(numCols).fill(''));
      } else {
        aoa.push(headers.map((h) => sanitizeSpreadsheetCell(r[h] ?? '—')));
      }
    }
  } else {
    const emptyRow: (string | number)[] = new Array(numCols).fill('');
    emptyRow[0] = sanitizeSpreadsheetCell(
      emptyMessage || 'لا توجد سجلات مسجلة في هذه الفترة الزمنية حتى الآن (0)'
    );
    aoa.push(emptyRow);
  }

  // صف الإجمالي العام في نهاية الجدول (إن وجد)
  if (totalsRow) {
    aoa.push(headers.map((h) => sanitizeSpreadsheetCell(totalsRow[h] ?? '—')));
  }

  const ws = XLSXStyle.utils.aoa_to_sheet(aoa) as XLSX.WorkSheet;

  // 1. تفعيل اتجاه الورقة من اليمين لليسار (RTL) وإعداد الطباعة بالعرض في صفحة واحدة
  ws['!views'] = [{ rightToLeft: true }];
  (ws as any)['!pageSetup'] = {
    orientation: 'landscape',
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
  };

  // 2. دمج خلايا العنوان الرئيسي والعنوان الفرعي (ودمج صف عدم وجود سجلات إن كان الجدول فارغاً)
  const merges: XLSX.Range[] = [];
  if (numCols > 1) {
    merges.push(
      { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } }
    );
    if (!hasDataRows) {
      merges.push({ s: { r: 4, c: 0 }, e: { r: 4, c: numCols - 1 } });
    }
  }
  if (merges.length > 0) {
    ws['!merges'] = merges;
  }

  // 3. حساب عرض كل عمود بذكاء ليظهر الجدول كاملاً في شاشة كمبيوتر واحدة بدون سحب يمين وشمال (مع التفاف النص التلقائي)
  const isWideMultiColSheet = numCols >= 10;
  const isMediumSheet = numCols >= 8 && numCols < 10;

  const colWidths = headers.map((headerText, colIdx) => {
    const cleanHeader = String(headerText || '').trim();
    if (cleanHeader === 'م' || cleanHeader === '#') {
      return { wch: 6 };
    }

    // السماح بالتفاف عنوان العمود الطويل على سطرين بدلاً من توسيع العمود بشكل مبالغ فيه
    const effectiveHeaderLen =
      cleanHeader.length > 15 ? Math.ceil(cleanHeader.length * 0.62) : cleanHeader.length;

    let maxDataLen = effectiveHeaderLen;
    if (hasDataRows) {
      for (let rIdx = 4; rIdx < aoa.length; rIdx++) {
        const rowFirstCell = String(aoa[rIdx]?.[0] ?? '').trim();
        const isSummaryRow =
          rowFirstCell === 'الإجمالي' ||
          rowFirstCell === 'إجمالي' ||
          rowFirstCell === '—' ||
          rowFirstCell === '★' ||
          rowFirstCell === '■';

        const cellVal = aoa[rIdx]?.[colIdx];
        if (cellVal !== undefined && cellVal !== null) {
          const strVal =
            typeof cellVal === 'number'
              ? cellVal.toLocaleString('en-US')
              : String(cellVal).trim();
          // نصوص صفوف الإجمالي الطويلة تلتف على سطرين ولا نسمح لها بمط العمود على حساب الشاشة
          const effectiveCellLen =
            isSummaryRow && strVal.length > 18
              ? Math.ceil(strVal.length * 0.55)
              : strVal.length > 26
              ? Math.ceil(strVal.length * 0.62)
              : strVal.length;

          if (effectiveCellLen > maxDataLen) {
            maxDataLen = effectiveCellLen;
          }
        }
      }
    }

    const extraFilterPadding = enableAutoFilter ? 3 : 0;
    const minW = isWideMultiColSheet ? 10 : isMediumSheet ? 13 : 15;
    const maxW = isWideMultiColSheet ? 21 : isMediumSheet ? 24 : 32;
    const computed = Math.ceil(maxDataLen * 1.12) + 3 + extraFilterPadding;
    return { wch: Math.min(maxW, Math.max(minW, computed)) };
  });
  ws['!cols'] = colWidths;

  // 4. ضبط ارتفاع الصفوف لتكون مريحة وتستوعب التفاف النصوص على سطرين بوضوح تام
  const rowHeights: { hpt: number }[] = [
    { hpt: 34 }, // صف العنوان الرئيسي
    { hpt: 24 }, // صف العنوان الفرعي
    { hpt: 8 },  // صف الفاصل
    { hpt: 36 }, // صف رؤوس الأعمدة (يتسع لسطرين بوضوح)
  ];
  if (hasDataRows) {
    for (let i = 0; i < rows.length; i++) {
      const rObj = rows[i];
      const firstVal = String(rObj?.[headers[0]] ?? '');
      const isSpecialSummary =
        firstVal === 'الإجمالي' ||
        firstVal === 'إجمالي' ||
        firstVal === '—' ||
        firstVal === '★' ||
        firstVal === '■';
      const hasLongWrappedCell = headers.some(
        (h) => String(rObj?.[h] ?? '').trim().length > 24
      );
      rowHeights.push({
        hpt: isSpecialSummary ? 32 : hasLongWrappedCell ? 30 : 25,
      });
    }
  } else {
    rowHeights.push({ hpt: 34 }); // صف التنبيه المدمج عند عدم وجود سجلات
  }
  if (totalsRow) {
    rowHeights.push({ hpt: 30 }); // صف الإجمالي العام
  }
  ws['!rows'] = rowHeights;

  // 5. تطبيق التنسيقات اللونية والحدود والمحاذاة على كل خلية في الجدول (xlsx-js-style)
  const thinBorder = {
    top: { style: 'thin', color: { rgb: '94A3B8' } },
    bottom: { style: 'thin', color: { rgb: '94A3B8' } },
    left: { style: 'thin', color: { rgb: '94A3B8' } },
    right: { style: 'thin', color: { rgb: '94A3B8' } },
  };

  const strongBorder = {
    top: { style: 'medium', color: { rgb: '0F172A' } },
    bottom: { style: 'medium', color: { rgb: '0F172A' } },
    left: { style: 'thin', color: { rgb: '64748B' } },
    right: { style: 'thin', color: { rgb: '64748B' } },
  };

  for (let r = 0; r < aoa.length; r++) {
    const rowArr = aoa[r] || [];
    const firstColStr = String(rowArr[0] ?? '').trim();
    const rowJoinedText = rowArr.map((x) => String(x ?? '')).join(' ');
    const isAllEmptyRow = rowArr.every((x) => x === '' || x === undefined || x === null);

    for (let c = 0; c < numCols; c++) {
      const cellRef = XLSXStyle.utils.encode_cell({ r, c });
      if (!ws[cellRef]) {
        ws[cellRef] = { t: 's', v: '' };
      }
      const cell = ws[cellRef] as any;

      if (r === 0) {
        // صف العنوان الرئيسي: أخضر ملكي داكن وخط أبيض عريض في المنتصف
        cell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: '064E3B' } },
          font: { name: 'Cairo', sz: 13, bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true, readingOrder: 2 },
          border: strongBorder,
        };
      } else if (r === 1) {
        // صف العنوان الفرعي: خلفية خضراء فاتحة هادئة وخط أخضر داكن عريض
        cell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: 'ECFDF5' } },
          font: { name: 'Cairo', sz: 10, bold: true, color: { rgb: '065F46' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true, readingOrder: 2 },
          border: thinBorder,
        };
      } else if (r === 2) {
        // صف الفاصل الفارغ
        cell.s = {
          alignment: { horizontal: 'center', vertical: 'center', readingOrder: 2 },
        };
      } else if (r === 3) {
        // صف رؤوس الأعمدة: خلفية تيل/كحلي رسمية وخط أبيض عريض في المنتصف
        cell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: headerBgColor } },
          font: { name: 'Cairo', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true, readingOrder: 2 },
          border: strongBorder,
        };
      } else if (!hasDataRows && r === 4) {
        // صف التنبيه المدمج عندما لا توجد سجلات في الفترة
        cell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } },
          font: { name: 'Cairo', sz: 11, bold: true, color: { rgb: '475569' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true, readingOrder: 2 },
          border: thinBorder,
        };
      } else {
        // صفوف البيانات والإجماليات
        if (isAllEmptyRow) {
          cell.s = {
            alignment: { horizontal: 'center', vertical: 'center', readingOrder: 2 },
          };
          continue;
        }

        const isSectionHeader = firstColStr === '■';
        const isNetCashRow =
          firstColStr === '★' || rowJoinedText.includes('صافي النقدية الفعلي');
        const isExpenseDeductionRow =
          (firstColStr === '—' || firstColStr === '-') &&
          (rowJoinedText.includes('المصروفات') || rowJoinedText.includes('خصم'));
        const isTotalsRow =
          (totalsRow && r === aoa.length - 1) ||
          firstColStr === 'الإجمالي' ||
          firstColStr === 'إجمالي' ||
          firstColStr === '—';

        const isNumericCell = typeof cell.v === 'number';
        if (isNumericCell) {
          cell.t = 'n';
          cell.z = '#,##0';
        }

        if (isSectionHeader) {
          cell.s = {
            fill: { patternType: 'solid', fgColor: { rgb: '1E3A8A' } },
            font: { name: 'Cairo', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true, readingOrder: 2 },
            border: strongBorder,
          };
        } else if (isNetCashRow) {
          cell.s = {
            fill: { patternType: 'solid', fgColor: { rgb: 'D1FAE5' } },
            font: { name: 'Cairo', sz: 10, bold: true, color: { rgb: '065F46' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true, readingOrder: 2 },
            border: strongBorder,
          };
        } else if (isExpenseDeductionRow) {
          cell.s = {
            fill: { patternType: 'solid', fgColor: { rgb: 'FFE4E6' } },
            font: { name: 'Cairo', sz: 10, bold: true, color: { rgb: '9F1239' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true, readingOrder: 2 },
            border: strongBorder,
          };
        } else if (isTotalsRow) {
          cell.s = {
            fill: { patternType: 'solid', fgColor: { rgb: 'FEF3C7' } },
            font: { name: 'Cairo', sz: 10, bold: true, color: { rgb: '78350F' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true, readingOrder: 2 },
            border: strongBorder,
          };
        } else {
          // صف بيانات عادي مع تظليل تبادلي (Zebra Striping) لراحة العين
          const dataRowIdx = r - 4;
          const zebraBg = dataRowIdx % 2 === 0 ? 'FFFFFF' : 'F1F5F9';
          const isBoldCol = c <= 2 || isNumericCell;
          cell.s = {
            fill: { patternType: 'solid', fgColor: { rgb: zebraBg } },
            font: {
              name: 'Cairo',
              sz: 10,
              bold: isBoldCol,
              color: { rgb: '0F172A' },
            },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true, readingOrder: 2 },
            border: thinBorder,
          };
        }
      }
    }
  }

  // 6. الفلتر التلقائي (AutoFilter) معطل افتراضياً لمنع سهم الفلتر (▼) من أكل أول الحروف العربية على الموبايل، ويتفعل فقط عند الطلب
  if (enableAutoFilter && numCols > 1) {
    ws['!autofilter'] = {
      ref: XLSXStyle.utils.encode_range({
        s: { r: 3, c: 0 },
        e: { r: 3 + Math.max(1, rows.length), c: numCols - 1 },
      }),
    };
  }

  return ws;
}

/**
 * ضبط مصنف الإكسل بالكامل (Workbook) ليفتح من اليمين لليسار (RTL) افتراضياً
 */
export function setWorkbookRtlView(wb: XLSX.WorkBook): void {
  wb.Workbook = {
    ...(wb.Workbook || {}),
    Views: [{ RTL: true }],
  };
}

export function configureRtlWorkbook(): XLSX.WorkBook {
  const wb = XLSXStyle.utils.book_new() as XLSX.WorkBook;
  setWorkbookRtlView(wb);
  return wb;
}

/**
 * حفظ وتنزيل مصنف الإكسل مع الاحتفاظ الكامل بالألوان والتسطير والخطوط العريضة عبر xlsx-js-style
 */
export function writeStyledWorkbookFile(wb: XLSX.WorkBook, fileName: string): void {
  setWorkbookRtlView(wb);
  XLSXStyle.writeFile(wb as any, fileName);
}

/**
 * تصدير جدول واحد مخصص في شيت إكسل ملون ومسطر مستقل (.xlsx)
 */
export function exportSingleStyledSheetToExcel(options: {
  sheetName: string;
  fileName: string;
  reportTitle: string;
  reportSubtitle: string;
  rows: Record<string, any>[];
  columns?: string[];
  totalsRow?: Record<string, any>;
  emptyMessage?: string;
  enableAutoFilter?: boolean;
  headerBgColor?: string;
}): void {
  const wb = configureRtlWorkbook();
  const ws = buildFormattedRtlWorksheet({
    reportTitle: options.reportTitle,
    reportSubtitle: options.reportSubtitle,
    rows: options.rows,
    columns: options.columns,
    totalsRow: options.totalsRow,
    emptyMessage: options.emptyMessage,
    enableAutoFilter: options.enableAutoFilter,
    headerBgColor: options.headerBgColor,
  });
  const safeSheetName =
    options.sheetName.replace(/[\\/?*[\]:]/g, '').slice(0, 28) || 'تقرير مالي';
  XLSXStyle.utils.book_append_sheet(wb as any, ws as any, safeSheetName);
  writeStyledWorkbookFile(wb, options.fileName);
}

/**
 * تصدير البيانات إلى ملف Excel بصيغة xlsx مع الحماية ضد حقن المعادلات (CSV/Excel Formula Injection)
 */
export function exportBookingsToExcel(bookings: Booking[], fileName = 'سجل_حجوزات_عيادات_الجمعية_الشرعية.xlsx'): void {
  const rows = bookings.map((b, idx) => ({
    'م': idx + 1,
    'رقم التذكرة': sanitizeSpreadsheetCell(b.ticketNumber),
    'اسم المريض': sanitizeSpreadsheetCell(b.patientName),
    'رقم الهاتف': sanitizeSpreadsheetCell(b.patientPhone),
    'العيادة التخصصية': sanitizeSpreadsheetCell(b.clinicName),
    'الطبيب المعالج': sanitizeSpreadsheetCell(b.doctorName),
    'تاريخ الكشف': sanitizeSpreadsheetCell(b.date),
    'الموعد التقريبي': sanitizeSpreadsheetCell(b.timeSlot),
    'رقم الدور': Number(b.queuePosition || 0),
    'حالة الكشف': b.status === 'completed' ? 'مكتمل' : b.status === 'in-progress' ? 'داخل العيادة' : b.status === 'waiting' ? 'في الانتظار' : 'ملغي',
    'حالة السداد': b.paymentStatus === 'paid' ? 'تم السداد' : b.paymentStatus === 'exempt' ? 'إعفاء خيري' : 'غير مسدد',
    'قيمة الكشف (ج.م)': Number(b.fee || 0),
    'ملاحظات التشخيص': sanitizeSpreadsheetCell(b.doctorDiagnosis || b.notes || '—'),
    'وقت الحجز': sanitizeSpreadsheetCell(b.createdAt)
  }));

  const totalFees = bookings.reduce((sum, b) => sum + (b.paymentStatus === 'paid' ? Number(b.fee || 0) : 0), 0);

  const worksheet = buildFormattedRtlWorksheet({
    reportTitle: 'عيادات الجمعية الشرعية — سجل الحجوزات والكشوفات الشامل',
    reportSubtitle: `تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')} | إجمالي السجلات: ${bookings.length} حالة | إجمالي المحصل: ${totalFees.toLocaleString()} ج.م`,
    rows,
    totalsRow: {
      'م': '',
      'رقم التذكرة': 'الإجمالي العام',
      'اسم المريض': `${bookings.length} حالة`,
      'رقم الهاتف': '',
      'العيادة التخصصية': '',
      'الطبيب المعالج': '',
      'تاريخ الكشف': '',
      'الموعد التقريبي': '',
      'رقم الدور': '',
      'حالة الكشف': '',
      'حالة السداد': 'إجمالي المسدد:',
      'قيمة الكشف (ج.م)': totalFees,
      'ملاحظات التشخيص': '',
      'وقت الحجز': ''
    }
  });

  const workbook = configureRtlWorkbook();
  XLSXStyle.utils.book_append_sheet(workbook as any, worksheet as any, 'سجل الحجوزات');

  // حفظ وتنزيل الملف مع الألوان والتنسيق الكامل
  writeStyledWorkbookFile(workbook, fileName);
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
      finance_manager: parsed.finance_manager || DEFAULT_ROLE_PERMISSIONS.finance_manager,
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

// ==================== منظومة تعاقدات شركات التأمين والكروت ونسبة التحمل ====================

export const STANDARD_INSURANCE_CARD_CATEGORIES: string[] = [
  'فضي (Silver)',
  'ذهبي (Gold)',
  'بلاتينيوم (Platinum)',
  'ماسي / VIP (Diamond)',
  'عادي / أساسي (Standard)',
];

export const DEFAULT_INSURANCE_CONTRACTS: InsuranceCompanyContract[] = [
  {
    id: 'ins-metlife',
    companyName: 'ميت لايف للتأمين (MetLife)',
    name: 'ميت لايف للتأمين (MetLife)',
    cardCategories: ['فضي (Silver)', 'جولد (Gold)', 'بلاتينيوم (Platinum)', 'ماسي / VIP (Diamond)'],
    notes: 'تعاقد الشركات والنقابات (مثل السويدي / سعودي) حسب نسبة الكارنيه (0% أو 10% أو 20%)',
    isActive: true,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ins-axa',
    companyName: 'أكسا للتأمين الطبي (AXA)',
    name: 'أكسا للتأمين الطبي (AXA)',
    cardCategories: ['فضي (Silver)', 'جولد (Gold)', 'بلاتينيوم (Platinum)'],
    notes: 'نسب التحمل المعتمدة: 10% أو 20% أو 20/10 حسب البطاقة',
    isActive: true,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ins-mednet',
    companyName: 'ميد نت للرعاية الصحية (MedNet)',
    name: 'ميد نت للرعاية الصحية (MedNet)',
    cardCategories: ['فضي (Silver)', 'جولد (Gold)', 'بلاتينيوم (Platinum)'],
    notes: 'تحمل 10% أو 20% حسب فئة الكارت',
    isActive: true,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ins-nextcare',
    companyName: 'نكست كير (NextCare)',
    name: 'نكست كير (NextCare)',
    cardCategories: ['فضي (Silver)', 'جولد (Gold)', 'بلاتينيوم (Platinum)'],
    notes: 'تحمل 10% أو 20% حسب فئة الكارت',
    isActive: true,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ins-globemed',
    companyName: 'جلوب ميد مصر (GlobeMed)',
    name: 'جلوب ميد مصر (GlobeMed)',
    cardCategories: ['فضي (Silver)', 'جولد (Gold)', 'بلاتينيوم (Platinum)'],
    notes: 'تحمل 10% أو 20% حسب فئة الكارت',
    isActive: true,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ins-syndicates',
    companyName: 'تعاقد نقابات وشركات خاصة',
    name: 'تعاقد نقابات وشركات خاصة',
    cardCategories: ['عادي / أساسي (Standard)', 'فضي (Silver)', 'جولد (Gold)'],
    notes: 'حسب نسبة الكارت المدونة',
    isActive: true,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export function getStoredInsuranceContracts(): InsuranceCompanyContract[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.INSURANCE_CONTRACTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.INSURANCE_CONTRACTS, JSON.stringify(DEFAULT_INSURANCE_CONTRACTS));
      return DEFAULT_INSURANCE_CONTRACTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((c: any) => ({
        ...c,
        companyName: c.companyName || c.name || 'شركة تأمين',
        isActive: c.isActive !== undefined ? c.isActive : c.active !== false,
        createdAt: c.createdAt || c.updatedAt || '2026-01-01T00:00:00.000Z',
      }));
    }
    return DEFAULT_INSURANCE_CONTRACTS;
  } catch {
    return DEFAULT_INSURANCE_CONTRACTS;
  }
}

export function saveInsuranceContracts(contracts: InsuranceCompanyContract[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.INSURANCE_CONTRACTS, JSON.stringify(contracts));
  } catch (e) {
    console.error('فشل حفظ تعاقدات التأمين:', e);
  }
}

export function getStoredInsuranceBookingsMap(): Record<string, BookingInsuranceDetails> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.INSURANCE_BOOKINGS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveInsuranceBookingsMap(map: Record<string, BookingInsuranceDetails>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.INSURANCE_BOOKINGS, JSON.stringify(map));
  } catch (e) {
    console.error('فشل حفظ تفاصيل تأمين الحجوزات:', e);
  }
}

/**
 * تحليل نص نسبة التحمل المكتوب على كارت التأمين (مثل "20%" أو "10" أو "20/10" أو "0")
 * وحساب حصة المريض النقدية والمطالبة المتبقية على شركة التأمين
 */
export function parseCopayRateInput(
  rawInput: string,
  originalClinicFee: number
): {
  copayRateText: string;
  copayPercentage: number;
  patientPaidAmount: number;
  insuranceClaimAmount: number;
} {
  const fee = Math.max(0, Number(originalClinicFee) || 0);
  const normalized = String(rawInput || '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .trim();

  if (!normalized || normalized === '0' || normalized === '0%') {
    return {
      copayRateText: normalized ? (normalized.includes('%') ? normalized : `${normalized}%`) : '0%',
      copayPercentage: 0,
      patientPaidAmount: 0,
      insuranceClaimAmount: fee,
    };
  }

  // إذا كتب الكاشير صيغة مركبة مثل "20/10" أو "10/20" كما هو مدون على الكارت
  if (normalized.includes('/')) {
    const parts = normalized.split('/').map((p) => parseFloat(p.replace(/[^0-9.]/g, '')));
    const firstNum = Number.isFinite(parts[0]) ? Math.min(100, Math.max(0, parts[0])) : 0;
    const patientPaid = Math.round((fee * firstNum) / 100);
    return {
      copayRateText: normalized,
      copayPercentage: firstNum,
      patientPaidAmount: patientPaid,
      insuranceClaimAmount: Math.max(0, fee - patientPaid),
    };
  }

  const numMatch = parseFloat(normalized.replace(/[^0-9.]/g, ''));
  const pct = Number.isFinite(numMatch) ? Math.min(100, Math.max(0, numMatch)) : 0;
  const patientPaid = Math.round((fee * pct) / 100);
  const displayText = normalized.includes('%') ? normalized : `${pct}%`;

  return {
    copayRateText: displayText,
    copayPercentage: pct,
    patientPaidAmount: patientPaid,
    insuranceClaimAmount: Math.max(0, fee - patientPaid),
  };
}

// ==================== منظومة تسليم الشيفتات والخزينة بين الكاشير والإدارة ====================

export function getStoredShiftHandovers(): ShiftHandoverRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SHIFT_HANDOVERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveShiftHandovers(records: ShiftHandoverRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SHIFT_HANDOVERS, JSON.stringify(records.slice(0, 250)));
  } catch (e) {
    console.error('فشل حفظ سجلات تسليم الشيفت:', e);
  }
}

export function clearWhatsAppAndPrintLogs(): void {
  try {
    localStorage.removeItem('sharaya_whatsapp_sent_v1');
    localStorage.removeItem('sharaya_printed_receipts_v1');
  } catch {}
}

// ==================== دفتر المصروفات اليومية وتسويات مطالبات التأمين ====================

export function getStoredFinanceLedger(): FinanceLedgerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FINANCE_LEDGER);
    if (!raw) {
      return { expenses: [], settlements: [], doctorCommissionRules: {} };
    }
    const parsed = JSON.parse(raw);
    return {
      expenses: Array.isArray(parsed?.expenses) ? parsed.expenses : [],
      settlements: Array.isArray(parsed?.settlements) ? parsed.settlements : [],
      doctorCommissionRules:
        parsed?.doctorCommissionRules && typeof parsed.doctorCommissionRules === 'object'
          ? parsed.doctorCommissionRules
          : {},
    };
  } catch {
    return { expenses: [], settlements: [], doctorCommissionRules: {} };
  }
}

export function saveFinanceLedger(ledger: FinanceLedgerState): void {
  try {
    const clean: FinanceLedgerState = {
      expenses: Array.isArray(ledger?.expenses) ? ledger.expenses.slice(0, 400) : [],
      settlements: Array.isArray(ledger?.settlements) ? ledger.settlements.slice(0, 300) : [],
      doctorCommissionRules:
        ledger?.doctorCommissionRules && typeof ledger.doctorCommissionRules === 'object'
          ? ledger.doctorCommissionRules
          : {},
    };
    localStorage.setItem(STORAGE_KEYS.FINANCE_LEDGER, JSON.stringify(clean));
  } catch (e) {
    console.error('فشل حفظ دفتر المصروفات والتسويات:', e);
  }
}

// ==================== منظومة الفترة التجريبية وبوابة المطور السرية (SHA-256) ====================

const SECRET_DEV_USER_SHA256 = '1b85a9fb672f5bfa1fb11c833f82d5cab5f4e0379609125a31216eedd375a709';
const SECRET_DEV_PASS_SHA256 = '3e01cd523d9053bd2c8eb54f468a75c7b8d146ee52abce51c8819e30d84a8de6';

export async function verifySecretDeveloperCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const cleanUser = String(username || '').trim().toLowerCase();
  const rawPass = String(password || '').trim();
  if (!cleanUser || !rawPass) return false;

  const userHash = await hashPassword(cleanUser);
  if (userHash !== SECRET_DEV_USER_SHA256) return false;

  return verifySecretDeveloperPasswordOnly(rawPass);
}

export async function verifySecretDeveloperPasswordOnly(password: string): Promise<boolean> {
  const rawPass = String(password || '').trim();
  if (!rawPass) return false;

  const exactHash = await hashPassword(rawPass);
  if (exactHash === SECRET_DEV_PASS_SHA256) return true;

  // دعم حالة الحرف الأول الكبيرة تلقائياً لهواتف الأندرويد/الآيفون
  const capitalizedPass = rawPass.charAt(0).toUpperCase() + rawPass.slice(1);
  const capHash = await hashPassword(capitalizedPass);
  return capHash === SECRET_DEV_PASS_SHA256;
}

export const DEFAULT_TRIAL_LICENSE_CONFIG: SystemTrialLicenseConfig = {
  mode: 'trial',
  trialDays: 7,
  startedAt: '2026-10-02T00:00:00.000Z',
  expiresAt: '2026-10-09T23:59:59.000Z',
  showBannerToStaff: true,
  lockPublicPagesOnExpiry: true,
  blockDevTools: true,
  autoBanAfterStrikes: true,
  maxStrikesBeforeBan: 3,
  antiClockTamper: true,
  blockNonEgyptVpn: false,
  antiCopyAndPrint: false,
  showTrialWatermark: false,
  archiveCycleMonths: 4,
  lastArchiveDate: '2026-10-02T00:00:00.000Z',
  nextArchiveDate: '2027-02-02T00:00:00.000Z',
  keepRecentDaysDefault: 10,
  activeBroadcastMessage: null,
  blockedEntities: [],
  intrusionLogs: [],
  lockMessage:
    'انتهت الفترة التجريبية المخصصة لمعاينة ومراجعة المنظومة بنجاح. جميع البيانات والإعدادات محفوظة بالكامل — لتفعيل النسخة الدائمة المعتمدة يرجى التواصل مع مسؤول تطوير المنظومة.',
  updatedAt: '2026-10-02T00:00:00.000Z',
};

/**
 * ختم رقمي متزامن (Cryptographic-style Seal) لكشف أي تعديل يدوي في LocalStorage أو SessionStorage
 */
export function computeSyncSecuritySeal(payload: string): string {
  const secret = '__SHARAYA_CYBER_VAULT_2026_AMRR_9981__';
  const combined = `${secret}:${payload}:${secret}`;
  let h1 = 0xdeadbeef ^ combined.length;
  let h2 = 0x41c6ce57 ^ combined.length;
  for (let i = 0; i < combined.length; i++) {
    const ch = combined.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    'SEAL-' +
    (h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0')
  ).toUpperCase();
}

export function getStoredTrialLicenseConfig(): SystemTrialLicenseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRIAL_LICENSE);
    if (!raw) return DEFAULT_TRIAL_LICENSE_CONFIG;
    const savedSeal = localStorage.getItem('sharaya_trial_license_seal_v1');
    const expectedSeal = computeSyncSecuritySeal(raw);
    if (savedSeal && savedSeal !== expectedSeal) {
      // تم رصد تلاعب يدوي في LocalStorage لتزوير الفترة التجريبية
      localStorage.removeItem(STORAGE_KEYS.TRIAL_LICENSE);
      localStorage.removeItem('sharaya_trial_license_seal_v1');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sharaya:security-tamper-detected', {
            detail: {
              type: 'storage_tamper',
              label: 'محاولة تلاعب ببيانات الفترة التجريبية في LocalStorage',
            },
          })
        );
      }
      return DEFAULT_TRIAL_LICENSE_CONFIG;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.mode || !parsed.expiresAt) {
      return DEFAULT_TRIAL_LICENSE_CONFIG;
    }
    return {
      ...DEFAULT_TRIAL_LICENSE_CONFIG,
      ...parsed,
      blockedEntities: Array.isArray(parsed.blockedEntities) ? parsed.blockedEntities : [],
      intrusionLogs: Array.isArray(parsed.intrusionLogs) ? parsed.intrusionLogs : [],
    };
  } catch {
    return DEFAULT_TRIAL_LICENSE_CONFIG;
  }
}

export function saveTrialLicenseConfig(config: SystemTrialLicenseConfig): void {
  try {
    const cleanConfig: SystemTrialLicenseConfig = {
      ...DEFAULT_TRIAL_LICENSE_CONFIG,
      ...config,
      blockedEntities: Array.isArray(config.blockedEntities)
        ? config.blockedEntities.slice(0, 100)
        : [],
      intrusionLogs: Array.isArray(config.intrusionLogs)
        ? config.intrusionLogs.slice(0, 80)
        : [],
    };
    const json = JSON.stringify(cleanConfig);
    localStorage.setItem(STORAGE_KEYS.TRIAL_LICENSE, json);
    localStorage.setItem('sharaya_trial_license_seal_v1', computeSyncSecuritySeal(json));
  } catch {}
}

// ==================== بصمة الهاردوير (Hardware Fingerprint) وعنوان الـ IP ومكافحة تأخير الساعة ====================

let cachedHardwareFingerprint: { fingerprintId: string; deviceDetails: string } | null = null;
let cachedVisitorIpInfo: { ip: string; ispLocation: string; countryCode: string } | null = null;

/**
 * استخراج بصمة عتاد الجهاز الفريدة (GPU + CPU + RAM + Screen + OS + Canvas)
 * تظل ثابتة حتى لو استخدم المخترق VPN أو فتح المتصفح الخفي (Incognito)
 */
export function getHardwareDeviceFingerprint(): {
  fingerprintId: string;
  deviceDetails: string;
} {
  if (cachedHardwareFingerprint) return cachedHardwareFingerprint;
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { fingerprintId: 'FP-SERVER', deviceDetails: 'Server Environment' };
  }

  try {
    const ua = navigator.userAgent || '';
    const platform = (navigator as any).userAgentData?.platform || navigator.platform || 'Unknown';
    const cores = navigator.hardwareConcurrency || 4;
    const ram = (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory}GB RAM` : '';
    const screenRes = `${window.screen?.width || 0}x${window.screen?.height || 0}x${
      window.screen?.colorDepth || 24
    }`;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    // استخراج اسم كارت الشاشة الحقيقي (WebGL Unmasked Renderer)
    let gpuInfo = 'Standard GPU';
    try {
      const canvas = document.createElement('canvas');
      const gl =
        (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
        (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          if (renderer) {
            gpuInfo = String(renderer).replace(/ANGLE \((.+)\)/i, '$1').slice(0, 60);
          }
        }
      }
    } catch {}

    // بصمة رسم ثنائية الأبعاد (Canvas 2D Geometry Seed)
    let canvasSeed = '';
    try {
      const c2d = document.createElement('canvas');
      c2d.width = 120;
      c2d.height = 30;
      const ctx = c2d.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '13px Arial';
        ctx.fillStyle = '#062142';
        ctx.fillRect(10, 2, 50, 18);
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('SharayaFP-2026', 4, 4);
        canvasSeed = c2d.toDataURL().slice(-48);
      }
    } catch {}

    // تحديد نظام التشغيل والمتصفح بشكل مقروء
    let osName = platform;
    if (/Windows NT 10\.0/i.test(ua)) osName = 'Windows 10/11';
    else if (/Windows/i.test(ua)) osName = 'Windows';
    else if (/Android/i.test(ua)) {
      const m = ua.match(/Android\s([0-9.]+)/i);
      osName = m ? `Android ${m[1]}` : 'Android';
    } else if (/iPhone|iPad|iPod/i.test(ua)) osName = 'iOS (iPhone/iPad)';
    else if (/Mac OS X/i.test(ua)) osName = 'macOS';
    else if (/Linux/i.test(ua)) osName = 'Linux';

    let browserName = 'Browser';
    if (/Edg\//i.test(ua)) browserName = 'Edge';
    else if (/OPR\//i.test(ua)) browserName = 'Opera';
    else if (/Chrome\//i.test(ua)) browserName = 'Chrome';
    else if (/Firefox\//i.test(ua)) browserName = 'Firefox';
    else if (/Safari\//i.test(ua)) browserName = 'Safari';

    const hardwareRaw = `${osName}|${cores}|${ram}|${screenRes}|${tz}|${gpuInfo}|${canvasSeed}`;
    const seal = computeSyncSecuritySeal(hardwareRaw).replace('SEAL-', '');
    const fingerprintId = `FP-${seal.slice(0, 10).toUpperCase()}`;

    const deviceDetails = [
      `${osName} (${browserName})`,
      `المعالج: ${cores} أنوية${ram ? ` • ${ram}` : ''}`,
      `الشاشة: ${window.screen?.width || 0}×${window.screen?.height || 0}`,
      `كارت الشاشة: ${gpuInfo}`,
    ].join(' | ');

    cachedHardwareFingerprint = { fingerprintId, deviceDetails };
    return cachedHardwareFingerprint;
  } catch {
    return { fingerprintId: 'FP-UNKNOWN', deviceDetails: 'جهاز غير محدد' };
  }
}

/**
 * جلب عنوان الـ IP الحقيقي للزائر + شركة الإنترنت والمدينة + وقت السيرفر الحقيقي
 */
export async function fetchVisitorNetworkIdentity(): Promise<{
  ip: string;
  ispLocation: string;
  countryCode: string;
}> {
  if (cachedVisitorIpInfo && cachedVisitorIpInfo.ip !== 'غير معروف') {
    return cachedVisitorIpInfo;
  }

  // المحاولة 1: ipwho.is (يدعم HTTPS و CORS ويعطي الـ IP والدولة والمدينة وشركة الإنترنت)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://ipwho.is/', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        const isp = data.connection?.isp || data.connection?.org || '';
        const loc = [data.country, data.city, isp].filter(Boolean).join(' • ');
        cachedVisitorIpInfo = {
          ip: String(data.ip),
          ispLocation: loc || 'اتصال مباشر',
          countryCode: String(data.country_code || 'UNKNOWN').toUpperCase(),
        };
        return cachedVisitorIpInfo;
      }
    }
  } catch {}

  // المحاولة 2: ipapi.co
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data?.ip) {
        const loc = [data.country_name, data.city, data.org].filter(Boolean).join(' • ');
        cachedVisitorIpInfo = {
          ip: String(data.ip),
          ispLocation: loc || 'شبكة إنترنت عامة',
          countryCode: String(data.country_code || 'UNKNOWN').toUpperCase(),
        };
        return cachedVisitorIpInfo;
      }
    }
  } catch {}

  // المحاولة 3: api.ipify.org
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data?.ip) {
        cachedVisitorIpInfo = {
          ip: String(data.ip),
          ispLocation: 'شبكة إنترنت عامة',
          countryCode: 'UNKNOWN',
        };
        return cachedVisitorIpInfo;
      }
    }
  } catch {}

  return { ip: 'غير معروف', ispLocation: 'غير متاح', countryCode: 'UNKNOWN' };
}

const CLOCK_WATERMARK_KEY = 'sharaya_clock_watermark_v1';
const CLOCK_WATERMARK_SEAL_KEY = 'sharaya_clock_watermark_seal_v1';

export const DMCA_OWNERSHIP_CERTIFICATE_ID =
  'DMCA-AMR-SHARAYA-2026-SHA256-3B98F9A66E18F5D4A97E2A58E17C389186B86D6C54558134851E8B701A560098';

/**
 * تحديث بصمة أحدث توقيت معروف للنظام لمنع إرجاع ساعة الجهاز للوراء (Anti-Time Travel)
 */
export function updateMonotonicClockWatermark(referenceTimeMs?: number): void {
  try {
    const candidateMs = referenceTimeMs && referenceTimeMs > 0 ? referenceTimeMs : Date.now();
    const currentRaw = localStorage.getItem(CLOCK_WATERMARK_KEY);
    const currentMs = currentRaw ? Number(currentRaw) : 0;
    if (!Number.isFinite(currentMs) || candidateMs > currentMs) {
      const str = String(candidateMs);
      localStorage.setItem(CLOCK_WATERMARK_KEY, str);
      localStorage.setItem(CLOCK_WATERMARK_SEAL_KEY, computeSyncSecuritySeal(str));
    }
  } catch {}
}

/**
 * فحص ما إذا قام المستخدم بتأخير ساعة الكمبيوتر أو الهاتف للوراء لخداع الفترة التجريبية
 */
export function checkClockRollbackTamper(config: SystemTrialLicenseConfig): {
  isTampered: boolean;
  behindByMinutes: number;
} {
  if (config.antiClockTamper === false || config.mode === 'permanent') {
    return { isTampered: false, behindByMinutes: 0 };
  }

  try {
    const now = Date.now();
    let maxKnownTimeMs = 0;

    // 1. مقارنة بوقت آخر تحديث للإعدادات على السحابة
    const updatedMs = new Date(config.updatedAt).getTime();
    if (Number.isFinite(updatedMs) && updatedMs > maxKnownTimeMs) {
      maxKnownTimeMs = updatedMs;
    }

    const startedMs = new Date(config.startedAt).getTime();
    if (Number.isFinite(startedMs) && startedMs > maxKnownTimeMs) {
      maxKnownTimeMs = startedMs;
    }

    if (config.lastKnownServerTimeMs && config.lastKnownServerTimeMs > maxKnownTimeMs) {
      maxKnownTimeMs = config.lastKnownServerTimeMs;
    }

    // 2. مقارنة بأحدث وقت وصل له المتصفح سابقاً (مع فحص الختم)
    const rawWatermark = localStorage.getItem(CLOCK_WATERMARK_KEY);
    const watermarkSeal = localStorage.getItem(CLOCK_WATERMARK_SEAL_KEY);
    if (rawWatermark && watermarkSeal === computeSyncSecuritySeal(rawWatermark)) {
      const wm = Number(rawWatermark);
      if (Number.isFinite(wm) && wm > maxKnownTimeMs) {
        maxKnownTimeMs = wm;
      }
    }

    // إذا كانت ساعة الجهاز متأخرة بأكثر من 20 دقيقة عن آخر وقت حقيقي مسجل
    const driftMs = maxKnownTimeMs - now;
    if (driftMs > 20 * 60 * 1000) {
      return {
        isTampered: true,
        behindByMinutes: Math.round(driftMs / (60 * 1000)),
      };
    }

    // إذا كان الوقت طبيعياً، نحدث العلامة المائية للأمام
    if (now >= maxKnownTimeMs) {
      updateMonotonicClockWatermark(now);
    }

    return { isTampered: false, behindByMinutes: 0 };
  } catch {
    return { isTampered: false, behindByMinutes: 0 };
  }
}




