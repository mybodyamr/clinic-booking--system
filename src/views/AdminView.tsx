import React, { useState } from 'react';
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
  RotateCcw, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet,
  Calendar,
  CalendarCheck,
  Key,
  FileText,
  UserCheck,
  Power,
  Lock,
  ShieldCheck,
  Receipt,
  Mail
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AVAILABLE_PERMISSIONS } from '../services/storage';
import { DailyClinicScheduleItem, SystemPermission, UserRole, StaffAccount } from '../types';
import { DailyScheduleExportModal } from '../components/DailyScheduleExportModal';

export const AdminView: React.FC = () => {
  const { 
    clinics, 
    doctors, 
    bookings, 
    addClinic, 
    updateClinic, 
    addDoctor, 
    resetToInitialData, 
    addToast,
    dailySchedule,
    updateDailySchedule,
    rolePermissions,
    updateRolePermissions,
    supportInfoText,
    updateSupportInfoText,
    updateDoctorStatus,
    updateDoctorMaxBookings,
    resetPasswordByAdmin,
    staffAccounts,
    deleteStaffAccount,
    updateStaffRecoveryEmail,
    deleteClinic,
    updateStaffAccount,
    clearPastBookings
  } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'daily-schedule' | 'clinics' | 'doctors' | 'permissions' | 'reports'>('overview');

  // نطاق عرض التقارير والسجلات (اليوم كافتراضي أو الأرشيف)
  const [reportScope, setReportScope] = useState<'today' | 'archive'>('today');
  const [showClearPastModal, setShowClearPastModal] = useState(false);
  const [isClearingPast, setIsClearingPast] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
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

  // تعديل وتحديث بيانات الموظفين
  const [editingStaffForFullUpdate, setEditingStaffForFullUpdate] = useState<StaffAccount | null>(null);
  const [staffEditUsername, setStaffEditUsername] = useState('');
  const [staffEditDisplayName, setStaffEditDisplayName] = useState('');
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

  // نافذة تنزيل جدول تشغيل اليوم كصورة
  const [showExportScheduleModal, setShowExportScheduleModal] = useState(false);

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

  // مزامنة العناصر عند تحديث العيادات
  React.useEffect(() => {
    setScheduleItems(prev => {
      return clinics.map(c => {
        const clinicDoc = doctors.find(d => d.clinicId === c.id) || doctors[0];
        const match = prev.find(p => p.clinicId === c.id) || dailySchedule.items.find(i => i.clinicId === c.id);
        if (match) {
          return {
            ...match,
            doctorId: match.doctorId || clinicDoc?.id || ''
          };
        }
        return {
          clinicId: c.id,
          doctorId: clinicDoc?.id || '',
          isOpen: Boolean(c.active !== false && c.isActive !== false)
        };
      });
    });
  }, [clinics, dailySchedule, doctors]);

  // حالة نص الاستفسارات والمساعدة
  const [supportTextDraft, setSupportTextDraft] = useState(supportInfoText);

  // حالة تفويض الصلاحيات
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<UserRole>('reception');
  const [permsDraft, setPermsDraft] = useState<SystemPermission[]>(() => rolePermissions['reception'] || []);

  React.useEffect(() => {
    setPermsDraft(rolePermissions[selectedRoleForPerms] || []);
  }, [selectedRoleForPerms, rolePermissions]);

  // تعديل السعة القصوى لطبيب
  const [editingMaxDocId, setEditingMaxDocId] = useState<string | null>(null);
  const [tempMaxCases, setTempMaxCases] = useState<number>(30);

  // حساب الإحصائيات العامة
  const totalPatients = bookings.length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;
  const waitingCount = bookings.filter(b => b.status === 'waiting').length;
  const totalRevenue = bookings
    .filter(b => b.paymentStatus === 'paid')
    .reduce((acc, b) => acc + b.fee, 0);

  // تصدير التقارير إلى Excel حقيقي باستخدام xlsx
  const handleExportToExcel = () => {
    try {
      const dataToExport = displayedReportBookings.map(b => ({
        'رقم التذكرة': b.ticketNumber,
        'اسم المريض': b.patientName,
        'رقم الهاتف': b.patientPhone,
        'العيادة التخصصية': b.clinicName,
        'الطبيب المعالج': b.doctorName,
        'التاريخ': b.date,
        'الفترة': b.timeSlot,
        'رقم الدور': b.queuePosition,
        'قيمة الكشف': b.fee,
        'حالة الكشف': b.status === 'completed' ? 'تم الكشف' : b.status === 'in-progress' ? 'داخل العيادة' : b.status === 'waiting' ? 'في الانتظار' : 'ملغي',
        'حالة السداد': b.paymentStatus === 'paid' ? 'مسدد' : b.paymentStatus === 'exempt' ? 'معفى خيري' : 'غير مسدد',
        'طريقة الدفع': b.paymentMethod === 'cash' ? 'نقدي' : b.paymentMethod === 'insurance' ? 'تأمين طبي' : b.paymentMethod === 'charity_exempt' ? 'تكافل خيري' : 'غير مسدد',
        'ملاحظات التشخيص': b.doctorDiagnosis || '-'
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير حجوزات العيادات');

      const fileName = `تقرير_عيادات_الجمعية_الشرعية_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

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
      scheduleDays: ['السبت', 'الاثنين', 'الأربعاء'],
      scheduleHours: newDocHours,
      phone: '01000000000'
    });

    setNewDocName('');
    setShowAddDoctorModal(false);
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

  const handleSaveSupportText = () => {
    updateSupportInfoText(supportTextDraft);
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
            onClick={() => setShowExportScheduleModal(true)}
            className="px-3.5 py-2 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            title="تنزيل جدول تشغيل العيادات كصورة PNG أو ملف Excel"
          >
            <Download className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span>تنزيل جدول عيادات اليوم</span>
          </button>

          <button
            onClick={handleExportToExcel}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>تصدير الحجوزات (Excel)</span>
          </button>

          <button
            onClick={resetToInitialData}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
            title="إعادة تعيين البيانات النموذجية"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة النماذج</span>
          </button>
        </div>
      </div>

      {/* شريط التبويبات الرئيسية */}
      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          نظرة عامة وإحصائيات
        </button>

        <button
          onClick={() => setActiveTab('daily-schedule')}
          className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'daily-schedule'
              ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <CalendarCheck className="w-3.5 h-3.5" />
          <span>جدول تشغيل عيادات اليوم</span>
        </button>

        <button
          onClick={() => setActiveTab('clinics')}
          className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'clinics'
              ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          العيادات المسجلة ({clinics.length})
        </button>

        <button
          onClick={() => setActiveTab('doctors')}
          className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'doctors'
              ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          الأطباء والسعة القصوى ({doctors.length})
        </button>

        <button
          onClick={() => setActiveTab('permissions')}
          className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'permissions'
              ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>الصلاحيات وإعدادات الموقع</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          سجلات حجوزات اليوم ({todayBookings.length})
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
                onClick={() => setShowExportScheduleModal(true)}
                className="px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 hover:border-emerald-500 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl hover:bg-emerald-50/50 dark:hover:bg-slate-700 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>تنزيل جدول عيادات اليوم</span>
              </button>
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
                              <span>الطبيب غير متواجد اليوم (العيادة محجوبة تلقائياً من حجز المرضى)</span>
                            </div>
                          )}

                          {/* أزرار سريعة للأدمن لتغيير حالة الطبيب مباشرة */}
                          <div className="pt-1 flex items-center gap-1 text-[11px]">
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
                            setEditingClinicFeeId(c.id);
                            setTempFeeValue(c.fee);
                          }}
                          className="p-1 text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition-colors cursor-pointer"
                          title="تعديل سعر كشف العيادة"
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
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    d.status === 'available'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : d.status === 'break'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}>
                    {d.status === 'available' ? 'متاح' : d.status === 'break' ? 'استراحة' : 'غير متواجد'}
                  </span>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                  <div>فترة التواجد: {d.scheduleHours}</div>
                  <div>أيام العمل: {d.scheduleDays.join('، ')}</div>

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

          {/* البطاقة 2: تعديل قسم استفسارات ومساعدة فورية بالصفحة الرئيسية */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    تعديل نص قسم "استفسارات ومساعدة فورية" (الصفحة الرئيسية)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  النص الإرشادي المعروض للمرضى والجمهور أسفل كارت الحجز (مواعيد العمل، أرقام الهاتف، والاستفسار).
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveSupportText}
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>حفظ وتحديث النص للمرضى</span>
              </button>
            </div>

            <div>
              <textarea
                rows={3}
                value={supportTextDraft}
                onChange={(e) => setSupportTextDraft(e.target.value)}
                className="w-full p-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white leading-relaxed focus:ring-2 focus:ring-emerald-500"
                placeholder="أدخل النص الإرشادي للمرضى..."
              />
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

              <button
                type="button"
                onClick={() => {
                  setResetTargetUser(staffAccounts[0]?.username || 'reception');
                  setNewStaffPassword('');
                  setShowResetPassModal(true);
                }}
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Lock className="w-4 h-4 text-emerald-200" />
                <span>إعادة تعيين كلمة مرور موظف</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
              {staffAccounts.map(acc => {
                const getRoleMeta = (role: UserRole) => {
                  switch (role) {
                    case 'admin':
                      return { roleName: 'مدير المنظومة', icon: LayoutDashboard, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' };
                    case 'reception':
                      return { roleName: 'مسؤول الاستقبال', icon: UserCheck, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40' };
                    case 'cashier':
                      return { roleName: 'أمين الخزينة', icon: Receipt, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-950/40' };
                    case 'doctor':
                      return { roleName: 'طبيب العيادة', icon: Stethoscope, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/40' };
                    default:
                      return { roleName: 'موظف', icon: UserCheck, color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-800' };
                  }
                };
                const meta = getRoleMeta(acc.role);
                const IconComponent = meta.icon;
                const isProtectedAdmin = acc.role === 'admin' && acc.username === 'admin';

                return (
                  <div key={acc.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-xl ${meta.bg} border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-center`}>
                            <IconComponent className={`w-4 h-4 ${meta.color}`} />
                          </div>
                          <div>
                            <span className="text-[11px] font-bold text-slate-900 dark:text-white block line-clamp-1">
                              {acc.displayName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              @{acc.username}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {meta.roleName}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-1 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{acc.recoveryEmail || 'لم يُحدد بريد استعادة'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setResetTargetUser(acc.username);
                            setNewStaffPassword('');
                            setShowResetPassModal(true);
                          }}
                          className="px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          title="تعيين كلمة مرور جديدة"
                        >
                          <Lock className="w-3 h-3" />
                          <span>الرمز</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStaffForFullUpdate(acc);
                            setStaffEditUsername(acc.username);
                            setStaffEditDisplayName(acc.displayName);
                            setStaffEditEmail(acc.recoveryEmail || '');
                            setStaffEditPassword('');
                          }}
                          className="px-2 py-1 text-[10px] font-semibold text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          title="تعديل بيانات الحساب واسم المستخدم"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>تعديل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStaffAccount(acc);
                            setNewRecoveryEmail(acc.recoveryEmail || '');
                            setShowEmailModal(true);
                          }}
                          className="px-2 py-1 text-[10px] font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          title="تعديل بريد الاستعادة"
                        >
                          <Mail className="w-3 h-3" />
                          <span>البريد</span>
                        </button>
                      </div>

                      {!isProtectedAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`هل أنت متأكد من رغبتك في إزالة حساب الموظف (${acc.displayName}) نهائياً؟`)) {
                              deleteStaffAccount(acc.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
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
                  onClick={() => setShowClearPastModal(true)}
                  className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>مسح حجوزات الأيام السابقة ({pastBookings.length})</span>
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
                        <span>رسوم: {b.fee} ج.م ({b.paymentStatus === 'paid' ? 'مسدد' : b.paymentStatus === 'exempt' ? 'معفى خيري' : 'غير مسدد'})</span>
                      </div>
                    </div>

                    <div>
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
                    </div>
                  </div>
                ))}
              </div>
            )}
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

      {/* نافذة اختيار صيغة تنزيل جدول عيادات اليوم (صورة PNG أو ملف Excel) */}
      <DailyScheduleExportModal
        isOpen={showExportScheduleModal}
        onClose={() => setShowExportScheduleModal(false)}
        clinics={clinics}
        doctors={doctors}
        scheduleItems={scheduleItems}
        scheduleDate={dailySchedule.date}
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

      {/* نافذة تعديل بيانات حساب الموظف بالكامل (الاسم، المستخدم، البريد، الرمز) */}
      {editingStaffForFullUpdate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-700">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Edit2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">تعديل حساب الموظف</h3>
                <p className="text-[11px] text-slate-500">تحديث بيانات الدخول والبريد الرسمي والمصادقة</p>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingStaffForFullUpdate) return;
                setIsSavingStaff(true);
                const ok = await updateStaffAccount(editingStaffForFullUpdate.id, {
                  username: staffEditUsername,
                  displayName: staffEditDisplayName,
                  recoveryEmail: staffEditEmail,
                  password: staffEditPassword || undefined
                });
                setIsSavingStaff(false);
                if (ok) {
                  setEditingStaffForFullUpdate(null);
                }
              }}
              className="space-y-3"
            >
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
                  value={staffEditUsername}
                  onChange={(e) => setStaffEditUsername(e.target.value)}
                  dir="ltr"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

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

              <div className="flex items-center gap-2 pt-2">
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

      {/* نافذة تأكيد مسح حجوزات الأيام السابقة */}
      {showClearPastModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base text-slate-900 dark:text-white">مسح حجوزات الأيام السابقة</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف جميع الحجوزات المسجلة قبل تاريخ اليوم ({todayStr})؟
              يبلغ عددها <strong className="text-rose-600 font-mono font-bold">{pastBookings.length} حجز</strong>.
              سيتم حذفها نهائياً ولن تظهر مرة أخرى في النظام.
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
                  await clearPastBookings(todayStr);
                  setIsClearingPast(false);
                  setShowClearPastModal(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {isClearingPast ? 'جاري الحذف...' : 'تأكيد الحذف نهائياً'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
