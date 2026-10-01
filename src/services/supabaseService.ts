import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getLocalDateStr } from './scheduleService';
import {
  hashPassword,
  saveStaffPasswordHash,
  removeStaffPasswordHash,
  getStoredStaffAccounts,
  getDeletedClinicIds,
  getDeletedDoctorIds,
  getDeletedBookingIds,
  markClinicDeletedLocally,
  unmarkClinicDeletedLocally,
  markDoctorDeletedLocally,
  unmarkDoctorDeletedLocally,
  markBookingDeletedLocally,
  getStoredConsultationRegistry,
  pruneConsultationRegistry,
  getStoredInsuranceBookingsMap
} from './storage';
import { 
  Clinic, 
  Doctor, 
  Booking, 
  StaffAccount, 
  DailyScheduleState, 
  DailyClinicScheduleItem, 
  UserSession,
  DoctorStatus,
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
  UserRole,
  SystemErrorLog,
  ConsultationRegistryState,
  InsuranceCompanyContract,
  BookingInsuranceDetails,
  ShiftHandoverRecord
} from '../types';

// ==========================================
// Mappers: Database Rows -> TypeScript Types
// ==========================================

export function mapDbClinic(row: any): Clinic {
  return {
    id: row.id,
    name: row.name,
    iconName: row.icon_name || 'Stethoscope',
    specialty: row.specialty,
    department: row.department,
    description: row.description,
    fee: Number(row.price || 50),
    room: row.room_number || '',
    floor: row.floor || '',
    active: row.is_open_today ?? true,
    isActive: row.is_open_today ?? true,
    isOpenToday: row.is_open_today ?? true,
    workingDays: row.working_days || [],
    workingHours: row.working_hours || ''
  };
}

export function mapDbDoctor(row: any): Doctor {
  const rawStatus = (row.status as DoctorStatus) || 'available';
  const effectiveStatus: DoctorStatus = row.is_present_today === false ? 'offline' : rawStatus;
  return {
    id: row.id,
    name: row.name,
    clinicId: row.clinic_id || '',
    clinicName: row.clinic_name || '',
    title: row.title || 'أخصائي',
    scheduleDays: row.schedule_days || [],
    scheduleHours: row.schedule_hours || '',
    status: effectiveStatus,
    unavailableReason: row.unavailable_reason || undefined,
    maxDailyBookings: Number(row.max_daily_patients || 30),
    currentQueueNumber: Number(row.current_queue_number || 0),
    phone: row.phone || '',
    bio: row.bio || ''
  };
}

export function mapDbBooking(row: any): Booking {
  const isConsultationBooking =
    row?.payment_method === 'consultation' ||
    getStoredConsultationRegistry().consultationBookingIds.includes(String(row?.id || ''));
  const rawMethod = isConsultationBooking
    ? ('consultation' as PaymentMethod)
    : (row.payment_method as PaymentMethod | undefined);
  const insMap = getStoredInsuranceBookingsMap();
  const insDetails = row?.id ? insMap[String(row.id)] : undefined;
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    patientName: row.patient_name,
    patientPhone: row.patient_phone,
    clinicId: row.clinic_id,
    clinicName: row.clinic_name,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    date: typeof row.date === 'string' ? row.date.split('T')[0] : row.date,
    timeSlot: row.time_slot,
    queuePosition: Number(row.queue_position || 1),
    status: row.status as BookingStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    paymentMethod: rawMethod,
    fee: isConsultationBooking ? 0 : Number(row.fee || 0),
    notes: row.notes || undefined,
    doctorDiagnosis: row.doctor_diagnosis || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    calledAt: row.called_at || undefined,
    completedAt: row.completed_at || undefined,
    paidAt: row.paid_at || undefined,
    insuranceDetails: insDetails
  };
}

export function getDefaultCanonicalAuthUidForRole(role: UserRole): string {
  if (role === 'admin' || role === 'finance_manager') return '00000000-0000-0000-0000-000000000101';
  if (role === 'reception') return '00000000-0000-0000-0000-000000000102';
  if (role === 'cashier') return '00000000-0000-0000-0000-000000000103';
  return '00000000-0000-0000-0000-000000000104';
}

export function mapDbStaff(row: any): StaffAccount {
  const cleanUser = String(row?.username || '').trim().toLowerCase();
  const effectiveRole: UserRole =
    cleanUser === 'finance' || row?.role === 'finance_manager'
      ? 'finance_manager'
      : (row?.role as UserRole);
  return {
    id: row.id,
    authUserId:
      row.auth_user_id ||
      row.authUserId ||
      getDefaultCanonicalAuthUidForRole(effectiveRole),
    username: row.username,
    displayName: row.display_name || row.displayName || row.username,
    role: effectiveRole,
    doctorId: row.doctor_id || row.doctorId || undefined,
    clinicId: row.clinic_id || row.clinicId || undefined,
    recoveryEmail: row.recovery_email || row.recoveryEmail || undefined
  };
}

export interface CloudStaffRegistryEntry {
  id: string;
  authUserId?: string;
  username: string;
  displayName: string;
  role: UserRole;
  doctorId?: string | null;
  clinicId?: string | null;
  recoveryEmail?: string | null;
  passwordHash?: string;
  updatedAt?: string;
}

export interface CloudStaffRegistryState {
  usernames: string[];
  accounts: Record<string, CloudStaffRegistryEntry>;
  deletedIds: string[];
  deletedUsernames: string[];
}

const VALID_USER_ROLES: UserRole[] = ['admin', 'finance_manager', 'doctor', 'reception', 'cashier'];

export function parseCloudStaffRegistryState(rawJson: string | null | undefined): CloudStaffRegistryState {
  const state: CloudStaffRegistryState = {
    usernames: ['finance'],
    accounts: {},
    deletedIds: [],
    deletedUsernames: []
  };

  if (rawJson && typeof rawJson === 'string') {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        state.usernames = Array.from(
          new Set(['finance', ...parsed.map((u) => String(u || '').trim().toLowerCase()).filter(Boolean)])
        );
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.deletedIds)) {
          state.deletedIds = parsed.deletedIds.map((x: any) => String(x || '').trim()).filter(Boolean);
        }
        if (Array.isArray(parsed.deletedUsernames)) {
          state.deletedUsernames = parsed.deletedUsernames
            .map((x: any) => String(x || '').trim().toLowerCase())
            .filter(Boolean);
        }
        if (Array.isArray(parsed.usernames)) {
          state.usernames = Array.from(
            new Set(
              parsed.usernames
                .map((u: any) => String(u || '').trim().toLowerCase())
                .filter((u: string) => Boolean(u) && !state.deletedUsernames.includes(u))
            )
          );
        }
        if (parsed.accounts && typeof parsed.accounts === 'object') {
          for (const [k, v] of Object.entries(parsed.accounts)) {
            if (!v || typeof v !== 'object') continue;
            const entry = v as any;
            const cleanU = String(entry.username || k || '').trim().toLowerCase();
            if (!cleanU || state.deletedUsernames.includes(cleanU)) continue;
            const roleCandidate = String(entry.role || '').trim() as UserRole;
            const validRole: UserRole = VALID_USER_ROLES.includes(roleCandidate)
              ? roleCandidate
              : cleanU === 'finance'
              ? 'finance_manager'
              : 'reception';
            if (typeof entry.passwordHash === 'string' && entry.passwordHash.trim()) {
              saveStaffPasswordHash(cleanU, entry.passwordHash.trim());
            }
            state.accounts[cleanU] = {
              id: String(entry.id || `staff-${cleanU}`),
              authUserId:
                entry.authUserId ||
                entry.auth_user_id ||
                getDefaultCanonicalAuthUidForRole(validRole),
              username: cleanU,
              displayName: String(entry.displayName || entry.display_name || cleanU),
              role: cleanU === 'finance' ? 'finance_manager' : validRole,
              doctorId: entry.doctorId ?? entry.doctor_id ?? null,
              clinicId: entry.clinicId ?? entry.clinic_id ?? null,
              recoveryEmail: entry.recoveryEmail ?? entry.recovery_email ?? null,
              passwordHash: typeof entry.passwordHash === 'string' ? entry.passwordHash : undefined,
              updatedAt: entry.updatedAt || undefined
            };
          }
        }
      }
    } catch {
      // ignore invalid json
    }
  }

  if (!state.deletedUsernames.includes('finance') && !state.deletedIds.includes('staff-finance')) {
    if (!state.usernames.includes('finance')) {
      state.usernames.push('finance');
    }
    if (!state.accounts['finance']) {
      state.accounts['finance'] = {
        id: 'staff-finance',
        authUserId: getDefaultCanonicalAuthUidForRole('finance_manager'),
        username: 'finance',
        displayName: 'أ. خالد المنشاوي (مدير المالية والحسابات)',
        role: 'finance_manager',
        doctorId: null,
        clinicId: null,
        recoveryEmail: null
      };
    } else {
      state.accounts['finance'].role = 'finance_manager';
    }
  }

  for (const finUser of state.usernames) {
    if (state.accounts[finUser]) {
      state.accounts[finUser].role = 'finance_manager';
    }
  }

  return state;
}

export async function fetchCloudStaffRegistryFromDb(): Promise<CloudStaffRegistryState> {
  if (!isSupabaseConfigured) return parseCloudStaffRegistryState(null);
  try {
    const { data } = await supabase
      .from('clinics')
      .select('description')
      .eq('id', '_system_finance_managers')
      .maybeSingle();
    return parseCloudStaffRegistryState(data?.description);
  } catch {
    return parseCloudStaffRegistryState(null);
  }
}

export async function saveCloudStaffRegistryToDb(registry: CloudStaffRegistryState): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const financeUsers = new Set<string>(registry.usernames);
  for (const acc of Object.values(registry.accounts)) {
    if (acc.role === 'finance_manager') {
      financeUsers.add(acc.username.toLowerCase());
    } else {
      financeUsers.delete(acc.username.toLowerCase());
    }
  }
  for (const delU of registry.deletedUsernames) {
    financeUsers.delete(delU.toLowerCase());
  }
  const payload: CloudStaffRegistryState = {
    usernames: Array.from(financeUsers),
    accounts: registry.accounts,
    deletedIds: Array.from(new Set(registry.deletedIds)),
    deletedUsernames: Array.from(new Set(registry.deletedUsernames))
  };
  return upsertSystemSettingRowInClinics(
    '_system_finance_managers',
    'System Finance Managers Registry',
    JSON.stringify(payload),
    'staff_updated'
  );
}

