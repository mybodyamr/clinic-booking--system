import React, { useState, useMemo } from 'react';
import XLSXStyle from 'xlsx-js-style';
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
  Filter,
  Download,
  Check,
  X,
  Info,
  Wallet,
  BadgePercent,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Receipt,
  Printer,
  BadgeCheck,
  Sliders,
  Calculator
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getLocalDateStr } from '../services/scheduleService';
import {
  buildFormattedRtlWorksheet,
  configureRtlWorkbook,
  writeStyledWorkbookFile,
  exportSingleStyledSheetToExcel
} from '../services/storage';
import {
  InsuranceCompanyContract,
  SelectivePurgeOptions,
  FinanceExpenseRecord,
  DoctorCommissionRule,
  Doctor
} from '../types';

const PRESET_CARD_CATEGORIES = [
  'فضي (Silver)',
  'جولد (Gold)',
  'بلاتينيوم (Platinum)',
  'دايموند (Diamond)',
  'VIP',
  'عادي (Standard)'
];

const EXPENSE_CATEGORY_LABELS: Record<FinanceExpenseRecord['category'], string> = {
  medical_supplies: 'مستلزمات طبية وتعقيم',
  utilities_bills: 'فواتير ومرافق',
  utilities_maintenance: 'صيانة ومرافق وفواتير',
  maintenance: 'صيانة وإصلاحات',
  hospitality: 'ضيافة واستقبال',
  hospitality_Allowance: 'ضيافة وبدلات انتداب',
  refund_return: 'رد كشف لمريض',
  petty_cash: 'نثريات عامة',
  other: 'مصروفات نثرية أخرى'
};

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
    approveShiftHandoverByManager,
    financeLedger,
    addFinanceExpense,
    deleteFinanceExpense,
    addInsuranceSettlement,
    deleteInsuranceSettlement,
    saveDoctorCommissionRule,
    consultationRegistry,
    errorLogs,
    selectivePurgeRecords,
    navigate,
    addToast
  } = useApp();

  const todayStr = getLocalDateStr(new Date());

  // التبويب النشط (شامل تبويب نسب ومستحقات الأطباء الجديد)
  const [activeTab, setActiveTab] = useState<
    'reports' | 'commissions' | 'expenses' | 'insurance' | 'handovers'
  >('reports');

  // خيار إظهار سهم الفلتر (▼) في ملفات الإكسل (معطل افتراضياً لعدم أكل أول الحروف العربية على الموبايل)
  const [enableExcelAutoFilter, setEnableExcelAutoFilter] = useState<boolean>(false);

  // فلاتر التقارير وشيت الإكسل
  const [dateFilterMode, setDateFilterMode] = useState<'today' | 'custom_range' | 'all'>('today');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('all');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all');
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<string>('all');
  const [selectedInsuranceCompanyFilter, setSelectedInsuranceCompanyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  // فلتر سجل تسليم الشفتات
  const [handoverFilter, setHandoverFilter] = useState<'all' | 'cashier' | 'reception' | 'discrepancy'>('all');
  const [approvingHandoverId, setApprovingHandoverId] = useState<string | null>(null);

  // نافذة إعداد وتعديل شرائح ونسب الطبيب (تحت تحكم مدير المالية بالكامل)
  const [isCommissionModalOpen, setIsCommissionModalOpen] = useState<boolean>(false);
  const [editingRuleDoctor, setEditingRuleDoctor] = useState<Doctor | null>(null);
  const [ruleConsultationFee, setRuleConsultationFee] = useState<string>('75');
  const [ruleTargetCases, setRuleTargetCases] = useState<string>('10');
  const [ruleTargetPct, setRuleTargetPct] = useState<string>('50');
  const [ruleBelowCases, setRuleBelowCases] = useState<string>('9');
  const [ruleBelowPct, setRuleBelowPct] = useState<string>('40');
  const [ruleAboveCases, setRuleAboveCases] = useState<string>('15');
  const [ruleAbovePct, setRuleAbovePct] = useState<string>('60');
  const [ruleNotes, setRuleNotes] = useState<string>('');
  const [isSavingCommissionRule, setIsSavingCommissionRule] = useState<boolean>(false);

  // نافذة إضافة مصروف أو سحب نقدي من الخزينة
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [expenseTitle, setExpenseTitle] = useState<string>('');
  const [expenseCategory, setExpenseCategory] = useState<FinanceExpenseRecord['category']>('medical_supplies');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseRecipient, setExpenseRecipient] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(todayStr);
  const [expenseNotes, setExpenseNotes] = useState<string>('');
  const [isSavingExpense, setIsSavingExpense] = useState<boolean>(false);

  // نافذة تسجيل تحصيل دفعة من شركة تأمين
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState<boolean>(false);
  const [settlementCompanyName, setSettlementCompanyName] = useState<string>('');
  const [settlementCompanyId, setSettlementCompanyId] = useState<string>('');
  const [settlementAmount, setSettlementAmount] = useState<string>('');
  const [settlementDate, setSettlementDate] = useState<string>(todayStr);
  const [settlementMethod, setSettlementMethod] = useState<'bank_transfer' | 'cheque' | 'cash'>('bank_transfer');
  const [settlementRefNumber, setSettlementRefNumber] = useState<string>('');
  const [settlementNotes, setSettlementNotes] = useState<string>('');
  const [isSavingSettlement, setIsSavingSettlement] = useState<boolean>(false);

  // نافذة إضافة / تعديل شركة تأمين (Modal)
  const [isContractModalOpen, setIsContractModalOpen] = useState<boolean>(false);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [companyNameInput, setCompanyNameInput] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'فضي (Silver)',
    'جولد (Gold)',
    'بلاتينيوم (Platinum)'
  ]);
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
    purgeSystemErrorLogs: false,
    purgeFinanceExpenses: false
  });
  const [isPurging, setIsPurging] = useState<boolean>(false);

  // الأطباء المتاحون حسب العيادة المختارة
  const availableDoctorsForFilter = useMemo(() => {
    if (selectedClinicId === 'all') return doctors;
    return doctors.filter(d => d.clinicId === selectedClinicId);
  }, [doctors, selectedClinicId]);

  // عدد الفلاتر المتقدمة النشطة
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedClinicId !== 'all') count++;
    if (selectedDoctorId !== 'all') count++;
    if (selectedPaymentFilter !== 'all') count++;
    if (selectedInsuranceCompanyFilter !== 'all') count++;
    if (searchQuery.trim() !== '') count++;
    return count;
  }, [selectedClinicId, selectedDoctorId, selectedPaymentFilter, selectedInsuranceCompanyFilter, searchQuery]);

  const handleResetFilters = () => {
    setDateFilterMode('today');
    setStartDate(todayStr);
    setEndDate(todayStr);
    setSelectedClinicId('all');
    setSelectedDoctorId('all');
    setSelectedPaymentFilter('all');
    setSelectedInsuranceCompanyFilter('all');
    setSearchQuery('');
  };

  // الحجوزات المفلترة حسب اختيارات مدير المالية
  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
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

      if (q) {
        const hay = `${b.ticketNumber} ${b.patientName} ${b.patientPhone} ${b.clinicName} ${b.doctorName} ${b.insuranceDetails?.companyName || ''} ${b.insuranceDetails?.cardNumber || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
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
    selectedInsuranceCompanyFilter,
    searchQuery
  ]);

  // المصروفات النثرية المفلترة حسب الفترة الزمنية المختارة
  const filteredExpenses = useMemo(() => {
    const list = financeLedger?.expenses || [];
    return list.filter(exp => {
      if (dateFilterMode === 'today') return exp.date === todayStr;
      if (dateFilterMode === 'custom_range') {
        if (startDate && exp.date < startDate) return false;
        if (endDate && exp.date > endDate) return false;
      }
      return true;
    });
  }, [financeLedger?.expenses, dateFilterMode, todayStr, startDate, endDate]);

  // المؤشرات المالية الدقيقة (Financial KPIs) شاملة المصروفات وصافي الخزينة
  const financialMetrics = useMemo(() => {
    let totalGrossRevenue = 0;
    let actualCashInSafe = 0;
    let insuranceReceivables = 0;
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

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netCashAfterExpenses = actualCashInSafe - totalExpenses;

    const totalSettledFromInsurance = (financeLedger?.settlements || []).reduce(
      (sum, s) => sum + (Number(s.paidAmount ?? s.amountPaid) || 0),
      0
    );

    return {
      totalGrossRevenue,
      actualCashInSafe,
      totalExpenses,
      netCashAfterExpenses,
      insuranceReceivables,
      totalSettledFromInsurance,
      cashBookingsCount,
      insuranceBookingsCount,
      consultationCount,
      charityExemptCount,
      unpaidCount,
      totalCases: filteredBookings.length
    };
  }, [filteredBookings, filteredExpenses, financeLedger?.settlements]);

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

  // ============================================================================
  // الحساب التلقائي الذكي لشرائح ونسب ومستحقات الأطباء (حسب إعدادات مدير المالية)
  // ============================================================================
  const doctorCommissionRows = useMemo(() => {
    const savedRules = financeLedger?.doctorCommissionRules || {};
    const doctorsToEvaluate =
      selectedClinicId === 'all'
        ? doctors
        : doctors.filter(d => d.clinicId === selectedClinicId);

    const rows = doctorsToEvaluate
      .filter(d => selectedDoctorId === 'all' || d.id === selectedDoctorId)
      .map(doc => {
        const matchedClinic = clinics.find(c => c.id === doc.clinicId);
        const existingRule: DoctorCommissionRule | undefined = savedRules[doc.id];

        const consultationFee = Math.max(
          0,
          Number(existingRule?.consultationFee ?? matchedClinic?.fee ?? 75)
        );
        const targetCasesCount = Math.max(1, Number(existingRule?.targetCasesCount ?? 10));
        const targetPercentage = Math.min(100, Math.max(0, Number(existingRule?.targetPercentage ?? 50)));
        const belowCasesCount = Math.max(
          0,
          Number(existingRule?.belowCasesCount ?? Math.max(1, targetCasesCount - 1))
        );
        const belowPercentage = Math.min(100, Math.max(0, Number(existingRule?.belowPercentage ?? 40)));
        const aboveCasesCount = Math.max(
          targetCasesCount + 1,
          Number(existingRule?.aboveCasesCount ?? targetCasesCount + 5)
        );
        const abovePercentage = Math.min(100, Math.max(0, Number(existingRule?.abovePercentage ?? 60)));

        // حساب الحالات الفعلية للطبيب في الفترة الزمنية المختارة
        const docBookings = filteredBookings.filter(b => b.doctorId === doc.id);
        let paidExamCases = 0;
        let cashCases = 0;
        let insuranceCases = 0;
        let consultationCases = 0;
        let exemptCases = 0;

        for (const b of docBookings) {
          if (b.paymentMethod === 'consultation') {
            consultationCases += 1;
          } else if (b.paymentStatus === 'exempt' || b.paymentMethod === 'charity_exempt') {
            exemptCases += 1;
          } else if (b.paymentStatus === 'paid') {
            paidExamCases += 1;
            if (b.paymentMethod === 'insurance') {
              insuranceCases += 1;
            } else {
              cashCases += 1;
            }
          }
        }

        // تحديد الشريحة المطبقة والنسبة المئوية تلقائياً بناءً على عدد حالات الكشف الفعلية
        let appliedTierKey: 'none' | 'below' | 'target' | 'above' = 'none';
        let appliedTierLabel = 'لا توجد حالات مسددة';
        let appliedPercentage = 0;

        if (paidExamCases === 0) {
          appliedTierKey = 'none';
          appliedTierLabel = `لا توجد كشوفات (شريحة الناقص ${belowPercentage}%)`;
          appliedPercentage = belowPercentage;
        } else if (paidExamCases >= aboveCasesCount) {
          appliedTierKey = 'above';
          appliedTierLabel = `شريحة الزيادة (${aboveCasesCount} حالة فأكثر)`;
          appliedPercentage = abovePercentage;
        } else if (paidExamCases < targetCasesCount || paidExamCases <= belowCasesCount) {
          appliedTierKey = 'below';
          appliedTierLabel = `شريحة الناقص (${belowCasesCount} حالات فأقل)`;
          appliedPercentage = belowPercentage;
        } else {
          appliedTierKey = 'target';
          appliedTierLabel = `شريحة المطلوب (${targetCasesCount} إلى ${aboveCasesCount - 1} حالة)`;
          appliedPercentage = targetPercentage;
        }

        // يسري الحساب على سعر كشف الدكتور المعتمد × عدد حالات الكشف الفعلية
        const totalExamValueByDoctorFee = paidExamCases * consultationFee;
        const doctorCommissionAmount = Math.round(
          (totalExamValueByDoctorFee * appliedPercentage) / 100
        );
        const clinicNetShareAmount = Math.max(
          0,
          totalExamValueByDoctorFee - doctorCommissionAmount
        );

        return {
          doctor: doc,
          doctorId: doc.id,
          doctorName: doc.name,
          clinicId: doc.clinicId,
          clinicName: matchedClinic?.name || doc.clinicName || 'عيادة عامة',
          isCustomConfigured: Boolean(existingRule),
          consultationFee,
          targetCasesCount,
          targetPercentage,
          belowCasesCount,
          belowPercentage,
          aboveCasesCount,
          abovePercentage,
          notes: existingRule?.notes || '',
          updatedAt: existingRule?.updatedAt,
          updatedBy: existingRule?.updatedBy,
          totalBookingsCount: docBookings.length,
          paidExamCases,
          cashCases,
          insuranceCases,
          consultationCases,
          exemptCases,
          appliedTierKey,
          appliedTierLabel,
          appliedPercentage,
          totalExamValueByDoctorFee,
          doctorCommissionAmount,
          clinicNetShareAmount
        };
      });

    return rows.sort((a, b) => b.totalExamValueByDoctorFee - a.totalExamValueByDoctorFee);
  }, [doctors, clinics, financeLedger?.doctorCommissionRules, filteredBookings, selectedClinicId, selectedDoctorId]);

  const doctorCommissionTotals = useMemo(() => {
    return doctorCommissionRows.reduce(
      (acc, r) => {
        acc.totalPaidCases += r.paidExamCases;
        acc.totalConsultationCases += r.consultationCases;
        acc.totalExamValue += r.totalExamValueByDoctorFee;
        acc.totalDoctorShare += r.doctorCommissionAmount;
        acc.totalClinicShare += r.clinicNetShareAmount;
        return acc;
      },
      {
        totalPaidCases: 0,
        totalConsultationCases: 0,
        totalExamValue: 0,
        totalDoctorShare: 0,
        totalClinicShare: 0
      }
    );
  }, [doctorCommissionRows]);

  // فتح نافذة تحديد نسب وشرائح الطبيب
  const openDoctorCommissionModal = (row: (typeof doctorCommissionRows)[number]) => {
    setEditingRuleDoctor(row.doctor);
    setRuleConsultationFee(String(row.consultationFee));
    setRuleTargetCases(String(row.targetCasesCount));
    setRuleTargetPct(String(row.targetPercentage));
    setRuleBelowCases(String(row.belowCasesCount));
    setRuleBelowPct(String(row.belowPercentage));
    setRuleAboveCases(String(row.aboveCasesCount));
    setRuleAbovePct(String(row.abovePercentage));
    setRuleNotes(row.notes || '');
    setIsCommissionModalOpen(true);
  };

  const handleSaveDoctorCommissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRuleDoctor) return;
    setIsSavingCommissionRule(true);
    try {
      const matchedClinic = clinics.find(c => c.id === editingRuleDoctor.clinicId);
      const ok = await saveDoctorCommissionRule({
        doctorId: editingRuleDoctor.id,
        doctorName: editingRuleDoctor.name,
        clinicId: editingRuleDoctor.clinicId,
        clinicName: matchedClinic?.name || editingRuleDoctor.clinicName,
        consultationFee: Number(ruleConsultationFee) || 0,
        targetCasesCount: Number(ruleTargetCases) || 10,
        targetPercentage: Number(ruleTargetPct) || 50,
        belowCasesCount: Number(ruleBelowCases) || 9,
        belowPercentage: Number(ruleBelowPct) || 40,
        aboveCasesCount: Number(ruleAboveCases) || 15,
        abovePercentage: Number(ruleAbovePct) || 60,
        notes: ruleNotes
      });
      if (ok) {
        setIsCommissionModalOpen(false);
        setEditingRuleDoctor(null);
      }
    } finally {
      setIsSavingCommissionRule(false);
    }
  };

  // تجميع مطالبات شركات التأمين شاملة التسديدات والمديونية المتبقية
  const insuranceClaimsSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        companyId?: string;
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
            companyId: b.insuranceDetails?.companyId,
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

    const settlementsList = financeLedger?.settlements || [];

    return Array.from(map.values()).map(item => {
      const settledAmount = settlementsList
        .filter(
          s =>
            (item.companyId && s.companyId === item.companyId) ||
            s.companyName.trim() === item.companyName.trim()
        )
        .reduce((acc, s) => acc + (Number(s.paidAmount ?? s.amountPaid) || 0), 0);

      return {
        ...item,
        cardsList: Array.from(item.cardsUsed).join(' · ') || 'غير محدد',
        settledAmount,
        remainingBalance: Math.max(0, item.totalCompanyReceivable - settledAmount)
      };
    });
  }, [filteredBookings, financeLedger?.settlements]);

  // فلترة سجل تسليم الشفتات
  const filteredHandovers = useMemo(() => {
    return shiftHandovers.filter(h => {
      if (handoverFilter === 'cashier') return h.department === 'cashier';
      if (handoverFilter === 'reception') return h.department === 'reception';
      if (handoverFilter === 'discrepancy') return h.status === 'discrepancy_reported';
      return true;
    });
  }, [shiftHandovers, handoverFilter]);

  const periodSubtitleLabel = useMemo(() => {
    if (dateFilterMode === 'today') return `تقرير يوم: ${todayStr}`;
    if (dateFilterMode === 'custom_range') return `الفترة من ${startDate} إلى ${endDate}`;
    return 'سجل شامل لكافة الفترات الزمنية';
  }, [dateFilterMode, todayStr, startDate, endDate]);

  const filePeriodSuffix = useMemo(() => {
    if (dateFilterMode === 'today') return todayStr;
    if (dateFilterMode === 'custom_range') return `${startDate}_to_${endDate}`;
    return 'all_dates';
  }, [dateFilterMode, todayStr, startDate, endDate]);

  // ============================================================================
  // دوال تجهيز البيانات المنسقة والملونة للإكسل (المحدد محدد والشامل شامل)
  // ============================================================================

  // 1. بناء صفوف شيت ملخص العيادات والخزينة (مدمج وأنيق بدون تكرار أرقام الحالات)
  const buildClinicSummarySheetRows = () => {
    const rows: Record<string, any>[] = clinicDoctorBreakdown.map((r, idx) => {
      const breakdownParts: string[] = [];
      if (r.cashCount > 0) breakdownParts.push(`${r.cashCount} نقدي`);
      if (r.insuranceCount > 0) breakdownParts.push(`${r.insuranceCount} تأمين`);
      if (r.consultationCount > 0) breakdownParts.push(`${r.consultationCount} استشارة`);
      if (r.exemptCount > 0) breakdownParts.push(`${r.exemptCount} إعفاء`);

      return {
        'م': idx + 1,
        'العيادة التخصصية': r.clinicName,
        'الطبيب المعالج': r.doctorName,
        'إجمالي الحالات': r.totalPatients,
        'تفصيل الحالات': breakdownParts.join(' · ') || '—',
        'المحصل نقداً بالخزينة (ج.م)': r.cashInSafe,
        'مطالبة شركة التأمين (ج.م)': r.insuranceClaim,
        'إجمالي إيراد العيادة (ج.م)': r.grossRevenue
      };
    });

    // صف إجمالي العيادات (واحد فقط واضح بدون تكرار)
    rows.push({
      'م': 'الإجمالي',
      'العيادة التخصصية': 'إجمالي إيرادات العيادات التخصصية',
      'الطبيب المعالج': `${clinicDoctorBreakdown.length} عيادة / طبيب`,
      'إجمالي الحالات': financialMetrics.totalCases,
      'تفصيل الحالات': `${financialMetrics.cashBookingsCount} نقدي · ${financialMetrics.insuranceBookingsCount} تأمين · ${financialMetrics.consultationCount} استشارة`,
      'المحصل نقداً بالخزينة (ج.م)': financialMetrics.actualCashInSafe,
      'مطالبة شركة التأمين (ج.م)': financialMetrics.insuranceReceivables,
      'إجمالي إيراد العيادة (ج.م)': financialMetrics.totalGrossRevenue
    });

    // صف خصم المصروفات النثرية (بدون تكرار عدد الحالات حتى لا يختلط الجدول)
    rows.push({
      'م': '—',
      'العيادة التخصصية': 'يُخصم: إجمالي المصروفات النثرية والمنصرف من الخزينة (-)',
      'الطبيب المعالج': `${filteredExpenses.length} حركة صرف`,
      'إجمالي الحالات': '—',
      'تفصيل الحالات': 'تُخصم مباشرة من النقدية بالخزينة',
      'المحصل نقداً بالخزينة (ج.م)': -financialMetrics.totalExpenses,
      'مطالبة شركة التأمين (ج.م)': '—',
      'إجمالي إيراد العيادة (ج.م)': -financialMetrics.totalExpenses
    });

    // صف صافي النقدية الفعلي المتبقي بالخزينة (مميز باللون الأخضر والذهبي)
    rows.push({
      'م': '★',
      'العيادة التخصصية': 'صافي النقدية الفعلي المتبقي بالخزينة (الرصيد الفعلي)',
      'الطبيب المعالج': 'بعد خصم المصروفات النثرية',
      'إجمالي الحالات': '—',
      'تفصيل الحالات': `مستحقات الأطباء المحسوبة: ${doctorCommissionTotals.totalDoctorShare.toLocaleString()} ج.م`,
      'المحصل نقداً بالخزينة (ج.م)': financialMetrics.netCashAfterExpenses,
      'مطالبة شركة التأمين (ج.م)': financialMetrics.insuranceReceivables,
      'إجمالي إيراد العيادة (ج.م)': financialMetrics.totalGrossRevenue - financialMetrics.totalExpenses
    });

    return rows;
  };

  // 2. بناء صفوف شيت مستحقات ونسب الأطباء
  const buildDoctorCommissionsSheetRows = () => {
    const rows: Record<string, any>[] = doctorCommissionRows.map((r, idx) => ({
      'م': idx + 1,
      'اسم الطبيب': r.doctorName,
      'العيادة التخصصية': r.clinicName,
      'سعر كشف الدكتور (ج.م)': r.consultationFee,
      'شروط الشرائح (ناقص / مطلوب / زيادة)': `ناقص (≤${r.belowCasesCount}): ${r.belowPercentage}% | مطلوب (${r.targetCasesCount}): ${r.targetPercentage}% | زيادة (≥${r.aboveCasesCount}): ${r.abovePercentage}%`,
      'عدد الكشوفات المسددة': r.paidExamCases,
      'استشارات مجانية': r.consultationCases,
      'إجمالي قيمة الكشوفات (ج.م)': r.totalExamValueByDoctorFee,
      'الشريحة المطبقة تلقائياً': r.appliedTierLabel,
      'النسبة المستحقة (%)': `${r.appliedPercentage}%`,
      'مستحقات الطبيب الصافية (ج.م)': r.doctorCommissionAmount,
      'صافي نصيب العيادة / المركز (ج.م)': r.clinicNetShareAmount
    }));

    if (rows.length > 0) {
      rows.push({
        'م': 'الإجمالي',
        'اسم الطبيب': 'إجمالي مستحقات الأطباء ونصيب المركز',
        'العيادة التخصصية': `${doctorCommissionRows.length} طبيب`,
        'سعر كشف الدكتور (ج.م)': '—',
        'شروط الشرائح (ناقص / مطلوب / زيادة)': 'حساب تلقائي حسب شريحة كل طبيب',
        'عدد الكشوفات المسددة': doctorCommissionTotals.totalPaidCases,
        'استشارات مجانية': doctorCommissionTotals.totalConsultationCases,
        'إجمالي قيمة الكشوفات (ج.م)': doctorCommissionTotals.totalExamValue,
        'الشريحة المطبقة تلقائياً': '—',
        'النسبة المستحقة (%)': '—',
        'مستحقات الطبيب الصافية (ج.م)': doctorCommissionTotals.totalDoctorShare,
        'صافي نصيب العيادة / المركز (ج.م)': doctorCommissionTotals.totalClinicShare
      });
    }

    return rows;
  };

  // 3. بناء صفوف السجل التفصيلي للكشوفات
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
      'اسم المريض بالكامل': b.patientName,
      'رقم الهاتف': b.patientPhone,
      'العيادة التخصصية': b.clinicName,
      'الطبيب المعالج': b.doctorName,
      'طريقة السداد': paymentLabel,
      'شركة التأمين': b.insuranceDetails?.companyName || '—',
      'فئة ورقم الكارت': b.insuranceDetails
        ? `${b.insuranceDetails.cardCategory || ''} - ${b.insuranceDetails.cardNumber || ''}`
        : '—',
      'نسبة التحمل بالكارت': b.insuranceDetails?.copayInputRaw
        ? `${b.insuranceDetails.copayInputRaw} (${b.insuranceDetails.copayPercentage}%)`
        : '—',
      'قيمة الكشف الأصلية (ج.م)': origFee,
      'المحصل بالخزينة (ج.م)': cashPaid,
      'تحمل شركة التأمين (ج.م)': insCovered
    };
  };

  const buildDetailedBookingsSheetRows = () => {
    const rows: Record<string, any>[] = filteredBookings.map((b, i) => formatBookingRow(b, i));
    if (rows.length > 0) {
      rows.push({
        'م': 'الإجمالي',
        'التاريخ': '—',
        'رقم التذكرة': `${filteredBookings.length} تذكرة`,
        'اسم المريض بالكامل': 'إجمالي السجل التفصيلي للكشوفات',
        'رقم الهاتف': '—',
        'العيادة التخصصية': '—',
        'الطبيب المعالج': '—',
        'طريقة السداد': '—',
        'شركة التأمين': '—',
        'فئة ورقم الكارت': '—',
        'نسبة التحمل بالكارت': '—',
        'قيمة الكشف الأصلية (ج.م)': financialMetrics.totalGrossRevenue,
        'المحصل بالخزينة (ج.م)': financialMetrics.actualCashInSafe,
        'تحمل شركة التأمين (ج.م)': financialMetrics.insuranceReceivables
      });
    }
    return rows;
  };

  // 4. بناء صفوف شيت مطالبات شركات التأمين
  const buildInsuranceClaimsSheetRows = () => {
    const rows: Record<string, any>[] = insuranceClaimsSummary.map((item, idx) => ({
      'م': idx + 1,
      'اسم شركة التأمين': item.companyName,
      'فئات الكروت المستخدمة': item.cardsList,
      'عدد الكشوفات': item.casesCount,
      'إجمالي قيمة الكشوفات (ج.م)': item.totalOriginalFees,
      'تحمل المرضى نقداً (ج.م)': item.totalPatientCopay,
      'إجمالي المطالبة على الشركة (ج.م)': item.totalCompanyReceivable,
      'المسدد من الشركة (ج.م)': item.settledAmount,
      'المديونية المتبقية على الشركة (ج.م)': item.remainingBalance
    }));
    if (rows.length > 0) {
      rows.push({
        'م': 'الإجمالي',
        'اسم شركة التأمين': 'إجمالي مطالبات وتسديدات شركات التأمين',
        'فئات الكروت المستخدمة': `${insuranceClaimsSummary.length} شركة`,
        'عدد الكشوفات': financialMetrics.insuranceBookingsCount,
        'إجمالي قيمة الكشوفات (ج.م)': insuranceClaimsSummary.reduce((s, x) => s + x.totalOriginalFees, 0),
        'تحمل المرضى نقداً (ج.م)': insuranceClaimsSummary.reduce((s, x) => s + x.totalPatientCopay, 0),
        'إجمالي المطالبة على الشركة (ج.م)': financialMetrics.insuranceReceivables,
        'المسدد من الشركة (ج.م)': financialMetrics.totalSettledFromInsurance,
        'المديونية المتبقية على الشركة (ج.م)': Math.max(
          0,
          financialMetrics.insuranceReceivables - financialMetrics.totalSettledFromInsurance
        )
      });
    }
    return rows;
  };

  // 5. بناء صفوف شيت المصروفات النثرية
  const buildExpensesSheetRows = () => {
    const rows: Record<string, any>[] = filteredExpenses.map((exp, idx) => ({
      'م': idx + 1,
      'التاريخ': exp.date,
      'بيان المصروف / سبب السحب': exp.title,
      'تصنيف المصروف': EXPENSE_CATEGORY_LABELS[exp.category] || exp.category,
      'المبلغ المنصرف (ج.م)': exp.amount,
      'المستلم / الجهة': exp.recipientName || exp.recipient || '—',
      'مسجل العملية': exp.createdBy || exp.recordedBy,
      'ملاحظات إضافية': exp.notes || '—'
    }));
    if (rows.length > 0) {
      rows.push({
        'م': 'الإجمالي',
        'التاريخ': '—',
        'بيان المصروف / سبب السحب': 'إجمالي المصروفات المنصرفة من الخزينة',
        'تصنيف المصروف': `${filteredExpenses.length} حركة صرف`,
        'المبلغ المنصرف (ج.م)': financialMetrics.totalExpenses,
        'المستلم / الجهة': '—',
        'مسجل العملية': '—',
        'ملاحظات إضافية': '—'
      });
    }
    return rows;
  };

  // 6. بناء صفوف شيت تسليم الشفتات
  const buildHandoversSheetRows = () => {
    return filteredHandovers.map((h, idx) => ({
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
      'المبلغ المُسلَّم (ج.م)': h.expectedAmount ?? '—',
      'المبلغ الفعلي المستلم (ج.م)':
        h.status === 'delivered_to_management'
          ? (h.expectedAmount ?? '—')
          : (h.actualReceivedAmount ?? 'قيد الاستلام'),
      'الفرق المالي (ج.م)':
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
      'اعتماد مدير المالية': h.managerApproved
        ? `معتمد (${h.managerApprovedBy || 'مدير المالية'})`
        : 'قيد المراجعة',
      'ملاحظات': h.acknowledgmentNotes || h.notes || '—'
    }));
  };

  // ============================================================================
  // أزرار التصدير المخصصة (المحدد ينزل شيت الجدول المحدد فقط — والشامل ينزل الشيت الشامل)
  // ============================================================================

  // أ) تصدير شيت ملخص العيادات والخزينة فقط
  const handleExportClinicSummaryOnlyExcel = () => {
    try {
      exportSingleStyledSheetToExcel({
        sheetName: 'ملخص العيادات والخزينة',
        fileName: `ملخص_العيادات_والخزينة_${filePeriodSuffix}.xlsx`,
        reportTitle: 'عيادات الشرايح التخصصية — ملخص إيرادات العيادات وصافي الخزينة',
        reportSubtitle: `${periodSubtitleLabel} · تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')}`,
        rows: buildClinicSummarySheetRows(),
        enableAutoFilter: enableExcelAutoFilter,
        headerBgColor: '0F766E'
      });
      addToast({
        type: 'success',
        title: 'تم تنزيل شيت ملخص العيادات والخزينة',
        message: 'تم تصدير جدول ملخص العيادات وصافي الخزينة فقط بتنسيق ملون ومسطر.'
      });
    } catch (err: any) {
      addToast({ type: 'error', title: 'تعذر التصدير', message: err?.message || 'حدث خطأ' });
    }
  };

  // ب) تصدير شيت مستحقات ونسب الأطباء فقط
  const handleExportDoctorCommissionsOnlyExcel = () => {
    try {
      exportSingleStyledSheetToExcel({
        sheetName: 'مستحقات ونسب الأطباء',
        fileName: `مستحقات_ونسب_الأطباء_${filePeriodSuffix}.xlsx`,
        reportTitle: 'عيادات الشرايح التخصصية — كشف حساب شرائح ونسب ومستحقات الأطباء',
        reportSubtitle: `${periodSubtitleLabel} · إجمالي مستحقات الأطباء: ${doctorCommissionTotals.totalDoctorShare.toLocaleString()} ج.م · نصيب المركز: ${doctorCommissionTotals.totalClinicShare.toLocaleString()} ج.م`,
        rows: buildDoctorCommissionsSheetRows(),
        enableAutoFilter: enableExcelAutoFilter,
        headerBgColor: '1E3A8A'
      });
      addToast({
        type: 'success',
        title: 'تم تنزيل شيت مستحقات ونسب الأطباء (.xlsx)',
        message: 'تم تصدير كشف حساب الأطباء وشرائح النسب وحصة العيادة بتنسيق ملون ومسطر.'
      });
    } catch (err: any) {
      addToast({ type: 'error', title: 'تعذر التصدير', message: err?.message || 'حدث خطأ' });
    }
  };

  // ج) تصدير شيت الكشوفات التفصيلية المفلترة فقط
  const handleExportDetailedBookingsOnlyExcel = () => {
    try {
      exportSingleStyledSheetToExcel({
        sheetName: 'سجل الكشوفات التفصيلي',
        fileName: `سجل_الكشوفات_المفلتر_${filePeriodSuffix}.xlsx`,
        reportTitle: 'عيادات الشرايح التخصصية — السجل التفصيلي للكشوفات المفلترة',
        reportSubtitle: `${periodSubtitleLabel} · إجمالي الحالات: ${filteredBookings.length}`,
        rows: buildDetailedBookingsSheetRows(),
        enableAutoFilter: enableExcelAutoFilter,
        headerBgColor: '047857'
      });
      addToast({
        type: 'success',
        title: 'تم تنزيل شيت الكشوفات المفلترة فقط',
        message: 'تم تصدير جدول الكشوفات المفلترة حالياً بتنسيق ملون ومسطر.'
      });
    } catch (err: any) {
      addToast({ type: 'error', title: 'تعذر التصدير', message: err?.message || 'حدث خطأ' });
    }
  };

  // د) تصدير شيت المصروفات النثرية فقط
  const handleExportExpensesOnlyExcel = () => {
    try {
      exportSingleStyledSheetToExcel({
        sheetName: 'المصروفات النثرية',
        fileName: `سجل_المصروفات_النثرية_${filePeriodSuffix}.xlsx`,
        reportTitle: 'عيادات الشرايح التخصصية — سجل المصروفات النثرية والمنصرف من الخزينة',
        reportSubtitle: `${periodSubtitleLabel} · إجمالي المنصرف: ${financialMetrics.totalExpenses.toLocaleString()} ج.م`,
        rows: buildExpensesSheetRows(),
        enableAutoFilter: enableExcelAutoFilter,
        headerBgColor: 'B45309'
      });
      addToast({
        type: 'success',
        title: 'تم تنزيل شيت المصروفات النثرية فقط',
        message: 'تم تصدير جدول المصروفات النثرية المحدد بتنسيق ملون ومسطر.'
      });
    } catch (err: any) {
      addToast({ type: 'error', title: 'تعذر التصدير', message: err?.message || 'حدث خطأ' });
    }
  };

  // هـ) تصدير شيت مطالبات شركات التأمين فقط
  const handleExportInsuranceOnlyExcel = () => {
    try {
      exportSingleStyledSheetToExcel({
        sheetName: 'مطالبات شركات التأمين',
        fileName: `مطالبات_شركات_التأمين_${filePeriodSuffix}.xlsx`,
        reportTitle: 'عيادات الشرايح التخصصية — كشف حساب ومطالبات شركات التأمين المتعاقدة',
        reportSubtitle: `${periodSubtitleLabel} · إجمالي المطالبات: ${financialMetrics.insuranceReceivables.toLocaleString()} ج.م`,
        rows: buildInsuranceClaimsSheetRows(),
        enableAutoFilter: enableExcelAutoFilter,
        headerBgColor: '1D4ED8'
      });
      addToast({
        type: 'success',
        title: 'تم تنزيل شيت مطالبات شركات التأمين فقط',
        message: 'تم تصدير جدول مطالبات وتسديدات شركات التأمين بتنسيق ملون ومسطر.'
      });
    } catch (err: any) {
      addToast({ type: 'error', title: 'تعذر التصدير', message: err?.message || 'حدث خطأ' });
    }
  };

  // و) تصدير شيت تسليم الشفتات فقط
  const handleExportHandoversOnlyExcel = () => {
    try {
      exportSingleStyledSheetToExcel({
        sheetName: 'سجل تسليم الشفتات',
        fileName: `سجل_تسليم_الشفتات_${filePeriodSuffix}.xlsx`,
        reportTitle: 'عيادات الشرايح التخصصية — سجل تسليم واستلام الشفتات واعتماد الإدارة المالية',
        reportSubtitle: `إجمالي السجلات المعروضة: ${filteredHandovers.length}`,
        rows: buildHandoversSheetRows(),
        enableAutoFilter: enableExcelAutoFilter,
        headerBgColor: '4338CA'
      });
      addToast({
        type: 'success',
        title: 'تم تنزيل شيت تسليم الشفتات فقط',
        message: 'تم تصدير جدول تسليم واستلام الشفتات بتنسيق ملون ومسطر.'
      });
    } catch (err: any) {
      addToast({ type: 'error', title: 'تعذر التصدير', message: err?.message || 'حدث خطأ' });
    }
  };

  // ز) تصدير الشيت المالي الشامل (يجمع كل الأوراق الملونة والمسطرة في مصنف واحد متكامل)
  const handleExportComprehensiveExcel = () => {
    try {
      const wb = configureRtlWorkbook();

      // 1. ورقة ملخص العيادات والخزينة
      const wsSummary = buildFormattedRtlWorksheet(buildClinicSummarySheetRows(), {
        reportTitle: 'عيادات الشرايح التخصصية — ملخص إيرادات العيادات والأطباء وصافي الخزينة',
        reportSubtitle: `${periodSubtitleLabel} · تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')}`,
        enableAutoFilter: enableExcelAutoFilter,
        headerBgColor: '0F766E'
      });
      XLSXStyle.utils.book_append_sheet(wb as any, wsSummary as any, 'ملخص العيادات والخزينة');

      // 2. ورقة مستحقات ونسب الأطباء
      const wsCommissions = buildFormattedRtlWorksheet(buildDoctorCommissionsSheetRows(), {
        reportTitle: 'عيادات الشرايح التخصصية — كشف حساب شرائح ونسب ومستحقات الأطباء',
        reportSubtitle: `${periodSubtitleLabel} · مستحقات الأطباء: ${doctorCommissionTotals.totalDoctorShare.toLocaleString()} ج.م · نصيب المركز: ${doctorCommissionTotals.totalClinicShare.toLocaleString()} ج.م`,
        enableAutoFilter: enableExcelAutoFilter,
        headerBgColor: '1E3A8A'
      });
      XLSXStyle.utils.book_append_sheet(wb as any, wsCommissions as any, 'مستحقات ونسب الأطباء');

      // 3. ورقة السجل التفصيلي للكشوفات
      const wsAllDetailed = buildFormattedRtlWorksheet(buildDetailedBookingsSheetRows(), {
        reportTitle: 'السجل التفصيلي الكامل للكشوفات وتفاصيل كروت التأمين الطبي',
        reportSubtitle: periodSubtitleLabel,
        enableAutoFilter: enableExcelAutoFilter,
        headerBgColor: '047857'
      });
      XLSXStyle.utils.book_append_sheet(wb as any, wsAllDetailed as any, 'سجل الكشوفات التفصيلي');

      // 4. ورقة مطالبات شركات التأمين
      const wsInsurance = buildFormattedRtlWorksheet(buildInsuranceClaimsSheetRows(), {
        reportTitle: 'كشف حساب ومطالبات شركات التأمين الطبي المتعاقدة',
        reportSubtitle: periodSubtitleLabel,
        enableAutoFilter: enableExcelAutoFilter,
        headerBgColor: '1D4ED8'
      });
      XLSXStyle.utils.book_append_sheet(wb as any, wsInsurance as any, 'مطالبات شركات التأمين');

      // 5. ورقة المصروفات النثرية
      const wsExpenses = buildFormattedRtlWorksheet(buildExpensesSheetRows(), {
        reportTitle: 'سجل المصروفات النثرية والمنصرف النقدي من الخزينة',
        reportSubtitle: periodSubtitleLabel,
        enableAutoFilter: enableExcelAutoFilter,
        headerBgColor: 'B45309'
      });
      XLSXStyle.utils.book_append_sheet(wb as any, wsExpenses as any, 'المصروفات النثرية');

      // 6. ورقة تسليم الشفتات
      const wsHandovers = buildFormattedRtlWorksheet(buildHandoversSheetRows(), {
        reportTitle: 'سجل تسليم واستلام الشفتات وعهدة الخزينة واعتماد الإدارة المالية',
        reportSubtitle: `إجمالي العمليات المسجلة: ${shiftHandovers.length}`,
        enableAutoFilter: enableExcelAutoFilter,
        headerBgColor: '4338CA'
      });
      XLSXStyle.utils.book_append_sheet(wb as any, wsHandovers as any, 'سجل تسليم الشفتات');

      // 7. أوراق مستقلة لكل عيادة بها حجوزات في الفترة
      const clinicsWithBookings = clinics.filter(c =>
        filteredBookings.some(b => b.clinicId === c.id)
      );
      for (const clinic of clinicsWithBookings) {
        const clinicBookings = filteredBookings.filter(b => b.clinicId === clinic.id);
        const clinicRows = clinicBookings.map((b, i) => formatBookingRow(b, i));
        const clinicCashTotal = clinicRows.reduce(
          (acc, r) => acc + (Number(r['المحصل بالخزينة (ج.م)']) || 0),
          0
        );
        const clinicInsTotal = clinicRows.reduce(
          (acc, r) => acc + (Number(r['تحمل شركة التأمين (ج.م)']) || 0),
          0
        );
        const clinicOrigTotal = clinicRows.reduce(
          (acc, r) => acc + (Number(r['قيمة الكشف الأصلية (ج.م)']) || 0),
          0
        );

        clinicRows.push({
          'م': 'الإجمالي' as any,
          'التاريخ': '—',
          'رقم التذكرة': `${clinicBookings.length} حالة`,
          'اسم المريض بالكامل': `إجمالي ${clinic.name}`,
          'رقم الهاتف': '—',
          'العيادة التخصصية': clinic.name,
          'الطبيب المعالج': '—',
          'طريقة السداد': '—',
          'شركة التأمين': '—',
          'فئة ورقم الكارت': '—',
          'نسبة التحمل بالكارت': '—',
          'قيمة الكشف الأصلية (ج.م)': clinicOrigTotal,
          'المحصل بالخزينة (ج.م)': clinicCashTotal,
          'تحمل شركة التأمين (ج.م)': clinicInsTotal
        });

        const wsClinic = buildFormattedRtlWorksheet(clinicRows, {
          reportTitle: `كشف حساب وحجوزات: ${clinic.name}`,
          reportSubtitle: `${periodSubtitleLabel} · إجمالي الحالات: ${clinicBookings.length}`,
          enableAutoFilter: enableExcelAutoFilter,
          headerBgColor: '0F766E'
        });
        const safeSheetName = clinic.name.replace(/[\\/?*[\]:]/g, '').slice(0, 28) || clinic.id;
        try {
          XLSXStyle.utils.book_append_sheet(wb as any, wsClinic as any, safeSheetName);
        } catch {
          // ignore duplicate sheet name
        }
      }

      writeStyledWorkbookFile(wb, `الشيت_المالي_الشامل_عيادات_الشرايح_${filePeriodSuffix}.xlsx`);

      addToast({
        type: 'success',
        title: 'تم تصدير الشيت المالي الشامل الملون والمسطر بنجاح',
        message: 'يحتوي الشيت على كافة الأوراق المالية + نسب الأطباء بتنسيق احترافي ملون ومسطر بالكامل.'
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'تعذر تصدير الإكسل',
        message: err?.message || 'حدث خطأ أثناء إنشاء ملف الإكسل.'
      });
    }
  };

  // طباعة التقرير المالي اليومي الرسمي المختوم (A4 / PDF)
  const handlePrintOfficialFinancialReport = () => {
    window.print();
  };

  // حفظ مصروف نثري جديد
  const handleSaveExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingExpense(true);
    try {
      const ok = await addFinanceExpense({
        title: expenseTitle,
        category: expenseCategory,
        amount: Number(expenseAmount),
        recipientName: expenseRecipient,
        date: expenseDate || todayStr,
        notes: expenseNotes
      });
      if (ok) {
        setIsExpenseModalOpen(false);
        setExpenseTitle('');
        setExpenseAmount('');
        setExpenseRecipient('');
        setExpenseNotes('');
      }
    } finally {
      setIsSavingExpense(false);
    }
  };

  // حفظ تسديد مطالبة تأمين
  const handleSaveSettlementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettlement(true);
    try {
      const matchedContract = insuranceContracts.find(
        c => c.id === settlementCompanyId || c.companyName === settlementCompanyName
      );
      const ok = await addInsuranceSettlement({
        companyId: matchedContract?.id || settlementCompanyId || undefined,
        companyName: matchedContract?.companyName || settlementCompanyName,
        paidAmount: Number(settlementAmount),
        amountPaid: Number(settlementAmount),
        settlementDate: settlementDate || todayStr,
        paymentDate: settlementDate || todayStr,
        paymentMethod: settlementMethod,
        paymentReference: settlementRefNumber,
        referenceNumber: settlementRefNumber,
        notes: settlementNotes
      });
      if (ok) {
        setIsSettlementModalOpen(false);
        setSettlementAmount('');
        setSettlementRefNumber('');
        setSettlementNotes('');
      }
    } finally {
      setIsSavingSettlement(false);
    }
  };

  // اعتماد تسليم الشفت بواسطة مدير المالية
  const handleApproveHandover = async (handoverId: string) => {
    setApprovingHandoverId(handoverId);
    try {
      await approveShiftHandoverByManager(handoverId, 'تمت المراجعة والاعتماد من الإدارة المالية');
    } finally {
      setApprovingHandoverId(null);
    }
  };

  // إدارة فئات الكروت في نافذة التعاقد
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

  const openNewContractModal = () => {
    setEditingContractId(null);
    setCompanyNameInput('');
    setSelectedCategories(['فضي (Silver)', 'جولد (Gold)', 'بلاتينيوم (Platinum)']);
    setCustomCategoryInput('');
    setContractNotesInput('');
    setContractActiveInput(true);
    setIsContractModalOpen(true);
  };

  const startEditContract = (contract: InsuranceCompanyContract) => {
    setEditingContractId(contract.id);
    setCompanyNameInput(contract.companyName);
    setSelectedCategories(contract.cardCategories);
    setCustomCategoryInput('');
    setContractNotesInput(contract.notes || '');
    setContractActiveInput(contract.isActive);
    setIsContractModalOpen(true);
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
        setIsContractModalOpen(false);
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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5" dir="rtl">
      {/* ================================================================= */}
      {/* نسخة الطباعة الرسمية للتقرير المالي اليومي المختوم (تظهر عند الطباعة فقط A4) */}
      {/* ================================================================= */}
      <div className="hidden print:block bg-white text-slate-900 p-6 space-y-5 border border-slate-300 rounded-xl">
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-black">عيادات الشرايح التخصصية — الإدارة المالية</h1>
            <p className="text-sm font-bold text-slate-600 mt-0.5">
              تقرير التقفيل المالي وإيرادات العيادات وصافي الخزينة ({periodSubtitleLabel})
            </p>
          </div>
          <div className="text-left text-xs font-mono">
            <div>تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</div>
            <div>الوقت: {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
            <div>المسؤول: {currentUser?.displayName}</div>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3 text-center border border-slate-300 rounded-xl p-3 bg-slate-50">
          <div>
            <div className="text-[11px] font-bold text-slate-600">إجمالي إيراد العيادات</div>
            <div className="text-base font-black font-mono">{financialMetrics.totalGrossRevenue.toLocaleString()} ج.م</div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-600">المحصل نقداً بالخزينة</div>
            <div className="text-base font-black font-mono text-emerald-700">{financialMetrics.actualCashInSafe.toLocaleString()} ج.م</div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-600">المصروفات النثرية (-)</div>
            <div className="text-base font-black font-mono text-rose-700">{financialMetrics.totalExpenses.toLocaleString()} ج.م</div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-900">صافي النقدية الفعلي بالخزينة</div>
            <div className="text-base font-black font-mono text-emerald-900">{financialMetrics.netCashAfterExpenses.toLocaleString()} ج.م</div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-600">مطالبات شركات التأمين</div>
            <div className="text-base font-black font-mono text-blue-700">{financialMetrics.insuranceReceivables.toLocaleString()} ج.م</div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-black mb-2">أولاً: ملخص إيرادات العيادات والأطباء</h2>
          <table className="w-full text-right text-xs border-collapse border border-slate-400">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 p-1.5">العيادة</th>
                <th className="border border-slate-400 p-1.5">الطبيب</th>
                <th className="border border-slate-400 p-1.5 text-center">الحالات</th>
                <th className="border border-slate-400 p-1.5 text-center">نقدي</th>
                <th className="border border-slate-400 p-1.5 text-center">تأمين</th>
                <th className="border border-slate-400 p-1.5">المحصل بالخزينة</th>
                <th className="border border-slate-400 p-1.5">مطالبة التأمين</th>
                <th className="border border-slate-400 p-1.5">إجمالي الإيراد</th>
              </tr>
            </thead>
            <tbody>
              {clinicDoctorBreakdown.map(r => (
                <tr key={`${r.clinicId}_${r.doctorId}`}>
                  <td className="border border-slate-400 p-1.5 font-bold">{r.clinicName}</td>
                  <td className="border border-slate-400 p-1.5">{r.doctorName}</td>
                  <td className="border border-slate-400 p-1.5 text-center font-mono">{r.totalPatients}</td>
                  <td className="border border-slate-400 p-1.5 text-center font-mono">{r.cashCount}</td>
                  <td className="border border-slate-400 p-1.5 text-center font-mono">{r.insuranceCount}</td>
                  <td className="border border-slate-400 p-1.5 font-mono font-bold">{r.cashInSafe.toLocaleString()} ج.م</td>
                  <td className="border border-slate-400 p-1.5 font-mono">{r.insuranceClaim.toLocaleString()} ج.م</td>
                  <td className="border border-slate-400 p-1.5 font-mono font-black">{r.grossRevenue.toLocaleString()} ج.م</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredExpenses.length > 0 && (
          <div>
            <h2 className="text-sm font-black mb-2">ثانياً: بيان المصروفات النثرية والمنصرف من الخزينة</h2>
            <table className="w-full text-right text-xs border-collapse border border-slate-400">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 p-1.5">التاريخ</th>
                  <th className="border border-slate-400 p-1.5">بيان المصروف</th>
                  <th className="border border-slate-400 p-1.5">التصنيف</th>
                  <th className="border border-slate-400 p-1.5">المستلم</th>
                  <th className="border border-slate-400 p-1.5">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(exp => (
                  <tr key={exp.id}>
                    <td className="border border-slate-400 p-1.5 font-mono">{exp.date}</td>
                    <td className="border border-slate-400 p-1.5 font-bold">{exp.title}</td>
                    <td className="border border-slate-400 p-1.5">{EXPENSE_CATEGORY_LABELS[exp.category]}</td>
                    <td className="border border-slate-400 p-1.5">{exp.recipientName || '—'}</td>
                    <td className="border border-slate-400 p-1.5 font-mono font-bold">{exp.amount.toLocaleString()} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6 pt-8 text-center text-xs font-bold">
          <div className="border-t border-slate-400 pt-2">توقيع مسؤول الخزينة</div>
          <div className="border-t border-slate-400 pt-2">مراجعة واعتماد مدير المالية ({currentUser?.displayName})</div>
          <div className="border-t border-slate-400 pt-2">اعتماد إدارة عيادات الشرايح</div>
        </div>
      </div>

      {/* 1. شريط الهيدر العلوي الأنيق والمدمج (Compact Executive Header) */}
      <div className="print:hidden bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <DollarSign className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  الإدارة المالية والتعاقدات
                </h1>
                <span className="text-xs text-slate-400 dark:text-slate-500" aria-hidden="true">·</span>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {currentUser?.displayName}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                متابعة إيرادات العيادات وصافي الخزينة · المصروفات النثرية · مطالبات التأمين · اعتماد الشفتات
              </p>
            </div>
          </div>

          {/* أزرار الإجراءات السريعة في سطر مرتب */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportComprehensiveExcel}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer whitespace-nowrap"
              title="تنزيل الدفتر المحاسبي الشامل المنسق والملون بجميع الشيتات (الملخص، نسب الأطباء، الحجوزات، التأمين، المصروفات، الشفتات)"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>الإكسل الشامل الكامل (.xlsx)</span>
            </button>

            <label
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none whitespace-nowrap"
              title="عند التفعيل يظهر سهم الفلترة (▼) للفرز على الكمبيوتر، وعند الإيقاف تظهر العناوين كاملة على الموبايل بدون أي قص للحروف"
            >
              <input
                type="checkbox"
                checked={enableExcelAutoFilter}
                onChange={e => setEnableExcelAutoFilter(e.target.checked)}
                className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer"
              />
              <span>سهم فلتر الإكسل (▼)</span>
            </label>

            <button
              type="button"
              onClick={handlePrintOfficialFinancialReport}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white font-bold text-xs transition cursor-pointer whitespace-nowrap"
              title="طباعة تقرير التقفيل المالي الرسمي A4 أو حفظه PDF"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>طباعة التقرير (A4)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpenseModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70 font-bold text-xs transition cursor-pointer whitespace-nowrap"
            >
              <Receipt className="w-4 h-4 shrink-0" />
              <span>+ مصروف نثري</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPurgeModal(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 font-bold text-xs transition cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>تنظيف السجلات</span>
            </button>

            {currentUser?.role === 'admin' && (
              <button
                type="button"
                onClick={() => navigate('admin')}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer whitespace-nowrap"
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span>لوحة الأدمن</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. شبكة المؤشرات المالية السريعة (شاملة صافي الخزينة ونسب الأطباء) */}
      <div className="print:hidden grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-3.5">
        {/* صافي النقدية الفعلية بالخزينة بعد المصروفات */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 leading-snug">
              صافي النقدية بالخزينة
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {financialMetrics.netCashAfterExpenses.toLocaleString()}{' '}
              <span className="text-[11px] sm:text-xs font-sans font-bold">ج.م</span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
              محصل: {financialMetrics.actualCashInSafe.toLocaleString()} · مصروف: {financialMetrics.totalExpenses.toLocaleString()}
            </p>
          </div>
        </div>

        {/* مستحقات نسب الأطباء وتارجت الحالات */}
        <div
          onClick={() => setActiveTab('commissions')}
          className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 sm:p-4 border border-purple-200 dark:border-purple-800/70 shadow-xs flex flex-col justify-between cursor-pointer hover:border-purple-400 transition"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-[11px] sm:text-xs font-bold text-purple-700 dark:text-purple-300 leading-snug">
              إجمالي نسب الأطباء
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Stethoscope className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-xl font-black font-mono tabular-nums text-purple-700 dark:text-purple-400">
              {doctorCommissionTotals.totalDoctorShare.toLocaleString()}{' '}
              <span className="text-[11px] sm:text-xs font-sans font-bold">ج.م</span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
              صافي المركز: {doctorCommissionTotals.totalClinicShare.toLocaleString()} ج.م ({doctorCommissionTotals.totalPaidCases} حالة)
            </p>
          </div>
        </div>

        {/* المصروفات النثرية والسحب النقدي */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 leading-snug">
              المصروفات النثرية (المنصرف)
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-xl font-black font-mono tabular-nums text-amber-600 dark:text-amber-400">
              {financialMetrics.totalExpenses.toLocaleString()}{' '}
              <span className="text-[11px] sm:text-xs font-sans font-bold">ج.م</span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
              {filteredExpenses.length} حركة صرف مسجلة في الفترة
            </p>
          </div>
        </div>

        {/* مستحقات شركات التأمين الآجلة */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 leading-snug">
              مطالبات شركات التأمين
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-xl font-black font-mono tabular-nums text-blue-600 dark:text-blue-400">
              {financialMetrics.insuranceReceivables.toLocaleString()}{' '}
              <span className="text-[11px] sm:text-xs font-sans font-bold">ج.م</span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
              مسدد منها: {financialMetrics.totalSettledFromInsurance.toLocaleString()} ج.م ({financialMetrics.insuranceBookingsCount} كشف)
            </p>
          </div>
        </div>

        {/* إجمالي قيمة الكشوفات */}
        <div className="col-span-2 lg:col-span-1 bg-white dark:bg-slate-800 rounded-2xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 leading-snug">
              إجمالي إيراد الكشوفات
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
              {financialMetrics.totalGrossRevenue.toLocaleString()}{' '}
              <span className="text-[11px] sm:text-xs font-sans font-bold">ج.م</span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
              استشارة: {financialMetrics.consultationCount} · إعفاء: {financialMetrics.charityExemptCount}
            </p>
          </div>
        </div>
      </div>

      {/* 3. شريط التبويبات المدمج (5 تبويبات واضحة للموبايل والكمبيوتر) */}
      <div className="print:hidden grid grid-cols-2 sm:grid-cols-5 gap-1.5 bg-slate-200/70 dark:bg-slate-800/90 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80">
        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 sm:px-3 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${
            activeTab === 'reports'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 shrink-0" />
          <span className="truncate">التقارير والحجوزات</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('commissions')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 sm:px-3 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${
            activeTab === 'commissions'
              ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Stethoscope className="w-4 h-4 shrink-0" />
          <span className="truncate">نسب الأطباء ({doctors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('expenses')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 sm:px-3 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${
            activeTab === 'expenses'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Receipt className="w-4 h-4 shrink-0" />
          <span className="truncate">المصروفات ({filteredExpenses.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('insurance')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 sm:px-3 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${
            activeTab === 'insurance'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4 shrink-0" />
          <span className="truncate">التأمين والمطالبات ({insuranceContracts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('handovers')}
          className={`col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 py-2.5 px-2 sm:px-3 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${
            activeTab === 'handovers'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4 shrink-0" />
          <span className="truncate">الشفتات والاعتماد ({shiftHandovers.length})</span>
          {discrepancyHandoversCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="يوجد فرق مالي" />
          )}
        </button>
      </div>

      {/* ========================================== */}
      {/* التبويب الأول: التقارير المالية وشيت الإكسل */}
      {/* ========================================== */}
      {activeTab === 'reports' && (
        <div className="print:hidden space-y-4 sm:space-y-5">
          {/* شريط البحث والفلترة الذكي (مدمج على الموبايل ومفتوح على الكمبيوتر) */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-3.5">
            {/* الصف العلوي: البحث السريع + الفترة الزمنية + زر الفلاتر المتقدمة للموبايل */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* حقل البحث السريع */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="بحث باسم المريض، رقم التذكرة، الهاتف، أو شركة التأمين..."
                  className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm font-medium"
                />
              </div>

              {/* أزرار سريعة للفترة الزمنية */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setDateFilterMode('today')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    dateFilterMode === 'today'
                      ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  اليوم
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilterMode('custom_range')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    dateFilterMode === 'custom_range'
                      ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  فترة محددة
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilterMode('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    dateFilterMode === 'all'
                      ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  الكل
                </button>
              </div>

              {/* زر إظهار/إخفاء الفلاتر المتقدمة على الموبايل */}
              <div className="flex items-center gap-2 lg:hidden">
                <button
                  type="button"
                  onClick={() => setShowMobileFilters(prev => !prev)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                >
                  <Filter className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تصفية حسب العيادة / الطبيب / التأمين</span>
                  {activeFiltersCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-mono">
                      {activeFiltersCount}
                    </span>
                  )}
                  {showMobileFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>إعادة ضبط</span>
                  </button>
                )}
              </div>
            </div>

            {/* تحديد التاريخ من - إلى عند اختيار فترة محددة */}
            {dateFilterMode === 'custom_range' && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    من تاريخ
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    إلى تاريخ
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {/* الفلاتر التفصيلية (تظهر دائماً على الكمبيوتر وعند الطلب على الموبايل) */}
            <div
              className={`${
                showMobileFilters ? 'grid' : 'hidden lg:grid'
              } grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/60`}
            >
              {/* اختيار العيادة */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  العيادة
                </label>
                <select
                  value={selectedClinicId}
                  onChange={e => {
                    setSelectedClinicId(e.target.value);
                    setSelectedDoctorId('all');
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
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
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  الطبيب المعالج
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={e => setSelectedDoctorId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
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
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  نوع السداد
                </label>
                <select
                  value={selectedPaymentFilter}
                  onChange={e => setSelectedPaymentFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
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
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  شركة التأمين
                </label>
                <select
                  value={selectedInsuranceCompanyFilter}
                  onChange={e => setSelectedInsuranceCompanyFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
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
          </div>

          {/* ملخص إيرادات كل عيادة وكل دكتور (بطاقات للموبايل + جدول للكمبيوتر) */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-emerald-600 shrink-0" />
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  ملخص إيرادات العيادات والأطباء ({clinicDoctorBreakdown.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={handleExportComprehensiveExcel}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل شيت مستقل لكل عيادة (.xlsx)</span>
              </button>
            </div>

            {clinicDoctorBreakdown.length === 0 ? (
              <div className="py-10 px-4 text-center text-slate-400 text-xs sm:text-sm">
                لا توجد سجلات مطابقة للفلاتر المختارة حالياً.
              </div>
            ) : (
              <>
                {/* عرض الموبايل: بطاقات أنيقة وواضحة لكل عيادة وطبيب */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/60">
                  {clinicDoctorBreakdown.map(row => (
                    <div key={`${row.clinicId}-${row.doctorId}`} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {row.clinicName}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {row.doctorName}
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="text-[10px] text-slate-400">إجمالي الإيراد</div>
                          <div className="text-sm font-black font-mono tabular-nums text-slate-900 dark:text-white">
                            {row.grossRevenue.toLocaleString()} ج.م
                          </div>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center flex-wrap gap-1.5">
                        <span>إجمالي الحالات: <strong className="font-mono text-slate-800 dark:text-slate-200">{row.totalPatients}</strong></span>
                        <span aria-hidden="true">·</span>
                        <span>نقدي: <strong className="font-mono text-emerald-600">{row.cashCount}</strong></span>
                        <span aria-hidden="true">·</span>
                        <span>تأمين: <strong className="font-mono text-blue-600">{row.insuranceCount}</strong></span>
                        <span aria-hidden="true">·</span>
                        <span>استشارة: <strong className="font-mono text-purple-600">{row.consultationCount}</strong></span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                          <div className="text-[10px] text-emerald-800 dark:text-emerald-300">المحصل بالخزينة</div>
                          <div className="text-xs font-extrabold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                            {row.cashInSafe.toLocaleString()} ج.م
                          </div>
                        </div>
                        <div className="p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
                          <div className="text-[10px] text-blue-800 dark:text-blue-300">مطالبة التأمين</div>
                          <div className="text-xs font-extrabold font-mono tabular-nums text-blue-700 dark:text-blue-400">
                            {row.insuranceClaim.toLocaleString()} ج.م
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* عرض الكمبيوتر: جدول احترافي كامل */}
                <div className="hidden md:block overflow-x-auto">
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
                      {clinicDoctorBreakdown.map(row => (
                        <tr key={`${row.clinicId}-${row.doctorId}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30">
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{row.clinicName}</td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-200 font-semibold">{row.doctorName}</td>
                          <td className="py-3 px-4 text-center font-mono tabular-nums font-bold">{row.totalPatients}</td>
                          <td className="py-3 px-4 text-center font-mono tabular-nums text-emerald-600 font-bold">{row.cashCount}</td>
                          <td className="py-3 px-4 text-center font-mono tabular-nums text-blue-600 font-bold">{row.insuranceCount}</td>
                          <td className="py-3 px-4 text-center font-mono tabular-nums text-purple-600 font-bold">{row.consultationCount}</td>
                          <td className="py-3 px-4 font-mono tabular-nums font-extrabold text-emerald-600 dark:text-emerald-400">
                            {row.cashInSafe.toLocaleString()} ج.م
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums font-extrabold text-blue-600 dark:text-blue-400">
                            {row.insuranceClaim.toLocaleString()} ج.م
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums font-black text-slate-900 dark:text-white">
                            {row.grossRevenue.toLocaleString()} ج.م
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* السجل التفصيلي للكشوفات وتفاصيل كروت التأمين */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    السجل التفصيلي للكشوفات وتفاصيل كروت التأمين ({filteredBookings.length} حالة)
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    يعرض الحجوزات المطابقة للفلاتر الحالية فقط ({periodSubtitleLabel})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportDetailedBookingsOnlyExcel}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs transition cursor-pointer whitespace-nowrap shrink-0"
                title="تنزيل شيت إكسل مستقل يحتوي فقط على جدول الحجوزات المفلترة حالياً"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>تصدير إكسل الحجوزات المفلترة فقط (.xlsx)</span>
              </button>
            </div>

            {filteredBookings.length === 0 ? (
              <div className="py-10 px-4 text-center text-slate-400 text-xs sm:text-sm">
                لا توجد حجوزات للعرض في الفترة المحددة.
              </div>
            ) : (
              <>
                {/* عرض الموبايل: بطاقات مدمجة لكل تذكرة */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/60 max-h-[480px] overflow-y-auto">
                  {filteredBookings.map(b => {
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

                    const paymentTypeText =
                      b.paymentStatus === 'unpaid'
                        ? 'غير مسدد'
                        : b.paymentMethod === 'insurance'
                        ? 'تأمين طبي'
                        : b.paymentMethod === 'consultation'
                        ? 'استشارة مجانية'
                        : b.paymentStatus === 'exempt'
                        ? 'إعفاء خيري'
                        : 'نقدي (كاش)';

                    return (
                      <div key={b.id} className="p-3.5 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xs text-emerald-700 dark:text-emerald-400">
                                {b.ticketNumber}
                              </span>
                              <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
                              <span className="font-bold text-xs text-slate-900 dark:text-white">
                                {b.patientName}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {b.clinicName} · {b.doctorName} · <span className="font-mono">{b.date}</span>
                            </div>
                          </div>

                          <div className="text-left shrink-0">
                            <div className="text-xs font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                              {patientPaid.toLocaleString()} ج.م
                            </div>
                            <div className="text-[10px] font-bold text-slate-500">{paymentTypeText}</div>
                          </div>
                        </div>

                        {b.paymentMethod === 'insurance' && b.insuranceDetails && (
                          <div className="p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 text-[11px] flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-blue-800 dark:text-blue-300 truncate">
                                {b.insuranceDetails.companyName} · {b.insuranceDetails.cardCategory}
                              </div>
                              <div className="text-slate-500 truncate">
                                كارت: <span className="font-mono font-bold">{b.insuranceDetails.cardNumber}</span> · تحمل: {b.insuranceDetails.copayInputRaw} ({b.insuranceDetails.copayPercentage}%)
                              </div>
                            </div>
                            <div className="text-left shrink-0">
                              <div className="text-[10px] text-blue-600 dark:text-blue-400">تحمل الشركة</div>
                              <div className="font-mono font-black text-blue-700 dark:text-blue-300">
                                {companyClaim.toLocaleString()} ج.م
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* عرض الكمبيوتر: جدول كامل */}
                <div className="hidden md:block overflow-x-auto max-h-[460px]">
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
                      {filteredBookings.map(b => {
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
                            <td className="py-3 px-4 font-mono font-black text-emerald-700 dark:text-emerald-400">
                              {b.ticketNumber}
                            </td>
                            <td className="py-3 px-4 text-xs font-mono text-slate-500">{b.date}</td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 dark:text-white">{b.patientName}</div>
                              <div className="text-xs font-mono text-slate-500">{b.patientPhone}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-800 dark:text-slate-200">{b.clinicName}</div>
                              <div className="text-xs text-slate-500">{b.doctorName}</div>
                            </td>
                            <td className="py-3 px-4 text-xs font-bold">
                              {b.paymentStatus === 'unpaid' ? (
                                <span className="text-amber-700 dark:text-amber-400">غير مسدد</span>
                              ) : b.paymentMethod === 'insurance' ? (
                                <span className="text-blue-700 dark:text-blue-400">تأمين طبي</span>
                              ) : b.paymentMethod === 'consultation' ? (
                                <span className="text-purple-700 dark:text-purple-400">استشارة مجانية</span>
                              ) : b.paymentStatus === 'exempt' ? (
                                <span className="text-rose-700 dark:text-rose-400">إعفاء خيري</span>
                              ) : (
                                <span className="text-emerald-700 dark:text-emerald-400">نقدي (كاش)</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs">
                              {b.paymentMethod === 'insurance' && b.insuranceDetails ? (
                                <div className="space-y-0.5">
                                  <div className="font-bold text-blue-700 dark:text-blue-300">
                                    {b.insuranceDetails.companyName} · {b.insuranceDetails.cardCategory}
                                  </div>
                                  <div className="text-slate-500">
                                    كارت: <span className="font-mono font-bold">{b.insuranceDetails.cardNumber}</span> · تحمل:{' '}
                                    <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                                      {b.insuranceDetails.copayInputRaw} ({b.insuranceDetails.copayPercentage}%)
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums font-extrabold text-emerald-600 dark:text-emerald-400">
                              {patientPaid.toLocaleString()} ج.م
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums font-extrabold text-blue-600 dark:text-blue-400">
                              {companyClaim > 0 ? `${companyClaim.toLocaleString()} ج.م` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* التبويب الجديد: نسب الأطباء وتارجت الحالات (3 شرائح يحددها مدير المالية) */}
      {/* ========================================== */}
      {activeTab === 'commissions' && (
        <div className="print:hidden space-y-4">
          {/* شريط علوي توضيحي + زر تصدير شيت نسب الأطباء المستقل */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-purple-200 dark:border-purple-800/70 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-purple-600 shrink-0" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  نظام احتساب نسب الأطباء وتارجت الحالات المتدرج ({periodSubtitleLabel})
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                يحدد مدير المالية لكل طبيب سعر الكشف المعتمد وعدد الحالات والنسبة المئوية في الـ 3 حالات (التارجت المطلوب · الزيادة · النقصان)، ويحسب النظام المستحقات تلقائياً من الحالات المسددة.
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportDoctorCommissionsOnlyExcel}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition cursor-pointer whitespace-nowrap"
                title="تنزيل شيت إكسل مستقل وملون يحتوي فقط على حساب نسب الأطباء وتارجت الحالات"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>تصدير إكسل نسب الأطباء فقط (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* ملخص سريع لإجمالي نسب الأطباء وصافي المركز */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="text-[11px] font-bold text-slate-500">إجمالي الحالات المسددة للأطباء</div>
              <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-1">
                {doctorCommissionTotals.totalPaidCases} حالة
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="text-[11px] font-bold text-slate-500">إجمالي إيراد كشوفات الأطباء</div>
              <div className="text-lg font-black font-mono text-blue-600 dark:text-blue-400 mt-1">
                {doctorCommissionTotals.totalExamValue.toLocaleString()} ج.م
              </div>
            </div>
            <div className="bg-purple-50/70 dark:bg-purple-950/30 p-3.5 rounded-2xl border border-purple-200 dark:border-purple-800/70">
              <div className="text-[11px] font-bold text-purple-800 dark:text-purple-300">إجمالي مستحقات الأطباء</div>
              <div className="text-lg font-black font-mono text-purple-700 dark:text-purple-400 mt-1">
                {doctorCommissionTotals.totalDoctorShare.toLocaleString()} ج.م
              </div>
            </div>
            <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-800/70">
              <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">صافي حصة المركز من الكشوفات</div>
              <div className="text-lg font-black font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                {doctorCommissionTotals.totalClinicShare.toLocaleString()} ج.م
              </div>
            </div>
          </div>

          {/* نموذج تعديل شرائح الطبيب المختار (يظهر عند الضغط على زر ضبط النسب لأي طبيب) */}
          {isCommissionModalOpen && editingRuleDoctor && (
            <div className="bg-purple-50/60 dark:bg-purple-950/30 rounded-2xl p-4 sm:p-5 border-2 border-purple-400 dark:border-purple-600 shadow-md space-y-4">
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-purple-200 dark:border-purple-800">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-purple-950 dark:text-purple-100">
                    ضبط شرائح الحالات والنسب المئوية للطبيب:{' '}
                    <span className="underline">{editingRuleDoctor.name}</span>
                  </h3>
                  <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                    حدد عدد الحالات والنسبة المئوية لكل شريحة وسعر الكشف، وسيتم الحفظ فورا في قاعدة البيانات السحابية
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCommissionModalOpen(false);
                    setEditingRuleDoctor(null);
                  }}
                  className="p-1.5 rounded-xl text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveDoctorCommissionSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* سعر الكشف المعتمد للحساب */}
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-1">
                      سعر كشف الطبيب (ج.م) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={ruleConsultationFee}
                      onChange={e => setRuleConsultationFee(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm font-mono font-black text-emerald-700 dark:text-emerald-400"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">السعر الذي تسري عليه النسبة المئوية</p>
                  </div>

                  {/* الشريحة 1: التارجت المطلوب */}
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-amber-300 dark:border-amber-700/70">
                    <div className="text-xs font-extrabold text-amber-800 dark:text-amber-300 mb-2">
                      1. شريحة التارجت المطلوب (الأساسي)
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">عدد الحالات المطلوب</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={ruleTargetCases}
                          onChange={e => setRuleTargetCases(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">النسبة المئوية (%)</label>
                        <input
                          type="number"
                          required
                          min="0"
                          max="100"
                          step="any"
                          value={ruleTargetPct}
                          onChange={e => setRuleTargetPct(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-bold text-amber-700 dark:text-amber-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* الشريحة 2: حالة الزيادة (أكثر من المطلوب) */}
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-emerald-300 dark:border-emerald-700/70">
                    <div className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 mb-2">
                      2. شريحة الزيادة (تجاوز التارجت)
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">من عدد حالات (فأكثر)</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={ruleAboveCases}
                          onChange={e => setRuleAboveCases(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">نسبة الزيادة (%)</label>
                        <input
                          type="number"
                          required
                          min="0"
                          max="100"
                          step="any"
                          value={ruleAbovePct}
                          onChange={e => setRuleAbovePct(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* الشريحة 3: حالة النقصان (أقل من المطلوب) */}
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-rose-300 dark:border-rose-700/70">
                    <div className="text-xs font-extrabold text-rose-800 dark:text-rose-300 mb-2">
                      3. شريحة النقصان (أقل من التارجت)
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">عند حالات (أقل من التارجت)</label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={ruleBelowCases}
                          onChange={e => setRuleBelowCases(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">نسبة النقصان (%)</label>
                        <input
                          type="number"
                          required
                          min="0"
                          max="100"
                          step="any"
                          value={ruleBelowPct}
                          onChange={e => setRuleBelowPct(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-bold text-rose-700 dark:text-rose-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                  <input
                    type="text"
                    value={ruleNotes}
                    onChange={e => setRuleNotes(e.target.value)}
                    placeholder="ملاحظات إضافية على اتفاق نسبة الطبيب (اختياري)..."
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCommissionModalOpen(false);
                        setEditingRuleDoctor(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 text-xs font-bold cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingCommissionRule}
                      className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isSavingCommissionRule ? 'جاري الحفظ...' : 'حفظ النسب والاحتساب التلقائي'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* جدول وبطاقات الأطباء وحساب النسب التلقائي */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs overflow-hidden">
            {/* عرض الموبايل: بطاقات الأطباء */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/60">
              {doctorCommissionRows.map(d => (
                <div key={d.doctorId} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-extrabold text-sm text-slate-900 dark:text-white">{d.doctorName}</div>
                      <div className="text-xs text-slate-500">
                        {d.clinicName} · سعر الكشف: <strong className="font-mono">{d.consultationFee} ج.م</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openDoctorCommissionModal(d)}
                      className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>تعديل النسب</span>
                    </button>
                  </div>

                  {/* الشرائح الثلاث المحددة */}
                  <div className="grid grid-cols-3 gap-1.5 text-[11px] text-center">
                    <div className="p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50">
                      <div className="text-slate-500">المطلوب ({d.targetCasesCount})</div>
                      <div className="font-mono font-black text-amber-700 dark:text-amber-400">{d.targetPercentage}%</div>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50">
                      <div className="text-slate-500">الزيادة (≥{d.aboveCasesCount})</div>
                      <div className="font-mono font-black text-emerald-700 dark:text-emerald-400">{d.abovePercentage}%</div>
                    </div>
                    <div className="p-2 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/50">
                      <div className="text-slate-500">النقصان (≤{d.belowCasesCount})</div>
                      <div className="font-mono font-black text-rose-700 dark:text-rose-400">{d.belowPercentage}%</div>
                    </div>
                  </div>

                  {/* النتيجة الفعلية المحسوبة */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        الفعلي: <span className="font-mono font-black">{d.paidExamCases}</span> حالة ({d.appliedTierLabel})
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        النسبة المطبقة تلقائياً: <strong className="font-mono text-purple-700 dark:text-purple-400">{d.appliedPercentage}%</strong> · الإيراد: {d.totalExamValueByDoctorFee.toLocaleString()} ج.م
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <div className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">مستحق الطبيب</div>
                      <div className="text-sm font-mono font-black text-purple-700 dark:text-purple-300">
                        {d.doctorCommissionAmount.toLocaleString()} ج.م
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* عرض الكمبيوتر: جدول كامل وواضح */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-xs lg:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 text-xs font-bold">
                  <tr>
                    <th className="py-3.5 px-3">الطبيب والعيادة</th>
                    <th className="py-3.5 px-3 text-center">سعر الكشف</th>
                    <th className="py-3.5 px-3 text-center">التارجت المطلوب</th>
                    <th className="py-3.5 px-3 text-center">شريحة الزيادة</th>
                    <th className="py-3.5 px-3 text-center">شريحة النقصان</th>
                    <th className="py-3.5 px-3 text-center">الحالات الفعلية</th>
                    <th className="py-3.5 px-3 text-center">الشريحة والنسبة المطبقة</th>
                    <th className="py-3.5 px-3">إجمالي كشوفات الطبيب</th>
                    <th className="py-3.5 px-3">مستحق الطبيب (النسبة)</th>
                    <th className="py-3.5 px-3">صافي حصة المركز</th>
                    <th className="py-3.5 px-3 text-center">ضبط النسب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {doctorCommissionRows.map(d => (
                    <tr key={d.doctorId} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30">
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-slate-900 dark:text-white">{d.doctorName}</div>
                        <div className="text-xs text-slate-500">{d.clinicName}</div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                        {d.consultationFee.toLocaleString()} ج.م
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-mono text-xs font-bold border border-amber-200/70 dark:border-amber-800/60">
                          {d.targetCasesCount} ح ← {d.targetPercentage}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-mono text-xs font-bold border border-emerald-200/70 dark:border-emerald-800/60">
                          ≥{d.aboveCasesCount} ح ← {d.abovePercentage}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 font-mono text-xs font-bold border border-rose-200/70 dark:border-rose-800/60">
                          ≤{d.belowCasesCount} ح ← {d.belowPercentage}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-black text-base text-slate-900 dark:text-white">
                        {d.paidExamCases}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="font-bold text-xs text-slate-800 dark:text-slate-200">{d.appliedTierLabel}</div>
                        <div className="font-mono font-black text-xs text-purple-700 dark:text-purple-400">
                          تُطبق نسبة {d.appliedPercentage}%
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-blue-700 dark:text-blue-400">
                        {d.totalExamValueByDoctorFee.toLocaleString()} ج.م
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-purple-700 dark:text-purple-300 text-sm">
                        {d.doctorCommissionAmount.toLocaleString()} ج.م
                      </td>
                      <td className="py-3 px-3 font-mono font-extrabold text-emerald-700 dark:text-emerald-400">
                        {d.clinicNetShareAmount.toLocaleString()} ج.م
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => openDoctorCommissionModal(d)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>تحديد النسب</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* التبويب الثاني: سجل المصروفات النثرية والسحب من الخزينة */}
      {/* ========================================== */}
      {activeTab === 'expenses' && (
        <div className="print:hidden space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>سجل المصروفات النثرية والمنصرف النقدي من الخزينة ({filteredExpenses.length})</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  تُخصم هذه المصروفات تلقائياً من إجمالي النقدية لحساب صافي الخزينة الفعلي بدقة ({periodSubtitleLabel})
                </p>
              </div>

              <div className="flex items-center flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExportExpensesOnlyExcel}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs transition cursor-pointer whitespace-nowrap"
                  title="تنزيل شيت إكسل مستقل يحتوي فقط على جدول المصروفات النثرية"
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  <span>تصدير إكسل المصروفات فقط (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>تسجيل مصروف أو سحب نقدي</span>
                </button>
              </div>
            </div>

            {filteredExpenses.length === 0 ? (
              <div className="py-10 px-4 text-center text-slate-400 text-xs sm:text-sm">
                لا توجد مصروفات نثرية مسجلة في الفترة المحددة.
              </div>
            ) : (
              <>
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredExpenses.map(exp => (
                    <div key={exp.id} className="p-4 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {exp.title}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {EXPENSE_CATEGORY_LABELS[exp.category]} · <span className="font-mono">{exp.date}</span>
                          {exp.recipientName ? ` · المستلم: ${exp.recipientName}` : ''}
                        </div>
                        {exp.notes && (
                          <div className="text-[11px] text-slate-400">{exp.notes}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-black text-sm text-rose-600 dark:text-rose-400">
                          -{exp.amount.toLocaleString()} ج.م
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteFinanceExpense(exp.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="حذف المصروف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 text-xs font-bold">
                      <tr>
                        <th className="py-3 px-4">التاريخ</th>
                        <th className="py-3 px-4">بيان المصروف / سبب السحب</th>
                        <th className="py-3 px-4">التصنيف</th>
                        <th className="py-3 px-4">المستلم / الجهة</th>
                        <th className="py-3 px-4">المبلغ المنصرف</th>
                        <th className="py-3 px-4">مسجل العملية</th>
                        <th className="py-3 px-4 text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {filteredExpenses.map(exp => (
                        <tr key={exp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30">
                          <td className="py-3 px-4 font-mono text-xs text-slate-500">{exp.date}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">{exp.title}</div>
                            {exp.notes && <div className="text-xs text-slate-500">{exp.notes}</div>}
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold text-amber-700 dark:text-amber-400">
                            {EXPENSE_CATEGORY_LABELS[exp.category]}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                            {exp.recipientName || '—'}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                            -{exp.amount.toLocaleString()} ج.م
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500">{exp.createdBy}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => deleteFinanceExpense(exp.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              title="حذف المصروف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* التبويب الثالث: تعاقدات شركات التأمين وفئات الكروت وتسوية المطالبات */}
      {/* ========================================== */}
      {activeTab === 'insurance' && (
        <div className="print:hidden space-y-5">
          {/* قسم شركات التأمين المتعاقدة + زر إضافة شركة تأمين يفتح نافذة منبثقة نظيفة */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/70">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>شركات التأمين المتعاقدة وفئات الكروت ({insuranceContracts.length})</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  تظهر هذه الشركات وفئات الكروت تلقائياً لموظف الخزينة عند تحصيل كشف التأمين الطبي
                </p>
              </div>

              <div className="flex items-center flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const firstCompany = insuranceContracts[0];
                    setSettlementCompanyId(firstCompany?.id || '');
                    setSettlementCompanyName(firstCompany?.companyName || '');
                    setIsSettlementModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer whitespace-nowrap"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>تسجيل تحصيل دفعة من شركة تأمين</span>
                </button>

                <button
                  type="button"
                  onClick={openNewContractModal}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>إضافة شركة تأمين جديدة</span>
                </button>
              </div>
            </div>

            {/* بطاقات شركات التأمين المتعاقدة — مدمجة وأنيقة */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {insuranceContracts.map(contract => {
                const companyStats = insuranceClaimsSummary.find(
                  s => s.companyId === contract.id || s.companyName === contract.companyName
                );

                return (
                  <div
                    key={contract.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col justify-between gap-3 hover:border-emerald-500/40 transition"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
                            {contract.companyName}
                          </h3>
                          {contract.notes && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {contract.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEditContract(contract)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                            title="تعديل الشركة وفئات الكروت"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteInsuranceContract(contract.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="حذف شركة التأمين"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* عرض فئات الكروت كنص أنيق غير مزدحم */}
                      <div className="text-xs text-blue-700 dark:text-blue-300 font-semibold leading-relaxed">
                        <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">الفئات:</span>
                        {contract.cardCategories.join(' · ')}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>
                        الحالات:{' '}
                        <strong className="font-mono text-slate-800 dark:text-slate-200">
                          {companyStats?.casesCount || 0}
                        </strong>
                      </span>
                      <span>
                        المتبقي:{' '}
                        <strong className="font-mono text-blue-600 dark:text-blue-400">
                          {(companyStats?.remainingBalance ?? companyStats?.totalCompanyReceivable ?? 0).toLocaleString()} ج.م
                        </strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ملخص المطالبات المالية المستحقة على شركات التأمين */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <BadgePercent className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    كشف حساب ومطالبات شركات التأمين والمديونية المتبقية
                  </h3>
                  <span className="text-xs text-slate-500">
                    إجمالي المطالبات: <strong className="font-mono text-blue-600 dark:text-blue-400">{financialMetrics.insuranceReceivables.toLocaleString()} ج.م</strong>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportInsuranceOnlyExcel}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-xs transition cursor-pointer whitespace-nowrap"
                title="تنزيل شيت إكسل مستقل يحتوي فقط على مطالبات ومديونيات شركات التأمين"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>تصدير إكسل مطالبات التأمين فقط (.xlsx)</span>
              </button>
            </div>

            {insuranceClaimsSummary.length === 0 ? (
              <div className="py-8 px-4 text-center text-slate-400 text-xs sm:text-sm">
                لم يتم تسجيل كشوفات تأمين طبي في الفترة المحددة بعد.
              </div>
            ) : (
              <>
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/60">
                  {insuranceClaimsSummary.map(item => (
                    <div key={item.companyName} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {item.companyName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            الفئات المستخدمة: {item.cardsList}
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                          {item.casesCount} كشف
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <div className="p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
                          <div className="text-[10px] text-blue-800 dark:text-blue-300">إجمالي المطالبة</div>
                          <div className="text-xs font-mono font-black text-blue-700 dark:text-blue-400">
                            {item.totalCompanyReceivable.toLocaleString()} ج.م
                          </div>
                        </div>
                        <div className="p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                          <div className="text-[10px] text-emerald-800 dark:text-emerald-300">المسدد</div>
                          <div className="text-xs font-mono font-extrabold text-emerald-700 dark:text-emerald-400">
                            {item.settledAmount.toLocaleString()} ج.م
                          </div>
                        </div>
                        <div className="p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
                          <div className="text-[10px] text-amber-800 dark:text-amber-300">المتبقي</div>
                          <div className="text-xs font-mono font-black text-amber-700 dark:text-amber-400">
                            {item.remainingBalance.toLocaleString()} ج.م
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 text-xs font-bold">
                      <tr>
                        <th className="py-3 px-4">شركة التأمين</th>
                        <th className="py-3 px-4">فئات الكروت المستخدمة</th>
                        <th className="py-3 px-4 text-center">عدد الكشوفات</th>
                        <th className="py-3 px-4">تحمل المرضى (نقداً)</th>
                        <th className="py-3 px-4">إجمالي المطالبة</th>
                        <th className="py-3 px-4">المسدد من الشركة</th>
                        <th className="py-3 px-4">المديونية المتبقية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {insuranceClaimsSummary.map(item => (
                        <tr key={item.companyName} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30">
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            {item.companyName}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                            {item.cardsList}
                          </td>
                          <td className="py-3 px-4 text-center font-mono tabular-nums font-bold">
                            {item.casesCount}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums font-bold text-emerald-600">
                            {item.totalPatientCopay.toLocaleString()} ج.م
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums font-black text-blue-600 dark:text-blue-400">
                            {item.totalCompanyReceivable.toLocaleString()} ج.م
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums font-bold text-emerald-600">
                            {item.settledAmount.toLocaleString()} ج.م
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums font-black text-amber-600 dark:text-amber-400">
                            {item.remainingBalance.toLocaleString()} ج.م
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* سجل الدفعات والشيكات المحصلة من شركات التأمين */}
          {(financeLedger?.settlements || []).length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  سجل الدفعات والشيكات المحصلة من شركات التأمين ({financeLedger.settlements.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {financeLedger.settlements.map(st => (
                  <div key={st.id} className="p-3.5 sm:px-5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-extrabold text-slate-900 dark:text-white">
                        {st.companyName} —{' '}
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">
                          {(st.paidAmount ?? st.amountPaid ?? 0).toLocaleString()} ج.م
                        </span>
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        تاريخ السداد: <span className="font-mono">{st.settlementDate || st.paymentDate}</span> · طريقة الدفع:{' '}
                        {st.paymentMethod === 'bank_transfer'
                          ? 'تحويل بنكي'
                          : st.paymentMethod === 'cheque'
                          ? 'شيك بنكي'
                          : 'نقدي'}{' '}
                        {st.paymentReference || st.referenceNumber ? `· مرجع: ${st.paymentReference || st.referenceNumber}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteInsuranceSettlement(st.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="حذف عملية التحصيل"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* التبويب الرابع: رقابة تسليم واستلام الشفتات واعتماد مدير المالية */}
      {/* ========================================== */}
      {activeTab === 'handovers' && (
        <div className="print:hidden bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-emerald-600 shrink-0" />
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  سجل تسليم واستلام الشفتات واعتماد الإدارة المالية ({filteredHandovers.length})
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                متابعة تسليم المبلغ للإدارة أو للزميل واعتماد التقفيل رسمياً بواسطة مدير المالية
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportHandoversOnlyExcel}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs transition cursor-pointer whitespace-nowrap"
                title="تنزيل شيت إكسل مستقل يحتوي فقط على سجل تسليم واستلام الشفتات"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>تصدير إكسل الشفتات فقط (.xlsx)</span>
              </button>

              {/* أزرار فلترة الشفتات */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setHandoverFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    handoverFilter === 'all'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  الكل ({shiftHandovers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHandoverFilter('cashier')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    handoverFilter === 'cashier'
                      ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  الخزينة
                </button>
                <button
                  type="button"
                  onClick={() => setHandoverFilter('reception')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    handoverFilter === 'reception'
                      ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  الاستقبال
                </button>
                {discrepancyHandoversCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setHandoverFilter('discrepancy')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      handoverFilter === 'discrepancy'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    بها فرق ({discrepancyHandoversCount})
                  </button>
                )}
              </div>
            </div>
          </div>

          {filteredHandovers.length === 0 ? (
            <div className="py-10 px-4 text-center text-slate-400 text-xs sm:text-sm">
              لا توجد عمليات تسليم شفت مطابقة للفلتر المحدد.
            </div>
          ) : (
            <>
              {/* عرض الموبايل: بطاقات واضحة لكل عملية تسليم شفت */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredHandovers.map(h => {
                  const diff =
                    h.actualReceivedAmount !== undefined && h.expectedAmount !== undefined
                      ? h.actualReceivedAmount - h.expectedAmount
                      : 0;

                  return (
                    <div key={h.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                            من: {h.fromStaffName} ← إلى: {h.toStaffName}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {h.department === 'cashier' ? 'قسم الخزينة' : 'قسم الاستقبال'} ·{' '}
                            <span className="font-mono">{h.shiftDate}</span> ·{' '}
                            <span className="font-mono">
                              {new Date(h.createdAt).toLocaleTimeString('ar-EG', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="text-left shrink-0">
                          {h.status === 'delivered_to_management' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              تُسلم للإدارة
                            </span>
                          ) : h.status === 'accepted_exact' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              مطابق
                            </span>
                          ) : h.status === 'discrepancy_reported' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              فرق: <span className="font-mono">{diff > 0 ? `+${diff}` : diff}</span> ج.م
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                              <Clock className="w-3.5 h-3.5" />
                              قيد الاستلام
                            </span>
                          )}
                        </div>
                      </div>

                      {h.department === 'cashier' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700">
                            <div className="text-[10px] text-slate-500">المبلغ المُسلَّم</div>
                            <div className="text-xs font-mono font-extrabold text-slate-900 dark:text-white">
                              {h.expectedAmount !== undefined ? `${h.expectedAmount.toLocaleString()} ج.م` : '—'}
                            </div>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700">
                            <div className="text-[10px] text-slate-500">المبلغ الفعلي المستلم</div>
                            <div className="text-xs font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                              {h.status === 'delivered_to_management'
                                ? `${(h.expectedAmount || 0).toLocaleString()} ج.م`
                                : h.actualReceivedAmount !== undefined
                                ? `${h.actualReceivedAmount.toLocaleString()} ج.م`
                                : 'بانتظار التأكيد'}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {h.acknowledgmentNotes || h.notes || ''}
                        </div>
                        {h.managerApproved ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                            <BadgeCheck className="w-4 h-4" />
                            <span>معتمد ({h.managerApprovedBy})</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={approvingHandoverId === h.id}
                            onClick={() => handleApproveHandover(h.id)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                          >
                            {approvingHandoverId === h.id ? 'جاري الاعتماد...' : 'اعتماد التقفيل'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* عرض الكمبيوتر: جدول كامل */}
              <div className="hidden md:block overflow-x-auto">
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
                      <th className="py-3.5 px-4">اعتماد مدير المالية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {filteredHandovers.map(h => {
                      const diff =
                        h.actualReceivedAmount !== undefined && h.expectedAmount !== undefined
                          ? h.actualReceivedAmount - h.expectedAmount
                          : 0;

                      return (
                        <tr key={h.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30">
                          <td className="py-3.5 px-4 text-xs font-mono text-slate-500">
                            <div className="font-bold text-slate-700 dark:text-slate-200">{h.shiftDate}</div>
                            <div>
                              {new Date(h.createdAt).toLocaleTimeString('ar-EG', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-bold">
                            {h.department === 'cashier' ? (
                              <span className="text-emerald-700 dark:text-emerald-400">الخزينة</span>
                            ) : (
                              <span className="text-indigo-700 dark:text-indigo-400">الاستقبال</span>
                            )}
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
                          <td className="py-3.5 px-4 font-mono tabular-nums font-extrabold">
                            {h.expectedAmount !== undefined ? `${h.expectedAmount.toLocaleString()} ج.م` : '—'}
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums font-extrabold">
                            {h.status === 'delivered_to_management'
                              ? `${(h.expectedAmount || 0).toLocaleString()} ج.م`
                              : h.actualReceivedAmount !== undefined
                              ? `${h.actualReceivedAmount.toLocaleString()} ج.م`
                              : 'بانتظار التأكيد'}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-bold">
                            {h.status === 'delivered_to_management' ? (
                              <span className="inline-flex items-center gap-1 text-purple-700 dark:text-purple-300">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                تم التسليم للإدارة
                              </span>
                            ) : h.status === 'accepted_exact' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                مطابق بالكامل
                              </span>
                            ) : h.status === 'discrepancy_reported' ? (
                              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                فرق: <span className="font-mono">{diff > 0 ? `+${diff}` : diff}</span> ج.م
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <Clock className="w-3.5 h-3.5" />
                                بانتظار استلام الزميل
                              </span>
                            )}
                            {(h.acknowledgmentNotes || h.notes) && (
                              <div className="text-[11px] font-normal text-slate-400 mt-0.5">
                                {h.acknowledgmentNotes || h.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            {h.managerApproved ? (
                              <div className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                                <BadgeCheck className="w-4 h-4 shrink-0" />
                                <span>معتمد ({h.managerApprovedBy})</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={approvingHandoverId === h.id}
                                onClick={() => handleApproveHandover(h.id)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer whitespace-nowrap"
                              >
                                {approvingHandoverId === h.id ? 'جاري الاعتماد...' : 'اعتماد التقفيل'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* نافذة إضافة أو تعديل شركة تأمين (Modal) */}
      {/* ========================================== */}
      {isContractModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {editingContractId ? 'تعديل تعاقد شركة التأمين' : 'إضافة شركة تأمين متعاقدة جديدة'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    حدد اسم الشركة وفئات الكروت التي تصدرها ليتمكن الكاشير من اختيارها
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsContractModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 mb-0.5">
                <Info className="w-4 h-4 shrink-0 text-blue-600" />
                <span>نظام التعاقد المرن</span>
              </div>
              عند حضور المريض للخزينة، يختار الكاشير الشركة وفئة الكارت ويكتب رقم الكارت ونسبة التحمل المدونة على الكارت (مثل <code>20%</code> أو <code>10%</code> أو <code>20/10</code>).
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  فئات الكروت المعتمدة لهذه الشركة (اختر فئة أو أكثر) *
                </label>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {PRESET_CARD_CATEGORIES.map(cat => {
                    const isSelected = selectedCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                        <span>{cat}</span>
                      </button>
                    );
                  })}
                </div>

                {/* إضافة فئة كارت مخصصة — زر مضبوط العرض لا ينضغط على الموبايل */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customCategoryInput}
                    onChange={e => setCustomCategoryInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomCategory();
                      }
                    }}
                    placeholder="أو اكتب اسم فئة كارت إضافية..."
                    className="min-w-0 flex-1 px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomCategory}
                    className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-xs font-bold transition cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    + إضافة فئة
                  </button>
                </div>

                {selectedCategories.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {selectedCategories.map(cat => (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold"
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsContractModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingContract}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingContractId ? 'حفظ التعديلات' : 'حفظ شركة التأمين'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* نافذة المسح الانتقائي للسجلات (Selective Purge Modal) */}
      {/* ========================================== */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                    تنظيف ومسح السجلات الانتقائي (حماية مساحة Supabase)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    اختر بدقة نوع السجلات التي ترغب في مسحها دون المساس بباقي بيانات المنظومة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* زر تحميل نسخة إكسل احتياطية قبل المسح */}
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs text-emerald-900 dark:text-emerald-200">
                <div className="font-extrabold mb-0.5">نصيحة أمان مالي قبل المسح:</div>
                يمكنك تنزيل شيت الإكسل الشامل الآن للاحتفاظ بنسخة كاملة على جهازك قبل تفريغ السجلات.
              </div>
              <button
                type="button"
                onClick={handleExportComprehensiveExcel}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>تنزيل الإكسل أولاً</span>
              </button>
            </div>

            {/* قائمة الاختيارات */}
            <div className="space-y-2.5">
              {/* خيار 1: مسح حجوزات الأيام السابقة */}
              <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
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
                  <div className="font-extrabold text-slate-900 dark:text-white">
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
                        className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                      />
                    </div>
                  )}
                </div>
              </label>

              {/* خيار 2: مسح كل الحجوزات بالكامل */}
              <label className="flex items-start gap-3 p-3 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 cursor-pointer">
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
                  <div className="font-extrabold text-rose-700 dark:text-rose-300">
                    مسح جميع الحجوزات بالكامل (بما فيها حجوزات اليوم — {bookings.length} حجز)
                  </div>
                  <p className="text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                    تصفير شامل لجدول الحجوزات بالكامل من Supabase والتخزين المحلي.
                  </p>
                </div>
              </label>

              {/* خيار 3: مسح سجلات تسليم واستلام الشفتات والخزينة */}
              <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={purgeOptions.purgeShiftHandovers}
                  onChange={e =>
                    setPurgeOptions(prev => ({ ...prev, purgeShiftHandovers: e.target.checked }))
                  }
                  className="mt-1 w-4 h-4 accent-rose-600"
                />
                <div className="flex-1 text-xs">
                  <div className="font-extrabold text-slate-900 dark:text-white">
                    مسح سجلات تسليم واستلام الشفتات والخزينة ({shiftHandovers.length} سجل)
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    تفريغ أرشيف تسليمات الخزينة والاستقبال السابقة بعد مراجعتها.
                  </p>
                </div>
              </label>

              {/* خيار 4: مسح بصمات الاستشارات المجانية */}
              <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={purgeOptions.purgeConsultationStamps}
                  onChange={e =>
                    setPurgeOptions(prev => ({ ...prev, purgeConsultationStamps: e.target.checked }))
                  }
                  className="mt-1 w-4 h-4 accent-rose-600"
                />
                <div className="flex-1 text-xs">
                  <div className="font-extrabold text-slate-900 dark:text-white">
                    مسح بصمات الاستشارات المجانية الفعالة ({consultationRegistry.stamps.length} بصمة)
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    علماً بأن النظام يمسح بصمة المريض تلقائياً فور دخوله الاستشارة أو انتهاء مدتها.
                  </p>
                </div>
              </label>

              {/* خيار 5: مسح سجلات الواتساب والطباعة */}
              <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
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
                  <div className="font-extrabold text-slate-900 dark:text-white">
                    مسح سجلات إشعارات الواتساب والطباعة الحرارية
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    تنظيف الذاكرة المحلية من سجلات التذاكر المطبوعة وإشعارات الواتساب المرسلة.
                  </p>
                </div>
              </label>

              {/* خيار 6: مسح سجلات المصروفات النثرية */}
              <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!purgeOptions.purgeFinanceExpenses}
                  onChange={e =>
                    setPurgeOptions(prev => ({ ...prev, purgeFinanceExpenses: e.target.checked }))
                  }
                  className="mt-1 w-4 h-4 accent-rose-600"
                />
                <div className="flex-1 text-xs">
                  <div className="font-extrabold text-slate-900 dark:text-white">
                    مسح سجلات المصروفات النثرية السابقة ({financeLedger?.expenses?.length || 0} عملية)
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    تفريغ سجل المصروفات النثرية والمنصرف النقدي السابق بعد تصديره للإكسل.
                  </p>
                </div>
              </label>

              {/* خيار 7: مسح سجلات أخطاء النظام */}
              <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={purgeOptions.purgeSystemErrorLogs}
                  onChange={e =>
                    setPurgeOptions(prev => ({ ...prev, purgeSystemErrorLogs: e.target.checked }))
                  }
                  className="mt-1 w-4 h-4 accent-rose-600"
                />
                <div className="flex-1 text-xs">
                  <div className="font-extrabold text-slate-900 dark:text-white">
                    مسح سجلات أخطاء النظام التقنية ({errorLogs.length} سجل)
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    تفريغ سجل الأخطاء التقنية المسجل في قاعدة البيانات السحابية.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isPurging}
                onClick={handleConfirmSelectivePurge}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isPurging ? 'جاري المسح...' : 'تنفيذ مسح السجلات المحددة'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* نافذة تسجيل مصروف نثري أو سحب نقدي من الخزينة */}
      {/* ========================================== */}
      {isExpenseModalOpen && (
        <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    تسجيل مصروف نثري / سحب من الخزينة
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    يُخصم المبلغ تلقائياً من النقدية لإظهار صافي الخزينة الفعلي
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpenseSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  بيان المصروف أو سبب السحب *
                </label>
                <input
                  type="text"
                  required
                  value={expenseTitle}
                  onChange={e => setExpenseTitle(e.target.value)}
                  placeholder="مثال: شراء مستلزمات تعقيم / رد كشف مريض / فاتورة كهرباء"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    المبلغ المنصرف (ج.م) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    التاريخ *
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  تصنيف المصروف
                </label>
                <select
                  value={expenseCategory}
                  onChange={e => setExpenseCategory(e.target.value as FinanceExpenseRecord['category'])}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
                >
                  <option value="medical_supplies">مستلزمات طبية وتعقيم</option>
                  <option value="utilities_maintenance">صيانة ومرافق وفواتير</option>
                  <option value="hospitality_Allowance">ضيافة وبدلات انتداب</option>
                  <option value="refund_return">رد كشف لمريض</option>
                  <option value="other">مصروفات نثرية أخرى</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم المستلم / الجهة (اختياري)
                </label>
                <input
                  type="text"
                  value={expenseRecipient}
                  onChange={e => setExpenseRecipient(e.target.value)}
                  placeholder="اسم الموظف أو المورد المستلم للمبلغ"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات إضافية (اختياري)
                </label>
                <input
                  type="text"
                  value={expenseNotes}
                  onChange={e => setExpenseNotes(e.target.value)}
                  placeholder="رقم إيصال أو تفاصيل إضافية..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingExpense}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingExpense ? 'جاري الحفظ...' : 'حفظ المصروف وخصمه من الخزينة'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* نافذة تسجيل تحصيل دفعة من شركة تأمين */}
      {/* ========================================== */}
      {isSettlementModalOpen && (
        <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    تسجيل تحصيل دفعة من شركة تأمين
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    تُخصم الدفعة من إجمالي المطالبات لإظهار المديونية المتبقية بدقة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettlementModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettlementSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  شركة التأمين *
                </label>
                <select
                  required
                  value={settlementCompanyName}
                  onChange={e => {
                    const name = e.target.value;
                    setSettlementCompanyName(name);
                    const c = insuranceContracts.find(ic => ic.companyName === name);
                    setSettlementCompanyId(c?.id || '');
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
                >
                  <option value="">— اختر شركة التأمين —</option>
                  {insuranceContracts.map(c => (
                    <option key={c.id} value={c.companyName}>
                      {c.companyName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    المبلغ المحصل (ج.م) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={settlementAmount}
                    onChange={e => setSettlementAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    تاريخ التحصيل *
                  </label>
                  <input
                    type="date"
                    required
                    value={settlementDate}
                    onChange={e => setSettlementDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    طريقة السداد
                  </label>
                  <select
                    value={settlementMethod}
                    onChange={e =>
                      setSettlementMethod(e.target.value as 'bank_transfer' | 'cheque' | 'cash')
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
                  >
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="cheque">شيك بنكي</option>
                    <option value="cash">نقدي بالخزينة</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    رقم الشيك / التحويل
                  </label>
                  <input
                    type="text"
                    value={settlementRefNumber}
                    onChange={e => setSettlementRefNumber(e.target.value)}
                    placeholder="اختياري..."
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات التسوية (اختياري)
                </label>
                <input
                  type="text"
                  value={settlementNotes}
                  onChange={e => setSettlementNotes(e.target.value)}
                  placeholder="مثال: دفعة تحت حساب مطالبات شهر أكتوبر..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsSettlementModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettlement}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingSettlement ? 'جاري الحفظ...' : 'تسجيل التحصيل'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
