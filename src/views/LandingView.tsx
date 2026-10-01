import React, { useState, useEffect } from 'react';
import { 
  CalendarPlus, 
  ShieldCheck, 
  Clock, 
  MapPin, 
  PhoneCall, 
  ArrowLeft,
  Stethoscope,
  Sparkles,
  HeartPulse,
  Baby,
  Eye,
  Bone,
  Smile,
  Ear,
  Activity,
  Search,
  Ticket,
  CheckCircle2,
  AlertCircle,
  Users,
  QrCode,
  Loader2,
  RefreshCw,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getLocalDateStr } from '../services/scheduleService';
import { trackPatientQueueByPhoneRpc, PatientLiveQueueResult } from '../services/supabaseService';
import heroHospitalImg from '../assets/images/hospital_doctor_hero_1790597353764.jpg';
import clinicCareImg from '../assets/images/clinic_specialist_care_1790597369214.jpg';

export const LandingView: React.FC = () => {
  const { 
    navigate, 
    clinics, 
    doctors, 
    bookings,
    setSelectedTicket,
    supportInfoText, 
    officialWorkingHours,
    getActiveClinicsForBooking,
    currentUser
  } = useApp();

  const todayStr = getLocalDateStr();
  const availableDoctorsCount = doctors.filter(d => d.status === 'available').length;
  const activeClinicsWithDoctors = getActiveClinicsForBooking();

  // حالة متابعة الدور المباشر والتذكرة برقم الهاتف
  const [showQueueTracker, setShowQueueTracker] = useState(false);
  const [trackerPhone, setTrackerPhone] = useState('');
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [trackerSearched, setTrackerSearched] = useState(false);
  const [trackerError, setTrackerError] = useState('');
  const [trackedResults, setTrackedResults] = useState<PatientLiveQueueResult[]>([]);

  const computeLocalFallbackResults = (cleanDigits: string): PatientLiveQueueResult[] => {
    const normPhone = cleanDigits.slice(-10);
    const todayBookings = bookings.filter(
      b => b.date === todayStr && b.status !== 'cancelled'
    );
    const matches = todayBookings.filter(b => {
      const bDigits = String(b.patientPhone || '').replace(/\D/g, '');
      return bDigits.length >= 10 && bDigits.slice(-10) === normPhone;
    });

    return matches.map(ticket => {
      const isPaidAndConfirmed =
        ticket.paymentStatus === 'paid' || ticket.paymentStatus === 'exempt';
      const paidWaitingInClinic = todayBookings
        .filter(
          b =>
            b.clinicId === ticket.clinicId &&
            b.status === 'waiting' &&
            (b.paymentStatus === 'paid' || b.paymentStatus === 'exempt')
        )
        .sort((a, b) => {
          const tA = new Date(a.paidAt || a.createdAt || 0).getTime();
          const tB = new Date(b.paidAt || b.createdAt || 0).getTime();
          if (tA !== tB) return tA - tB;
          return (a.queuePosition || 0) - (b.queuePosition || 0);
        });

      const inProgressRow = todayBookings.find(
        b =>
          b.clinicId === ticket.clinicId &&
          b.status === 'in-progress' &&
          (b.paymentStatus === 'paid' || b.paymentStatus === 'exempt')
      );

      let paidWaitingAheadCount = 0;
      if (ticket.status === 'in-progress' || ticket.status === 'completed') {
        paidWaitingAheadCount = 0;
      } else if (isPaidAndConfirmed) {
        const myIdx = paidWaitingInClinic.findIndex(b => b.id === ticket.id);
        paidWaitingAheadCount =
          (myIdx >= 0 ? myIdx : paidWaitingInClinic.length) +
          (inProgressRow && inProgressRow.id !== ticket.id ? 1 : 0);
      } else {
        paidWaitingAheadCount =
          paidWaitingInClinic.length + (inProgressRow ? 1 : 0);
      }

      return {
        booking: ticket,
        isPaidAndConfirmed,
        paidWaitingAheadCount,
        totalPaidWaitingInClinic: paidWaitingInClinic.length,
        currentInProgressTicket: inProgressRow?.ticketNumber || null,
      };
    });
  };

  const fetchLiveQueueForPhone = async (phoneInput: string, silent = false) => {
    const cleanDigits = phoneInput.replace(/\D/g, '');
    if (cleanDigits.length < 10) {
      if (!silent) {
        setTrackerError('يرجى إدخال رقم هاتف محمول صحيح مكون من 11 رقماً (مثال: 01012345678)');
        setTrackedResults([]);
        setTrackerSearched(true);
      }
      return;
    }

    if (!silent) {
      setTrackerLoading(true);
      setTrackerError('');
    }

    try {
      const cloudResults = await trackPatientQueueByPhoneRpc(cleanDigits);
      if (cloudResults && cloudResults.length > 0) {
        setTrackedResults(cloudResults);
      } else {
        const localRes = computeLocalFallbackResults(cleanDigits);
        setTrackedResults(localRes);
      }
      setTrackerSearched(true);
    } catch {
      const localRes = computeLocalFallbackResults(cleanDigits);
      setTrackedResults(localRes);
      setTrackerSearched(true);
    } finally {
      if (!silent) {
        setTrackerLoading(false);
      }
    }
  };

  const handleTrackerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchLiveQueueForPhone(trackerPhone, false);
  };

  // تحديث لحظي تلقائي كل 5 ثوانٍ طالما نافذة متابعة الدور مفتوحة وتم البحث فيها
  useEffect(() => {
    if (!showQueueTracker || !trackerSearched) return;
    const cleanDigits = trackerPhone.replace(/\D/g, '');
    if (cleanDigits.length < 10) return;

    const timer = setInterval(() => {
      fetchLiveQueueForPhone(trackerPhone, true);
    }, 5000);
    return () => clearInterval(timer);
  }, [showQueueTracker, trackerSearched, trackerPhone, bookings]);

  const handleOpenTrackedTicket = (bookingItem: any) => {
    setSelectedTicket(bookingItem);
    navigate('ticket', bookingItem.id);
  };

  const getClinicIcon = (iconName: string, clinicName: string) => {
    const iconClass = "w-5 h-5 text-emerald-800 dark:text-amber-400";
    if (iconName === 'HeartPulse' || clinicName.includes('باطنة') || clinicName.includes('قلب')) {
      return <HeartPulse className={iconClass} />;
    }
    if (iconName === 'Baby' || clinicName.includes('أطفال')) {
      return <Baby className={iconClass} />;
    }
    if (iconName === 'Eye' || clinicName.includes('رمد') || clinicName.includes('عيون')) {
      return <Eye className={iconClass} />;
    }
    if (iconName === 'Bone' || clinicName.includes('عظام')) {
      return <Bone className={iconClass} />;
    }
    if (iconName === 'Smile' || clinicName.includes('أسنان')) {
      return <Smile className={iconClass} />;
    }
    if (iconName === 'Ear' || clinicName.includes('أنف') || clinicName.includes('أذن')) {
      return <Ear className={iconClass} />;
    }
    if (iconName === 'Sparkles' || clinicName.includes('جلدية')) {
      return <Sparkles className={iconClass} />;
    }
    return <Activity className={iconClass} />;
  };

  const handleBookClinic = (clinicId: string) => {
    if (currentUser?.role === 'doctor') {
      navigate('doctor');
      return;
    }
    try {
      sessionStorage.setItem('preselected_clinic_id', clinicId);
    } catch {}
    navigate('booking');
  };

  return (
    <div className="space-y-10 pb-16">
      
      {/* 1. الواجهة الرئيسية: هادئة وكلاسيكية بيضاء في الوضع النهاري، وفخمة داكنة بالذهبي والزمردي في الوضع الليلي */}
      <section className="relative rounded-3xl overflow-hidden bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-lg dark:shadow-2xl border border-slate-200/90 dark:border-white/10 transition-colors duration-300">
        <div className="absolute inset-0 z-0">
          <img
            src={heroHospitalImg}
            alt="مجمع عيادات الجمعية الشرعية التخصصية"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center opacity-[0.12] dark:opacity-30 transition-opacity duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-white/95 via-[#F5FAF7]/95 to-emerald-50/85 dark:from-slate-950/95 dark:via-emerald-950/90 dark:to-slate-950/80" />
        </div>

        <div className="relative z-10 p-5 sm:p-10 lg:p-14 grid grid-cols-1 lg:grid-cols-12 gap-7 sm:gap-10 items-center">
          
          {/* النص الترحيبي وزر الحجز الرئيسي فقط (بدون تكرار اسم العيادات الموجود في الهيدر العلوي) */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-5 text-right">
            <div className="space-y-2.5 sm:space-y-3">
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold leading-[1.3] sm:leading-[1.25] tracking-tight text-slate-900 dark:text-white">
                رعاية طبية تخصصية راقية
                <span className="block text-emerald-800 dark:text-amber-400 mt-1.5">
                  وحجز إلكتروني فوري بكل سهولة
                </span>
              </h1>
              <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-base leading-relaxed max-w-xl">
                اختر العيادة التخصصية المناسبة واحصل فوراً على تذكرة الكشف الإلكترونية المزودة برمز التحقق <strong className="text-slate-900 dark:text-white">(QR Code)</strong> دون الحاجة للانتظار.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1 sm:pt-2">
              {currentUser?.role === 'doctor' ? (
                <button
                  onClick={() => navigate('doctor')}
                  className="w-full sm:w-auto justify-center min-h-[48px] px-7 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-emerald-900 hover:bg-emerald-800 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 font-extrabold text-sm sm:text-base flex items-center gap-2.5 shadow-md dark:shadow-lg dark:shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <Stethoscope className="w-5 h-5 text-amber-300 dark:text-slate-950 shrink-0" />
                  <span>الانتقال إلى شاشة الطبيب</span>
                  <ArrowLeft className="w-4 h-4 mr-1 shrink-0" />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => navigate('booking')}
                    className="w-full sm:w-auto justify-center min-h-[48px] px-7 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-emerald-900 hover:bg-emerald-800 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 font-extrabold text-sm sm:text-base flex items-center gap-2.5 shadow-md dark:shadow-lg dark:shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <CalendarPlus className="w-5 h-5 text-amber-300 dark:text-slate-950 shrink-0" />
                    <span>حجز موعد كشف الآن</span>
                    <ArrowLeft className="w-4 h-4 mr-1 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQueueTracker(prev => !prev)}
                    className={`w-full sm:w-auto justify-center min-h-[48px] px-6 py-3.5 sm:py-4 rounded-2xl font-extrabold text-sm sm:text-base flex items-center gap-2.5 border transition-all cursor-pointer ${
                      showQueueTracker
                        ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-950 dark:text-amber-300 border-emerald-700 dark:border-amber-400/60 shadow-xs'
                        : 'bg-white hover:bg-emerald-50/70 dark:bg-white/10 dark:hover:bg-white/15 text-slate-900 dark:text-white border-slate-300 dark:border-white/20 shadow-xs'
                    }`}
                  >
                    <Ticket className="w-5 h-5 text-emerald-800 dark:text-amber-400 shrink-0" />
                    <span>متابعة دوري وتذكرتي الآن</span>
                  </button>
                </>
              )}
            </div>

            {/* بطاقة متابعة الدور الفعلي والتذكرة برقم الهاتف مباشرة تحت أزرار الحجز */}
            {showQueueTracker && (
              <div className="mt-3 p-4 sm:p-5 rounded-2xl bg-white/95 dark:bg-slate-900/95 border-2 border-emerald-700/30 dark:border-amber-400/30 shadow-lg space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                      <Users className="w-4 h-4 text-emerald-800 dark:text-amber-400 shrink-0" />
                      <span>الاستعلام اللحظي عن الدور الفعلي والتذكرة</span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300">
                      أدخل رقم هاتفك لمعرفة عدد المراجعين قبلك ممن <strong>سددوا فعلياً بالخزينة</strong>، وحالة الطبيب الآن.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowQueueTracker(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="إغلاق"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleTrackerSubmit} className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={trackerPhone}
                      onChange={e => setTrackerPhone(e.target.value)}
                      placeholder="أدخل رقم الموبايل (11 رقم مثال: 01012345678)"
                      dir="ltr"
                      className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-700 dark:focus:ring-amber-400 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                  </div>
                  <button
                    type="submit"
                    disabled={trackerLoading}
                    className="px-6 py-3 rounded-xl bg-emerald-900 hover:bg-emerald-800 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 disabled:opacity-60"
                  >
                    {trackerLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري الفحص...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>اعرف دوري الآن</span>
                      </>
                    )}
                  </button>
                </form>

                {trackerError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{trackerError}</span>
                  </div>
                )}

                {trackerSearched && !trackerError && trackedResults.length === 0 && !trackerLoading && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center space-y-1.5">
                    <AlertCircle className="w-6 h-6 text-amber-500 mx-auto" />
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      لا يوجد حجز مسجل اليوم بهذا الرقم
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      تأكد من كتابة رقم الهاتف الذي حجزت به اليوم بشكل صحيح، أو اضغط على «حجز موعد كشف الآن» لإصدار تذكرة جديدة.
                    </p>
                  </div>
                )}

                {trackedResults.length > 0 && (
                  <div className="space-y-3">
                    {trackedResults.map(item => {
                      const {
                        booking: b,
                        isPaidAndConfirmed,
                        paidWaitingAheadCount,
                        currentInProgressTicket,
                      } = item;
                      const doc = doctors.find(d => d.id === b.doctorId) || doctors.find(d => d.clinicId === b.clinicId);
                      const isDocAvailable = doc ? doc.status === 'available' : true;

                      return (
                        <div
                          key={b.id}
                          className="p-4 rounded-xl bg-emerald-50/60 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/70 dark:border-slate-800 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-900 text-amber-300 font-mono font-extrabold text-xs sm:text-sm">
                                {b.ticketNumber}
                              </span>
                              <div>
                                <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                                  {b.clinicName}
                                </div>
                                <div className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
                                  المراجع: {b.patientName} • {b.doctorName}
                                </div>
                              </div>
                            </div>

                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${
                                isDocAvailable
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                                  : 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${isDocAvailable ? 'bg-emerald-600 animate-pulse' : 'bg-amber-500'}`} />
                              <span>{isDocAvailable ? 'الطبيب متواجد بالعيادة' : 'الطبيب في استراحة'}</span>
                            </span>
                          </div>

                          {/* مربعات الدور الفعلي المؤكد بالخزينة */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                                {isPaidAndConfirmed
                                  ? 'أشخاص قبلك (سددوا بالخزينة فعلاً)'
                                  : 'منتظرون بالعيادة الآن (سددوا فعلاً)'}
                              </span>
                              <span className="text-2xl font-black font-mono text-emerald-900 dark:text-amber-400 block my-0.5">
                                {b.status === 'in-progress'
                                  ? 'دورك الآن!'
                                  : b.status === 'completed'
                                  ? 'تم الكشف'
                                  : paidWaitingAheadCount === 0 && isPaidAndConfirmed
                                  ? 'أنت التالي!'
                                  : `${paidWaitingAheadCount} قبلك`}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                                {isPaidAndConfirmed
                                  ? 'حسب أولوية السداد الفعلي بالخزينة'
                                  : 'لا يُحتسب من حجز من البيت ولم يسدد'}
                              </span>
                            </div>

                            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                                حالة تذكرتك في الطابور
                              </span>
                              <span
                                className={`text-xs font-extrabold block my-1 ${
                                  b.status === 'in-progress'
                                    ? 'text-blue-700 dark:text-blue-400'
                                    : isPaidAndConfirmed
                                    ? 'text-emerald-800 dark:text-emerald-400'
                                    : 'text-amber-700 dark:text-amber-400'
                                }`}
                              >
                                {b.status === 'in-progress'
                                  ? 'داخل غرفة الكشف الآن'
                                  : b.status === 'completed'
                                  ? 'اكتمل الكشف بنجاح'
                                  : isPaidAndConfirmed
                                  ? '✓ مؤكدة ومدرجة بطابور الطبيب'
                                  : 'بانتظار السداد في شباك الخزينة'}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                                {isPaidAndConfirmed
                                  ? 'تم تأكيد حضورك في الخزينة'
                                  : `توجه للخزينة لسداد (${b.fee} ج.م) لتفعيل دورك`}
                              </span>
                            </div>

                            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                                التذكرة داخل غرفة الكشف الآن
                              </span>
                              <span className="text-base font-black font-mono text-slate-900 dark:text-white block my-1">
                                {currentInProgressTicket || 'بانتظار النداء'}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                                تحديث مباشر كل 5 ثوانٍ
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => fetchLiveQueueForPhone(trackerPhone, false)}
                              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${trackerLoading ? 'animate-spin' : ''}`} />
                              <span>تحديث الآن</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenTrackedTicket(b)}
                              className="px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>عرض وتحميل التذكرة (QR Code)</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* شريط النقاط المختصر */}
            <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-200/80 dark:border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                <span><strong className="text-slate-900 dark:text-white font-mono">{activeClinicsWithDoctors.length}</strong> عيادات تخصصية متاحة</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                <span><strong className="text-slate-900 dark:text-white font-mono">{availableDoctorsCount}</strong> أطباء استشاريين مناوبين</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 dark:bg-sky-400" />
                <span>إصدار فوري للتذكرة بدون انتظار</span>
              </div>
            </div>
          </div>

          {/* صورة الطبيب الاستشاري */}
          <div className="lg:col-span-5">
            <div className="relative rounded-2xl overflow-hidden h-72 sm:h-80 border border-slate-200 dark:border-white/15 shadow-xl dark:shadow-2xl">
              <img
                src={clinicCareImg}
                alt="الكادر الطبي الاستشاري"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
              
              <div className="absolute bottom-5 inset-x-5 flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs text-amber-400 font-bold mb-0.5">
                    إشراف طبي استشاري
                  </div>
                  <div className="text-base font-extrabold text-white">
                    نخبة من الأطباء المتخصصين لخدمتكم
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-white/15 backdrop-blur-md text-white text-xs font-mono font-semibold border border-white/20 shrink-0">
                  {todayStr}
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 2. بطاقات العيادات التخصصية (كلاسيكي هادئ في النهاري وفخم داكن في الليلي) */}
      <section className="relative rounded-3xl overflow-hidden bg-white dark:bg-gradient-to-b dark:from-slate-950 dark:via-[#071C15] dark:to-slate-950 border border-slate-200/90 dark:border-white/10 p-4 sm:p-8 lg:p-10 shadow-sm dark:shadow-2xl space-y-6 sm:space-y-8 transition-colors duration-300">
        
        <div className="space-y-2 text-right">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 dark:bg-white/10 border border-emerald-200/70 dark:border-white/15 text-emerald-900 dark:text-amber-300 text-xs font-bold">
            <Stethoscope className="w-3.5 h-3.5 text-emerald-800 dark:text-amber-400" />
            <span>الأقسام الطبية التخصصية</span>
          </div>
          <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            اختر العيادة التخصصية لحجز موعدك
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-300">
            اضغط على العيادة المناسبة للانتقال مباشرة إلى إصدار تذكرة الكشف
          </p>
        </div>

        {/* شبكة بطاقات العيادات */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {clinics.map((clinic) => {
            const activeEntry = activeClinicsWithDoctors.find(item => item.clinic.id === clinic.id);
            const doctor = activeEntry?.assignedDoctor || doctors.find(d => d.clinicId === clinic.id);
            const isAvailable = Boolean(activeEntry && doctor && doctor.status === 'available');

            return (
              <div
                key={clinic.id}
                className="group rounded-2xl bg-[#F9FBFA] hover:bg-white dark:bg-white/[0.06] dark:hover:bg-white/[0.09] backdrop-blur-md border border-slate-200/90 hover:border-emerald-700/50 dark:border-white/15 dark:hover:border-amber-400/50 p-6 transition-all duration-200 flex flex-col justify-between shadow-2xs hover:shadow-md dark:shadow-lg"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/90 border border-emerald-200/80 dark:border-emerald-700/50 flex items-center justify-center shrink-0">
                        {getClinicIcon(clinic.iconName || clinic.icon || 'Activity', clinic.name)}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white group-hover:text-emerald-800 dark:group-hover:text-amber-300 transition-colors">
                          {clinic.name}
                        </h3>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-700 dark:text-amber-400/80" />
                          <span>{clinic.room} • {clinic.floor}</span>
                        </span>
                      </div>
                    </div>

                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 shrink-0 ${
                      isAvailable
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40'
                        : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-emerald-600 dark:bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                      <span>{isAvailable ? 'متاحة الآن' : 'استراحة'}</span>
                    </span>
                  </div>

                  {/* الطبيب الاستشاري */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/10 flex items-center gap-3">
                    <Stethoscope className="w-4 h-4 text-emerald-800 dark:text-amber-400 shrink-0" />
                    <div className="truncate">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">الطبيب المعالج</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate block">
                        {doctor ? doctor.name : 'طبيب استشاري متخصص'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* قيمة الكشف وزر الحجز */}
                <div className="pt-4 mt-5 border-t border-slate-200/70 dark:border-white/10 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">قيمة الكشف</span>
                    <span className="text-lg font-extrabold text-emerald-900 dark:text-amber-400 font-mono">
                      {clinic.fee} <span className="text-xs font-sans font-semibold text-slate-500 dark:text-slate-300">ج.م</span>
                    </span>
                  </div>

                  <button
                    onClick={() => handleBookClinic(clinic.id)}
                    className="px-5 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-2xs dark:shadow-md dark:shadow-amber-500/10"
                  >
                    <span>احجز بالعيادة</span>
                    <ArrowLeft className="w-3.5 h-3.5 text-amber-300 dark:text-slate-950" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. شريط مواعيد العمل والعنوان (هادئ في النهاري وفخم في الليلي) */}
      <section className="rounded-3xl bg-white dark:bg-gradient-to-l dark:from-slate-950 dark:via-[#071C15] dark:to-slate-950 border border-slate-200/90 dark:border-white/10 p-6 sm:p-8 shadow-sm dark:shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 text-slate-900 dark:text-white transition-colors duration-300">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 flex-1 w-full">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-white/10 border border-emerald-200/70 dark:border-white/15 flex items-center justify-center text-emerald-800 dark:text-amber-400 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-500 dark:text-amber-300">مواعيد العمل الرسمية</h4>
              <p className="text-xs sm:text-sm text-slate-900 dark:text-white font-bold mt-0.5">{officialWorkingHours}</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-white/10 border border-emerald-200/70 dark:border-white/15 flex items-center justify-center text-emerald-800 dark:text-amber-400 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-500 dark:text-amber-300">عنوان المجمع الطبي</h4>
              <p className="text-xs sm:text-sm text-slate-900 dark:text-white font-bold mt-0.5">المقر الرئيسي — مبنى العيادات التخصصية</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-white/10 border border-emerald-200/70 dark:border-white/15 flex items-center justify-center text-emerald-800 dark:text-amber-400 shrink-0">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-500 dark:text-amber-300">الاستعلامات وخدمة المراجعين</h4>
              <p className="text-xs sm:text-sm text-slate-900 dark:text-white font-bold mt-0.5">{supportInfoText}</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
