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
  Stethoscope
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { maskPhoneNumber, validateTripleName, validateEgyptianPhone } from '../services/storage';
import { getLocalDateStr } from '../services/scheduleService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { fetchSettingsFromDb, markWhatsAppSentInDb, verifyTicketForStaffRpc } from '../services/supabaseService';
import { PaymentStatus, PaymentMethod, Booking } from '../types';

export const CashierView: React.FC = () => {
  const {
    bookings,
    updatePaymentStatus,
    clinics,
    addToast,
    setPatientHistoryModalOpen,
    setPatientHistoryPhone,
    createBooking,
    getActiveClinicsForBooking,
    checkClinicAvailabilityStatus,
    navigate,
    setSelectedTicket
  } = useApp();
  const [activeTab, setActiveTab] = useState<'unpaid' | 'paid'>('unpaid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClinic, setSelectedClinic] = useState<string>('all');
  const [selectedReceiptBooking, setSelectedReceiptBooking] = useState<Booking | null>(null);

  // حالة نافذة الحجز المباشر لمريض حضوري عند الكاشير (بدون هاتف ذكي)
  const activeClinicsWithDoctors = getActiveClinicsForBooking();
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [walkInClinicId, setWalkInClinicId] = useState<string>(activeClinicsWithDoctors[0]?.clinic.id || '');
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInPaymentMode, setWalkInPaymentMode] = useState<'cash' | 'insurance' | 'charity_exempt' | 'unpaid'>('cash');
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
  const charityExemptCount = paidBookings.filter(b => b.paymentStatus === 'exempt').length;

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
    updatePaymentStatus(scannedBooking.id, status, method);
    
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
      timeSlot: 'حجز حضوري بالخزينة',
      fee: selectedPair.clinic.fee || 50,
      notes: 'حجز حضوري مباشر عن طريق الكاشير'
    });
    setIsWalkInSubmitting(false);

    if (!res.success || !res.booking) {
      setWalkInError(res.error || 'تعذر تسجيل الحجز حالياً.');
      return;
    }

    let finalBooking: Booking = res.booking;
    if (walkInPaymentMode !== 'unpaid') {
      const targetStatus: PaymentStatus = walkInPaymentMode === 'charity_exempt' ? 'exempt' : 'paid';
      updatePaymentStatus(res.booking.id, targetStatus, walkInPaymentMode);
      finalBooking = {
        ...res.booking,
        paymentStatus: targetStatus,
        paymentMethod: walkInPaymentMode,
        paidAt: new Date().toISOString()
      };
      setActiveTab('paid');
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
💵 رسوم الكشف: ${b.paymentStatus === 'exempt' ? 'معفى خيري' : b.fee + ' ج.م'}

نسعد بخدمتكم في عيادات الجمعية الشرعية ونتمنى لكم دوام الصحة والعافية.`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* رأس شاشة الخزينة والتحصيل */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              منصة الخزينة والتحصيل وتأكيد الحجوزات
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            تأكيد الحجز عبر السداد النقدي، التأمين الطبي، أو الإعفاء الخيري، مع إرسال رسالة تأكيد الواتساب للمريض
          </p>
        </div>

        {/* أزرار الإجراءات والتبديل */}
        <div className="flex flex-wrap items-center gap-2">
          {/* زر الاستعلام عن سجل المريض برقم الهاتف */}
          <button
            onClick={() => {
              setPatientHistoryPhone('');
              setPatientHistoryModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-3.5 py-2.5 rounded-xl font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all shadow-2xs cursor-pointer"
            title="استعلام عن جميع حجوزات وكشوفات المريض السابقة برقم هاتفه"
          >
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>سجل المريض</span>
          </button>

          {/* زر حجز مباشر لمريض حضوري من عند الكاشير (بدون هاتف ذكي) */}
          <button
            onClick={() => {
              handleResetWalkInForm();
              setIsWalkInModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 px-3.5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
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
            className="inline-flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-amber-300" />
            <span>مسح تذكرة (QR)</span>
          </button>

          {/* التبديل بين الحجوزات التي تحتاج تأكيد والمؤكدة */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
            <button
              onClick={() => setActiveTab('unpaid')}
              className={`px-3 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'unpaid'
                  ? 'bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              بانتظار التأكيد ({unpaidBookings.length})
            </button>
            <button
              onClick={() => setActiveTab('paid')}
              className={`px-3 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'paid'
                  ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              المؤكدة اليوم ({paidBookings.length})
            </button>
          </div>
        </div>
      </div>

      {/* بطاقات ملخص الخزينة */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="text-slate-500 text-xs flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-emerald-600" />
            <span>تحصيل نقدي بالخزينة</span>
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">
            {cashRevenue} ج.م
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="text-slate-500 text-xs flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>حالات تأمين طبي</span>
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-mono">
            {insuranceCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="text-slate-500 text-xs flex items-center gap-1.5">
            <HeartHandshake className="w-4 h-4 text-amber-600" />
            <span>إعفاءات تكافل خيري</span>
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
            {charityExemptCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="text-slate-500 text-xs flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
            <span>إجمالي المؤكد بالطابور</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
            {paidBookings.length}
          </div>
        </div>
      </div>

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

        <button
          onClick={() => {
            setIsScannerOpen(true);
            handleResetScan();
          }}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs shrink-0 cursor-pointer"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>مسح تذكرة المريض</span>
        </button>
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
            {filteredList.map(b => (
              <div
                key={b.id}
                className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-750 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-800">
                      {b.ticketNumber}
                    </span>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{b.patientName}</h4>
                    <span className="text-slate-500 font-mono text-[11px]">
                      ({maskPhoneNumber(b.patientPhone)})
                    </span>
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 mr-2">
                      رسوم الكشف: {b.fee} ج.م
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      b.paymentStatus === 'paid'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : b.paymentStatus === 'exempt'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}>
                      {b.paymentStatus === 'paid' 
                        ? (b.paymentMethod === 'insurance' ? 'تأمين طبي' : 'مسدد نقداً') 
                        : b.paymentStatus === 'exempt' 
                        ? 'إعفاء خيري' 
                        : 'بانتظار التأكيد'}
                    </span>
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
                <div className="flex flex-wrap items-center gap-2 self-end md:self-center shrink-0">
                  
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

                      {/* 3) إعفاء خيري */}
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
                    <button
                      onClick={() => handlePrintReceipt(b)}
                      className="px-3.5 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-600" />
                      <span>إيصال الخزينة</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
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
                          className={`p-2.5 rounded-xl border font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                            walkInPaymentMode === 'unpaid'
                              ? 'border-slate-700 bg-slate-800 text-white shadow-xs'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <Clock className="w-4 h-4" />
                          <span>حجز فقط (بدون دفع)</span>
                        </button>
                      </div>
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
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          اختر طريقة السداد لتسجيل الدفع وإدراج المريض فوراً في طابور انتظار الاستقبال:
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
                              طريقة السداد: {scannedBooking.paymentMethod === 'insurance' ? 'تأمين طبي' : scannedBooking.paymentStatus === 'exempt' ? 'إعفاء خيري' : 'دفع نقدي'}
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

                    {/* زر مسح تذكرة أخرى */}
                    <div className="pt-2">
                      <button
                        onClick={handleResetScan}
                        className="w-full py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>مسح تذكرة مريض آخر</span>
                      </button>
                    </div>
                  </motion.div>
                )}
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
            <div>المبلغ المسدد: <strong>{selectedReceiptBooking.paymentStatus === 'exempt' ? '0 (إعفاء خيري)' : `${selectedReceiptBooking.fee} ج.م`}</strong></div>
            <div>طريقة الدفع: <strong>{selectedReceiptBooking.paymentMethod === 'cash' ? 'دفع نقدي' : selectedReceiptBooking.paymentMethod === 'insurance' ? 'تأمين طبي' : 'إعفاء خيري'}</strong></div>
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
