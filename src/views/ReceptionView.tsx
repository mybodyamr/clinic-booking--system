import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserCheck, 
  QrCode, 
  PlusCircle, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Stethoscope, 
  User, 
  Phone, 
  Eye, 
  Camera,
  RotateCcw,
  UserX,
  ArrowRight,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { maskPhoneNumber, validateTripleName, validateEgyptianPhone } from '../services/storage';
import { Booking, BookingStatus } from '../types';

export const ReceptionView: React.FC = () => {
  const { 
    bookings, 
    clinics, 
    doctors, 
    updateBookingStatus, 
    admitPatient,
    markPatientLate,
    restoreLatePatient,
    createBooking, 
    addToast,
    navigate,
    setSelectedTicket,
    currentUser,
    hasPermission,
    updateDoctorStatus
  } = useApp();

  const [activeTab, setActiveTab] = useState<'queue' | 'new-booking' | 'scanner' | 'doctors'>('queue');
  const [selectedClinicFilter, setSelectedClinicFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('waiting');
  const [searchQuery, setSearchQuery] = useState('');

  // حالة النافذة المنبثقة للتعامل مع المريض المتأخر
  const [lateActionBooking, setLateActionBooking] = useState<Booking | null>(null);

  // حالة الماسح الضوئي التجريبي
  const [scannedTicketInput, setScannedTicketInput] = useState('');
  const [scanResult, setScanResult] = useState<Booking | null>(null);

  // حالة الحجز السريع المباشر في الاستقبال
  const [walkinName, setWalkinName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [walkinClinicId, setWalkinClinicId] = useState(clinics[0]?.id || '');
  const [walkinDoctorId, setWalkinDoctorId] = useState('');
  const [walkinNotes, setWalkinNotes] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  // قاعدة صارمة: يظهر في طابور الاستقبال فقط المرضى الذين تم تأكيد سدادهم (دفع نقدي / تأمين) أو إعفاؤهم خيرياً في تاريخ اليوم
  // وترتيب الطابور يكون حسب وقت تسجيل السداد / الإعفاء (أول من سدد يدخل أولاً)
  const confirmedBookings = bookings.filter(b => {
    return (b.paymentStatus === 'paid' || b.paymentStatus === 'exempt') && b.date === todayStr;
  });

  const filteredBookings = confirmedBookings
    .filter(b => {
      const matchClinic = selectedClinicFilter === 'all' || b.clinicId === selectedClinicFilter;
      const matchStatus = statusFilter === 'all' || b.status === statusFilter;
      const matchSearch = 
        b.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.patientPhone.includes(searchQuery);
      return matchClinic && matchStatus && matchSearch;
    })
    .sort((a, b) => {
      // فرز حسب وقت تسجيل السداد أو الإعفاء
      const timeA = new Date(a.paidAt || a.createdAt).getTime();
      const timeB = new Date(b.paidAt || b.createdAt).getTime();
      return timeA - timeB;
    });

  const waitingCount = confirmedBookings.filter(b => b.status === 'waiting' && b.date === todayStr).length;
  const inProgressCount = confirmedBookings.filter(b => b.status === 'in-progress' && b.date === todayStr).length;
  const lateCount = confirmedBookings.filter(b => b.status === 'late' && b.date === todayStr).length;
  const completedCount = confirmedBookings.filter(b => b.status === 'completed' && b.date === todayStr).length;

  const canManageDoctorStatus = hasPermission(currentUser?.role, 'manage_doctor_attendance');

  const availableDoctorsInClinic = doctors.filter(d => d.clinicId === walkinClinicId);

  React.useEffect(() => {
    if (availableDoctorsInClinic.length > 0 && !walkinDoctorId) {
      setWalkinDoctorId(availableDoctorsInClinic[0].id);
    }
  }, [walkinClinicId, availableDoctorsInClinic, walkinDoctorId]);

  const handleWalkinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameCheck = validateTripleName(walkinName);
    if (!nameCheck.valid) {
      addToast({
        type: 'error',
        title: 'اسم المريض غير مكتمل',
        message: nameCheck.error || 'يجب كتابة اسم المريض ثلاثياً على الأقل (مثال: محمد أحمد علي).'
      });
      return;
    }

    const phoneCheck = validateEgyptianPhone(walkinPhone);
    if (!phoneCheck.valid) {
      addToast({
        type: 'error',
        title: 'رقم هاتف غير صحيح',
        message: phoneCheck.error || 'يرجى إدخال رقم هاتف محمول صحيح.'
      });
      return;
    }

    const doc = doctors.find(d => d.id === walkinDoctorId) || availableDoctorsInClinic[0];
    const cln = clinics.find(c => c.id === walkinClinicId);

    const res = await createBooking({
      patientName: walkinName,
      patientPhone: walkinPhone,
      clinicId: walkinClinicId,
      doctorId: doc?.id || doctors[0].id,
      date: todayStr,
      timeSlot: 'حجز فوري بالاستقبال',
      fee: cln?.fee || 30,
      notes: walkinNotes ? `حجز مباشر بالاستقبال - ${walkinNotes}` : 'حجز مباشر بالاستقبال'
    });

    if (res.success && res.booking) {
      setWalkinName('');
      setWalkinPhone('');
      setWalkinNotes('');
      setActiveTab('queue');
      addToast({
        type: 'warning',
        title: 'تم تسجيل الحجز الفوري',
        message: `يرجى توجيه المريض للخزينة لسداد التذكرة (${res.booking.ticketNumber}) ليظهر في طابور الانتظار.`
      });
    } else if (res.error) {
      addToast({
        type: 'error',
        title: 'تعذر إتمام الحجز',
        message: res.error
      });
    }
  };

  // التحقق من رمز الـ QR أو كود التذكرة
  const handleVerifyScan = (inputVal?: string) => {
    const code = (inputVal || scannedTicketInput).trim();
    if (!code) return;

    let targetTicketNumber = code;
    try {
      const parsed = JSON.parse(code);
      if (parsed.ticket) targetTicketNumber = parsed.ticket;
    } catch {
      // ليس JSON، استخدام النص المدخل
    }

    const matched = bookings.find(b => 
      b.ticketNumber.toLowerCase() === targetTicketNumber.toLowerCase() ||
      b.id === targetTicketNumber ||
      b.patientPhone === targetTicketNumber
    );

    if (matched) {
      setScanResult(matched);
      if (matched.paymentStatus === 'unpaid') {
        addToast({
          type: 'warning',
          title: 'تذكرة غير مسددة بالخزينة',
          message: `المريض: ${matched.patientName} — يرجى سداد التذكرة لدى الكاشير أولاً.`
        });
      } else if (matched.status === 'late') {
        addToast({
          type: 'warning',
          title: 'المريض متأخر عن دوره',
          message: `تم مسح تذكرة المريض المتأخر (${matched.patientName}) — اختر الإجراء المناسب.`
        });
      } else {
        addToast({
          type: 'success',
          title: 'تم التحقق من التذكرة',
          message: `المريض: ${matched.patientName} — ${matched.clinicName} (تذكرة ${matched.ticketNumber})`
        });
      }
    } else {
      setScanResult(null);
      addToast({
        type: 'error',
        title: 'تذكرة غير صالحة',
        message: 'لم يتم العثور على تذكرة مطابقة بهذا الرمز.'
      });
    }
  };

  const handleAdmit = (bookingId: string) => {
    admitPatient(bookingId);
  };

  const handleMarkLate = (bookingId: string) => {
    markPatientLate(bookingId);
  };

  const handleResolveLate = (action: 'admit_now' | 'return_to_queue') => {
    if (!lateActionBooking) return;
    restoreLatePatient(lateActionBooking.id, action);
    setLateActionBooking(null);
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* رأس شاشة الاستقبال والتبويبات */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              منصة إدارة شؤون الاستقبال وطابور العيادات
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            تسجيل الحضور، مسح التذاكر بالـ QR، وإدارة المتأخرين وانسيابية المرضى أمام العيادات
          </p>
        </div>

        {/* التبويبات */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold overflow-x-auto max-w-full scrollbar-none">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-2 rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            طابور اليوم المؤكد ({waitingCount})
          </button>

          <button
            onClick={() => setActiveTab('new-booking')}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'new-booking'
                ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>حجز فوري</span>
          </button>

          <button
            onClick={() => setActiveTab('scanner')}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'scanner'
                ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>قارئ QR</span>
          </button>

          <button
            onClick={() => setActiveTab('doctors')}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'doctors'
                ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span>حالة الأطباء</span>
          </button>
        </div>
      </div>

      {/* تنبيه معماري لقاعدة الاستقبال */}
      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 p-3 rounded-xl flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>نظام الطابور المعتمد:</strong> لا يظهر المريض هنا إلا بعد سداد الكشف بالخزينة أو تسجيله كإعفاء خيري. الترتيب بحسب أسبقية السداد.
          </span>
        </div>
        {lateCount > 0 && (
          <button
            onClick={() => {
              setStatusFilter('late');
              setActiveTab('queue');
            }}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[11px] shrink-0 cursor-pointer transition-colors"
          >
            توجد {lateCount} حالات متأخرة
          </button>
        )}
      </div>

      {/* التبويب 1: طابور الانتظار وقائمة الكشوفات */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          
          {/* شريط الفلاتر والبحث السريع */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم التذكرة أو اسم المريض أو الهاتف..."
                className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>

            <div>
              <select
                value={selectedClinicFilter}
                onChange={(e) => setSelectedClinicFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
              >
                <option value="all">جميع العيادات التخصصية</option>
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
              >
                <option value="waiting">طابور في الانتظار فقط ({waitingCount})</option>
                <option value="in-progress">حالات داخل العيادة حالياً ({inProgressCount})</option>
                <option value="late">متأخرون عن الحضور ({lateCount})</option>
                <option value="completed">تم الكشف ({completedCount})</option>
                <option value="all">كافة الحالات المؤكدة</option>
              </select>
            </div>
          </div>

          {/* جدول طابور الكشوفات التفاعلي */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>طابور الحالات المعتمدة: ({filteredBookings.length} مريض)</span>
              <span className="text-[11px] text-emerald-800 dark:text-emerald-300">مرتب وفق أسبقية السداد</span>
            </div>

            {filteredBookings.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <Clock className="w-10 h-10 mx-auto opacity-40 text-slate-400" />
                <p className="font-semibold text-sm">لا توجد حالات مسددة في الطابور حالياً</p>
                <p className="text-xs text-slate-500">
                  أي مريض جديد يحتاج أولاً لتسجيل دفعه عند الكاشير أو إعفاؤه ليظهر في هذه الشاشة.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredBookings.map((b) => (
                  <div
                    key={b.id}
                    className={`p-4 hover:bg-slate-50/70 dark:hover:bg-slate-750 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs ${
                      b.status === 'late' ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 px-2.5 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-800">
                          {b.ticketNumber}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          {b.patientName}
                        </h4>
                        <span className="text-slate-500 font-mono text-[11px]">
                          ({maskPhoneNumber(b.patientPhone)})
                        </span>
                        
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : b.status === 'in-progress'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 animate-pulse'
                            : b.status === 'late'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-extrabold'
                            : b.status === 'waiting'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {b.status === 'completed' 
                            ? 'تم الكشف' 
                            : b.status === 'in-progress' 
                            ? 'داخل العيادة' 
                            : b.status === 'late'
                            ? 'متأخر عن الحضور'
                            : b.status === 'waiting' 
                            ? 'في الانتظار' 
                            : 'ملغي'}
                        </span>

                        <span className="text-[10px] bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          {b.paymentStatus === 'paid' ? `مسدد (${b.fee} ج.م)` : 'إعفاء خيري'}
                        </span>
                      </div>

                      <div className="text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                        <span>العيادة: <strong>{b.clinicName}</strong></span>
                        <span>الطبيب: <strong>{b.doctorName}</strong></span>
                        <span>رقم الدور: <strong className="font-mono text-emerald-700 dark:text-emerald-400">#{b.queuePosition}</strong></span>
                        <span>وقت السداد: <strong className="font-mono">{b.paidAt ? new Date(b.paidAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'مسجل'}</strong></span>
                      </div>
                    </div>

                    {/* أزرار الإجراءات السريعة بالاستقبال */}
                    <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                      {b.status === 'waiting' && (
                        <>
                          <button
                            onClick={() => handleAdmit(b.id)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-all shadow-2xs cursor-pointer"
                            title="إدخال المريض للعيادة وتخطي أي أدوار غير حاضرة"
                          >
                            إدخال للعيادة
                          </button>
                          
                          <button
                            onClick={() => handleMarkLate(b.id)}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-bold border border-amber-300 dark:border-amber-800 transition-all cursor-pointer flex items-center gap-1"
                            title="تسجيل عدم تواجد المريض ونقله لقائمة المتأخرين"
                          >
                            <UserX className="w-3.5 h-3.5 text-amber-600" />
                            <span>متأخر</span>
                          </button>
                        </>
                      )}

                      {b.status === 'late' && (
                        <button
                          onClick={() => setLateActionBooking(b)}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>وصول المتأخر</span>
                        </button>
                      )}

                      {b.status === 'in-progress' && (
                        <button
                          onClick={() => updateBookingStatus(b.id, 'completed')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-all shadow-2xs cursor-pointer"
                        >
                          إنهاء الكشف
                        </button>
                      )}

                      {b.status !== 'cancelled' && b.status !== 'completed' && (
                        <button
                          onClick={() => updateBookingStatus(b.id, 'cancelled')}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-100 dark:bg-slate-700 dark:hover:bg-rose-950 text-slate-600 dark:text-slate-300 hover:text-rose-600 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                          title="إلغاء الحجز"
                        >
                          إلغاء
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setSelectedTicket(b);
                          navigate('ticket', b.id);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                        title="عرض التذكرة"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* التبويب 2: حجز فوري مباشر في الاستقبال */}
      {activeTab === 'new-booking' && (
        <div className="max-w-xl mx-auto bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-emerald-700" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">إصدار تذكرة فورية بالاستقبال</h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            للمرضى الحاضرين مباشرة أمام شباك الاستقبال (سيتم توجيههم للخزينة للسداد بعد إصدار التذكرة)
          </p>

          <form onSubmit={handleWalkinSubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                اسم المريض الثلاثي (إجباري):
              </label>
              <input
                type="text"
                required
                value={walkinName}
                onChange={(e) => setWalkinName(e.target.value)}
                placeholder="مثال: محمد أحمد علي..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                يجب كتابة 3 أسماء على الأقل مفصولة بمسافات
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رقم هاتف المريض:</label>
              <input
                type="tel"
                required
                value={walkinPhone}
                onChange={(e) => setWalkinPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">العيادة التخصصية:</label>
                <select
                  value={walkinClinicId}
                  onChange={(e) => setWalkinClinicId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                >
                  {clinics.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.fee} ج.م)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الطبيب المتاح:</label>
                <select
                  value={walkinDoctorId}
                  onChange={(e) => setWalkinDoctorId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                >
                  {availableDoctorsInClinic.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.status === 'available' ? 'متاح' : 'استراحة'})</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ملاحظات إضافية (اختياري):</label>
              <input
                type="text"
                value={walkinNotes}
                onChange={(e) => setWalkinNotes(e.target.value)}
                placeholder="أي توجيهات خاصة بالاستقبال..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
            >
              تسجيل التذكرة وتوجيه المريض للخزينة
            </button>
          </form>
        </div>
      )}

      {/* التبويب 3: قارئ رمز QR للتحقق السريع ومسح التذاكر */}
      {activeTab === 'scanner' && (
        <div className="max-w-xl mx-auto bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-700" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">قارئ ومتحقق تذاكر الكشف (QR Scanner)</h3>
          </div>

          {/* محاكاة واجهة الكاميرا */}
          <div className="bg-slate-900 rounded-2xl p-6 text-center text-white border-2 border-dashed border-emerald-600/60 relative overflow-hidden">
            <div className="w-32 h-32 mx-auto border-2 border-emerald-400 rounded-2xl flex items-center justify-center relative">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399] animate-bounce" />
              <Camera className="w-12 h-12 text-emerald-400/60 animate-pulse" />
            </div>
            <div className="text-[11px] text-emerald-200 mt-4 text-center font-medium">
              وجه كاميرا الجهاز لرمز QR بتذكرة المريض أو أدخل كود التذكرة أدناه
            </div>
          </div>

          {/* إدخال كود التذكرة يدوياً */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={scannedTicketInput}
                onChange={(e) => setScannedTicketInput(e.target.value)}
                placeholder="أدخل كود التذكرة (مثل: باطنة-02 أو أطفال-01)..."
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
              />
              <button
                onClick={() => handleVerifyScan()}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
              >
                تحقق
              </button>
            </div>

            {/* أزرار سريعة لتجربة فحص التذاكر */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500 overflow-x-auto py-1">
              <span>تذاكر للاختبار:</span>
              {bookings.filter(b => b.date === todayStr).slice(0, 4).map(b => (
                <button
                  key={b.id}
                  onClick={() => {
                    setScannedTicketInput(b.ticketNumber);
                    handleVerifyScan(b.ticketNumber);
                  }}
                  className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 hover:bg-emerald-100 text-slate-700 dark:text-slate-300 rounded font-mono text-[10px] cursor-pointer"
                >
                  {b.ticketNumber} ({b.status === 'late' ? 'متأخر' : b.status})
                </button>
              ))}
            </div>
          </div>

          {/* نتيجة التحقق من التذكرة */}
          {scanResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-5 rounded-2xl border space-y-3 ${
                scanResult.paymentStatus === 'unpaid'
                  ? 'bg-amber-50 dark:bg-amber-950/70 border-amber-300 dark:border-amber-800'
                  : scanResult.status === 'late'
                  ? 'bg-rose-50 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {scanResult.paymentStatus === 'unpaid' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  ) : scanResult.status === 'late' ? (
                    <Clock className="w-5 h-5 text-rose-600" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  )}
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {scanResult.paymentStatus === 'unpaid'
                      ? 'التذكرة غير مسددة بالخزينة'
                      : scanResult.status === 'late'
                      ? 'مريض متأخر عن موعده'
                      : 'تذكرة معتمدة ومؤكدة'}
                  </span>
                </div>
                <span className="font-mono font-bold text-xs bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  {scanResult.ticketNumber}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
                <div>المريض: <strong>{scanResult.patientName}</strong></div>
                <div>العيادة: <strong>{scanResult.clinicName}</strong></div>
                <div>الطبيب: <strong>{scanResult.doctorName}</strong></div>
                <div>
                  السداد:{' '}
                  <strong className={scanResult.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-amber-600'}>
                    {scanResult.paymentStatus === 'paid' ? 'مسدد' : scanResult.paymentStatus === 'exempt' ? 'معفى خيري' : 'بانتظار السداد'}
                  </strong>
                </div>
              </div>

              {/* أزرار الإجراءات التفاعلية حسب حالة التذكرة الممسوحة */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                {scanResult.paymentStatus === 'unpaid' ? (
                  <div className="w-full text-center p-2 rounded-xl bg-amber-200/60 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 text-xs font-bold">
                    يرجى توجيه المريض للخزينة لسداد {scanResult.fee} ج.م أولاً
                  </div>
                ) : scanResult.status === 'late' ? (
                  <>
                    <button
                      onClick={() => {
                        restoreLatePatient(scanResult.id, 'admit_now');
                        setScanResult({ ...scanResult, status: 'in-progress' });
                      }}
                      className="w-full sm:flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                    >
                      إدخال الآن للكشف مباشرة
                    </button>
                    <button
                      onClick={() => {
                        restoreLatePatient(scanResult.id, 'return_to_queue');
                        setScanResult({ ...scanResult, status: 'waiting' });
                      }}
                      className="w-full sm:flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                    >
                      إعادة للإدراج في الطابور
                    </button>
                  </>
                ) : scanResult.status === 'waiting' ? (
                  <button
                    onClick={() => {
                      handleAdmit(scanResult.id);
                      setScanResult({ ...scanResult, status: 'in-progress' });
                    }}
                    className="w-full sm:flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                  >
                    تأكيد الحضور وإدخال للعيادة
                  </button>
                ) : null}

                <button
                  onClick={() => {
                    setSelectedTicket(scanResult);
                    navigate('ticket', scanResult.id);
                  }}
                  className="w-full sm:w-auto px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
                >
                  عرض التذكرة
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* التبويب 4: مراقبة حالة الأطباء والعيادات */}
      {activeTab === 'doctors' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {doctors.map(doc => {
            const docBookingsToday = confirmedBookings.filter(
              b => b.doctorId === doc.id && b.date === todayStr && b.status !== 'cancelled'
            );
            const inProgressPatient = docBookingsToday.find(b => b.status === 'in-progress');

            return (
              <div
                key={doc.id}
                className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">{doc.name}</h3>
                    <div className="text-xs text-slate-500">{doc.clinicName}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    doc.status === 'available'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : doc.status === 'break'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : doc.status === 'busy'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {doc.status === 'available' ? 'متاح' : doc.status === 'break' ? 'في استراحة' : doc.status === 'busy' ? 'داخل كشف' : 'غير متواجد'}
                  </span>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                  <div className="flex justify-between">
                    <span>مواعيد العمل:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{doc.scheduleHours}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>الحالات المؤكدة اليوم:</span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{docBookingsToday.length} حالة</span>
                  </div>
                </div>

                {inProgressPatient ? (
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-xs text-blue-950 dark:text-blue-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold block text-[11px]">المريض داخل العيادة الآن:</span>
                      <span>{inProgressPatient.patientName}</span>
                    </div>
                    <span className="font-mono font-bold bg-white dark:bg-blue-900 px-2 py-0.5 rounded text-[10px]">
                      {inProgressPatient.ticketNumber}
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 text-center py-1">
                    لا يوجد مريض داخل العيادة في الوقت الحالي
                  </div>
                )}

                {/* التحكم في حالة الطبيب مع فحص الصلاحية المفوضة من الأدمن */}
                {canManageDoctorStatus ? (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>تحديث حالة الطبيب اليوم:</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">مصرح به</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => updateDoctorStatus(doc.id, 'available')}
                        className={`py-1.5 px-1 rounded-lg font-bold transition-all cursor-pointer text-center ${
                          doc.status === 'available'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                        }`}
                      >
                        متاح
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDoctorStatus(doc.id, 'break')}
                        className={`py-1.5 px-1 rounded-lg font-bold transition-all cursor-pointer text-center ${
                          doc.status === 'break'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                        }`}
                      >
                        استراحة
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDoctorStatus(doc.id, 'offline', 'اعتذر هاتفياً للاستقبال')}
                        className={`py-1.5 px-1 rounded-lg font-bold transition-all cursor-pointer text-center ${
                          doc.status === 'offline'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                        }`}
                      >
                        غير متواجد
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10px] text-slate-400 text-center">
                    مراقبة فقط • تعديل الحضور يتطلب إذن الإدارة
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* نافذة خيارات التعامل مع المريض المتأخر (Tardy Dialog) */}
      <AnimatePresence>
        {lateActionBooking && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    حضور المريض المتأخر عن دوره
                  </h3>
                  <p className="text-xs text-slate-500">
                    تم تجاوز دور المريض سابقاً لعدم حضوره أثناء النداء
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex justify-between">
                  <span>اسم المريض:</span>
                  <strong className="text-slate-900 dark:text-white">{lateActionBooking.patientName}</strong>
                </div>
                <div className="flex justify-between">
                  <span>كود التذكرة:</span>
                  <strong className="font-mono text-emerald-700 dark:text-emerald-400">{lateActionBooking.ticketNumber}</strong>
                </div>
                <div className="flex justify-between">
                  <span>العيادة:</span>
                  <strong>{lateActionBooking.clinicName}</strong>
                </div>
                <div className="flex justify-between">
                  <span>الطبيب:</span>
                  <strong>{lateActionBooking.doctorName}</strong>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                كيف ترغب في إدراج المريض لضمان حقه دون تعطيل سير العيادة؟
              </p>

              <div className="space-y-2.5">
                <button
                  onClick={() => handleResolveLate('admit_now')}
                  className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>إدخال الآن للكشف مباشرة (Admit Now)</span>
                </button>

                <button
                  onClick={() => handleResolveLate('return_to_queue')}
                  className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>إعادة للإدراج في نهاية الطابور (Re-queue)</span>
                </button>

                <button
                  onClick={() => setLateActionBooking(null)}
                  className="w-full py-2 text-slate-500 hover:text-slate-800 dark:hover:text-white text-xs font-semibold cursor-pointer"
                >
                  إلغاء الأمر
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