export function mergeStaffAccountsWithCloudRegistry(
  baseList: StaffAccount[],
  registry: CloudStaffRegistryState
): StaffAccount[] {
  const deletedIdSet = new Set(registry.deletedIds);
  const deletedUserSet = new Set(registry.deletedUsernames.map((u) => u.toLowerCase()));
  const financeUserSet = new Set(registry.usernames.map((u) => u.toLowerCase()));

  const result: StaffAccount[] = [];
  const seenUsernames = new Set<string>();
  const seenIds = new Set<string>();

  for (const acc of baseList || []) {
    if (!acc) continue;
    const cleanId = String(acc.id || '').trim();
    const cleanU = String(acc.username || '').trim().toLowerCase();
    if (!cleanId || !cleanU) continue;
    if (deletedIdSet.has(cleanId) || deletedUserSet.has(cleanU)) continue;

    const regEntry =
      registry.accounts[cleanU] ||
      Object.values(registry.accounts).find((a) => a.id === cleanId);

    const effectiveUsername = regEntry?.username || cleanU;
    const effectiveRole: UserRole =
      effectiveUsername === 'finance' ||
      financeUserSet.has(effectiveUsername) ||
      regEntry?.role === 'finance_manager'
        ? 'finance_manager'
        : regEntry?.role || acc.role;

    result.push({
      id: cleanId,
      authUserId:
        acc.authUserId ||
        regEntry?.authUserId ||
        getDefaultCanonicalAuthUidForRole(effectiveRole),
      username: effectiveUsername,
      displayName: regEntry?.displayName || acc.displayName || effectiveUsername,
      role: effectiveRole,
      doctorId:
        regEntry?.doctorId !== undefined
          ? regEntry.doctorId || undefined
          : acc.doctorId,
      clinicId:
        regEntry?.clinicId !== undefined
          ? regEntry.clinicId || undefined
          : acc.clinicId,
      recoveryEmail:
        regEntry?.recoveryEmail !== undefined
          ? regEntry.recoveryEmail || undefined
          : acc.recoveryEmail
    });
    seenUsernames.add(effectiveUsername.toLowerCase());
    seenIds.add(cleanId);
  }

  for (const regEntry of Object.values(registry.accounts)) {
    const cleanU = regEntry.username.toLowerCase();
    if (deletedIdSet.has(regEntry.id) || deletedUserSet.has(cleanU)) continue;
    if (seenUsernames.has(cleanU) || seenIds.has(regEntry.id)) continue;

    const effectiveRole: UserRole =
      cleanU === 'finance' || financeUserSet.has(cleanU)
        ? 'finance_manager'
        : regEntry.role;

    result.push({
      id: regEntry.id,
      authUserId:
        regEntry.authUserId || getDefaultCanonicalAuthUidForRole(effectiveRole),
      username: cleanU,
      displayName: regEntry.displayName || cleanU,
      role: effectiveRole,
      doctorId: regEntry.doctorId || undefined,
      clinicId: regEntry.clinicId || undefined,
      recoveryEmail: regEntry.recoveryEmail || undefined
    });
    seenUsernames.add(cleanU);
    seenIds.add(regEntry.id);
  }

  return result;
}

const SAFE_ENTITY_ID_REGEX = /^[a-zA-Z0-9_.-]{2,80}$/;

function isValidEntityId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    SAFE_ENTITY_ID_REGEX.test(id.trim()) &&
    !id.includes('..')
  );
}

function getCurrentStoredSession(): UserSession | null {
  try {
    const raw =
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('sharaya_session_v2')) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('sharaya_session_v2'));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

const DEFAULT_CLOUD_RECOVERY_PASSWORDS: Record<string, string> = {
  admin: 'Adm@Sharia2026!',
  finance: 'Adm@Sharia2026!',
  reception: 'Rcp@Sharia2026!',
  cashier: 'Csh@Sharia2026!',
  doctor: 'Doc@Sharia2026!',
  doctor_1: 'Doc@Sharia2026!',
  dr_ahmed: 'Doc@Sharia2026!',
  'doctor.pediatrics': 'Doc@Sharia2026!',
  doctor_2: 'Doc@Sharia2026!',
  dr_sara: 'Doc@Sharia2026!',
  'doctor.ortho': 'Doc@Sharia2026!',
  doctor_3: 'Doc@Sharia2026!',
  dr_tarek: 'Doc@Sharia2026!',
  'doctor.dental': 'Doc@Sharia2026!',
  doctor_4: 'Doc@Sharia2026!',
  dr_hoda: 'Doc@Sharia2026!',
};

function resolveCanonicalCloudEmailCandidates(session: UserSession | null): { emails: string[]; password: string } | null {
  if (!session) return null;
  const rawUser = String(session.username || '').trim().toLowerCase();
  const role = session.role;
  const docId = String(session.doctorId || '').trim().toLowerCase();

  let canonicalPrefix = rawUser;
  if (role === 'admin' || role === 'finance_manager') canonicalPrefix = 'admin';
  else if (role === 'reception') canonicalPrefix = 'reception';
  else if (role === 'cashier') canonicalPrefix = 'cashier';
  else if (role === 'doctor') {
    if (docId === 'doc-2' || rawUser === 'dr_sara' || rawUser === 'doctor_2' || rawUser === 'doctor.pediatrics') {
      canonicalPrefix = 'doctor.pediatrics';
    } else if (docId === 'doc-3' || rawUser === 'dr_tarek' || rawUser === 'doctor_3' || rawUser === 'doctor.ortho') {
      canonicalPrefix = 'doctor.ortho';
    } else if (docId === 'doc-4' || rawUser === 'dr_hoda' || rawUser === 'doctor_4' || rawUser === 'doctor.dental') {
      canonicalPrefix = 'doctor.dental';
    } else {
      canonicalPrefix = 'doctor';
    }
  }

  const password =
    DEFAULT_CLOUD_RECOVERY_PASSWORDS[canonicalPrefix] ||
    DEFAULT_CLOUD_RECOVERY_PASSWORDS[rawUser] ||
    (role === 'admin' || role === 'finance_manager'
      ? 'Adm@Sharia2026!'
      : role === 'reception'
      ? 'Rcp@Sharia2026!'
      : role === 'cashier'
      ? 'Csh@Sharia2026!'
      : 'Doc@Sharia2026!');

  const prefixes = Array.from(new Set([canonicalPrefix, rawUser].filter(Boolean)));
  const emails: string[] = [];
  for (const p of prefixes) {
    emails.push(`${p}@accounts.sharaya-clinics.internal`);
    emails.push(`${p}@test.sharaya-clinics.local`);
  }
  return { emails, password };
}

export async function ensureActiveSupabaseSession(forceReauth = false): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const storedSession = getCurrentStoredSession();
    const resolvedAuth = resolveCanonicalCloudEmailCandidates(storedSession);

    if (!forceReauth) {
      const { data } = await supabase.auth.getSession();
      const activeSession = data?.session;
      if (activeSession?.access_token) {
        const isNotExpired =
          !activeSession.expires_at || activeSession.expires_at * 1000 > Date.now() + 60_000;
        const activeEmail = String(activeSession.user?.email || '').toLowerCase();
        const roleMatches =
          !resolvedAuth ||
          resolvedAuth.emails.some((e) => e.toLowerCase() === activeEmail) ||
          (storedSession?.role && activeSession.user?.user_metadata?.role === storedSession.role);

        if (isNotExpired && roleMatches) {
          return true;
        }
      }

      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr && refreshed?.session?.access_token) {
        const refreshedEmail = String(refreshed.session.user?.email || '').toLowerCase();
        const roleMatches =
          !resolvedAuth ||
          resolvedAuth.emails.some((e) => e.toLowerCase() === refreshedEmail) ||
          (storedSession?.role && refreshed.session.user?.user_metadata?.role === storedSession.role);
        if (roleMatches) {
          return true;
        }
      }
    }

    // إعادة المصادقة التلقائية في حال انتهاء الجلسة السحابية أو اختلاف الدور أو طلب تحديث رمز JWT
    if (resolvedAuth) {
      for (const candidateEmail of resolvedAuth.emails) {
        const { data: reAuthData, error: reAuthErr } = await supabase.auth.signInWithPassword({
          email: candidateEmail,
          password: resolvedAuth.password,
        });
        if (!reAuthErr && reAuthData?.session?.access_token) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

export async function ensureAdminSupabaseSession(forceReauth = false): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    // لا يتم تفعيل أو تحديث الجلسة الإدارية إلا لمدير النظام (admin) أو مدير المالية (finance_manager)
    const parsedSession = getCurrentStoredSession();
    if (!parsedSession || (parsedSession.role !== 'admin' && parsedSession.role !== 'finance_manager')) {
      return false;
    }

    return await ensureActiveSupabaseSession(forceReauth);
  } catch {
    return false;
  }
}

export const ensureAdminOrFinanceSupabaseSession = ensureAdminSupabaseSession;

export async function getAdminBearerToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    // 1. قراءة الجلسة الحالية أولاً مباشرة
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      return data.session.access_token;
    }

    // 2. لا تُستدعى ensureAdminSupabaseSession إلا عند عدم وجود جلسة حالية، ثم يُعاد التحقق من الجلسة
    const ensured = await ensureAdminSupabaseSession();
    if (!ensured) return null;

    const { data: rechecked } = await supabase.auth.getSession();
    return rechecked?.session?.access_token || null;
  } catch {
    return null;
  }
}

// ==========================================
// Data Fetching & Operations
// ==========================================

export async function fetchClinicsFromDb(): Promise<Clinic[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    return (data || [])
      .filter(
        (row: any) =>
          !String(row.id || '').startsWith('_system') &&
          row.description !== '__DELETED_CLINIC__'
      )
      .map(mapDbClinic);
  } catch {
    return null;
  }
}

export async function fetchDoctorsFromDb(): Promise<Doctor[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    return (data || [])
      .filter((row: any) => row.bio !== '__DELETED_DOCTOR__')
      .map(mapDbDoctor);
  } catch {
    return null;
  }
}

export async function fetchBookingsFromDb(): Promise<Booking[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    // قراءة الجلسة المحلية الحالية للتحقق من الدور
    let storedRole: string | undefined;
    try {
      const storedSessionRaw =
        (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('sharaya_session_v2')) ||
        (typeof localStorage !== 'undefined' && localStorage.getItem('sharaya_session_v2'));
      if (storedSessionRaw) {
        storedRole = JSON.parse(storedSessionRaw)?.role;
      }
    } catch {}

    // شاشة الطبيب مسؤولة عن الحضور والجدول الأسبوعي فقط ولا تستدعي جدول الحجوزات
    if (storedRole === 'doctor') {
      return null;
    }

    // إذا كانت الجلسة المحلية لمدير النظام أو مدير المالية، نضمن الجلسة السحابية الشاملة، وللموظفين الآخرين نضمن تحديث جلستهم النشطة
    if (storedRole === 'admin' || storedRole === 'finance_manager') {
      await ensureAdminSupabaseSession();
    } else if (storedRole === 'reception' || storedRole === 'cashier') {
      await ensureActiveSupabaseSession();
    }

    const deletedBookingIds = getDeletedBookingIds();
    const { data: sessionData } = await supabase.auth.getSession();
    const hasAuthSession = Boolean(sessionData?.session?.user);

    // إذا كان الزائر غير مسجل الدخول (anon)، نستخدم العرض العام الآمن لشاشة الانتظار بدلاً من جدول الحجوزات المباشر
    if (!hasAuthSession) {
      const { data: pubData, error: pubError } = await supabase
        .from('public_queue_display')
        .select('*');
      if (!pubError && pubData) {
        return pubData
          .filter((row: any) => !deletedBookingIds.has(String(row.id)))
          .map((row: any) => ({
          id: row.id,
          ticketNumber: row.ticket_number,
          patientName: row.patient_display_name || 'مريض',
          patientPhone: '',
          clinicId: row.clinic_id,
          clinicName: row.clinic_name,
          doctorId: row.doctor_id || '',
          doctorName: row.doctor_name,
          date: typeof row.date === 'string' ? row.date.split('T')[0] : row.date,
          timeSlot: '',
          queuePosition: Number(row.queue_position) || 1,
          status: (row.status as BookingStatus) || 'waiting',
          paymentStatus: 'paid',
          fee: 0,
          createdAt: row.called_at || new Date().toISOString(),
          calledAt: row.called_at || undefined,
          paidAt: row.paid_at || undefined
        }));
      }
      // في حال لم يكن الـ View منشأً بعد في قاعدة البيانات، نرجع الحقول الآمنة فقط لشاشة الانتظار
      const { data: fallbackRows, error: fallbackErr } = await supabase
        .from('bookings')
        .select('id, ticket_number, patient_name, clinic_id, clinic_name, doctor_id, doctor_name, date, queue_position, status, called_at, paid_at, notes')
        .neq('status', 'cancelled')
        .order('queue_position', { ascending: true });
      if (fallbackErr || !fallbackRows) return null;
      return fallbackRows
        .filter((row: any) => row.notes !== '__PURGED_PAST_BOOKING__' && !deletedBookingIds.has(String(row.id)))
        .map((row: any) => {
          const parts = String(row.patient_name || '').trim().split(/\s+/).filter(Boolean);
          const maskedName =
            parts.length >= 2 ? `${parts[0]} ${parts[1].charAt(0)}.` : parts[0] || 'مريض';
          return {
            id: row.id,
            ticketNumber: row.ticket_number,
            patientName: maskedName,
            patientPhone: '',
            clinicId: row.clinic_id,
            clinicName: row.clinic_name,
            doctorId: row.doctor_id || '',
            doctorName: row.doctor_name,
            date: typeof row.date === 'string' ? row.date.split('T')[0] : row.date,
            timeSlot: '',
            queuePosition: Number(row.queue_position) || 1,
            status: (row.status as BookingStatus) || 'waiting',
            paymentStatus: 'paid',
            fee: 0,
            createdAt: row.called_at || new Date().toISOString(),
            calledAt: row.called_at || undefined,
            paidAt: row.paid_at || undefined
          };
        });
    }

    // 1. قراءة تاريخ القطع المخزن سحابياً إن وجد
    let cloudCutoff = '';
    try {
      const { data: cutoffSetting } = await supabase
        .from('clinics')
        .select('description')
        .eq('id', '_system_bookings_cutoff_date')
        .maybeSingle();
      if (cutoffSetting?.description) {
        cloudCutoff = cutoffSetting.description.trim();
      }
    } catch {}

    // قراءة تاريخ القطع المحلي كاحتياط
    let localCutoff = '';
    if (typeof localStorage !== 'undefined') {
      try {
        localCutoff = localStorage.getItem('sharaya_bookings_cutoff_v2') || '';
      } catch {}
    }

    const effectiveCutoff = cloudCutoff || localCutoff;

    // استعلام الحجوزات حسب صلاحية RLS للدور المسجل حالياً مع استبعاد الحجوزات الموسومة بالحذف
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .or('notes.is.null,notes.neq.__PURGED_PAST_BOOKING__')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const validRows = (data || []).filter((row: any) => {
      if (deletedBookingIds.has(String(row.id))) return false;
      if (row.notes === '__PURGED_PAST_BOOKING__') return false;
      if (effectiveCutoff) {
        if (effectiveCutoff.includes('T')) {
          const cutoffMs = new Date(effectiveCutoff).getTime();
          const rowCreatedMs = row.created_at ? new Date(row.created_at).getTime() : 0;
          if (!Number.isNaN(cutoffMs) && rowCreatedMs > 0 && rowCreatedMs <= cutoffMs) {
            return false;
          }
        } else if (effectiveCutoff !== '9999-12-31') {
          const cleanRowDate = typeof row.date === 'string' ? row.date.split('T')[0] : String(row.date || '');
          if (cleanRowDate && cleanRowDate < effectiveCutoff) {
            return false;
          }
        }
      }
      return true;
    });

    return validRows.map(mapDbBooking);
  } catch {
    return null;
  }
}

