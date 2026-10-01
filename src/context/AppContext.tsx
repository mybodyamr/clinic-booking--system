import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Clinic, 
  Doctor, 
  Booking, 
  UserSession, 
  UserRole, 
  AppView, 
  ToastMessage, 
  BookingStatus, 
  PaymentStatus, 
  PaymentMethod,
  DoctorStatus,
  DailyClinicScheduleItem,
  DailyScheduleState,
  SystemPermission,
  RolePermissionsMap,
  StaffAccount,
  SystemErrorLog,
  SystemErrorSource,
  ConsultationRegistryState,
  InsuranceCompanyContract,
  BookingInsuranceDetails,
  ShiftHandoverRecord,
  SelectivePurgeOptions
} from '../types';
import { 
  getStoredClinics, 
  saveClinics,
  getStoredDoctors, 
  saveDoctors,
  getStoredBookings, 
  saveBookings,
  removeBookingsBeforeDate,
  saveStoredBookingsCutoffDate,
  getStoredSession, 
  saveSession,
  getStoredTheme, 
  saveTheme,
  sanitizeText,
  validateTripleName,
  validateEgyptianPhone,
  checkBookingRateLimit,
  getStoredDailySchedule,
  saveDailySchedule,
  getStoredRolePermissions,
  saveRolePermissions,
  getStoredSupportInfoText,
  saveSupportInfoText,
  getStoredOfficialWorkingHours,
  saveOfficialWorkingHours,
  hashPassword,
  getStoredStaffPasswordHashes,
  saveStaffPasswordHash,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
  getStoredStaffAccounts,
  saveStaffAccounts,
  deleteStaffAccountById,
  updateStaffAccountRecoveryEmail,
  markClinicDeletedLocally,
  unmarkClinicDeletedLocally,
  markDoctorDeletedLocally,
  unmarkDoctorDeletedLocally,
  getDeletedBookingIds,
  markBookingDeletedLocally,
  unmarkBookingDeletedLocally,
  getStoredErrorLogs,
  saveErrorLogs,
  getPendingErrorLogs,
  savePendingErrorLogs,
  recordLocalSystemError,
  getStoredConsultationRegistry,
  saveConsultationRegistry,
  pruneConsultationRegistry,
  checkPatientConsultationEligibility,
  getStoredInsuranceContracts,
  saveInsuranceContracts,
  getStoredInsuranceBookingsMap,
  saveInsuranceBookingsMap,
  getStoredShiftHandovers,
  saveShiftHandovers,
  clearWhatsAppAndPrintLogs
} from '../services/storage';
import { 
  checkClinicAvailability, 
  ClinicAvailabilityResult,
  parseDoctorShiftTimes,
  getLocalDateStr,
  isDoctorScheduledOnDate
} from '../services/scheduleService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { 
  fetchClinicsFromDb, 
  fetchDoctorsFromDb, 
  fetchBookingsFromDb, 
  fetchDailyScheduleFromDb, 
  fetchStaffAccountsFromDb, 
  fetchSettingsFromDb,
  saveSettingToDb,
  fetchStaffPasswordHashesFromDb,
  saveStaffPasswordHashToDb,
  createPublicBookingRpc, 
  confirmPaymentRpc, 
  fetchPatientTicketSecureRpc,
  markPatientLateAndCallNextRpc, 
  updateBookingStatusInDb, 
  updateDoctorStatusInDb, 
  updateDoctorInDb,
  updateDoctorMaxPatientsInDb,
  addDoctorToDb,
  deleteDoctorFromDb,
  updateClinicInDb,
  addClinicToDb,
  deleteClinicFromDb,
  createStaffAccountInDb,
  updateStaffAccountInDb,
  saveDailyScheduleToDb, 
  deleteStaffAccountRpc, 
  loginWithSupabaseAuth, 
  logoutFromSupabase, 
  subscribeToBookingsRealtime,
  ensureActiveSupabaseSession,
  ensureAdminSupabaseSession,
  ensureAdminOrFinanceSupabaseSession,
  adminChangeStaffPassword,
  deleteBookingsBeforeDateFromDb,
  deleteBookingFromDb,
  reportClientErrorToDb,
  saveConsultationRegistryToDb,
  saveInsuranceContractsToDb,
  saveInsuranceBookingsMapToDb,
  saveShiftHandoversToDb,
  parseCloudStaffRegistryState,
  mergeStaffAccountsWithCloudRegistry
} from '../services/supabaseService';

