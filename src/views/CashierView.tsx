import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Receipt, 
  Search, 
  CheckCircle2, 
  ShieldCheck, 
  Coins, 
  HeartHandshake, 
  Printer, 
  Clock, 
  MessageCircle, 
  Filter,
  Check,
  FileCheck,
  QrCode,
  Camera,
  X,
  AlertTriangle,
  RotateCcw,
  FileText,
  UserPlus,
  User,
  Phone,
  Stethoscope,
  CalendarCheck,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { maskPhoneNumber, validateTripleName, validateEgyptianPhone, sanitizeSpreadsheetCell } from '../services/storage';
import { getLocalDateStr } from '../services/scheduleService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { fetchSettingsFromDb, markWhatsAppSentInDb, verifyTicketForStaffRpc } from '../services/supabaseService';
import { PaymentStatus, PaymentMethod, Booking, DailyClinicScheduleItem } from '../types';

export const CashierView: React.FC = () => {
  const {
    currentUser,
    hasPermission,
    bookings,
    updatePaymentStatus,
    deleteBooking,
    clinics,
    doctors,
    dailySchedule,
    updateDailySchedule,
    updateClinic,
    addToast,
    setPatientHistoryModalOpen,
    setPatientHistoryPhone,
    createBooking,
    getActiveClinicsForBooking,
    checkClinicAvailabilityStatus,
    navigate,
    setSelectedTicket,
    checkConsultationEligibility,
    consultationRegistry
  } = useApp();
  const [activeTab, setActiveTab] = useState<'unpaid' | 'paid' | 'financial-reports' | 'clinic-fees' | 'daily-clinics'>('unpaid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClinic, setSelectedClinic] = useState<string>('all');
  const [selectedReceiptBooking, setSelectedReceiptBooking] = useState<Booking | null>(null);
  const [editingFeeClinicId, setEditingFeeClinicId] = useState<string | null>(null);
  const [tempClinicFee, setTempClinicFee] = useState<number>(50);

  // الصلاحيات الأساسية والمفوضة للكاشير من لوحة تحكم الأدمن
  const canConfirmPayments =
    currentUser?.role === 'cashier' ||
    currentUser?.role === 'admin' ||
    hasPermission(currentUser?.role, 'confirm_payments_exemptions');
  const canDeleteBookings =
    currentUser?.role === 'cashier' ||
    currentUser?.role === 'admin' ||
    hasPermission(currentUser?.role, 'confirm_payments_exemptions');
  const canViewFinancialReports = hasPermission(currentUser?.role, 'view_financial_reports');
  const canManageClinicFees = hasPermission(currentUser?.role, 'manage_clinic_fees');
  const canManageDailyClinics = hasPermission(currentUser?.role, 'manage_daily_clinics');

  // حالة نافذة تأكيد حذف حجز مريض لم يحضر
  const [bookingPendingDeletion, setBookingPendingDeletion] = useState<Booking | null>(null);
  const [isDeletingBooking, setIsDeletingBooking] = useState(false);

  const handleConfirmDeleteBooking = async () => {
    if (!bookingPendingDeletion || isDeletingBooking) return;
    setIsDeletingBooking(true);
    try {
      const res = await deleteBooking(bookingPendingDeletion.id);
      if (res.success) {
        if (scannedBooking?.id === bookingPendingDeletion.id) {
          setScannedBooking(null);
          setScannedTicketInput('');
        }
        setBookingPendingDeletion(null);
      }
    } finally {
      setIsDeletingBooking(false);
    }
  };

  // حالة نافذة الحجز المباشر لمريض حضوري عند الكاشير (بدون هاتف ذكي)
  const activeClinicsWithDoctors = getActiveClinicsForBooking();
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [walkInClinicId, setWalkInClinicId] = useState<string>(activeClinicsWithDoctors[0]?.clinic.id || '');
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInPaymentMode, setWalkInPaymentMode] = useState<'cash' | 'insurance' | 'charity_exempt' | 'consultation' | 'unpaid'>('cash');
  const [walkInError, setWalkInError] = useState('');
  const [isWalkInSubmitting, setIsWalkInSubmitting] = useState(false);
  const [walkInCreatedBooking, setWalkInCreatedBooking] = useState<Booking | null>(null);

  React.useEffect(() => {
    if (activeClinicsWithDoctors.length > 0) {
      if (!walkInClinicId || !activeClinicsWithDoctors.some(i => i.clinic.id === walkInClinicId)) {
        setWalkInClinicId(activeClinicsWithDoctors[0].clinic.id);
      }
    } else {
      setWalkInClinicId('');
    }
  }, [activeClinicsWithDoctors, walkInClinicId]);

  // حالة نافذة الاستشارات المجانية المخصصة (فحص فوري بالاسم ورقم الهاتف وإدخال للطابور)
  const [isConsultationModalOpen, setIsConsultationModalOpen] = useState(false);
  const [consultPatientName, setConsultPatientName] = useState('');
  const [consultPatientPhone, setConsultPatientPhone] = useState('');
  const [consultError, setConsultError] = useState('');
  const [isConsultSubmitting, setIsConsultSubmitting] = useState(false);
  const [consultCreatedBooking, setConsultCreatedBooking] = useState<Booking | null>(null);

  const handleResetConsultationModal = () => {
    setConsultPatientName('');
    setConsultPatientPhone('');
    setConsultError('');
    setIsConsultSubmitting(false);
    setConsultCreatedBooking(null);
  };

  // البحث الذكي عن المريض واستشاراته المتاحة بمجرد كتابة رقم الهاتف أو الاسم
  const cleanConsultPhone = consultPatientPhone.replace(/\D/g, '');
  const cleanConsultNameQuery = consultPatientName.trim().toLowerCase();

  // اقتراحات المرضى المطابقين للاسم (في حال كتب الكاشير الاسم أولاً قبل الرقم)
  const matchingPatientsByName = React.useMemo(() => {
    if (cleanConsultNameQuery.length < 2) return [];
    const map = new Map<string, { name: string; phone: string }>();

    for (const stamp of consultationRegistry.stamps) {
      if (stamp.patientName && stamp.patientName.toLowerCase().includes(cleanConsultNameQuery)) {
        map.set(stamp.phone, { name: stamp.patientName, phone: stamp.phone });
      }
    }
    for (const b of bookings) {
      const pPhone = b.patientPhone.replace(/\D/g, '');
      if (pPhone.length >= 10 && b.patientName.toLowerCase().includes(cleanConsultNameQuery)) {
        if (!map.has(pPhone)) {
          map.set(pPhone, { name: b.patientName, phone: pPhone });
        }
      }
    }
    return Array.from(map.values()).slice(0, 5);
  }, [cleanConsultNameQuery, consultationRegistry.stamps, bookings]);

  // إذا كتب الكاشير رقم الهاتف، نبحث عن اسم المريض المسجل مسبقاً لعرضه أو تعبئته
  const detectedPatientNameFromPhone = React.useMemo(() => {
    if (cleanConsultPhone.length < 10) return '';
    const fromStamp = consultationRegistry.stamps.find(
      s => s.phone === cleanConsultPhone && s.patientName
    )?.patientName;
    if (fromStamp) return fromStamp;
    const fromBooking = bookings.find(
      b => b.patientPhone.replace(/\D/g, '') === cleanConsultPhone
    )?.patientName;
    return fromBooking || '';
  }, [cleanConsultPhone, consultationRegistry.stamps, bookings]);

  // تحديد الرقم الفعلي المراد فحص استشاراته (سواء كتبه الكاشير مباشرة أو تطابق مع الاسم المكتوب)
  const effectiveLookupPhone = React.useMemo(() => {
    if (cleanConsultPhone.length >= 10) return cleanConsultPhone;
    if (matchingPatientsByName.length === 1) return matchingPatientsByName[0].phone;
    return '';
  }, [cleanConsultPhone, matchingPatientsByName]);

  // قائمة العيادات التي للمريض فيها استشارة مجانية سارية الآن
  const eligibleConsultationClinics = React.useMemo(() => {
    if (!effectiveLookupPhone || effectiveLookupPhone.length < 10) return [];
    return clinics
      .map(clinic => {
        const elig = checkConsultationEligibility(effectiveLookupPhone, clinic.id);
        if (!elig.eligible) return null;
        const activePair = activeClinicsWithDoctors.find(item => item.clinic.id === clinic.id);
        const fallbackDoc = doctors.find(d => d.clinicId === clinic.id);
        const existingUnpaidToday = bookings.find(
          b =>
            b.date === getLocalDateStr() &&
            b.clinicId === clinic.id &&
            b.patientPhone.replace(/\D/g, '') === effectiveLookupPhone &&
            b.status !== 'cancelled' &&
            b.paymentStatus === 'unpaid'
        );
        return {
          clinic,
          assignedDoctor: activePair?.assignedDoctor || fallbackDoc || null,
          isOpenToday: Boolean(activePair),
          examDate: elig.examDate || '',
          daysRemaining: elig.daysRemaining ?? 0,
          existingUnpaidToday
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [effectiveLookupPhone, clinics, checkConsultationEligibility, activeClinicsWithDoctors, doctors, bookings]);

  // تفعيل وإصدار تذكرة الاستشارة المجانية لعيادة محددة بضغطة واحدة
  const handleActivateClinicConsultation = async (clinicId: string) => {
    setConsultError('');
    const targetPhone = effectiveLookupPhone || cleanConsultPhone;
    const finalName = (consultPatientName.trim() || detectedPatientNameFromPhone).trim();

    const nameCheck = validateTripleName(finalName);
    if (!nameCheck.valid) {
      setConsultError(nameCheck.error || 'يرجى كتابة اسم المريض ثلاثياً لتسجيل تذكرة الاستشارة.');
      return;
    }

    const phoneCheck = validateEgyptianPhone(targetPhone);
    if (!phoneCheck.valid) {
      setConsultError(phoneCheck.error || 'يرجى إدخال رقم هاتف صحيح للمريض.');
      return;
    }

    // 1. إذا كان للمريض حجز اليوم غير مسدد في نفس العيادة، نؤكده فوراً كاستشارة مجانية (٠ ج.م)
    const existingUnpaid = bookings.find(
      b =>
        b.date === todayStr &&
        b.clinicId === clinicId &&
        b.patientPhone.replace(/\D/g, '') === targetPhone &&
        b.status !== 'cancelled' &&
        b.paymentStatus === 'unpaid'
    );

    if (existingUnpaid) {
      const ok = updatePaymentStatus(existingUnpaid.id, 'exempt', 'consultation');
      if (ok) {
        const updatedBooking: Booking = {
          ...existingUnpaid,
          paymentStatus: 'exempt',
          paymentMethod: 'consultation',
          fee: 0,
          paidAt: new Date().toISOString()
        };
        setConsultCreatedBooking(updatedBooking);
        setActiveTab('paid');
      }
      return;
    }

    // 2. إذا حضر المريض مباشرة للكاشير بدون حجز اليوم، ننشئ له تذكرة استشارة مجانية ونعتمدها فوراً
    const selectedPair = activeClinicsWithDoctors.find(item => item.clinic.id === clinicId);
    const fallbackClinic = clinics.find(c => c.id === clinicId);
    const fallbackDoctor = selectedPair?.assignedDoctor || doctors.find(d => d.clinicId === clinicId);

    if (!fallbackClinic || !fallbackDoctor) {
      setConsultError('هذه العيادة لا يوجد بها طبيب مسجل حالياً.');
      return;
    }

    const avail = checkClinicAvailabilityStatus(fallbackClinic.id, fallbackDoctor.id, todayStr);
    if (avail && !avail.allowed) {
      setConsultError(avail.reason || 'العيادة المختارة غير متاحة لاستقبال حالات اليوم.');
      return;
    }

    setIsConsultSubmitting(true);
    const res = await createBooking({
      patientName: finalName,
      patientPhone: targetPhone,
      clinicId: fallbackClinic.id,
      doctorId: fallbackDoctor.id,
      date: todayStr,
      timeSlot: fallbackDoctor.scheduleHours || fallbackClinic.workingHours || '9:00 ص - 5:00 م',
      fee: 0,
      notes: 'دخول استشارة مجانية معتمدة من الخزينة'
    });
    setIsConsultSubmitting(false);

    if (!res.success || !res.booking) {
      setConsultError(res.error || 'تعذر إصدار تذكرة الاستشارة حالياً.');
      return;
    }

    const ok = updatePaymentStatus(res.booking.id, 'exempt', 'consultation');
    const finalBooking: Booking = {
      ...res.booking,
      paymentStatus: ok ? 'exempt' : res.booking.paymentStatus,
      paymentMethod: ok ? 'consultation' : res.booking.paymentMethod,
      fee: 0,
      paidAt: new Date().toISOString()
    };
    setActiveTab('paid');
    setConsultCreatedBooking(finalBooking);
  };

  // حالة قارئ الباركود ومسح تذاكر الخزينة
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedTicketInput, setScannedTicketInput] = useState('');
  const [scannedBooking, setScannedBooking] = useState<Booking | null>(null);
  const [scanNotFound, setScanNotFound] = useState(false);

  // تتبع التذاكر التي تم إرسال رسالة واتساب لها ومزامنتها مع قاعدة بيانات Supabase
  const [whatsAppSentIds, setWhatsAppSentIds] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('sharaya_whatsapp_sent_v1');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    let isMounted = true;

    fetchSettingsFromDb().then(settings => {
      if (!isMounted || !settings?.['whatsapp_sent_ids']) return;
      try {
        const parsed = JSON.parse(settings['whatsapp_sent_ids']);
        if (parsed && typeof parsed === 'object') {
          setWhatsAppSentIds(prev => {
            const merged = { ...prev, ...parsed };
            try {
              localStorage.setItem('sharaya_whatsapp_sent_v1', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      } catch {}
    }).catch(() => {});

    const channel = supabase
      .channel('cashier_whatsapp_sync')
      .on('broadcast', { event: 'whatsapp_sent_updated' }, (payload: any) => {
        if (!isMounted) return;
        const bookingId = payload?.payload?.bookingId;
        const remoteMap = payload?.payload?.sentIds;
        setWhatsAppSentIds(prev => {
          const next = {
            ...prev,
            ...(remoteMap && typeof remoteMap === 'object' ? remoteMap : {}),
            ...(bookingId ? { [bookingId]: true } : {})
          };
          try {
            localStorage.setItem('sharaya_whatsapp_sent_v1', JSON.stringify(next));
          } catch {}
          return next;
        });
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const markWhatsAppSent = (bookingId: string) => {
    setWhatsAppSentIds(prev => {
      const next = { ...prev, [bookingId]: true };
      try {
        localStorage.setItem('sharaya_whatsapp_sent_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
    if (isSupabaseConfigured) {
      markWhatsAppSentInDb(bookingId).then(cloudMap => {
        if (cloudMap && typeof cloudMap === 'object') {
          setWhatsAppSentIds(prev => {
            const merged = { ...prev, ...cloudMap };
            try {
              localStorage.setItem('sharaya_whatsapp_sent_v1', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      }).catch(() => {});
    }
  };

  const todayStr = getLocalDateStr();
  const todayBookings = bookings.filter(b => b.date === todayStr && b.status !== 'cancelled');

  // حجوزات تحتاج تأكيد وسداد (غير مسددة)
  const unpaidBookings = todayBookings.filter(b => b.paymentStatus === 'unpaid');
  
  // الحجوزات المؤكدة والمسددة (نقدي / تأمين / إعفاء خيري) مرتبة حسب وقت الدفع
  const paidBookings = todayBookings
    .filter(b => b.paymentStatus === 'paid' || b.paymentStatus === 'exempt')
    .sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime());

  // إجمالي الإيرادات النقدية
  const cashRevenue = paidBookings
    .filter(b => b.paymentMethod === 'cash')
    .reduce((acc, b) => acc + b.fee, 0);

  const insuranceCount = paidBookings.filter(b => b.paymentMethod === 'insurance').length;
  const consultationCount = paidBookings.filter(b => b.paymentMethod === 'consultation').length;
  const charityExemptCount = paidBookings.filter(b => b.paymentStatus === 'exempt' && b.paymentMethod !== 'consultation').length;

  const currentList = activeTab === 'unpaid' ? unpaidBookings : paidBookings;

  const filteredList = currentList.filter(b => {
    const matchClinic = selectedClinic === 'all' || b.clinicId === selectedClinic;
    const cleanSearch = searchQuery.trim().replace(/[\s-]/g, '').toLowerCase();
    const cleanPhone = b.patientPhone.replace(/[\s-]/g, '');
    const matchSearch = !cleanSearch ||
      b.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cleanPhone.includes(cleanSearch) ||
      (b.nationalId && b.nationalId.includes(cleanSearch));
    return matchClinic && matchSearch;
  });

  const handleProcessPayment = (bookingId: string, status: PaymentStatus, method: PaymentMethod) => {
    updatePaymentStatus(bookingId, status, method);
  };

  // التحقق من رمز QR أو كود التذكرة في ماسح الخزينة
  const handleVerifyScan = async (inputVal?: string) => {
    const code = (inputVal || scannedTicketInput).trim();
    if (!code) return;

    let targetCode = code;
    let targetBookingId = '';
    try {
      const parsed = JSON.parse(code);
      if (parsed.ticket) targetCode = String(parsed.ticket);
      if (parsed.id) targetBookingId = String(parsed.id);
    } catch {
      // ليس JSON
    }

    const cleanInputPhone = targetCode.replace(/[\s-]/g, '');

    let matched = bookings.find(b => 
      (targetBookingId && b.id === targetBookingId) ||
      b.ticketNumber.toLowerCase() === targetCode.toLowerCase() ||
      b.id === targetCode ||
      b.patientPhone.replace(/[\s-]/g, '') === cleanInputPhone
    );

    if (!matched && isSupabaseConfigured) {
      const remoteMatched = await verifyTicketForStaffRpc(targetBookingId || targetCode);
      if (remoteMatched) {
        matched = remoteMatched;
      }
    }

    if (matched) {
      setScannedBooking(matched);
      setScanNotFound(false);
      addToast({
        type: 'info',
        title: 'تم مسح التذكرة بنجاح',
        message: `المريض: ${matched.patientName} — ${matched.clinicName} (تذكرة ${matched.ticketNumber})`
      });
    } else {
      setScannedBooking(null);
      setScanNotFound(true);
      addToast({
        type: 'error',
        title: 'تذكرة غير موجودة',
        message: 'لم يتم العثور على تذكرة مطابقة بهذا الرمز أو رقم الهاتف.'
      });
    }
  };

  // معالجة الدفع السريع من داخل شاشة الماسح الضوئي
  const handleScanPayment = (status: PaymentStatus, method: PaymentMethod) => {
    if (!scannedBooking) return;
    const ok = updatePaymentStatus(scannedBooking.id, status, method);
    if (!ok) return;
    
    // تحديث فوري للحالة المعروضة في بطاقة التأكيد
    setScannedBooking({
      ...scannedBooking,
      paymentStatus: status,
      paymentMethod: method,
      paidAt: new Date().toISOString()
    });

    addToast({
      type: 'success',
      title: 'تم تأكيد السداد بنجاح',
      message: `تم إدراج المريض (${scannedBooking.patientName}) في طابور انتظار الاستقبال فورياً.`
    });
  };

  const handleResetScan = () => {
    setScannedBooking(null);
    setScannedTicketInput('');
    setScanNotFound(false);
  };

  const handlePrintReceipt = (booking: Booking) => {
    setSelectedReceiptBooking(booking);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // توليد رقم مرجعي صالح للمرضى الحضوريين الذين لا يحملون هاتفاً محمولاً
  const handleFillNoPhoneWalkIn = () => {
    const randomSuffix = Math.floor(10000000 + Math.random() * 90000000).toString();
    setWalkInPhone(`010${randomSuffix}`);
    setWalkInError('');
  };

  const handleResetWalkInForm = () => {
    setWalkInName('');
    setWalkInPhone('');
    setWalkInPaymentMode('cash');
    setWalkInError('');
    setWalkInCreatedBooking(null);
    if (activeClinicsWithDoctors.length > 0) {
      setWalkInClinicId(activeClinicsWithDoctors[0].clinic.id);
    }
  };

  const handleCreateWalkInBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalkInError('');

    const nameCheck = validateTripleName(walkInName);
    if (!nameCheck.valid) {
      setWalkInError(nameCheck.error || 'يرجى إدخال اسم المريض ثلاثياً على الأقل.');
      return;
    }

    const phoneCheck = validateEgyptianPhone(walkInPhone);
    if (!phoneCheck.valid) {
      setWalkInError(phoneCheck.error || 'يرجى إدخال رقم هاتف صحيح أو الضغط على زر "مريض بدون هاتف".');
      return;
    }

    const selectedPair = activeClinicsWithDoctors.find(item => item.clinic.id === walkInClinicId);
    if (!selectedPair || !selectedPair.assignedDoctor) {
      setWalkInError('يرجى اختيار عيادة مفتوحة ومتاحة اليوم.');
      return;
    }

    const avail = checkClinicAvailabilityStatus(
      selectedPair.clinic.id,
      selectedPair.assignedDoctor.id,
      todayStr
    );
    if (avail && !avail.allowed) {
      setWalkInError(avail.reason || 'العيادة المختارة غير متاحة لاستقبال حجوزات جديدة حالياً.');
      return;
    }

    setIsWalkInSubmitting(true);
    const res = await createBooking({
      patientName: walkInName,
      patientPhone: walkInPhone,
      clinicId: selectedPair.clinic.id,
      doctorId: selectedPair.assignedDoctor.id,
      date: todayStr,
      timeSlot: selectedPair.assignedDoctor.scheduleHours || selectedPair.clinic.workingHours || '9:00 ص - 5:00 م',
      fee: selectedPair.clinic.fee || 50,
      notes: 'حجز حضوري مباشر عن طريق الكاشير'
    });
    setIsWalkInSubmitting(false);

    if (!res.success || !res.booking) {
      setWalkInError(res.error || 'تعذر تسجيل الحجز حالياً.');
      return;
    }

    let finalBooking: Booking = res.booking;
    if (walkInPaymentMode !== 'unpaid' && canConfirmPayments) {
      const targetStatus: PaymentStatus = (walkInPaymentMode === 'charity_exempt' || walkInPaymentMode === 'consultation') ? 'exempt' : 'paid';
      const ok = updatePaymentStatus(res.booking.id, targetStatus, walkInPaymentMode);
      if (ok) {
        finalBooking = {
          ...res.booking,
          paymentStatus: targetStatus,
          paymentMethod: walkInPaymentMode,
          fee: walkInPaymentMode === 'consultation' ? 0 : res.booking.fee,
          paidAt: new Date().toISOString()
        };
        setActiveTab('paid');
      } else {
        setActiveTab('unpaid');
      }
    } else {
      setActiveTab('unpaid');
    }

    setWalkInCreatedBooking(finalBooking);
  };

  // توليد رابط وتطبيق رسالة واتساب لتأكيد الحجز للمريض
  const generateWhatsAppUrl = (b: Booking) => {
    // تنظيف رقم الهاتف المصري (01xxxxxxxxx -> 201xxxxxxxxx)
    let cleanPhone = b.patientPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '2' + cleanPhone;
    } else if (!cleanPhone.startsWith('2')) {
      cleanPhone = '20' + cleanPhone;
    }

    const message = `أهلاً بك أستاذ/ة ${b.patientName} في عيادات الجمعية الشرعية 🌿
تم تأكيد حجزك رسمياً بالخزينة:
📋 رقم التذكرة: ${b.ticketNumber}
🏥 العيادة: ${b.clinicName}
👨‍⚕️ الطبيب: ${b.doctorName}
📅 الموعد: ${b.date} (${b.timeSlot})
🔢 رقم دورك بالطابور: #${b.queuePosition}
💵 رسوم الكشف: ${b.paymentMethod === 'consultation' ? 'استشارة مجانية (٠ ج.م)' : b.paymentStatus === 'exempt' ? 'معفى خيري' : b.fee + ' ج.م'}

نسعد بخدمتكم في عيادات الجمعية الشرعية ونتمنى لكم دوام الصحة والعافية.`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* رأس شاشة الخزينة وشريط المؤشرات المالية الموحد */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-900 dark:bg-emerald-800 text-white flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                قسم الخزينة وتأكيد الحجوزات
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تأكيد السداد (نقدي / تأمين / إعفاء خيري)، الحجز الحضوري، وإرسال تأكيد الواتساب
              </p>
            </div>
          </div>

          {/* أزرار الإجراءات والتبديل */}
          <div className="flex flex-wrap items-center gap-2">
            {/* زر الاستعلام عن سجل المريض برقم الهاتف */}
            <button
              onClick={() => {
                setPatientHistoryPhone('');
                setPatientHistoryModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-3.5 py-2 rounded-lg font-bold text-xs border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              title="استعلام عن جميع حجوزات وكشوفات المريض السابقة برقم هاتفه"
            >
              <FileText className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>سجل المريض</span>
            </button>

            {/* زر مخصص لفحص وتسجيل الاستشارات المجانية بالاسم ورقم الهاتف */}
            <button
              onClick={() => {
                handleResetConsultationModal();
                setIsConsultationModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 bg-teal-700 hover:bg-teal-800 text-white px-3.5 py-2 rounded-lg font-bold text-xs border border-teal-600 shadow-2xs transition-colors cursor-pointer"
              title="فحص فوري بالاسم ورقم الهاتف لمعرفة العيادات المتاح للمريض فيها استشارة مجانية وتأكيد دخوله"
            >
              <Stethoscope className="w-4 h-4 text-teal-200" />
              <span>الاستشارات المجانية</span>
            </button>

            {/* زر حجز مباشر لمريض حضوري من عند الكاشير (بدون هاتف ذكي) */}
            <button
              onClick={() => {
                handleResetWalkInForm();
                setIsWalkInModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white px-3.5 py-2 rounded-lg font-bold text-xs border border-slate-800 dark:border-slate-700 transition-colors cursor-pointer"
              title="حجز تذكرة وتأكيد السداد لمريض حضر مباشرة بدون هاتف ذكي"
            >
              <UserPlus className="w-4 h-4" />
              <span>حجز لمريض حضوري (بدون هاتف)</span>
            </button>

            {/* زر مسح تذكرة المريض بالباركود / QR */}
            <button
              onClick={() => {
                setIsScannerOpen(true);
                handleResetScan();
              }}
              className="inline-flex items-center gap-1.5 bg-emerald-900 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>مسح تذكرة (QR)</span>
            </button>

            {/* التبديل بين الحجوزات التي تحتاج تأكيد والمؤكدة والتبويبات المفوضة */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold">
              <button
                onClick={() => setActiveTab('unpaid')}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  activeTab === 'unpaid'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                بانتظار التأكيد ({unpaidBookings.length})
              </button>
              <button
                onClick={() => setActiveTab('paid')}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  activeTab === 'paid'
                    ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                المؤكدة اليوم ({paidBookings.length})
              </button>
              {canViewFinancialReports && (
                <button
                  onClick={() => setActiveTab('financial-reports')}
                  className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                    activeTab === 'financial-reports'
                      ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>التقارير المالية</span>
                </button>
              )}
              {canManageClinicFees && (
                <button
                  onClick={() => setActiveTab('clinic-fees')}
                  className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                    activeTab === 'clinic-fees'
                      ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>أسعار الكشف</span>
                </button>
              )}
              {canManageDailyClinics && (
                <button
                  onClick={() => setActiveTab('daily-clinics')}
                  className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                    activeTab === 'daily-clinics'
                      ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>عيادات اليوم</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* شريط الإحصائيات المالية الموحد (Tabular Ledger) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200 dark:divide-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="p-4 sm:px-5 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">تحصيل نقدي بالخزينة</span>
            <span className="text-lg font-extrabold text-slate-900 dark:text-white font-mono">{cashRevenue} ج.م</span>
          </div>

          <div className="p-4 sm:px-5 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">حالات تأمين طبي</span>
            <span className="text-lg font-extrabold text-slate-900 dark:text-white font-mono">{insuranceCount}</span>
          </div>

          <div className="p-4 sm:px-5 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-teal-700 dark:text-teal-400">استشارات مجانية</span>
            <span className="text-lg font-extrabold text-teal-800 dark:text-teal-300 font-mono">{consultationCount}</span>
          </div>

          <div className="p-4 sm:px-5 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">إعفاءات تكافل خيري</span>
            <span className="text-lg font-extrabold text-slate-900 dark:text-white font-mono">{charityExemptCount}</span>
          </div>

          <div className="p-4 sm:px-5 flex items-baseline justify-between col-span-2 sm:col-span-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">إجمالي المؤكد بالطابور</span>
            <span className="text-lg font-extrabold text-emerald-800 dark:text-emerald-400 font-mono">{paidBookings.length}</span>
          </div>
        </div>
      </div>

      {/* تبويبات السجلات المالية (بانتظار التأكيد / المؤكدة اليوم) */}
      {(activeTab === 'unpaid' || activeTab === 'paid') && (
        <>
          {/* فلاتر البحث السريع في الخزينة */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم التذكرة أو اسم المريض أو الهاتف..."
                className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>

            <div className="sm:w-64">
              <select
                value={selectedClinic}
                onChange={(e) => setSelectedClinic(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
              >
                <option value="all">تصفية حسب جميع العيادات</option>
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* قائمة السجلات المالية وتأكيد الحجز */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>
                {activeTab === 'unpaid' 
                  ? 'حجوزات تنتظر تأكيد السداد والإدخال لطابور الاستقبال' 
                  : 'الحجوزات المعتمدة (تظهر حالياً في طابور الاستقبال مرتبة بوقت السداد)'}
                : ({filteredList.length})
              </span>
              <span className="text-[11px] text-slate-500">
                {activeTab === 'unpaid' ? 'المريض لا يظهر في الاستقبال إلا بعد تأكيد الخزينة' : 'محدث تلقائياً'}
              </span>
            </div>

            {filteredList.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                {activeTab === 'unpaid' 
                  ? 'لا توجد حجوزات تنتظر التأكيد حالياً، جميع الحالات مؤكدة.' 
                  : 'لا توجد تذاكر مسددة ومؤكدة حتى الآن اليوم.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredList.map(b => {
                  const consultationEligibility = b.paymentStatus === 'unpaid'
                    ? checkConsultationEligibility(b.patientPhone, b.clinicId)
                    : null;
                  return (
                  <div
                    key={b.id}
                    className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-750 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3.5 md:gap-4 text-xs"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-sm bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-800">
                          {b.ticketNumber}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{b.patientName}</h4>
                        <span className="text-slate-500 font-mono text-[11px]">
                          ({maskPhoneNumber(b.patientPhone)})
                        </span>
                        <span className="font-bold text-emerald-800 dark:text-emerald-300 sm:mr-2">
                          رسوم الكشف: {b.paymentMethod === 'consultation' ? '٠ ج.م (استشارة)' : `${b.fee} ج.م`}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.paymentStatus === 'paid'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : b.paymentMethod === 'consultation'
                            ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-300 dark:border-teal-700'
                            : b.paymentStatus === 'exempt'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {b.paymentStatus === 'paid' 
                            ? (b.paymentMethod === 'insurance' ? 'تأمين طبي' : 'مسدد نقداً') 
                            : b.paymentMethod === 'consultation'
                            ? 'استشارة مجانية ✓'
                            : b.paymentStatus === 'exempt' 
                            ? 'إعفاء خيري' 
                            : 'بانتظار التأكيد'}
                        </span>
                        {consultationEligibility?.eligible && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-teal-100 dark:bg-teal-950/90 text-teal-800 dark:text-teal-200 border border-teal-400 dark:border-teal-700 flex items-center gap-1 shadow-2xs">
                            <Stethoscope className="w-3 h-3 text-teal-700 dark:text-teal-300" />
                            <span>مستحق لاستشارة مجانية (كشف: {consultationEligibility.examDate} • متبقي {consultationEligibility.daysRemaining} يوم)</span>
                          </span>
                        )}
                      </div>

                      <div className="text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                        <span>العيادة: <strong>{b.clinicName}</strong></span>
                        <span>الطبيب: <strong>{b.doctorName}</strong></span>
                        <span>الموعد: {b.timeSlot}</span>
                        <span>الدور: #{b.queuePosition}</span>
                        {b.paidAt && (
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                            وقت اعتماد الخزينة: {new Date(b.paidAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* أزرار الإجراءات: طرق الدفع المعتمدة + رابط واتساب المباشر */}
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto pt-2.5 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800/80 md:self-center shrink-0">
                      
                      {/* زر رسالة واتساب لتأكيد الحجز مع علامة (تم الإرسال ✓) */}
                      <a
                        href={generateWhatsAppUrl(b)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => markWhatsAppSent(b.id)}
                        className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
                          whatsAppSentIds[b.id]
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                        title={whatsAppSentIds[b.id] ? 'تم إرسال رسالة واتساب مسبقاً — اضغط للإرسال مرة أخرى' : 'إرسال رسالة تأكيد الحجز للمريض عبر واتساب'}
                      >
                        {whatsAppSentIds[b.id] ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
                            <span>تم الإرسال ✓</span>
                          </>
                        ) : (
                          <>
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>واتساب</span>
                          </>
                        )}
                      </a>

                      {b.paymentStatus === 'unpaid' ? (
                        canConfirmPayments ? (
                          <>
                            {/* 1) دفع نقدي */}
                            <button
                              onClick={() => handleProcessPayment(b.id, 'paid', 'cash')}
                              className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <Coins className="w-3.5 h-3.5 text-amber-300" />
                              <span>دفع نقدي ({b.fee} ج.م)</span>
                            </button>

                            {/* 2) تأمين */}
                            <button
                              onClick={() => handleProcessPayment(b.id, 'paid', 'insurance')}
                              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                              title="تأمين طبي معتمد"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>تأمين</span>
                            </button>

                            {/* 3) استشارة مجانية (ذاتية المسح بعد الدخول) */}
                            <button
                              onClick={() => handleProcessPayment(b.id, 'exempt', 'consultation')}
                              className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all ${
                                consultationEligibility?.eligible
                                  ? 'bg-teal-600 hover:bg-teal-700 text-white ring-2 ring-teal-400/50 shadow-sm'
                                  : 'bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-600 text-teal-800 dark:text-teal-200 hover:text-white border border-teal-300 dark:border-teal-800'
                              }`}
                              title={
                                consultationEligibility?.eligible
                                  ? `المريض مستحق لاستشارة مجانية (كشف يوم ${consultationEligibility.examDate}) — سيتم مسح الختم تلقائياً فور الدخول`
                                  : 'دخول استشارة مجانية (٠ ج.م) — يتم مسح ختم الاستشارة تلقائياً فور الاستخدام'
                              }
                            >
                              <Stethoscope className="w-3.5 h-3.5" />
                              <span>{consultationEligibility?.eligible ? 'استشارة مجانية ✓ (٠ ج.م)' : 'استشارة (٠ ج.م)'}</span>
                            </button>

                            {/* 4) إعفاء خيري */}
                            <button
                              onClick={() => handleProcessPayment(b.id, 'exempt', 'charity_exempt')}
                              className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                              title="إعفاء بتصريح لجنة التكافل الخيري"
                            >
                              <HeartHandshake className="w-3.5 h-3.5" />
                              <span>إعفاء خيري</span>
                            </button>
                          </>
                        ) : (
                          <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-500 text-[11px] font-bold">
                            اعتماد السداد معطل بأمر الإدارة
                          </span>
                        )
                      ) : (
                        <button
                          onClick={() => handlePrintReceipt(b)}
                          className="px-3.5 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-emerald-600" />
                          <span>إيصال الخزينة</span>
                        </button>
                      )}

                      {/* زر حذف حجز المريض (في حال حجز المريض ولم يحضر) */}
                      {canDeleteBookings && (
                        <button
                          type="button"
                          onClick={() => setBookingPendingDeletion(b)}
                          className="px-3 py-2 bg-rose-50 hover:bg-rose-600 dark:bg-rose-950/60 dark:hover:bg-rose-600 text-rose-700 hover:text-white dark:text-rose-300 dark:hover:text-white border border-rose-200 dark:border-rose-800/80 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                          title="حذف حجز المريض نهائياً من الخزينة وقاعدة البيانات في حال عدم حضوره"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* التبويب 3: التقارير المالية وتصدير الإيرادات (مرتبط بصلاحية view_financial_reports) */}
      {activeTab === 'financial-reports' && canViewFinancialReports && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>التقارير المالية وحصيلة الخزينة اليومية</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                كشف تفصيلي بجميع عمليات التحصيل النقدي والتأمين والإعفاءات المعتمدة اليوم ({todayStr})
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                const rows = todayBookings.map(b => ({
                  'رقم التذكرة': sanitizeSpreadsheetCell(b.ticketNumber),
                  'اسم المريض': sanitizeSpreadsheetCell(b.patientName),
                  'العيادة': sanitizeSpreadsheetCell(b.clinicName),
                  'الطبيب': sanitizeSpreadsheetCell(b.doctorName),
                  'قيمة الكشف (ج.م)': b.paymentMethod === 'consultation' ? 0 : b.fee,
                  'حالة السداد': b.paymentStatus === 'paid' ? 'مسدد' : b.paymentMethod === 'consultation' ? 'استشارة مجانية' : b.paymentStatus === 'exempt' ? 'معفى خيري' : 'بانتظار السداد',
                  'طريقة الدفع': b.paymentMethod === 'cash' ? 'نقدي' : b.paymentMethod === 'insurance' ? 'تأمين طبي' : b.paymentMethod === 'consultation' ? 'استشارة مجانية' : b.paymentMethod === 'charity_exempt' ? 'إعفاء خيري' : '-'
                }));
                const ws = XLSX.utils.json_to_sheet(rows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'تقرير الخزينة');
                XLSX.writeFile(wb, `تقرير_الخزينة_${todayStr}.xlsx`);
              }}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>تصدير التقرير المالي (Excel)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <div className="text-xs text-slate-500">إجمالي التحصيل النقدي الفعلي</div>
              <div className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-300 font-mono mt-1">
                {cashRevenue} ج.م
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <div className="text-xs text-slate-500">عدد حالات التأمين الطبي</div>
              <div className="text-2xl font-extrabold text-blue-800 dark:text-blue-300 font-mono mt-1">
                {insuranceCount} حالة
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800">
              <div className="text-xs text-slate-500">عدد حالات الاستشارة المجانية</div>
              <div className="text-2xl font-extrabold text-teal-800 dark:text-teal-300 font-mono mt-1">
                {consultationCount} حالة
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <div className="text-xs text-slate-500">عدد حالات الإعفاء الخيري</div>
              <div className="text-2xl font-extrabold text-amber-800 dark:text-amber-300 font-mono mt-1">
                {charityExemptCount} حالة
              </div>
            </div>
          </div>

          {/* ملخص إيرادات كل عيادة اليوم */}
          <div className="border-t border-slate-100 dark:border-slate-700/60 pt-4">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3">
              توزيع الإيرادات والحالات حسب العيادة اليوم:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {clinics.map(c => {
                const cPaid = paidBookings.filter(b => b.clinicId === c.id);
                const cCash = cPaid.filter(b => b.paymentMethod === 'cash').reduce((s, b) => s + b.fee, 0);
                return (
                  <div key={c.id} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white">{c.name}</div>
                      <div className="text-[11px] text-slate-500">{cPaid.length} حالة مؤكدة</div>
                    </div>
                    <div className="font-mono font-extrabold text-sm text-emerald-700 dark:text-emerald-400">
                      {cCash} ج.م
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* التبويب 4 (مفوض بأمر الإدارة): تعديل أسعار ورسوم الكشف */}
      {activeTab === 'clinic-fees' && canManageClinicFees && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-emerald-600" />
              <span>إدارة أسعار ورسوم الكشف للعيادات (صلاحية مفوضة)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              تحديث قيمة تذكرة الكشف لكل عيادة تخصصية
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clinics.map(c => (
              <div key={c.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{c.name}</h4>
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 font-mono font-bold">
                    السعر الحالي: {c.fee} ج.م
                  </span>
                </div>

                {editingFeeClinicId === c.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      value={tempClinicFee}
                      onChange={(e) => setTempClinicFee(Number(e.target.value))}
                      className="w-20 px-2.5 py-1.5 rounded-lg border border-emerald-500 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-center"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        updateClinic(c.id, { fee: Math.max(0, tempClinicFee) });
                        setEditingFeeClinicId(null);
                      }}
                      className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      حفظ
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFeeClinicId(c.id);
                      setTempClinicFee(c.fee);
                    }}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-emerald-500 flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تعديل</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* التبويب 5 (مفوض بأمر الإدارة): إدارة جدول عيادات اليوم */}
      {activeTab === 'daily-clinics' && canManageDailyClinics && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-emerald-600" />
              <span>جدول تشغيل العيادات اليومي وتعيين الأطباء (صلاحية مفوضة)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              تحديد العيادات المفتوحة اليوم للمرضى وتعيين الطبيب المناوب لكل عيادة
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clinics.map(clinic => {
              const schedItem = dailySchedule.items.find(i => i.clinicId === clinic.id);
              const isOpen = schedItem ? schedItem.isOpen : (clinic.isOpenToday !== false && clinic.active !== false);
              const clinicDocs = doctors.filter(d => d.clinicId === clinic.id);
              const assignedDocId = schedItem?.doctorId || clinicDocs[0]?.id || '';

              const handleToggleOpen = () => {
                const existingItems = dailySchedule.items.length > 0
                  ? dailySchedule.items
                  : clinics.map(c => ({
                      clinicId: c.id,
                      isOpen: c.isOpenToday !== false && c.active !== false,
                      doctorId: doctors.find(d => d.clinicId === c.id)?.id || ''
                    }));
                const nextItems: DailyClinicScheduleItem[] = existingItems.some(i => i.clinicId === clinic.id)
                  ? existingItems.map(i => i.clinicId === clinic.id ? { ...i, isOpen: !isOpen } : i)
                  : [...existingItems, { clinicId: clinic.id, isOpen: !isOpen, doctorId: assignedDocId }];
                updateDailySchedule(nextItems);
              };

              const handleChangeDoc = (newDocId: string) => {
                const existingItems = dailySchedule.items.length > 0
                  ? dailySchedule.items
                  : clinics.map(c => ({
                      clinicId: c.id,
                      isOpen: c.isOpenToday !== false && c.active !== false,
                      doctorId: doctors.find(d => d.clinicId === c.id)?.id || ''
                    }));
                const nextItems: DailyClinicScheduleItem[] = existingItems.some(i => i.clinicId === clinic.id)
                  ? existingItems.map(i => i.clinicId === clinic.id ? { ...i, doctorId: newDocId } : i)
                  : [...existingItems, { clinicId: clinic.id, isOpen, doctorId: newDocId }];
                updateDailySchedule(nextItems);
              };

              return (
                <div
                  key={clinic.id}
                  className={`p-4 rounded-2xl border space-y-3 transition-all ${
                    isOpen
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/70'
                      : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{clinic.name}</h4>
                      <span className="text-[11px] text-slate-500">{clinic.room} • {clinic.floor}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleOpen}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                        isOpen
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {isOpen ? 'مفتوحة اليوم' : 'مغلقة اليوم'}
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      الطبيب المناوب اليوم:
                    </label>
                    <select
                      value={assignedDocId}
                      onChange={(e) => handleChangeDoc(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                    >
                      {clinicDocs.length > 0 ? (
                        clinicDocs.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))
                      ) : (
                        <option value="">لا يوجد طبيب مسجل</option>
                      )}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* نافذة الاستشارات المجانية المخصصة (فحص فوري بالاسم ورقم الهاتف وتأكيد الدخول) */}
      <AnimatePresence>
        {isConsultationModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-3xl border border-teal-200 dark:border-teal-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* رأس النافذة */}
              <div className="p-4 sm:p-5 border-b border-teal-100 dark:border-slate-700 flex items-center justify-between bg-teal-50/80 dark:bg-slate-850">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      بوابة فحص وتأكيد الاستشارات المجانية
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      اكتب اسم المريض ورقم تليفونه ليظهر لك فوراً العيادات المتاح له فيها استشارة مجانية
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsConsultationModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                {!consultCreatedBooking ? (
                  <div className="space-y-4">
                    {consultError && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>{consultError}</span>
                      </div>
                    )}

                    {/* حقلا إدخال اسم المريض ورقم الهاتف */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                          1. اسم المريض:
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={consultPatientName}
                            onChange={(e) => {
                              setConsultPatientName(e.target.value);
                              setConsultError('');
                            }}
                            placeholder={detectedPatientNameFromPhone || 'اكتب اسم المريض ثلاثياً...'}
                            className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                          />
                          <User className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                        </div>
                        {detectedPatientNameFromPhone && !consultPatientName && (
                          <button
                            type="button"
                            onClick={() => setConsultPatientName(detectedPatientNameFromPhone)}
                            className="text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:underline cursor-pointer"
                          >
                            الاسم المسجل لهذا الرقم: {detectedPatientNameFromPhone} (اضغط للتعبئة)
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                          2. رقم تليفون المريض:
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            dir="ltr"
                            autoFocus
                            value={consultPatientPhone}
                            onChange={(e) => {
                              const val = e.target.value;
                              setConsultPatientPhone(val);
                              setConsultError('');
                              const clean = val.replace(/\D/g, '');
                              if (clean.length >= 10 && !consultPatientName.trim()) {
                                const foundName =
                                  consultationRegistry.stamps.find(s => s.phone === clean && s.patientName)?.patientName ||
                                  bookings.find(b => b.patientPhone.replace(/\D/g, '') === clean)?.patientName;
                                if (foundName) setConsultPatientName(foundName);
                              }
                            }}
                            placeholder="010xxxxxxxx"
                            className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-right text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                          />
                          <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                        </div>
                      </div>
                    </div>

                    {/* اقتراحات سريعة إذا بحث الكاشير بالاسم أولاً */}
                    {cleanConsultPhone.length < 10 && matchingPatientsByName.length > 0 && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          مرضى مطابقون للاسم المكتوب (اضغط لاختيار المريض وفحص استشاراته):
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {matchingPatientsByName.map(p => (
                            <button
                              key={p.phone}
                              type="button"
                              onClick={() => {
                                setConsultPatientName(p.name);
                                setConsultPatientPhone(p.phone);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-teal-300 dark:border-teal-700 hover:bg-teal-50 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <span>{p.name}</span>
                              <span className="font-mono text-teal-700 dark:text-teal-300">({p.phone})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* نتيجة الفحص الفوري للعيادات المتاح للمريض فيها استشارة */}
                    {!effectiveLookupPhone ? (
                      <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                        <Stethoscope className="w-8 h-8 text-teal-600/60 mx-auto" />
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          اكتب رقم هاتف المريض (أو اسمه) في الأعلى
                        </div>
                        <p className="text-[11px] text-slate-500">
                          سيقوم النظام فوراً بعرض جميع العيادات التي للمريض فيها استشارة مجانية سارية مع عدد الأيام المتبقية.
                        </p>
                      </div>
                    ) : eligibleConsultationClinics.length > 0 ? (
                      <div className="p-4 rounded-2xl bg-teal-50/90 dark:bg-teal-950/60 border-2 border-teal-500/70 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-teal-950 dark:text-teal-100 font-extrabold text-xs sm:text-sm">
                            <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
                            <span>
                              هذا المريض له استشارة مجانية سارية في ({eligibleConsultationClinics.length}) عيادة:
                            </span>
                          </div>
                          <span className="text-[11px] font-mono font-bold text-teal-800 dark:text-teal-300">
                            {effectiveLookupPhone}
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          {eligibleConsultationClinics.map(item => (
                            <div
                              key={item.clinic.id}
                              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                                    {item.clinic.name}
                                  </span>
                                  <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300">
                                    • متبقي {item.daysRemaining} يوم
                                  </span>
                                </div>
                                <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                                  <span>تاريخ الكشف السابق: <strong>{item.examDate}</strong></span>
                                  {item.assignedDoctor && (
                                    <span>الطبيب: <strong>{item.assignedDoctor.name}</strong></span>
                                  )}
                                </div>
                                {item.existingUnpaidToday && (
                                  <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                                    لديه تذكرة محجوزة اليوم ({item.existingUnpaidToday.ticketNumber}) بانتظار التأكيد
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                disabled={isConsultSubmitting}
                                onClick={() => handleActivateClinicConsultation(item.clinic.id)}
                                className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer"
                              >
                                <Stethoscope className="w-4 h-4" />
                                <span>
                                  {item.existingUnpaidToday
                                    ? 'تأكيد تذكرته كاستشارة (٠ ج.م)'
                                    : 'دخول استشارة وإصدار تذكرة (٠ ج.م)'}
                                </span>
                              </button>
                            </div>
                          ))}
                        </div>

                        <p className="text-[11px] text-teal-800 dark:text-teal-300 font-medium">
                          * بمجرد الضغط على زر دخول الاستشارة، يُدرج المريض في طابور الاستقبال مجاناً (٠ ج.م) ويُمسح ختم الاستشارة لهذه العيادة تلقائياً.
                        </p>
                      </div>
                    ) : (
                      <div className="p-5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center space-y-2">
                        <AlertTriangle className="w-7 h-7 text-amber-600 mx-auto" />
                        <div className="text-xs sm:text-sm font-extrabold text-amber-950 dark:text-amber-200">
                          لا توجد استشارة مجانية سارية لهذا الرقم ({effectiveLookupPhone}) في أي عيادة حالياً
                        </div>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300">
                          إما أن المريض لم يسبق له الكشف خلال فترة الاستشارة المحددة ({consultationRegistry.windowDays} يوم)، أو أنه دخل الاستشارة المجانية بالفعل وتم مسحها تلقائياً.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* بطاقة نجاح تفعيل وإصدار تذكرة الاستشارة المجانية */
                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-800 text-center space-y-2">
                      <CheckCircle2 className="w-10 h-10 text-teal-600 mx-auto" />
                      <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                        تم تسجيل الاستشارة المجانية للمريض ({consultCreatedBooking.patientName}) بنجاح!
                      </h4>
                      <p className="text-xs text-teal-800 dark:text-teal-300">
                        تم إدراج المريض فوراً في طابور انتظار ({consultCreatedBooking.clinicName}) بقيمة ٠ ج.م، وتم مسح ختم الاستشارة تلقائياً.
                      </p>

                      <div className="inline-flex items-center gap-4 bg-white dark:bg-slate-900 px-6 py-3 rounded-2xl border-2 border-teal-600 mt-2">
                        <div>
                          <div className="text-[10px] text-slate-500 font-bold">رقم التذكرة</div>
                          <div className="text-xl font-black font-mono text-teal-700 dark:text-teal-400">
                            {consultCreatedBooking.ticketNumber}
                          </div>
                        </div>
                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                        <div>
                          <div className="text-[10px] text-slate-500 font-bold">رقم الدور بالطابور</div>
                          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                            #{consultCreatedBooking.queuePosition}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handlePrintReceipt(consultCreatedBooking)}
                        className="py-2.5 px-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        <span>طباعة إيصال الاستشارة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTicket(consultCreatedBooking);
                          setIsConsultationModalOpen(false);
                          navigate('ticket', consultCreatedBooking.id);
                        }}
                        className="py-2.5 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <QrCode className="w-4 h-4 text-teal-600" />
                        <span>عرض بطاقة التذكرة</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleResetConsultationModal}
                        className="py-2.5 px-3 bg-teal-100 dark:bg-teal-950/80 hover:bg-teal-200 text-teal-900 dark:text-teal-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>فحص مريض آخر</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* نافذة حجز وتحصيل فوري لمريض حضوري عند الكاشير (بدون هاتف ذكي) */}
      <AnimatePresence>
        {isWalkInModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* رأس النافذة */}
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-amber-50/70 dark:bg-slate-850">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      حجز وتحصيل فوري لمريض حضوري (من شباك الخزينة)
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      مخصص للمرضى الحاضرين بدون هاتف ذكي لإصدار التذكرة وإدراجهم في طابور الاستقبال فوراً
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsWalkInModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                {!walkInCreatedBooking ? (
                  <form onSubmit={handleCreateWalkInBooking} className="space-y-4">
                    {walkInError && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>{walkInError}</span>
                      </div>
                    )}

                    {/* اختيار العيادة المتاحة اليوم */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        1. اختر العيادة التخصصية المتاحة اليوم:
                      </label>
                      {activeClinicsWithDoctors.length === 0 ? (
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
                          لا توجد عيادات مفتوحة ومتاحة للحجز حالياً.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {activeClinicsWithDoctors.map(({ clinic, assignedDoctor }) => {
                            const isSelected = clinic.id === walkInClinicId;
                            return (
                              <button
                                type="button"
                                key={clinic.id}
                                onClick={() => setWalkInClinicId(clinic.id)}
                                className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                                  isSelected
                                    ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/60 ring-2 ring-emerald-500/20'
                                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-bold text-xs text-slate-900 dark:text-white">{clinic.name}</span>
                                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{clinic.fee} ج.م</span>
                                </div>
                                {assignedDoctor && (
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                                    <Stethoscope className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>{assignedDoctor.name}</span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* اسم المريض الثلاثي */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        2. اسم المريض (ثلاثي على الأقل):
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={walkInName}
                          onChange={(e) => {
                            setWalkInName(e.target.value);
                            setWalkInError('');
                          }}
                          placeholder="مثال: محمود عبد الرحمن السيد"
                          className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
                        />
                        <User className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                      </div>
                    </div>

                    {/* رقم الهاتف أو زر (مريض بدون هاتف) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                          3. رقم هاتف المريض (أو اضغط "ليس لديه هاتف"):
                        </label>
                        <button
                          type="button"
                          onClick={handleFillNoPhoneWalkIn}
                          className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-800 transition-colors cursor-pointer"
                        >
                          + ليس لديه هاتف (توليد رقم مرجعي)
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="tel"
                          dir="ltr"
                          value={walkInPhone}
                          onChange={(e) => {
                            setWalkInPhone(e.target.value);
                            setWalkInError('');
                          }}
                          placeholder="010xxxxxxxx"
                          className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-right text-slate-900 dark:text-white"
                        />
                        <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                      </div>
                    </div>

                    {/* اختيار طريقة التحصيل والتفعيل الفوري */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        4. طريقة السداد وتفعيل الدور في الاستقبال:
                      </label>
                      {(() => {
                        const walkInElig = (walkInPhone && walkInClinicId)
                          ? checkConsultationEligibility(walkInPhone, walkInClinicId)
                          : null;
                        return (
                          <>
                            {walkInElig?.eligible && (
                              <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/70 border border-teal-300 dark:border-teal-700 text-teal-900 dark:text-teal-200 text-xs flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-1.5 font-bold">
                                  <Stethoscope className="w-4 h-4 text-teal-600 shrink-0" />
                                  <span>هذا المريض له استشارة مجانية متاحة في هذه العيادة (كشف يوم {walkInElig.examDate} • متبقي {walkInElig.daysRemaining} يوم)</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setWalkInPaymentMode('consultation')}
                                  className="px-2.5 py-1 rounded-lg bg-teal-600 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                                >
                                  اختيار استشارة
                                </button>
                              </div>
                            )}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                              <button
                                type="button"
                                onClick={() => setWalkInPaymentMode('cash')}
                                className={`p-2.5 rounded-xl border font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                                  walkInPaymentMode === 'cash'
                                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <Coins className="w-4 h-4" />
                                <span>دفع نقدي فوري</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setWalkInPaymentMode('insurance')}
                                className={`p-2.5 rounded-xl border font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                                  walkInPaymentMode === 'insurance'
                                    ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <ShieldCheck className="w-4 h-4" />
                                <span>تأمين طبي</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setWalkInPaymentMode('consultation')}
                                className={`p-2.5 rounded-xl border font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                                  walkInPaymentMode === 'consultation'
                                    ? 'border-teal-600 bg-teal-600 text-white shadow-xs'
                                    : walkInElig?.eligible
                                    ? 'border-teal-400 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 ring-2 ring-teal-400/40'
                                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <Stethoscope className="w-4 h-4" />
                                <span>{walkInElig?.eligible ? 'استشارة مجانية ✓' : 'استشارة (٠ ج.م)'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setWalkInPaymentMode('charity_exempt')}
                                className={`p-2.5 rounded-xl border font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                                  walkInPaymentMode === 'charity_exempt'
                                    ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <HeartHandshake className="w-4 h-4" />
                                <span>إعفاء خيري</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setWalkInPaymentMode('unpaid')}
                                className={`p-2.5 rounded-xl border font-bold flex flex-col items-center gap-1 cursor-pointer transition-all col-span-2 sm:col-span-1 ${
                                  walkInPaymentMode === 'unpaid'
                                    ? 'border-slate-700 bg-slate-800 text-white shadow-xs'
                                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <Clock className="w-4 h-4" />
                                <span>حجز فقط (بدون دفع)</span>
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={isWalkInSubmitting || activeClinicsWithDoctors.length === 0}
                        className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {isWalkInSubmitting
                            ? 'جاري إصدار التذكرة وتأكيد الحجز...'
                            : walkInPaymentMode === 'unpaid'
                            ? 'إصدار التذكرة الآن'
                            : 'إصدار التذكرة وتأكيد السداد وإدخال المريض للطابور'}
                        </span>
                      </button>
                    </div>
                  </form>
                ) : (
                  /* بطاقة نجاح إصدار تذكرة المريض الحضوري */
                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                      <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                      <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                        تم إصدار التذكرة للمريض ({walkInCreatedBooking.patientName}) بنجاح!
                      </h4>
                      <p className="text-xs text-emerald-800 dark:text-emerald-300">
                        {walkInCreatedBooking.paymentStatus === 'unpaid'
                          ? 'التذكرة مسجلة الآن في قائمة بانتظار السداد.'
                          : `تم تأكيد السداد وإدراج المريض فوراً في طابور انتظار (${walkInCreatedBooking.clinicName}).`}
                      </p>

                      <div className="inline-flex items-center gap-4 bg-white dark:bg-slate-900 px-6 py-3 rounded-2xl border-2 border-emerald-600 mt-2">
                        <div>
                          <div className="text-[10px] text-slate-500 font-bold">رقم التذكرة</div>
                          <div className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-400">
                            {walkInCreatedBooking.ticketNumber}
                          </div>
                        </div>
                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                        <div>
                          <div className="text-[10px] text-slate-500 font-bold">رقم الدور بالطابور</div>
                          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                            #{walkInCreatedBooking.queuePosition}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handlePrintReceipt(walkInCreatedBooking)}
                        className="py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        <span>طباعة إيصال وتذكرة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTicket(walkInCreatedBooking);
                          setIsWalkInModalOpen(false);
                          navigate('ticket', walkInCreatedBooking.id);
                        }}
                        className="py-2.5 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <QrCode className="w-4 h-4 text-emerald-600" />
                        <span>عرض بطاقة التذكرة</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleResetWalkInForm}
                        className="py-2.5 px-3 bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200 text-amber-900 dark:text-amber-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>حجز لمريض آخر</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* نافذة قارئ الباركود ومسح تذاكر الخزينة وتأكيد الدفع الفوري */}
      <AnimatePresence>
        {isScannerOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* رأس النافذة */}
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      قارئ تذاكر الخزينة وتأكيد السداد المباشر
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      مسح ضوئي سريع لتأكيد دفع المريض (نقدي / تأمين / إعفاء خيري)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsScannerOpen(false);
                    handleResetScan();
                  }}
                  className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                {/* إذا لم يتم مسح تذكرة بعد: نعرض شاشة الكاميرا وحقل الإدخال */}
                {!scannedBooking ? (
                  <div className="space-y-4">
                    {/* محاكاة واجهة الكاميرا مع خط ليزر متحرك */}
                    <div className="bg-slate-900 rounded-2xl p-6 text-center text-white border-2 border-dashed border-emerald-500/60 relative overflow-hidden">
                      <div className="w-32 h-32 mx-auto border-2 border-emerald-400 rounded-2xl flex items-center justify-center relative">
                        <div className="absolute inset-x-0 top-0 h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399] animate-bounce" />
                        <Camera className="w-12 h-12 text-emerald-400/60 animate-pulse" />
                      </div>
                      <div className="text-xs text-emerald-200 mt-4 font-medium">
                        وجّه كاميرا الجهاز أو قارئ الباركود نحو رمز QR بتذكرة المريض
                      </div>
                    </div>

                    {/* إدخال كود التذكرة أو رقم هاتف المريض يدوياً */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        أو اكتب كود التذكرة / رقم الهاتف يدوياً:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          autoFocus
                          value={scannedTicketInput}
                          onChange={(e) => {
                            setScannedTicketInput(e.target.value);
                            setScanNotFound(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleVerifyScan();
                          }}
                          placeholder="مثال: باطنة-01 أو أطفال-02 أو 01012345678..."
                          className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                        />
                        <button
                          onClick={() => handleVerifyScan()}
                          className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
                        >
                          تحقق ومسح
                        </button>
                      </div>

                      {scanNotFound && (
                        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>لم يتم العثور على أي حجز مطابق. تأكد من صحة رقم التذكرة أو الهاتف.</span>
                        </div>
                      )}
                    </div>

                    {/* أزرار سريعة لتذاكر تنتظر السداد الآن */}
                    {unpaidBookings.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          حجوزات تنتظر السداد بالخزينة (انقر للاختبار السريع):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {unpaidBookings.slice(0, 5).map(b => (
                            <button
                              key={b.id}
                              onClick={() => {
                                setScannedTicketInput(b.ticketNumber);
                                handleVerifyScan(b.ticketNumber);
                              }}
                              className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                            >
                              {b.ticketNumber} - {b.patientName.split(' ')[0]} ({b.fee} ج.م)
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* شاشة تأكيد دفع المريض الممسوح مباشرة (Direct Payment Confirmation Screen) */
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    {/* بطاقة تفاصيل المريض والتذكرة */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sm bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-3 py-1 rounded-xl border border-emerald-300 dark:border-emerald-800">
                          تذكرة #{scannedBooking.ticketNumber}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          scannedBooking.paymentStatus === 'paid'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : scannedBooking.paymentStatus === 'exempt'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 animate-pulse'
                        }`}>
                          {scannedBooking.paymentStatus === 'paid'
                            ? (scannedBooking.paymentMethod === 'insurance' ? 'تأمين طبي معتمد' : 'مسدد نقداً')
                            : scannedBooking.paymentStatus === 'exempt'
                            ? 'إعفاء خيري'
                            : 'بانتظار السداد'}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">
                          {scannedBooking.patientName}
                        </h4>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          رقم الهاتف: {maskPhoneNumber(scannedBooking.patientPhone)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div>العيادة: <strong className="text-slate-900 dark:text-white">{scannedBooking.clinicName}</strong></div>
                        <div>الطبيب: <strong className="text-slate-900 dark:text-white">{scannedBooking.doctorName}</strong></div>
                        <div>الموعد: <strong className="text-slate-900 dark:text-white">{scannedBooking.timeSlot}</strong></div>
                        <div>الدور بالطابور: <strong className="text-slate-900 dark:text-white">#{scannedBooking.queuePosition}</strong></div>
                      </div>
                    </div>

                    {/* المربع البارز لقيمة الكشف والمبلغ المطلوب */}
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-center space-y-1">
                      <div className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                        المبلغ المطلوب سداده بالخزينة:
                      </div>
                      <div className="text-3xl font-black text-emerald-900 dark:text-emerald-100 font-mono">
                        {scannedBooking.fee} <span className="text-base font-normal">جنيه مصري</span>
                      </div>
                    </div>

                    {/* أزرار اعتماد السداد الفوري أو عرض حالة الدفع إذا كان مسدداً */}
                    {scannedBooking.paymentStatus === 'unpaid' ? (
                      <div className="space-y-2">
                        {(() => {
                          const scanElig = checkConsultationEligibility(scannedBooking.patientPhone, scannedBooking.clinicId);
                          return scanElig.eligible ? (
                            <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-300 dark:border-teal-700 text-teal-900 dark:text-teal-200 text-xs font-bold flex items-center gap-2">
                              <Stethoscope className="w-4 h-4 text-teal-600 shrink-0" />
                              <span>مستحق لاستشارة مجانية (كشف سابق يوم {scanElig.examDate} • متبقي {scanElig.daysRemaining} يوم) — يُمسح الختم تلقائياً بعد الدخول.</span>
                            </div>
                          ) : null;
                        })()}
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          اختر طريقة السداد لتسجيل الدفع وإدراج المريض فوراً في طابور انتظار الاستقبال:
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {/* دفع نقدي */}
                          <button
                            onClick={() => handleScanPayment('paid', 'cash')}
                            className="p-3 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                          >
                            <Coins className="w-5 h-5 text-amber-300" />
                            <span>دفع نقدي</span>
                            <span className="text-[10px] opacity-90">({scannedBooking.fee} ج.م)</span>
                          </button>

                          {/* تأمين طبي */}
                          <button
                            onClick={() => handleScanPayment('paid', 'insurance')}
                            className="p-3 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                          >
                            <ShieldCheck className="w-5 h-5 text-blue-200" />
                            <span>تأمين طبي</span>
                            <span className="text-[10px] opacity-90">خصم جهات / نقابات</span>
                          </button>

                          {/* استشارة مجانية */}
                          <button
                            onClick={() => handleScanPayment('exempt', 'consultation')}
                            className="p-3 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                          >
                            <Stethoscope className="w-5 h-5 text-teal-200" />
                            <span>استشارة مجانية</span>
                            <span className="text-[10px] opacity-90">٠ ج.م (مسح تلقائي للختم)</span>
                          </button>

                          {/* إعفاء خيري */}
                          <button
                            onClick={() => handleScanPayment('exempt', 'charity_exempt')}
                            className="p-3 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                          >
                            <HeartHandshake className="w-5 h-5 text-amber-200" />
                            <span>إعفاء خيري</span>
                            <span className="text-[10px] opacity-90">تكافل الجمعية الشرعية</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* التذكرة مسددة أو تم سدادها للتو */
                      <div className="p-4 rounded-2xl bg-emerald-100/70 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 space-y-3">
                        <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div>
                            <div className="font-bold text-xs">
                              تم تأكيد السداد بنجاح — المريض مدرج الآن في طابور انتظار عيادة {scannedBooking.clinicName}!
                            </div>
                            <div className="text-[11px] text-emerald-800 dark:text-emerald-300">
                              طريقة السداد: {scannedBooking.paymentMethod === 'insurance' ? 'تأمين طبي' : scannedBooking.paymentMethod === 'consultation' ? 'استشارة مجانية (٠ ج.م)' : scannedBooking.paymentStatus === 'exempt' ? 'إعفاء خيري' : 'دفع نقدي'}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <a
                            href={generateWhatsAppUrl(scannedBooking)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>إرسال تأكيد واتساب</span>
                          </a>

                          <button
                            onClick={() => handlePrintReceipt(scannedBooking)}
                            className="py-2 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-300 dark:border-slate-700 transition-all cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-600" />
                            <span>طباعة إيصال</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* زر مسح تذكرة أخرى أو حذف التذكرة */}
                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleResetScan}
                        className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>مسح تذكرة مريض آخر</span>
                      </button>

                      {canDeleteBookings && (
                        <button
                          type="button"
                          onClick={() => setBookingPendingDeletion(scannedBooking)}
                          className="py-2.5 px-4 bg-rose-50 hover:bg-rose-600 dark:bg-rose-950/60 dark:hover:bg-rose-600 text-rose-700 hover:text-white dark:text-rose-300 dark:hover:text-white border border-rose-200 dark:border-rose-800/80 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          title="حذف هذا الحجز نهائياً من قاعدة البيانات"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>حذف الحجز</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* نافذة تأكيد حذف حجز المريض نهائياً من الخزينة وقاعدة البيانات */}
      <AnimatePresence>
        {bookingPendingDeletion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-800/80 shadow-2xl max-w-md w-full max-h-[92dvh] overflow-y-auto my-auto"
            >
              <div className="bg-gradient-to-l from-rose-700 to-red-600 p-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center border border-white/25">
                    <Trash2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">تأكيد حذف حجز المريض</h3>
                    <p className="text-xs text-rose-100">حذف نهائي من الخزينة والطابور وقاعدة البيانات</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isDeletingBooking}
                  onClick={() => setBookingPendingDeletion(null)}
                  className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">رقم التذكرة:</span>
                    <span className="font-mono font-bold text-sm px-2.5 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">
                      {bookingPendingDeletion.ticketNumber}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">اسم المريض:</span>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {bookingPendingDeletion.patientName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">العيادة والطبيب:</span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {bookingPendingDeletion.clinicName} • {bookingPendingDeletion.doctorName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">حالة السداد الحالية:</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {bookingPendingDeletion.paymentStatus === 'unpaid'
                        ? `بانتظار السداد (${bookingPendingDeletion.fee} ج.م)`
                        : bookingPendingDeletion.paymentStatus === 'exempt'
                          ? 'إعفاء خيري'
                          : `مسدد (${bookingPendingDeletion.fee} ج.م)`}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    هل أنت متأكد من حذف هذا الحجز بسبب عدم حضور المريض؟ سيتم إزالة المريض فوراً من شاشة الخزينة، طابور الاستقبال، وقاعدة البيانات السحابية.
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isDeletingBooking}
                    onClick={handleConfirmDeleteBooking}
                    className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    {isDeletingBooking ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري الحذف من قاعدة البيانات...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>نعم، احذف الحجز نهائياً</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isDeletingBooking}
                    onClick={() => setBookingPendingDeletion(null)}
                    className="py-3 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    تراجع
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* قالب إيصال السداد للطباعة */}
      {selectedReceiptBooking && (
        <div className="hidden print:block p-8 border-2 border-black max-w-md mx-auto text-black font-sans">
          <div className="text-center pb-4 border-b-2 border-black">
            <h2 className="text-xl font-bold">عيادات الجمعية الشرعية التخصصية</h2>
            <p className="text-sm">إيصال سداد وتأكيد حجز معتمد من الخزينة</p>
          </div>
          <div className="py-4 space-y-2 text-sm">
            <div>رقم التذكرة: <strong>{selectedReceiptBooking.ticketNumber}</strong></div>
            <div>اسم المريض: <strong>{selectedReceiptBooking.patientName}</strong></div>
            <div>العيادة: <strong>{selectedReceiptBooking.clinicName}</strong></div>
            <div>الطبيب: <strong>{selectedReceiptBooking.doctorName}</strong></div>
            <div>المبلغ المسدد: <strong>{selectedReceiptBooking.paymentMethod === 'consultation' ? '0 ج.م (استشارة مجانية)' : selectedReceiptBooking.paymentStatus === 'exempt' ? '0 (إعفاء خيري)' : `${selectedReceiptBooking.fee} ج.م`}</strong></div>
            <div>طريقة الدفع: <strong>{selectedReceiptBooking.paymentMethod === 'cash' ? 'دفع نقدي' : selectedReceiptBooking.paymentMethod === 'insurance' ? 'تأمين طبي' : selectedReceiptBooking.paymentMethod === 'consultation' ? 'استشارة مجانية' : 'إعفاء خيري'}</strong></div>
            <div>تاريخ السداد: {new Date().toLocaleDateString('ar-EG')} - {new Date().toLocaleTimeString('ar-EG')}</div>
          </div>
          <div className="text-center pt-4 border-t-2 border-black text-xs">
            نتمنى لكم تمام الشفاء والعافية • عيادات الجمعية الشرعية
          </div>
        </div>
      )}

    </div>
  );
};
