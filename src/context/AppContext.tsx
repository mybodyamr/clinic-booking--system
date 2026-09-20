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

    try {
      // Supabase Auth is the single source of truth for credentials and sessions.
      const email = `${cleanUser}@accounts.sharaya-clinics.internal`;
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (authError || !authData.user) {
        const message = 'اسم المستخدم أو كلمة المرور غير صحيحة.';
        addToast({ type: 'error', title: 'فشل تسجيل الدخول', message });
        return { success: false, error: message };
      }

      const { data: account, error: accountError } = await supabase
        .from('staff_accounts')
        .select('id, username, display_name, role, doctor_id, clinic_id, recovery_email')
        .eq('auth_user_id', authData.user.id)
        .single();

      if (accountError || !account) {
        await supabase.auth.signOut();
        const message = 'تم التحقق من الحساب لكن لم يتم العثور على بيانات الموظف.';
        addToast({ type: 'error', title: 'تعذر تحميل الحساب', message });
        return { success: false, error: message };
      }

      const matchedUser: UserSession = {
        id: account.id,
        username: account.username,
        displayName: account.display_name,
        role: account.role,
        doctorId: account.doctor_id || undefined,
        clinicId: account.clinic_id || undefined,
      };

      setCurrentUser(matchedUser);
      saveSession(matchedUser);
      addToast({
        type: 'success',
        title: 'تم تسجيل الدخول بنجاح',
        message: `مرحباً بك مجدداً ${matchedUser.displayName}`
      });

      switch (matchedUser.role) {
        case 'admin': setActiveView('admin'); break;
        case 'doctor': setActiveView('doctor'); break;
        case 'reception': setActiveView('reception'); break;
        case 'cashier': setActiveView('cashier'); break;
        default: setActiveView('landing');
      }

      return { success: true };
    } catch (error) {
      console.error('Supabase login error:', error);
      const message = 'تعذر الاتصال بخدمة تسجيل الدخول. تأكد من إعداد Supabase ثم حاول مرة أخرى.';
      addToast({ type: 'error', title: 'خطأ في الاتصال', message });
      return { success: false, error: message };
    }
  };

  const deleteStaffAccount = (id: string): boolean => {
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
    addToast({
      type: 'success',
      title: 'تم حفظ البريد الإلكتروني',
      message: 'تم تحديث بريد استعادة الحساب بنجاح.'
    });
  };

  const resetPasswordByAdmin = async (targetUser: string, newPass: string): Promise<boolean> => {
    try {
      const cleanUser = targetUser.toLowerCase().trim();
      const newHash = await hashPassword(newPass);
      saveStaffPasswordHash(cleanUser, newHash);
      resetLoginAttempts(cleanUser);
      addToast({
        type: 'success',
        title: 'تم تحديث كلمة المرور',
        message: `تم تعيين كلمة مرور جديدة لحساب (${cleanUser}) بنجاح.`
      });
      return true;
    } catch {
      addToast({
        type: 'error',
        title: 'فشل التحديث',
        message: 'حدث خطأ أثناء تشفير وحفظ كلمة المرور.'
      });
      return false;
    }
  };

  const logout = () => {
    void supabase.auth.signOut();
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

    // حساب رقم الدور التالي في نفس العيادة ونفس اليوم
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
    addToast({
      type: 'success',
      title: 'الجدول الأسبوعي للطبيب',
      message: 'تم حفظ أيام العمل ومواعيد بداية ونهاية المناوبة بنجاح.'
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
    addToast({
      type: 'success',
      title: 'تم تحديث السعة القصوى',
      message: `تم تحديد الحد الأقصى للحالات اليومية للطبيب بـ ${maxDailyBookings} حالة.`
    });
  };

  // منطق تخطي الدور وتحويل المرضى المتغيبين إلى "متأخر" تلقائياً
  const admitPatient = (targetBookingId: string) => {
    const targetBooking = bookings.find(b => b.id === targetBookingId);
    if (!targetBooking) return;

    const now = new Date().toISOString();
    let skippedCount = 0;

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
    const updated = bookings.map(b => {
      if (b.id === bookingId) {
        return { ...b, doctorDiagnosis: cleanDiagnosis };
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
    addToast({
      type: 'success',
      title: 'تم تحديث العيادة',
      message: 'تم حفظ تعديلات العيادة بنجاح.'
    });
  };

  const addDoctor = (newDoctor: Omit<Doctor, 'id'>) => {
    const id = `doc-${Date.now()}`;
    const fullDoctor: Doctor = { ...newDoctor, id };
    const updated = [...doctors, fullDoctor];
    setDoctors(updated);
    saveDoctors(updated);
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
    addToast({
      type: 'success',
      title: 'تم حفظ نص الاستفسارات والمساعدة',
      message: 'تم تحديث النص التوضيحي بالصفحة الرئيسية للمرضى.'
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
    const openItems = dailySchedule.items.filter(item => item.isOpen);
    const available: { clinic: Clinic; assignedDoctor?: Doctor }[] = [];

    for (const item of openItems) {
      const clinic = clinics.find(c => c.id === item.clinicId);
      // فحص أن العيادة موجودة ومفعلة
      if (!clinic || clinic.active === false || clinic.isActive === false) continue;

      // العثور على الطبيب المناوب المعين في جدول اليوم أو أول طبيب مسجل للعيادة
      const assignedDoctor = doctors.find(d => d.id === item.doctorId) || 
                             doctors.find(d => d.clinicId === clinic.id);

      if (!assignedDoctor) continue;

      // تطبيق الفحص الصارم للركائز الأربعة
      const availabilityCheck = checkClinicAvailability(
        assignedDoctor,
        clinic.id,
        todayStr,
        bookings
      );

      // إذا كانت العيادة غير متاحة لأي من الأسباب الأربعة، تختفي فوراً وبشكل تلقائي من حجز المرضى
      if (!availabilityCheck.allowed) {
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
        addDoctor,
        resetToInitialData,
        resetPasswordByAdmin,
        staffAccounts,
        deleteStaffAccount,
        updateStaffRecoveryEmail,
        toasts,
        addToast,
        removeToast,
        patientHistoryModalOpen,
        setPatientHistoryModalOpen,
        patientHistoryPhone,
        setPatientHistoryPhone,
        toggleClinicStatus
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