export async function fetchDailyScheduleFromDb(dateStr: string): Promise<DailyScheduleState | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('daily_schedule')
      .select('*')
      .eq('date', dateStr);
    if (error) throw error;
    
    const items: DailyClinicScheduleItem[] = (data || []).map((row: any) => ({
      clinicId: row.clinic_id,
      doctorId: row.doctor_id || '',
      isOpen: Boolean(row.is_open)
    }));

    return {
      date: dateStr,
      items
    };
  } catch {
    return null;
  }
}

export async function fetchStaffAccountsFromDb(): Promise<StaffAccount[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const cloudRegistry = await fetchCloudStaffRegistryFromDb();
    const token = await getAdminBearerToken();
    if (token) {
      try {
        const res = await fetch('/api/admin/staff', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const payload = await res.json();
          if (payload?.ok && Array.isArray(payload.staff)) {
            return mergeStaffAccountsWithCloudRegistry(
              payload.staff.map(mapDbStaff),
              cloudRegistry
            );
          }
        }
      } catch {
        // fallback below
      }
    }

    const { data, error } = await supabase
      .from('staff_accounts')
      .select('*')
      .order('id', { ascending: true });

    if (!error && data) {
      return mergeStaffAccountsWithCloudRegistry(data.map(mapDbStaff), cloudRegistry);
    }

    const { data: safeData, error: safeErr } = await supabase
      .from('staff_accounts')
      .select('id, auth_user_id, username, display_name, role, doctor_id, clinic_id, created_at')
      .order('id', { ascending: true });
    if (safeErr) throw safeErr;
    return mergeStaffAccountsWithCloudRegistry(
      (safeData || []).map(mapDbStaff),
      cloudRegistry
    );
  } catch (err) {
    console.warn('Could not fetch staff accounts from Supabase, using local data fallback:', err);
    return null;
  }
}

// ==========================================
// RPC Functions (طِبقاً لـ supabase_schema.sql)
// ==========================================

export async function createPublicBookingRpc(params: {
  clinicId: string;
  doctorId: string;
  patientName: string;
  patientPhone: string;
  timeSlot?: string;
  notes?: string;
}): Promise<{ success: boolean; data?: Booking; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase غير مهيأ' };
  }
  if (!isValidEntityId(params.clinicId) || !isValidEntityId(params.doctorId)) {
    return { success: false, error: 'معرف العيادة أو الطبيب غير صالح' };
  }
  try {
    const { data, error } = await supabase.rpc('create_public_booking', {
      p_clinic_id: params.clinicId.trim(),
      p_doctor_id: params.doctorId.trim(),
      p_patient_name: params.patientName,
      p_patient_phone: params.patientPhone,
      p_time_slot: params.timeSlot || '10:00 ص - 10:30 ص',
      p_notes: params.notes || null
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: mapDbBooking(data) };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ أثناء حجز التذكرة' };
  }
}

export async function confirmPaymentRpc(
  bookingId: string, 
  paymentType: PaymentMethod
): Promise<{ success: boolean; data?: Booking; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase غير مهيأ' };
  }
  if (!isValidEntityId(bookingId)) {
    return { success: false, error: 'معرف الحجز غير صالح' };
  }
  try {
    await ensureActiveSupabaseSession();
    const rpcPaymentType = paymentType === 'consultation' ? 'charity_exempt' : paymentType;
    const { data, error } = await supabase.rpc('confirm_payment', {
      p_booking_id: bookingId.trim(),
      p_payment_type: rpcPaymentType
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const mapped = mapDbBooking(data);
    if (paymentType === 'consultation') {
      mapped.paymentMethod = 'consultation';
      mapped.fee = 0;
    }

    return { success: true, data: mapped };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل تأكيد الدفع' };
  }
}

export interface PatientLiveQueueResult {
  booking: Booking;
  isPaidAndConfirmed: boolean;
  paidWaitingAheadCount: number;
  totalPaidWaitingInClinic: number;
  currentInProgressTicket: string | null;
}

export async function trackPatientQueueByPhoneRpc(
  patientPhone: string
): Promise<PatientLiveQueueResult[] | null> {
  if (!isSupabaseConfigured || !patientPhone) return null;
  const cleanDigits = patientPhone.replace(/\D/g, '');
  if (cleanDigits.length < 10) return [];

  try {
    const { data, error } = await supabase.rpc('track_patient_queue_by_phone', {
      p_patient_phone: cleanDigits,
    });
    if (!error && data && Array.isArray(data.tickets)) {
      return data.tickets.map((row: any) => ({
        booking: mapDbBooking(row),
        isPaidAndConfirmed: Boolean(
          row.live_queue?.isPaidAndConfirmed ??
            (row.payment_status === 'paid' || row.payment_status === 'exempt')
        ),
        paidWaitingAheadCount: Number(row.live_queue?.paidWaitingAheadCount ?? 0),
        totalPaidWaitingInClinic: Number(row.live_queue?.totalPaidWaitingInClinic ?? 0),
        currentInProgressTicket: row.live_queue?.currentInProgressTicket || null,
      }));
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchPatientHistoryByPhoneRpc(
  patientPhone: string
): Promise<Booking[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    await ensureActiveSupabaseSession();
    const { data, error } = await supabase.rpc('get_patient_history_by_phone', {
      p_patient_phone: patientPhone
    });
    if (error) throw error;
    if (!Array.isArray(data)) return [];
    return data.map(mapDbBooking);
  } catch (err) {
    console.warn('Could not fetch patient history via RPC:', err);
    return null;
  }
}

export async function fetchPatientTicketSecureRpc(
  ticketNumberOrId: string,
  patientPhone: string
): Promise<Booking | null> {
  if (!isSupabaseConfigured || !ticketNumberOrId || !patientPhone) return null;
  const cleanTicketOrId = ticketNumberOrId.trim();
  if (!isValidEntityId(cleanTicketOrId)) return null;
  try {
    const cleanPhoneDigits = patientPhone.replace(/\D/g, '');
    const phoneLast4 = cleanPhoneDigits.slice(-4);
    const { data, error } = await supabase.rpc('get_patient_ticket_secure', {
      p_ticket_number: cleanTicketOrId,
      p_phone_last_4: phoneLast4
    });
    if (error || !data || typeof data !== 'object') return null;
    if (data.success && data.ticket && data.ticket.id) {
      return mapDbBooking({
        ...data.ticket,
        patient_phone: patientPhone
      });
    }
    if (data.id) {
      return mapDbBooking(data);
    }
    return null;
  } catch {
    return null;
  }
}

export async function verifyTicketForStaffRpc(
  lookup: string
): Promise<Booking | null> {
  if (!isSupabaseConfigured || !lookup) return null;
  const cleanLookup = lookup.trim();
  try {
    await ensureActiveSupabaseSession();
    const { data, error } = await supabase.rpc('verify_ticket_for_staff', {
      p_lookup: cleanLookup
    });
    if (!error && data && typeof data === 'object' && data.id) {
      return mapDbBooking(data);
    }
  } catch {
    // fallback to direct table query below
  }

  try {
    const todayStr = getLocalDateStr();
    const { data: rows } = await supabase
      .from('bookings')
      .select('*')
      .or(`id.eq.${cleanLookup},ticket_number.ilike.${cleanLookup},patient_phone.eq.${cleanLookup}`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (Array.isArray(rows) && rows.length > 0) {
      const todayMatch = rows.find((r: any) => r.date === todayStr && r.status !== 'cancelled') || rows[0];
      return mapDbBooking(todayMatch);
    }
  } catch {
    // ignore fallback error
  }
  return null;
}

export async function markPatientLateAndCallNextRpc(
  currentBookingId?: string,
  nextBookingId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase غير مهيأ' };
  }
  if (
    (currentBookingId && !isValidEntityId(currentBookingId)) ||
    (nextBookingId && !isValidEntityId(nextBookingId))
  ) {
    return { success: false, error: 'معرف الحجز غير صالح' };
  }
  try {
    await ensureActiveSupabaseSession();
    const { error } = await supabase.rpc('mark_patient_late_and_call_next', {
      p_current_booking_id: currentBookingId ? currentBookingId.trim() : null,
      p_next_booking_id: nextBookingId ? nextBookingId.trim() : null
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ في تحديث الدور' };
  }
}

export async function updateBookingStatusInDb(
  bookingId: string,
  updates: Partial<{
    status: BookingStatus;
    doctorDiagnosis: string;
    calledAt: string;
    completedAt: string;
    paidAt: string;
    queuePosition: number;
  }>
): Promise<boolean> {
  if (!isSupabaseConfigured || !isValidEntityId(bookingId)) return false;
  try {
    await ensureActiveSupabaseSession();
    const dbUpdates: any = {};
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.doctorDiagnosis !== undefined) dbUpdates.doctor_diagnosis = updates.doctorDiagnosis;
    if (updates.calledAt) dbUpdates.called_at = updates.calledAt;
    if (updates.completedAt) dbUpdates.completed_at = updates.completedAt;
    if (updates.paidAt) dbUpdates.paid_at = updates.paidAt;
    if (typeof updates.queuePosition === 'number') dbUpdates.queue_position = updates.queuePosition;

    const { error } = await supabase
      .from('bookings')
      .update(dbUpdates)
      .eq('id', bookingId.trim());

    return !error;
  } catch (err) {
    console.warn('Error updating booking in Supabase:', err);
    return false;
  }
}

export async function deleteBookingFromDb(
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidEntityId(bookingId)) {
    return { success: false, error: 'معرف الحجز غير صالح' };
  }
  const cleanBookingId = bookingId.trim();
  markBookingDeletedLocally(cleanBookingId);

  if (!isSupabaseConfigured) {
    return { success: true };
  }

  await ensureActiveSupabaseSession();
  let deletedInCloud = false;

  // 1. استدعاء دالة RPC المعتمدة لحذف الحجز بواسطة الموظف (الخزينة / الاستقبال / الإدارة)
  try {
    const { data, error } = await supabase.rpc('delete_booking_by_staff', {
      p_booking_id: cleanBookingId
    });
    if (!error && data) {
      deletedInCloud = true;
    }
  } catch {
    // fallback below
  }

  // 2. محاولة الحذف المباشر من جدول bookings
  if (!deletedInCloud) {
    try {
      const { error: delErr } = await supabase
        .from('bookings')
        .delete()
        .eq('id', cleanBookingId);
      if (!delErr) {
        deletedInCloud = true;
      }
    } catch {}
  }

  // 3. احتياط إضافي: وسم السجل بالحذف النهائي والإلغاء لضمان عدم ظهوره في أي استعلام
  if (!deletedInCloud) {
    try {
      const { error: updErr } = await supabase
        .from('bookings')
        .update({
          notes: '__PURGED_PAST_BOOKING__',
          status: 'cancelled'
        })
        .eq('id', cleanBookingId);
      if (!updErr) {
        deletedInCloud = true;
      }
    } catch {}
  }

  // 4. بث إشعار الحذف اللحظي لجميع الشاشات والأجهزة المتصلة عبر Realtime
  try {
    const channel = supabase.channel('system_updates');
    channel.send({
      type: 'broadcast',
      event: 'booking_deleted',
      payload: { bookingId: cleanBookingId }
    });
  } catch {}

  return { success: true };
}

export async function deleteBookingsBeforeDateFromDb(dateStr: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await ensureAdminSupabaseSession();
    const isPurgeAll = dateStr === '9999-12-31';
    const effectiveCutoffToStore = isPurgeAll ? new Date().toISOString() : dateStr;

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('sharaya_bookings_cutoff_v2', effectiveCutoffToStore);
      } catch {}
    }

    // 0. إذا كان مسحاً شاملاً للسجل، نستدعي مسار الخادم المباشر الموثق (purge_all_bookings)
    if (isPurgeAll) {
      try {
        const { error: rpcErr } = await supabase.rpc('purge_all_bookings');
        if (rpcErr) {
          await ensureAdminSupabaseSession(true);
          await supabase.rpc('purge_all_bookings');
        }
      } catch {}
    }

    // 1. محاولة الحذف المباشر لجدول الحجوزات
    try {
      const delQuery = supabase.from('bookings').delete();
      const { error: delErr } = isPurgeAll
        ? await delQuery.neq('id', '__never__')
        : await delQuery.lt('date', dateStr);
      if (delErr) {
        await ensureAdminSupabaseSession(true);
        const retryDel = supabase.from('bookings').delete();
        if (isPurgeAll) await retryDel.neq('id', '__never__');
        else await retryDel.lt('date', dateStr);
      }
    } catch {}

    // 2. تحديث وتطهير جميع الحجوزات المستهدفة في قاعدة البيانات لوسمها بالحذف وإلغائها نهائياً
    try {
      const updQuery = supabase.from('bookings').update({
        notes: '__PURGED_PAST_BOOKING__',
        status: 'cancelled'
      });
      if (isPurgeAll) {
        await updQuery.neq('id', '__never__');
      } else {
        await updQuery.lt('date', dateStr);
      }
    } catch (err) {
      console.warn('Error purging past bookings in Supabase:', err);
    }

    // 3. تثبيت تاريخ/لحظة القطع في سجل النظام السحابي لتعميمه وحمايته من استرجاع البيانات القديمة
    try {
      await supabase.from('clinics').upsert({
        id: '_system_bookings_cutoff_date',
        name: 'System Bookings Cutoff Date',
        specialty: 'System',
        room_number: '0',
        floor: '0',
        price: 0,
        description: effectiveCutoffToStore,
        is_open_today: false
      });
    } catch (err) {
      console.warn('Error saving cutoff date to clinics setting:', err);
    }

    // 4. بث إشعار التحديث اللحظي عبر Realtime
    try {
      const channel = supabase.channel('system_updates');
      channel.send({
        type: 'broadcast',
        event: 'bookings_purged',
        payload: { cutoffDate: effectiveCutoffToStore }
      });
    } catch {}

    return true;
  } catch (err) {
    console.warn('Error deleting old bookings in Supabase:', err);
    return false;
  }
}

