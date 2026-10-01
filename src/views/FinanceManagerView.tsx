import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  DollarSign,
  Shield,
  FileSpreadsheet,
  Trash2,
  Plus,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Stethoscope,
  CreditCard,
  ArrowRightLeft,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Check,
  X,
  Info,
  Wallet,
  BadgePercent,
  Sparkles,
  Clock,
  UserCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getLocalDateStr } from '../services/scheduleService';
import { InsuranceCompanyContract, SelectivePurgeOptions } from '../types';

const PRESET_CARD_CATEGORIES = ['فضي (Silver)', 'جولد (Gold)', 'بلاتينيوم (Platinum)', 'دايموند (Diamond)', 'VIP', 'عادي (Standard)'];

export const FinanceManagerView: React.FC = () => {
  const {
    currentUser,
    clinics,
    doctors,
    bookings,
    insuranceContracts,
    saveInsuranceContract,
    deleteInsuranceContract,
    shiftHandovers,
    consultationRegistry,
    errorLogs,
    selectivePurgeRecords,
    navigate,
    addToast
  } = useApp();

  const todayStr = getLocalDateStr(new Date());

  // التبويب النشط
  const [activeTab, setActiveTab] = useState<'reports' | 'insurance' | 'handovers'>('reports');

  // فلاتر التقارير وشيت الإكسل
  const [dateFilterMode, setDateFilterMode] = useState<'today' | 'custom_range' | 'all'>('today');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('all');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all');
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<string>('all');
  const [selectedInsuranceCompanyFilter, setSelectedInsuranceCompanyFilter] = useState<string>('all');

  // نموذج إضافة / تعديل شركة تأمين
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [companyNameInput, setCompanyNameInput] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['فضي (Silver)', 'جولد (Gold)', 'بلاتينيوم (Platinum)']);
  const [customCategoryInput, setCustomCategoryInput] = useState<string>('');
  const [contractNotesInput, setContractNotesInput] = useState<string>('');
  const [contractActiveInput, setContractActiveInput] = useState<boolean>(true);
  const [isSavingContract, setIsSavingContract] = useState<boolean>(false);

  // نافذة المسح الانتقائي للسجلات (Selective Purge Modal)
  const [showPurgeModal, setShowPurgeModal] = useState<boolean>(false);
  const [purgeOptions, setPurgeOptions] = useState<SelectivePurgeOptions>({
    purgePastBookings: true,
    beforeDate: todayStr,
    purgeAllBookings: false,
    purgeShiftHandovers: false,
    purgeConsultationStamps: false,
    purgeWhatsAppAndPrintLogs: true,
    purgeSystemErrorLogs: false
  });
  const [isPurging, setIsPurging] = useState<boolean>(false);

  // الأطباء المتاحون حسب العيادة المختارة
  const availableDoctorsForFilter = useMemo(() => {
    if (selectedClinicId === 'all') return doctors;
    return doctors.filter(d => d.clinicId === selectedClinicId);
  }, [doctors, selectedClinicId]);

  // الحجوزات المفلترة حسب اختيارات مدير المالية
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (b.status === 'cancelled') return false;

      if (dateFilterMode === 'today') {
        if (b.date !== todayStr) return false;
      } else if (dateFilterMode === 'custom_range') {
        if (startDate && b.date < startDate) return false;
        if (endDate && b.date > endDate) return false;
      }

      if (selectedClinicId !== 'all' && b.clinicId !== selectedClinicId) return false;
      if (selectedDoctorId !== 'all' && b.doctorId !== selectedDoctorId) return false;

      if (selectedPaymentFilter !== 'all') {
        if (selectedPaymentFilter === 'unpaid' && b.paymentStatus !== 'unpaid') return false;
        if (selectedPaymentFilter === 'cash' && (b.paymentStatus !== 'paid' || b.paymentMethod !== 'cash')) return false;
        if (selectedPaymentFilter === 'insurance' && (b.paymentStatus !== 'paid' || b.paymentMethod !== 'insurance')) return false;
        if (selectedPaymentFilter === 'consultation' && b.paymentMethod !== 'consultation') return false;
        if (selectedPaymentFilter === 'charity_exempt' && (b.paymentStatus !== 'exempt' || b.paymentMethod === 'consultation')) return false;
      }

      if (selectedInsuranceCompanyFilter !== 'all') {
        if (b.paymentMethod !== 'insurance') return false;
        if (
          b.insuranceDetails?.companyId !== selectedInsuranceCompanyFilter &&
          b.insuranceDetails?.companyName !== selectedInsuranceCompanyFilter
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    bookings,
    dateFilterMode,
    todayStr,
    startDate,
    endDate,
    selectedClinicId,
    selectedDoctorId,
    selectedPaymentFilter,
    selectedInsuranceCompanyFilter
  ]);

  // المؤشرات المالية الدقيقة (Financial KPIs)
  const financialMetrics = useMemo(() => {
    let totalGrossRevenue = 0; // إجمالي قيمة الكشوفات (نقدي + إجمالي قيمة كشف التأمين)
    let actualCashInSafe = 0; // النقدية الفعلية بالخزينة (نقدي كامل + نسبة تحمل المريض في التأمين)
    let insuranceReceivables = 0; // مستحقات آجلة على شركات التأمين
    let cashBookingsCount = 0;
    let insuranceBookingsCount = 0;
    let consultationCount = 0;
    let charityExemptCount = 0;
    let unpaidCount = 0;

    for (const b of filteredBookings) {
      if (b.paymentStatus === 'unpaid') {
        unpaidCount += 1;
        continue;
      }
      if (b.paymentMethod === 'consultation') {
        consultationCount += 1;
        continue;
      }
      if (b.paymentStatus === 'exempt' || b.paymentMethod === 'charity_exempt') {
        charityExemptCount += 1;
        continue;
      }
      if (b.paymentStatus === 'paid') {
        const originalFee = b.insuranceDetails?.originalFee ?? b.fee ?? 0;
        if (b.paymentMethod === 'insurance') {
          insuranceBookingsCount += 1;
          const patientPaid = b.insuranceDetails?.patientPaidAmount ?? b.fee ?? 0;
          const companyCovered =
            b.insuranceDetails?.insuranceCoveredAmount ?? Math.max(0, originalFee - patientPaid);
          totalGrossRevenue += originalFee;
          actualCashInSafe += patientPaid;
          insuranceReceivables += companyCovered;
        } else {
          cashBookingsCount += 1;
          totalGrossRevenue += b.fee;
          actualCashInSafe += b.fee;
        }
      }
    }

    return {
      totalGrossRevenue,
      actualCashInSafe,
      insuranceReceivables,
      cashBookingsCount,
      insuranceBookingsCount,
      consultationCount,
      charityExemptCount,
      unpaidCount,
      totalCases: filteredBookings.length
    };
  }, [filteredBookings]);

  // تجميع إحصائيات كل عيادة وكل طبيب
  const clinicDoctorBreakdown = useMemo(() => {
    const rows: {
      clinicId: string;
      clinicName: string;
      doctorId: string;
      doctorName: string;
      totalPatients: number;
      cashCount: number;
      insuranceCount: number;
      consultationCount: number;
      exemptCount: number;
      cashInSafe: number;
      insuranceClaim: number;
      grossRevenue: number;
    }[] = [];

    const map = new Map<string, (typeof rows)[number]>();

    for (const b of filteredBookings) {
      const key = `${b.clinicId}__${b.doctorId}`;
      if (!map.has(key)) {
        map.set(key, {
          clinicId: b.clinicId,
          clinicName: b.clinicName,
          doctorId: b.doctorId,
          doctorName: b.doctorName,
          totalPatients: 0,
          cashCount: 0,
          insuranceCount: 0,
          consultationCount: 0,
          exemptCount: 0,
          cashInSafe: 0,
          insuranceClaim: 0,
          grossRevenue: 0
        });
      }
      const entry = map.get(key)!;
      entry.totalPatients += 1;

      if (b.paymentMethod === 'consultation') {
        entry.consultationCount += 1;
      } else if (b.paymentStatus === 'exempt' || b.paymentMethod === 'charity_exempt') {
        entry.exemptCount += 1;
      } else if (b.paymentStatus === 'paid') {
        if (b.paymentMethod === 'insurance') {
          entry.insuranceCount += 1;
          const orig = b.insuranceDetails?.originalFee ?? b.fee ?? 0;
          const patPaid = b.insuranceDetails?.patientPaidAmount ?? b.fee ?? 0;
          const insClaim = b.insuranceDetails?.insuranceCoveredAmount ?? Math.max(0, orig - patPaid);
          entry.cashInSafe += patPaid;
          entry.insuranceClaim += insClaim;
          entry.grossRevenue += orig;
        } else {
          entry.cashCount += 1;
          entry.cashInSafe += b.fee;
          entry.grossRevenue += b.fee;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.grossRevenue - a.grossRevenue);
  }, [filteredBookings]);

  // تجميع مطالبات شركات التأمين
  const insuranceClaimsSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        companyName: string;
        casesCount: number;
        totalOriginalFees: number;
        totalPatientCopay: number;
        totalCompanyReceivable: number;
        cardsUsed: Set<string>;
      }
    >();

    for (const b of filteredBookings) {
      if (b.paymentStatus === 'paid' && b.paymentMethod === 'insurance') {
        const companyName = b.insuranceDetails?.companyName || 'تأمين طبي عام';
        if (!map.has(companyName)) {
          map.set(companyName, {
            companyName,
            casesCount: 0,
            totalOriginalFees: 0,
            totalPatientCopay: 0,
            totalCompanyReceivable: 0,
            cardsUsed: new Set()
          });
        }
        const item = map.get(companyName)!;
        const orig = b.insuranceDetails?.originalFee ?? b.fee ?? 0;
        const pat = b.insuranceDetails?.patientPaidAmount ?? b.fee ?? 0;
        const comp = b.insuranceDetails?.insuranceCoveredAmount ?? Math.max(0, orig - pat);
        item.casesCount += 1;
        item.totalOriginalFees += orig;
        item.totalPatientCopay += pat;
        item.totalCompanyReceivable += comp;
        if (b.insuranceDetails?.cardCategory) {
          item.cardsUsed.add(b.insuranceDetails.cardCategory);
        }
      }
    }

    return Array.from(map.values()).map(item => ({
      ...item,
      cardsList: Array.from(item.cardsUsed).join('، ') || 'غير محدد'
    }));
  }, [filteredBookings]);

  // تصدير شيت الإكسل الشامل (مع شيت مستقل لكل عيادة + شيت الأطباء + شيت التأمين + شيت الشفتات)
  const handleExportComprehensiveExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // 1. شيت ملخص العيادات والأطباء
      const summaryRows = clinicDoctorBreakdown.map((r, idx) => ({
        'م': idx + 1,
        'العيادة': r.clinicName,
        'الطبيب المعالج': r.doctorName,
        'إجمالي الحالات': r.totalPatients,
        'كشوفات نقدي': r.cashCount,
        'كشوفات تأمين': r.insuranceCount,
        'استشارات مجانية': r.consultationCount,
        'إعفاء خيري': r.exemptCount,
        'المحصل نقداً بالخزينة (ج.م)': r.cashInSafe,
        'مستحقات شركات التأمين (ج.م)': r.insuranceClaim,
        'إجمالي إيراد العيادة (ج.م)': r.grossRevenue
      }));

      summaryRows.push({
        'م': 0,
        'العيادة': 'الإجمالي العام',
        'الطبيب المعالج': `${clinicDoctorBreakdown.length} عيادة/طبيب`,
        'إجمالي الحالات': financialMetrics.totalCases,
        'كشوفات نقدي': financialMetrics.cashBookingsCount,
        'كشوفات تأمين': financialMetrics.insuranceBookingsCount,
        'استشارات مجانية': financialMetrics.consultationCount,
        'إعفاء خيري': financialMetrics.charityExemptCount,
        'المحصل نقداً بالخزينة (ج.م)': financialMetrics.actualCashInSafe,
        'مستحقات شركات التأمين (ج.م)': financialMetrics.insuranceReceivables,
        'إجمالي إيراد العيادة (ج.م)': financialMetrics.totalGrossRevenue
      });

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'ملخص العيادات والأطباء');

      // 2. شيت السجل التفصيلي لكافة الحجوزات المفلترة
      const formatBookingRow = (b: (typeof filteredBookings)[number], idx: number) => {
        const paymentLabel =
          b.paymentStatus === 'unpaid'
            ? 'غير مسدد'
            : b.paymentMethod === 'consultation'
            ? 'استشارة مجانية'
            : b.paymentStatus === 'exempt' || b.paymentMethod === 'charity_exempt'
            ? 'إعفاء خيري'
            : b.paymentMethod === 'insurance'
            ? 'تأمين طبي'
            : 'نقدي (كاش)';

        const origFee = b.insuranceDetails?.originalFee ?? b.fee ?? 0;
        const cashPaid =
          b.paymentStatus === 'paid'
            ? b.paymentMethod === 'insurance'
              ? (b.insuranceDetails?.patientPaidAmount ?? b.fee ?? 0)
              : b.fee
            : 0;
        const insCovered =
          b.paymentStatus === 'paid' && b.paymentMethod === 'insurance'
            ? (b.insuranceDetails?.insuranceCoveredAmount ?? Math.max(0, origFee - cashPaid))
            : 0;

        return {
          'م': idx + 1,
          'التاريخ': b.date,
          'رقم التذكرة': b.ticketNumber,
          'اسم المريض': b.patientName,
          'رقم الهاتف': b.patientPhone,
          'العيادة': b.clinicName,
          'الطبيب': b.doctorName,
          'نوع السداد': paymentLabel,
          'شركة التأمين': b.insuranceDetails?.companyName || '-',
          'فئة الكارت': b.insuranceDetails?.cardCategory || '-',
          'رقم كارت التأمين': b.insuranceDetails?.cardNumber || '-',
          'نسبة التحمل المكتوبة بالكارت': b.insuranceDetails?.copayInputRaw
            ? `${b.insuranceDetails.copayInputRaw} (${b.insuranceDetails.copayPercentage}%)`
            : '-',
          'قيمة الكشف الأصلية (ج.م)': origFee,
          'المدفوع نقداً بالخزينة (ج.م)': cashPaid,
          'المستحق على شركة التأمين (ج.م)': insCovered
        };
      };

      const allDetailedRows = filteredBookings.map((b, i) => formatBookingRow(b, i));
      const wsAllDetailed = XLSX.utils.json_to_sheet(
        allDetailedRows.length > 0
          ? allDetailedRows
          : [{ 'ملاحظة': 'لا توجد حجوزات مطابقة للفلاتر المحددة' }]
      );
      XLSX.utils.book_append_sheet(wb, wsAllDetailed, 'سجل الحجوزات التفصيلي');

      // 3. شيت مطالبات شركات التأمين
      const insRows = insuranceClaimsSummary.map((item, idx) => ({
        'م': idx + 1,
        'اسم شركة التأمين': item.companyName,
        'فئات الكروت المستخدمة': item.cardsList,
        'عدد الحالات': item.casesCount,
        'إجمالي قيمة الكشوفات (ج.م)': item.totalOriginalFees,
        'إجمالي تحمل المرضى نقداً (ج.م)': item.totalPatientCopay,
        'صافي المطالبة المستحقة على الشركة (ج.م)': item.totalCompanyReceivable
      }));
      const wsInsurance = XLSX.utils.json_to_sheet(
        insRows.length > 0 ? insRows : [{ 'ملاحظة': 'لا توجد حالات تأمين طبي في الفترة المحددة' }]
      );
      XLSX.utils.book_append_sheet(wb, wsInsurance, 'مطالبات شركات التأمين');

      // 4. شيت تسليم واستلام الشفتات والخزينة
      const handoverRows = shiftHandovers.map((h, idx) => ({
        'م': idx + 1,
        'التاريخ': h.shiftDate,
        'القسم': h.department === 'cashier' ? 'الخزينة (الكاشير)' : 'الاستقبال',
        'الموظف المُسلِّم': h.fromStaffName,
        'الجهة / الموظف المُستلِم': h.toStaffName,
        'نوع التسليم':
          h.handoverType === 'cashier_to_management'
            ? 'تسليم المبلغ للإدارة'
            : h.handoverType === 'cashier_to_colleague'
            ? 'تسليم الخزينة للزميل'
            : 'تسليم شفت استقبال',
        'المبلغ المُسلَّم (ج.م)': h.expectedAmount ?? '-',
        'المبلغ الفعلي المستلم (ج.م)':
          h.status === 'delivered_to_management'
            ? (h.expectedAmount ?? '-')
            : (h.actualReceivedAmount ?? 'قيد الاستلام'),
        'الفرق (ج.م)':
          h.actualReceivedAmount !== undefined && h.expectedAmount !== undefined
            ? h.actualReceivedAmount - h.expectedAmount
            : 0,
        'حالة الاستلام':
          h.status === 'delivered_to_management'
            ? 'تم التسليم للإدارة'
            : h.status === 'accepted_exact'
            ? 'تم الاستلام بالكامل (مطابق)'
            : h.status === 'discrepancy_reported'
            ? 'يوجد فرق (غير مطابق)'
            : 'بانتظار تأكيد الزميل',
        'ملاحظات': h.acknowledgmentNotes || h.notes || '-'
      }));
      const wsHandovers = XLSX.utils.json_to_sheet(
        handoverRows.length > 0 ? handoverRows : [{ 'ملاحظة': 'لا توجد سجلات تسليم شفتات بعد' }]
      );
      XLSX.utils.book_append_sheet(wb, wsHandovers, 'سجل تسليم الشفتات والخزينة');

      // 5. شيت مستقل لكل عيادة على حدة (بحيث يجد المدير كل عيادة لوحدها في ورقة منفصلة داخل نفس الملف)
      const clinicsWithBookings = clinics.filter(c =>
        filteredBookings.some(b => b.clinicId === c.id)
      );
      for (const clinic of clinicsWithBookings) {
        const clinicBookings = filteredBookings.filter(b => b.clinicId === clinic.id);
        const clinicRows = clinicBookings.map((b, i) => formatBookingRow(b, i));
        const wsClinic = XLSX.utils.json_to_sheet(clinicRows);
        // اسم الشيت بحد أقصى 31 حرف حسب مواصفات Excel
        const safeSheetName = clinic.name.replace(/[\\/?*[\]:]/g, '').slice(0, 30) || clinic.id;
        try {
          XLSX.utils.book_append_sheet(wb, wsClinic, safeSheetName);
        } catch {
          // في حال تكرار الاسم
        }
      }

      const fileLabel =
        dateFilterMode === 'today'
          ? todayStr
          : dateFilterMode === 'custom_range'
          ? `${startDate}_to_${endDate}`
          : 'all_dates';

      XLSX.writeFile(wb, `Sharaya_Finance_Report_${fileLabel}.xlsx`);

      addToast({
        type: 'success',
        title: 'تم تصدير شيت الإكسل الشامل بنجاح',
        message: 'تم تحميل ملف الإكسل شاملاً ملخص العيادات والأطباء، وشيت مستقل لكل عيادة، ومطالبات التأمين، وسجل الخزينة.'
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'تعذر تصدير الإكسل',
        message: err?.message || 'حدث خطأ أثناء إنشاء ملف الإكسل.'
      });
    }
  };

  // إدارة فئات الكروت في نموذج التعاقد
  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleAddCustomCategory = () => {
    const clean = customCategoryInput.trim();
    if (!clean) return;
    if (!selectedCategories.includes(clean)) {
      setSelectedCategories(prev => [...prev, clean]);
    }
    setCustomCategoryInput('');
  };

  const handleSaveContractSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingContract(true);
    try {
      const ok = await saveInsuranceContract({
        id: editingContractId || undefined,
        companyName: companyNameInput,
        cardCategories: selectedCategories,
        isActive: contractActiveInput,
        notes: contractNotesInput
      });
      if (ok) {
        setEditingContractId(null);
        setCompanyNameInput('');
        setSelectedCategories(['فضي (Silver)', 'جولد (Gold)', 'بلاتينيوم (Platinum)']);
        setContractNotesInput('');
        setContractActiveInput(true);
      }
    } finally {
      setIsSavingContract(false);
    }
  };

  const startEditContract = (contract: InsuranceCompanyContract) => {
    setEditingContractId(contract.id);
    setCompanyNameInput(contract.companyName);
    setSelectedCategories(contract.cardCategories);
    setContractNotesInput(contract.notes || '');
    setContractActiveInput(contract.isActive);
  };

  // تنفيذ المسح الانتقائي للسجلات
  const handleConfirmSelectivePurge = async () => {
    setIsPurging(true);
    try {
      const res = await selectivePurgeRecords(purgeOptions);
      if (res.success) {
        setShowPurgeModal(false);
      }
    } finally {
      setIsPurging(false);
    }
  };

  const discrepancyHandoversCount = useMemo(
    () => shiftHandovers.filter(h => h.status === 'discrepancy_reported').length,
    [shiftHandovers]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6" dir="rtl">
      {/* الترويسة العلوية لبوابة مدير المالية */}
      <div className="bg-gradient-to-l from-emerald-900 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-emerald-700/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-bold">
              <DollarSign className="w-4 h-4" />
              <span>بوابة الإدارة المالية والتعاقدات والرقابة</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              منظومة مدير المالية وتعاقدات التأمين
            </h1>
            <p className="text-emerald-100/90 text-sm max-w-2xl leading-relaxed">
              مرحباً بك <strong>{currentUser?.displayName}</strong> — يمكنك من هنا متابعة إيرادات كل عيادة وكل طبيب، إدارة تعاقدات شركات التأمين وفئات الكروت، مراجعة تسليم شفتات الخزينة، وتصدير تقارير الإكسل أو تفريغ السجلات القديمة للحفاظ على مساحة قاعدة البيانات.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportComprehensiveExcel}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-950/30 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span>تصدير شيت الإكسل الشامل (.xlsx)</span>
            </button>

            <button
              onClick={() => setShowPurgeModal(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-950/30 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>تنظيف ومسح السجلات</span>
            </button>

            {currentUser?.role === 'admin' && (
              <button
                onClick={() => navigate('admin')}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/15 transition cursor-pointer"
              >
                <Building2 className="w-4 h-4" />
                <span>العودة للوحة الأدمن</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* بطاقات المؤشرات المالية السريعة (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              النقدية الفعلية بالخزينة (كاش + تحمل التأمين)
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {financialMetrics.actualCashInSafe.toLocaleString()} <span className="text-sm font-bold">ج.م</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            من {financialMetrics.cashBookingsCount} كشف نقدي + تحمل {financialMetrics.insuranceBookingsCount} كارت تأمين
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              مستحقات شركات التأمين الآجلة
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
            {financialMetrics.insuranceReceivables.toLocaleString()} <span className="text-sm font-bold">ج.م</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            إجمالي المطالبات على شركات التأمين ({financialMetrics.insuranceBookingsCount} حالة)
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              إجمالي قيمة الكشوفات (شامل التأمين)
            </span>
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {financialMetrics.totalGrossRevenue.toLocaleString()} <span className="text-sm font-bold">ج.م</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            استشارات مجانية: {financialMetrics.consultationCount} | إعفاء خيري: {financialMetrics.charityExemptCount}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              رقابة تسليم الشفتات والخزينة
            </span>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                discrepancyHandoversCount > 0
                  ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'
                  : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
              }`}
            >
              <ArrowRightLeft className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {shiftHandovers.length} <span className="text-sm font-bold">عملية تسليم</span>
          </div>
          <p className="text-xs mt-1">
            {discrepancyHandoversCount > 0 ? (
              <span className="text-rose-600 dark:text-rose-400 font-bold">
                تنبيه: يوجد {discrepancyHandoversCount} عملية تسليم بها فرق مالي!
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                جميع عمليات تسليم الخزينة مطابقة
              </span>
            )}
          </p>
        </div>
      </div>

      {/* شريط التبويبات الرئيسية */}
      <div className="flex flex-wrap gap-2 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex-1 min-w-[200px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>تقارير العيادات والأطباء وشيت الإكسل</span>
        </button>

        <button
          onClick={() => setActiveTab('insurance')}
          className={`flex-1 min-w-[200px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition cursor-pointer ${
            activeTab === 'insurance'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>تعاقدات شركات التأمين وفئات الكروت ({insuranceContracts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('handovers')}
          className={`flex-1 min-w-[200px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition cursor-pointer ${
            activeTab === 'handovers'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>سجل تسليم الشفتات والخزينة ({shiftHandovers.length})</span>
          {discrepancyHandoversCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-rose-500 text-white font-extrabold">
              {discrepancyHandoversCount} فرق
            </span>
          )}
        </button>
      </div>

      {/* ========================================== */}
      {/* التبويب الأول: التقارير المالية وشيت الإكسل */}
      {/* ========================================== */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* شريط الفلترة المتقدمة */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold">
                <Filter className="w-5 h-5 text-emerald-600" />
                <span>تخصيص التقرير المالي وشيت الإكسل (حسب العيادة / الطبيب / التاريخ / التأمين)</span>
              </div>
              <button
                onClick={handleExportComprehensiveExcel}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تحميل شيت الإكسل بالفلتر الحالي</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* نطاق التاريخ */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  الفترة الزمنية
                </label>
                <select
                  value={dateFilterMode}
                  onChange={e => setDateFilterMode(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm font-semibold"
                >
                  <option value="today">اليوم فقط ({todayStr})</option>
                  <option value="custom_range">فترة محددة (من - إلى)</option>
                  <option value="all">كل التواريخ المسجلة</option>
                </select>
              </div>

              {/* اختيار العيادة */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  العيادة
                </label>
                <select
                  value={selectedClinicId}
                  onChange={e => {
                    setSelectedClinicId(e.target.value);
                    setSelectedDoctorId('all');
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm font-semibold"
                >
                  <option value="all">كل العيادات (مع شيت لكل عيادة)</option>
                  {clinics.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* اختيار الطبيب */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  الطبيب المعالج
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={e => setSelectedDoctorId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm font-semibold"
                >
                  <option value="all">كل الأطباء</option>
                  {availableDoctorsForFilter.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.clinicName})
                    </option>
                  ))}
                </select>
              </div>

              {/* طريقة الدفع */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  نوع السداد
                </label>
                <select
                  value={selectedPaymentFilter}
                  onChange={e => setSelectedPaymentFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm font-semibold"
                >
                  <option value="all">جميع الحالات</option>
                  <option value="cash">نقدي (كاش) فقط</option>
                  <option value="insurance">تأمين طبي فقط</option>
                  <option value="consultation">استشارة مجانية فقط</option>
                  <option value="charity_exempt">إعفاء خيري فقط</option>
                  <option value="unpaid">غير مسدد</option>
                </select>
              </div>

              {/* شركة التأمين */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  شركة التأمين
                </label>
                <select
                  value={selectedInsuranceCompanyFilter}
                  onChange={e => setSelectedInsuranceCompanyFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm font-semibold"
                >
                  <option value="all">كل شركات التأمين</option>
                  {insuranceContracts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {dateFilterMode === 'custom_range' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    من تاريخ
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    إلى تاريخ
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* جدول إيرادات كل عيادة وكل دكتور */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  ملخص إيرادات العيادات والأطباء (تقرير تفصيلي لكل عيادة وكل طبيب)
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                عند تصدير الإكسل يتم أيضاً إنشاء ورقة (Sheet) مستقلة لكل عيادة تلقائياً
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 text-xs font-bold">
                  <tr>
                    <th className="py-3.5 px-4">العيادة</th>
                    <th className="py-3.5 px-4">الطبيب المعالج</th>
                    <th className="py-3.5 px-4 text-center">إجمالي الحالات</th>
                    <th className="py-3.5 px-4 text-center">نقدي</th>
                    <th className="py-3.5 px-4 text-center">تأمين طبي</th>
                    <th className="py-3.5 px-4 text-center">استشارة مجانية</th>
                    <th className="py-3.5 px-4">المحصل بالخزينة</th>
                    <th className="py-3.5 px-4">مطالبة التأمين</th>
                    <th className="py-3.5 px-4">إجمالي الإيراد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {clinicDoctorBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        لا توجد سجلات مطابقة للفلاتر المختارة حالياً.
                      </td>
                    </tr>
                  ) : (
                    clinicDoctorBreakdown.map(row => (
                      <tr key={`${row.clinicId}-${row.doctorId}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30">
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{row.clinicName}</td>
                        <td className="py-3.5 px-4 text-slate-700 dark:text-slate-200 font-semibold">{row.doctorName}</td>
                        <td className="py-3.5 px-4 text-center font-bold">{row.totalPatients}</td>
                        <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">{row.cashCount}</td>
                        <td className="py-3.5 px-4 text-center text-blue-600 font-bold">{row.insuranceCount}</td>
                        <td className="py-3.5 px-4 text-center text-purple-600 font-bold">{row.consultationCount}</td>
                        <td className="py-3.5 px-4 font-extrabold text-emerald-600 dark:text-emerald-400">
                          {row.cashInSafe.toLocaleString()} ج.م
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-blue-600 dark:text-blue-400">
                          {row.insuranceClaim.toLocaleString()} ج.م
                        </td>
                        <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white">
                          {row.grossRevenue.toLocaleString()} ج.م
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* جدول الحجوزات والتحصيل التفصيلي */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  السجل التفصيلي للكشوفات وتفاصيل كروت التأمين ({filteredBookings.length} حالة)
                </h2>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[460px]">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 text-xs font-bold sticky top-0">
                  <tr>
                    <th className="py-3 px-4">التذكرة</th>
                    <th className="py-3 px-4">التاريخ</th>
                    <th className="py-3 px-4">المريض</th>
                    <th className="py-3 px-4">العيادة / الطبيب</th>
                    <th className="py-3 px-4">طريقة السداد</th>
                    <th className="py-3 px-4">بيانات التأمين والكارت</th>
                    <th className="py-3 px-4">المدفوع بالخزينة</th>
                    <th className="py-3 px-4">تحمل شركة التأمين</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        لا توجد حجوزات للعرض.
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map(b => {
                      const origFee = b.insuranceDetails?.originalFee ?? b.fee ?? 0;
                      const patientPaid =
                        b.paymentStatus === 'paid'
                          ? b.paymentMethod === 'insurance'
                            ? (b.insuranceDetails?.patientPaidAmount ?? b.fee ?? 0)
                            : b.fee
                          : 0;
                      const companyClaim =
                        b.paymentStatus === 'paid' && b.paymentMethod === 'insurance'
                          ? (b.insuranceDetails?.insuranceCoveredAmount ?? Math.max(0, origFee - patientPaid))
                          : 0;

                      return (
                        <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30">
                          <td className="py-3 px-4 font-black text-emerald-700 dark:text-emerald-400">
                            {b.ticketNumber}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500">{b.date}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">{b.patientName}</div>
                            <div className="text-xs text-slate-500">{b.patientPhone}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{b.clinicName}</div>
                            <div className="text-xs text-slate-500">{b.doctorName}</div>
                          </td>
                          <td className="py-3 px-4">
                            {b.paymentStatus === 'unpaid' ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                غير مسدد
                              </span>
                            ) : b.paymentMethod === 'insurance' ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                                تأمين طبي
                              </span>
                            ) : b.paymentMethod === 'consultation' ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                                استشارة مجانية
                              </span>
                            ) : b.paymentStatus === 'exempt' ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                                إعفاء خيري
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                نقدي (كاش)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {b.paymentMethod === 'insurance' && b.insuranceDetails ? (
                              <div className="space-y-0.5">
                                <div className="font-bold text-blue-700 dark:text-blue-300">
                                  {b.insuranceDetails.companyName} — ({b.insuranceDetails.cardCategory})
                                </div>
                                <div className="text-slate-500">
                                  كارت: <span className="font-mono font-bold">{b.insuranceDetails.cardNumber}</span> | تحمل:{' '}
                                  <span className="font-bold text-slate-700 dark:text-slate-200">
                                    {b.insuranceDetails.copayInputRaw} ({b.insuranceDetails.copayPercentage}%)
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-extrabold text-emerald-600 dark:text-emerald-400">
                            {patientPaid.toLocaleString()} ج.م
                          </td>
                          <td className="py-3 px-4 font-extrabold text-blue-600 dark:text-blue-400">
                            {companyClaim > 0 ? `${companyClaim.toLocaleString()} ج.م` : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* التبويب الثاني: تعاقدات شركات التأمين وفئات الكروت */}
      {/* ========================================== */}
      {activeTab === 'insurance' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* نموذج إضافة أو تعديل شركة تأمين */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5 h-fit">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {editingContractId ? 'تعديل تعاقد شركة التأمين' : 'إضافة شركة تأمين متعاقدة جديدة'}
                </h2>
              </div>
              {editingContractId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingContractId(null);
                    setCompanyNameInput('');
                    setSelectedCategories(['فضي (Silver)', 'جولد (Gold)', 'بلاتينيوم (Platinum)']);
                    setContractNotesInput('');
                  }}
                  className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
                >
                  إلغاء التعديل
                </button>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 mb-1">
                <Info className="w-4 h-4 shrink-0 text-blue-600" />
                <span>كيف يعمل نظام التعاقد المرن؟</span>
              </div>
              تحدد هنا <strong>اسم شركة التأمين</strong> و<strong>فئات الكروت التي تصدرها</strong> (جولد، فضي، بلاتينيوم...). وعند حضور المريض للخزينة، يختار الكاشير الشركة وفئة الكارت ويكتب رقم الكارت ونسبة التحمل المدونة على الكارت (مثل <code>20%</code> أو <code>10%</code> أو <code>20/10</code> أو <code>0%</code>).
            </div>

            <form onSubmit={handleSaveContractSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  اسم شركة التأمين الطبي *
                </label>
                <input
                  type="text"
                  required
                  value={companyNameInput}
                  onChange={e => setCompanyNameInput(e.target.value)}
                  placeholder="مثال: ميتلايف (MetLife) / أكسا (AXA) / ميدنت"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  فئات الكروت المعتمدة لهذه الشركة (اختر فئة أو أكثر) *
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_CARD_CATEGORIES.map(cat => {
                    const isSelected = selectedCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                        <span>{cat}</span>
                      </button>
                    );
                  })}
                </div>

                {/* إضافة فئة كارت مخصصة */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCategoryInput}
                    onChange={e => setCustomCategoryInput(e.target.value)}
                    placeholder="أو اكتب اسم فئة كارت إضافية..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomCategory}
                    className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold hover:bg-slate-300 transition cursor-pointer"
                  >
                    + إضافة فئة
                  </button>
                </div>

                {selectedCategories.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {selectedCategories.map(cat => (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold"
                      >
                        <span>{cat}</span>
                        <button
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          className="text-emerald-500 hover:text-rose-500 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  ملاحظات التعاقد (اختياري)
                </label>
                <input
                  type="text"
                  value={contractNotesInput}
                  onChange={e => setContractNotesInput(e.target.value)}
                  placeholder="مثال: يشمل تعاقدات السويدي وسعودي والبنوك..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingContract}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{editingContractId ? 'حفظ تعديلات التعاقد' : 'إضافة وحفظ شركة التأمين'}</span>
              </button>
            </form>
          </div>

          {/* قائمة شركات التأمين المسجلة ومطالباتها */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                <span>شركات التأمين المتعاقدة وفئات الكروت المفعلة ({insuranceContracts.length})</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insuranceContracts.map(contract => (
                  <div
                    key={contract.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                          {contract.companyName}
                        </h4>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEditContract(contract)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                            title="تعديل الشركة وفئات الكروت"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteInsuranceContract(contract.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="حذف شركة التأمين"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {contract.cardCategories.map(cat => (
                          <span
                            key={cat}
                            className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-blue-100/80 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>

                      {contract.notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">{contract.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ملخص مطالبات كل شركة تأمين */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <BadgePercent className="w-5 h-5 text-blue-600" />
                <span>ملخص المطالبات المالية المستحقة على شركات التأمين</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 text-xs font-bold">
                    <tr>
                      <th className="py-3 px-4">شركة التأمين</th>
                      <th className="py-3 px-4">فئات الكروت المستخدمة</th>
                      <th className="py-3 px-4 text-center">عدد الكشوفات</th>
                      <th className="py-3 px-4">تحمل المرضى (نقداً)</th>
                      <th className="py-3 px-4">المستحق على الشركة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {insuranceClaimsSummary.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                          لم يتم تسجيل كشوفات تأمين طبي في الفترة المحددة بعد.
                        </td>
                      </tr>
                    ) : (
                      insuranceClaimsSummary.map(item => (
                        <tr key={item.companyName}>
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            {item.companyName}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                            {item.cardsList}
                          </td>
                          <td className="py-3 px-4 text-center font-bold">{item.casesCount}</td>
                          <td className="py-3 px-4 font-bold text-emerald-600">
                            {item.totalPatientCopay.toLocaleString()} ج.م
                          </td>
                          <td className="py-3 px-4 font-black text-blue-600 dark:text-blue-400">
                            {item.totalCompanyReceivable.toLocaleString()} ج.م
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* التبويب الثالث: رقابة تسليم واستلام الشفتات والخزينة */}
      {/* ========================================== */}
      {activeTab === 'handovers' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                سجل تسليم واستلام الشفتات وعهدة الخزينة (الاستقبال + الكاشير)
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              يظهر هنا ما إذا تم تسليم المبلغ للإدارة أو لزميل الكاشير، والمبلغ الفعلي المستلم في حال وجود فرق
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 text-xs font-bold">
                <tr>
                  <th className="py-3.5 px-4">التاريخ والوقت</th>
                  <th className="py-3.5 px-4">القسم</th>
                  <th className="py-3.5 px-4">المُسلِّم</th>
                  <th className="py-3.5 px-4">المُستلِم / الجهة</th>
                  <th className="py-3.5 px-4">نوع العملية</th>
                  <th className="py-3.5 px-4">المبلغ المُسلَّم</th>
                  <th className="py-3.5 px-4">المبلغ الفعلي المستلم</th>
                  <th className="py-3.5 px-4">الحالة والفرق</th>
                  <th className="py-3.5 px-4">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {shiftHandovers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      لا توجد عمليات تسليم شفت مسجلة حتى الآن.
                    </td>
                  </tr>
                ) : (
                  shiftHandovers.map(h => {
                    const diff =
                      h.actualReceivedAmount !== undefined && h.expectedAmount !== undefined
                        ? h.actualReceivedAmount - h.expectedAmount
                        : 0;

                    return (
                      <tr key={h.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30">
                        <td className="py-3.5 px-4 text-xs text-slate-500">
                          <div className="font-bold text-slate-700 dark:text-slate-200">{h.shiftDate}</div>
                          <div>{new Date(h.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                              h.department === 'cashier'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
                            }`}
                          >
                            {h.department === 'cashier' ? 'الخزينة' : 'الاستقبال'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{h.fromStaffName}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">{h.toStaffName}</td>
                        <td className="py-3.5 px-4 text-xs font-bold">
                          {h.handoverType === 'cashier_to_management' ? (
                            <span className="text-purple-600 dark:text-purple-400">تسليم المبلغ للإدارة</span>
                          ) : h.handoverType === 'cashier_to_colleague' ? (
                            <span className="text-blue-600 dark:text-blue-400">تسليم الخزينة لزميل</span>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-300">تسليم شفت استقبال</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-extrabold">
                          {h.expectedAmount !== undefined ? `${h.expectedAmount.toLocaleString()} ج.م` : '—'}
                        </td>
                        <td className="py-3.5 px-4 font-extrabold">
                          {h.status === 'delivered_to_management'
                            ? `${(h.expectedAmount || 0).toLocaleString()} ج.م`
                            : h.actualReceivedAmount !== undefined
                            ? `${h.actualReceivedAmount.toLocaleString()} ج.م`
                            : 'بانتظار التأكيد'}
                        </td>
                        <td className="py-3.5 px-4">
                          {h.status === 'delivered_to_management' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              تم التسليم للإدارة
                            </span>
                          ) : h.status === 'accepted_exact' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              مطابق بالكامل
                            </span>
                          ) : h.status === 'discrepancy_reported' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              فرق: {diff > 0 ? `+${diff}` : diff} ج.م
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              <Clock className="w-3.5 h-3.5" />
                              بانتظار استلام الزميل
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500">
                          {h.acknowledgmentNotes || h.notes || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* نافذة المسح الانتقائي للسجلات (Selective Purge Modal) */}
      {/* ========================================== */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-7 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    تنظيف ومسح السجلات الانتقائي (حماية مساحة Supabase)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    اختر بدقة نوع السجلات التي ترغب في مسحها دون المساس بباقي بيانات المنظومة
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPurgeModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* زر تحميل نسخة إكسل احتياطية قبل المسح */}
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs text-emerald-900 dark:text-emerald-200">
                <div className="font-extrabold mb-0.5">نصيحة أمان مالي قبل المسح:</div>
                يمكنك تنزيل شيت الإكسل الشامل الآن للاحتفاظ بنسخة كاملة على جهازك قبل تفريغ السجلات.
              </div>
              <button
                type="button"
                onClick={handleExportComprehensiveExcel}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>تنزيل الإكسل أولاً</span>
              </button>
            </div>

            {/* قائمة الاختيارات */}
            <div className="space-y-3">
              {/* خيار 1: مسح حجوزات الأيام السابقة */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={purgeOptions.purgePastBookings && !purgeOptions.purgeAllBookings}
                  disabled={purgeOptions.purgeAllBookings}
                  onChange={e =>
                    setPurgeOptions(prev => ({ ...prev, purgePastBookings: e.target.checked }))
                  }
                  className="mt-1 w-4 h-4 accent-rose-600"
                />
                <div className="flex-1 text-xs">
                  <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                    مسح حجوزات الأيام السابقة (مع الإبقاء على حجوزات اليوم)
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    يمسح الحجوزات وتفاصيل كروت التأمين القديمة قبل التاريخ المحدد لتوفير مساحة قاعدة البيانات.
                  </p>
                  {purgeOptions.purgePastBookings && !purgeOptions.purgeAllBookings && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">مسح ما قبل تاريخ:</span>
                      <input
                        type="date"
                        value={purgeOptions.beforeDate || todayStr}
                        onChange={e =>
                          setPurgeOptions(prev => ({ ...prev, beforeDate: e.target.value }))
                        }
                        className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold"
                      />
                    </div>
                  )}
                </div>
              </label>

              {/* خيار 2: مسح كل الحجوزات بالكامل */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={purgeOptions.purgeAllBookings}
                  onChange={e =>
                    setPurgeOptions(prev => ({
                      ...prev,
                      purgeAllBookings: e.target.checked,
                      purgePastBookings: e.target.checked ? false : prev.purgePastBookings
                    }))
                  }
                  className="mt-1 w-4 h-4 accent-rose-600"
                />
                <div className="flex-1 text-xs">
                  <div className="font-extrabold text-rose-700 dark:text-rose-300 text-sm">
                    مسح جميع الحجوزات بالكامل (بما فيها حجوزات اليوم — {bookings.length} حجز)
                  </div>
                  <p className="text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                    تصفير شامل لجدول الحجوزات بالكامل من Supabase والتخزين المحلي.
                  </p>
                </div>
              </label>

              {/* خيار 3: مسح سجلات تسليم واستلام الشفتات والخزينة */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={purgeOptions.purgeShiftHandovers}
                  onChange={e =>
                    setPurgeOptions(prev => ({ ...prev, purgeShiftHandovers: e.target.checked }))
                  }
                  className="mt-1 w-4 h-4 accent-rose-600"
                />
                <div className="flex-1 text-xs">
                  <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                    مسح سجلات تسليم واستلام الشفتات والخزينة ({shiftHandovers.length} سجل)
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    تفريغ أرشيف تسليمات الخزينة والاستقبال السابقة بعد مراجعتها.
                  </p>
                </div>
              </label>

              {/* خيار 4: مسح بصمات الاستشارات المجانية */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={purgeOptions.purgeConsultationStamps}
                  onChange={e =>
                    setPurgeOptions(prev => ({ ...prev, purgeConsultationStamps: e.target.checked }))
                  }
                  className="mt-1 w-4 h-4 accent-rose-600"
                />
                <div className="flex-1 text-xs">
                  <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                    مسح بصمات الاستشارات المجانية الفعالة ({consultationRegistry.stamps.length} بصمة)
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    علماً بأن النظام يمسح بصمة المريض تلقائياً فور دخوله الاستشارة أو انتهاء مدتها.
                  </p>
                </div>
              </label>

              {/* خيار 5: مسح سجلات الواتساب والطباعة */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={purgeOptions.purgeWhatsAppAndPrintLogs}
                  onChange={e =>
                    setPurgeOptions(prev => ({
                      ...prev,
                      purgeWhatsAppAndPrintLogs: e.target.checked
                    }))
                  }
                  className="mt-1 w-4 h-4 accent-rose-600"
                />
                <div className="flex-1 text-xs">
                  <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                    مسح سجلات إشعارات الواتساب والطباعة الحرارية
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    تنظيف الذاكرة المحلية من سجلات التذاكر المطبوعة وإشعارات الواتساب المرسلة.
                  </p>
                </div>
              </label>

              {/* خيار 6: مسح سجلات أخطاء النظام */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={purgeOptions.purgeSystemErrorLogs}
                  onChange={e =>
                    setPurgeOptions(prev => ({ ...prev, purgeSystemErrorLogs: e.target.checked }))
                  }
                  className="mt-1 w-4 h-4 accent-rose-600"
                />
                <div className="flex-1 text-xs">
                  <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                    مسح سجلات أخطاء النظام التقنية ({errorLogs.length} سجل)
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    تفريغ سجل الأخطاء التقنية المسجل في قاعدة البيانات السحابية.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isPurging}
                onClick={handleConfirmSelectivePurge}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isPurging ? 'جاري المسح والتنظيف...' : 'تنفيذ مسح السجلات المحددة الآن'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
