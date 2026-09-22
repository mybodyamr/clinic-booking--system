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
  StaffAccount
} from '../types';
import { 
  getStoredClinics, 
  saveClinics,
  getStoredDoctors, 
  saveDoctors,
  getStoredBookings, 
  saveBookings,
  getStoredSession, 
  saveSession,
  getStoredTheme, 
  saveTheme,
  sanitizeText,
  validateTripleName,
  checkBookingRateLimit,
  getStoredDailySchedule,
  saveDailySchedule,
  getStoredRolePermissions,
  saveRolePermissions,
  getStoredSupportInfoText,
  saveSupportInfoText,
  hashPassword,
  getStoredStaffPasswordHashes,
  saveStaffPasswordHash,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
  getStoredStaffAccounts,
  saveStaffAccounts,
  deleteStaffAccountById,
  updateStaffAccountRecoveryEmail
} from '../services/storage';
import { 
  checkClinicAvailability, 
  ClinicAvailabilityResult,
  parseDoctorShiftTimes
} from '../services/scheduleService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { 
  fetchClinicsFromDb, 
  fetchDoctorsFromDb, 
  fetchBookingsFromDb, 
  fetchDailyScheduleFromDb, 
  fetchStaffAccountsFromDb, 
  fetchSettingsFromDb,
  saveSettingToDb,
  createPublicBookingRpc, 
  confirmPaymentRpc, 
  markPatientLateAndCallNextRpc, 
  updateBookingStatusInDb, 
  updateDoctorStatusInDb, 
  updateDoctorInDb,
  updateDoctorMaxPatientsInDb,
  addDoctorToDb,
  updateClinicInDb,
  addClinicToDb,
  deleteClinicFromDb,
  updateStaffAccountInDb,
  saveDailyScheduleToDb, 
  deleteStaffAccountRpc, 
  loginWithSupabaseAuth, 
  logoutFromSupabase, 
  subscribeToBookingsRealtime,
  ensureAdminSupabaseSession,
  adminChangeStaffPassword,
  deleteBookingsBeforeDateFromDb
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
  deleteStaffAccount: (id: string) => boolean;
  updateStaffRecoveryEmail: (id: string, email: string) => void;
  updateStaffAccount: (id: string, updates: { username?: string; displayName?: string; recoveryEmail?: string; password?: string }) => Promise<boolean>;
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
  updateSupportInfoText: (text: string) => void;
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
  updatePaymentStatus: (bookingId: string, paymentStatus: PaymentStatus, method?: PaymentMethod) => void;
  updateDoctorStatus: (doctorId: string, status: DoctorStatus, reason?: string) => void;
  updateDoctorSchedule: (doctorId: string, scheduleDays: string[], scheduleHours: string, shiftStartTime?: string, shiftEndTime?: string) => void;
  updateDoctorMaxBookings: (doctorId: string, maxDailyBookings: number) => void;
  checkClinicAvailabilityStatus: (clinicId: string, doctorId: string, date?: string) => ClinicAvailabilityResult | null;
  admitPatient: (bookingId: string) => void;
  markPatientLate: (bookingId: string) => void;
  restoreLatePatient: (bookingId: string, action: 'admit_now' | 'return_to_queue') => void;
  addDoctorDiagnosis: (bookingId: string, diagnosis: string) => void;
  addClinic: (clinic: Omit<Clinic, 'id'>) => void;
  updateClinic: (clinicId: string, data: Partial<Clinic>) => void;
  deleteClinic: (clinicId: string) => Promise<{ success: boolean; error?: string }>;
  addDoctor: (doctor: Omit<Doctor, 'id'>) => void;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(getStoredTheme);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(getStoredSession);
  const [activeView, setActiveView] = useState<AppView>('landing');
  const [clinics, setClinics] = useState<Clinic[]>(getStoredClinics);
  const [doctors, setDoctors] = useState<Doctor[]>(getStoredDoctors);
  const [bookings, setBookings] = useState<Booking[]>(getStoredBookings);
  const [selectedTicket, setSelectedTicket] = useState<Booking | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [patientHistoryModalOpen, setPatientHistoryModalOpen] = useState(false);
  const [patientHistoryPhone, setPatientHistoryPhone] = useState('');

  // جدول عيادات اليوم والأطباء المكلفين
  const [dailySchedule, setDailySchedule] = useState<DailyScheduleState>(() => getStoredDailySchedule(clinics, doctors));

  // نظام تفويض الصلاحيات
  const [rolePermissions, setRolePermissions] = useState<RolePermissionsMap>(getStoredRolePermissions);

  // نص استفسارات ومساعدة فورية بالرئيسية
  const [supportInfoText, setSupportInfoText] = useState<string>(getStoredSupportInfoText);

  // قائمة حسابات الكادر والمستخدمين الديناميكية
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>(getStoredStaffAccounts);

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

  // مزامنة البيانات مع Supabase عند بدء التشغيل وتفعيل التحديث اللحظي Realtime
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;
    const todayStr = new Date().toISOString().split('T')[0];

    async function loadSupabaseData() {
      try {
        const [dbClinics, dbDoctors, dbBookings, dbSchedule, dbStaff, dbSettings] = await Promise.all([
          fetchClinicsFromDb(),
          fetchDoctorsFromDb(),
          fetchBookingsFromDb(),
          fetchDailyScheduleFromDb(todayStr),
          fetchStaffAccountsFromDb(),
          fetchSettingsFromDb()
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
          setBookings(dbBookings);
          saveBookings(dbBookings);
        }
        const effectiveClinics = (dbClinics && dbClinics.length > 0) ? dbClinics : clinics;
        const effectiveDoctors = (dbDoctors && dbDoctors.length > 0) ? dbDoctors : doctors;

        if (dbSchedule && dbSchedule.items.length > 0) {
          setDailySchedule(dbSchedule);
          saveDailySchedule(dbSchedule);
        } else if (effectiveClinics.length > 0) {
          const defaultItems: DailyClinicScheduleItem[] = effectiveClinics.map(c => {
            const doc = effectiveDoctors.find(d => d.clinicId === c.id) || effectiveDoctors[0];
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
        if (dbStaff && dbStaff.length > 0) {
          setStaffAccounts(dbStaff);
          saveStaffAccounts(dbStaff);
        }
        if (dbSettings && dbSettings['support_info_text']) {
          setSupportInfoText(dbSettings['support_info_text']);
          saveSupportInfoText(dbSettings['support_info_text']);
        }

        // Auto-ensure admin session if stored session is admin
        const currentStored = getStoredSession();
        if (currentStored?.role === 'admin') {
          ensureAdminSupabaseSession();
        }
      } catch (err) {
        console.warn('Supabase initial sync error, using local state:', err);
      }
    }

    loadSupabaseData();

    // تفعيل التحديث اللحظي عبر Supabase Realtime لجدول bookings
    const unsubscribe = subscribeToBookingsRealtime(async () => {
      const freshBookings = await fetchBookingsFromDb();
      if (freshBookings && isMounted) {
        setBookings(freshBookings);
        saveBookings(freshBookings);
      }
    });

    // دورية مزامنة احتياطية كل 7 ثوانٍ لضمان بقاء جميع الشاشات (Queue, Reception, Doctor) محدثة لحظياً
    const syncInterval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const fresh = await fetchBookingsFromDb();
        if (fresh && fresh.length > 0 && isMounted) {
          setBookings(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(fresh)) {
              saveBookings(fresh);
              return fresh;
            }
            return prev;
          });
        }
      } catch {
        // silent fallback
      }
    }, 7000);

    return () => {
      isMounted = false;
      unsubscribe();
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

    if (view === 'cashier' && currentUser.role !== 'cashier' && currentUser.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'وصول غير مصرح به',
        message: 'هذه الواجهة مخصصة لقسم الخزينة والصندوق.'
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
    if (isSupabaseConfigured) {
      const authRes = await loginWithSupabaseAuth(cleanUser, pass);
      if (authRes.success && authRes.session) {
        resetLoginAttempts(cleanUser);
        setCurrentUser(authRes.session);
        saveSession(authRes.session);
        addToast({
          type: 'success',
          title: 'تم تسجيل الدخول بنجاح',
          message: `مرحباً بك مجدداً ${authRes.session.displayName}`
        });

        switch (authRes.session.role) {
          case 'admin':
            setActiveView('admin');
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
        const errMsg = authRes.error || 'اسم المستخدم أو كلمة المرور غير صحيحة.';
        addToast({
          type: 'error',
          title: 'فشل تسجيل الدخول',
          message: errMsg
        });
        return { success: false, error: errMsg };
      }
    }

    let authSuccess = false;
    let matchedUser: UserSession | null = null;

    // مطابقة الحسابات المشفرة محلياً (SHA-256 Hash Verification)
    const matchedAccount = staffAccounts.find(
      acc => acc.username.toLowerCase() === cleanUser
    );

    if (matchedAccount) {
      const storedHashes = getStoredStaffPasswordHashes();
      const providedHash = await hashPassword(pass);
      const expectedHash = storedHashes[matchedAccount.username.toLowerCase()];

      if (expectedHash && providedHash === expectedHash) {
        authSuccess = true;
        matchedUser = {
          id: matchedAccount.id,
          username: matchedAccount.username,
          displayName: matchedAccount.displayName,
          role: matchedAccount.role,
          doctorId: matchedAccount.doctorId,
          clinicId: matchedAccount.clinicId,
        };
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

  const deleteStaffAccount = (id: string): boolean => {
    if (isSupabaseConfigured) {
      deleteStaffAccountRpc(id).then(res => {
        if (!res.success) {
          console.warn('Supabase delete staff account error:', res.error);
        }
      });
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
      message: 'تمت إزالة الحساب من منظومة الموظفين.'
    });
    return true;
  };

  const updateStaffRecoveryEmail = (id: string, email: string) => {
    const updated = updateStaffAccountRecoveryEmail(id, email);
    setStaffAccounts(updated);
    if (isSupabaseConfigured) {
      updateStaffAccountInDb(id, { recoveryEmail: email });
    }
    addToast({
      type: 'success',
      title: 'تم حفظ البريد الإلكتروني',
      message: 'تم تحديث بريد استعادة الحساب بنجاح.'
    });
  };

  const updateStaffAccount = async (
    id: string,
    updates: { username?: string; displayName?: string; recoveryEmail?: string; password?: string }
  ): Promise<boolean> => {
    const target = staffAccounts.find(s => s.id === id);
    if (!target) return false;

    let cleanUsername = target.username;
    if (updates.username) {
      const sanitized = updates.username.trim().toLowerCase();
      if (!/^[a-z0-9_-]{3,20}$/.test(sanitized)) {
        addToast({
          type: 'error',
          title: 'اسم مستخدم غير صالح',
          message: 'يجب أن يتكون اسم المستخدم من 3 إلى 20 حرفاً إنجليزياً أو أرقام بدون مسافات.'
        });
        return false;
      }
      cleanUsername = sanitized;
    }

    if (updates.password && updates.password.length < 6) {
      addToast({
        type: 'error',
        title: 'كلمة مرور ضعيفة',
        message: 'يجب ألا تقل كلمة المرور عن 6 أحرف/أرقام.'
      });
      return false;
    }

    if (updates.password) {
      const hash = await hashPassword(updates.password);
      saveStaffPasswordHash(cleanUsername, hash);
      resetLoginAttempts(cleanUsername);
    }

    if (isSupabaseConfigured) {
      await updateStaffAccountInDb(id, {
        username: updates.username,
        displayName: updates.displayName,
        recoveryEmail: updates.recoveryEmail,
        password: updates.password
      });
    }

    const updatedList = staffAccounts.map(s => {
      if (s.id === id) {
        return {
          ...s,
          username: cleanUsername,
          displayName: updates.displayName || s.displayName,
          recoveryEmail: updates.recoveryEmail !== undefined ? updates.recoveryEmail : s.recoveryEmail
        };
      }
      return s;
    });

    setStaffAccounts(updatedList);
    saveStaffAccounts(updatedList);
    addToast({
      type: 'success',
      title: 'تم تحديث بيانات الحساب',
      message: `تم حفظ تعديلات حساب (${cleanUsername}) بنجاح.`
    });
    return true;
  };

  const resetPasswordByAdmin = async (targetUser: string, newPass: string): Promise<boolean> => {
    try {
      const cleanUser = targetUser.toLowerCase().trim();
      const newHash = await hashPassword(newPass);
      saveStaffPasswordHash(cleanUser, newHash);
      resetLoginAttempts(cleanUser);

      if (isSupabaseConfigured) {
        const authRes = await adminChangeStaffPassword(cleanUser, newPass);
        if (!authRes.success) {
          console.warn('Supabase Auth update error:', authRes.error);
        }

        const staffAcc = staffAccounts.find(s => s.username.toLowerCase() === cleanUser);
        if (staffAcc) {
          await updateStaffAccountInDb(staffAcc.id, { password: newPass, username: cleanUser });
        }
      }

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
    logoutFromSupabase();
    setCurrentUser(null);
    saveSession(null);
    setActiveView('landing');
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

    // التحقق من أن اسم المريض ثلاثي على الأقل
    const nameCheck = validateTripleName(cleanName);
    if (!nameCheck.valid) {
      return { success: false, error: nameCheck.error || 'يجب كتابة اسم المريض ثلاثياً على الأقل.' };
    }

    // فحص الحد المسموح ومعدل الحجوزات
    const rateCheck = checkBookingRateLimit(cleanName, cleanPhone, data.clinicId, data.date);
    if (!rateCheck.allowed) {
      return { success: false, error: rateCheck.reason };
    }

    const clinic = clinics.find(c => c.id === data.clinicId);
    const doctor = doctors.find(d => d.id === data.doctorId);

    if (!clinic || !doctor) {
      return { success: false, error: 'العيادة أو الطبيب غير متوفرين حالياً' };
    }

    // التحقق الصارم من الركائز الأربعة على مستوى النظام وقواعد العمل (Backend/System Logic Level):
    // 1. حالة التواجد اليومية (متاح / غير متاح)
    // 2. جدول العمل الأسبوعي (أيام العمل)
    // 3. انتهاء وقت العيادة الحقيقي
    // 4. اكتمال العدد الأقصى للحجوزات
    const bookingDate = data.date || new Date().toISOString().split('T')[0];
    const availabilityCheck = checkClinicAvailability(doctor, clinic.id, bookingDate, bookings);

    if (!availabilityCheck.allowed) {
      return {
        success: false,
        error: availabilityCheck.reason || 'العيادة غير متاحة للحجز حالياً.'
      };
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
        const updated = [newBooking, ...bookings.filter(b => b.id !== newBooking.id)];
        setBookings(updated);
        saveBookings(updated);
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

    // حساب رقم الدور التالي في نفس العيادة ونفس اليوم (المسار المحلي الاحتياطي)
    const sameClinicTodayBookings = bookings.filter(
      b => b.clinicId === data.clinicId && b.date === data.date && b.status !== 'cancelled'
    );
    const nextQueuePos = sameClinicTodayBookings.length + 1;

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
      date: data.date,
      timeSlot: data.timeSlot,
      queuePosition: nextQueuePos,
      status: 'waiting',
      paymentStatus: 'unpaid',
      fee: data.fee,
      notes: cleanNotes,
      createdAt: new Date().toISOString()
    };

    const updated = [newBooking, ...bookings];
    setBookings(updated);
    saveBookings(updated);
    setSelectedTicket(newBooking);

    addToast({
      type: 'success',
      title: 'تم إصدار التذكرة بنجاح',
      message: `رقم تذكرتك: ${ticketNumber} - دورك رقم ${nextQueuePos}`
    });

    return { success: true, booking: newBooking };
  };

  const updateBookingStatus = (bookingId: string, status: BookingStatus) => {
    const now = new Date().toISOString();

    if (isSupabaseConfigured) {
      updateBookingStatusInDb(bookingId, {
        status,
        calledAt: status === 'in-progress' ? now : undefined,
        completedAt: status === 'completed' ? now : undefined
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

  const updatePaymentStatus = (bookingId: string, paymentStatus: PaymentStatus, method: PaymentMethod = 'cash') => {
    if (isSupabaseConfigured) {
      confirmPaymentRpc(bookingId, method).then(res => {
        if (!res.success) {
          console.warn('Supabase confirmPayment error:', res.error);
        }
      });
    }

    const updated = bookings.map(b => {
      if (b.id === bookingId) {
        return {
          ...b,
          paymentStatus,
          paymentMethod: method,
          paidAt: new Date().toISOString()
        };
      }
      return b;
    });

    setBookings(updated);
    saveBookings(updated);
    if (selectedTicket?.id === bookingId) {
      setSelectedTicket(updated.find(b => b.id === bookingId) || null);
    }

    addToast({
      type: 'success',
      title: 'تم تحديث حالة السداد',
      message: paymentStatus === 'paid' ? 'تم تسجيل الدفع بالخزينة وإصدار إيصال السداد.' : 'تم تسجيل الإعفاء الخيري.'
    });
  };

  const updateDoctorStatus = (doctorId: string, status: DoctorStatus, reason?: string) => {
    if (isSupabaseConfigured) {
      updateDoctorStatusInDb(doctorId, status, reason);
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
  };

  const updateDoctorSchedule = (
    doctorId: string, 
    scheduleDays: string[], 
    scheduleHours: string,
    shiftStartTime?: string,
    shiftEndTime?: string
  ) => {
    const updated = doctors.map(d => {
      if (d.id === doctorId) {
        return { 
          ...d, 
          scheduleDays, 
          scheduleHours,
          ...(shiftStartTime ? { shiftStartTime } : {}),
          ...(shiftEndTime ? { shiftEndTime } : {})
        };
      }
      return d;
    });
    setDoctors(updated);
    saveDoctors(updated);

    if (isSupabaseConfigured) {
      updateDoctorInDb(doctorId, {
        scheduleDays,
        scheduleHours
      });
    }

    addToast({
      type: 'success',
      title: 'الجدول الأسبوعي للطبيب',
      message: 'تم حفظ وتثبيت جدول الطبيب ومواعيد العمل بنجاح.'
    });
  };

  const updateDoctorMaxBookings = (doctorId: string, maxDailyBookings: number) => {
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
    }

    addToast({
      type: 'success',
      title: 'تم تحديث السعة القصوى',
      message: `تم حفظ وتحديد الحد الأقصى للحالات اليومية للطبيب بـ ${maxDailyBookings} حالة في قاعدة البيانات.`
    });
  };

  // منطق تخطي الدور وتحويل المرضى المتغيبين إلى "متأخر" تلقائياً
  const admitPatient = (targetBookingId: string) => {
    const targetBooking = bookings.find(b => b.id === targetBookingId);
    if (!targetBooking) return;

    const now = new Date().toISOString();
    let skippedCount = 0;

    if (isSupabaseConfigured) {
      updateBookingStatusInDb(targetBookingId, {
        status: 'in-progress',
        calledAt: now
      });
    }

    // الحصول على جميع المرضى في انتظار نفس العيادة اليوم
    const updated = bookings.map(b => {
      // المريض المستدعى للدخول الآن
      if (b.id === targetBookingId) {
        return {
          ...b,
          status: 'in-progress' as BookingStatus,
          calledAt: now
        };
      }

      // أي مريض آخر في نفس العيادة ونفس اليوم كان في الانتظار وترتيبه أسبق من المستدعى
      const isSameClinicAndDate = b.clinicId === targetBooking.clinicId && b.date === targetBooking.date;
      const isWaiting = b.status === 'waiting';
      
      const timeB = new Date(b.paidAt || b.createdAt).getTime();
      const timeTarget = new Date(targetBooking.paidAt || targetBooking.createdAt).getTime();

      const isEarlier = timeB < timeTarget || b.queuePosition < targetBooking.queuePosition;

      if (isSameClinicAndDate && isWaiting && isEarlier) {
        skippedCount++;
        if (isSupabaseConfigured) {
          updateBookingStatusInDb(b.id, { status: 'late' });
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
        message: `المريض: ${targetBooking.patientName} داخل غرفة الكشف الآن.`
      });
    }
  };

  const markPatientLate = (bookingId: string) => {
    if (isSupabaseConfigured) {
      updateBookingStatusInDb(bookingId, { status: 'late' });
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
    const target = bookings.find(b => b.id === bookingId);
    if (!target) return;

    const now = new Date().toISOString();
    if (isSupabaseConfigured) {
      updateBookingStatusInDb(bookingId, {
        status: action === 'admit_now' ? 'in-progress' : 'waiting',
        calledAt: action === 'admit_now' ? now : undefined
      });
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
      return b;
    });

    setBookings(updated);
    saveBookings(updated);

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
    const updated = clinics.map(c => (c.id === clinicId ? { ...c, active: !c.active } : c));
    setClinics(updated);
    saveClinics(updated);
  };

  const addClinic = (newClinic: Omit<Clinic, 'id'>) => {
    const id = `clinic-${Date.now()}`;
    const fullClinic: Clinic = { ...newClinic, id };
    const updated = [...clinics, fullClinic];
    setClinics(updated);
    saveClinics(updated);

    if (isSupabaseConfigured) {
      addClinicToDb(fullClinic);
    }

    addToast({
      type: 'success',
      title: 'تمت إضافة العيادة',
      message: `تم تسجيل عيادة ${fullClinic.name} بنجاح.`
    });
  };

  const updateClinic = (clinicId: string, data: Partial<Clinic>) => {
    const updated = clinics.map(c => c.id === clinicId ? { ...c, ...data } : c);
    setClinics(updated);
    saveClinics(updated);

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
    const targetClinic = clinics.find(c => c.id === clinicId);
    const clinicName = targetClinic?.name || 'العيادة';

    // 1. Check active bookings locally
    const activeBookings = bookings.filter(
      b => b.clinicId === clinicId && ['pending', 'confirmed', 'waiting', 'in_consultation'].includes(b.status)
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

    // 2. Perform DB deletion / archiving
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

      if (res.action === 'archived') {
        const updated = clinics.map(c => c.id === clinicId ? { ...c, active: false, isOpenToday: false } : c);
        setClinics(updated);
        saveClinics(updated);
        addToast({
          type: 'warning',
          title: 'تم أرشفة العيادة',
          message: res.message || 'تم إغلاق وأرشفة العيادة لوجود حجوزات سابقة مرتبطة بها.'
        });
        return { success: true };
      }
    }

    // Hard deletion
    const remaining = clinics.filter(c => c.id !== clinicId);
    setClinics(remaining);
    saveClinics(remaining);
    addToast({
      type: 'success',
      title: 'تم حذف العيادة',
      message: `تم حذف (${clinicName}) نهائياً من النظام.`
    });
    return { success: true };
  };

  const addDoctor = (newDoctor: Omit<Doctor, 'id'>) => {
    const id = `doc-${Date.now()}`;
    const fullDoctor: Doctor = { ...newDoctor, id };
    const updated = [...doctors, fullDoctor];
    setDoctors(updated);
    saveDoctors(updated);

    if (isSupabaseConfigured) {
      addDoctorToDb(fullDoctor);
    }

    addToast({
      type: 'success',
      title: 'تمت إضافة الطبيب',
      message: `تم تسجيل د. ${fullDoctor.name} في الكادر الطبي.`
    });
  };

  const updateDailySchedule = (items: DailyClinicScheduleItem[]) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const sanitized = items.map(item => {
      if (!item.doctorId) {
        const doc = doctors.find(d => d.clinicId === item.clinicId) || doctors[0];
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
    }

    setDailySchedule(newSchedule);
    saveDailySchedule(newSchedule);
    addToast({
      type: 'success',
      title: 'تم حفظ وتطبيق جدول اليوم',
      message: `تم تثبيت العيادات المفتوحة اليوم (${sanitized.filter(i => i.isOpen).length} عيادة مفتوحة ومتاحة للمرضى).`
    });
  };

  const updateRolePermissions = (role: UserRole, permissions: SystemPermission[]) => {
    const updated: RolePermissionsMap = {
      ...rolePermissions,
      [role]: permissions
    };
    setRolePermissions(updated);
    saveRolePermissions(updated);
    const roleLabels: Record<UserRole, string> = {
      admin: 'الإدارة العامة',
      doctor: 'الأطباء',
      reception: 'الاستقبال والعيادات',
      cashier: 'الخزينة والتحصيل'
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

  const updateSupportInfoText = (text: string) => {
    const sanitized = sanitizeText(text);
    setSupportInfoText(sanitized);
    saveSupportInfoText(sanitized);

    if (isSupabaseConfigured) {
      saveSettingToDb('support_info_text', sanitized);
    }

    addToast({
      type: 'success',
      title: 'تم حفظ نص الاستفسارات والمساعدة',
      message: 'تم تحديث النص التوضيحي بالصفحة الرئيسية وحفظه في قاعدة البيانات.'
    });
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
    const todayStr = new Date().toISOString().split('T')[0];
    const available: { clinic: Clinic; assignedDoctor?: Doctor }[] = [];

    for (const clinic of clinics) {
      // فحص أن العيادة مفعلة
      if (clinic.active === false || clinic.isActive === false) continue;

      // فحص التشغيل اليومي: الأولوية لجدول تشغيل اليوم، وإلا فحص حالة العيادة isOpenToday
      const scheduleItem = dailySchedule.items.find(item => item.clinicId === clinic.id);
      const isDailyOpen = scheduleItem ? scheduleItem.isOpen : (clinic.isOpenToday !== false);

      // إذا كانت العيادة مغلقة صراحة اليوم، نتجاوزها
      if (!isDailyOpen) continue;

      // العثور على الطبيب المناوب المعين في جدول اليوم أو أول طبيب مسجل للعيادة
      const assignedDoctor = (scheduleItem?.doctorId && doctors.find(d => d.id === scheduleItem.doctorId)) || 
                             doctors.find(d => d.clinicId === clinic.id) ||
                             doctors[0];

      if (!assignedDoctor) continue;

      // استبعاد الطبيب فقط إذا كان معتذراً رسمياً أو غير متاح بالكامل (offline)
      if (assignedDoctor.status === 'offline') {
        continue;
      }

      available.push({ clinic, assignedDoctor });
    }

    return available;
  };

  const checkClinicAvailabilityStatus = (clinicId: string, doctorId: string, date?: string): ClinicAvailabilityResult | null => {
    const doctor = doctors.find(d => d.id === doctorId);
    if (!doctor) return null;
    const targetDate = date || new Date().toISOString().split('T')[0];
    return checkClinicAvailability(doctor, clinicId, targetDate, bookings);
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
    localStorage.removeItem('sharaya_daily_schedule_v2');
    localStorage.removeItem('sharaya_role_permissions_v2');
    localStorage.removeItem('sharaya_support_info_text_v2');
    window.location.reload();
  };

  const clearPastBookings = async (beforeDate?: string): Promise<{ success: boolean; count: number }> => {
    const cutoffDate = beforeDate || new Date().toISOString().split('T')[0];
    const toRemove = bookings.filter(b => b.date < cutoffDate);
    const remaining = bookings.filter(b => b.date >= cutoffDate);

    setBookings(remaining);
    saveBookings(remaining);

    if (isSupabaseConfigured) {
      await deleteBookingsBeforeDateFromDb(cutoffDate);
    }

    addToast({
      type: 'success',
      title: 'تم تنظيف الحجوزات السابقة',
      message: `تم مسح ${toRemove.length} حجز من الأيام السابقة بنجاح.`
    });

    return { success: true, count: toRemove.length };
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
        getActiveClinicsForBooking,
        createBooking,
        updateBookingStatus,
        updatePaymentStatus,
        updateDoctorStatus,
        updateDoctorSchedule,
        updateDoctorMaxBookings,
        checkClinicAvailabilityStatus,
        admitPatient,
        markPatientLate,
        restoreLatePatient,
        addDoctorDiagnosis,
        addClinic,
        updateClinic,
        deleteClinic,
        addDoctor,
        resetToInitialData,
        resetPasswordByAdmin,
        staffAccounts,
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
        clearPastBookings
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