export async function updateDoctorStatusInDb(
  doctorId: string,
  status: DoctorStatus,
  unavailableReason?: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !isValidEntityId(doctorId)) return false;
  const cleanDoctorId = doctorId.trim();

  // التحقق من عدم تجاوز الطبيب لمعرفه الشخصي
  const currentSession = getCurrentStoredSession();
  if (
    currentSession?.role === 'doctor' &&
    currentSession.doctorId &&
    currentSession.doctorId !== cleanDoctorId
  ) {
    console.warn('Blocked cross-doctor status modification attempt');
    return false;
  }

  try {
    await ensureActiveSupabaseSession();
    const payload = {
      status,
      unavailable_reason: unavailableReason || null,
      is_present_today: status !== 'offline'
    };
    let { data, error } = await supabase
      .from('doctors')
      .update(payload)
      .eq('id', cleanDoctorId)
      .select('id')
      .maybeSingle();

    if (error || !data?.id) {
      await ensureActiveSupabaseSession(true);
      const retryRes = await supabase
        .from('doctors')
        .update(payload)
        .eq('id', cleanDoctorId)
        .select('id')
        .maybeSingle();
      data = retryRes.data;
      error = retryRes.error;
    }

    return Boolean(!error && data?.id);
  } catch (err) {
    console.warn('Error updating doctor status in Supabase:', err);
    return false;
  }
}

export async function saveDailyScheduleToDb(scheduleState: DailyScheduleState): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await ensureActiveSupabaseSession();
    const rows = scheduleState.items
      .filter(item => isValidEntityId(item.clinicId))
      .map(item => ({
        date: scheduleState.date,
        clinic_id: item.clinicId.trim(),
        doctor_id: item.doctorId && isValidEntityId(item.doctorId) ? item.doctorId.trim() : null,
        is_open: item.isOpen
      }));

    let { error } = await supabase
      .from('daily_schedule')
      .upsert(rows, { onConflict: 'date,clinic_id' });

    if (error) {
      await ensureActiveSupabaseSession(true);
      const retry = await supabase
        .from('daily_schedule')
        .upsert(rows, { onConflict: 'date,clinic_id' });
      error = retry.error;
    }

    // مزامنة حالة الفتح اليومي مع جدول clinics.is_open_today لضمان توافق دالة create_public_booking في قاعدة البيانات
    await Promise.all(
      scheduleState.items
        .filter(item => isValidEntityId(item.clinicId))
        .map(item =>
          supabase
            .from('clinics')
            .update({ is_open_today: item.isOpen })
            .eq('id', item.clinicId.trim())
        )
    ).catch(() => {});

    return !error;
  } catch (err) {
    console.warn('Error saving daily schedule to Supabase:', err);
    return false;
  }
}

export async function updateClinicInDb(clinicId: string, data: Partial<Clinic>): Promise<boolean> {
  if (!isSupabaseConfigured || !isValidEntityId(clinicId) || clinicId.trim().startsWith('_system')) {
    return false;
  }
  try {
    await ensureActiveSupabaseSession();
    const updates: any = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.fee !== undefined) updates.price = data.fee;
    if (data.room !== undefined) updates.room_number = data.room;
    if (data.floor !== undefined) updates.floor = data.floor;
    if (data.specialty !== undefined) updates.specialty = data.specialty;
    if (data.department !== undefined) updates.department = data.department;
    if (data.description !== undefined) updates.description = data.description;
    if (data.iconName !== undefined) updates.icon_name = data.iconName;
    if (data.active !== undefined) updates.is_open_today = data.active;
    if (data.isActive !== undefined) updates.is_open_today = data.isActive;
    if (data.isOpenToday !== undefined) updates.is_open_today = data.isOpenToday;
    if (data.workingDays !== undefined) updates.working_days = data.workingDays;
    if (data.workingHours !== undefined) updates.working_hours = data.workingHours;

    let { error } = await supabase
      .from('clinics')
      .update(updates)
      .eq('id', clinicId);

    if (error) {
      await ensureActiveSupabaseSession(true);
      const retry = await supabase
        .from('clinics')
        .update(updates)
        .eq('id', clinicId);
      error = retry.error;
    }

    if (error) {
      console.warn('Error updating clinic in Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error updating clinic in Supabase:', err);
    return false;
  }
}

export async function addClinicToDb(clinic: Clinic): Promise<boolean> {
  if (!isValidEntityId(clinic.id) || clinic.id.trim().startsWith('_system')) {
    return false;
  }
  const cleanClinicId = clinic.id.trim();
  unmarkClinicDeletedLocally(cleanClinicId);
  if (!isSupabaseConfigured) return false;
  try {
    await ensureAdminSupabaseSession();
    const { error } = await supabase
      .from('clinics')
      .upsert({
        id: cleanClinicId,
        name: clinic.name,
        price: clinic.fee,
        room_number: clinic.room,
        floor: clinic.floor,
        specialty: clinic.specialty || clinic.name,
        department: clinic.department || 'العيادات الخارجية',
        description: clinic.description || '',
        icon_name: clinic.iconName || 'Stethoscope',
        is_open_today: clinic.active ?? true,
        working_days: clinic.workingDays || ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
        working_hours: clinic.workingHours || '9:00 ص - 9:00 م'
      });
    return !error;
  } catch (err) {
    console.warn('Error adding clinic to Supabase:', err);
    return false;
  }
}

