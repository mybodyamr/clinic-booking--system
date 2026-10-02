import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  LayoutDashboard, 
  Hospital, 
  Stethoscope, 
  Users, 
  Download, 
  Plus, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet,
  Calendar,
  CalendarDays,
  CalendarCheck,
  Key,
  FileText,
  UserCheck,
  Power,
  Lock,
  ShieldCheck,
  Receipt,
  Mail,
  RefreshCw,
  Clock,
  Bug,
  Activity,
  Monitor,
  Search,
  Copy,
  ChevronDown,
  ChevronUp,
  Cloud
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AVAILABLE_PERMISSIONS, sanitizeSpreadsheetCell, buildFormattedRtlWorksheet, setWorkbookRtlView, writeStyledWorkbookFile } from '../services/storage';
import { getLocalDateStr, isDoctorScheduledOnDate, getArabicDayName } from '../services/scheduleService';
import { DailyClinicScheduleItem, SystemPermission, UserRole, StaffAccount, Doctor, Clinic, SystemErrorSource } from '../types';
import { DailyScheduleExportModal, ScheduleExportMode } from '../components/DailyScheduleExportModal';

export const AdminView: React.FC = () => {
  const { 
    clinics, 
    doctors, 
    bookings, 
    addClinic, 
    updateClinic, 
    addDoctor, 
    updateDoctor,
    deleteDoctor,
    addToast,
    dailySchedule,
    updateDailySchedule,
    rolePermissions,
    updateRolePermissions,
    supportInfoText,
    updateSupportInfoText,
    officialWorkingHours,
    updateOfficialWorkingHours,
    updateDoctorStatus,
    updateDoctorSchedule,
    updateDoctorMaxBookings,
    resetPasswordByAdmin,
    staffAccounts,
    createStaffAccount,
    deleteStaffAccount,
    updateStaffRecoveryEmail,
    deleteClinic,
    updateStaffAccount,
    clearPastBookings,
    deleteBooking,
    currentUser,
    errorLogs,
    logSystemError,
    resolveErrorLog,
    resolveAllErrorLogs,
    deleteErrorLog,
    clearAllErrorLogs,
    syncErrorLogsNow,
    consultationRegistry,
    updateConsultationSettings,
    navigate
  } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'daily-schedule' | 'clinics' | 'doctors' | 'permissions' | 'reports' | 'error-logs'>('overview');

  // فلاتر وحالات لوحة تحكم الأخطاء (Error Monitoring Dashboard)
  const [errorSourceFilter, setErrorSourceFilter] = useState<'all' | SystemErrorSource>('all');
  const [errorStatusFilter, setErrorStatusFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');
  const [errorSearchQuery, setErrorSearchQuery] = useState('');
  const [expandedErrorIds, setExpandedErrorIds] = useState<Record<string, boolean>>({});
  const [isSyncingErrors, setIsSyncingErrors] = useState(false);
  const [showClearErrorsModal, setShowClearErrorsModal] = useState(false);

  const unresolvedErrorsCount = errorLogs.filter(e => !e.resolved).length;
  const errorBoundaryCount = errorLogs.filter(e => e.source === 'ErrorBoundary').length;
  const preloadErrorCount = errorLogs.filter(e => e.source === 'vite:preloadError' || e.source === 'ChunkLoadError').length;

  const filteredErrorLogs = errorLogs.filter(log => {
    if (errorSourceFilter !== 'all' && log.source !== errorSourceFilter) return false;
    if (errorStatusFilter === 'unresolved' && log.resolved) return false;
    if (errorStatusFilter === 'resolved' && !log.resolved) return false;
    if (errorSearchQuery.trim()) {
      const q = errorSearchQuery.toLowerCase();
      const matchMsg = log.message?.toLowerCase().includes(q);
      const matchDevice = log.deviceInfo?.toLowerCase().includes(q);
      const matchUser = log.username?.toLowerCase().includes(q) || log.userRole?.toLowerCase().includes(q);
      const matchUrl = log.url?.toLowerCase().includes(q);
      const matchSource = log.source?.toLowerCase().includes(q);
      if (!matchMsg && !matchDevice && !matchUser && !matchUrl && !matchSource) return false;
    }
    return true;
  });

  // نطاق عرض التقارير والسجلات (اليوم كافتراضي أو الأرشيف)
  const [reportScope, setReportScope] = useState<'today' | 'archive'>('today');
  const [showClearPastModal, setShowClearPastModal] = useState(false);
  const [clearModalMode, setClearModalMode] = useState<'past' | 'all'>('all');
  const [isClearingPast, setIsClearingPast] = useState(false);
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);

  const handleForceRefreshCache = async () => {
    setIsRefreshingCache(true);
    addToast({
      type: 'info',
      title: 'تحديث الكاش والبيانات',
      message: 'جاري مسح الذاكرة المؤقتة ومزامنة أحدث البيانات من الخادم...'
    });
    try {
      if ('caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map(k => window.caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.update().catch(() => {})));
      }
      const keysToClear = [
        'sharaya_clinics_v2',
        'sharaya_doctors_v2',
        'sharaya_bookings_v2',
        'sharaya_daily_schedule_v2',
        'sharaya_support_info_text_v2',
        'sharaya_official_working_hours_v2',
        'sharaya_staff_accounts_v2',
        'sharaya_insurance_contracts_v1',
        'sharaya_shift_handovers_v1',
        'sharaya_insurance_bookings_map_v1'
      ];
      for (const k of keysToClear) {
        localStorage.removeItem(k);
      }
    } catch {}
    setTimeout(() => {
      window.location.reload();
    }, 350);
  };

  const todayStr = getLocalDateStr();
  const todayBookings = bookings.filter(b => b.date === todayStr);
  const pastBookings = bookings.filter(b => b.date < todayStr);
  const displayedReportBookings = reportScope === 'today' ? todayBookings : bookings;

  // نماذج الإضافة السريعة
  const [showAddClinicModal, setShowAddClinicModal] = useState(false);
  const [newClinicName, setNewClinicName] = useState('');
  const [newClinicFee, setNewClinicFee] = useState(30);
  const [newClinicRoom, setNewClinicRoom] = useState('');
  const [newClinicFloor, setNewClinicFloor] = useState('الطابق الأول');

  // حذف العيادة مع التحقق الأمني
  const [clinicToDelete, setClinicToDelete] = useState<typeof clinics[0] | null>(null);
  const [isDeletingClinic, setIsDeletingClinic] = useState(false);

  // حالة تعديل بيانات العيادة بالكامل
  const [editingClinicFull, setEditingClinicFull] = useState<Clinic | null>(null);
  const [clinicEditName, setClinicEditName] = useState('');
  const [clinicEditFee, setClinicEditFee] = useState(100);
  const [clinicEditRoom, setClinicEditRoom] = useState('');
  const [clinicEditDesc, setClinicEditDesc] = useState('');
  const [clinicEditCapacity, setClinicEditCapacity] = useState(20);
  const [isSavingClinicFull, setIsSavingClinicFull] = useState(false);

  // حالة تعديل بيانات الطبيب بالكامل وحذفه
  const [editingDoctorFull, setEditingDoctorFull] = useState<Doctor | null>(null);
  const [docEditName, setDocEditName] = useState('');
  const [docEditTitle, setDocEditTitle] = useState('');
  const [docEditClinicId, setDocEditClinicId] = useState('');
  const [docEditHours, setDocEditHours] = useState('');
  const [docEditDays, setDocEditDays] = useState<string[]>(['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']);
  const [docEditMaxBookings, setDocEditMaxBookings] = useState(20);
  const [isSavingDoctorFull, setIsSavingDoctorFull] = useState(false);
  const [doctorToDelete, setDoctorToDelete] = useState<{ id: string; name: string; clinicName?: string } | null>(null);
  const [isDeletingDoctor, setIsDeletingDoctor] = useState(false);

  // إنشاء حساب موظف جديد (Phase 3)
  const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
  const [createStaffUsername, setCreateStaffUsername] = useState('');
  const [createStaffPassword, setCreateStaffPassword] = useState('');
  const [createStaffDisplayName, setCreateStaffDisplayName] = useState('');
  const [createStaffRole, setCreateStaffRole] = useState<UserRole>('reception');
  const [createStaffDoctorId, setCreateStaffDoctorId] = useState(doctors[0]?.id || '');
  const [createStaffClinicId, setCreateStaffClinicId] = useState(doctors[0]?.clinicId || clinics[0]?.id || '');
  const [createStaffEmail, setCreateStaffEmail] = useState('');
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);

  // حذف حساب موظف مع نافذة تأكيد آمنة
  const [staffToDelete, setStaffToDelete] = useState<StaffAccount | null>(null);
  const [isDeletingStaff, setIsDeletingStaff] = useState(false);

  // تعديل وتحديث بيانات الموظفين
  const [editingStaffForFullUpdate, setEditingStaffForFullUpdate] = useState<StaffAccount | null>(null);
  const [staffEditUsername, setStaffEditUsername] = useState('');
  const [staffEditDisplayName, setStaffEditDisplayName] = useState('');
  const [staffEditRole, setStaffEditRole] = useState<UserRole>('reception');
  const [staffEditDoctorId, setStaffEditDoctorId] = useState('');
  const [staffEditClinicId, setStaffEditClinicId] = useState('');
  const [staffEditEmail, setStaffEditEmail] = useState('');
  const [staffEditPassword, setStaffEditPassword] = useState('');
  const [isSavingStaff, setIsSavingStaff] = useState(false);

  // تعديل سعر الكشف للعيادة
  const [editingClinicFeeId, setEditingClinicFeeId] = useState<string | null>(null);
  const [tempFeeValue, setTempFeeValue] = useState<number>(30);

  const [showAddDoctorModal, setShowAddDoctorModal] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocTitle, setNewDocTitle] = useState('أخصائي');
  const [newDocClinicId, setNewDocClinicId] = useState(clinics[0]?.id || '');
  const [newDocHours, setNewDocHours] = useState('04:00 م - 09:00 م');
  const [newDocDays, setNewDocDays] = useState<string[]>(['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']);

  // نافذة تنزيل جدول تشغيل اليوم أو الأسبوع كصورة
  const [showExportScheduleModal, setShowExportScheduleModal] = useState(false);
  const [exportScheduleInitialMode, setExportScheduleInitialMode] = useState<ScheduleExportMode>('daily');

  // حالة نافذة إعادة تعيين كلمة المرور للموظفين
  const [showResetPassModal, setShowResetPassModal] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<string>('reception');
  const [newStaffPassword, setNewStaffPassword] = useState<string>('');
  const [isResettingPass, setIsResettingPass] = useState<boolean>(false);

  // حالة نافذة تعديل بريد الاستعادة
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [editingStaffAccount, setEditingStaffAccount] = useState<StaffAccount | null>(null);
  const [newRecoveryEmail, setNewRecoveryEmail] = useState('');

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffPassword.trim()) return;
    setIsResettingPass(true);
    await resetPasswordByAdmin(resetTargetUser, newStaffPassword.trim());
    setIsResettingPass(false);
    setNewStaffPassword('');
    setShowResetPassModal(false);
  };

  const handleSaveRecoveryEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaffAccount || !newRecoveryEmail.trim()) return;
    updateStaffRecoveryEmail(editingStaffAccount.id, newRecoveryEmail.trim());
    setShowEmailModal(false);
    setEditingStaffAccount(null);
    setNewRecoveryEmail('');
  };

  // حالة جدول تشغيل اليوم
  const [scheduleItems, setScheduleItems] = useState<DailyClinicScheduleItem[]>(() => {
    return clinics.map(c => {
      const existing = dailySchedule.items.find(i => i.clinicId === c.id);
      const clinicDoctor = doctors.find(d => d.clinicId === c.id) || doctors[0];
      if (existing) {
        return {
          ...existing,
          doctorId: existing.doctorId || clinicDoctor?.id || '',
          isOpen: existing.isOpen !== undefined ? existing.isOpen : Boolean(c.active !== false && c.isActive !== false)
        };
      }
      return {
        clinicId: c.id,
        doctorId: clinicDoctor?.id || '',
        isOpen: Boolean(c.active !== false && c.isActive !== false)
      };
    });
  });

  // مزامنة العناصر عند تحديث العيادات أو جدول اليوم
  React.useEffect(() => {
    setScheduleItems(prev => {
      return clinics.map(c => {
        const clinicDoc = doctors.find(d => d.clinicId === c.id) || doctors[0];
        const match = dailySchedule.items.find(i => i.clinicId === c.id) || prev.find(p => p.clinicId === c.id);
        if (match) {
          return {
            ...match,
            doctorId: match.doctorId || clinicDoc?.id || '',
            isOpen: match.isOpen !== undefined ? match.isOpen : Boolean(c.active !== false && c.isActive !== false && c.isOpenToday !== false)
          };
        }
        return {
          clinicId: c.id,
          doctorId: clinicDoc?.id || '',
          isOpen: Boolean(c.active !== false && c.isActive !== false && c.isOpenToday !== false)
        };
      });
    });
  }, [clinics, dailySchedule, doctors]);

  // حالة نص الاستفسارات والمساعدة
  const [supportTextDraft, setSupportTextDraft] = useState(supportInfoText);
  const [isSavingSupportText, setIsSavingSupportText] = useState(false);

  // حالة مواعيد العمل الرسمية بالصفحة الرئيسية
  const [workingHoursDraft, setWorkingHoursDraft] = useState(officialWorkingHours);
  const [isSavingWorkingHours, setIsSavingWorkingHours] = useState(false);

  // حالة إعدادات مدة الاستشارة المجانية (Self-Erasing Consultation Registry)
  const [tempConsultDefaultDays, setTempConsultDefaultDays] = useState<number>(
    consultationRegistry?.windowDays || 14
  );
  const [tempConsultClinicDays, setTempConsultClinicDays] = useState<Record<string, number>>(
    consultationRegistry?.clinicWindows || {}
  );
  const [isSavingConsultSettings, setIsSavingConsultSettings] = useState(false);

  useEffect(() => {
    setTempConsultDefaultDays(consultationRegistry?.windowDays || 14);
    setTempConsultClinicDays(consultationRegistry?.clinicWindows || {});
  }, [consultationRegistry?.windowDays, consultationRegistry?.clinicWindows]);

  const handleSaveConsultationConfig = async () => {
    setIsSavingConsultSettings(true);
    await updateConsultationSettings(tempConsultDefaultDays, tempConsultClinicDays);
    setIsSavingConsultSettings(false);
  };

  // تحديث مسودة النص عند ورود تحديثات فورية عبر Realtime أو مزامنة الخادم
  useEffect(() => {
    setSupportTextDraft(supportInfoText);
  }, [supportInfoText]);

  useEffect(() => {
    setWorkingHoursDraft(officialWorkingHours);
  }, [officialWorkingHours]);

  // حالة تفويض الصلاحيات
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<UserRole>('reception');
  const [permsDraft, setPermsDraft] = useState<SystemPermission[]>(() => rolePermissions['reception'] || []);

  React.useEffect(() => {
    setPermsDraft(rolePermissions[selectedRoleForPerms] || []);
  }, [selectedRoleForPerms, rolePermissions]);

  // تعديل السعة القصوى لطبيب
  const [editingMaxDocId, setEditingMaxDocId] = useState<string | null>(null);
  const [tempMaxCases, setTempMaxCases] = useState<number>(30);

  // حالة نافذة تعديل الجدول الأسبوعي للطبيب
  const ALL_WEEK_DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
  const [editingScheduleDoc, setEditingScheduleDoc] = useState<Doctor | null>(null);
  const [tempScheduleDays, setTempScheduleDays] = useState<string[]>([]);
  const [tempScheduleHours, setTempScheduleHours] = useState<string>('');
  const [isSavingDoctorSchedule, setIsSavingDoctorSchedule] = useState<boolean>(false);

  const handleOpenScheduleModal = (doc: Doctor) => {
    setEditingScheduleDoc(doc);
    setTempScheduleDays(doc.scheduleDays && doc.scheduleDays.length > 0 ? [...doc.scheduleDays] : ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']);
    setTempScheduleHours(doc.scheduleHours || '9:00 ص - 3:00 م');
  };

  const handleToggleScheduleDay = (day: string) => {
    if (tempScheduleDays.includes(day)) {
      if (tempScheduleDays.length <= 1) {
        addToast({
          type: 'warning',
          title: 'تنبيه',
          message: 'يجب اختيار يوم عمل واحد على الأقل للطبيب.'
        });
        return;
      }
      setTempScheduleDays(tempScheduleDays.filter(d => d !== day));
    } else {
      setTempScheduleDays([...tempScheduleDays, day]);
    }
  };

  const handleSaveDoctorSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScheduleDoc) return;
    if (tempScheduleDays.length === 0) {
      addToast({
        type: 'error',
        title: 'جدول غير مكتمل',
        message: 'يرجى تحديد يوم عمل واحد على الأقل للطبيب.'
      });
      return;
    }
    setIsSavingDoctorSchedule(true);
    const ok = await updateDoctorSchedule(editingScheduleDoc.id, tempScheduleDays, tempScheduleHours.trim() || '9:00 ص - 3:00 م');
    setIsSavingDoctorSchedule(false);
    if (ok) {
      setEditingScheduleDoc(null);
    }
  };

  // حساب الإحصائيات العامة
  const totalPatients = bookings.length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;
  const waitingCount = bookings.filter(b => b.status === 'waiting').length;
  const totalRevenue = bookings
    .filter(b => b.paymentStatus === 'paid')
    .reduce((acc, b) => acc + b.fee, 0);

  // تصدير التقارير إلى Excel حقيقي باستخدام xlsx بتنسيق عربي RTL وعرض أعمدة تلقائي كامل
  const handleExportToExcel = () => {
    try {
      const dataToExport = displayedReportBookings.map((b, idx) => ({
        'م': idx + 1,
        'التاريخ': sanitizeSpreadsheetCell(b.date),
        'رقم التذكرة': sanitizeSpreadsheetCell(b.ticketNumber),
        'اسم المريض بالكامل': sanitizeSpreadsheetCell(b.patientName),
        'رقم الهاتف': sanitizeSpreadsheetCell(b.patientPhone),
        'العيادة التخصصية': sanitizeSpreadsheetCell(b.clinicName),
        'الطبيب المعالج': sanitizeSpreadsheetCell(b.doctorName),
        'الفترة': sanitizeSpreadsheetCell(b.timeSlot),
        'رقم الدور': b.queuePosition,
        'حالة الكشف': b.status === 'completed' ? 'تم الكشف' : b.status === 'in-progress' ? 'داخل العيادة' : b.status === 'waiting' ? 'في الانتظار' : 'ملغي',
        'حالة السداد': b.paymentStatus === 'paid' ? 'مسدد' : b.paymentMethod === 'consultation' ? 'استشارة مجانية' : b.paymentStatus === 'exempt' ? 'معفى خيري' : 'غير مسدد',
        'طريقة الدفع': b.paymentMethod === 'cash' ? 'نقدي (كاش)' : b.paymentMethod === 'insurance' ? 'تأمين طبي' : b.paymentMethod === 'consultation' ? 'استشارة مجانية' : b.paymentMethod === 'charity_exempt' ? 'تكافل خيري' : 'غير مسدد',
        'شركة التأمين': sanitizeSpreadsheetCell(b.insuranceDetails?.companyName || '—'),
        'قيمة الكشف المحصلة (ج.م)': b.paymentMethod === 'consultation' ? 0 : b.fee,
        'ملاحظات التشخيص': sanitizeSpreadsheetCell(b.doctorDiagnosis || '—')
      }));

      const workbook = XLSX.utils.book_new();
      setWorkbookRtlView(workbook);

      const worksheet = buildFormattedRtlWorksheet(
        dataToExport.length > 0
          ? dataToExport
          : [{ 'بيان': 'لا توجد حجوزات مطابقة للفلاتر المحددة' }],
        {
          reportTitle: 'عيادات الشرايح التخصصية — تقرير حجوزات العيادات',
          reportSubtitle: `تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')} · إجمالي السجلات: ${dataToExport.length}`
        }
      );
      XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير حجوزات العيادات');

      const fileName = `تقرير_عيادات_الجمعية_الشرعية_${new Date().toISOString().split('T')[0]}.xlsx`;
      writeStyledWorkbookFile(workbook, fileName);

      addToast({
        type: 'success',
        title: 'تم تصدير التقرير بنجاح',
        message: `تم تنزيل ملف الإكسيل: ${fileName}`
      });
    } catch (err) {
      console.error(err);
      addToast({
        type: 'error',
        title: 'خطأ في التصدير',
        message: 'حدث خطأ أثناء إعداد ملف الإكسيل.'
      });
    }
  };

  const handleCreateClinic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClinicName.trim()) return;

    addClinic({
      name: newClinicName,
      code: newClinicName.slice(0, 3),
      fee: Number(newClinicFee) || 30,
      room: newClinicRoom || 'غرفة العيادة',
      floor: newClinicFloor,
      iconName: 'Activity',
      isActive: true,
      workingDays: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
      workingHours: '04:00 م - 09:00 م'
    });

    setNewClinicName('');
    setShowAddClinicModal(false);
  };

  const handleCreateDoctor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) return;

    const targetClinic = clinics.find(c => c.id === newDocClinicId);

    addDoctor({
      name: newDocName,
      title: newDocTitle,
      clinicId: newDocClinicId,
      clinicName: targetClinic?.name || 'العيادة التخصصية',
      status: 'available',
      scheduleDays: newDocDays.length > 0 ? newDocDays : ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
      scheduleHours: newDocHours,
      phone: '01000000000'
    });

    setNewDocName('');
    setShowAddDoctorModal(false);
  };

  const handleSaveFullClinicEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClinicFull || !clinicEditName.trim()) return;
    setIsSavingClinicFull(true);
    await updateClinic(editingClinicFull.id, {
      name: clinicEditName.trim(),
      fee: Math.max(0, Number(clinicEditFee) || 0),
      room: clinicEditRoom.trim() || 'غرفة العيادة',
      description: clinicEditDesc.trim() || 'عيادة تخصصية لخدمة المرضى'
    });
    setIsSavingClinicFull(false);
    setEditingClinicFull(null);
  };

  const handleSaveFullDoctorEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoctorFull || !docEditName.trim()) return;
    if (docEditDays.length === 0) {
      addToast({
        type: 'error',
        title: 'جدول غير مكتمل',
        message: 'يرجى تحديد يوم عمل واحد على الأقل للطبيب.'
      });
      return;
    }
    setIsSavingDoctorFull(true);
    await updateDoctor(editingDoctorFull.id, {
      name: docEditName.trim(),
      title: docEditTitle.trim() || 'أخصائي',
      clinicId: docEditClinicId || editingDoctorFull.clinicId,
      scheduleDays: docEditDays,
      scheduleHours: docEditHours.trim() || editingDoctorFull.scheduleHours,
      maxDailyBookings: Math.max(1, Number(docEditMaxBookings) || 20)
    });
    setIsSavingDoctorFull(false);
    setEditingDoctorFull(null);
  };

  // معالجات جدول تشغيل اليوم
  const handleSaveDailySchedule = () => {
    updateDailySchedule(scheduleItems);
  };

  const handleToggleDailyClinic = (clinicId: string) => {
    const updated = scheduleItems.map(item => {
      if (item.clinicId === clinicId) {
        return { ...item, isOpen: !item.isOpen };
      }
      return item;
    });
    setScheduleItems(updated);
    updateDailySchedule(updated);

    const targetItem = updated.find(i => i.clinicId === clinicId);
    if (targetItem) {
      updateClinic(clinicId, { isOpenToday: targetItem.isOpen, active: targetItem.isOpen });
    }
  };

  const handleUpdateDailyDoctor = (clinicId: string, doctorId: string) => {
    const updated = scheduleItems.map(item => {
      if (item.clinicId === clinicId) {
        return { 
          ...item, 
          doctorId
        };
      }
      return item;
    });
    setScheduleItems(updated);
    updateDailySchedule(updated);
  };

  const handleSaveRolePermissions = () => {
    updateRolePermissions(selectedRoleForPerms, permsDraft);
  };

  const handleTogglePermission = (permId: SystemPermission) => {
    if (permsDraft.includes(permId)) {
      setPermsDraft(permsDraft.filter(p => p !== permId));
    } else {
      setPermsDraft([...permsDraft, permId]);
    }
  };

  const handleSaveSupportText = async () => {
    setIsSavingSupportText(true);
    await updateSupportInfoText(supportTextDraft);
    setIsSavingSupportText(false);
  };

  const handleSaveWorkingHours = async () => {
    setIsSavingWorkingHours(true);
    await updateOfficialWorkingHours(workingHoursDraft);
    setIsSavingWorkingHours(false);
  };

  const handleSaveDoctorMaxCases = (doctorId: string, maxCases: number) => {
    updateDoctorMaxBookings(doctorId, maxCases);
    setEditingMaxDocId(null);
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* رأس لوحة تحكم الإدارة العامة */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                لوحة الإدارة والتحكم المركزي بالعيادات
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                إدارة العيادات التخصصية، جدول تشغيل اليوم، تفويض الصلاحيات وتصدير التقارير
              </p>
            </div>
          </div>
        </div>

        {/* أزرار الإجراءات السريعة */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('finance')}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="الانتقال إلى بوابة مدير المالية وتعاقدات التأمين وتطهير السجلات الانتقائي"
          >
            <Receipt className="w-4 h-4 text-amber-200" />
            <span>بوابة مدير المالية والتعاقدات</span>
          </button>

          <button
            type="button"
            disabled={isRefreshingCache}
            onClick={handleForceRefreshCache}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="مسح الكاش المحلي وتحديث البيانات مباشرة من قاعدة البيانات السحابية"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-600 dark:text-emerald-400 ${isRefreshingCache ? 'animate-spin' : ''}`} />
            <span>{isRefreshingCache ? 'جاري التحديث...' : 'تحديث الكاش والبيانات'}</span>
          </button>

          {bookings.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setClearModalMode('all');
                setShowClearPastModal(true);
              }}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/70 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="مسح وتصفير سجل الحجوزات بالكامل من النظام وقاعدة البيانات"
            >
              <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>مسح السجل ({bookings.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setExportScheduleInitialMode('daily');
              setShowExportScheduleModal(true);
            }}
            className="px-3.5 py-2 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            title="تنزيل جدول العيادات المفتوحة في اليوم الفعلي كصورة PNG عالية الدقة"
          >
            <Download className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span>تنزيل جدول عيادات اليوم (صورة)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setExportScheduleInitialMode('weekly');
              setShowExportScheduleModal(true);
            }}
            className="px-3.5 py-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            title="تنزيل جدول أيام الأسبوع كاملة كصورة PNG عالية الدقة"
          >
            <CalendarDays className="w-4 h-4 text-amber-700 dark:text-amber-400" />
            <span>تنزيل جدول الأسبوع كاملاً (صورة)</span>
          </button>

          <button
            onClick={handleExportToExcel}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>تصدير الحجوزات (Excel)</span>
          </button>
        </div>
      </div>

      {/* شريط التبويبات الرئيسية (شبكة متجاوبة للهاتف وسطح المكتب بدون إخفاء أي قسم) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
          <span>نظرة عامة وإحصائيات</span>
        </button>

        <button
          onClick={() => setActiveTab('daily-schedule')}
          className={`px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer ${
            activeTab === 'daily-schedule'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
          <span>جدول تشغيل اليوم</span>
        </button>

        <button
          onClick={() => setActiveTab('doctors')}
          className={`px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer ${
            activeTab === 'doctors'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <Stethoscope className="w-3.5 h-3.5 shrink-0" />
          <span>الأطباء والجداول ({doctors.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('clinics')}
          className={`px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer ${
            activeTab === 'clinics'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <Hospital className="w-3.5 h-3.5 shrink-0" />
          <span>العيادات ({clinics.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span>سجل الحجوزات ({bookings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('permissions')}
          className={`px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer ${
            activeTab === 'permissions'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <Key className="w-3.5 h-3.5 shrink-0" />
          <span>الصلاحيات والموظفين</span>
        </button>

        <button
          onClick={() => setActiveTab('error-logs')}
          className={`col-span-2 sm:col-span-1 px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer ${
            activeTab === 'error-logs'
              ? 'bg-rose-700 text-white shadow-xs'
              : 'bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <Bug className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'error-logs' ? 'text-white' : 'text-rose-600 dark:text-rose-400'}`} />
          <span>لوحة الأخطاء</span>
          {unresolvedErrorsCount > 0 ? (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-rose-600 text-white font-mono animate-pulse">
              {unresolvedErrorsCount}
            </span>
          ) : (
            <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-mono ${
              activeTab === 'error-logs'
                ? 'bg-rose-800 text-rose-100'
                : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
            }`}>
              0
            </span>
          )}
        </button>
      </div>

      {/* التبويب 1: لوحة الإحصائيات الشاملة */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <div className="text-slate-500 text-xs">إجمالي الحجوزات</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{totalPatients}</div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">منذ بدء التشغيل</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <div className="text-slate-500 text-xs">تم الكشف عليهم</div>
              <div className="text-2xl font-bold text-emerald-600 font-mono">{completedCount}</div>
              <div className="text-[11px] text-slate-400">زيارة مكتملة</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <div className="text-slate-500 text-xs">في الانتظار حالياً</div>
              <div className="text-2xl font-bold text-amber-600 font-mono">{waitingCount}</div>
              <div className="text-[11px] text-slate-400">أمام العيادات</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <div className="text-slate-500 text-xs">إجمالي الإيرادات المحصلة</div>
              <div className="text-2xl font-bold text-teal-600 font-mono">{totalRevenue} ج.م</div>
              <div className="text-[11px] text-slate-400">توريد الصندوق</div>
            </div>
          </div>

          {/* تفصيل الكشوفات بحسب كل عيادة تخصصية */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              توزيع الحجوزات ومعدل الإقبال حسب العيادات
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {clinics.map(c => {
                const count = bookings.filter(b => b.clinicId === c.id).length;
                const percent = totalPatients > 0 ? Math.round((count / totalPatients) * 100) : 0;
                return (
                  <div key={c.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-900 dark:text-white">{c.name}</span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-400">{count} حجز</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 flex justify-between">
                      <span>رسوم الكشف: {c.fee} ج.م</span>
                      <span>{percent}% من الإجمالي</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ملخص سريع لجداول الأطباء الأسبوعية وإدارتها الفورية من النظرة العامة */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>الكادر الطبي وجدول أيام العمل الأسبوعي</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  يمكنك تعديل جدول أي طبيب أو إضافة أيام عمل جديدة (مثل يوم الجمعة) وحفظها مباشرة في قاعدة البيانات
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('doctors')}
                className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline self-start sm:self-auto cursor-pointer"
              >
                عرض التحكم الكامل بالأطباء ←
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {doctors.map(doc => (
                <div
                  key={doc.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-850 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">{doc.name}</div>
                      <div className="text-xs text-slate-500">{doc.clinicName} • {doc.scheduleHours}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenScheduleModal(doc)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer shrink-0"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>تعديل الجدول</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {ALL_WEEK_DAYS.map(day => {
                      const isScheduled = (doc.scheduleDays || []).includes(day);
                      return (
                        <span
                          key={day}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                            isScheduled
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 line-through'
                          }`}
                        >
                          {day}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* التبويب: جدول تشغيل عيادات اليوم والأطباء المناوبين */}
      {activeTab === 'daily-schedule' && (
        <div className="space-y-6">
          <div className="bg-emerald-900/10 dark:bg-emerald-950/40 p-5 rounded-3xl border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  جدول تشغيل عيادات اليوم ({dailySchedule.date})
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                حدد العيادات المفتوحة اليوم وعيّن الطبيب المناوب. يتم تطبيق التغييرات فوراً في واجهة حجز المرضى.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSaveDailySchedule}
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>حفظ وتطبيق جدول اليوم</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clinics.map(clinic => {
              const defaultDoc = doctors.find(d => d.clinicId === clinic.id) || doctors[0];
              const scheduleItem = scheduleItems.find(i => i.clinicId === clinic.id) || {
                clinicId: clinic.id,
                doctorId: defaultDoc?.id || '',
                isOpen: Boolean(clinic.active !== false && clinic.isActive !== false),
                customHours: clinic.workingHours,
                room: clinic.room
              };
              const assignedDoctor = doctors.find(d => d.id === scheduleItem.doctorId);
              const clinicDoctors = doctors.filter(d => d.clinicId === clinic.id);
              const allEligibleDoctors = clinicDoctors.length > 0 ? clinicDoctors : doctors;
              const isDocOffline = assignedDoctor?.status === 'offline';

              return (
                <div
                  key={clinic.id}
                  className={`p-5 rounded-3xl border transition-all space-y-4 ${
                    scheduleItem.isOpen
                      ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                          {clinic.name}
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {clinic.room}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        سعر الكشف: {clinic.fee} ج.م • {clinic.floor}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleDailyClinic(clinic.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        scheduleItem.isOpen
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Power className={`w-3.5 h-3.5 ${scheduleItem.isOpen ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span>{scheduleItem.isOpen ? 'مفتوحة اليوم' : 'مغلقة اليوم'}</span>
                    </button>
                  </div>

                  {scheduleItem.isOpen ? (
                    <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          الطبيب المناوب اليوم بالعيادة:
                        </label>
                        <select
                          value={scheduleItem.doctorId}
                          onChange={(e) => handleUpdateDailyDoctor(clinic.id, e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
                        >
                          {allEligibleDoctors.map(doc => (
                            <option key={doc.id} value={doc.id}>
                              {doc.name} — {doc.status === 'available' ? 'متاح' : doc.status === 'break' ? 'استراحة' : 'غير متواجد'}
                            </option>
                          ))}
                        </select>
                      </div>

                      {assignedDoctor && (
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">حالة الطبيب الحالية:</span>
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              assignedDoctor.status === 'available'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : assignedDoctor.status === 'break'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}>
                              {assignedDoctor.status === 'available' ? 'متاح للكشف' : assignedDoctor.status === 'break' ? 'في استراحة' : 'غير متواجد اليوم'}
                            </span>
                          </div>

                          {/* تنبيه إذا كان الطبيب مسجل غير متواجد */}
                          {isDocOffline && (
                            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-[11px] flex items-center gap-1.5">
                              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                              <span>الطبيب غير متواجد اليوم (العيادة محجوبة تلقائياً من حجز المرضى ومن بوستر اليوم)</span>
                            </div>
                          )}

                          {/* تنبيه إذا كان اليوم الفعلي ليس من أيام جدول الطبيب الأسبوعي */}
                          {!isDocOffline && !isDoctorScheduledOnDate(assignedDoctor, dailySchedule.date || todayStr) && (
                            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-300 text-[11px] flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 shrink-0 text-amber-600" />
                                <span>اليوم الفعلي ({getArabicDayName(dailySchedule.date || todayStr)}) خارج جدول أيام عمل الطبيب ({(assignedDoctor.scheduleDays || []).join('، ')})</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenScheduleModal(assignedDoctor)}
                                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] shrink-0 cursor-pointer transition-colors"
                              >
                                تعديل الجدول
                              </button>
                            </div>
                          )}

                          {/* أزرار سريعة للأدمن لتغيير حالة الطبيب مباشرة أو تعديل جدوله */}
                          <div className="pt-1 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                            <div className="flex items-center gap-1">
                              <span className="text-slate-500 text-[10px] ml-1">تعديل فوري للحالة:</span>
                              <button
                                type="button"
                                onClick={() => updateDoctorStatus(assignedDoctor.id, 'available')}
                                className="px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold cursor-pointer"
                              >
                                متاح
                              </button>
                              <button
                                type="button"
                                onClick={() => updateDoctorStatus(assignedDoctor.id, 'break')}
                                className="px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold cursor-pointer"
                              >
                                استراحة
                              </button>
                              <button
                                type="button"
                                onClick={() => updateDoctorStatus(assignedDoctor.id, 'offline', 'اعتذار رسمي')}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                                  assignedDoctor.status === 'offline'
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                }`}
                              >
                                غير متواجد
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenScheduleModal(assignedDoctor)}
                              className="px-2 py-1 rounded-lg bg-slate-200/80 hover:bg-emerald-100 dark:bg-slate-800 dark:hover:bg-emerald-950 text-slate-700 hover:text-emerald-800 dark:text-slate-300 dark:hover:text-emerald-300 text-[10px] font-bold cursor-pointer flex items-center gap-1 transition-colors"
                              title="تعديل أيام وساعات عمل الطبيب"
                            >
                              <Calendar className="w-3 h-3" />
                              <span>تعديل جدول الطبيب</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 py-1 text-center bg-slate-100 dark:bg-slate-800/50 rounded-xl">
                      العيادة مغلقة اليوم ولن تظهر في قائمة الحجز للمرضى
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* التبويب 2: إدارة العيادات التخصصية */}
      {activeTab === 'clinics' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              قائمة العيادات التخصصية المعتمدة بالمركز
            </span>
            <button
              onClick={() => setShowAddClinicModal(true)}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة عيادة تخصصية جديدة</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clinics.map(c => {
              const clinicDoctors = doctors.filter(d => d.clinicId === c.id);
              return (
                <div
                  key={c.id}
                  className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{c.name}</h4>
                      <div className="text-xs text-slate-500">{c.room} • {c.floor}</div>
                    </div>

                    {editingClinicFeeId === c.id ? (
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700/60 p-1.5 rounded-xl border border-emerald-500/50">
                        <input
                          type="number"
                          min="0"
                          value={tempFeeValue}
                          onChange={(e) => setTempFeeValue(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-16 px-2 py-1 text-xs font-bold font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center"
                          autoFocus
                        />
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">ج.م</span>
                        <button
                          onClick={() => {
                            updateClinic(c.id, { fee: tempFeeValue });
                            setEditingClinicFeeId(null);
                          }}
                          className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          حفظ
                        </button>
                        <button
                          onClick={() => setEditingClinicFeeId(null)}
                          className="px-2 py-1 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 text-slate-700 dark:text-slate-200 text-xs rounded-lg transition-colors cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 rounded-lg">
                          {c.fee} ج.م
                        </span>
                        <button
                          onClick={() => {
                            setEditingClinicFull(c);
                            setClinicEditName(c.name);
                            setClinicEditFee(c.fee);
                            setClinicEditRoom(c.room || '');
                            setClinicEditDesc(c.description || '');
                            setClinicEditCapacity(20);
                          }}
                          className="p-1 text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition-colors cursor-pointer"
                          title="تعديل بيانات العيادة بالكامل"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setClinicToDelete(c)}
                          className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                          title="حذف العيادة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                    <div>الأطباء المسجلين: <strong className="text-slate-800 dark:text-slate-200">{clinicDoctors.length} أطباء</strong></div>
                    <div>مواعيد العمل: {c.workingHours}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* التبويب 3: إدارة الأطباء */}
      {activeTab === 'doctors' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              قائمة الأطباء والاستشاريين المعتمدين
            </span>
            <button
              onClick={() => setShowAddDoctorModal(true)}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة طبيب جديد</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {doctors.map(d => (
              <div
                key={d.id}
                className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{d.name}</h4>
                    <div className="text-xs text-slate-500">{d.title} • {d.clinicName}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      d.status === 'available'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : d.status === 'break'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}>
                      {d.status === 'available' ? 'متاح' : d.status === 'break' ? 'استراحة' : 'غير متواجد'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDoctorFull(d);
                        setDocEditName(d.name);
                        setDocEditTitle(d.title);
                        setDocEditClinicId(d.clinicId);
                        setDocEditHours(d.scheduleHours);
                        setDocEditDays(d.scheduleDays && d.scheduleDays.length > 0 ? [...d.scheduleDays] : ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']);
                        setDocEditMaxBookings(d.maxDailyBookings || 30);
                      }}
                      className="p-1 text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition-colors cursor-pointer"
                      title="تعديل بيانات الطبيب والعيادة والجدول وساعات العمل"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDoctorToDelete({ id: d.id, name: d.name, clinicName: d.clinicName })}
                      className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                      title="حذف الطبيب"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">فترة التواجد:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{d.scheduleHours}</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">أيام العمل الأسبوعية:</span>
                      <button
                        type="button"
                        onClick={() => handleOpenScheduleModal(d)}
                        className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg flex items-center gap-1 cursor-pointer transition-colors border border-emerald-200/60 dark:border-emerald-800/60"
                        title="تعديل جدول أيام ومواعيد تواجد الطبيب بالعيادة"
                      >
                        <Calendar className="w-3 h-3" />
                        <span>تعديل جدول الطبيب</span>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {d.scheduleDays && d.scheduleDays.length > 0 ? (
                        d.scheduleDays.map(day => (
                          <span
                            key={day}
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-750 text-slate-700 dark:text-slate-300"
                          >
                            {day}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400">لم تُحدد أيام بعد</span>
                      )}
                    </div>
                  </div>

                  {/* تعديل السعة القصوى للحالات اليومية (حصري للأدمن) */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-500 font-medium">الحد الأقصى للكشوفات:</span>
                    {editingMaxDocId === d.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={5}
                          max={100}
                          value={tempMaxCases}
                          onChange={(e) => setTempMaxCases(Number(e.target.value))}
                          className="w-16 px-2 py-0.5 text-xs rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveDoctorMaxCases(d.id, tempMaxCases)}
                          className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[11px] font-bold cursor-pointer"
                        >
                          حفظ
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingMaxDocId(null)}
                          className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[11px] cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {d.maxDailyBookings || 30} حالة / يوم
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMaxDocId(d.id);
                            setTempMaxCases(d.maxDailyBookings || 30);
                          }}
                          className="p-1 text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 rounded cursor-pointer"
                          title="تعديل الحد الأقصى للحالات (حصري للإدارة)"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* تغيير حالة الطبيب مباشرة بواسطة الإدارة */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5 text-[11px]">
                  <div className="text-slate-500 font-medium">تعديل حالة الحضور اليوم:</div>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => updateDoctorStatus(d.id, 'available')}
                      className={`py-1 rounded-lg font-bold text-center cursor-pointer transition-all ${
                        d.status === 'available'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-emerald-50'
                      }`}
                    >
                      متاح
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDoctorStatus(d.id, 'break')}
                      className={`py-1 rounded-lg font-bold text-center cursor-pointer transition-all ${
                        d.status === 'break'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-amber-50'
                      }`}
                    >
                      استراحة
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDoctorStatus(d.id, 'offline', 'اعتذار رسمي')}
                      className={`py-1 rounded-lg font-bold text-center cursor-pointer transition-all ${
                        d.status === 'offline'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-rose-50'
                      }`}
                    >
                      غير متواجد
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* التبويب: الصلاحيات وإعدادات الموقع */}
      {activeTab === 'permissions' && (
        <div className="space-y-6">
          
          {/* البطاقة 1: مصفوفة الصلاحيات RBAC */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    مصفوفة تفويض الصلاحيات للأدوار (RBAC)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  حدد الصلاحيات والمسؤوليات الممنوحة لكل دور وظيفي. دور الأدمن يمتلك كافة الصلاحيات حكماً.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveRolePermissions}
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>حفظ صلاحيات الدور</span>
              </button>
            </div>

            {/* محدد الدور */}
            <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-md">
              <button
                type="button"
                onClick={() => setSelectedRoleForPerms('reception')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedRoleForPerms === 'reception'
                    ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                الاستقبال (Reception)
              </button>
              <button
                type="button"
                onClick={() => setSelectedRoleForPerms('cashier')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedRoleForPerms === 'cashier'
                    ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                الخزينة (Cashier)
              </button>
              <button
                type="button"
                onClick={() => setSelectedRoleForPerms('doctor')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedRoleForPerms === 'doctor'
                    ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                الأطباء (Doctor)
              </button>
            </div>

            {/* قائمة الصلاحيات التفاعلية */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {AVAILABLE_PERMISSIONS.map(perm => {
                const isChecked = permsDraft.includes(perm.key);
                return (
                  <div
                    key={perm.key}
                    onClick={() => handleTogglePermission(perm.key)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      isChecked
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-50/50 dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:bg-slate-100/50'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {perm.name}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          صلاحية نظام
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {perm.description}
                      </p>
                    </div>

                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                      isChecked
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                    }`}>
                      {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* البطاقة 2: تعديل مواعيد العمل الرسمية وقسم استفسارات ومساعدة فورية بالصفحة الرئيسية */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* تعديل مواعيد العمل الرسمية */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                      <h3 className="font-bold text-base text-slate-900 dark:text-white">
                        تعديل "مواعيد العمل الرسمية" (الشاشة الرئيسية)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      تحديد مواعيد العمل الرسمية للمجمع الطبي التي تظهر لجميع المرضى والزوار في الشاشة الرئيسية وتُحفظ في قاعدة البيانات فوراً.
                    </p>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    value={workingHoursDraft}
                    onChange={(e) => setWorkingHoursDraft(e.target.value)}
                    className="w-full p-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white leading-relaxed focus:ring-2 focus:ring-emerald-500"
                    placeholder="مثال: يومياً من 9:00 ص حتى 10:00 م"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveWorkingHours}
                  disabled={isSavingWorkingHours}
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingWorkingHours ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-200" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  )}
                  <span>{isSavingWorkingHours ? 'جاري الحفظ والتعميم...' : 'حفظ وتحديث مواعيد العمل للكل'}</span>
                </button>
              </div>
            </div>

            {/* تعديل نص الاستفسارات وخدمة المراجعين */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                      <h3 className="font-bold text-base text-slate-900 dark:text-white">
                        تعديل نص "الاستعلامات وخدمة المراجعين" (الشاشة الرئيسية)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      النص الإرشادي المعروض للمرضى والجمهور في الشاشة الرئيسية (أرقام التواصل، الاستفسارات، وإرشادات الحضور).
                    </p>
                  </div>
                </div>

                <div>
                  <textarea
                    rows={2}
                    value={supportTextDraft}
                    onChange={(e) => setSupportTextDraft(e.target.value)}
                    className="w-full p-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white leading-relaxed focus:ring-2 focus:ring-emerald-500"
                    placeholder="أدخل النص الإرشادي للمرضى..."
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveSupportText}
                  disabled={isSavingSupportText}
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingSupportText ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-200" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  )}
                  <span>{isSavingSupportText ? 'جاري الحفظ والتعميم...' : 'حفظ وتحديث النص للمرضى'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* البطاقة 2.5: إعدادات الاستشارة المجانية ونظام الختم الذاتي المسح (Self-Erasing Consultation Registry) */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-teal-200 dark:border-teal-800/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/70 pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    نظام الاستشارة المجانية ومهلة الأيام (Self-Erasing Consultation System)
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-700">
                    أختام الاستشارة النشطة حالياً: {Object.keys(consultationRegistry?.stamps || {}).length} مريض
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  حدد عدد أيام الاستشارة المجانية المسموحة بعد الكشف (مثل 7 أو 10 أو 14 يوماً). يُحفظ ختم الاستشارة بشكل مستقل تماماً عن أرشيف الحجوزات، ويُمسح تلقائياً بمجرد دخول المريض للاستشارة أو بعد انتهاء المهلة المحددة.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveConsultationConfig}
                disabled={isSavingConsultSettings}
                className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
              >
                {isSavingConsultSettings ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-200" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-teal-200" />
                )}
                <span>{isSavingConsultSettings ? 'جاري الحفظ...' : 'حفظ مهلة الاستشارة'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div className="p-4 rounded-2xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/70 space-y-3">
                <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  المهلة الافتراضية للاستشارة المجانية لجميع العيادات (بالأيام):
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {[7, 8, 10, 12, 14, 15, 21, 30].map(days => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setTempConsultDefaultDays(days)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        tempConsultDefaultDays === days
                          ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-400'
                      }`}
                    >
                      {days} يوم
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 mr-auto">
                    <span className="text-[11px] font-bold text-slate-500">أو رقم مخصص:</span>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={tempConsultDefaultDays}
                      onChange={(e) => setTempConsultDefaultDays(Math.max(1, Math.min(90, Number(e.target.value) || 14)))}
                      className="w-20 px-2.5 py-1.5 rounded-xl border border-teal-400 dark:border-teal-700 bg-white dark:bg-slate-900 text-xs font-mono font-extrabold text-center text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="text-[11px] text-teal-800 dark:text-teal-300 space-y-1 pt-1">
                  <div>• <strong>مسح فوري عند الاستخدام:</strong> أول ما المريض يدخل استشارة خلال المدة المحددة يُحذف ختم الاستشارة تلقائياً ولا يتكرر.</div>
                  <div>• <strong>مسح تلقائي بعد انتهاء المدة:</strong> أي ختم يتجاوز ({tempConsultDefaultDays} يوم) يُزال تلقائياً من قاعدة البيانات.</div>
                  <div>• <strong>مستقل عن الأرشيف:</strong> مسح سجل الحجوزات السابقة من الأرشيف لا يؤثر إطلاقاً على المرضى المستحقين للاستشارة.</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200">
                    تخصيص مهلة استشارة مختلفة لعيادة معينة (اختياري):
                  </label>
                  {Object.keys(tempConsultClinicDays).length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTempConsultClinicDays({})}
                      className="text-[11px] text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer"
                    >
                      توحيد الكل على الافتراضي ({tempConsultDefaultDays} يوم)
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {clinics.map(c => {
                    const customVal = tempConsultClinicDays[c.id];
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{c.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number"
                            min={1}
                            max={90}
                            placeholder={`${tempConsultDefaultDays}`}
                            value={customVal !== undefined ? customVal : ''}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              if (!val) {
                                const next = { ...tempConsultClinicDays };
                                delete next[c.id];
                                setTempConsultClinicDays(next);
                              } else {
                                setTempConsultClinicDays({
                                  ...tempConsultClinicDays,
                                  [c.id]: Math.max(1, Math.min(90, Number(val) || tempConsultDefaultDays))
                                });
                              }
                            }}
                            className="w-14 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-center font-mono font-bold text-xs"
                          />
                          <span className="text-[10px] text-slate-400">يوم</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* البطاقة 3: إدارة كلمات المرور وتأمين حسابات الكادر الطبي والإداري */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    منظومة الكادر الطبي والإداري وتأمين الحسابات (Staff Management & Security)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  إدارة شاملة لحسابات الموظفين، تشفير كلمات المرور بشهادة SHA-256، تعيين بريد الاستعادة المعتمد، وحذف الحسابات غير النشطة.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    const firstDoc = doctors[0];
                    setCreateStaffUsername('');
                    setCreateStaffPassword('');
                    setCreateStaffDisplayName('');
                    setCreateStaffRole('reception');
                    setCreateStaffDoctorId(firstDoc?.id || '');
                    setCreateStaffClinicId('');
                    setCreateStaffEmail('');
                    setShowCreateStaffModal(true);
                  }}
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-emerald-200" />
                  <span>إضافة حساب موظف جديد</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setResetTargetUser(staffAccounts[0]?.username || 'reception');
                    setNewStaffPassword('');
                    setShowResetPassModal(true);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-600"
                >
                  <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>إعادة تعيين كلمة مرور موظف</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
              {staffAccounts.map(acc => {
                const effectiveRole: UserRole =
                  acc.username.toLowerCase() === 'finance' || acc.role === 'finance_manager'
                    ? 'finance_manager'
                    : acc.role;
                const getRoleMeta = (role: UserRole) => {
                  switch (role) {
                    case 'admin':
                      return {
                        roleName: 'مدير المنظومة',
                        icon: LayoutDashboard,
                        color: 'text-emerald-600 dark:text-emerald-400',
                        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
                        badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800'
                      };
                    case 'finance_manager':
                      return {
                        roleName: 'مدير المالية',
                        icon: Receipt,
                        color: 'text-indigo-600 dark:text-indigo-400',
                        bg: 'bg-indigo-50 dark:bg-indigo-950/40',
                        badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-300/60 dark:border-indigo-800'
                      };
                    case 'reception':
                      return {
                        roleName: 'مسؤول الاستقبال',
                        icon: UserCheck,
                        color: 'text-amber-600 dark:text-amber-400',
                        bg: 'bg-amber-50 dark:bg-amber-950/40',
                        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800'
                      };
                    case 'cashier':
                      return {
                        roleName: 'أمين الخزينة',
                        icon: Receipt,
                        color: 'text-teal-600 dark:text-teal-400',
                        bg: 'bg-teal-50 dark:bg-teal-950/40',
                        badge: 'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-300/60 dark:border-teal-800'
                      };
                    case 'doctor':
                      return {
                        roleName: 'طبيب العيادة',
                        icon: Stethoscope,
                        color: 'text-blue-600 dark:text-blue-400',
                        bg: 'bg-blue-50 dark:bg-blue-950/40',
                        badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300/60 dark:border-blue-800'
                      };
                    default:
                      return {
                        roleName: 'موظف',
                        icon: UserCheck,
                        color: 'text-slate-600 dark:text-slate-400',
                        bg: 'bg-slate-50 dark:bg-slate-800',
                        badge: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      };
                  }
                };
                const meta = getRoleMeta(effectiveRole);
                const IconComponent = meta.icon;
                const isProtectedAdmin =
                  (effectiveRole === 'admin' && acc.username.toLowerCase() === 'admin') ||
                  (currentUser && (acc.id === currentUser.id || acc.username.toLowerCase() === currentUser.username.toLowerCase()));
                const linkedDoctor = effectiveRole === 'doctor' && acc.doctorId ? doctors.find(d => d.id === acc.doctorId) : undefined;
                const linkedClinic = effectiveRole === 'doctor' && (acc.clinicId || linkedDoctor?.clinicId)
                  ? clinics.find(c => c.id === (acc.clinicId || linkedDoctor?.clinicId))
                  : undefined;

                return (
                  <div key={acc.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs">
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-9 h-9 rounded-xl ${meta.bg} border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-center shrink-0`}>
                            <IconComponent className={`w-4 h-4 ${meta.color}`} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                              {acc.displayName}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono block truncate" dir="ltr">
                              @{acc.username}
                            </span>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${meta.badge}`}>
                          {meta.roleName}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60">
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">حالة المصادقة السحابية:</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>مفعل في Supabase</span>
                        </span>
                      </div>

                      {effectiveRole === 'doctor' && (linkedDoctor || linkedClinic) && (
                        <div className="text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/40 px-2.5 py-1.5 rounded-lg border border-blue-200/60 dark:border-blue-800/60 truncate font-medium">
                          {linkedDoctor ? linkedDoctor.name : 'طبيب'} {linkedClinic ? `• ${linkedClinic.name}` : ''}
                        </div>
                      )}

                      {effectiveRole === 'reception' && (
                        <div className="pt-1 space-y-1">
                          <label className="block text-[10px] font-extrabold text-amber-800 dark:text-amber-300">
                            العيادة المكلف بها (تغيير الدور فوراً):
                          </label>
                          <select
                            value={acc.clinicId || ''}
                            onChange={async (e) => {
                              const newClinicId = e.target.value;
                              await updateStaffAccount(acc.id, { clinicId: newClinicId });
                            }}
                            className="w-full px-2 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 text-[11px] font-bold text-slate-900 dark:text-white cursor-pointer"
                          >
                            <option value="">جميع العيادات (استقبال عام)</option>
                            {clinics.map(c => (
                              <option key={c.id} value={c.id}>مخصص لـ: {c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate" dir="ltr">{acc.recoveryEmail || 'لم يُحدد بريد استعادة'}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2.5 border-t border-slate-200/60 dark:border-slate-800">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStaffForFullUpdate({ ...acc, role: effectiveRole });
                            setStaffEditUsername(acc.username);
                            setStaffEditDisplayName(acc.displayName);
                            setStaffEditRole(effectiveRole);
                            setStaffEditDoctorId(acc.doctorId || doctors[0]?.id || '');
                            setStaffEditClinicId(
                              effectiveRole === 'reception'
                                ? (acc.clinicId || '')
                                : (acc.clinicId || doctors.find(d => d.id === acc.doctorId)?.clinicId || clinics[0]?.id || '')
                            );
                            setStaffEditEmail(acc.recoveryEmail || '');
                            setStaffEditPassword('');
                          }}
                          className="px-2.5 py-1.5 text-[11px] font-bold bg-purple-100/80 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/70 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          title="تعديل بيانات الحساب والدور الوظيفي وكلمة المرور"
                        >
                          <Edit2 className="w-3 h-3 shrink-0" />
                          <span>تعديل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResetTargetUser(acc.username);
                            setNewStaffPassword('');
                            setShowResetPassModal(true);
                          }}
                          className="px-2.5 py-1.5 text-[11px] font-bold bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/70 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          title="تعيين كلمة مرور جديدة"
                        >
                          <Lock className="w-3 h-3 shrink-0" />
                          <span>الرمز</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStaffAccount(acc);
                            setNewRecoveryEmail(acc.recoveryEmail || '');
                            setShowEmailModal(true);
                          }}
                          className="px-2.5 py-1.5 text-[11px] font-bold bg-blue-100/80 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/70 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          title="تعديل بريد الاستعادة"
                        >
                          <Mail className="w-3 h-3 shrink-0" />
                          <span>البريد</span>
                        </button>
                      </div>

                      {!isProtectedAdmin && (
                        <button
                          type="button"
                          onClick={() => setStaffToDelete(acc)}
                          className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg transition-colors cursor-pointer"
                          title="حذف حساب الموظف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* التبويب 4: جدول السجلات الكامل */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {/* شريط فلترة السجلات وتحديد النطاق الزمني */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReportScope('today')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  reportScope === 'today'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                حجوزات اليوم فقط ({todayBookings.length})
              </button>

              <button
                type="button"
                onClick={() => setReportScope('archive')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  reportScope === 'archive'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                الأرشيف والسجلات السابقة ({bookings.length})
              </button>
            </div>

            <div className="flex items-center flex-wrap gap-2.5">
              {pastBookings.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setClearModalMode('past');
                    setShowClearPastModal(true);
                  }}
                  className="text-xs text-amber-700 hover:text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>مسح حجوزات الأيام السابقة ({pastBookings.length})</span>
                </button>
              )}

              {bookings.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setClearModalMode('all');
                    setShowClearPastModal(true);
                  }}
                  className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl shadow-2xs transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>مسح السجل بالكامل ({bookings.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExportToExcel}
                className="text-xs text-emerald-700 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تنزيل Excel ({displayedReportBookings.length})</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {reportScope === 'today'
                  ? `حجوزات عيادات اليوم (${todayStr}) - إجمالي ${todayBookings.length} حجز`
                  : `جميع السجلات والأرشيف التاريخي - إجمالي ${bookings.length} حجز`}
              </span>
              <span className="text-[11px] text-slate-400">
                {reportScope === 'today' ? 'يتم عرض حجوزات اليوم الحالي فقط' : 'عرض السجلات التاريخية المسجلة'}
              </span>
            </div>

            {displayedReportBookings.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Calendar className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {reportScope === 'today'
                    ? `لا توجد حجوزات مسجلة لتاريخ اليوم (${todayStr})`
                    : 'لا توجد أي حجوزات مسجلة في النظام'}
                </div>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {reportScope === 'today'
                    ? 'الحجوزات السابقة تم استثناؤها تلقائياً. ستظهر هنا الحجوزات فور تسجيل المرضى كشوفات جديدة لهذا اليوم.'
                    : 'تم تفريغ كافة سجلات الحجز.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {displayedReportBookings.map(b => (
                  <div key={b.id} className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-750 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-[11px]">
                          {b.ticketNumber}
                        </span>
                        <strong className="text-slate-900 dark:text-white text-sm">{b.patientName}</strong>
                        <span className="text-slate-400 font-mono">({b.patientPhone})</span>
                        {b.date === todayStr ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            اليوم
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {b.date}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                        <span>{b.clinicName}</span>
                        <span>{b.doctorName}</span>
                        <span>{b.date} ({b.timeSlot})</span>
                        <span>رسوم: {b.paymentMethod === 'consultation' ? '٠ ج.م (استشارة مجانية)' : `${b.fee} ج.م`} ({b.paymentStatus === 'paid' ? 'مسدد' : b.paymentMethod === 'consultation' ? 'استشارة مجانية' : b.paymentStatus === 'exempt' ? 'معفى خيري' : 'غير مسدد'})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        b.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : b.status === 'in-progress'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : b.status === 'waiting'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {b.status === 'completed' ? 'تم الكشف' : b.status === 'in-progress' ? 'داخل العيادة' : b.status === 'waiting' ? 'في الانتظار' : 'ملغي'}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteBooking(b.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="حذف هذا الحجز نهائياً"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* التبويب 7: لوحة تحكم الأخطاء ومراقبة النظام لحظة بلحظة عبر كافة الأجهزة */}
      {activeTab === 'error-logs' && (
        <div className="space-y-6">
          {/* شريط الرأس وحالة الربط السحابي اللحظي */}
          <div className="bg-gradient-to-l from-rose-950/10 via-slate-50 to-emerald-950/10 dark:from-rose-950/30 dark:via-slate-800/90 dark:to-emerald-950/20 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 flex items-center justify-center shadow-2xs">
                  <Bug className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  لوحة تحكم الأخطاء ومراقبة النظام لحظة بلحظة
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>مربوط بقاعدة البيانات السحابية (Realtime)</span>
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                ترصد هذه اللوحة تلقائياً أي خطأ برمجي يلتقطه <code className="font-mono text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded">ErrorBoundary</code> أو أخطاء تحديث الحزم <code className="font-mono text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded">vite:preloadError</code> من جميع الأجهزة المتصلة (هواتف المرضى، الاستقبال، الخزينة، الأطباء، وشاشات العرض) وتخزنها في قاعدة البيانات ليراها الأدمن فوراً.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isSyncingErrors}
                onClick={async () => {
                  setIsSyncingErrors(true);
                  const ok = await syncErrorLogsNow();
                  setIsSyncingErrors(false);
                  addToast({
                    type: ok ? 'success' : 'info',
                    title: ok ? 'تمت المزامنة مع قاعدة البيانات' : 'تم تحديث السجل المحلي',
                    message: ok
                      ? 'تم جلب أحدث سجلات الأخطاء من جميع الأجهزة عبر قاعدة البيانات السحابية.'
                      : 'تمت قراءة السجلات المحفوظة.'
                  });
                }}
                className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncingErrors ? 'animate-spin' : ''}`} />
                <span>{isSyncingErrors ? 'جاري المزامنة...' : 'مزامنة السحابة الآن'}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await logSystemError({
                    source: 'ErrorBoundary',
                    message: 'اختبار تشخيصي: محاكاة خطأ واجهة مستخدم للتأكد من الربط اللحظي بقاعدة البيانات عبر الأجهزة',
                    stack: 'DiagnosticTestError: Simulated ErrorBoundary capture\n    at AdminErrorMonitorTest (AdminView.tsx:1680:15)',
                    componentStack: 'in DiagnosticSimulator\n    in ErrorBoundary\n    in App'
                  });
                  addToast({
                    type: 'info',
                    title: 'تم تسجيل خطأ تجريبي',
                    message: 'تم إرسال الخطأ التجريبي إلى قاعدة البيانات السحابية وبثه لحظياً لجميع أجهزة الأدمن.'
                  });
                }}
                className="px-3.5 py-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/70 dark:hover:bg-amber-900 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="إرسال سجل خطأ تجريبي للتأكد من عمل الرصد السحابي بين الأجهزة"
              >
                <Activity className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                <span>اختبار رصد خطأ</span>
              </button>

              {unresolvedErrorsCount > 0 && (
                <button
                  type="button"
                  onClick={() => resolveAllErrorLogs()}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                  <span>تعليم الكل كـ (تم الحل)</span>
                </button>
              )}

              {errorLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearErrorsModal(true)}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>مسح السجل</span>
                </button>
              )}
            </div>
          </div>

          {/* بطاقات الإحصائيات السريعة للأخطاء */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
              <div className="text-slate-500 text-xs">إجمالي السجلات المرصودة</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{errorLogs.length}</div>
              <div className="text-[11px] text-slate-400">من كافة الأجهزة المتصلة</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
              <div className="text-slate-500 text-xs">أخطاء نشطة (غير معالجة)</div>
              <div className={`text-2xl font-bold font-mono ${unresolvedErrorsCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {unresolvedErrorsCount}
              </div>
              <div className="text-[11px] text-slate-400">
                {unresolvedErrorsCount === 0 ? 'النظام مستقر بنسبة 100%' : 'تحتاج إلى مراجعة'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
              <div className="text-slate-500 text-xs">أخطاء واجهة (ErrorBoundary)</div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">{errorBoundaryCount}</div>
              <div className="text-[11px] text-slate-400">أعطال مكونات React</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
              <div className="text-slate-500 text-xs">أخطاء التحميل (vite:preloadError)</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-mono">{preloadErrorCount}</div>
              <div className="text-[11px] text-slate-400">تحديثات الحزم والملفات</div>
            </div>
          </div>

          {/* شريط الفلترة والبحث */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 ml-1">المصدر:</span>
              {(
                [
                  { id: 'all', label: 'الكل' },
                  { id: 'ErrorBoundary', label: 'ErrorBoundary' },
                  { id: 'vite:preloadError', label: 'vite:preloadError' },
                  { id: 'ChunkLoadError', label: 'ChunkLoadError' },
                  { id: 'RuntimeError', label: 'RuntimeError' },
                  { id: 'UnhandledRejection', label: 'Promise Rejection' },
                ] as const
              ).map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setErrorSourceFilter(item.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    errorSourceFilter === item.id
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={errorStatusFilter}
                onChange={(e) => setErrorStatusFilter(e.target.value as 'all' | 'unresolved' | 'resolved')}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="all">جميع الحالات ({errorLogs.length})</option>
                <option value="unresolved">غير معالجة فقط ({unresolvedErrorsCount})</option>
                <option value="resolved">تمت معالجتها ({errorLogs.length - unresolvedErrorsCount})</option>
              </select>

              <div className="relative flex-1 min-w-[210px]">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={errorSearchQuery}
                  onChange={(e) => setErrorSearchQuery(e.target.value)}
                  placeholder="ابحث بالرسالة، نوع الجهاز، المستخدم..."
                  className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* قائمة سجلات الأخطاء التفصيلية */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                سجل الأخطاء المجمعة ({filteredErrorLogs.length} سجل معروض)
              </span>
              <span className="text-[11px] text-slate-400">
                يتم الاحتفاظ بآخر 100 سجل ومزامنتها تلقائياً مع جدول إعدادات النظام بقاعدة البيانات
              </span>
            </div>

            {filteredErrorLogs.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  لا توجد أخطاء مسجلة مطابقة للبحث
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  جميع الأجهزة المتصلة بالمنظومة تعمل بكفاءة واستقرار تام. في حال ظهور أي خطأ في أي جهاز سيظهر هنا فوراً مع تفاصيل الجهاز والمستخدم.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
                {filteredErrorLogs.map((log) => {
                  const isExpanded = Boolean(expandedErrorIds[log.id]);
                  const roleLabel =
                    log.userRole === 'admin'
                      ? 'مدير النظام'
                      : log.userRole === 'reception'
                      ? 'الاستقبال'
                      : log.userRole === 'cashier'
                      ? 'الخزينة'
                      : log.userRole === 'doctor'
                      ? 'طبيب'
                      : 'مريض / زائر';

                  const sourceBadgeStyle =
                    log.source === 'ErrorBoundary'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                      : log.source === 'vite:preloadError' || log.source === 'ChunkLoadError'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800';

                  let formattedTime = log.timestamp;
                  try {
                    formattedTime = new Date(log.timestamp).toLocaleString('ar-EG', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    });
                  } catch {}

                  return (
                    <div
                      key={log.id}
                      className={`p-4 sm:p-5 transition-colors ${
                        log.resolved
                          ? 'bg-slate-50/60 dark:bg-slate-900/30 opacity-80'
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-750'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        <div className="space-y-2.5 flex-1 min-w-0">
                          {/* الشارات العلوية */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${sourceBadgeStyle}`}>
                              {log.source}
                            </span>

                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                log.resolved
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-600 text-white'
                              }`}
                            >
                              {log.resolved ? 'تمت المعالجة' : 'نشط - جديد'}
                            </span>

                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium">
                              <Monitor className="w-3 h-3 text-slate-500" />
                              <span dir="ltr">{log.deviceInfo || 'جهاز متصل'}</span>
                            </span>

                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-medium">
                              <span>المستخدم: {log.username || 'زائر'} ({roleLabel})</span>
                            </span>

                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-medium">
                              <Cloud className="w-3 h-3" />
                              <span>{log.syncedToDb !== false ? 'محفوظ في قاعدة البيانات' : 'محلي'}</span>
                            </span>

                            <span className="text-[11px] text-slate-400 font-mono mr-auto">
                              {formattedTime}
                            </span>
                          </div>

                          {/* نص رسالة الخطأ */}
                          <div className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-white break-words bg-slate-100/80 dark:bg-slate-900/70 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700/70" dir="ltr">
                            {log.message}
                          </div>

                          {/* الرابط والتفاصيل */}
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                            {log.url && (
                              <span className="font-mono truncate max-w-xl" dir="ltr">
                                URL: {log.url}
                              </span>
                            )}

                            {(log.stack || log.componentStack) && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedErrorIds(prev => ({ ...prev, [log.id]: !prev[log.id] }))
                                }
                                className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-3.5 h-3.5" />
                                    <span>إخفاء التتبع التقني (Stack Trace)</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3.5 h-3.5" />
                                    <span>عرض التتبع التقني الكامل (Stack Trace)</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          {/* التفاصيل التقنية الكاملة عند التوسيع */}
                          {isExpanded && (log.stack || log.componentStack) && (
                            <div className="mt-2 space-y-2 text-left" dir="ltr">
                              {log.stack && (
                                <div className="p-3 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto border border-slate-800">
                                  <div className="text-rose-400 font-bold mb-1">Error Stack Trace:</div>
                                  <pre className="whitespace-pre-wrap break-words leading-relaxed">{log.stack}</pre>
                                </div>
                              )}
                              {log.componentStack && (
                                <div className="p-3 rounded-xl bg-slate-900 text-amber-200 font-mono text-[11px] overflow-x-auto border border-slate-800">
                                  <div className="text-amber-400 font-bold mb-1">React Component Stack:</div>
                                  <pre className="whitespace-pre-wrap break-words leading-relaxed">{log.componentStack}</pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* أزرار التحكم بالسجل */}
                        <div className="flex sm:flex-row lg:flex-col items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => resolveErrorLog(log.id, !log.resolved)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              log.resolved
                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{log.resolved ? 'إعادة فتح' : 'تم الحل'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const reportText = [
                                `Source: ${log.source}`,
                                `Time: ${log.timestamp}`,
                                `Device: ${log.deviceInfo}`,
                                `User: ${log.username} (${log.userRole})`,
                                `URL: ${log.url}`,
                                `Message: ${log.message}`,
                                log.stack ? `\nStack:\n${log.stack}` : '',
                                log.componentStack ? `\nComponent Stack:\n${log.componentStack}` : ''
                              ]
                                .filter(Boolean)
                                .join('\n');
                              navigator.clipboard?.writeText(reportText);
                              addToast({
                                type: 'success',
                                title: 'تم نسخ تفاصيل الخطأ',
                                message: 'تم نسخ التقرير الفني الكامل للخطأ إلى الحافظة.'
                              });
                            }}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                            title="نسخ التقرير الفني"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>نسخ</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteErrorLog(log.id)}
                            className="p-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                            title="حذف هذا السجل"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* نافذة تأكيد مسح كافة سجلات الأخطاء */}
      {showClearErrorsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base text-slate-900 dark:text-white">مسح سجل الأخطاء بالكامل</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              هل أنت متأكد من رغبتك في مسح جميع سجلات الأخطاء المرصودة ({errorLogs.length} سجل) من قاعدة البيانات السحابية ومن الجهاز الحالي؟
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearErrorsModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  await clearAllErrorLogs();
                  setShowClearErrorsModal(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                تأكيد مسح السجل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة عيادة جديدة */}
      {showAddClinicModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">إضافة عيادة تخصصية جديدة</h3>
            <form onSubmit={handleCreateClinic} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اسم العيادة:</label>
                <input
                  type="text"
                  required
                  value={newClinicName}
                  onChange={(e) => setNewClinicName(e.target.value)}
                  placeholder="مثال: عيادة المسالك البولية"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">قيمة رسوم الكشف (ج.م):</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={newClinicFee}
                  onChange={(e) => setNewClinicFee(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الغرفة والموقع:</label>
                <input
                  type="text"
                  value={newClinicRoom}
                  onChange={(e) => setNewClinicRoom(e.target.value)}
                  placeholder="مثال: غرفة 106"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-700 text-white rounded-xl font-bold text-xs"
                >
                  حفظ وإضافة العيادة
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddClinicModal(false)}
                  className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة إضافة طبيب جديد */}
      {showAddDoctorModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">إضافة طبيب جديد للكادر الطبي</h3>
            <form onSubmit={handleCreateDoctor} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اسم الطبيب:</label>
                <input
                  type="text"
                  required
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  placeholder="د. أشرف حسانين"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الدرجة العلمية / المسمى:</label>
                <input
                  type="text"
                  required
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="استشاري جراحة العظام"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">العيادة التابعة:</label>
                <select
                  value={newDocClinicId}
                  onChange={(e) => setNewDocClinicId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                >
                  {clinics.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">أيام العمل الأسبوعية:</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {ALL_WEEK_DAYS.map(day => {
                    const selected = newDocDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          if (selected && newDocDays.length > 1) {
                            setNewDocDays(newDocDays.filter(x => x !== day));
                          } else if (!selected) {
                            setNewDocDays([...newDocDays, day]);
                          }
                        }}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                          selected
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ساعات العمل:</label>
                <input
                  type="text"
                  value={newDocHours}
                  onChange={(e) => setNewDocHours(e.target.value)}
                  placeholder="04:00 م - 09:00 م"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-700 text-white rounded-xl font-bold text-xs"
                >
                  حفظ الطبيب
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddDoctorModal(false)}
                  className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تنزيل جدول العيادات كصورة (جدول اليوم الفعلي أو الجدول الأسبوعي الشامل) */}
      <DailyScheduleExportModal
        isOpen={showExportScheduleModal}
        onClose={() => setShowExportScheduleModal(false)}
        clinics={clinics}
        doctors={doctors}
        scheduleItems={scheduleItems}
        scheduleDate={dailySchedule.date}
        initialMode={exportScheduleInitialMode}
        officialWorkingHours={officialWorkingHours}
        onSuccess={(msg) => addToast({ type: 'success', title: 'تم التنزيل بنجاح', message: msg })}
        onError={(msg) => addToast({ type: 'error', title: 'خطأ في التنزيل', message: msg })}
      />

      {/* نافذة تعيين كلمة مرور جديدة للموظف بواسطة المدير */}
      {showResetPassModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-700">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">إعادة تعيين كلمة مرور موظف</h3>
                <p className="text-[11px] text-slate-500">تحديث الرمز السري وإلغاء أي حظر أمني مؤقت على الحساب</p>
              </div>
            </div>

            <form onSubmit={handleAdminResetPassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اختر حساب الموظف:
                </label>
                <select
                  value={resetTargetUser}
                  onChange={(e) => setResetTargetUser(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
                >
                  {staffAccounts.map(acc => (
                    <option key={acc.id} value={acc.username}>
                      {acc.displayName} ({acc.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  كلمة المرور الجديدة:
                </label>
                <input
                  type="password"
                  required
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور الجديدة"
                  dir="ltr"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                سيتم تشفير كلمة المرور وتجزئتها عبر خوارزمية SHA-256 تلقائياً وحفظها بأمان، مع فك قفل محاولات الدخول الخاطئة للموظف فوراً.
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isResettingPass}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer"
                >
                  {isResettingPass ? 'جاري الحفظ والتشفير...' : 'حفظ كلمة المرور الجديدة'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetPassModal(false)}
                  className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تعديل بيانات العيادة بالكامل */}
      {editingClinicFull && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">تعديل بيانات العيادة</h3>
            <form onSubmit={handleSaveFullClinicEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اسم العيادة:</label>
                <input
                  type="text"
                  required
                  value={clinicEditName}
                  onChange={(e) => setClinicEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رسوم الكشف (ج.م):</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={clinicEditFee}
                    onChange={(e) => setClinicEditFee(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">السعة اليومية:</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="200"
                    value={clinicEditCapacity}
                    onChange={(e) => setClinicEditCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الغرفة والموقع:</label>
                <input
                  type="text"
                  value={clinicEditRoom}
                  onChange={(e) => setClinicEditRoom(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">وصف العيادة:</label>
                <input
                  type="text"
                  value={clinicEditDesc}
                  onChange={(e) => setClinicEditDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingClinicFull}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs cursor-pointer"
                >
                  {isSavingClinicFull ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingClinicFull(null)}
                  className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تعديل بيانات الطبيب بالكامل */}
      {editingDoctorFull && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">تعديل بيانات الطبيب</h3>
            <form onSubmit={handleSaveFullDoctorEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اسم الطبيب:</label>
                <input
                  type="text"
                  required
                  value={docEditName}
                  onChange={(e) => setDocEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الدرجة العلمية / التخصص:</label>
                <input
                  type="text"
                  required
                  value={docEditTitle}
                  onChange={(e) => setDocEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">العيادة التابعة:</label>
                <select
                  value={docEditClinicId}
                  onChange={(e) => setDocEditClinicId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                >
                  {clinics.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">أيام العمل الأسبوعية بالعيادة:</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {ALL_WEEK_DAYS.map(day => {
                    const selected = docEditDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          if (selected && docEditDays.length > 1) {
                            setDocEditDays(docEditDays.filter(x => x !== day));
                          } else if (!selected) {
                            setDocEditDays([...docEditDays, day]);
                          }
                        }}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                          selected
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ساعات العمل:</label>
                  <input
                    type="text"
                    value={docEditHours}
                    onChange={(e) => setDocEditHours(e.target.value)}
                    placeholder="04:00 م - 09:00 م"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">السعة القصوى اليومية:</label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={docEditMaxBookings}
                    onChange={(e) => setDocEditMaxBookings(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingDoctorFull}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs cursor-pointer"
                >
                  {isSavingDoctorFull ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDoctorFull(null)}
                  className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تأكيد حذف الطبيب */}
      {doctorToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-700">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">تأكيد حذف الطبيب</h3>
                <p className="text-[11px] text-slate-500">
                  {doctorToDelete.name} {doctorToDelete.clinicName ? `• ${doctorToDelete.clinicName}` : ''}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                هل أنت متأكد من رغبتك في إزالة الطبيب <strong className="text-slate-900 dark:text-white">({doctorToDelete.name})</strong> من الكادر الطبي؟
              </p>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
                سيتم التحقق من عدم وجود مرضى في قائمة الانتظار الحالية لهذا الطبيب قبل إتمام الحذف النهائي.
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingDoctor}
                onClick={async () => {
                  if (!doctorToDelete) return;
                  setIsDeletingDoctor(true);
                  await deleteDoctor(doctorToDelete.id);
                  setIsDeletingDoctor(false);
                  setDoctorToDelete(null);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isDeletingDoctor ? (
                  <span>جاري المعالجة...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>تأكيد حذف الطبيب</span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={isDeletingDoctor}
                onClick={() => setDoctorToDelete(null)}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تأكيد حذف العيادة مع التحقق الذكي */}
      {clinicToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-700">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">تأكيد حذف العيادة</h3>
                <p className="text-[11px] text-slate-500">عيادة: {clinicToDelete.name}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                هل أنت متأكد من رغبتك في إزالة عيادة <strong className="text-slate-900 dark:text-white">({clinicToDelete.name})</strong>؟
              </p>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>آلية الأمان وضمان الحجوزات:</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 leading-normal">
                  يقوم النظام بالتحقق التلقائي؛ إذا لم تكن هناك أي حجوزات سيتم حذفها نهائياً. أما في حال وجود حجوزات تاريخية أو سابقة، سيتم إغلاقها وأرشفتها للحفاظ على سلامة القيود المالية وسجلات المرضى.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingClinic}
                onClick={async () => {
                  if (!clinicToDelete) return;
                  setIsDeletingClinic(true);
                  await deleteClinic(clinicToDelete.id);
                  setIsDeletingClinic(false);
                  setClinicToDelete(null);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isDeletingClinic ? (
                  <span>جاري المعالجة...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>تأكيد الحذف</span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={isDeletingClinic}
                onClick={() => setClinicToDelete(null)}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إنشاء حساب موظف جديد (Phase 3) */}
      {showCreateStaffModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 sm:p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col max-h-[88dvh] overflow-hidden">
            <div className="flex items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">إنشاء حساب موظف جديد</h3>
                  <p className="text-[11px] text-slate-500">تفعيل فوري في Supabase Auth و Vercel عبر كافة الأجهزة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateStaffModal(false)}
                className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 cursor-pointer shrink-0"
              >
                إغلاق
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsCreatingStaff(true);
                const ok = await createStaffAccount({
                  username: createStaffUsername,
                  password: createStaffPassword,
                  displayName: createStaffDisplayName,
                  role: createStaffRole,
                  doctorId: createStaffRole === 'doctor' ? createStaffDoctorId : null,
                  clinicId:
                    createStaffRole === 'doctor'
                      ? createStaffClinicId
                      : createStaffRole === 'reception'
                      ? (createStaffClinicId || null)
                      : null,
                  recoveryEmail: createStaffEmail || undefined
                });
                setIsCreatingStaff(false);
                if (ok) {
                  setShowCreateStaffModal(false);
                }
              }}
              className="flex flex-col flex-1 overflow-hidden pt-3"
            >
              <div className="space-y-3 overflow-y-auto flex-1 pr-1 pb-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم الموظف الظاهر:
                  </label>
                  <input
                    type="text"
                    required
                    value={createStaffDisplayName}
                    onChange={(e) => setCreateStaffDisplayName(e.target.value)}
                    placeholder="مثال: أ. كريم حسن (مسؤول استقبال)"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم المستخدم (لتسجيل الدخول):
                  </label>
                  <input
                    type="text"
                    required
                    value={createStaffUsername}
                    onChange={(e) => setCreateStaffUsername(e.target.value)}
                    placeholder="مثال: reception.2 أو finance.2"
                    dir="ltr"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    كلمة المرور (6 أحرف على الأقل):
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={createStaffPassword}
                    onChange={(e) => setCreateStaffPassword(e.target.value)}
                    placeholder="أدخل كلمة مرور قوية"
                    dir="ltr"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الدور الوظيفي (Role):
                  </label>
                  <select
                    value={createStaffRole}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      setCreateStaffRole(nextRole);
                      if (nextRole === 'reception') {
                        setCreateStaffClinicId('');
                      } else if (nextRole === 'doctor' && !createStaffDoctorId && doctors[0]) {
                        setCreateStaffDoctorId(doctors[0].id);
                        setCreateStaffClinicId(doctors[0].clinicId);
                      }
                    }}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
                  >
                    <option value="reception">مسؤول الاستقبال (reception)</option>
                    <option value="cashier">أمين الخزينة (cashier)</option>
                    <option value="finance_manager">مدير المالية والحسابات (finance_manager)</option>
                    <option value="doctor">طبيب العيادة (doctor)</option>
                    <option value="admin">مدير المنظومة (admin)</option>
                  </select>
                </div>

                {createStaffRole === 'reception' && (
                  <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 space-y-2">
                    <label className="block text-xs font-bold text-amber-900 dark:text-amber-300">
                      تخصيص موظف الاستقبال لعيادة محددة (أو جميع العيادات):
                    </label>
                    <select
                      value={createStaffClinicId}
                      onChange={(e) => setCreateStaffClinicId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
                    >
                      <option value="">جميع العيادات (استقبال عام)</option>
                      {clinics.map(c => (
                        <option key={c.id} value={c.id}>عيادة مخصصة: {c.name}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      يمكنك تغيير العيادة المخصصة لموظف الاستقبال في أي وقت بضغطة واحدة من بطاقة حسابه.
                    </p>
                  </div>
                )}

                {createStaffRole === 'doctor' && (
                  <div className="p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/70 space-y-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        الطبيب المرتبط بالحساب:
                      </label>
                      <select
                        required
                        value={createStaffDoctorId}
                        onChange={(e) => {
                          const docId = e.target.value;
                          setCreateStaffDoctorId(docId);
                          const doc = doctors.find(d => d.id === docId);
                          if (doc?.clinicId) {
                            setCreateStaffClinicId(doc.clinicId);
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      >
                        {doctors.map(doc => (
                          <option key={doc.id} value={doc.id}>
                            {doc.name} ({doc.clinicName})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        العيادة التخصصية التابعة:
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={clinics.find(c => c.id === createStaffClinicId)?.name || 'العيادة المختارة'}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    بريد استعادة الحساب (اختياري):
                  </label>
                  <input
                    type="email"
                    value={createStaffEmail}
                    onChange={(e) => setCreateStaffEmail(e.target.value)}
                    placeholder="employee@sharia-clinics.eg"
                    dir="ltr"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
                <button
                  type="submit"
                  disabled={isCreatingStaff}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer"
                >
                  {isCreatingStaff ? 'جاري الإنشاء والتفعيل...' : 'إنشاء وتفعيل الحساب'}
                </button>
                <button
                  type="button"
                  disabled={isCreatingStaff}
                  onClick={() => setShowCreateStaffModal(false)}
                  className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تأكيد حذف حساب الموظف */}
      {staffToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-700">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">تأكيد حذف حساب الموظف</h3>
                <p className="text-[11px] text-slate-500">{staffToDelete.displayName} (@{staffToDelete.username})</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              هل أنت متأكد من رغبتك في إزالة حساب الموظف <strong className="text-slate-900 dark:text-white">({staffToDelete.displayName})</strong> نهائياً؟ سيتم حذف الحساب من جدول الموظفين وإلغاء صلاحية دخوله فوراً.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingStaff}
                onClick={async () => {
                  if (!staffToDelete) return;
                  setIsDeletingStaff(true);
                  await deleteStaffAccount(staffToDelete.id);
                  setIsDeletingStaff(false);
                  setStaffToDelete(null);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                {isDeletingStaff ? 'جاري الحذف...' : 'تأكيد حذف الحساب'}
              </button>
              <button
                type="button"
                disabled={isDeletingStaff}
                onClick={() => setStaffToDelete(null)}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تعديل بيانات حساب الموظف بالكامل (الاسم، المستخدم، الدور، الطبيب، البريد، الرمز) */}
      {editingStaffForFullUpdate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 sm:p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col max-h-[88dvh] overflow-hidden">
            <div className="flex items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">تعديل حساب الموظف</h3>
                  <p className="text-[11px] text-slate-500">تحديث البيانات والدور الوظيفي وكلمة المرور سحابياً</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaffForFullUpdate(null)}
                className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 cursor-pointer shrink-0"
              >
                إغلاق
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingStaffForFullUpdate) return;
                setIsSavingStaff(true);
                const ok = await updateStaffAccount(editingStaffForFullUpdate.id, {
                  username: staffEditUsername,
                  displayName: staffEditDisplayName,
                  role: staffEditRole,
                  doctorId: staffEditRole === 'doctor' ? staffEditDoctorId : null,
                  clinicId:
                    staffEditRole === 'doctor'
                      ? staffEditClinicId
                      : staffEditRole === 'reception'
                      ? (staffEditClinicId || null)
                      : null,
                  recoveryEmail: staffEditEmail,
                  password: staffEditPassword || undefined
                });
                setIsSavingStaff(false);
                if (ok) {
                  setEditingStaffForFullUpdate(null);
                }
              }}
              className="flex flex-col flex-1 overflow-hidden pt-3"
            >
              <div className="space-y-3 overflow-y-auto flex-1 pr-1 pb-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم الموظف الظاهر:
                  </label>
                  <input
                    type="text"
                    required
                    value={staffEditDisplayName}
                    onChange={(e) => setStaffEditDisplayName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم المستخدم (تسجيل الدخول):
                  </label>
                  <input
                    type="text"
                    required
                    disabled={editingStaffForFullUpdate.username.toLowerCase() === 'admin'}
                    value={staffEditUsername}
                    onChange={(e) => setStaffEditUsername(e.target.value)}
                    dir="ltr"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الدور الوظيفي (Role):
                  </label>
                  <select
                    disabled={editingStaffForFullUpdate.username.toLowerCase() === 'admin'}
                    value={staffEditRole}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      setStaffEditRole(nextRole);
                      if (nextRole === 'reception') {
                        setStaffEditClinicId('');
                      } else if (nextRole === 'doctor' && !staffEditDoctorId && doctors[0]) {
                        setStaffEditDoctorId(doctors[0].id);
                        setStaffEditClinicId(doctors[0].clinicId);
                      }
                    }}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white disabled:opacity-60"
                  >
                    <option value="reception">مسؤول الاستقبال (reception)</option>
                    <option value="cashier">أمين الخزينة (cashier)</option>
                    <option value="finance_manager">مدير المالية والحسابات (finance_manager)</option>
                    <option value="doctor">طبيب العيادة (doctor)</option>
                    <option value="admin">مدير المنظومة (admin)</option>
                  </select>
                </div>

                {staffEditRole === 'reception' && (
                  <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 space-y-2">
                    <label className="block text-xs font-bold text-amber-900 dark:text-amber-300">
                      العيادة المخصصة لموظف الاستقبال (تغيير الدور لأي عيادة):
                    </label>
                    <select
                      value={staffEditClinicId}
                      onChange={(e) => setStaffEditClinicId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
                    >
                      <option value="">جميع العيادات (استقبال عام)</option>
                      {clinics.map(c => (
                        <option key={c.id} value={c.id}>عيادة مخصصة: {c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {staffEditRole === 'doctor' && (
                  <div className="p-3 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/70 space-y-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      الطبيب المرتبط بالحساب:
                    </label>
                    <select
                      required
                      value={staffEditDoctorId}
                      onChange={(e) => {
                        const docId = e.target.value;
                        setStaffEditDoctorId(docId);
                        const doc = doctors.find(d => d.id === docId);
                        if (doc?.clinicId) {
                          setStaffEditClinicId(doc.clinicId);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                    >
                      {doctors.map(doc => (
                        <option key={doc.id} value={doc.id}>
                          {doc.name} ({doc.clinicName})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    بريد استعادة الحساب:
                  </label>
                  <input
                    type="email"
                    value={staffEditEmail}
                    onChange={(e) => setStaffEditEmail(e.target.value)}
                    placeholder="employee@sharia-clinics.eg"
                    dir="ltr"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    كلمة المرور الجديدة (اتركها فارغة إذا لم ترد التغيير):
                  </label>
                  <input
                    type="password"
                    value={staffEditPassword}
                    onChange={(e) => setStaffEditPassword(e.target.value)}
                    placeholder="اتركها فارغة للاحتفاظ بكلمة المرور الحالية"
                    dir="ltr"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
                <button
                  type="submit"
                  disabled={isSavingStaff}
                  className="flex-1 py-2.5 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer"
                >
                  {isSavingStaff ? 'جاري حفظ التعديلات...' : 'حفظ التعديلات'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingStaffForFullUpdate(null)}
                  className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showEmailModal && editingStaffAccount && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-700">
              <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">تحديث بريد استعادة الحساب</h3>
                <p className="text-[11px] text-slate-500">حساب: {editingStaffAccount.displayName} (@{editingStaffAccount.username})</p>
              </div>
            </div>

            <form onSubmit={handleSaveRecoveryEmail} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  البريد الإلكتروني المعتمد للاستعادة:
                </label>
                <input
                  type="email"
                  required
                  value={newRecoveryEmail}
                  onChange={(e) => setNewRecoveryEmail(e.target.value)}
                  placeholder="employee@sharia-clinics.eg"
                  dir="ltr"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                يُستخدم هذا البريد في إرسال رابط تأكيد استعادة كلمة المرور عند طلب الموظف إعادة التعيين من شاشة الدخول.
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer"
                >
                  حفظ البريد الإلكتروني
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailModal(false);
                    setEditingStaffAccount(null);
                  }}
                  className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تأكيد مسح السجل (السابق أو بالكامل) */}
      {showClearPastModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {clearModalMode === 'all' ? 'مسح وتصفير سجل الحجوزات بالكامل' : 'مسح حجوزات الأيام السابقة'}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {clearModalMode === 'all' ? (
                <>
                  هل أنت متأكد من رغبتك في حذف وتصفير <strong>جميع الحجوزات المسجلة بالنظام</strong> (بما فيها حجوزات اليوم والأرشيف)؟
                  يبلغ عددها <strong className="text-rose-600 font-mono font-bold">{bookings.length} حجز</strong>.
                  سيتم حذفها نهائياً من قاعدة البيانات السحابية والتخزين المحلي ولن تعود للظهور مرة أخرى.
                </>
              ) : (
                <>
                  هل أنت متأكد من رغبتك في حذف جميع الحجوزات المسجلة قبل تاريخ اليوم ({todayStr})؟
                  يبلغ عددها <strong className="text-rose-600 font-mono font-bold">{pastBookings.length} حجز</strong>.
                  سيتم حذفها نهائياً ولن تظهر مرة أخرى في النظام.
                </>
              )}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearPastModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition-all cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isClearingPast}
                onClick={async () => {
                  setIsClearingPast(true);
                  await clearPastBookings(clearModalMode === 'all' ? '9999-12-31' : todayStr);
                  setIsClearingPast(false);
                  setShowClearPastModal(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {isClearingPast ? 'جاري المسح النهائي...' : 'تأكيد المسح النهائي'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تعديل جدول الحضور الأسبوعي للطبيب (حصري للأدمن) */}
      {editingScheduleDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  تعديل جدول الحضور الأسبوعي للطبيب
                </h3>
                <p className="text-xs text-slate-500">
                  {editingScheduleDoc.name} • {editingScheduleDoc.clinicName}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveDoctorSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  اختر أيام تواجد الطبيب بالعيادة (انقر لتحديد / إلغاء اليوم):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ALL_WEEK_DAYS.map(day => {
                    const isSelected = tempScheduleDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleToggleScheduleDay(day)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <span>{day}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* أزرار مساعدة سريعة */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setTempScheduleDays(['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'])}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer font-medium"
                >
                  السبت إلى الخميس
                </button>
                <button
                  type="button"
                  onClick={() => setTempScheduleDays([...ALL_WEEK_DAYS])}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer font-medium"
                >
                  طوال الأسبوع (7 أيام)
                </button>
                <button
                  type="button"
                  onClick={() => setTempScheduleDays(['السبت', 'الاثنين', 'الأربعاء'])}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer font-medium"
                >
                  (سبت / اثنين / أربعاء)
                </button>
                <button
                  type="button"
                  onClick={() => setTempScheduleDays(['الأحد', 'الثلاثاء', 'الخميس'])}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer font-medium"
                >
                  (أحد / ثلاثاء / خميس)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ساعات ومناوبة العمل بالعيادة:
                </label>
                <input
                  type="text"
                  required
                  value={tempScheduleHours}
                  onChange={(e) => setTempScheduleHours(e.target.value)}
                  placeholder="مثال: 9:00 ص - 3:00 م"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span className="leading-relaxed">
                  تنبيه: سيظهر هذا الجدول الأسبوعي للمرضى لمعرفة مواعيد حضور وتواجد الطبيب، مع فتح باب الحجز تلقائياً في صباح نفس يوم الحضور فقط.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingScheduleDoc(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingDoctorSchedule}
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>{isSavingDoctorSchedule ? 'جاري الحفظ في السحابة...' : 'حفظ وتثبيت الجدول'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