interface AppContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  currentUser: UserSession | null;
  activeView: AppView;
  currentView: AppView;
  navigate: (view: AppView, ticketId?: string) => void;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  resetPasswordByAdmin: (username: string, newPass: string) => Promise<boolean>;
  staffAccounts: StaffAccount[];
  createStaffAccount: (input: {
    username: string;
    password: string;
    displayName: string;
    role: UserRole;
    doctorId?: string | null;
    clinicId?: string | null;
    recoveryEmail?: string;
  }) => Promise<boolean>;
  deleteStaffAccount: (id: string) => Promise<boolean>;
  updateStaffRecoveryEmail: (id: string, email: string) => void;
  updateStaffAccount: (
    id: string,
    updates: {
      username?: string;
      displayName?: string;
      role?: UserRole;
      doctorId?: string | null;
      clinicId?: string | null;
      recoveryEmail?: string;
      password?: string;
    }
  ) => Promise<boolean>;
  logout: () => void;
  clinics: Clinic[];
  doctors: Doctor[];
  bookings: Booking[];
  selectedTicket: Booking | null;
  setSelectedTicket: (booking: Booking | null) => void;
  dailySchedule: DailyScheduleState;
  updateDailySchedule: (items: DailyClinicScheduleItem[]) => void;
  rolePermissions: RolePermissionsMap;
  updateRolePermissions: (role: UserRole, permissions: SystemPermission[]) => void;
  hasPermission: (role: UserRole | undefined, permission: SystemPermission) => boolean;
  supportInfoText: string;
  updateSupportInfoText: (text: string) => Promise<boolean>;
  officialWorkingHours: string;
  updateOfficialWorkingHours: (text: string) => Promise<boolean>;
  consultationRegistry: ConsultationRegistryState;
  consultationWindowDays: number;
  activeConsultationStampsCount: number;
  updateConsultationWindowDays: (days: number) => Promise<boolean>;
  updateConsultationSettings: (defaultDays: number, clinicWindows?: Record<string, number>) => Promise<boolean>;
  checkConsultationEligibility: (
    phone: string,
    clinicId: string
  ) => {
    eligible: boolean;
    examDate?: string;
    daysAgo?: number;
    remainingDays?: number;
    daysRemaining?: number;
  };
  getActiveClinicsForBooking: () => { clinic: Clinic; assignedDoctor?: Doctor }[];
  createBooking: (data: {
    patientName: string;
    patientPhone: string;
    clinicId: string;
    doctorId: string;
    date: string;
    timeSlot: string;
    fee: number;
    notes?: string;
  }) => Promise<{ success: boolean; booking?: Booking; error?: string }>;
  updateBookingStatus: (bookingId: string, status: BookingStatus) => void;
  updatePaymentStatus: (
    bookingId: string,
    paymentStatus: PaymentStatus,
    method?: PaymentMethod,
    insuranceDetails?: BookingInsuranceDetails
  ) => boolean;
  deleteBooking: (bookingId: string) => Promise<{ success: boolean; error?: string }>;
  updateDoctorStatus: (doctorId: string, status: DoctorStatus, reason?: string) => Promise<boolean>;
  updateDoctorSchedule: (doctorId: string, scheduleDays: string[], scheduleHours: string, shiftStartTime?: string, shiftEndTime?: string) => Promise<boolean>;
  updateDoctorMaxBookings: (doctorId: string, maxDailyBookings: number) => void;
  checkClinicAvailabilityStatus: (clinicId: string, doctorId: string, date?: string) => ClinicAvailabilityResult | null;
  admitPatient: (bookingId: string) => void;
  callNextPatientInClinic: (clinicId: string) => void;
  markPatientLate: (bookingId: string) => void;
  restoreLatePatient: (bookingId: string, action: 'admit_now' | 'return_to_queue') => void;
  addDoctorDiagnosis: (bookingId: string, diagnosis: string) => void;
  addClinic: (clinic: Omit<Clinic, 'id'>) => void;
  updateClinic: (clinicId: string, data: Partial<Clinic>) => void;
  deleteClinic: (clinicId: string) => Promise<{ success: boolean; error?: string }>;
  addDoctor: (doctor: Omit<Doctor, 'id'>) => void;
  updateDoctor: (doctorId: string, data: Partial<Doctor>) => Promise<boolean>;
  deleteDoctor: (doctorId: string) => Promise<{ success: boolean; error?: string }>;
  resetToInitialData: () => void;
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  patientHistoryModalOpen: boolean;
  setPatientHistoryModalOpen: (open: boolean) => void;
  patientHistoryPhone: string;
  setPatientHistoryPhone: (phone: string) => void;
  toggleClinicStatus: (clinicId: string) => void;
  clearPastBookings: (beforeDate?: string) => Promise<{ success: boolean; count: number }>;
  errorLogs: SystemErrorLog[];
  logSystemError: (input: {
    source: SystemErrorSource;
    message: string;
    stack?: string;
    componentStack?: string;
  }) => Promise<void>;
  resolveErrorLog: (errorId: string, resolved?: boolean) => Promise<void>;
  resolveAllErrorLogs: () => Promise<void>;
  deleteErrorLog: (errorId: string) => Promise<void>;
  clearAllErrorLogs: () => Promise<void>;
  syncErrorLogsNow: () => Promise<boolean>;
  insuranceContracts: InsuranceCompanyContract[];
  saveInsuranceContract: (
    contract: Omit<InsuranceCompanyContract, 'id' | 'createdAt'> & { id?: string }
  ) => Promise<boolean>;
  deleteInsuranceContract: (id: string) => Promise<boolean>;
  shiftHandovers: ShiftHandoverRecord[];
  createShiftHandover: (input: {
    department: 'reception' | 'cashier';
    toStaffId: string;
    handoverType: 'reception_shift' | 'cashier_to_management' | 'cashier_to_colleague';
    expectedAmount?: number;
    notes?: string;
  }) => Promise<boolean>;
  acknowledgeShiftHandover: (
    handoverId: string,
    receivedExact: boolean,
    actualReceivedAmount?: number,
    acknowledgmentNotes?: string
  ) => Promise<boolean>;
  selectivePurgeRecords: (
    options: SelectivePurgeOptions
  ) => Promise<{ success: boolean; summary: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(getStoredTheme);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(getStoredSession);
  const [activeView, setActiveView] = useState<AppView>('landing');
  const [clinics, setClinics] = useState<Clinic[]>(getStoredClinics);
  const [doctors, setDoctors] = useState<Doctor[]>(getStoredDoctors);
  const [bookings, setBookings] = useState<Booking[]>(getStoredBookings);
  const [selectedTicket, setSelectedTicketState] = useState<Booking | null>(() => {
    try {
      const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('sharaya_selected_ticket_v2') : null;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const selectedTicketRef = React.useRef<Booking | null>(selectedTicket);
  const setSelectedTicket = (ticket: Booking | null) => {
    selectedTicketRef.current = ticket;
    setSelectedTicketState(ticket);
    try {
      if (typeof sessionStorage !== 'undefined') {
        if (ticket) {
          sessionStorage.setItem('sharaya_selected_ticket_v2', JSON.stringify(ticket));
        } else {
          sessionStorage.removeItem('sharaya_selected_ticket_v2');
        }
      }
    } catch {}
  };
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [patientHistoryModalOpen, setPatientHistoryModalOpen] = useState(false);
  const [patientHistoryPhone, setPatientHistoryPhone] = useState('');

  // جدول عيادات اليوم والأطباء المكلفين
  const [dailySchedule, setDailySchedule] = useState<DailyScheduleState>(() => getStoredDailySchedule(clinics, doctors));

  // نظام تفويض الصلاحيات
  const [rolePermissions, setRolePermissions] = useState<RolePermissionsMap>(getStoredRolePermissions);

  // نص استفسارات ومساعدة فورية بالرئيسية
  const [supportInfoText, setSupportInfoText] = useState<string>(getStoredSupportInfoText);

  // مواعيد العمل الرسمية بالصفحة الرئيسية (قابلة للتعديل من قبل الأدمن ومربوطة بقاعدة البيانات)
  const [officialWorkingHours, setOfficialWorkingHours] = useState<string>(getStoredOfficialWorkingHours);

  // سجل الاستشارات المجانية ذاتي المسح (المستقل عن أرشيف الحجوزات)
  const [consultationRegistry, setConsultationRegistry] = useState<ConsultationRegistryState>(
    getStoredConsultationRegistry
  );

  // قائمة حسابات الكادر والمستخدمين الديناميكية
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>(getStoredStaffAccounts);

  // سجلات أخطاء النظام المجمعة من جميع الأجهزة (ErrorBoundary + vite:preloadError + Runtime)
  const [errorLogs, setErrorLogs] = useState<SystemErrorLog[]>(getStoredErrorLogs);

  // تعاقدات شركات التأمين الطبي المعتمدة
  const [insuranceContracts, setInsuranceContracts] = useState<InsuranceCompanyContract[]>(
    getStoredInsuranceContracts
  );

  // سجلات تسليم واستلام الشفتات والخزينة
  const [shiftHandovers, setShiftHandovers] = useState<ShiftHandoverRecord[]>(
    getStoredShiftHandovers
  );

  const mergeErrorLogLists = (cloudList: SystemErrorLog[], localList: SystemErrorLog[]): SystemErrorLog[] => {
    const map = new Map<string, SystemErrorLog>();
    for (const item of localList) {
      if (item && item.id) {
        map.set(item.id, item);
      }
    }
    for (const item of cloudList) {
      if (item && item.id) {
        const existing = map.get(item.id);
        map.set(item.id, {
          ...existing,
          ...item,
          resolved: Boolean(item.resolved || existing?.resolved),
          syncedToDb: true
        });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 100);
  };

  // تطبيق كلاس dark على وسم html لضمان التوافق التام مع نمط التصميم وحفظه في localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    saveTheme(theme);
  }, [theme]);

  const lastSettingsSaveAtRef = React.useRef<number>(0);
  const lastMutationAtRef = React.useRef<number>(0);
  const activeMutationsCountRef = React.useRef<number>(0);
  const isMutationGuardActive = () =>
    activeMutationsCountRef.current > 0 || Date.now() - lastMutationAtRef.current < 4000;

  // مزامنة البيانات مع Supabase عند بدء التشغيل وتفعيل التحديث اللحظي Realtime
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;
    const todayStr = getLocalDateStr(new Date());
    const isDoctorRoleSession = () => getStoredSession()?.role === 'doctor';

    const mergeWithSelectedTicket = (list: Booking[]): Booking[] => {
      const currentTicket = selectedTicketRef.current;
      if (!currentTicket || getStoredSession()) return list;
      if (getDeletedBookingIds().has(currentTicket.id)) return list;
      const exists = list.some(b => b.id === currentTicket.id);
      if (!exists) {
        return [currentTicket, ...list];
      }
      return list.map(b =>
        b.id === currentTicket.id
          ? {
              ...b,
              patientName: currentTicket.patientName || b.patientName,
              patientPhone: currentTicket.patientPhone || b.patientPhone,
              timeSlot: currentTicket.timeSlot || b.timeSlot,
              fee: currentTicket.fee || b.fee,
              notes: currentTicket.notes || b.notes
            }
          : b
      );
    };

    async function loadSupabaseData() {
      try {
        if (getStoredSession()) {
          await ensureActiveSupabaseSession();
        }

        const [dbClinics, dbDoctors, dbBookings, dbSchedule, dbStaff, dbSettings] = await Promise.all([
          fetchClinicsFromDb(),
          fetchDoctorsFromDb(),
          isDoctorRoleSession() ? Promise.resolve(null) : fetchBookingsFromDb(),
          fetchDailyScheduleFromDb(todayStr),
          fetchStaffAccountsFromDb(),
          fetchSettingsFromDb(),
          fetchStaffPasswordHashesFromDb()
        ]);

        if (!isMounted) return;

        if (dbClinics && dbClinics.length > 0) {
          setClinics(dbClinics);
          saveClinics(dbClinics);
        }
        if (dbDoctors && dbDoctors.length > 0) {
          setDoctors(dbDoctors);
          saveDoctors(dbDoctors);
        }
        if (dbBookings) {
          const merged = mergeWithSelectedTicket(dbBookings);
          setBookings(merged);
          saveBookings(merged);
        }
        const effectiveClinics = (dbClinics && dbClinics.length > 0) ? dbClinics : clinics;
        const effectiveDoctors = (dbDoctors && dbDoctors.length > 0) ? dbDoctors : doctors;

        if (dbSchedule && dbSchedule.items.length > 0) {
          setDailySchedule(dbSchedule);
          saveDailySchedule(dbSchedule);
        } else if (effectiveClinics.length > 0) {
          const defaultItems: DailyClinicScheduleItem[] = effectiveClinics.map(c => {
            const doc = effectiveDoctors.find(d => d.clinicId === c.id);
            return {
              clinicId: c.id,
              doctorId: doc?.id || '',
              isOpen: c.isOpenToday !== false && c.active !== false && c.isActive !== false
            };
          });
          const initialSchedule: DailyScheduleState = {
            date: todayStr,
            items: defaultItems
          };
          setDailySchedule(initialSchedule);
          saveDailySchedule(initialSchedule);
          saveDailyScheduleToDb(initialSchedule);
        }
        const cloudStaffRegistry = parseCloudStaffRegistryState(
          dbSettings ? dbSettings['finance_managers_json'] : null
        );
        if (dbStaff && dbStaff.length > 0) {
          const mergedStaff = mergeStaffAccountsWithCloudRegistry(dbStaff, cloudStaffRegistry);
          setStaffAccounts(mergedStaff);
          saveStaffAccounts(mergedStaff);
        } else if (dbSettings && dbSettings['finance_managers_json']) {
          const mergedStaff = mergeStaffAccountsWithCloudRegistry(
            getStoredStaffAccounts(),
            cloudStaffRegistry
          );
          setStaffAccounts(mergedStaff);
          saveStaffAccounts(mergedStaff);
        }
        if (dbSettings && dbSettings['support_info_text']) {
          setSupportInfoText(dbSettings['support_info_text']);
          saveSupportInfoText(dbSettings['support_info_text']);
        }
        if (dbSettings && dbSettings['official_working_hours_text']) {
          setOfficialWorkingHours(dbSettings['official_working_hours_text']);
          saveOfficialWorkingHours(dbSettings['official_working_hours_text']);
        }
        if (dbSettings && dbSettings['role_permissions']) {
          try {
            const parsedPerms = JSON.parse(dbSettings['role_permissions']);
            if (parsedPerms && typeof parsedPerms === 'object') {
              setRolePermissions(parsedPerms);
              saveRolePermissions(parsedPerms);
            }
          } catch {}
        }
        if (dbSettings && dbSettings['system_error_logs_json']) {
          try {
            const parsedLogs = JSON.parse(dbSettings['system_error_logs_json']);
            if (Array.isArray(parsedLogs)) {
              const mergedLogs = mergeErrorLogLists(parsedLogs, getStoredErrorLogs());
              setErrorLogs(mergedLogs);
              saveErrorLogs(mergedLogs);
            }
          } catch {}
        }
        if (dbSettings && dbSettings['consultation_registry_json']) {
          try {
            const parsedReg = JSON.parse(dbSettings['consultation_registry_json']);
            if (parsedReg && typeof parsedReg === 'object') {
              const pruned = saveConsultationRegistry(parsedReg, todayStr);
              setConsultationRegistry(pruned);
              if (pruned.consultationBookingIds.length > 0) {
                setBookings(prev => {
                  const next = prev.map(b =>
                    pruned.consultationBookingIds.includes(b.id)
                      ? { ...b, paymentMethod: 'consultation' as PaymentMethod, fee: 0 }
                      : b
                  );
                  saveBookings(next);
                  return next;
                });
              }
            }
          } catch {}
        }
        if (dbSettings && dbSettings['insurance_contracts_json']) {
          try {
            const parsedContracts = JSON.parse(dbSettings['insurance_contracts_json']);
            if (Array.isArray(parsedContracts) && parsedContracts.length > 0) {
              setInsuranceContracts(parsedContracts);
              saveInsuranceContracts(parsedContracts);
            }
          } catch {}
        }
        if (dbSettings && dbSettings['insurance_bookings_json']) {
          try {
            const parsedInsMap = JSON.parse(dbSettings['insurance_bookings_json']);
            if (parsedInsMap && typeof parsedInsMap === 'object') {
              saveInsuranceBookingsMap(parsedInsMap);
              setBookings(prev => {
                const next = prev.map(b =>
                  parsedInsMap[b.id] ? { ...b, insuranceDetails: parsedInsMap[b.id] } : b
                );
                saveBookings(next);
                return next;
              });
            }
          } catch {}
        }
        if (dbSettings && dbSettings['shift_handovers_json']) {
          try {
            const parsedHandovers = JSON.parse(dbSettings['shift_handovers_json']);
            if (Array.isArray(parsedHandovers)) {
              setShiftHandovers(parsedHandovers);
              saveShiftHandovers(parsedHandovers);
            }
          } catch {}
        }

        // دفع أي أخطاء محلية معلقة لم يتم رفعها بعد إلى قاعدة البيانات السحابية
        const pendingErrors = getPendingErrorLogs();
        if (pendingErrors.length > 0) {
          const remainingPending: SystemErrorLog[] = [];
          for (const pendingItem of pendingErrors) {
            const ok = await reportClientErrorToDb(pendingItem);
            if (!ok) {
              remainingPending.push(pendingItem);
            }
          }
          savePendingErrorLogs(remainingPending);
        }

        // فحص أمان الجلسة ضد التلاعب عبر الكونسول (Session Integrity & Anti-Tampering Check)
        const currentStored = getStoredSession();
        if (currentStored) {
          const { data: authSessionData } = await supabase.auth.getSession();
          const authUid = authSessionData?.session?.user?.id;
          const baseList = (dbStaff && dbStaff.length > 0) ? dbStaff : getStoredStaffAccounts();
          const authoritativeList = mergeStaffAccountsWithCloudRegistry(baseList, cloudStaffRegistry);
          const matchedStaff =
            authoritativeList.find(
              s =>
                s.id === currentStored.id ||
                s.username.toLowerCase() === currentStored.username.toLowerCase()
            ) ||
            authoritativeList.find(s => Boolean(authUid && s.authUserId === authUid));

          if (matchedStaff) {
            const effectiveStaffRole: UserRole =
              currentStored.role === 'finance_manager' ||
              matchedStaff.username.toLowerCase() === 'finance' ||
              matchedStaff.role === 'finance_manager'
                ? 'finance_manager'
                : matchedStaff.role;

            if (!authUid) {
              ensureActiveSupabaseSession(true).catch(() => {});
            }

            if (
              currentStored.role !== effectiveStaffRole ||
              currentStored.id !== matchedStaff.id ||
              (currentStored.clinicId || '') !== (matchedStaff.clinicId || '') ||
              currentStored.displayName !== matchedStaff.displayName
            ) {
              // تصحيح أي محاولة لتزوير الصلاحية أو تحديث العيادة المخصصة للموظف فوراً
              const correctedSession: UserSession = {
                id: matchedStaff.id,
                username: matchedStaff.username,
                displayName: matchedStaff.displayName,
                role: effectiveStaffRole,
                doctorId: matchedStaff.doctorId,
                clinicId: matchedStaff.clinicId,
              };
              setCurrentUser(correctedSession);
              saveSession(correctedSession);
            }
          }
        }
      } catch (err) {
        console.warn('Supabase initial sync error, using local state:', err);
      }
    }

    loadSupabaseData();

    // تفعيل التحديث اللحظي عبر Supabase Realtime لجدول bookings
    const unsubscribeBookings = subscribeToBookingsRealtime(async () => {
      if (isDoctorRoleSession() || isMutationGuardActive()) return;
      const freshBookings = await fetchBookingsFromDb();
      if (freshBookings && isMounted && !isMutationGuardActive()) {
        const merged = mergeWithSelectedTicket(freshBookings);
        setBookings(merged);
        saveBookings(merged);
      }
    });

    // الاستماع لقناة التحديثات اللحظية العامة (نص الاستفسارات، وتعديل حسابات الكادر)
    const systemChannel = supabase.channel('system_updates');
    systemChannel
      .on('broadcast', { event: 'support_info_updated' }, (payload: any) => {
        const newText = payload?.payload?.value;
        if (newText && isMounted) {
          setSupportInfoText(newText);
          saveSupportInfoText(newText);
        }
      })
      .on('broadcast', { event: 'working_hours_updated' }, (payload: any) => {
        const newHours = payload?.payload?.value;
        if (newHours && isMounted) {
          setOfficialWorkingHours(newHours);
          saveOfficialWorkingHours(newHours);
        }
      })
      .on('broadcast', { event: 'role_permissions_updated' }, (payload: any) => {
        const rawVal = payload?.payload?.value;
        if (rawVal && isMounted) {
          try {
            const parsed = JSON.parse(rawVal);
            if (parsed && typeof parsed === 'object') {
              setRolePermissions(parsed);
              saveRolePermissions(parsed);
            }
          } catch {}
        }
      })
      .on('broadcast', { event: 'schedule_updated' }, async () => {
        if (!isMounted) return;
        try {
          const currentToday = getLocalDateStr(new Date());
          const [freshSched, freshClinics] = await Promise.all([
            fetchDailyScheduleFromDb(currentToday),
            fetchClinicsFromDb()
          ]);
          if (freshSched && freshSched.items.length > 0 && isMounted) {
            setDailySchedule(freshSched);
            saveDailySchedule(freshSched);
          }
          if (freshClinics && freshClinics.length > 0 && isMounted) {
            setClinics(freshClinics);
            saveClinics(freshClinics);
          }
        } catch {}
      })
      .on('broadcast', { event: 'staff_updated' }, async () => {
        if (!isMounted) return;
        try {
          const freshStaff = await fetchStaffAccountsFromDb();
          if (freshStaff && freshStaff.length > 0 && isMounted) {
            setStaffAccounts(freshStaff);
            saveStaffAccounts(freshStaff);
            const activeStored = getStoredSession();
            if (activeStored) {
              const matched = freshStaff.find(
                s => s.id === activeStored.id || s.username.toLowerCase() === activeStored.username.toLowerCase()
              );
              if (
                matched &&
                ((activeStored.clinicId || '') !== (matched.clinicId || '') ||
                  activeStored.displayName !== matched.displayName ||
                  activeStored.role !== matched.role)
              ) {
                const updatedSession: UserSession = {
                  ...activeStored,
                  displayName: matched.displayName,
                  role: matched.role,
                  doctorId: matched.doctorId,
                  clinicId: matched.clinicId
                };
                setCurrentUser(updatedSession);
                saveSession(updatedSession);
              }
            }
          }
        } catch {
          // ignore
        }
      })
      .on('broadcast', { event: 'consultation_registry_updated' }, (payload: any) => {
        if (!isMounted) return;
        const rawVal = payload?.payload?.value;
        if (typeof rawVal === 'string') {
          try {
            const parsed = JSON.parse(rawVal);
            if (parsed && typeof parsed === 'object') {
              const pruned = saveConsultationRegistry(parsed);
              setConsultationRegistry(pruned);
              if (pruned.consultationBookingIds.length > 0) {
                setBookings(prev => {
                  const next = prev.map(b =>
                    pruned.consultationBookingIds.includes(b.id)
                      ? { ...b, paymentMethod: 'consultation' as PaymentMethod, fee: 0 }
                      : b
                  );
                  saveBookings(next);
                  return next;
                });
              }
            }
          } catch {}
        }
      })
      .on('broadcast', { event: 'insurance_contracts_updated' }, (payload: any) => {
        if (!isMounted) return;
        const rawVal = payload?.payload?.value;
        if (typeof rawVal === 'string') {
          try {
            const parsed = JSON.parse(rawVal);
            if (Array.isArray(parsed)) {
              setInsuranceContracts(parsed);
              saveInsuranceContracts(parsed);
            }
          } catch {}
        }
      })
      .on('broadcast', { event: 'insurance_bookings_updated' }, (payload: any) => {
        if (!isMounted) return;
        const rawVal = payload?.payload?.value;
        if (typeof rawVal === 'string') {
          try {
            const parsed = JSON.parse(rawVal);
            if (parsed && typeof parsed === 'object') {
              saveInsuranceBookingsMap(parsed);
              setBookings(prev => {
                const next = prev.map(b =>
                  parsed[b.id] ? { ...b, insuranceDetails: parsed[b.id] } : b
                );
                saveBookings(next);
                return next;
              });
            }
          } catch {}
        }
      })
      .on('broadcast', { event: 'shift_handovers_updated' }, (payload: any) => {
        if (!isMounted) return;
        const rawVal = payload?.payload?.value;
        if (typeof rawVal === 'string') {
          try {
            const parsed = JSON.parse(rawVal);
            if (Array.isArray(parsed)) {
              setShiftHandovers(parsed);
              saveShiftHandovers(parsed);
            }
          } catch {}
        }
      })
      .on('broadcast', { event: 'doctors_updated' }, async () => {
        if (!isMounted) return;
        try {
          const freshDoctors = await fetchDoctorsFromDb();
          if (freshDoctors && freshDoctors.length > 0 && isMounted) {
            setDoctors(freshDoctors);
            saveDoctors(freshDoctors);
          }
        } catch {
          // ignore
        }
      })
      .on('broadcast', { event: 'bookings_purged' }, async (payload: any) => {
        if (!isMounted) return;
        const cutoff = payload?.payload?.cutoffDate;
        if (cutoff) {
          saveStoredBookingsCutoffDate(cutoff);
        }
        if (isDoctorRoleSession()) return;
        const fresh = await fetchBookingsFromDb();
        if (fresh && isMounted) {
          const merged = mergeWithSelectedTicket(fresh);
          setBookings(merged);
          saveBookings(merged);
        }
      })
      .on('broadcast', { event: 'bookings_updated' }, async () => {
        if (!isMounted || isDoctorRoleSession() || isMutationGuardActive()) return;
        const fresh = await fetchBookingsFromDb();
        if (fresh && isMounted && !isMutationGuardActive()) {
          const merged = mergeWithSelectedTicket(fresh);
          setBookings(merged);
          saveBookings(merged);
        }
      })
      .on('broadcast', { event: 'booking_deleted' }, (payload: any) => {
        if (!isMounted) return;
        const deletedId = payload?.payload?.bookingId;
        if (deletedId && typeof deletedId === 'string') {
          markBookingDeletedLocally(deletedId);
          if (selectedTicketRef.current?.id === deletedId) {
            setSelectedTicket(null);
          }
          setBookings(prev => {
            const next = prev.filter(b => b.id !== deletedId);
            saveBookings(next);
            return next;
          });
        }
      })
      .on('broadcast', { event: 'error_logged' }, async (payload: any) => {
        if (!isMounted) return;
        const incomingError = payload?.payload?.errorLog as SystemErrorLog | undefined;
        if (incomingError && incomingError.id) {
          setErrorLogs(prev => {
            const next = mergeErrorLogLists([incomingError], prev);
            saveErrorLogs(next);
            if (getStoredSession()?.role === 'admin') {
              saveSettingToDb('system_error_logs_json', JSON.stringify(next)).catch(() => {});
            }
            return next;
          });
        }
      })
      .on('broadcast', { event: 'error_logs_updated' }, (payload: any) => {
        if (!isMounted) return;
        const rawVal = payload?.payload?.value;
        if (typeof rawVal === 'string') {
          try {
            const parsed = JSON.parse(rawVal);
            if (Array.isArray(parsed)) {
              setErrorLogs(parsed);
              saveErrorLogs(parsed);
            }
          } catch {}
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, async () => {
        if (!isMounted || isMutationGuardActive()) return;
        try {
          const freshDoctors = await fetchDoctorsFromDb();
          if (freshDoctors && freshDoctors.length > 0 && isMounted && !isMutationGuardActive()) {
            setDoctors(freshDoctors);
            saveDoctors(freshDoctors);
          }
        } catch {}
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_schedule' }, async () => {
        if (!isMounted || isMutationGuardActive()) return;
        try {
          const currentToday = getLocalDateStr(new Date());
          const freshSched = await fetchDailyScheduleFromDb(currentToday);
          if (freshSched && freshSched.items.length > 0 && isMounted && !isMutationGuardActive()) {
            setDailySchedule(freshSched);
            saveDailySchedule(freshSched);
          }
        } catch {}
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinics' }, async () => {
        if (!isMounted || isMutationGuardActive()) return;
        try {
          const [freshClinics, freshSettings] = await Promise.all([
            fetchClinicsFromDb(),
            fetchSettingsFromDb()
          ]);
          if (freshClinics && freshClinics.length > 0 && isMounted && !isMutationGuardActive()) {
            setClinics(freshClinics);
            saveClinics(freshClinics);
          }
          if (freshSettings && isMounted && Date.now() - lastSettingsSaveAtRef.current > 5000) {
            if (freshSettings['support_info_text']) {
              setSupportInfoText(freshSettings['support_info_text']);
              saveSupportInfoText(freshSettings['support_info_text']);
            }
            if (freshSettings['official_working_hours_text']) {
              setOfficialWorkingHours(freshSettings['official_working_hours_text']);
              saveOfficialWorkingHours(freshSettings['official_working_hours_text']);
            }
            if (freshSettings['consultation_registry_json']) {
              try {
                const parsedReg = JSON.parse(freshSettings['consultation_registry_json']);
                if (parsedReg && typeof parsedReg === 'object') {
                  const pruned = saveConsultationRegistry(parsedReg);
                  setConsultationRegistry(pruned);
                }
              } catch {}
            }
            if (freshSettings['finance_managers_json']) {
              try {
                const reg = parseCloudStaffRegistryState(freshSettings['finance_managers_json']);
                setStaffAccounts(prev => {
                  const next = mergeStaffAccountsWithCloudRegistry(prev, reg);
                  if (JSON.stringify(prev) !== JSON.stringify(next)) {
                    saveStaffAccounts(next);
                    return next;
                  }
                  return prev;
                });
              } catch {}
            }
          }
        } catch {}
      })
      .subscribe();

    const handleLocalErrorLogged = (event: Event) => {
      const customEvt = event as CustomEvent<SystemErrorLog>;
      if (customEvt?.detail && isMounted) {
        setErrorLogs(prev => {
          const next = mergeErrorLogLists([customEvt.detail], prev);
          saveErrorLogs(next);
          return next;
        });
      }
    };
    window.addEventListener('sharaya:system-error-logged', handleLocalErrorLogged);

    // مراقبة أي تلاعب مباشر بـ Storage من خلال الكونسول وإعادة التحقق الفوري
    const handleStorageTamper = () => {
      const stored = getStoredSession();
      if (!stored) {
        setCurrentUser(null);
      }
    };
    window.addEventListener('storage', handleStorageTamper);

    // دورية مزامنة احتياطية كل 7 ثوانٍ لضمان بقاء جميع الشاشات محدثة لحظياً وفحص سلامة الجلسة
    const syncInterval = setInterval(async () => {
      if (!isMounted || isMutationGuardActive()) return;
      try {
        const currentToday = getLocalDateStr(new Date());

        // إذا كان الزائر يعرض تذكرته الحالية، نحدّث حالة التذكرة المباشرة بأمان
        const activeTicket = selectedTicketRef.current;
        if ((activeTicket?.ticketNumber || activeTicket?.id) && activeTicket?.patientPhone && !getStoredSession()) {
          const refreshedTicket = await fetchPatientTicketSecureRpc(activeTicket.ticketNumber || activeTicket.id, activeTicket.patientPhone);
          if (refreshedTicket && isMounted && !isMutationGuardActive()) {
            if (JSON.stringify(activeTicket) !== JSON.stringify(refreshedTicket)) {
              setSelectedTicket(refreshedTicket);
            }
          }
        }

        if (!isDoctorRoleSession() && !isMutationGuardActive()) {
          const fresh = await fetchBookingsFromDb();
          if (fresh && isMounted && !isMutationGuardActive()) {
            const merged = mergeWithSelectedTicket(fresh);
            setBookings(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(merged)) {
                saveBookings(merged);
                return merged;
              }
              return prev;
            });
          }
        }

        const [freshClinics, freshDoctors, freshSchedule, freshSettings] = await Promise.all([
          fetchClinicsFromDb(),
          fetchDoctorsFromDb(),
          fetchDailyScheduleFromDb(currentToday),
          fetchSettingsFromDb()
        ]);

        if (!isMounted || isMutationGuardActive()) return;
        if (freshClinics && freshClinics.length > 0 && isMounted) {
          setClinics(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(freshClinics)) {
              saveClinics(freshClinics);
              return freshClinics;
            }
            return prev;
          });
        }

        if (freshDoctors && freshDoctors.length > 0 && isMounted) {
          setDoctors(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(freshDoctors)) {
              saveDoctors(freshDoctors);
              return freshDoctors;
            }
            return prev;
          });
        }

        if (freshSchedule && freshSchedule.items.length > 0 && isMounted) {
          setDailySchedule(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(freshSchedule)) {
              saveDailySchedule(freshSchedule);
              return freshSchedule;
            }
            return prev;
          });
        }

        if (freshSettings?.['support_info_text'] && isMounted && Date.now() - lastSettingsSaveAtRef.current > 5000) {
          setSupportInfoText(prev => {
            if (prev !== freshSettings['support_info_text']) {
              saveSupportInfoText(freshSettings['support_info_text']);
              return freshSettings['support_info_text'];
            }
            return prev;
          });
        }

        if (freshSettings?.['official_working_hours_text'] && isMounted && Date.now() - lastSettingsSaveAtRef.current > 5000) {
          setOfficialWorkingHours(prev => {
            if (prev !== freshSettings['official_working_hours_text']) {
              saveOfficialWorkingHours(freshSettings['official_working_hours_text']);
              return freshSettings['official_working_hours_text'];
            }
            return prev;
          });
        }

        if (freshSettings?.['role_permissions'] && isMounted) {
          try {
            const parsedPerms = JSON.parse(freshSettings['role_permissions']);
            if (parsedPerms && typeof parsedPerms === 'object') {
              setRolePermissions(prev => {
                if (JSON.stringify(prev) !== JSON.stringify(parsedPerms)) {
                  saveRolePermissions(parsedPerms);
                  return parsedPerms;
                }
                return prev;
              });
            }
          } catch {}
        }

        if (
          freshSettings?.['consultation_registry_json'] &&
          isMounted &&
          Date.now() - lastSettingsSaveAtRef.current > 5000
        ) {
          try {
            const parsedReg = JSON.parse(freshSettings['consultation_registry_json']);
            if (parsedReg && typeof parsedReg === 'object') {
              const pruned = pruneConsultationRegistry(parsedReg, currentToday);
              setConsultationRegistry(prev => {
                if (JSON.stringify(prev) !== JSON.stringify(pruned)) {
                  saveConsultationRegistry(pruned, currentToday);
                  return pruned;
                }
                return prev;
              });
            }
          } catch {}
        }

        if (freshSettings?.['system_error_logs_json'] && isMounted) {
          try {
            const parsedLogs = JSON.parse(freshSettings['system_error_logs_json']);
            if (Array.isArray(parsedLogs)) {
              setErrorLogs(prev => {
                const merged = mergeErrorLogLists(parsedLogs, prev);
                if (JSON.stringify(prev) !== JSON.stringify(merged)) {
                  saveErrorLogs(merged);
                  return merged;
                }
                return prev;
              });
            }
          } catch {}
        }

        if (
          freshSettings?.['insurance_contracts_json'] &&
          isMounted &&
          Date.now() - lastSettingsSaveAtRef.current > 5000
        ) {
          try {
            const parsedContracts = JSON.parse(freshSettings['insurance_contracts_json']);
            if (Array.isArray(parsedContracts) && parsedContracts.length > 0) {
              setInsuranceContracts(prev => {
                if (JSON.stringify(prev) !== JSON.stringify(parsedContracts)) {
                  saveInsuranceContracts(parsedContracts);
                  return parsedContracts;
                }
                return prev;
              });
            }
          } catch {}
        }

        if (
          freshSettings?.['insurance_bookings_json'] &&
          isMounted &&
          Date.now() - lastSettingsSaveAtRef.current > 5000
        ) {
          try {
            const parsedMap = JSON.parse(freshSettings['insurance_bookings_json']);
            if (parsedMap && typeof parsedMap === 'object') {
              saveInsuranceBookingsMap(parsedMap);
              setBookings(prev => {
                let changed = false;
                const next = prev.map(b => {
                  if (parsedMap[b.id] && JSON.stringify(b.insuranceDetails) !== JSON.stringify(parsedMap[b.id])) {
                    changed = true;
                    return { ...b, insuranceDetails: parsedMap[b.id] };
                  }
                  return b;
                });
                if (changed) {
                  saveBookings(next);
                  return next;
                }
                return prev;
              });
            }
          } catch {}
        }

        if (
          freshSettings?.['shift_handovers_json'] &&
          isMounted &&
          Date.now() - lastSettingsSaveAtRef.current > 5000
        ) {
          try {
            const parsedHandovers = JSON.parse(freshSettings['shift_handovers_json']);
            if (Array.isArray(parsedHandovers)) {
              setShiftHandovers(prev => {
                if (JSON.stringify(prev) !== JSON.stringify(parsedHandovers)) {
                  saveShiftHandovers(parsedHandovers);
                  return parsedHandovers;
                }
                return prev;
              });
            }
          } catch {}
        }

        if (
          freshSettings?.['finance_managers_json'] &&
          isMounted &&
          Date.now() - lastSettingsSaveAtRef.current > 5000
        ) {
          try {
            const reg = parseCloudStaffRegistryState(freshSettings['finance_managers_json']);
            setStaffAccounts(prev => {
              const next = mergeStaffAccountsWithCloudRegistry(prev, reg);
              if (JSON.stringify(prev) !== JSON.stringify(next)) {
                saveStaffAccounts(next);
                return next;
              }
              return prev;
            });
          } catch {}
        }
      } catch {
        // silent fallback
      }
    }, 4000);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorageTamper);
      window.removeEventListener('sharaya:system-error-logged', handleLocalErrorLogged);
      unsubscribeBookings();
      supabase.removeChannel(systemChannel);
      clearInterval(syncInterval);
    };
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
      const nextTheme = prev === 'light' ? 'dark' : 'light';
      addToast({
        type: 'info',
        title: nextTheme === 'dark' ? 'تم تفعيل الوضع الليلي 🌙' : 'تم تفعيل الوضع النهاري ☀️',
        message: nextTheme === 'dark' 
          ? 'تم تقليل إجهاد العين لراحة الكادر أثناء المناوبات الليلية.' 
          : 'تم تفعيل وضع الإضاءة النهاري عالي الوضوح.'
      });
      return nextTheme;
    });
  };

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // التحكم بالمسارات مع تطبيق صارم لقواعد الأمان وصلاحيات الأدوار (RBAC)
  const navigate = (view: AppView, ticketId?: string) => {
    if (ticketId) {
      const found = bookings.find(b => b.id === ticketId || b.ticketNumber === ticketId);
      if (found) {
        setSelectedTicket(found);
      }
    }

    // منع الطبيب من الانتقال لشاشة حجز المرضى وتوجيهه لبوابة الطبيب الخاصة به
    if (view === 'booking' && currentUser?.role === 'doctor') {
      addToast({
        type: 'info',
        title: 'بوابة الطبيب المخصصة',
        message: 'حساب الطبيب مخصص لإدارة التواجد اليومي والجدول الأسبوعي فقط.'
      });
      setActiveView('doctor');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // الشاشات العامة: الهبوط، الحجز بدون تسجيل، وعرض التذكرة، شاشة الانتظار العامة، وصفحة تسجيل الدخول
    if (view === 'landing' || view === 'booking' || view === 'ticket' || view === 'queue' || view === 'login') {
      setActiveView(view);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // التحقق من الجلسة للشاشات الإدارية والموظفين
    if (!currentUser) {
      addToast({
        type: 'warning',
        title: 'تسجيل الدخول مطلوب',
        message: 'يرجى تسجيل الدخول بحساب الكادر الطبي أو الإداري للوصول لهذه الصفحة.'
      });
      setActiveView('login');
      return;
    }

    // فحص صلاحيات كل دور (Least Privilege Enforcement)
    if (view === 'admin' && currentUser.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'وصول غير مصرح به',
        message: 'عفواً، هذه الواجهة مخصصة لإدارة النظام فقط.'
      });
      return;
    }

    if (view === 'doctor' && currentUser.role !== 'doctor' && currentUser.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'وصول غير مصرح به',
        message: 'هذه الواجهة مخصصة للأطباء فقط.'
      });
      return;
    }

    if (view === 'reception' && currentUser.role !== 'reception' && currentUser.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'وصول غير مصرح به',
        message: 'هذه الواجهة مخصصة لمسؤولي الاستقبال.'
      });
      return;
    }

    if (view === 'cashier' && currentUser.role !== 'cashier' && currentUser.role !== 'admin' && currentUser.role !== 'finance_manager') {
      addToast({
        type: 'error',
        title: 'وصول غير مصرح به',
        message: 'هذه الواجهة مخصصة لقسم الخزينة والصندوق.'
      });
      return;
    }

    if (view === 'finance' && currentUser.role !== 'finance_manager' && currentUser.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'وصول غير مصرح به',
        message: 'هذه الواجهة مخصصة لمدير المالية والإدارة العليا فقط.'
      });
      return;
    }

    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const login = async (username: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const cleanUser = sanitizeText(username).toLowerCase().trim();
    
    if (!cleanUser || !pass) {
      const err = 'يرجى إدخال اسم المستخدم وكلمة المرور.';
      addToast({ type: 'error', title: 'بيانات ناقصة', message: err });
      return { success: false, error: err };
    }

    // 1. فحص حماية القوة العمياء والحد الأقصى للمحاولات (Brute Force Protection)
    const rateCheck = checkLoginRateLimit(cleanUser);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil((rateCheck.remainingSeconds || 60) / 60);
      const lockMsg = `تم حظر المحاولات مؤقتاً لهذا الحساب لحمايته من التخمين المتكرر. يرجى الانتظار ${minutes} دقيقة والمحاولة لاحقاً.`;
      addToast({
        type: 'error',
        title: 'الحساب مغلق مؤقتاً',
        message: lockMsg
      });
      return { success: false, error: lockMsg };
    }

    // التحقق المباشر عبر Supabase Auth عند توفر الإعدادات
    let rejectedByCloudAuth = false;
    if (isSupabaseConfigured) {
      const authRes = await loginWithSupabaseAuth(cleanUser, pass);
      if (authRes.success && authRes.session) {
        resetLoginAttempts(cleanUser);
        setCurrentUser(authRes.session);
        saveSession(authRes.session);

        // جلب البيانات الخاصة بصلاحية الموظف فور تسجيل الدخول دون انتظار دورة المزامنة
        if (authRes.session.role !== 'doctor') {
          fetchBookingsFromDb().then(freshB => {
            if (freshB) {
              setBookings(freshB);
              saveBookings(freshB);
            }
          }).catch(() => {});
        }
        if (authRes.session.role === 'admin' || authRes.session.role === 'finance_manager') {
          fetchStaffAccountsFromDb().then(freshS => {
            if (freshS && freshS.length > 0) {
              setStaffAccounts(freshS);
              saveStaffAccounts(freshS);
            }
          }).catch(() => {});
        }

        addToast({
          type: 'success',
          title: 'تم تسجيل الدخول بنجاح',
          message: `مرحباً بك مجدداً ${authRes.session.displayName}`
        });

        switch (authRes.session.role) {
          case 'admin':
            setActiveView('admin');
            break;
          case 'finance_manager':
            setActiveView('finance');
            break;
          case 'doctor':
            setActiveView('doctor');
            break;
          case 'reception':
            setActiveView('reception');
            break;
          case 'cashier':
            setActiveView('cashier');
            break;
          default:
            setActiveView('landing');
        }
        return { success: true };
      }
      if (authRes.authoritativeReject) {
        rejectedByCloudAuth = true;
      }
    }

    let authSuccess = false;
    let matchedUser: UserSession | null = null;

    // مطابقة الحسابات المشفرة (SHA-256 Hash Verification) في وضع Offline أو للسجل السحابي الموحد
    const matchedAccount = staffAccounts.find(
      acc => acc.username.toLowerCase() === cleanUser
    );

    if (matchedAccount) {
      const storedHashes = getStoredStaffPasswordHashes();
      const providedHash = await hashPassword(pass);
      const expectedHash = storedHashes[matchedAccount.username.toLowerCase()];

      if (expectedHash && providedHash === expectedHash) {
        const effectiveRole: UserRole =
          cleanUser === 'finance' || matchedAccount.role === 'finance_manager'
            ? 'finance_manager'
            : matchedAccount.role;
        authSuccess = true;
        matchedUser = {
          id: matchedAccount.id,
          username: matchedAccount.username,
          displayName: matchedAccount.displayName,
          role: effectiveRole,
          doctorId: matchedAccount.doctorId,
          clinicId: matchedAccount.clinicId,
        };
        if (isSupabaseConfigured) {
          saveSession(matchedUser);
          ensureActiveSupabaseSession(true).then(() => {
            fetchBookingsFromDb().then(freshB => {
              if (freshB) {
                setBookings(freshB);
                saveBookings(freshB);
              }
            }).catch(() => {});
          }).catch(() => {});
        }
      }
    }

    // فحص نجاح تسجيل الدخول
    if (authSuccess && matchedUser) {
      resetLoginAttempts(cleanUser);
      setCurrentUser(matchedUser);
      saveSession(matchedUser);
      addToast({
        type: 'success',
        title: 'تم تسجيل الدخول بنجاح',
        message: `مرحباً بك مجدداً ${matchedUser.displayName}`
      });

      // التوجيه التلقائي المباشر حسب الصلاحية الموحدة
      switch (matchedUser.role) {
        case 'admin':
          setActiveView('admin');
          break;
        case 'finance_manager':
          setActiveView('finance');
          break;
        case 'doctor':
          setActiveView('doctor');
          break;
        case 'reception':
          setActiveView('reception');
          break;
        case 'cashier':
          setActiveView('cashier');
          break;
        default:
          setActiveView('landing');
      }
      return { success: true };
    } else {
      // تسجيل المحاولة الفاشلة وتطبيق الحظر العام المشترك (Generic Error Message)
      const record = recordFailedLogin(cleanUser);
      let genericError = 'اسم المستخدم أو كلمة المرور غير صحيحة. يرجى التأكد من البيانات.';
      
      if (record.locked) {
        genericError = `تم قفل الحساب مؤقتاً لمدة ${record.lockUntilMinutes} دقيقة بسبب تجاوز الحد المسموح من المحاولات الخاطئة (5 محاولات).`;
      } else {
        const remaining = 5 - (record.attempts % 5);
        if (remaining <= 2) {
          genericError += ` (تنبيه أمان: متبقي ${remaining} محاولة قبل إغلاق الحساب مؤقتاً)`;
        }
      }

      addToast({
        type: 'error',
        title: 'فشل تسجيل الدخول',
        message: genericError
      });
      return { success: false, error: genericError };
    }
  };

  const createStaffAccount = async (input: {
    username: string;
    password: string;
    displayName: string;
    role: UserRole;
    doctorId?: string | null;
    clinicId?: string | null;
    recoveryEmail?: string;
  }): Promise<boolean> => {
    if (currentUser?.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'إنشاء حسابات الموظفين مخصص لمدير النظام فقط.'
      });
      return false;
    }
    const cleanUsername = input.username.trim().toLowerCase();
    const cleanDisplayName = sanitizeText(input.displayName);
    const cleanEmail = input.recoveryEmail ? input.recoveryEmail.trim().toLowerCase() : undefined;
    const allowedRoles: UserRole[] = ['admin', 'doctor', 'reception', 'cashier', 'finance_manager'];

    if (!/^[a-z0-9_.-]{3,30}$/.test(cleanUsername)) {
      addToast({
        type: 'error',
        title: 'اسم مستخدم غير صالح',
        message: 'يجب أن يتكون اسم المستخدم من 3 إلى 30 حرفاً إنجليزياً أو أرقاماً أو (._-) بدون مسافات.'
      });
      return false;
    }

    if (!input.password || input.password.length < 6) {
      addToast({
        type: 'error',
        title: 'كلمة مرور ضعيفة',
        message: 'يجب ألا تقل كلمة المرور عن 6 أحرف أو أرقام.'
      });
      return false;
    }

    if (!cleanDisplayName || cleanDisplayName.length < 2) {
      addToast({
        type: 'error',
        title: 'الاسم الظاهر مطلوب',
        message: 'يرجى إدخال الاسم الظاهر للموظف.'
      });
      return false;
    }

    if (!allowedRoles.includes(input.role)) {
      addToast({
        type: 'error',
        title: 'دور وظيفي غير صالح',
        message: 'الأدوار المسموحة فقط هي: admin, finance_manager, doctor, reception, cashier.'
      });
      return false;
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      addToast({
        type: 'error',
        title: 'بريد إلكتروني غير صالح',
        message: 'يرجى إدخال بريد إلكتروني صحيح للاستعادة.'
      });
      return false;
    }

    if (staffAccounts.some(acc => acc.username.toLowerCase() === cleanUsername)) {
      addToast({
        type: 'error',
        title: 'اسم المستخدم مكرر',
        message: `اسم المستخدم (${cleanUsername}) مسجل بالفعل لموظف آخر.`
      });
      return false;
    }

    let finalDoctorId: string | undefined = undefined;
    let finalClinicId: string | undefined = undefined;

    if (input.role === 'doctor') {
      if (!input.doctorId) {
        addToast({
          type: 'error',
          title: 'تحديد الطبيب مطلوب',
          message: 'يرجى اختيار الطبيب المرتبط بهذا الحساب من قائمة الأطباء.'
        });
        return false;
      }
      const matchedDoc = doctors.find(d => d.id === input.doctorId);
      if (!matchedDoc) {
        addToast({
          type: 'error',
          title: 'الطبيب غير موجود',
          message: 'الطبيب المختار غير موجود في قائمة الأطباء.'
        });
        return false;
      }
      finalDoctorId = matchedDoc.id;
      finalClinicId = input.clinicId || matchedDoc.clinicId || undefined;
    } else if (input.role === 'reception') {
      const cleanReqClinicId = input.clinicId ? input.clinicId.trim() : '';
      if (cleanReqClinicId) {
        const matchedClinic = clinics.find(c => c.id === cleanReqClinicId);
        if (matchedClinic) {
          finalClinicId = matchedClinic.id;
        }
      }
    }

    if (isSupabaseConfigured) {
      const apiRes = await createStaffAccountInDb({
        username: cleanUsername,
        password: input.password,
        displayName: cleanDisplayName,
        role: input.role,
        doctorId: finalDoctorId || null,
        clinicId: finalClinicId || null,
        recoveryEmail: cleanEmail
      });

      if (!apiRes.success || !apiRes.staff) {
        addToast({
          type: 'error',
          title: 'تعذر إنشاء الحساب',
          message: apiRes.error || 'فشل إنشاء حساب الموظف في الخادم.'
        });
        return false;
      }

      const passHash = await hashPassword(input.password);
      saveStaffPasswordHash(cleanUsername, passHash);
      resetLoginAttempts(cleanUsername);

      const updatedAccounts = [...staffAccounts.filter(a => a.id !== apiRes.staff!.id), apiRes.staff];
      setStaffAccounts(updatedAccounts);
      saveStaffAccounts(updatedAccounts);

      addToast({
        type: 'success',
        title: 'تم إنشاء حساب الموظف بنجاح',
        message: `تم إنشاء حساب (${apiRes.staff.displayName} - @${apiRes.staff.username}) وربطه بالمصادقة السحابية.`
      });
      return true;
    }

    // Offline / Local fallback
    const passHash = await hashPassword(input.password);
    saveStaffPasswordHash(cleanUsername, passHash);
    resetLoginAttempts(cleanUsername);

    const newStaff: StaffAccount = {
      id: `staff-${cleanUsername.replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-6)}`,
      username: cleanUsername,
      displayName: cleanDisplayName,
      role: input.role,
      doctorId: finalDoctorId,
      clinicId: finalClinicId,
      recoveryEmail: cleanEmail
    };

    const updatedAccounts = [...staffAccounts, newStaff];
    setStaffAccounts(updatedAccounts);
    saveStaffAccounts(updatedAccounts);

    addToast({
      type: 'success',
      title: 'تم إنشاء حساب الموظف',
      message: `تم إضافة حساب (${newStaff.displayName}) بنجاح.`
    });
    return true;
  };

  const deleteStaffAccount = async (id: string): Promise<boolean> => {
    if (currentUser?.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'حذف حسابات الموظفين مخصص لمدير النظام فقط.'
      });
      return false;
    }
    const target = staffAccounts.find(a => a.id === id);
    if (!target) {
      addToast({
        type: 'error',
        title: 'تعذر الحذف',
        message: 'حساب الموظف غير موجود.'
      });
      return false;
    }

    if (
      currentUser &&
      (target.id === currentUser.id || target.username.toLowerCase() === currentUser.username.toLowerCase())
    ) {
      addToast({
        type: 'error',
        title: 'عملية غير مسموحة',
        message: 'لا يمكنك حذف حسابك الشخصي المسجل به حالياً.'
      });
      return false;
    }

    if (target.role === 'admin') {
      if (target.username.toLowerCase() === 'admin') {
        addToast({
          type: 'error',
          title: 'حساب محمي',
          message: 'لا يمكن حذف حساب المدير الرئيسي للمنظومة (admin).'
        });
        return false;
      }
      const adminCount = staffAccounts.filter(a => a.role === 'admin').length;
      if (adminCount <= 1) {
        addToast({
          type: 'error',
          title: 'تعذر الحذف',
          message: 'لا يمكن حذف آخر حساب مدير متبقٍ في المنظومة لضمان استمرارية الإدارة.'
        });
        return false;
      }
    }

    if (isSupabaseConfigured) {
      const cloudRes = await deleteStaffAccountRpc(id);
      if (!cloudRes.success) {
        addToast({
          type: 'error',
          title: 'تعذر الحذف',
          message: cloudRes.error || 'فشلت عملية حذف الحساب من الخادم.'
        });
        return false;
      }
    }

    const res = deleteStaffAccountById(id);
    if (!res.success) {
      addToast({
        type: 'error',
        title: 'تعذر الحذف',
        message: res.error || 'فشلت عملية حذف الحساب.'
      });
      return false;
    }
    setStaffAccounts(res.remainingAccounts);
    addToast({
      type: 'success',
      title: 'تم الحذف بنجاح',
      message: `تمت إزالة حساب (${target.displayName}) نهائياً من منظومة الموظفين والمصادقة.`
    });
    return true;
  };

  const updateStaffRecoveryEmail = (id: string, email: string) => {
    if (currentUser?.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'تعديل بريد استعادة الحسابات مخصص لمدير النظام فقط.'
      });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (isSupabaseConfigured) {
      updateStaffAccountInDb(id, { recoveryEmail: cleanEmail }).then((res) => {
        if (!res.success) {
          addToast({
            type: 'error',
            title: 'تعذر تحديث البريد الإلكتروني',
            message: res.error || 'فشل الاتصال بالخادم لتحديث بريد الاستعادة.'
          });
          return;
        }
        const updated = updateStaffAccountRecoveryEmail(id, cleanEmail);
        setStaffAccounts(updated);
        addToast({
          type: 'success',
          title: 'تم حفظ البريد الإلكتروني',
          message: 'تم تحديث بريد استعادة الحساب عبر الخادم بنجاح.'
        });
      });
      return;
    }

    const updated = updateStaffAccountRecoveryEmail(id, cleanEmail);
    setStaffAccounts(updated);
    addToast({
      type: 'success',
      title: 'تم حفظ البريد الإلكتروني',
      message: 'تم تحديث بريد استعادة الحساب بنجاح.'
    });
  };

  const updateStaffAccount = async (
    id: string,
    updates: {
      username?: string;
      displayName?: string;
      role?: UserRole;
      doctorId?: string | null;
      clinicId?: string | null;
      recoveryEmail?: string;
      password?: string;
    }
  ): Promise<boolean> => {
    if (currentUser?.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'تعديل بيانات الموظفين مخصص لمدير النظام فقط.'
      });
      return false;
    }
    const target = staffAccounts.find(s => s.id === id);
    if (!target) return false;

    let cleanUsername = target.username;
    if (updates.username) {
      const sanitized = updates.username.trim().toLowerCase();
      if (!/^[a-z0-9_.-]{3,30}$/.test(sanitized)) {
        addToast({
          type: 'error',
          title: 'اسم مستخدم غير صالح',
          message: 'يجب أن يتكون اسم المستخدم من 3 إلى 30 حرفاً إنجليزياً أو أرقام بدون مسافات.'
        });
        return false;
      }
      if (
        sanitized !== target.username.toLowerCase() &&
        staffAccounts.some(s => s.id !== id && s.username.toLowerCase() === sanitized)
      ) {
        addToast({
          type: 'error',
          title: 'اسم المستخدم مكرر',
          message: 'اسم المستخدم الجديد مسجل بالفعل لموظف آخر.'
        });
        return false;
      }
      cleanUsername = sanitized;
    }

    const effectiveRole: UserRole = updates.role || target.role;
    let effectiveDoctorId: string | undefined =
      effectiveRole === 'doctor'
        ? (updates.doctorId !== undefined ? (updates.doctorId || undefined) : target.doctorId)
        : undefined;
    let effectiveClinicId: string | undefined =
      effectiveRole === 'doctor' || effectiveRole === 'reception'
        ? (updates.clinicId !== undefined ? (updates.clinicId || undefined) : target.clinicId)
        : undefined;

    if (effectiveRole === 'doctor') {
      if (!effectiveDoctorId) {
        addToast({
          type: 'error',
          title: 'تحديد الطبيب مطلوب',
          message: 'يرجى اختيار الطبيب المرتبط بالحساب عند تحديد دور طبيب (doctor).'
        });
        return false;
      }
      const docObj = doctors.find(d => d.id === effectiveDoctorId);
      if (docObj && !effectiveClinicId) {
        effectiveClinicId = docObj.clinicId;
      }
    }

    if (updates.password && updates.password.length < 6) {
      addToast({
        type: 'error',
        title: 'كلمة مرور ضعيفة',
        message: 'يجب ألا تقل كلمة المرور عن 6 أحرف/أرقام.'
      });
      return false;
    }

    let dbUpdated = false;
    let returnedStaff: StaffAccount | undefined = undefined;

    if (isSupabaseConfigured) {
      const dbRes = await updateStaffAccountInDb(id, {
        username: updates.username ? cleanUsername : undefined,
        displayName: updates.displayName,
        role: effectiveRole,
        doctorId: effectiveRole === 'doctor' ? (effectiveDoctorId || null) : null,
        clinicId:
          effectiveRole === 'doctor' || effectiveRole === 'reception'
            ? (effectiveClinicId || null)
            : null,
        recoveryEmail: updates.recoveryEmail,
        password: updates.password
      });
      if (!dbRes.success) {
        addToast({
          type: 'error',
          title: 'تعذر تحديث الحساب',
          message: dbRes.error || 'حدث خطأ أثناء تحديث بيانات الموظف.'
        });
        return false;
      }
      dbUpdated = true;
      returnedStaff = dbRes.staff;
    }

    // إذا تغير اسم المستخدم ولم تُقدم كلمة مرور جديدة، ننقل التجزئة الحالية إلى الاسم الجديد محلياً
    if (cleanUsername !== target.username.toLowerCase()) {
      const hashes = getStoredStaffPasswordHashes();
      const existingHash = hashes[target.username.toLowerCase()];
      if (existingHash) {
        hashes[cleanUsername] = existingHash;
        saveStaffPasswordHash(cleanUsername, existingHash);
      }
    }

    if (updates.password) {
      const hash = await hashPassword(updates.password);
      saveStaffPasswordHash(cleanUsername, hash);
      resetLoginAttempts(cleanUsername);
    }

    const updatedList = staffAccounts.map(s => {
      if (s.id === id) {
        if (returnedStaff) {
          return returnedStaff;
        }
        return {
          ...s,
          username: cleanUsername,
          displayName: updates.displayName || s.displayName,
          role: effectiveRole,
          doctorId: effectiveDoctorId,
          clinicId: effectiveClinicId,
          recoveryEmail: updates.recoveryEmail !== undefined ? updates.recoveryEmail : s.recoveryEmail
        };
      }
      return s;
    });

    setStaffAccounts(updatedList);
    saveStaffAccounts(updatedList);

    if (
      currentUser &&
      (currentUser.id === id || currentUser.username.toLowerCase() === cleanUsername)
    ) {
      const matchedSelf = updatedList.find(s => s.id === id);
      if (matchedSelf) {
        const updatedSelfSession: UserSession = {
          ...currentUser,
          username: matchedSelf.username,
          displayName: matchedSelf.displayName,
          role: matchedSelf.role,
          doctorId: matchedSelf.doctorId,
          clinicId: matchedSelf.clinicId
        };
        setCurrentUser(updatedSelfSession);
        saveSession(updatedSelfSession);
      }
    }

    addToast({
      type: 'success',
      title: 'تم تحديث بيانات الحساب',
      message: dbUpdated
        ? `تم حفظ وتحديث بيانات حساب (${cleanUsername}) في قاعدة البيانات بنجاح.`
        : `تم حفظ تعديلات حساب (${cleanUsername}) بنجاح.`
    });
    return true;
  };

  const resetPasswordByAdmin = async (targetUser: string, newPass: string): Promise<boolean> => {
    if (currentUser?.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'إعادة تعيين كلمات المرور مخصصة لمدير النظام فقط.'
      });
      return false;
    }
    try {
      const cleanUser = targetUser.toLowerCase().trim();
      if (!newPass || newPass.length < 6) {
        addToast({
          type: 'error',
          title: 'كلمة مرور ضعيفة',
          message: 'يجب ألا تقل كلمة المرور الجديدة عن 6 أحرف أو أرقام.'
        });
        return false;
      }

      if (isSupabaseConfigured) {
        const authRes = await adminChangeStaffPassword(cleanUser, newPass);
        if (!authRes.success) {
          addToast({
            type: 'error',
            title: 'تعذر تحديث كلمة المرور',
            message: authRes.error || 'حدث خطأ أثناء تحديث كلمة المرور في خدمة المصادقة.'
          });
          return false;
        }
      }

      const newHash = await hashPassword(newPass);
      saveStaffPasswordHash(cleanUser, newHash);
      resetLoginAttempts(cleanUser);

      addToast({
        type: 'success',
        title: 'تم تحديث كلمة المرور',
        message: `تم تعيين كلمة مرور جديدة وتحديثها في قاعدة البيانات لحساب (${cleanUser}) بنجاح.`
      });
      return true;
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'فشل التحديث',
        message: err?.message || 'حدث خطأ أثناء تشفير وحفظ كلمة المرور.'
      });
      return false;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    saveSession(null);
    setActiveView('landing');
    logoutFromSupabase().then(async () => {
      try {
        const [publicBookings, publicStaff] = await Promise.all([
          fetchBookingsFromDb(),
          fetchStaffAccountsFromDb()
        ]);
        if (publicBookings) {
          setBookings(publicBookings);
          saveBookings(publicBookings);
        }
        if (publicStaff && publicStaff.length > 0) {
          setStaffAccounts(publicStaff);
          saveStaffAccounts(publicStaff);
        }
      } catch {}
    });
    addToast({
      type: 'info',
      title: 'تسجيل الخروج',
      message: 'تم تسجيل خروجك بأمان من النظام.'
    });
  };

  // إنشاء حجز جديد للمريض وإصدار التذكرة
  const createBooking = async (data: {
    patientName: string;
    patientPhone: string;
    clinicId: string;
    doctorId: string;
    date: string;
    timeSlot: string;
    fee: number;
    notes?: string;
  }): Promise<{ success: boolean; booking?: Booking; error?: string }> => {
    const cleanName = sanitizeText(data.patientName);
    const cleanPhone = data.patientPhone.trim();
    const cleanNotes = sanitizeText(data.notes || '');

    // منع دور الطبيب من إنشاء حجوزات للمرضى
    if (currentUser?.role === 'doctor') {
      return { success: false, error: 'غير مصرح للطبيب بإنشاء حجوزات للمرضى.' };
    }

    // التحقق من أن اسم المريض ثلاثي على الأقل
    const nameCheck = validateTripleName(cleanName);
    if (!nameCheck.valid) {
      return { success: false, error: nameCheck.error || 'يجب كتابة اسم المريض ثلاثياً على الأقل.' };
    }

    // التحقق من صحة رقم الهاتف المصري
    const phoneCheck = validateEgyptianPhone(cleanPhone);
    if (!phoneCheck.valid) {
      return { success: false, error: phoneCheck.error || 'يرجى إدخال رقم هاتف محمول صحيح.' };
    }

    const clinic = clinics.find(c => c.id === data.clinicId);
    const doctor = doctors.find(d => d.id === data.doctorId);

    if (!clinic || !doctor) {
      return { success: false, error: 'العيادة أو الطبيب غير متوفرين حالياً' };
    }

    if (doctor.clinicId !== clinic.id) {
      return { success: false, error: 'الطبيب المحدد لا يتبع العيادة المختارة.' };
    }

    // التحقق الصارم من الركائز الأربعة على مستوى النظام وقواعد العمل (Backend/System Logic Level):
    // 1. حالة التواجد اليومية (متاح / غير متاح)
    // 2. جدول العمل الأسبوعي (أيام العمل)
    // 3. انتهاء وقت العيادة الحقيقي
    // 4. اكتمال العدد الأقصى للحجوزات
    const todayStr = getLocalDateStr();
    const bookingDate = data.date || todayStr;

    // حظر الحجز المسبق للأيام المستقبلية أو الماضية قطيعاً
    if (bookingDate > todayStr) {
      return {
        success: false,
        error: 'عذراً، الحجز متاح فقط لليوم الحالي. جدول حضور الطبيب ظاهر للاطلاع، ويُفتح الحجز للأيام القادمة تلقائياً في صباح يوم الكشف.'
      };
    }
    if (bookingDate < todayStr) {
      return {
        success: false,
        error: 'لا يمكن تسجيل حجز بتاريخ سابق.'
      };
    }

    // فحص أن العيادة مفتوحة اليوم
    const schedItem = dailySchedule.items.find(i => i.clinicId === clinic.id);
    const isDailyOpen = schedItem ? schedItem.isOpen : (clinic.isOpenToday !== false);
    if (clinic.active === false || clinic.isActive === false || !isDailyOpen) {
      return {
        success: false,
        error: 'عذراً، هذه العيادة مغلقة اليوم ولا تستقبل حجوزات جديدة.'
      };
    }

    const availabilityCheck = checkClinicAvailability(doctor, clinic.id, bookingDate, bookings);

    if (!availabilityCheck.allowed) {
      return {
        success: false,
        error: availabilityCheck.reason || 'العيادة غير متاحة للحجز حالياً.'
      };
    }

    // فحص الحد المسموح ومنع تكرار الحجز أو تضارب المواعيد
    const rateCheck = checkBookingRateLimit(cleanName, cleanPhone, data.clinicId, bookingDate, data.timeSlot, bookings);
    if (!rateCheck.allowed) {
      return { success: false, error: rateCheck.reason };
    }

    // إذا كان اتصال Supabase مفعلاً، يتم الحجز واستخراج التذكرة بشكل ذري عبر دالة RPC المعتمدة
    if (isSupabaseConfigured) {
      const rpcRes = await createPublicBookingRpc({
        clinicId: data.clinicId,
        doctorId: data.doctorId,
        patientName: cleanName,
        patientPhone: cleanPhone,
        timeSlot: data.timeSlot,
        notes: cleanNotes
      });

      if (rpcRes.success && rpcRes.data) {
        const newBooking = rpcRes.data;
        setBookings(prev => {
          const updated = [newBooking, ...prev.filter(b => b.id !== newBooking.id)];
          saveBookings(updated);
          return updated;
        });
        setSelectedTicket(newBooking);

        addToast({
          type: 'success',
          title: 'تم إصدار التذكرة بنجاح',
          message: `رقم تذكرتك: ${newBooking.ticketNumber} - دورك رقم ${newBooking.queuePosition}`
        });

        return { success: true, booking: newBooking };
      } else {
        const errorMsg = rpcRes.error || 'حدث خطأ أثناء حجز التذكرة.';
        addToast({
          type: 'error',
          title: 'تعذر الحجز',
          message: errorMsg
        });
        return { success: false, error: errorMsg };
      }
    }

    // حساب رقم الدور التالي في نفس العيادة ونفس اليوم بشكل متسلسل لا يتكرر حتى لو أُلغيت تذكرة سابقة
    const maxQueuePosToday = bookings
      .filter(b => b.clinicId === data.clinicId && b.date === bookingDate)
      .reduce((max, b) => Math.max(max, b.queuePosition || 0), 0);
    const nextQueuePos = maxQueuePosToday + 1;

    // توليد رمز تذكرة فريد وسهل النطق باللغة العربية
    const clinicPrefix = clinic.name.split(' ')[1] || 'كشف';
    const ticketNumber = `${clinicPrefix}-${nextQueuePos.toString().padStart(2, '0')}`;

    const newBooking: Booking = {
      id: `book-${Date.now()}`,
      ticketNumber,
      patientName: cleanName,
      patientPhone: cleanPhone,
      clinicId: data.clinicId,
      clinicName: clinic.name,
      doctorId: data.doctorId,
      doctorName: doctor.name,
      date: bookingDate,
      timeSlot: data.timeSlot,
      queuePosition: nextQueuePos,
      status: 'waiting',
      paymentStatus: 'unpaid',
      fee: clinic.fee,
      notes: cleanNotes,
      createdAt: new Date().toISOString()
    };

    setBookings(prev => {
      const updated = [newBooking, ...prev];
      saveBookings(updated);
      return updated;
    });
    setSelectedTicket(newBooking);

    addToast({
      type: 'success',
      title: 'تم إصدار التذكرة بنجاح',
      message: `رقم تذكرتك: ${ticketNumber} - دورك رقم ${nextQueuePos}`
    });

    return { success: true, booking: newBooking };
  };

  const updateBookingStatus = (bookingId: string, status: BookingStatus) => {
    if (
      !currentUser ||
      (currentUser.role !== 'reception' &&
        currentUser.role !== 'admin' &&
        !hasPermission(currentUser.role, 'call_queue_patients'))
    ) {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'إدارة طابور وحالات الحجز مخصصة لموظفي الاستقبال وإدارة النظام فقط.'
      });
      return;
    }

    const now = new Date().toISOString();
    lastMutationAtRef.current = Date.now();

    if (isSupabaseConfigured) {
      updateBookingStatusInDb(bookingId, {
        status,
        calledAt: status === 'in-progress' ? now : undefined,
        completedAt: status === 'completed' ? now : undefined
      }).then(() => {
        try {
          supabase.channel('system_updates').send({
            type: 'broadcast',
            event: 'bookings_updated',
            payload: { bookingId, status }
          });
        } catch {}
      });
    }

    const updated = bookings.map(b => {
      if (b.id === bookingId) {
        return {
          ...b,
          status,
          calledAt: status === 'in-progress' ? now : b.calledAt,
          completedAt: status === 'completed' ? now : b.completedAt
        };
      }
      return b;
    });

    setBookings(updated);
    saveBookings(updated);
    if (selectedTicket?.id === bookingId) {
      setSelectedTicket(updated.find(b => b.id === bookingId) || null);
    }
  };

  const updatePaymentStatus = (
    bookingId: string,
    paymentStatus: PaymentStatus,
    method: PaymentMethod = 'cash',
    insuranceDetails?: BookingInsuranceDetails
  ): boolean => {
    if (
      !currentUser ||
      (currentUser.role !== 'cashier' &&
        currentUser.role !== 'admin' &&
        currentUser.role !== 'finance_manager')
    ) {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'تأكيد عمليات السداد والخزينة مخصص لأمين الخزينة أو مدير النظام فقط.'
      });
      return false;
    }

    if (method === 'charity_exempt' && !hasPermission(currentUser.role, 'manage_patient_exemptions')) {
      addToast({
        type: 'error',
        title: 'غير مصرح بالإعفاء',
        message: 'ليست لديك صلاحية منح الإعفاءات الخيرية.'
      });
      return false;
    }

    const targetBooking = bookings.find(b => b.id === bookingId);
    const effectivePaymentStatus: PaymentStatus =
      method === 'consultation' || method === 'charity_exempt' ? 'exempt' : paymentStatus;

    lastMutationAtRef.current = Date.now();
    lastSettingsSaveAtRef.current = Date.now();

    // تحديث سجل الاستشارات المجانية ذاتي المسح (المستقل عن أرشيف الحجوزات)
    if (targetBooking) {
      const cleanPhone = String(targetBooking.patientPhone || '').replace(/\D/g, '');
      const todayStr = getLocalDateStr(new Date());
      const nowIso = new Date().toISOString();

      if (cleanPhone.length >= 10 && targetBooking.clinicId) {
        if (method === 'cash' || method === 'insurance') {
          // كشف جديد مدفوع: تسجيل بصمة استشارة مجانية صالحة لعدد الأيام المحدد
          const nextStamps = [
            ...consultationRegistry.stamps.filter(
              s => !(s.phone === cleanPhone && s.clinicId === targetBooking.clinicId)
            ),
            {
              phone: cleanPhone,
              patientName: targetBooking.patientName,
              clinicId: targetBooking.clinicId,
              examDate: targetBooking.date || todayStr,
              updatedAt: nowIso
            }
          ];
          const nextReg = saveConsultationRegistry(
            {
              ...consultationRegistry,
              stamps: nextStamps,
              consultationBookingIds: consultationRegistry.consultationBookingIds.filter(
                id => id !== bookingId
              )
            },
            todayStr
          );
          setConsultationRegistry(nextReg);
          if (isSupabaseConfigured) {
            saveConsultationRegistryToDb(nextReg);
          }
        } else if (method === 'consultation') {
          // دخول استشارة مجانية: حذف بصمة الاستشارة لهذا المريض في هذه العيادة فوراً وتلقائياً
          const nextStamps = consultationRegistry.stamps.filter(
            s => !(s.phone === cleanPhone && s.clinicId === targetBooking.clinicId)
          );
          const nextIds = Array.from(
            new Set([...consultationRegistry.consultationBookingIds, bookingId])
          );
          const nextReg = saveConsultationRegistry(
            {
              ...consultationRegistry,
              stamps: nextStamps,
              consultationBookingIds: nextIds
            },
            todayStr
          );
          setConsultationRegistry(nextReg);
          if (isSupabaseConfigured) {
            saveConsultationRegistryToDb(nextReg);
          }
        }
      }
    }

    if (isSupabaseConfigured) {
      confirmPaymentRpc(bookingId, method).then(res => {
        if (!res.success) {
          console.warn('Supabase confirmPayment error:', res.error);
        }
      });
    }

    const paidAtNow = new Date().toISOString();
    if (method === 'insurance' && insuranceDetails) {
      const insMap = getStoredInsuranceBookingsMap();
      insMap[bookingId] = insuranceDetails;
      saveInsuranceBookingsMap(insMap);
      if (isSupabaseConfigured) {
        saveInsuranceBookingsMapToDb(insMap).catch(() => {});
      }
    }

    setBookings(prev => {
      const updated = prev.map(b => {
        if (b.id === bookingId) {
          return {
            ...b,
            paymentStatus: effectivePaymentStatus,
            paymentMethod: method,
            fee: method === 'consultation' ? 0 : b.fee,
            paidAt: paidAtNow,
            insuranceDetails: method === 'insurance' ? (insuranceDetails || b.insuranceDetails) : undefined
          };
        }
        return b;
      });
      saveBookings(updated);
      if (selectedTicketRef.current?.id === bookingId) {
        const found = updated.find(b => b.id === bookingId) || null;
        if (found) setSelectedTicket(found);
      }
      return updated;
    });

    addToast({
      type: 'success',
      title:
        method === 'consultation'
          ? 'تم اعتماد الاستشارة المجانية'
          : 'تم تحديث حالة السداد',
      message:
        method === 'consultation'
          ? 'تم تسجيل دخول المريض كاستشارة مجانية (إعادة كشف) وحذف أحقية الاستشارة تلقائياً.'
          : effectivePaymentStatus === 'paid'
          ? 'تم تسجيل الدفع بالخزينة وإصدار إيصال السداد.'
          : 'تم تسجيل الإعفاء الخيري.'
    });
    return true;
  };

  const deleteBooking = async (bookingId: string): Promise<{ success: boolean; error?: string }> => {
    const canDeleteBooking =
      currentUser?.role === 'admin' ||
      currentUser?.role === 'cashier' ||
      currentUser?.role === 'reception' ||
      hasPermission(currentUser?.role, 'confirm_payments_exemptions') ||
      hasPermission(currentUser?.role, 'call_queue_patients');

    if (!currentUser || !canDeleteBooking) {
      const msg = 'عفواً، حذف حجز المريض مخصص لمسؤولي الخزينة أو الاستقبال أو مدير النظام فقط.';
      addToast({
        type: 'error',
        title: 'غير مصرح بالحذف',
        message: msg
      });
      return { success: false, error: msg };
    }

    const targetBooking = bookings.find(b => b.id === bookingId);
    const previousBookings = [...bookings];

    // 1. تحديث فوري في الواجهة والتخزين المحلي (Optimistic UI & Local Tombstone)
    markBookingDeletedLocally(bookingId);
    const updatedBookings = bookings.filter(b => b.id !== bookingId);
    setBookings(updatedBookings);
    saveBookings(updatedBookings);

    if (selectedTicketRef.current?.id === bookingId) {
      setSelectedTicket(null);
    }

    // 2. الحذف الفعلي من قاعدة البيانات السحابية Supabase
    if (isSupabaseConfigured) {
      const res = await deleteBookingFromDb(bookingId);
      if (!res.success) {
        unmarkBookingDeletedLocally(bookingId);
        setBookings(previousBookings);
        saveBookings(previousBookings);
        addToast({
          type: 'error',
          title: 'تعذر حذف الحجز من قاعدة البيانات',
          message: res.error || 'فشل حذف حجز المريض من قاعدة البيانات السحابية. يرجى المحاولة مرة أخرى.'
        });
        return { success: false, error: res.error };
      }

      const freshBookings = await fetchBookingsFromDb();
      if (freshBookings) {
        setBookings(freshBookings);
        saveBookings(freshBookings);
      }
    }

    addToast({
      type: 'success',
      title: 'تم حذف الحجز نهائياً',
      message: targetBooking
        ? `تم حذف حجز المريض "${targetBooking.patientName}" (تذكرة ${targetBooking.ticketNumber}) من الخزينة والطابور وقاعدة البيانات.`
        : 'تم حذف حجز المريض نهائياً من قاعدة البيانات.'
    });

    return { success: true };
  };

  const updateDoctorStatus = async (doctorId: string, status: DoctorStatus, reason?: string): Promise<boolean> => {
    const isOwnDoctorSession =
      currentUser?.role === 'doctor' &&
      (!currentUser.doctorId || currentUser.doctorId === doctorId);
    const canModifyAttendance =
      currentUser?.role === 'admin' ||
      isOwnDoctorSession ||
      hasPermission(currentUser?.role, 'manage_doctor_attendance');

    if (!currentUser || !canModifyAttendance) {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'تعديل حالة حضور الطبيب غير مصرح لهذا الحساب.'
      });
      return false;
    }

    if (isSupabaseConfigured) {
      const saved = await updateDoctorStatusInDb(doctorId, status, reason);
      if (!saved) {
        addToast({
          type: 'error',
          title: 'تعذر تحديث حالة الطبيب',
          message: 'فشل حفظ حالة التواجد اليومي للطبيب في قاعدة البيانات. يرجى التحقق من الاتصال أو الصلاحيات والمحاولة مرة أخرى.'
        });
        return false;
      }
    }

    const updated = doctors.map(d => {
      if (d.id === doctorId) {
        return {
          ...d,
          status,
          unavailableReason: status === 'available' ? undefined : (reason || d.unavailableReason || 'عذر طارئ')
        };
      }
      return d;
    });
    setDoctors(updated);
    saveDoctors(updated);

    if (isSupabaseConfigured) {
      try {
        const channel = supabase.channel('system_updates');
        channel.send({
          type: 'broadcast',
          event: 'doctors_updated',
          payload: { doctorId, status, unavailableReason: reason }
        });
      } catch {
        // ignore
      }
    }

    const statusNames: Record<DoctorStatus, string> = {
      available: 'متاح للعمل ويستقبل الحالات',
      break: 'في استراحة مؤقتة',
      busy: 'داخل كشف طبي',
      offline: 'غير متاح للعمل اليوم'
    };

    addToast({
      type: status === 'offline' ? 'warning' : 'success',
      title: 'حالة التواجد اليومي',
      message: status === 'offline'
        ? `تم تسجيل الطبيب: غير متاح (${reason || 'عذر طارئ'}) — تم حجب العيادة تلقائياً من شاشة حجز المرضى.`
        : `أصبحت حالة الطبيب الآن: ${statusNames[status]}`
    });
    return true;
  };

  const updateDoctorSchedule = async (
    doctorId: string, 
    scheduleDays: string[], 
    scheduleHours: string,
    shiftStartTime?: string,
    shiftEndTime?: string
  ): Promise<boolean> => {
    const isOwnDoctorSession =
      currentUser?.role === 'doctor' &&
      (!currentUser.doctorId || currentUser.doctorId === doctorId);
    const canModifySchedule =
      currentUser?.role === 'admin' ||
      isOwnDoctorSession ||
      hasPermission(currentUser?.role, 'manage_doctor_attendance');

    if (!currentUser || !canModifySchedule) {
      addToast({
        type: 'error',
        title: 'غير مصرح بالتعديل',
        message: 'لا يمتلك حسابك صلاحية تعديل الجدول الأسبوعي للطبيب.'
      });
      return false;
    }

    const shift = parseDoctorShiftTimes({ 
      scheduleHours, 
      shiftStartTime, 
      shiftEndTime 
    });
    const finalStartTime = shiftStartTime || shift.startTime;
    const finalEndTime = shiftEndTime || shift.endTime;

    activeMutationsCountRef.current += 1;
    lastMutationAtRef.current = Date.now();

    try {
      let targetClinicId = '';
      setDoctors(prev => {
        const updated = prev.map(d => {
          if (d.id === doctorId) {
            targetClinicId = d.clinicId;
            return { 
              ...d, 
              scheduleDays, 
              scheduleHours,
              shiftStartTime: finalStartTime,
              shiftEndTime: finalEndTime
            };
          }
          return d;
        });
        saveDoctors(updated);
        return updated;
      });

      if (isSupabaseConfigured) {
        const saved = await updateDoctorInDb(doctorId, {
          scheduleDays,
          scheduleHours
        });
        lastMutationAtRef.current = Date.now();

        if (!saved) {
          addToast({
            type: 'error',
            title: 'تعذر حفظ الجدول الأسبوعي',
            message: 'فشل حفظ وتثبيت جدول الطبيب في قاعدة البيانات. يرجى التحقق من الاتصال أو الصلاحيات والمحاولة مرة أخرى.'
          });
          return false;
        }
      }

      // مزامنة جدول تشغيل عيادات اليوم تلقائياً إذا كان الطبيب مسؤولاً عن عيادة اليوم
      const targetDoc = doctors.find(d => d.id === doctorId);
      const effectiveClinicId = targetClinicId || targetDoc?.clinicId || '';
      if (effectiveClinicId) {
        const updatedDocObj: Doctor = {
          ...(targetDoc || ({ id: doctorId, name: '', clinicId: effectiveClinicId, clinicName: '', title: '', status: 'available', maxDailyBookings: 30, currentQueueNumber: 0 } as Doctor)),
          scheduleDays,
          scheduleHours,
          shiftStartTime: finalStartTime,
          shiftEndTime: finalEndTime
        };
        const todayStr = getLocalDateStr(new Date());
        const isScheduledToday = isDoctorScheduledOnDate(updatedDocObj, todayStr);
        const isDocPresent = updatedDocObj.status !== 'offline';
        const shouldClinicBeOpenToday = isScheduledToday && isDocPresent;

        const existingItem = dailySchedule.items.find(i => i.clinicId === effectiveClinicId);
        if (!existingItem || existingItem.doctorId === doctorId || !existingItem.doctorId) {
          const nextItems = existingItem
            ? dailySchedule.items.map(i =>
                i.clinicId === effectiveClinicId
                  ? { ...i, doctorId, isOpen: shouldClinicBeOpenToday }
                  : i
              )
            : [
                ...dailySchedule.items,
                { clinicId: effectiveClinicId, doctorId, isOpen: shouldClinicBeOpenToday }
              ];
          const nextSchedule: DailyScheduleState = {
            date: dailySchedule.date || todayStr,
            items: nextItems
          };
          setDailySchedule(nextSchedule);
          saveDailySchedule(nextSchedule);

          setClinics(prev => {
            const nextClinics = prev.map(c =>
              c.id === effectiveClinicId
                ? {
                    ...c,
                    isOpenToday: shouldClinicBeOpenToday,
                    active: shouldClinicBeOpenToday,
                    isActive: shouldClinicBeOpenToday,
                    workingDays: scheduleDays,
                    workingHours: scheduleHours
                  }
                : c
            );
            saveClinics(nextClinics);
            return nextClinics;
          });

          if (isSupabaseConfigured) {
            await saveDailyScheduleToDb(nextSchedule);
            await updateClinicInDb(effectiveClinicId, {
              isOpenToday: shouldClinicBeOpenToday,
              active: shouldClinicBeOpenToday,
              isActive: shouldClinicBeOpenToday,
              workingDays: scheduleDays,
              workingHours: scheduleHours
            });
            lastMutationAtRef.current = Date.now();
          }
        }
      }

      if (isSupabaseConfigured) {
        try {
          const channel = supabase.channel('system_updates');
          channel.send({
            type: 'broadcast',
            event: 'doctors_updated',
            payload: { doctorId, scheduleDays, scheduleHours }
          });
          channel.send({
            type: 'broadcast',
            event: 'schedule_updated',
            payload: { doctorId }
          });
        } catch {
          // ignore
        }
      }

      addToast({
        type: 'success',
        title: 'الجدول الأسبوعي للطبيب',
        message: 'تم حفظ وتثبيت جدول الطبيب ومواعيد العمل في قاعدة البيانات وتعميمها على جميع الأجهزة.'
      });
      return true;
    } finally {
      lastMutationAtRef.current = Date.now();
      activeMutationsCountRef.current = Math.max(0, activeMutationsCountRef.current - 1);
    }
  };

  const updateDoctorMaxBookings = (doctorId: string, maxDailyBookings: number) => {
    if (currentUser?.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'تعديل الحد الأقصى للحالات اليومية مخصص لمدير النظام فقط.'
      });
      return;
    }
    const updated = doctors.map(d => {
      if (d.id === doctorId) {
        return { ...d, maxDailyBookings };
      }
      return d;
    });
    setDoctors(updated);
    saveDoctors(updated);

    if (isSupabaseConfigured) {
      updateDoctorMaxPatientsInDb(doctorId, maxDailyBookings);
      try {
        const channel = supabase.channel('system_updates');
        channel.send({
          type: 'broadcast',
          event: 'doctors_updated',
          payload: { doctorId, maxDailyBookings }
        });
      } catch {
        // ignore
      }
    }

    addToast({
      type: 'success',
      title: 'تم تحديث السعة القصوى',
      message: `تم حفظ وتحديد الحد الأقصى للحالات اليومية للطبيب بـ ${maxDailyBookings} حالة في قاعدة البيانات.`
    });
  };

  // منطق تخطي الدور وتحويل المرضى المتغيبين إلى "متأخر" تلقائياً مع إنهاء الكشف الجاري بنفس العيادة
  const admitPatient = (targetBookingId: string) => {
    if (
      !currentUser ||
      (currentUser.role !== 'reception' &&
        currentUser.role !== 'admin' &&
        !hasPermission(currentUser.role, 'call_queue_patients'))
    ) {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'إدخال المرضى وإدارة الطابور مخصص لمكتب الاستقبال وإدارة النظام فقط.'
      });
      return;
    }
    const targetBooking = bookings.find(b => b.id === targetBookingId);
    if (!targetBooking) return;

    const now = new Date().toISOString();
    lastMutationAtRef.current = Date.now();
    let skippedCount = 0;
    const dbPromises: Promise<boolean>[] = [];

    if (isSupabaseConfigured) {
      dbPromises.push(
        updateBookingStatusInDb(targetBookingId, {
          status: 'in-progress',
          calledAt: now
        })
      );
    }

    // الحصول على جميع المرضى في نفس العيادة اليوم
    const updated = bookings.map(b => {
      // المريض المستدعى للدخول الآن
      if (b.id === targetBookingId) {
        return {
          ...b,
          status: 'in-progress' as BookingStatus,
          calledAt: now
        };
      }

      const isSameClinicAndDate = b.clinicId === targetBooking.clinicId && b.date === targetBooking.date;

      // إذا كان هناك مريض آخر داخل نفس العيادة حالياً، يتم إنهاء كشفه تلقائياً عند دخول المريض الجديد
      if (isSameClinicAndDate && b.status === 'in-progress') {
        if (isSupabaseConfigured) {
          dbPromises.push(
            updateBookingStatusInDb(b.id, {
              status: 'completed',
              completedAt: now
            })
          );
        }
        return {
          ...b,
          status: 'completed' as BookingStatus,
          completedAt: now
        };
      }

      // أي مريض آخر في نفس العيادة ونفس اليوم كان في الانتظار ومؤكد السداد وترتيبه الفعلي أسبق من المستدعى
      const isConfirmed = b.paymentStatus === 'paid' || b.paymentStatus === 'exempt';
      const isWaiting = b.status === 'waiting' && isConfirmed;

      const timeB = new Date(b.paidAt || b.createdAt).getTime();
      const timeTarget = new Date(targetBooking.paidAt || targetBooking.createdAt).getTime();

      const isEarlier =
        timeB < timeTarget ||
        (timeB === timeTarget && b.queuePosition < targetBooking.queuePosition);

      if (isSameClinicAndDate && isWaiting && isEarlier) {
        skippedCount++;
        if (isSupabaseConfigured) {
          dbPromises.push(updateBookingStatusInDb(b.id, { status: 'late' }));
        }
        return {
          ...b,
          status: 'late' as BookingStatus
        };
      }

      return b;
    });

    setBookings(updated);
    saveBookings(updated);

    if (isSupabaseConfigured && dbPromises.length > 0) {
      Promise.all(dbPromises).then(() => {
        try {
          supabase.channel('system_updates').send({
            type: 'broadcast',
            event: 'bookings_updated',
            payload: { clinicId: targetBooking.clinicId, admittedId: targetBookingId }
          });
        } catch {}
      });
    }

    if (skippedCount > 0) {
      addToast({
        type: 'warning',
        title: 'تم تخطي أدوار غير حاضرة',
        message: `تم إدخال المريض (${targetBooking.ticketNumber})، وتحويل عدد ${skippedCount} مريض متغيبين إلى قائمة "متأخر" تلقائياً.`
      });
    } else {
      addToast({
        type: 'success',
        title: 'تم إدخال المريض للعيادة',
        message: `المريض: ${targetBooking.patientName} (${targetBooking.ticketNumber}) داخل غرفة الكشف الآن.`
      });
    }
  };

  // نداء الدور التالي تسلسلياً للعيادة بضغطة واحدة (ينهي الكشف الحالي ويدخل المريض التالي في الطابور الفعلي)
  const callNextPatientInClinic = (clinicId: string) => {
    if (
      !currentUser ||
      (currentUser.role !== 'reception' &&
        currentUser.role !== 'admin' &&
        !hasPermission(currentUser.role, 'call_queue_patients'))
    ) {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'النداء التسلسلي وإدارة الطابور مخصص لمكتب الاستقبال وإدارة النظام فقط.'
      });
      return;
    }

    const todayStr = getLocalDateStr(new Date());
    const clinicObj = clinics.find(c => c.id === clinicId);
    const clinicName = clinicObj?.name || 'العيادة';

    const clinicConfirmedToday = bookings.filter(
      b =>
        b.clinicId === clinicId &&
        b.date === todayStr &&
        b.status !== 'cancelled' &&
        (b.paymentStatus === 'paid' || b.paymentStatus === 'exempt')
    );

    const currentInProgressList = clinicConfirmedToday.filter(b => b.status === 'in-progress');
    const waitingQueue = clinicConfirmedToday
      .filter(b => b.status === 'waiting')
      .sort((a, b) => {
        const timeA = new Date(a.paidAt || a.createdAt).getTime();
        const timeB = new Date(b.paidAt || b.createdAt).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.queuePosition - b.queuePosition;
      });

    const nextPatient = waitingQueue[0] || null;
    const now = new Date().toISOString();

    if (!nextPatient && currentInProgressList.length === 0) {
      addToast({
        type: 'info',
        title: 'لا يوجد منتظرون حالياً',
        message: `لا توجد حالات مسددة في طابور انتظار ${clinicName} حالياً.`
      });
      return;
    }

    lastMutationAtRef.current = Date.now();
    const dbPromises: Promise<boolean>[] = [];

    const updated = bookings.map(b => {
      if (b.clinicId !== clinicId || b.date !== todayStr) return b;

      // إنهاء كشف المريض الحالي داخل العيادة
      if (b.status === 'in-progress') {
        if (isSupabaseConfigured) {
          dbPromises.push(
            updateBookingStatusInDb(b.id, {
              status: 'completed',
              completedAt: now
            })
          );
        }
        return {
          ...b,
          status: 'completed' as BookingStatus,
          completedAt: now
        };
      }

      // إدخال المريض صاحب الدور التالي في الطابور التسلسلي
      if (nextPatient && b.id === nextPatient.id) {
        if (isSupabaseConfigured) {
          dbPromises.push(
            updateBookingStatusInDb(b.id, {
              status: 'in-progress',
              calledAt: now
            })
          );
        }
        return {
          ...b,
          status: 'in-progress' as BookingStatus,
          calledAt: now
        };
      }

      return b;
    });

    setBookings(updated);
    saveBookings(updated);

    if (isSupabaseConfigured && dbPromises.length > 0) {
      Promise.all(dbPromises).then(() => {
        try {
          supabase.channel('system_updates').send({
            type: 'broadcast',
            event: 'bookings_updated',
            payload: { clinicId, admittedId: nextPatient?.id || null }
          });
        } catch {}
      });
    }

    if (nextPatient) {
      const prevTicket = currentInProgressList[0]?.ticketNumber;
      addToast({
        type: 'success',
        title: `نداء الدور التالي — ${clinicName}`,
        message: prevTicket
          ? `تم إنهاء كشف (${prevTicket})، والنداء الآن على الدور التالي: ${nextPatient.patientName} (${nextPatient.ticketNumber}).`
          : `تم النداء على الدور التالي: ${nextPatient.patientName} (${nextPatient.ticketNumber}) للدخول إلى ${clinicName}.`
      });
    } else if (currentInProgressList.length > 0) {
      addToast({
        type: 'info',
        title: `تم إنهاء الكشف الحالي — ${clinicName}`,
        message: `تم إنهاء كشف المريض (${currentInProgressList[0].ticketNumber})، ولا يوجد مرضى آخرون في طابور الانتظار حالياً.`
      });
    }
  };

  const markPatientLate = (bookingId: string) => {
    if (
      !currentUser ||
      (currentUser.role !== 'reception' &&
        currentUser.role !== 'admin' &&
        !hasPermission(currentUser.role, 'call_queue_patients'))
    ) {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'تسجيل تأخر المرضى مخصص لمكتب الاستقبال وإدارة النظام فقط.'
      });
      return;
    }
    lastMutationAtRef.current = Date.now();
    if (isSupabaseConfigured) {
      updateBookingStatusInDb(bookingId, { status: 'late' }).then(() => {
        try {
          supabase.channel('system_updates').send({
            type: 'broadcast',
            event: 'bookings_updated',
            payload: { bookingId, status: 'late' }
          });
        } catch {}
      });
    }

    const updated = bookings.map(b => (b.id === bookingId ? { ...b, status: 'late' as BookingStatus } : b));
    setBookings(updated);
    saveBookings(updated);
    addToast({
      type: 'info',
      title: 'تسجيل حالة تأخر',
      message: 'تم تحويل المريض إلى قائمة المتأخرين واستبعاده من الطابور النشط.'
    });
  };

  const restoreLatePatient = (bookingId: string, action: 'admit_now' | 'return_to_queue') => {
    if (
      !currentUser ||
      (currentUser.role !== 'reception' &&
        currentUser.role !== 'admin' &&
        !hasPermission(currentUser.role, 'call_queue_patients'))
    ) {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'إعادة المتأخرين للطابور مخصصة لمكتب الاستقبال وإدارة النظام فقط.'
      });
      return;
    }
    const target = bookings.find(b => b.id === bookingId);
    if (!target) return;

    const now = new Date().toISOString();
    lastMutationAtRef.current = Date.now();
    const dbPromises: Promise<boolean>[] = [];

    if (isSupabaseConfigured) {
      dbPromises.push(
        updateBookingStatusInDb(bookingId, {
          status: action === 'admit_now' ? 'in-progress' : 'waiting',
          calledAt: action === 'admit_now' ? now : undefined,
          paidAt: action === 'return_to_queue' ? now : undefined
        })
      );
    }

    const updated = bookings.map(b => {
      if (b.id === bookingId) {
        if (action === 'admit_now') {
          return {
            ...b,
            status: 'in-progress' as BookingStatus,
            calledAt: now
          };
        } else {
          return {
            ...b,
            status: 'waiting' as BookingStatus,
            paidAt: now // يوضع في نهاية طابور الانتظار الحالي
          };
        }
      }
      if (action === 'admit_now' && b.clinicId === target.clinicId && b.date === target.date && b.status === 'in-progress') {
        if (isSupabaseConfigured) {
          dbPromises.push(
            updateBookingStatusInDb(b.id, {
              status: 'completed',
              completedAt: now
            })
          );
        }
        return {
          ...b,
          status: 'completed' as BookingStatus,
          completedAt: now
        };
      }
      return b;
    });

    setBookings(updated);
    saveBookings(updated);

    if (isSupabaseConfigured && dbPromises.length > 0) {
      Promise.all(dbPromises).then(() => {
        try {
          supabase.channel('system_updates').send({
            type: 'broadcast',
            event: 'bookings_updated',
            payload: { bookingId, action }
          });
        } catch {}
      });
    }

    if (action === 'admit_now') {
      addToast({
        type: 'success',
        title: 'إدخال فوري للعيادة',
        message: `تم إدخال المريض المتأخر (${target.patientName}) للكشف الآن.`
      });
    } else {
      addToast({
        type: 'info',
        title: 'إعادة لطابور الانتظار',
        message: `تمت إعادة المريض (${target.patientName}) إلى نهاية قائمة الانتظار الحالية.`
      });
    }
  };

  const addDoctorDiagnosis = (bookingId: string, diagnosis: string) => {
    const cleanDiagnosis = sanitizeText(diagnosis);
    const now = new Date().toISOString();

    if (isSupabaseConfigured) {
      updateBookingStatusInDb(bookingId, {
        doctorDiagnosis: cleanDiagnosis,
        status: 'completed',
        completedAt: now
      });
    }

    const updated = bookings.map(b => {
      if (b.id === bookingId) {
        return { 
          ...b, 
          doctorDiagnosis: cleanDiagnosis,
          status: 'completed' as BookingStatus,
          completedAt: now
        };
      }
      return b;
    });
    setBookings(updated);
    saveBookings(updated);
    addToast({
      type: 'success',
      title: 'تم حفظ التقرير الطبي',
      message: 'تم تدوين الملاحظات والتشخيص في ملف المريض بنجاح.'
    });
  };

  const toggleClinicStatus = (clinicId: string) => {
    if (currentUser?.role !== 'admin' && !hasPermission(currentUser?.role, 'manage_daily_clinics')) {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'تغيير حالة تشغيل العيادة يتطلب صلاحية إدارة جدول عيادات اليوم.'
      });
      return;
    }
    const target = clinics.find(c => c.id === clinicId);
    if (!target) return;
    const nextActive = !target.active;
    const updated = clinics.map(c =>
      c.id === clinicId
        ? { ...c, active: nextActive, isActive: nextActive, isOpenToday: nextActive }
        : c
    );
    setClinics(updated);
    saveClinics(updated);

    const updatedSched: DailyScheduleState = {
      date: dailySchedule.date,
      items: dailySchedule.items.map(i =>
        i.clinicId === clinicId ? { ...i, isOpen: nextActive } : i
      )
    };
    setDailySchedule(updatedSched);
    saveDailySchedule(updatedSched);

    if (isSupabaseConfigured) {
      updateClinicInDb(clinicId, {
        active: nextActive,
        isActive: nextActive,
        isOpenToday: nextActive
      });
      saveDailyScheduleToDb(updatedSched);
    }
  };

  const addClinic = (newClinic: Omit<Clinic, 'id'>) => {
    if (currentUser?.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'إضافة العيادات التخصصية مخصصة لمدير النظام فقط.'
      });
      return;
    }
    const id = `clinic-${Date.now()}`;
    unmarkClinicDeletedLocally(id);
    const fullClinic: Clinic = {
      ...newClinic,
      id,
      active: newClinic.active ?? true,
      isActive: newClinic.isActive ?? true,
      isOpenToday: newClinic.isOpenToday ?? true
    };
    const updated = [...clinics, fullClinic];
    setClinics(updated);
    saveClinics(updated);

    // إضافة العيادة الجديدة لجدول تشغيل اليوم تلقائياً
    const updatedSchedItems: DailyClinicScheduleItem[] = [
      ...dailySchedule.items.filter(i => i.clinicId !== id),
      { clinicId: id, doctorId: '', isOpen: true }
    ];
    const updatedSched: DailyScheduleState = { date: getLocalDateStr(), items: updatedSchedItems };
    setDailySchedule(updatedSched);
    saveDailySchedule(updatedSched);

    if (isSupabaseConfigured) {
      addClinicToDb(fullClinic);
      saveDailyScheduleToDb(updatedSched);
    }

    addToast({
      type: 'success',
      title: 'تمت إضافة العيادة',
      message: `تم تسجيل عيادة ${fullClinic.name} بنجاح.`
    });
  };

  const updateClinic = (clinicId: string, data: Partial<Clinic>) => {
    if (currentUser?.role !== 'admin' && !hasPermission(currentUser?.role, 'manage_clinic_fees')) {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'تعديل بيانات أو رسوم العيادة غير مصرح لهذا الحساب.'
      });
      return;
    }
    const updated = clinics.map(c => c.id === clinicId ? { ...c, ...data } : c);
    setClinics(updated);
    saveClinics(updated);

    // إذا تم تعديل اسم العيادة، نحدّث clinicName لدى الأطباء التابعين لها
    if (data.name) {
      const updatedDocs = doctors.map(d => d.clinicId === clinicId ? { ...d, clinicName: data.name! } : d);
      setDoctors(updatedDocs);
      saveDoctors(updatedDocs);
    }

    if (isSupabaseConfigured) {
      updateClinicInDb(clinicId, data);
    }

    addToast({
      type: 'success',
      title: 'تم تحديث العيادة',
      message: 'تم حفظ تعديلات العيادة بنجاح في قاعدة البيانات.'
    });
  };

  const deleteClinic = async (clinicId: string): Promise<{ success: boolean; error?: string }> => {
    if (currentUser?.role !== 'admin') {
      const err = 'حذف العيادات مخصص لمدير النظام فقط.';
      addToast({ type: 'error', title: 'غير مصرح', message: err });
      return { success: false, error: err };
    }

    const targetClinic = clinics.find(c => c.id === clinicId);
    const clinicName = targetClinic?.name || 'العيادة';

    // 1. Check active bookings locally
    const activeBookings = bookings.filter(
      b => b.clinicId === clinicId && ['waiting', 'in-progress', 'late'].includes(b.status)
    );
    if (activeBookings.length > 0) {
      const err = `لا يمكن حذف (${clinicName}) لوجود ${activeBookings.length} حجز نشط جارٍ عليها. يرجى استكمال الحالات أو إلغاؤها أولاً.`;
      addToast({
        type: 'error',
        title: 'تعذر حذف العيادة',
        message: err
      });
      return { success: false, error: err };
    }

    // 2. Perform DB deletion
    if (isSupabaseConfigured) {
      const res = await deleteClinicFromDb(clinicId);
      if (!res.success) {
        addToast({
          type: 'error',
          title: 'تعذر حذف العيادة',
          message: res.error || 'حدث خطأ أثناء حذف العيادة من قاعدة البيانات'
        });
        return { success: false, error: res.error };
      }
    }

    // 3. تسجيل الحذف محلياً لضمان عدم رجوع العيادة بعد تحديث الصفحة أو إعادة فتح التطبيق
    markClinicDeletedLocally(clinicId);

    const remaining = clinics.filter(c => c.id !== clinicId);
    setClinics(remaining);
    saveClinics(remaining);

    // تحديث جدول اليوم وفك ارتباط الأطباء بالعيادة المحذوفة
    const updatedSched: DailyScheduleState = {
      date: dailySchedule.date,
      items: dailySchedule.items.filter(i => i.clinicId !== clinicId)
    };
    setDailySchedule(updatedSched);
    saveDailySchedule(updatedSched);

    const updatedDocs = doctors.map(d =>
      d.clinicId === clinicId ? { ...d, clinicId: '', clinicName: 'غير معين' } : d
    );
    setDoctors(updatedDocs);
    saveDoctors(updatedDocs);

    addToast({
      type: 'success',
      title: 'تم حذف العيادة',
      message: `تم حذف (${clinicName}) نهائياً من النظام.`
    });
    return { success: true };
  };

  const addDoctor = (newDoctor: Omit<Doctor, 'id'>) => {
    if (currentUser?.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'إضافة الأطباء مخصصة لمدير النظام فقط.'
      });
      return;
    }
    const id = `doc-${Date.now()}`;
    unmarkDoctorDeletedLocally(id);
    const shift = parseDoctorShiftTimes(newDoctor);
    const fullDoctor: Doctor = {
      ...newDoctor,
      id,
      shiftStartTime: newDoctor.shiftStartTime || shift.startTime,
      shiftEndTime: newDoctor.shiftEndTime || shift.endTime
    };
    const updated = [...doctors, fullDoctor];
    setDoctors(updated);
    saveDoctors(updated);

    // إذا كانت العيادة التابعة للطبيب ليس لها طبيب معين في جدول اليوم، نعين هذا الطبيب تلقائياً
    if (fullDoctor.clinicId) {
      const existingItem = dailySchedule.items.find(i => i.clinicId === fullDoctor.clinicId);
      if (!existingItem || !existingItem.doctorId) {
        const nextItems = existingItem
          ? dailySchedule.items.map(i => i.clinicId === fullDoctor.clinicId ? { ...i, doctorId: id } : i)
          : [...dailySchedule.items, { clinicId: fullDoctor.clinicId, doctorId: id, isOpen: true }];
        const nextSchedule: DailyScheduleState = { date: dailySchedule.date, items: nextItems };
        setDailySchedule(nextSchedule);
        saveDailySchedule(nextSchedule);
        if (isSupabaseConfigured) {
          saveDailyScheduleToDb(nextSchedule);
        }
      }
    }

    if (isSupabaseConfigured) {
      addDoctorToDb(fullDoctor);
    }

    addToast({
      type: 'success',
      title: 'تمت إضافة الطبيب',
      message: `تم تسجيل ${fullDoctor.name} في الكادر الطبي.`
    });
  };

  const updateDoctor = async (doctorId: string, data: Partial<Doctor>): Promise<boolean> => {
    if (currentUser?.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'تعديل بيانات الطبيب الأساسية مخصص لمدير النظام فقط.'
      });
      return false;
    }

    const target = doctors.find(d => d.id === doctorId);
    if (!target) return false;

    const resolvedClinic = data.clinicId
      ? clinics.find(c => c.id === data.clinicId)
      : clinics.find(c => c.id === target.clinicId);

    const mergedDoc: Doctor = {
      ...target,
      ...data,
      clinicName: data.clinicName || resolvedClinic?.name || target.clinicName
    };

    if (data.scheduleHours || data.shiftStartTime || data.shiftEndTime) {
      const shift = parseDoctorShiftTimes(mergedDoc);
      mergedDoc.shiftStartTime = data.shiftStartTime || shift.startTime;
      mergedDoc.shiftEndTime = data.shiftEndTime || shift.endTime;
    }

    activeMutationsCountRef.current += 1;
    lastMutationAtRef.current = Date.now();

    try {
      const updated = doctors.map(d => (d.id === doctorId ? mergedDoc : d));
      setDoctors(updated);
      saveDoctors(updated);

      if (isSupabaseConfigured) {
        const saved = await updateDoctorInDb(doctorId, mergedDoc);
        lastMutationAtRef.current = Date.now();
        if (!saved) {
          addToast({
            type: 'error',
            title: 'تعذر تحديث بيانات الطبيب',
            message: 'فشل حفظ التعديلات في قاعدة البيانات السحابية. يرجى المحاولة مرة أخرى.'
          });
          return false;
        }
      }

      if (data.scheduleDays && mergedDoc.clinicId) {
        const todayStr = getLocalDateStr(new Date());
        const isScheduledToday = isDoctorScheduledOnDate(mergedDoc, todayStr);
        const isDocPresent = mergedDoc.status !== 'offline';
        const shouldClinicBeOpenToday = isScheduledToday && isDocPresent;

        const existingItem = dailySchedule.items.find(i => i.clinicId === mergedDoc.clinicId);
        if (!existingItem || existingItem.doctorId === doctorId || !existingItem.doctorId) {
          const nextItems = existingItem
            ? dailySchedule.items.map(i =>
                i.clinicId === mergedDoc.clinicId
                  ? { ...i, doctorId, isOpen: shouldClinicBeOpenToday }
                  : i
              )
            : [
                ...dailySchedule.items,
                { clinicId: mergedDoc.clinicId, doctorId, isOpen: shouldClinicBeOpenToday }
              ];
          const nextSchedule: DailyScheduleState = {
            date: dailySchedule.date || todayStr,
            items: nextItems
          };
          setDailySchedule(nextSchedule);
          saveDailySchedule(nextSchedule);

          setClinics(prev => {
            const nextClinics = prev.map(c =>
              c.id === mergedDoc.clinicId
                ? {
                    ...c,
                    isOpenToday: shouldClinicBeOpenToday,
                    active: shouldClinicBeOpenToday,
                    isActive: shouldClinicBeOpenToday,
                    workingDays: mergedDoc.scheduleDays,
                    workingHours: mergedDoc.scheduleHours || c.workingHours
                  }
                : c
            );
            saveClinics(nextClinics);
            return nextClinics;
          });

          if (isSupabaseConfigured) {
            await saveDailyScheduleToDb(nextSchedule);
            await updateClinicInDb(mergedDoc.clinicId, {
              isOpenToday: shouldClinicBeOpenToday,
              active: shouldClinicBeOpenToday,
              isActive: shouldClinicBeOpenToday,
              workingDays: mergedDoc.scheduleDays,
              workingHours: mergedDoc.scheduleHours
            });
            lastMutationAtRef.current = Date.now();
          }
        }
      }

      if (isSupabaseConfigured) {
        try {
          const channel = supabase.channel('system_updates');
          channel.send({
            type: 'broadcast',
            event: 'doctors_updated',
            payload: { doctorId }
          });
          channel.send({
            type: 'broadcast',
            event: 'schedule_updated',
            payload: { doctorId }
          });
        } catch {}
      }

      addToast({
        type: 'success',
        title: 'تم تحديث بيانات الطبيب',
        message: `تم حفظ تعديلات بيانات وجدول (${mergedDoc.name}) في قاعدة البيانات بنجاح.`
      });
      return true;
    } finally {
      lastMutationAtRef.current = Date.now();
      activeMutationsCountRef.current = Math.max(0, activeMutationsCountRef.current - 1);
    }
  };

  const deleteDoctor = async (doctorId: string): Promise<{ success: boolean; error?: string }> => {
    if (currentUser?.role !== 'admin') {
      const err = 'حذف الأطباء مخصص لمدير النظام فقط.';
      addToast({ type: 'error', title: 'غير مصرح', message: err });
      return { success: false, error: err };
    }

    const targetDoc = doctors.find(d => d.id === doctorId);
    const docName = targetDoc?.name || 'الطبيب';

    // 1. فحص عدم وجود حجوزات نشطة جارية للطبيب
    const activeBookings = bookings.filter(
      b => b.doctorId === doctorId && ['waiting', 'in-progress', 'late'].includes(b.status)
    );
    if (activeBookings.length > 0) {
      const err = `لا يمكن حذف (${docName}) لوجود ${activeBookings.length} حجز نشط جارٍ له. يرجى استكمال الحالات أو إلغاؤها أولاً.`;
      addToast({
        type: 'error',
        title: 'تعذر حذف الطبيب',
        message: err
      });
      return { success: false, error: err };
    }

    // 2. الحذف من قاعدة البيانات إن كانت مفعلة
    if (isSupabaseConfigured) {
      const res = await deleteDoctorFromDb(doctorId);
      if (!res.success) {
        addToast({
          type: 'error',
          title: 'تعذر حذف الطبيب',
          message: res.error || 'حدث خطأ أثناء حذف الطبيب من قاعدة البيانات.'
        });
        return { success: false, error: res.error };
      }
    }

    // 3. تسجيل الحذف محلياً لضمان عدم رجوع الطبيب بعد تحديث الصفحة أو إعادة فتح التطبيق
    markDoctorDeletedLocally(doctorId);

    const remaining = doctors.filter(d => d.id !== doctorId);
    setDoctors(remaining);
    saveDoctors(remaining);

    // 4. تحديث جدول تشغيل اليوم إذا كان الطبيب المحذوف معيناً في إحدى العيادات
    const updatedSchedItems = dailySchedule.items.map(item => {
      if (item.doctorId === doctorId) {
        const replacementDoc = remaining.find(d => d.clinicId === item.clinicId);
        return { ...item, doctorId: replacementDoc?.id || '' };
      }
      return item;
    });
    const updatedSched: DailyScheduleState = { date: dailySchedule.date, items: updatedSchedItems };
    setDailySchedule(updatedSched);
    saveDailySchedule(updatedSched);
    if (isSupabaseConfigured) {
      saveDailyScheduleToDb(updatedSched);
    }

    addToast({
      type: 'success',
      title: 'تم حذف الطبيب',
      message: `تم حذف (${docName}) نهائياً من النظام.`
    });
    return { success: true };
  };

  const updateDailySchedule = (items: DailyClinicScheduleItem[]) => {
    if (currentUser?.role !== 'admin' && !hasPermission(currentUser?.role, 'manage_daily_clinics')) {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'تعديل جدول تشغيل العيادات اليومي يتطلب صلاحية إدارة جدول اليوم.'
      });
      return;
    }
    const todayStr = getLocalDateStr(new Date());
    const sanitized = items.map(item => {
      if (!item.doctorId) {
        const doc = doctors.find(d => d.clinicId === item.clinicId);
        return { ...item, doctorId: doc?.id || '' };
      }
      return item;
    });

    const newSchedule: DailyScheduleState = {
      date: todayStr,
      items: sanitized
    };

    if (isSupabaseConfigured) {
      saveDailyScheduleToDb(newSchedule);
      for (const item of sanitized) {
        updateClinicInDb(item.clinicId, {
          active: item.isOpen,
          isActive: item.isOpen,
          isOpenToday: item.isOpen
        });
      }
      try {
        const channel = supabase.channel('system_updates');
        channel.send({
          type: 'broadcast',
          event: 'schedule_updated',
          payload: { date: todayStr }
        });
      } catch {}
    }

    // مزامنة حالة isOpenToday في قائمة العيادات المحلية مع جدول اليوم
    const updatedClinics = clinics.map(c => {
      const item = sanitized.find(i => i.clinicId === c.id);
      return item ? { ...c, isOpenToday: item.isOpen, active: item.isOpen, isActive: item.isOpen } : c;
    });
    setClinics(updatedClinics);
    saveClinics(updatedClinics);

    setDailySchedule(newSchedule);
    saveDailySchedule(newSchedule);
    addToast({
      type: 'success',
      title: 'تم حفظ وتطبيق جدول اليوم',
      message: `تم تثبيت العيادات المفتوحة اليوم (${sanitized.filter(i => i.isOpen).length} عيادة مفتوحة ومتاحة للمرضى).`
    });
  };

  const updateRolePermissions = (role: UserRole, permissions: SystemPermission[]) => {
    if (currentUser?.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'تعديل مصفوفة الصلاحيات مخصص لمدير النظام فقط.'
      });
      return;
    }
    if (role === 'admin') return; // الأدمن يحتفظ بكافة الصلاحيات دائماً
    const updated: RolePermissionsMap = {
      ...rolePermissions,
      [role]: permissions
    };
    setRolePermissions(updated);
    saveRolePermissions(updated);
    if (isSupabaseConfigured) {
      saveSettingToDb('role_permissions', JSON.stringify(updated));
    }
    const roleLabels: Record<UserRole, string> = {
      admin: 'الإدارة العامة',
      doctor: 'الأطباء',
      reception: 'الاستقبال والعيادات',
      cashier: 'الخزينة والتحصيل',
      finance_manager: 'مدير المالية والحسابات'
    };
    addToast({
      type: 'success',
      title: 'تم تحديث صلاحيات النظام',
      message: `تم تحديث صلاحيات دور "${roleLabels[role] || role}" بنجاح.`
    });
  };

  const hasPermission = (role: UserRole | undefined, permission: SystemPermission): boolean => {
    if (!role) return false;
    if (role === 'admin') return true; // الأدمن يملك جميع الصلاحيات دائماً
    const perms = rolePermissions[role] || [];
    return perms.includes(permission);
  };

  const updateSupportInfoText = async (text: string): Promise<boolean> => {
    if (currentUser?.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'تعديل إعدادات الشاشة الرئيسية مخصص لمدير النظام فقط.'
      });
      return false;
    }
    const sanitized = sanitizeText(text);
    lastSettingsSaveAtRef.current = Date.now();
    setSupportInfoText(sanitized);
    saveSupportInfoText(sanitized);

    let savedToCloud = false;
    if (isSupabaseConfigured) {
      savedToCloud = await saveSettingToDb('support_info_text', sanitized);
      lastSettingsSaveAtRef.current = Date.now();
    }

    if (savedToCloud) {
      addToast({
        type: 'success',
        title: 'تم حفظ وتعميم نص الاستفسارات',
        message: 'تم حفظ النص بنجاح في قاعدة البيانات السحابية وتحديثه لجميع المرضى والأجهزة والزوار فوراً.'
      });
    } else {
      addToast({
        type: 'info',
        title: 'تم الحفظ محلياً',
        message: 'تم تحديث النص على هذا الجهاز وجاري المزامنة مع الخادم السحابي.'
      });
    }
    return true;
  };

  const updateOfficialWorkingHours = async (text: string): Promise<boolean> => {
    if (currentUser?.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'تعديل مواعيد العمل الرسمية مخصص لمدير النظام فقط.'
      });
      return false;
    }
    const sanitized = sanitizeText(text);
    if (!sanitized) {
      addToast({
        type: 'error',
        title: 'حقل مطلوب',
        message: 'يرجى كتابة مواعيد العمل الرسمية.'
      });
      return false;
    }
    lastSettingsSaveAtRef.current = Date.now();
    setOfficialWorkingHours(sanitized);
    saveOfficialWorkingHours(sanitized);

    let savedToCloud = false;
    if (isSupabaseConfigured) {
      savedToCloud = await saveSettingToDb('official_working_hours_text', sanitized);
      lastSettingsSaveAtRef.current = Date.now();
    }

    if (savedToCloud) {
      addToast({
        type: 'success',
        title: 'تم تحديث مواعيد العمل الرسمية',
        message: 'تم حفظ مواعيد العمل في قاعدة البيانات وتعميمها فوراً على الشاشة الرئيسية لجميع الزوار.'
      });
    } else {
      addToast({
        type: 'success',
        title: 'تم تحديث مواعيد العمل الرسمية',
        message: 'تم حفظ مواعيد العمل الرسمية وتحديثها فوراً في الشاشة الرئيسية.'
      });
    }
    return true;
  };

  const updateConsultationWindowDays = async (days: number): Promise<boolean> => {
    if (currentUser?.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'تعديل مدة الاستشارة المجانية مخصص لمدير النظام فقط.'
      });
      return false;
    }
    const validDays = Math.max(1, Math.min(90, Math.round(Number(days) || 14)));
    const todayStr = getLocalDateStr(new Date());
    lastSettingsSaveAtRef.current = Date.now();
    const updatedReg = saveConsultationRegistry(
      {
        ...consultationRegistry,
        windowDays: validDays
      },
      todayStr
    );
    setConsultationRegistry(updatedReg);

    if (isSupabaseConfigured) {
      await saveConsultationRegistryToDb(updatedReg);
      lastSettingsSaveAtRef.current = Date.now();
    }

    addToast({
      type: 'success',
      title: 'تم حفظ مدة الاستشارة المجانية',
      message: `تم تحديد فترة الاستشارة المجانية بـ (${validDays} يوماً) وتطهير أي سجلات منتهية تلقائياً.`
    });
    return true;
  };

  const updateConsultationSettings = async (
    defaultDays: number,
    clinicWindows?: Record<string, number>
  ): Promise<boolean> => {
    if (currentUser?.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'تعديل مدة الاستشارة المجانية مخصص لمدير النظام فقط.'
      });
      return false;
    }
    const validDays = Math.max(1, Math.min(90, Math.round(Number(defaultDays) || 14)));
    const todayStr = getLocalDateStr(new Date());
    lastSettingsSaveAtRef.current = Date.now();
    const updatedReg = saveConsultationRegistry(
      {
        ...consultationRegistry,
        windowDays: validDays,
        clinicWindows: clinicWindows !== undefined ? clinicWindows : consultationRegistry.clinicWindows
      },
      todayStr
    );
    setConsultationRegistry(updatedReg);

    if (isSupabaseConfigured) {
      await saveConsultationRegistryToDb(updatedReg);
      lastSettingsSaveAtRef.current = Date.now();
    }

    addToast({
      type: 'success',
      title: 'تم حفظ إعدادات الاستشارة المجانية',
      message: `تم تحديد فترة الاستشارة المجانية بـ (${validDays} يوماً) وتطهير أي سجلات منتهية تلقائياً.`
    });
    return true;
  };

  const checkConsultationEligibility = (phone: string, clinicId: string) => {
    const todayStr = getLocalDateStr(new Date());
    const res = checkPatientConsultationEligibility(phone, clinicId, consultationRegistry, todayStr);
    return {
      ...res,
      daysRemaining: res.remainingDays
    };
  };

  /**
   * العيادات المتاحة للحجز للمريض:
   * تعتمد بشكل صارم على الركائز الأربعة المطلوبة:
   * 1. الجدول الأسبوعي (هل هذا اليوم من أيام عمل الطبيب؟)
   * 2. حالة التواجد اليومية (هل الطبيب "متاح للعمل" وليس "غير متاح" / offline)
   * 3. انتهاء وقت العيادة (هل انتهت المناوبة ووقت استقبال الحجوزات؟)
   * 4. اكتمال عدد الحجوزات (هل وصلت الحجوزات المؤكدة إلى الحد الأقصى للطبيب؟)
   */
  const getActiveClinicsForBooking = (): { clinic: Clinic; assignedDoctor?: Doctor }[] => {
    const available: { clinic: Clinic; assignedDoctor?: Doctor }[] = [];
    const todayStr = getLocalDateStr(new Date());

    for (const clinic of clinics) {
      // فحص أن العيادة مفعلة
      if (clinic.active === false || clinic.isActive === false) continue;

      // فحص التشغيل اليومي: الأولوية لجدول تشغيل اليوم، وإلا فحص حالة العيادة isOpenToday
      const scheduleItem = dailySchedule.items.find(item => item.clinicId === clinic.id);
      const isDailyOpen = scheduleItem ? scheduleItem.isOpen : (clinic.isOpenToday !== false);

      // إذا كانت العيادة مغلقة صراحة اليوم، نتجاوزها
      if (!isDailyOpen) continue;

      // العثور على الطبيب المناوب المعين في جدول اليوم (بشرط تبعيته للعيادة وتواجده في جدول اليوم الفعلي) أو طبيب متاح مسجل لنفس العيادة
      const scheduledDoc = scheduleItem?.doctorId
        ? doctors.find(d => d.id === scheduleItem.doctorId && d.clinicId === clinic.id)
        : undefined;
      const assignedDoctor =
        (scheduledDoc && scheduledDoc.status !== 'offline' && isDoctorScheduledOnDate(scheduledDoc, todayStr)
          ? scheduledDoc
          : undefined) ||
        doctors.find(d => d.clinicId === clinic.id && d.status !== 'offline' && isDoctorScheduledOnDate(d, todayStr));

      // إخفاء العيادة تلقائياً إذا لم يكن لها طبيب مسجل أو إذا كان الطبيب غير متاح (offline) أو غير مجدول في هذا اليوم الفعلي
      if (!assignedDoctor || assignedDoctor.status === 'offline' || !isDoctorScheduledOnDate(assignedDoctor, todayStr)) {
        continue;
      }

      available.push({ clinic, assignedDoctor });
    }

    return available;
  };

  const checkClinicAvailabilityStatus = (clinicId: string, doctorId: string, date?: string): ClinicAvailabilityResult | null => {
    const doctor = doctors.find(d => d.id === doctorId);
    if (!doctor) return null;
    const targetDate = date || getLocalDateStr(new Date());
    const baseResult = checkClinicAvailability(doctor, clinicId, targetDate, bookings);

    const clinic = clinics.find(c => c.id === clinicId);
    const scheduleItem = dailySchedule.items.find(item => item.clinicId === clinicId);
    const isDailyOpen = scheduleItem ? scheduleItem.isOpen : (clinic?.isOpenToday !== false);
    if (!clinic || clinic.active === false || clinic.isActive === false || !isDailyOpen) {
      return {
        ...baseResult,
        allowed: false,
        reason: 'عذراً، هذه العيادة مغلقة اليوم ولا تستقبل حجوزات جديدة.'
      };
    }

    return baseResult;
  };

  // مؤقت دوري كل 30 ثانية لتحديث انتهاء مواعيد العمل للعيادات تلقائياً في الواجهات الحية
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setClockTick(prev => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const resetToInitialData = () => {
    localStorage.removeItem('sharaya_clinics_v2');
    localStorage.removeItem('sharaya_doctors_v2');
    localStorage.removeItem('sharaya_bookings_v2');
    localStorage.removeItem('sharaya_bookings_cutoff_v2');
    localStorage.removeItem('sharaya_daily_schedule_v2');
    localStorage.removeItem('sharaya_role_permissions_v2');
    localStorage.removeItem('sharaya_support_info_text_v2');
    localStorage.removeItem('sharaya_deleted_clinics_v2');
    localStorage.removeItem('sharaya_deleted_doctors_v2');
    localStorage.removeItem('sharaya_deleted_bookings_v2');
    window.location.reload();
  };

  const clearPastBookings = async (beforeDate?: string): Promise<{ success: boolean; count: number }> => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'finance_manager') {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'تطهير وأرشفة السجلات السابقة مخصص لمدير النظام أو مدير المالية فقط.'
      });
      return { success: false, count: 0 };
    }
    const cutoffDate = beforeDate || getLocalDateStr(new Date());
    const isPurgeAll = cutoffDate === '9999-12-31';
    const toRemove = isPurgeAll ? [...bookings] : bookings.filter(b => b.date < cutoffDate);
    const remaining = isPurgeAll ? [] : bookings.filter(b => b.date >= cutoffDate && b.notes !== '__PURGED_PAST_BOOKING__');

    activeMutationsCountRef.current += 1;
    lastMutationAtRef.current = Date.now();

    try {
      // 1. وسم جميع السجلات المحذوفة محلياً لمنع عودتها من أي ذاكرة مؤقتة وتحديث الحالة فوراً
      for (const item of toRemove) {
        if (item?.id) {
          markBookingDeletedLocally(item.id);
        }
      }
      if (isPurgeAll || (selectedTicketRef.current && toRemove.some(b => b.id === selectedTicketRef.current?.id))) {
        setSelectedTicket(null);
      }

      removeBookingsBeforeDate(cutoffDate);
      setBookings(remaining);
      saveBookings(remaining);

      // 2. تحديث وتطهير السجلات في قاعدة البيانات السحابية Supabase
      if (isSupabaseConfigured) {
        await deleteBookingsBeforeDateFromDb(cutoffDate);
        lastMutationAtRef.current = Date.now();
        if (!isPurgeAll) {
          const freshBookings = await fetchBookingsFromDb();
          if (freshBookings) {
            setBookings(freshBookings);
            saveBookings(freshBookings);
          }
        }
      }

      addToast({
        type: 'success',
        title: isPurgeAll ? 'تم مسح السجل بالكامل' : 'تم مسح سجلات الأيام السابقة',
        message: isPurgeAll
          ? `تم مسح وتصفير جميع الحجوزات المسجلة (${toRemove.length} حجز) نهائياً من قاعدة البيانات والتخزين المحلي.`
          : `تم حذف ${toRemove.length} حجز من الأيام السابقة نهائياً من قاعدة البيانات والتخزين المحلي.`
      });

      return { success: true, count: toRemove.length };
    } finally {
      lastMutationAtRef.current = Date.now();
      activeMutationsCountRef.current = Math.max(0, activeMutationsCountRef.current - 1);
    }
  };

  const logSystemError = async (input: {
    source: SystemErrorSource;
    message: string;
    stack?: string;
    componentStack?: string;
  }): Promise<void> => {
    const entry = recordLocalSystemError(input);
    const updated = [entry, ...errorLogs.filter(e => e.id !== entry.id)].slice(0, 100);
    setErrorLogs(updated);
    saveErrorLogs(updated);

    if (isSupabaseConfigured) {
      const ok = await reportClientErrorToDb(entry);
      if (ok) {
        const syncedList = updated.map(item =>
          item.id === entry.id ? { ...item, syncedToDb: true } : item
        );
        setErrorLogs(syncedList);
        saveErrorLogs(syncedList);
        savePendingErrorLogs(getPendingErrorLogs().filter(p => p.id !== entry.id));
      }
    }
  };

  const resolveErrorLog = async (errorId: string, resolved: boolean = true): Promise<void> => {
    if (currentUser?.role !== 'admin') return;
    const updated = errorLogs.map(item =>
      item.id === errorId ? { ...item, resolved, syncedToDb: true } : item
    );
    setErrorLogs(updated);
    saveErrorLogs(updated);
    if (isSupabaseConfigured) {
      await saveSettingToDb('system_error_logs_json', JSON.stringify(updated));
    }
  };

  const resolveAllErrorLogs = async (): Promise<void> => {
    if (currentUser?.role !== 'admin') return;
    const updated = errorLogs.map(item => ({ ...item, resolved: true, syncedToDb: true }));
    setErrorLogs(updated);
    saveErrorLogs(updated);
    if (isSupabaseConfigured) {
      await saveSettingToDb('system_error_logs_json', JSON.stringify(updated));
    }
    addToast({
      type: 'success',
      title: 'تم تحديث حالة الأخطاء',
      message: 'تم تعليم جميع سجلات الأخطاء كـ (تمت المعالجة) ومزامنتها مع قاعدة البيانات.'
    });
  };

  const deleteErrorLog = async (errorId: string): Promise<void> => {
    if (currentUser?.role !== 'admin') return;
    const updated = errorLogs.filter(item => item.id !== errorId);
    setErrorLogs(updated);
    saveErrorLogs(updated);
    savePendingErrorLogs(getPendingErrorLogs().filter(p => p.id !== errorId));
    if (isSupabaseConfigured) {
      await saveSettingToDb('system_error_logs_json', JSON.stringify(updated));
    }
  };

  const clearAllErrorLogs = async (): Promise<void> => {
    if (currentUser?.role !== 'admin') return;
    setErrorLogs([]);
    saveErrorLogs([]);
    savePendingErrorLogs([]);
    if (isSupabaseConfigured) {
      await saveSettingToDb('system_error_logs_json', JSON.stringify([]));
    }
    addToast({
      type: 'success',
      title: 'تم تفريغ سجل الأخطاء',
      message: 'تم مسح كافة سجلات الأخطاء من الجهاز الحالي ومن قاعدة البيانات السحابية.'
    });
  };

  const syncErrorLogsNow = async (): Promise<boolean> => {
    if (!isSupabaseConfigured) return false;
    try {
      const pending = getPendingErrorLogs();
      for (const item of pending) {
        await reportClientErrorToDb(item);
      }
      savePendingErrorLogs([]);

      const settings = await fetchSettingsFromDb();
      let cloudLogs: SystemErrorLog[] = [];
      if (settings['system_error_logs_json']) {
        try {
          const parsed = JSON.parse(settings['system_error_logs_json']);
          if (Array.isArray(parsed)) cloudLogs = parsed;
        } catch {}
      }
      const merged = mergeErrorLogLists(cloudLogs, getStoredErrorLogs());
      setErrorLogs(merged);
      saveErrorLogs(merged);
      await saveSettingToDb('system_error_logs_json', JSON.stringify(merged));
      return true;
    } catch {
      return false;
    }
  };

  // ==========================================
  // إدارة تعاقدات شركات التأمين الطبي وفئات الكروت (للمدير المالي والأدمن)
  // ==========================================
  const saveInsuranceContract = async (
    contractInput: Omit<InsuranceCompanyContract, 'id' | 'createdAt'> & { id?: string }
  ): Promise<boolean> => {
    if (
      !currentUser ||
      (currentUser.role !== 'admin' &&
        currentUser.role !== 'finance_manager' &&
        !hasPermission(currentUser.role, 'manage_insurance_contracts'))
    ) {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'إدارة تعاقدات شركات التأمين مخصصة لمدير المالية أو مدير النظام فقط.'
      });
      return false;
    }

    const cleanName = sanitizeText(contractInput.companyName);
    if (!cleanName || cleanName.length < 2) {
      addToast({
        type: 'error',
        title: 'بيانات غير مكتملة',
        message: 'يرجى إدخال اسم شركة التأمين بشكل صحيح.'
      });
      return false;
    }

    const validCategories = (contractInput.cardCategories || [])
      .map(c => sanitizeText(c))
      .filter(Boolean);

    if (validCategories.length === 0) {
      addToast({
        type: 'error',
        title: 'فئات الكروت مطلوبة',
        message: 'يرجى تحديد فئة كارت واحدة على الأقل (مثل: جولد، فضي، بلاتينيوم).'
      });
      return false;
    }

    lastSettingsSaveAtRef.current = Date.now();
    const isEditing = Boolean(contractInput.id && insuranceContracts.some(c => c.id === contractInput.id));
    const item: InsuranceCompanyContract = {
      id: contractInput.id || `ins-${Date.now().toString().slice(-6)}`,
      companyName: cleanName,
      cardCategories: Array.from(new Set(validCategories)),
      isActive: contractInput.isActive !== false,
      notes: contractInput.notes ? sanitizeText(contractInput.notes) : undefined,
      createdAt: isEditing
        ? insuranceContracts.find(c => c.id === contractInput.id)?.createdAt || new Date().toISOString()
        : new Date().toISOString()
    };

    const nextContracts = isEditing
      ? insuranceContracts.map(c => (c.id === item.id ? item : c))
      : [item, ...insuranceContracts];

    setInsuranceContracts(nextContracts);
    saveInsuranceContracts(nextContracts);

    if (isSupabaseConfigured) {
      await saveInsuranceContractsToDb(nextContracts);
      lastSettingsSaveAtRef.current = Date.now();
    }

    addToast({
      type: 'success',
      title: isEditing ? 'تم تحديث تعاقد شركة التأمين' : 'تمت إضافة شركة التأمين',
      message: `تم حفظ تعاقد (${cleanName}) وفئات الكروت المعتمدة (${item.cardCategories.join('، ')}) بنجاح.`
    });
    return true;
  };

  const deleteInsuranceContract = async (id: string): Promise<boolean> => {
    if (
      !currentUser ||
      (currentUser.role !== 'admin' &&
        currentUser.role !== 'finance_manager' &&
        !hasPermission(currentUser.role, 'manage_insurance_contracts'))
    ) {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'حذف تعاقدات شركات التأمين مخصص لمدير المالية أو مدير النظام فقط.'
      });
      return false;
    }

    const target = insuranceContracts.find(c => c.id === id);
    if (!target) return false;

    lastSettingsSaveAtRef.current = Date.now();
    const nextContracts = insuranceContracts.filter(c => c.id !== id);
    setInsuranceContracts(nextContracts);
    saveInsuranceContracts(nextContracts);

    if (isSupabaseConfigured) {
      await saveInsuranceContractsToDb(nextContracts);
      lastSettingsSaveAtRef.current = Date.now();
    }

    addToast({
      type: 'info',
      title: 'تم حذف شركة التأمين',
      message: `تمت إزالة تعاقد (${target.companyName}) من قائمة الشركات المعتمدة.`
    });
    return true;
  };

  // ==========================================
  // نظام تسليم واستلام الشفتات والخزينة (الاستقبال + الخزينة)
  // ==========================================
  const createShiftHandover = async (input: {
    department: 'reception' | 'cashier';
    toStaffId: string;
    handoverType: 'reception_shift' | 'cashier_to_management' | 'cashier_to_colleague';
    expectedAmount?: number;
    notes?: string;
  }): Promise<boolean> => {
    if (!currentUser) return false;

    const todayStr = getLocalDateStr(new Date());
    const nowIso = new Date().toISOString();

    // حالة 1: تسليم مبلغ الخزينة للإدارة مباشرة (لا يظهر لزميل الكاشير سؤال هل تم الاستلام)
    if (input.handoverType === 'cashier_to_management') {
      const record: ShiftHandoverRecord = {
        id: `handover-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        department: 'cashier',
        fromStaffId: currentUser.id,
        fromStaffUsername: currentUser.username,
        fromStaffName: currentUser.displayName,
        toStaffId: 'management',
        toStaffUsername: 'management',
        toStaffName: 'الإدارة المالية / الإدارة العليا',
        handoverType: 'cashier_to_management',
        expectedAmount: Number(input.expectedAmount || 0),
        status: 'delivered_to_management',
        notes: input.notes ? sanitizeText(input.notes) : 'تم تسليم عهدة الخزينة مباشرة للإدارة.',
        createdAt: nowIso,
        acknowledgedAt: nowIso,
        shiftDate: todayStr
      };

      const nextList = [record, ...shiftHandovers].slice(0, 150);
      lastSettingsSaveAtRef.current = Date.now();
      setShiftHandovers(nextList);
      saveShiftHandovers(nextList);

      if (isSupabaseConfigured) {
        await saveShiftHandoversToDb(nextList);
        lastSettingsSaveAtRef.current = Date.now();
      }

      addToast({
        type: 'success',
        title: 'تم تسليم المبلغ للإدارة',
        message: 'تم توثيق تسليم مبلغ الخزينة للإدارة بنجاح ولن يظهر إشعار استلام نقدية للزميل القادم.'
      });
      return true;
    }

    // حالة 2 و 3: تسليم الشفت لزميل في الاستقبال أو تسليم الخزينة لزميل كاشير
    const targetStaff = staffAccounts.find(s => s.id === input.toStaffId);
    if (!targetStaff) {
      addToast({
        type: 'error',
        title: 'الموظف غير محدد',
        message: 'يرجى اختيار الموظف المستلم للشفت من القائمة.'
      });
      return false;
    }

    if (input.department === 'reception' && targetStaff.role !== 'reception') {
      addToast({
        type: 'error',
        title: 'تنبيه صلاحية الموظف المستلم',
        message: `الموظف (${targetStaff.displayName}) غير مسجل كمسؤول استقبال في المنظومة! يرجى الرجوع للمدير لتعديل صلاحيته أو اختيار موظف استقبال معتمد.`
      });
      return false;
    }

    if (input.department === 'cashier' && targetStaff.role !== 'cashier') {
      addToast({
        type: 'error',
        title: 'تنبيه صلاحية الموظف المستلم',
        message: `الموظف (${targetStaff.displayName}) غير مسجل كمسؤول خزينة (كاشير) في المنظومة! يرجى الرجوع للمدير لتعديل صلاحيته أو اختيار كاشير معتمد.`
      });
      return false;
    }

    const expectedAmt =
      input.handoverType === 'cashier_to_colleague'
        ? Math.max(0, Number(input.expectedAmount || 0))
        : undefined;

    const record: ShiftHandoverRecord = {
      id: `handover-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      department: input.department,
      fromStaffId: currentUser.id,
      fromStaffUsername: currentUser.username,
      fromStaffName: currentUser.displayName,
      toStaffId: targetStaff.id,
      toStaffUsername: targetStaff.username,
      toStaffName: targetStaff.displayName,
      handoverType: input.handoverType,
      expectedAmount: expectedAmt,
      status: 'pending_colleague',
      notes: input.notes ? sanitizeText(input.notes) : undefined,
      createdAt: nowIso,
      shiftDate: todayStr
    };

    const nextList = [record, ...shiftHandovers].slice(0, 150);
    lastSettingsSaveAtRef.current = Date.now();
    setShiftHandovers(nextList);
    saveShiftHandovers(nextList);

    if (isSupabaseConfigured) {
      await saveShiftHandoversToDb(nextList);
      lastSettingsSaveAtRef.current = Date.now();
    }

    addToast({
      type: 'success',
      title: input.department === 'cashier' ? 'تم تسجيل تسليم الخزينة للزميل' : 'تم تسجيل تسليم شفت الاستقبال',
      message:
        input.department === 'cashier'
          ? `تم إرسال إشعار استلام الخزينة بمبلغ (${expectedAmt} ج.م) للزميل (${targetStaff.displayName}) ليؤكد الاستلام فور فتح حسابه.`
          : `تم تسجيل تسليم شفت الاستقبال للزميل (${targetStaff.displayName}) بنجاح.`
    });
    return true;
  };

  const acknowledgeShiftHandover = async (
    handoverId: string,
    receivedExact: boolean,
    actualReceivedAmount?: number,
    acknowledgmentNotes?: string
  ): Promise<boolean> => {
    if (!currentUser) return false;

    const target = shiftHandovers.find(h => h.id === handoverId);
    if (!target) return false;

    const nowIso = new Date().toISOString();
    const expected = Number(target.expectedAmount || 0);
    const actual = receivedExact ? expected : Math.max(0, Number(actualReceivedAmount ?? 0));
    const newStatus: ShiftHandoverRecord['status'] = receivedExact
      ? 'accepted_exact'
      : 'discrepancy_reported';

    const nextList = shiftHandovers.map(h =>
      h.id === handoverId
        ? {
            ...h,
            status: newStatus,
            actualReceivedAmount: actual,
            acknowledgmentNotes: acknowledgmentNotes ? sanitizeText(acknowledgmentNotes) : undefined,
            acknowledgedAt: nowIso
          }
        : h
    );

    lastSettingsSaveAtRef.current = Date.now();
    setShiftHandovers(nextList);
    saveShiftHandovers(nextList);

    if (isSupabaseConfigured) {
      await saveShiftHandoversToDb(nextList);
      lastSettingsSaveAtRef.current = Date.now();
    }

    addToast({
      type: receivedExact ? 'success' : 'warning',
      title: receivedExact ? 'تم تأكيد استلام الشفت بالكامل' : 'تم تسجيل المبلغ الفعلي المستلم وفرق العهدة',
      message: receivedExact
        ? 'تم توثيق استلامك للعهدة والمبلغ مطابق تماماً لما سلمه الزميل.'
        : `تم تسجيل المبلغ الفعلي المستلم (${actual} ج.م) بدلاً من (${expected} ج.م) وإبلاغ مدير المالية والإدارة بالفرق.`
    });
    return true;
  };

  // ==========================================
  // نافذة المسح والتفريغ الانتقائي للسجلات (لمدير المالية والأدمن)
  // ==========================================
  const selectivePurgeRecords = async (
    options: SelectivePurgeOptions
  ): Promise<{ success: boolean; summary: string }> => {
    if (
      !currentUser ||
      (currentUser.role !== 'admin' &&
        currentUser.role !== 'finance_manager' &&
        !hasPermission(currentUser.role, 'selective_data_purge'))
    ) {
      addToast({
        type: 'error',
        title: 'غير مصرح',
        message: 'تفريغ ومسح السجلات مخصص لمدير المالية أو مدير النظام فقط.'
      });
      return { success: false, summary: 'غير مصرح' };
    }

    const actionsSummary: string[] = [];
    const todayStr = getLocalDateStr(new Date());

    activeMutationsCountRef.current += 1;
    lastMutationAtRef.current = Date.now();
    lastSettingsSaveAtRef.current = Date.now();

    try {
      // 1. مسح كل الحجوزات أو حجوزات الأيام السابقة
      if (options.purgeAllBookings) {
        const count = bookings.length;
        for (const item of bookings) {
          if (item?.id) markBookingDeletedLocally(item.id);
        }
        setSelectedTicket(null);
        removeBookingsBeforeDate('9999-12-31');
        setBookings([]);
        saveBookings([]);
        saveInsuranceBookingsMap({});
        if (isSupabaseConfigured) {
          await deleteBookingsBeforeDateFromDb('9999-12-31');
          await saveInsuranceBookingsMapToDb({});
        }
        actionsSummary.push(`مسح جميع الحجوزات بالكامل (${count} سجل)`);
      } else if (options.purgePastBookings) {
        const cutoff = options.beforeDate || todayStr;
        const toRemove = bookings.filter(b => b.date < cutoff);
        const remaining = bookings.filter(b => b.date >= cutoff && b.notes !== '__PURGED_PAST_BOOKING__');
        for (const item of toRemove) {
          if (item?.id) markBookingDeletedLocally(item.id);
        }
        removeBookingsBeforeDate(cutoff);
        setBookings(remaining);
        saveBookings(remaining);

        // تنظيف تفاصيل التأمين للحجوزات المحذوفة لتوفير المساحة
        const insMap = getStoredInsuranceBookingsMap();
        const remainingIds = new Set(remaining.map(b => b.id));
        const prunedInsMap: Record<string, BookingInsuranceDetails> = {};
        for (const [k, v] of Object.entries(insMap)) {
          if (remainingIds.has(k)) prunedInsMap[k] = v;
        }
        saveInsuranceBookingsMap(prunedInsMap);

        if (isSupabaseConfigured) {
          await deleteBookingsBeforeDateFromDb(cutoff);
          await saveInsuranceBookingsMapToDb(prunedInsMap);
        }
        actionsSummary.push(`مسح حجوزات ما قبل ${cutoff} (${toRemove.length} سجل)`);
      }

      // 2. مسح سجلات تسليم واستلام الشفتات والخزينة
      if (options.purgeShiftHandovers) {
        const count = shiftHandovers.length;
        setShiftHandovers([]);
        saveShiftHandovers([]);
        if (isSupabaseConfigured) {
          await saveShiftHandoversToDb([]);
        }
        actionsSummary.push(`مسح سجلات تسليم الشفتات والخزينة (${count} سجل)`);
      }

      // 3. مسح بصمات الاستشارة المجانية
      if (options.purgeConsultationStamps) {
        const count = consultationRegistry.stamps.length;
        const clearedReg: ConsultationRegistryState = {
          ...consultationRegistry,
          stamps: [],
          consultationBookingIds: []
        };
        const savedReg = saveConsultationRegistry(clearedReg, todayStr);
        setConsultationRegistry(savedReg);
        if (isSupabaseConfigured) {
          await saveConsultationRegistryToDb(savedReg);
        }
        actionsSummary.push(`تصفير بصمات الاستشارات المجانية (${count} بصمة)`);
      }

      // 4. مسح سجلات إشعارات الواتساب والطباعة الحرارية
      if (options.purgeWhatsAppAndPrintLogs) {
        clearWhatsAppAndPrintLogs();
        actionsSummary.push('تطهير سجلات الواتساب والطباعة الحرارية');
      }

      // 5. مسح سجلات أخطاء النظام
      if (options.purgeSystemErrorLogs) {
        const count = errorLogs.length;
        setErrorLogs([]);
        saveErrorLogs([]);
        savePendingErrorLogs([]);
        if (isSupabaseConfigured) {
          await saveSettingToDb('system_error_logs_json', JSON.stringify([]));
        }
        actionsSummary.push(`مسح سجلات أخطاء النظام (${count} سجل)`);
      }

      const finalSummary =
        actionsSummary.length > 0
          ? `تم بنجاح: ${actionsSummary.join(' + ')}.`
          : 'لم يتم تحديد أي سجلات للمسح.';

      if (actionsSummary.length > 0) {
        addToast({
          type: 'success',
          title: 'تم تنظيف وتفريغ السجلات المحددة',
          message: finalSummary
        });
      }

      return { success: actionsSummary.length > 0, summary: finalSummary };
    } finally {
      lastMutationAtRef.current = Date.now();
      activeMutationsCountRef.current = Math.max(0, activeMutationsCountRef.current - 1);
    }
  };

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        currentUser,
        activeView,
        currentView: activeView,
        navigate,
        login,
        logout,
        clinics,
        doctors,
        bookings,
        selectedTicket,
        setSelectedTicket,
        dailySchedule,
        updateDailySchedule,
        rolePermissions,
        updateRolePermissions,
        hasPermission,
        supportInfoText,
        updateSupportInfoText,
        officialWorkingHours,
        updateOfficialWorkingHours,
        consultationRegistry,
        consultationWindowDays: consultationRegistry.windowDays,
        activeConsultationStampsCount: consultationRegistry.stamps.length,
        updateConsultationWindowDays,
        updateConsultationSettings,
        checkConsultationEligibility,
        getActiveClinicsForBooking,
        createBooking,
        updateBookingStatus,
        updatePaymentStatus,
        deleteBooking,
        updateDoctorStatus,
        updateDoctorSchedule,
        updateDoctorMaxBookings,
        checkClinicAvailabilityStatus,
        admitPatient,
        callNextPatientInClinic,
        markPatientLate,
        restoreLatePatient,
        addDoctorDiagnosis,
        addClinic,
        updateClinic,
        deleteClinic,
        addDoctor,
        updateDoctor,
        deleteDoctor,
        resetToInitialData,
        resetPasswordByAdmin,
        staffAccounts,
        createStaffAccount,
        deleteStaffAccount,
        updateStaffRecoveryEmail,
        updateStaffAccount,
        toasts,
        addToast,
        removeToast,
        patientHistoryModalOpen,
        setPatientHistoryModalOpen,
        patientHistoryPhone,
        setPatientHistoryPhone,
        toggleClinicStatus,
        clearPastBookings,
        errorLogs,
        logSystemError,
        resolveErrorLog,
        resolveAllErrorLogs,
        deleteErrorLog,
        clearAllErrorLogs,
        syncErrorLogsNow,
        insuranceContracts,
        saveInsuranceContract,
        deleteInsuranceContract,
        shiftHandovers,
        createShiftHandover,
        acknowledgeShiftHandover,
        selectivePurgeRecords
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