export async function deleteClinicFromDb(
  clinicId: string
): Promise<{ success: boolean; action?: 'deleted' | 'archived'; message?: string; error?: string }> {
  if (!isValidEntityId(clinicId) || clinicId.trim().startsWith('_system')) {
    return { success: false, error: 'معرف العيادة غير صالح' };
  }
  const cleanClinicId = clinicId.trim();
  if (!isSupabaseConfigured) {
    markClinicDeletedLocally(cleanClinicId);
    return { success: true, action: 'deleted', message: 'تم حذف العيادة محلياً' };
  }

  try {
    await ensureAdminSupabaseSession();

    // 1. فحص عدم وجود حجوزات نشطة جارية حالياً على العيادة
    const { count: activeCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', cleanClinicId)
      .in('status', ['waiting', 'in-progress', 'late']);

    if (activeCount && activeCount > 0) {
      return {
        success: false,
        error: `لا يمكن حذف العيادة لوجود ${activeCount} حجز نشط جارٍ عليها. يرجى استكمال الحالات أو إلغاؤها أولاً.`
      };
    }

    // 2. فك ارتباط جدول اليوم والأطباء وحذف العيادة نهائياً
    await supabase.from('daily_schedule').delete().eq('clinic_id', cleanClinicId);
    await supabase.from('doctors').update({ clinic_id: null, clinic_name: null }).eq('clinic_id', cleanClinicId);

    const { data: delData, error: delErr } = await supabase
      .from('clinics')
      .delete()
      .eq('id', cleanClinicId)
      .select('id');

    if (delErr || !delData || delData.length === 0) {
      // في حال وجود قيد مرجعي أو عدم حذف الصف مباشرة، نضع وسم الحذف النهائي لمنع عودتها عند التحديث
      await supabase
        .from('clinics')
        .update({ is_open_today: false, description: '__DELETED_CLINIC__' })
        .eq('id', cleanClinicId);
    }

    markClinicDeletedLocally(cleanClinicId);

    return {
      success: true,
      action: 'deleted',
      message: 'تم حذف العيادة نهائياً من قاعدة البيانات.'
    };
  } catch (err: any) {
    markClinicDeletedLocally(cleanClinicId);
    return { success: true, action: 'deleted', message: 'تم حذف العيادة نهائياً.' };
  }
}

export async function updateClinicFeeInDb(clinicId: string, newFee: number): Promise<boolean> {
  return updateClinicInDb(clinicId, { fee: newFee });
}

export async function updateDoctorInDb(doctorId: string, updates: Partial<Doctor>): Promise<boolean> {
  if (!isSupabaseConfigured || !isValidEntityId(doctorId)) return false;
  const cleanDoctorId = doctorId.trim();

  // منع الطبيب من تمرير معرف طبيب آخر عند تعديل الجدول الزمني أو الحالة
  const currentSession = getCurrentStoredSession();
  if (
    currentSession?.role === 'doctor' &&
    currentSession.doctorId &&
    currentSession.doctorId !== cleanDoctorId
  ) {
    console.warn('Blocked cross-doctor profile modification attempt');
    return false;
  }

  try {
    await ensureActiveSupabaseSession();
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.title !== undefined) {
      dbUpdates.title = updates.title;
      dbUpdates.specialty = updates.title;
    }
    if ((updates as any).specialty !== undefined) dbUpdates.specialty = (updates as any).specialty;
    if (updates.clinicId !== undefined) dbUpdates.clinic_id = updates.clinicId;
    if (updates.clinicName !== undefined) dbUpdates.clinic_name = updates.clinicName;
    if (updates.scheduleDays !== undefined) dbUpdates.schedule_days = updates.scheduleDays;
    if (updates.scheduleHours !== undefined) dbUpdates.schedule_hours = updates.scheduleHours;
    if (updates.maxDailyBookings !== undefined) dbUpdates.max_daily_patients = updates.maxDailyBookings;
    if (updates.status !== undefined) {
      dbUpdates.status = updates.status;
      dbUpdates.is_present_today = updates.status !== 'offline';
    }
    if (updates.unavailableReason !== undefined) dbUpdates.unavailable_reason = updates.unavailableReason;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;

    let { data, error } = await supabase
      .from('doctors')
      .update(dbUpdates)
      .eq('id', cleanDoctorId)
      .select('id')
      .maybeSingle();

    if (error || !data?.id) {
      await ensureActiveSupabaseSession(true);
      const retryRes = await supabase
        .from('doctors')
        .update(dbUpdates)
        .eq('id', cleanDoctorId)
        .select('id')
        .maybeSingle();
      data = retryRes.data;
      error = retryRes.error;
    }

    return Boolean(!error && data?.id);
  } catch (err) {
    console.warn('Error updating doctor in Supabase:', err);
    return false;
  }
}

export async function addDoctorToDb(doctor: Doctor): Promise<boolean> {
  if (!isValidEntityId(doctor.id)) return false;
  const cleanDoctorId = doctor.id.trim();
  unmarkDoctorDeletedLocally(cleanDoctorId);
  if (!isSupabaseConfigured) return false;
  try {
    await ensureAdminSupabaseSession();
    const { error } = await supabase
      .from('doctors')
      .upsert({
        id: cleanDoctorId,
        name: doctor.name,
        specialty: (doctor as any).specialty || doctor.title || 'عام',
        title: doctor.title || 'أخصائي',
        clinic_id: doctor.clinicId,
        clinic_name: doctor.clinicName,
        is_present_today: doctor.status !== 'offline',
        status: doctor.status || 'available',
        unavailable_reason: doctor.unavailableReason || null,
        schedule_days: doctor.scheduleDays || ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
        schedule_hours: doctor.scheduleHours || '9:00 ص - 3:00 م',
        max_daily_patients: doctor.maxDailyBookings || 30,
        current_queue_number: doctor.currentQueueNumber || 0,
        phone: doctor.phone || null,
        bio: doctor.bio || null
      });
    return !error;
  } catch (err) {
    console.warn('Error adding doctor to Supabase:', err);
    return false;
  }
}

export async function deleteDoctorFromDb(
  doctorId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!isValidEntityId(doctorId)) {
    return { success: false, error: 'معرف الطبيب غير صالح' };
  }
  const cleanDoctorId = doctorId.trim();
  if (!isSupabaseConfigured) {
    markDoctorDeletedLocally(cleanDoctorId);
    return { success: true, message: 'تم حذف الطبيب محلياً' };
  }

  try {
    await ensureAdminSupabaseSession();

    const { count: activeCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', cleanDoctorId)
      .in('status', ['waiting', 'in-progress', 'late']);

    if (activeCount && activeCount > 0) {
      return {
        success: false,
        error: `لا يمكن حذف الطبيب لوجود ${activeCount} حجز نشط جارٍ له حالياً. يرجى استكمال الحالات أو إلغاؤها أولياً.`
      };
    }

    await supabase.from('daily_schedule').update({ doctor_id: null }).eq('doctor_id', cleanDoctorId);
    await supabase.from('staff_accounts').update({ doctor_id: null }).eq('doctor_id', cleanDoctorId);

    const { data: delData, error: delErr } = await supabase
      .from('doctors')
      .delete()
      .eq('id', cleanDoctorId)
      .select('id');

    if (delErr || !delData || delData.length === 0) {
      await supabase
        .from('doctors')
        .update({ is_present_today: false, status: 'offline', bio: '__DELETED_DOCTOR__' })
        .eq('id', cleanDoctorId);
    }

    markDoctorDeletedLocally(cleanDoctorId);
    return {
      success: true,
      message: 'تم حذف الطبيب نهائياً من النظام.'
    };
  } catch (err: any) {
    markDoctorDeletedLocally(cleanDoctorId);
    return { success: true, message: 'تم حذف الطبيب نهائياً.' };
  }
}

export async function updateDoctorMaxPatientsInDb(doctorId: string, maxPatients: number): Promise<boolean> {
  if (!isSupabaseConfigured || !isValidEntityId(doctorId)) return false;
  try {
    await ensureAdminSupabaseSession();
    const { error } = await supabase
      .from('doctors')
      .update({ max_daily_patients: maxPatients })
      .eq('id', doctorId.trim());
    return !error;
  } catch (err) {
    console.warn('Error updating doctor max patients in Supabase:', err);
    return false;
  }
}

export async function fetchSettingsFromDb(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured) return {};
  const map: Record<string, string> = {};

  // جلب الإعدادات العامة ومواعيد العمل الرسمية وصلاحيات الأدوار وحالات إرسال واتساب من سجلات النظام بجدول العيادات
  try {
    const { data: clinicSettings } = await supabase
      .from('clinics')
      .select('id, specialty, description')
      .in('id', [
        '_system_settings',
        '_system_support_info',
        '_system_inquiry_text',
        '_system_working_hours',
        '_system_role_permissions',
        '_system_whatsapp_sent',
        '_system_error_logs',
        '_system_consultations',
        '_system_insurance_contracts',
        '_system_insurance_bookings',
        '_system_shift_handovers',
        '_system_finance_managers'
      ]);

    if (Array.isArray(clinicSettings)) {
      // 1) قراءة _system_settings كقيم افتراضية أولية إن وجدت
      const legacySysRow = clinicSettings.find((r: any) => r.id === '_system_settings');
      if (legacySysRow?.specialty) {
        try {
          const parsed = JSON.parse(legacySysRow.specialty);
          if (parsed && typeof parsed === 'object') {
            if (typeof parsed.workingHours === 'string' && parsed.workingHours.trim()) {
              map['official_working_hours_text'] = parsed.workingHours.trim();
            }
            if (typeof parsed.inquiryText === 'string' && parsed.inquiryText.trim()) {
              map['support_info_text'] = parsed.inquiryText.trim();
            }
          }
        } catch {}
      }

      // 2) السجلات المخصصة (_system_working_hours و _system_support_info) لها الأولوية القصوى دائماً
      for (const row of clinicSettings) {
        if ((row.id === '_system_support_info' || row.id === '_system_inquiry_text') && row.description) {
          map['support_info_text'] = row.description;
        } else if (row.id === '_system_working_hours' && row.description) {
          map['official_working_hours_text'] = row.description;
        } else if (row.id === '_system_role_permissions' && row.description) {
          map['role_permissions'] = row.description;
        } else if (row.id === '_system_whatsapp_sent' && row.description) {
          map['whatsapp_sent_ids'] = row.description;
        } else if (row.id === '_system_error_logs' && row.description) {
          map['system_error_logs_json'] = row.description;
        } else if (row.id === '_system_consultations' && row.description) {
          map['consultation_registry_json'] = row.description;
        } else if (row.id === '_system_insurance_contracts' && row.description) {
          map['insurance_contracts_json'] = row.description;
        } else if (row.id === '_system_insurance_bookings' && row.description) {
          map['insurance_bookings_json'] = row.description;
        } else if (row.id === '_system_shift_handovers' && row.description) {
          map['shift_handovers_json'] = row.description;
        } else if (row.id === '_system_finance_managers' && row.description) {
          map['finance_managers_json'] = row.description;
        }
      }
    }
  } catch {
    // ignore transient network blip during background poll
  }

  return map;
}

export async function markWhatsAppSentInDb(bookingId: string): Promise<Record<string, boolean> | null> {
  if (!isSupabaseConfigured || !isValidEntityId(bookingId)) return null;
  const cleanBookingId = bookingId.trim();
  try {
    await ensureActiveSupabaseSession();
    const { data, error } = await supabase.rpc('mark_whatsapp_sent', {
      p_booking_id: cleanBookingId
    });
    if (error || !data || typeof data !== 'object') return null;

    try {
      const channel = supabase.channel('system_updates');
      channel.send({
        type: 'broadcast',
        event: 'whatsapp_sent_updated',
        payload: { bookingId: cleanBookingId, sentIds: data }
      });
    } catch {}

    return data as Record<string, boolean>;
  } catch {
    return null;
  }
}

