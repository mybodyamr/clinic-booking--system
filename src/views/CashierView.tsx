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
  Building2,
  FileCheck,
  QrCode,
  Camera,
  X,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { maskPhoneNumber } from '../services/storage';
import { PaymentStatus, PaymentMethod, Booking } from '../types';

export const CashierView: React.FC = () => {
  const { bookings, updatePaymentStatus, clinics, addToast } = useApp();
  const [activeTab, setActiveTab] = useState<'unpaid' | 'paid'>('unpaid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClinic, setSelectedClinic] = useState<string>('all');
  const [selectedReceiptBooking, setSelectedReceiptBooking] = useState<Booking | null>(null);

  // حالة قارئ الباركود ومسح تذاكر الخزينة
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedTicketInput, setScannedTicketInput] = useState('');
  const [scannedBooking, setScannedBooking] = useState<Booking | null>(null);
  const [scanNotFound, setScanNotFound] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
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
    const matchSearch = 
      b.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.patientPhone.includes(searchQuery);
    return matchClinic && matchSearch;
  });

  const handleProcessPayment = (bookingId: string, status: PaymentStatus, method: PaymentMethod) => {
    updatePaymentStatus(bookingId, status, method);
  };

  // التحقق من رمز QR أو كود التذكرة في ماسح الخزينة
  const handleVerifyScan = (inputVal?: string) => {
    const code = (inputVal || scannedTicketInput).trim();
    if (!code) return;

    let targetCode = code;
    try {
      const parsed = JSON.parse(code);
      if (parsed.ticket) targetCode = parsed.ticket;
    } catch {
      // ليس JSON
    }

    const cleanInputPhone = targetCode.replace(/[\s-]/g, '');

    const matched = bookings.find(b => 
      b.ticketNumber.toLowerCase() === targetCode.toLowerCase() ||
      b.id === targetCode ||
      b.patientPhone.replace(/[\s-]/g, '') === cleanInputPhone
    );

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
      
      {/* رأس شاشة الخزينة والصندوق */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 flex items-center justify-center font-bold">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                قسم الخزينة وتأكيد الحجوزات
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                تأكيد الحجوزات، تحصيل الرسوم (نقدي / تأمين / إعفاء خيري)، وإرسال رسائل الواتساب
              </p>
            </div>
          </div>
        </div>

        {/* أزرار الإجراءات والتبديل */}
        <div className="flex flex-wrap items-center gap-3">
          {/* زر مسح تذكرة المريض بالباركود / QR */}
          <button
            onClick={() => {
              setIsScannerOpen(true);
              handleResetScan();
            }}
            className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white px-4 py-2.5 rounded-2xl font-bold text-xs shadow-xs transition-all cursor-pointer hover:shadow-md"
          >
            <QrCode className="w-4 h-4" />
            <span>مسح تذكرة المريض (QR)</span>
          </button>

          {/* التبديل بين الحجوزات التي تحتاج تأكيد والمؤكدة */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
            <button
              onClick={() => setActiveTab('unpaid')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'unpaid'
                  ? 'bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              حجوزات تحتاج تأكيد وسداد ({unpaidBookings.length})
            </button>
            <button
              onClick={() => setActiveTab('paid')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'paid'
                  ? 'bg-white dark:bg-slate-800 text-emerald-900 dark:text-emerald-200 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              المؤكدة والمسددة اليوم ({paidBookings.length})
            </button>
          </div>
        </div>
      </div>

      {/* بطاقات الإحصائيات المالية المباشرة */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{cashRevenue} ج.م</div>
            <div className="text-xs text-slate-500">تحصيل نقدي بالخزينة</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{insuranceCount}</div>
            <div className="text-xs text-slate-500">حالات تأمين طبي</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{charityExemptCount}</div>
            <div className="text-xs text-slate-500">إعفاءات تكافل خيري</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{paidBookings.length}</div>
            <div className="text-xs text-slate-500">إجمالي المؤكد في الطابور</div>
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
                  
                  {/* زر رسالة واتساب لتأكيد الحجز */}
                  <a
                    href={generateWhatsAppUrl(b)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                    title="إرسال رسالة تأكيد الحجز للمريض عبر واتساب"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>واتساب</span>
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