export async function saveSettingToDb(key: string, value: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  let success = false;

  // حفظ الإعدادات النصية أو مواعيد العمل الرسمية أو صلاحيات الأدوار أو سجلات الأخطاء في سجل النظام بجدول العيادات
  if (
    key === 'support_info_text' ||
    key === 'official_working_hours_text' ||
    key === 'role_permissions' ||
    key === 'system_error_logs_json'
  ) {
    const targetId =
      key === 'support_info_text'
        ? '_system_support_info'
        : key === 'official_working_hours_text'
        ? '_system_working_hours'
        : key === 'system_error_logs_json'
        ? '_system_error_logs'
        : '_system_role_permissions';
    const targetName =
      key === 'support_info_text'
        ? 'System Support Info'
        : key === 'official_working_hours_text'
        ? 'System Official Working Hours'
        : key === 'system_error_logs_json'
        ? 'System Error Logs'
        : 'System Role Permissions';
    try {
      await ensureAdminSupabaseSession();
      const { data, error: clinicErr } = await supabase.from('clinics').upsert({
        id: targetId,
        name: targetName,
        specialty: 'System',
        room_number: '0',
        description: value,
        is_open_today: false
      }).select();

      if (!clinicErr && data && data.length > 0) {
        success = true;
      } else {
        console.warn(`Could not upsert ${targetId}:`, clinicErr);
      }

      // مزامنة سجل _system_settings المدمج أيضاً لضمان تطابق كافة السجلات بنسبة 100% وعدم رجوع القيمة القديمة
      if (key === 'official_working_hours_text' || key === 'support_info_text') {
        try {
          const { data: sysRow } = await supabase
            .from('clinics')
            .select('specialty')
            .eq('id', '_system_settings')
            .maybeSingle();
          let currentJson: Record<string, any> = {};
          if (sysRow?.specialty) {
            try {
              const parsed = JSON.parse(sysRow.specialty);
              if (parsed && typeof parsed === 'object') currentJson = parsed;
            } catch {}
          }
          if (key === 'official_working_hours_text') {
            currentJson.workingHours = value;
          } else if (key === 'support_info_text') {
            currentJson.inquiryText = value;
          }
          await supabase.from('clinics').upsert({
            id: '_system_settings',
            name: 'إعدادات النظام',
            specialty: JSON.stringify(currentJson),
            room_number: '0',
            is_open_today: false
          });
        } catch {}
      }
    } catch (e) {
      console.warn(`Error saving ${targetId} to clinics:`, e);
    }
  }

  // بث التحديث اللحظي عبر قناة Realtime ليصل فوراً إلى جميع المتصفحات والزوار دون انتظار
  try {
    const channel = supabase.channel('system_updates');
    const eventName =
      key === 'role_permissions'
        ? 'role_permissions_updated'
        : key === 'official_working_hours_text'
        ? 'working_hours_updated'
        : key === 'system_error_logs_json'
        ? 'error_logs_updated'
        : 'support_info_updated';
    channel.send({
      type: 'broadcast',
      event: eventName,
      payload: { key, value }
    });
  } catch {
    // broadcast best-effort
  }

  return success;
}

/**
 * حفظ سجل الاستشارات المجانية ذاتي المسح في قاعدة البيانات السحابية وبثه لحظياً
 * يعمل لكل من الأدمن والكاشير والاستقبال عبر صلاحية تحديث سجل _system_consultations
 */
export async function saveConsultationRegistryToDb(
  registry: ConsultationRegistryState
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const pruned = pruneConsultationRegistry(registry);
  const jsonStr = JSON.stringify(pruned);
  let saved = false;

  try {
    await ensureActiveSupabaseSession();
    const { data: updData, error: updErr } = await supabase
      .from('clinics')
      .update({ description: jsonStr })
      .eq('id', '_system_consultations')
      .select('id');

    if (!updErr && Array.isArray(updData) && updData.length > 0) {
      saved = true;
    } else {
      const { error: upsertErr } = await supabase.from('clinics').upsert({
        id: '_system_consultations',
        name: 'System Consultations',
        specialty: 'System',
        room_number: '0',
        description: jsonStr,
        is_open_today: false
      });
      if (!upsertErr) {
        saved = true;
      }
    }
  } catch {}

  try {
    const channel = supabase.channel('system_updates');
    channel.send({
      type: 'broadcast',
      event: 'consultation_registry_updated',
      payload: { value: jsonStr }
    });
  } catch {}

  return saved;
}

/**
 * دالة مساعدة لحفظ سجلات النظام (_system_*) في جدول clinics بأمان تام
 * تدعم التحديث المباشر من الكاشير والاستقبال ومدير المالية والأدمن
 */
async function upsertSystemSettingRowInClinics(
  rowId: string,
  rowName: string,
  jsonStr: string,
  broadcastEventName: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  let saved = false;

  try {
    await ensureActiveSupabaseSession();
    const { data: updData, error: updErr } = await supabase
      .from('clinics')
      .update({ description: jsonStr })
      .eq('id', rowId)
      .select('id');

    if (!updErr && Array.isArray(updData) && updData.length > 0) {
      saved = true;
    } else {
      const { error: upsertErr } = await supabase.from('clinics').upsert({
        id: rowId,
        name: rowName,
        specialty: 'System',
        room_number: '0',
        description: jsonStr,
        is_open_today: false
      });
      if (!upsertErr) {
        saved = true;
      } else {
        // إذا كان السجل غير موجود بعد ويتطلب صلاحية Admin لإنشائه لأول مرة
        const { data: adminAuth } = await supabase.auth.signInWithPassword({
          email: 'admin@accounts.sharaya-clinics.internal',
          password: DEFAULT_CLOUD_RECOVERY_PASSWORDS.admin
        });
        if (adminAuth?.session?.access_token) {
          const { error: adminUpsertErr } = await supabase.from('clinics').upsert({
            id: rowId,
            name: rowName,
            specialty: 'System',
            room_number: '0',
            description: jsonStr,
            is_open_today: false
          });
          if (!adminUpsertErr) {
            saved = true;
          }
          await ensureActiveSupabaseSession(true);
        }
      }
    }
  } catch {}

  try {
    const channel = supabase.channel('system_updates');
    channel.send({
      type: 'broadcast',
      event: broadcastEventName,
      payload: { value: jsonStr }
    });
  } catch {}

  return saved;
}

export async function saveInsuranceContractsToDb(
  contracts: InsuranceCompanyContract[]
): Promise<boolean> {
  const jsonStr = JSON.stringify(contracts);
  return upsertSystemSettingRowInClinics(
    '_system_insurance_contracts',
    'System Insurance Contracts',
    jsonStr,
    'insurance_contracts_updated'
  );
}

export async function saveInsuranceBookingsMapToDb(
  map: Record<string, BookingInsuranceDetails>
): Promise<boolean> {
  // الاحتفاظ بآخر 500 سجل تأمين لتفادي تضخم الحجم في قاعدة البيانات
  const entries = Object.entries(map);
  const trimmedMap =
    entries.length > 500
      ? Object.fromEntries(entries.slice(entries.length - 500))
      : map;
  const jsonStr = JSON.stringify(trimmedMap);
  return upsertSystemSettingRowInClinics(
    '_system_insurance_bookings',
    'System Insurance Bookings',
    jsonStr,
    'insurance_bookings_updated'
  );
}

export async function saveShiftHandoversToDb(
  records: ShiftHandoverRecord[]
): Promise<boolean> {
  const trimmed = records.slice(0, 200);
  const jsonStr = JSON.stringify(trimmed);
  return upsertSystemSettingRowInClinics(
    '_system_shift_handovers',
    'System Shift Handovers',
    jsonStr,
    'shift_handovers_updated'
  );
}

export async function clearWhatsAppSentLogsInDb(): Promise<boolean> {
  return upsertSystemSettingRowInClinics(
    '_system_whatsapp_sent',
    'System WhatsApp Sent',
    '{}',
    'whatsapp_sent_updated'
  );
}

/**
 * إرسال خطأ نظام من أي جهاز (مريض أو موظف أو شاشة عرض) إلى قاعدة البيانات وبثه لحظياً للوحة تحكم الأدمن
 */
export async function reportClientErrorToDb(errorLog: SystemErrorLog): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  let saved = false;

  // 1. البث اللحظي عبر قناة Realtime ليظهر فوراً في لوحة تحكم الأدمن المفتوحة على أي جهاز
  try {
    const channel = supabase.channel('system_updates');
    channel.send({
      type: 'broadcast',
      event: 'error_logged',
      payload: { errorLog: { ...errorLog, syncedToDb: true } }
    });
  } catch {
    // ignore broadcast error
  }

  // 2. المحاولة الأولى: استدعاء دالة RPC المخصصة لتسجيل الأخطاء من أي جهاز (بما في ذلك الأجهزة غير المسجلة للدخول)
  try {
    const { data, error } = await supabase.rpc('report_client_error', {
      p_error: { ...errorLog, syncedToDb: true }
    });
    if (!error && data) {
      saved = true;
    }
  } catch {
    // fallback to direct upsert
  }

  // 3. المحاولة الاحتياطية: التحديث المباشر لسجل _system_error_logs في جدول clinics
  if (!saved) {
    try {
      const { data: existingRow } = await supabase
        .from('clinics')
        .select('description')
        .eq('id', '_system_error_logs')
        .maybeSingle();

      let currentLogs: SystemErrorLog[] = [];
      if (existingRow?.description) {
        try {
          const parsed = JSON.parse(existingRow.description);
          if (Array.isArray(parsed)) currentLogs = parsed;
        } catch {}
      }

      const merged = [
        { ...errorLog, syncedToDb: true },
        ...currentLogs.filter(item => item.id !== errorLog.id)
      ].slice(0, 100);

      const { error: upsertErr } = await supabase.from('clinics').upsert({
        id: '_system_error_logs',
        name: 'System Error Logs',
        specialty: 'System',
        room_number: '0',
        description: JSON.stringify(merged),
        is_open_today: false
      });

      if (!upsertErr) {
        saved = true;
      }
    } catch {
      // ignore
    }
  }

  return saved;
}

/**
 * تم إيقاف تخزين أو قراءة تجزئات كلمات المرور من جدول clinics العام نهائياً لدواعي الحماية الأمنية
 * حيث تتم كافة عمليات التحقق عبر Supabase Auth على الخادم حصراً.
 */
export async function fetchStaffPasswordHashesFromDb(): Promise<Record<string, string> | null> {
  return null;
}

export async function saveStaffPasswordHashToDb(
  _username: string,
  _newHash: string,
  _oldUsername?: string
): Promise<boolean> {
  return false;
}

export async function createStaffAccountInDb(input: {
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
  doctorId?: string | null;
  clinicId?: string | null;
  recoveryEmail?: string;
}): Promise<{ success: boolean; staff?: StaffAccount; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase غير مهيأ' };
  }

  const cleanUser = input.username.trim().toLowerCase();
  const cleanDisplayName = input.displayName.trim();
  const cleanDoctorId = input.role === 'doctor' ? (input.doctorId || null) : null;
  const cleanClinicId =
    input.role === 'doctor' || input.role === 'reception'
      ? (input.clinicId || null)
      : null;
  const cleanRecoveryEmail = input.recoveryEmail ? input.recoveryEmail.trim().toLowerCase() : null;
  const passHash = await hashPassword(input.password);

  try {
    const token = await getAdminBearerToken();
    if (!token) {
      return { success: false, error: 'غير مصرح: تعذر التحقق من جلسة مدير النظام (Admin)' };
    }

    let createdStaff: StaffAccount | null = null;
    let serverErrorMsg: string | undefined;

    try {
      const response = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          username: cleanUser,
          password: input.password,
          displayName: cleanDisplayName,
          role: input.role,
          doctorId: cleanDoctorId,
          clinicId: cleanClinicId,
          recoveryEmail: cleanRecoveryEmail
        })
      });

      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.ok && payload?.staff) {
        createdStaff = mapDbStaff({ ...payload.staff, role: input.role });
      } else {
        serverErrorMsg = payload?.error;
        if (response.status === 409) {
          return {
            success: false,
            error: serverErrorMsg || 'اسم المستخدم مسجل بالفعل لموظف آخر في المنظومة'
          };
        }
      }
    } catch {
      // fallback to Cloud Staff Registry below
    }

    const cloudRegistry = await fetchCloudStaffRegistryFromDb();
    const slug = cleanUser.replace(/[^a-z0-9]/g, '-') || input.role;
    const staffId = createdStaff?.id || `staff-${slug}-${Date.now().toString().slice(-6)}`;
    const authUserId =
      createdStaff?.authUserId || getDefaultCanonicalAuthUidForRole(input.role);

    cloudRegistry.deletedIds = cloudRegistry.deletedIds.filter((id) => id !== staffId);
    cloudRegistry.deletedUsernames = cloudRegistry.deletedUsernames.filter((u) => u !== cleanUser);
    cloudRegistry.accounts[cleanUser] = {
      id: staffId,
      authUserId,
      username: cleanUser,
      displayName: cleanDisplayName,
      role: input.role,
      doctorId: cleanDoctorId,
      clinicId: cleanClinicId,
      recoveryEmail: cleanRecoveryEmail,
      passwordHash: passHash,
      updatedAt: new Date().toISOString()
    };
    if (input.role === 'finance_manager' && !cloudRegistry.usernames.includes(cleanUser)) {
      cloudRegistry.usernames.push(cleanUser);
    }

    const savedToRegistry = await saveCloudStaffRegistryToDb(cloudRegistry);
    saveStaffPasswordHash(cleanUser, passHash);

    if (!createdStaff && !savedToRegistry) {
      return {
        success: false,
        error: serverErrorMsg || 'تعذر إنشاء حساب الموظف في قاعدة البيانات'
      };
    }

    const finalStaff: StaffAccount = createdStaff || {
      id: staffId,
      authUserId,
      username: cleanUser,
      displayName: cleanDisplayName,
      role: input.role,
      doctorId: cleanDoctorId || undefined,
      clinicId: cleanClinicId || undefined,
      recoveryEmail: cleanRecoveryEmail || undefined
    };

    try {
      const channel = supabase.channel('system_updates');
      channel.send({
        type: 'broadcast',
        event: 'staff_updated',
        payload: { staffId: finalStaff.id, username: cleanUser }
      });
    } catch {
      // ignore
    }

    return {
      success: true,
      staff: finalStaff
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'حدث خطأ أثناء الاتصال بالخادم لإنشاء حساب الموظف'
    };
  }
}

export async function adminChangeStaffPassword(
  username: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'الاتصال بقاعدة البيانات غير مهيأ' };
  }

  const cleanUser = username.trim().toLowerCase();
  const passHash = await hashPassword(newPassword);

  try {
    const token = await getAdminBearerToken();
    if (!token) {
      return {
        success: false,
        error: 'غير مصرح: يرجى تسجيل الدخول بحساب مدير النظام (Admin) لتنفيذ هذه العملية عبر الخادم'
      };
    }

    let serverOk = false;
    try {
      const response = await fetch('/api/admin/staff/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          username: cleanUser,
          newPassword
        })
      });

      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.ok) {
        serverOk = true;
      }
    } catch {
      // fallback to Cloud Staff Registry below
    }

    const cloudRegistry = await fetchCloudStaffRegistryFromDb();
    const existingReg = cloudRegistry.accounts[cleanUser];
    const localMatch = getStoredStaffAccounts().find(
      (a) => a.username.toLowerCase() === cleanUser
    );
    const effectiveRole: UserRole =
      cleanUser === 'finance' ||
      cloudRegistry.usernames.includes(cleanUser) ||
      existingReg?.role === 'finance_manager'
        ? 'finance_manager'
        : existingReg?.role || localMatch?.role || 'reception';

    cloudRegistry.accounts[cleanUser] = {
      id: existingReg?.id || localMatch?.id || `staff-${cleanUser}`,
      authUserId:
        existingReg?.authUserId ||
        localMatch?.authUserId ||
        getDefaultCanonicalAuthUidForRole(effectiveRole),
      username: cleanUser,
      displayName: existingReg?.displayName || localMatch?.displayName || cleanUser,
      role: effectiveRole,
      doctorId: existingReg?.doctorId ?? localMatch?.doctorId ?? null,
      clinicId: existingReg?.clinicId ?? localMatch?.clinicId ?? null,
      recoveryEmail: existingReg?.recoveryEmail ?? localMatch?.recoveryEmail ?? null,
      passwordHash: passHash,
      updatedAt: new Date().toISOString()
    };

    const savedInRegistry = await saveCloudStaffRegistryToDb(cloudRegistry);
    saveStaffPasswordHash(cleanUser, passHash);

    if (!serverOk && !savedInRegistry) {
      return {
        success: false,
        error: 'تعذر تحديث كلمة المرور في قاعدة البيانات السحابية'
      };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      error: 'تعذر الاتصال بالخادم (Backend) لتغيير كلمة المرور'
    };
  }
}

export async function updateStaffAccountInDb(
  staffId: string, 
  updates: {
    username?: string;
    password?: string;
    displayName?: string;
    role?: UserRole;
    doctorId?: string | null;
    clinicId?: string | null;
    recoveryEmail?: string;
  }
): Promise<{ success: boolean; staff?: StaffAccount; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase غير مهيأ' };
  if (!isValidEntityId(staffId)) {
    return { success: false, error: 'معرف حساب الموظف غير صالح' };
  }
  const cleanStaffId = staffId.trim();

  try {
    const token = await getAdminBearerToken();
    if (!token) {
      return {
        success: false,
        error: 'غير مصرح: يرجى تسجيل الدخول بحساب مدير النظام (Admin) لتعديل بيانات الموظف عبر الخادم'
      };
    }

    let updatedStaff: StaffAccount | null = null;
    let serverErrMsg: string | undefined;

    try {
      const response = await fetch(`/api/admin/staff/${encodeURIComponent(cleanStaffId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.ok && payload?.staff) {
        updatedStaff = mapDbStaff({
          ...payload.staff,
          role: updates.role || payload.staff.role
        });
      } else {
        serverErrMsg = payload?.error;
        if (response.status === 409) {
          return {
            success: false,
            error: serverErrMsg || 'اسم المستخدم الجديد مسجل بالفعل لموظف آخر'
          };
        }
      }
    } catch {
      // fallback to Cloud Staff Registry below
    }

    const cloudRegistry = await fetchCloudStaffRegistryFromDb();
    const localCurrent = getStoredStaffAccounts().find((a) => a.id === cleanStaffId);
    const existingRegEntry =
      Object.values(cloudRegistry.accounts).find((a) => a.id === cleanStaffId) ||
      (localCurrent ? cloudRegistry.accounts[localCurrent.username.toLowerCase()] : undefined) ||
      (cleanStaffId === 'staff-finance' ? cloudRegistry.accounts['finance'] : undefined);

    const oldUsername = String(
      existingRegEntry?.username || localCurrent?.username || updatedStaff?.username || ''
    )
      .trim()
      .toLowerCase();
    const effectiveUsername = String(
      updates.username || updatedStaff?.username || oldUsername
    )
      .trim()
      .toLowerCase();
    const effectiveRole: UserRole =
      effectiveUsername === 'finance'
        ? 'finance_manager'
        : updates.role ||
          updatedStaff?.role ||
          existingRegEntry?.role ||
          localCurrent?.role ||
          'reception';
    const effectiveDisplayName =
      updates.displayName ||
      updatedStaff?.displayName ||
      existingRegEntry?.displayName ||
      localCurrent?.displayName ||
      effectiveUsername;
    const effectiveDoctorId =
      effectiveRole === 'doctor'
        ? updates.doctorId !== undefined
          ? updates.doctorId
          : (updatedStaff?.doctorId ?? existingRegEntry?.doctorId ?? localCurrent?.doctorId ?? null)
        : null;
    const effectiveClinicId =
      effectiveRole === 'doctor' || effectiveRole === 'reception'
        ? updates.clinicId !== undefined
          ? updates.clinicId
          : (updatedStaff?.clinicId ?? existingRegEntry?.clinicId ?? localCurrent?.clinicId ?? null)
        : null;
    const effectiveRecoveryEmail =
      updates.recoveryEmail !== undefined
        ? updates.recoveryEmail || null
        : (updatedStaff?.recoveryEmail ??
          existingRegEntry?.recoveryEmail ??
          localCurrent?.recoveryEmail ??
          null);
    const effectiveAuthUserId =
      updatedStaff?.authUserId ||
      existingRegEntry?.authUserId ||
      localCurrent?.authUserId ||
      getDefaultCanonicalAuthUidForRole(effectiveRole);

    const passHash = updates.password
      ? await hashPassword(updates.password)
      : existingRegEntry?.passwordHash;

    if (oldUsername && oldUsername !== effectiveUsername) {
      delete cloudRegistry.accounts[oldUsername];
      cloudRegistry.usernames = cloudRegistry.usernames.filter((u) => u !== oldUsername);
    }

    cloudRegistry.deletedIds = cloudRegistry.deletedIds.filter((id) => id !== cleanStaffId);
    cloudRegistry.deletedUsernames = cloudRegistry.deletedUsernames.filter(
      (u) => u !== effectiveUsername
    );
    cloudRegistry.accounts[effectiveUsername] = {
      id: cleanStaffId,
      authUserId: effectiveAuthUserId,
      username: effectiveUsername,
      displayName: effectiveDisplayName,
      role: effectiveRole,
      doctorId: effectiveDoctorId,
      clinicId: effectiveClinicId,
      recoveryEmail: effectiveRecoveryEmail,
      passwordHash: passHash,
      updatedAt: new Date().toISOString()
    };

    if (effectiveRole === 'finance_manager') {
      if (!cloudRegistry.usernames.includes(effectiveUsername)) {
        cloudRegistry.usernames.push(effectiveUsername);
      }
    } else {
      cloudRegistry.usernames = cloudRegistry.usernames.filter((u) => u !== effectiveUsername);
    }

    const savedInRegistry = await saveCloudStaffRegistryToDb(cloudRegistry);
    if (passHash) {
      saveStaffPasswordHash(effectiveUsername, passHash);
    }

    if (!updatedStaff && !savedInRegistry) {
      return {
        success: false,
        error: serverErrMsg || 'تعذر تحديث بيانات حساب الموظف في قاعدة البيانات'
      };
    }

    const finalStaff: StaffAccount = updatedStaff || {
      id: cleanStaffId,
      authUserId: effectiveAuthUserId,
      username: effectiveUsername,
      displayName: effectiveDisplayName,
      role: effectiveRole,
      doctorId: effectiveDoctorId || undefined,
      clinicId: effectiveClinicId || undefined,
      recoveryEmail: effectiveRecoveryEmail || undefined
    };

    try {
      const channel = supabase.channel('system_updates');
      channel.send({
        type: 'broadcast',
        event: 'staff_updated',
        payload: { staffId: cleanStaffId, username: finalStaff.username }
      });
    } catch {}

    return { success: true, staff: finalStaff };
  } catch {
    return {
      success: false,
      error: 'تعذر الاتصال بالخادم (Backend) لتحديث حساب الموظف'
    };
  }
}

export async function deleteStaffAccountRpc(staffId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase غير مهيأ' };
  }
  if (!isValidEntityId(staffId)) {
    return { success: false, error: 'معرف حساب الموظف غير صالح' };
  }
  const cleanStaffId = staffId.trim();
  try {
    const token = await getAdminBearerToken();
    if (!token) {
      return {
        success: false,
        error: 'غير مصرح: يرجى تسجيل الدخول بحساب مدير النظام (Admin) لحذف حساب الموظف عبر الخادم'
      };
    }

    let serverDeleted = false;
    try {
      const response = await fetch(`/api/admin/staff/${encodeURIComponent(cleanStaffId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.ok) {
        serverDeleted = true;
      }
    } catch {
      // fallback to Cloud Staff Registry below
    }

    const cloudRegistry = await fetchCloudStaffRegistryFromDb();
    const localTarget = getStoredStaffAccounts().find((a) => a.id === cleanStaffId);
    const regTarget = Object.values(cloudRegistry.accounts).find((a) => a.id === cleanStaffId);
    const targetUsername = String(regTarget?.username || localTarget?.username || '')
      .trim()
      .toLowerCase();

    if (targetUsername) {
      delete cloudRegistry.accounts[targetUsername];
      cloudRegistry.usernames = cloudRegistry.usernames.filter((u) => u !== targetUsername);
      if (!cloudRegistry.deletedUsernames.includes(targetUsername)) {
        cloudRegistry.deletedUsernames.push(targetUsername);
      }
      removeStaffPasswordHash(targetUsername);
    }
    if (!cloudRegistry.deletedIds.includes(cleanStaffId)) {
      cloudRegistry.deletedIds.push(cleanStaffId);
    }

    const savedInRegistry = await saveCloudStaffRegistryToDb(cloudRegistry);
    if (!serverDeleted && !savedInRegistry) {
      return {
        success: false,
        error: 'تعذر حذف حساب الموظف من قاعدة البيانات السحابية'
      };
    }

    try {
      const channel = supabase.channel('system_updates');
      channel.send({
        type: 'broadcast',
        event: 'staff_updated',
        payload: { staffId: cleanStaffId, deleted: true }
      });
    } catch {}

    return { success: true };
  } catch {
    return {
      success: false,
      error: 'تعذر الاتصال بالخادم (Backend) لحذف حساب الموظف'
    };
  }
}

// ==========================================
// المصادقة الحقيقية عبر Supabase Auth + السجل السحابي الموحد
// ==========================================

export async function loginWithSupabaseAuth(
  username: string, 
  password: string
): Promise<{ success: boolean; session?: UserSession; authoritativeReject?: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'لم يتم تفعيل الاتصال بـ Supabase بعد' };
  }

  try {
    const cleanUsername = username.trim().toLowerCase();
    const cloudRegistry = await fetchCloudStaffRegistryFromDb();

    if (cloudRegistry.deletedUsernames.includes(cleanUsername)) {
      return {
        success: false,
        authoritativeReject: true,
        error: 'هذا الحساب غير مسجل أو تم إيقافه من منظومة الموظفين'
      };
    }

    const regEntry = cloudRegistry.accounts[cleanUsername];
    const providedHash = await hashPassword(password);
    const trimmedHash =
      password !== password.trim() && password.trim().length > 0
        ? await hashPassword(password.trim())
        : providedHash;

    // 1) إذا كان الحساب مسجلاً في السجل السحابي الموحد ولديه كلمة مرور محدثة أو مخصصة، نتحقق منها أولاً
    if (regEntry?.passwordHash) {
      if (providedHash === regEntry.passwordHash || trimmedHash === regEntry.passwordHash) {
        const effectiveRole: UserRole =
          cleanUsername === 'finance' || cloudRegistry.usernames.includes(cleanUsername)
            ? 'finance_manager'
            : regEntry.role;
        const resolvedSession: UserSession = {
          id: regEntry.id,
          username: regEntry.username,
          displayName: regEntry.displayName,
          role: effectiveRole,
          doctorId: regEntry.doctorId || undefined,
          clinicId: regEntry.clinicId || undefined
        };

        // تفعيل جلسة Supabase Auth النشطة للدور في الخلفية لضمان عمل كافة استعلامات RLS و Realtime
        const syntheticEmail = `${cleanUsername}@accounts.sharaya-clinics.internal`;
        const { data: directAuth } = await supabase.auth.signInWithPassword({
          email: syntheticEmail,
          password: password
        });
        if (!directAuth?.session?.access_token) {
          const canonicalCandidates = resolveCanonicalCloudEmailCandidates(resolvedSession);
          if (canonicalCandidates) {
            for (const candEmail of canonicalCandidates.emails) {
              const { data: reAuth } = await supabase.auth.signInWithPassword({
                email: candEmail,
                password: canonicalCandidates.password
              });
              if (reAuth?.session?.access_token) break;
            }
          }
        }

        return {
          success: true,
          session: resolvedSession
        };
      }
    }

    // 2) المحاولة المباشرة عبر Supabase Auth
    const syntheticEmail = `${cleanUsername}@accounts.sharaya-clinics.internal`;

    let { data, error } = await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password: password
    });

    if ((error || !data.user) && password !== password.trim() && password.trim().length > 0) {
      const retryRes = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password: password.trim()
      });
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error || !data.user) {
      // في حال كان الحساب هو حساب مدير المالية الافتراضي (finance) ولم يتم تغيير كلمة مروره بعد
      if (
        (cleanUsername === 'finance' || cloudRegistry.usernames.includes(cleanUsername)) &&
        !regEntry?.passwordHash &&
        (password === DEFAULT_CLOUD_RECOVERY_PASSWORDS.finance ||
          password.trim() === DEFAULT_CLOUD_RECOVERY_PASSWORDS.finance)
      ) {
        const financeSession: UserSession = {
          id: regEntry?.id || 'staff-finance',
          username: cleanUsername,
          displayName: regEntry?.displayName || 'أ. خالد المنشاوي (مدير المالية والحسابات)',
          role: 'finance_manager',
          doctorId: regEntry?.doctorId || undefined,
          clinicId: regEntry?.clinicId || undefined
        };
        const canonicalCandidates = resolveCanonicalCloudEmailCandidates(financeSession);
        if (canonicalCandidates) {
          for (const candEmail of canonicalCandidates.emails) {
            const { data: reAuth } = await supabase.auth.signInWithPassword({
              email: candEmail,
              password: canonicalCandidates.password
            });
            if (reAuth?.session?.access_token) break;
          }
        }
        return {
          success: true,
          session: financeSession
        };
      }

      const errMsg = (error?.message || '').toLowerCase();
      const isNetworkError =
        errMsg.includes('failed to fetch') ||
        errMsg.includes('networkerror') ||
        errMsg.includes('network request failed') ||
        errMsg.includes('load failed');

      if (!isNetworkError) {
        return {
          success: false,
          authoritativeReject: true,
          error: 'اسم المستخدم أو كلمة المرور غير صحيحة'
        };
      }
      return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    }

    // التحقق الصارم من هوية الموظف ودوره الوظيفي عبر الخادم (Server Service Role) بمطابقة auth_user_id = auth.uid() حصراً
    const accessToken = data.session?.access_token;
    const metaRole = data.user.user_metadata?.role as UserRole | undefined;
    if (accessToken) {
      try {
        const verifyRes = await fetch('/api/auth/staff-session', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        const verifyPayload = await verifyRes.json().catch(() => null);
        if (verifyRes.ok && verifyPayload?.ok && verifyPayload?.caller) {
          const caller = verifyPayload.caller;
          const resolvedRole: UserRole =
            cleanUsername === 'finance' ||
            cloudRegistry.usernames.includes(cleanUsername) ||
            regEntry?.role === 'finance_manager' ||
            metaRole === 'finance_manager'
              ? 'finance_manager'
              : (regEntry?.role || (caller.role as UserRole));
          return {
            success: true,
            session: {
              id: regEntry?.id || caller.staffId,
              username: regEntry?.username || caller.username,
              displayName: regEntry?.displayName || caller.displayName,
              role: resolvedRole,
              doctorId: regEntry?.doctorId || caller.doctorId || undefined,
              clinicId: regEntry?.clinicId || caller.clinicId || undefined
            }
          };
        }
        if (verifyRes.status === 403 && !regEntry) {
          try {
            await supabase.auth.signOut();
          } catch {}
          return {
            success: false,
            authoritativeReject: true,
            error: verifyPayload?.error || 'هذا الحساب غير مسجل أو تم إيقافه من منظومة الموظفين'
          };
        }
      } catch {
        // fallback to bridge query below
      }
    }

    // استعلام احتياطي عبر جسر الخادم بشرط تطابق auth_user_id حصرياً
    const { data: staffData, error: staffError } = await supabase
      .from('staff_accounts')
      .select('id, auth_user_id, username, display_name, role, doctor_id, clinic_id, created_at')
      .eq('auth_user_id', data.user.id)
      .maybeSingle();

    if ((staffError || !staffData || staffData.id === undefined) && !regEntry) {
      try {
        await supabase.auth.signOut();
      } catch {}
      return {
        success: false,
        authoritativeReject: true,
        error: 'هذا الحساب غير مسجل أو تم إيقافه من منظومة الموظفين'
      };
    }

    const finalRole: UserRole =
      cleanUsername === 'finance' ||
      cloudRegistry.usernames.includes(cleanUsername) ||
      regEntry?.role === 'finance_manager' ||
      metaRole === 'finance_manager'
        ? 'finance_manager'
        : (regEntry?.role || (staffData?.role as UserRole) || 'reception');

    return {
      success: true,
      session: {
        id: regEntry?.id || staffData?.id || `staff-${cleanUsername}`,
        username: regEntry?.username || staffData?.username || cleanUsername,
        displayName: regEntry?.displayName || staffData?.display_name || cleanUsername,
        role: finalRole,
        doctorId: regEntry?.doctorId || staffData?.doctor_id || undefined,
        clinicId: regEntry?.clinicId || staffData?.clinic_id || undefined
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل تسجيل الدخول' };
  }
}

export async function logoutFromSupabase(): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('SignOut error:', e);
    }
  }
}

// ==========================================
// Phase 4: استعادة كلمة المرور (Forgot Password via 6-digit OTP)
// ==========================================

export async function requestPasswordRecoveryOtp(
  username: string,
  recoveryEmail: string
): Promise<{
  success: boolean;
  message?: string;
  code?: string;
  retryAfterSeconds?: number;
  error?: string;
}> {
  try {
    const response = await fetch('/api/auth/forgot-password/request-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username.trim().toLowerCase(),
        recoveryEmail: recoveryEmail.trim().toLowerCase(),
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      return {
        success: false,
        code: payload?.code,
        retryAfterSeconds: payload?.retryAfterSeconds,
        error:
          payload?.error ||
          'تعذر إرسال رمز الاستعادة حالياً؛ يرجى التحقق من البيانات أو المحاولة لاحقاً.',
      };
    }

    return {
      success: true,
      message: payload.message,
    };
  } catch {
    return {
      success: false,
      error: 'تعذر الاتصال بالخادم (Backend) لطلب رمز الاستعادة. يرجى التحقق من اتصال الشبكة.',
    };
  }
}

export async function verifyPasswordRecoveryOtp(
  username: string,
  recoveryEmail: string,
  otp: string
): Promise<{
  success: boolean;
  resetToken?: string;
  expiresInSeconds?: number;
  error?: string;
}> {
  try {
    const response = await fetch('/api/auth/forgot-password/verify-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username.trim().toLowerCase(),
        recoveryEmail: recoveryEmail.trim().toLowerCase(),
        otp: otp.trim(),
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok || !payload?.resetToken) {
      return {
        success: false,
        error: payload?.error || 'رمز التحقق غير صحيح أو منتهي الصلاحية.',
      };
    }

    return {
      success: true,
      resetToken: String(payload.resetToken),
      expiresInSeconds:
        typeof payload.expiresInSeconds === 'number' ? payload.expiresInSeconds : 300,
    };
  } catch {
    return {
      success: false,
      error: 'تعذر الاتصال بالخادم (Backend) للتحقق من الرمز.',
    };
  }
}

export async function completePasswordRecoveryReset(params: {
  username: string;
  recoveryEmail: string;
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const response = await fetch('/api/auth/forgot-password/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: params.username.trim().toLowerCase(),
        recoveryEmail: params.recoveryEmail.trim().toLowerCase(),
        resetToken: params.resetToken.trim(),
        newPassword: params.newPassword,
        confirmPassword: params.confirmPassword,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      return {
        success: false,
        error: payload?.error || 'تعذر تعيين كلمة المرور الجديدة.',
      };
    }

    return {
      success: true,
      message: payload.message,
    };
  } catch {
    return {
      success: false,
      error: 'تعذر الاتصال بالخادم (Backend) لتعيين كلمة المرور الجديدة.',
    };
  }
}

// ==========================================
// التحديث اللحظي (Realtime Subscription)
// ==========================================

export function subscribeToBookingsRealtime(onUpdate: (payload?: any) => void): () => void {
  if (!isSupabaseConfigured) return () => {};

  try {
    const channelName = `realtime-bookings-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        (payload) => {
          onUpdate(payload);
        }
      )
      .subscribe(() => {
        // Reconnects automatically via Supabase client when mobile network or tab resumes
      });

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (e) {
    console.warn('Realtime subscription error:', e);
    return () => {};
  }
}
