import React, { useState, useEffect } from 'react';
import { 
  CalendarPlus, 
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

  const formatDoctorName = (rawName?: string) => {
    if (!rawName) return 'طبيب استشاري متخصص';
    const clean = rawName.replace(/^(\s*د\.\s*)+/, '').trim();
    return `د. ${clean}`;
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-8">
        
        {/* 1. البانر العلوي بحجم مريح ومتوازن وخلفية بيضاء طبية صافية */}
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-white/10 shadow-sm p-5 sm:p-7 lg:p-8 space-y-5 transition-colors duration-300">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="space-y-2 text-right">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-amber-400">
                <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-amber-400 animate-pulse" />
                <span>الحجز الإلكتروني المباشر • {todayStr}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-snug tracking-tight text-slate-900 dark:text-white">
                رعاية طبية تخصصية راقية{' '}
                <span className="text-emerald-800 dark:text-amber-400 block sm:inline mt-0.5 sm:mt-0">
                  وحجز فوري بدون انتظار
                </span>
              </h1>
              <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed max-w-2xl">
                اختر العيادة المناسبة بالأسفل لإصدار تذكرة الكشف الذكية <strong className="text-slate-900 dark:text-white">(QR Code)</strong> أو استعلم عن دورك الفعلي في الطابور.
              </p>
            </div>

            {/* أزرار الحجز ومتابعة الدور بحجم مريح للضغط */}
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-3 shrink-0">
              {currentUser?.role === 'doctor' ? (
                <button
                  onClick={() => navigate('doctor')}
                  className="justify-center min-h-[48px] px-6 py-3 rounded-2xl bg-emerald-900 hover:bg-emerald-800 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 font-extrabold text-sm flex items-center gap-2.5 shadow-sm transition-all cursor-pointer"
                >
                  <Stethoscope className="w-5 h-5 text-amber-300 dark:text-slate-950 shrink-0" />
                  <span>الانتقال إلى شاشة الطبيب</span>
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => navigate('booking')}
                    className="justify-center min-h-[48px] px-6 py-3 rounded-2xl bg-emerald-900 hover:bg-emerald-800 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 font-extrabold text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <CalendarPlus className="w-5 h-5 text-amber-300 dark:text-slate-950 shrink-0" />
                    <span>حجز موعد كشف الآن</span>
                    <ArrowLeft className="w-4 h-4 mr-0.5 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQueueTracker(prev => !prev)}
                    className={`justify-center min-h-[48px] px-5 py-3 rounded-2xl font-extrabold text-sm flex items-center gap-2 border transition-all cursor-pointer ${
                      showQueueTracker
                        ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-950 dark:text-amber-300 border-emerald-700 dark:border-amber-400/60 shadow-2xs'
                        : 'bg-slate-50 hover:bg-emerald-50/60 dark:bg-white/10 dark:hover:bg-white/15 text-slate-900 dark:text-white border-slate-200 dark:border-white/20 shadow-2xs'
                    }`}
                  >
                    <Ticket className="w-5 h-5 text-emerald-800 dark:text-amber-400 shrink-0" />
                    <span>متابعة دوري وتذكرتي</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* بطاقة متابعة الدور الفعلي والتذكرة برقم الهاتف مباشرة عند الضغط */}
          {showQueueTracker && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-[#F8FBF9] dark:bg-slate-950 border border-emerald-700/30 dark:border-amber-400/30 space-y-3 text-slate-900 dark:text-white">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                    <Users className="w-4 h-4 text-emerald-800 dark:text-amber-400 shrink-0" />
                    <span>الاستعلام اللحظي عن الدور الفعلي والتذكرة</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    أدخل رقم هاتفك لمعرفة عدد المراجعين قبلك ممن <strong>سددوا فعلياً بالخزينة</strong>، وحالة الطبيب الآن.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQueueTracker(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleTrackerSubmit} className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={trackerPhone}
                    onChange={e => setTrackerPhone(e.target.value)}
                    placeholder="أدخل رقم الموبايل (11 رقم مثال: 01012345678)"
                    dir="ltr"
                    className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs sm:text-sm font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-700 dark:focus:ring-amber-400 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                </div>
                <button
                  type="submit"
                  disabled={trackerLoading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-60"
                >
                  {trackerLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الفحص...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>اعرف دوري الآن</span>
                    </>
                  )}
                </button>
              </form>

              {trackerError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{trackerError}</span>
                </div>
              )}

              {trackerSearched && !trackerError && trackedResults.length === 0 && !trackerLoading && (
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    لا يوجد حجز مسجل اليوم بهذا الرقم
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    تأكد من رقم الهاتف الذي حجزت به اليوم، أو اختر عيادة بالأسفل لإصدار تذكرة جديدة.
                  </p>
                </div>
              )}

              {trackedResults.length > 0 && (
                <div className="space-y-2.5">
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
                        className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-900 text-amber-300 font-mono font-extrabold text-xs">
                              {b.ticketNumber}
                            </span>
                            <div>
                              <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                                {b.clinicName}
                              </div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
                                {b.patientName} • {formatDoctorName(b.doctorName)}
                              </div>
                            </div>
                          </div>

                          <span className="text-[11px] font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <span className={`w-2 h-2 rounded-full ${isDocAvailable ? 'bg-emerald-600 animate-pulse' : 'bg-amber-500'}`} />
                            <span>{isDocAvailable ? 'الطبيب متواجد' : 'الطبيب في استراحة'}</span>
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 text-center">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                              قبلك بالطابور
                            </span>
                            <span className="text-sm sm:text-base font-black font-mono text-emerald-900 dark:text-amber-400 block mt-0.5">
                              {b.status === 'in-progress'
                                ? 'دورك الآن!'
                                : b.status === 'completed'
                                ? 'تم الكشف'
                                : paidWaitingAheadCount === 0 && isPaidAndConfirmed
                                ? 'أنت التالي!'
                                : `${paidWaitingAheadCount} قبلك`}
                            </span>
                          </div>

                          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 text-center">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                              حالة التذكرة
                            </span>
                            <span
                              className={`text-[11px] font-extrabold block mt-0.5 ${
                                b.status === 'in-progress'
                                  ? 'text-blue-700 dark:text-blue-400'
                                  : isPaidAndConfirmed
                                  ? 'text-emerald-800 dark:text-emerald-400'
                                  : 'text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              {b.status === 'in-progress'
                                ? 'داخل الكشف'
                                : b.status === 'completed'
                                ? 'اكتمل الكشف'
                                : isPaidAndConfirmed
                                ? '✓ مؤكدة بالخزينة'
                                : `سدد (${b.fee} ج.م) بالخزينة`}
                            </span>
                          </div>

                          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 text-center">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                              داخل الغرفة الآن
                            </span>
                            <span className="text-xs sm:text-sm font-black font-mono text-slate-900 dark:text-white block mt-0.5">
                              {currentInProgressTicket || 'بانتظار النداء'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => fetchLiveQueueForPhone(trackerPhone, false)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <RefreshCw className={`w-3 h-3 ${trackerLoading ? 'animate-spin' : ''}`} />
                            <span>تحديث</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenTrackedTicket(b)}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-900 hover:bg-emerald-800 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 text-[11px] font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>عرض التذكرة (QR)</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* شريط المعلومات المختصر في سطر واحد أنيق */}
          <div className="pt-2.5 border-t border-slate-100 dark:border-white/10 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                <span><strong className="text-slate-900 dark:text-white font-mono">{activeClinicsWithDoctors.length}</strong> عيادات متاحة</span>
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
                <span><strong className="text-slate-900 dark:text-white font-mono">{availableDoctorsCount}</strong> أطباء مناوبين</span>
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 font-semibold text-emerald-900 dark:text-amber-300">
              <Clock className="w-3.5 h-3.5 text-emerald-800 dark:text-amber-400 shrink-0" />
              <span>مواعيد العمل: {officialWorkingHours}</span>
            </div>
          </div>
        </section>

        {/* 2. قائمة العيادات التخصصية بحجم مريح وواضح بدون قص الأسماء */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2 px-1">
            <div>
              <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-emerald-800 dark:text-amber-400 shrink-0" />
                <span>اختر العيادة التخصصية للحجز الفوري</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                اضغط على العيادة المناسبة لإصدار تذكرة الكشف مباشرة
              </p>
            </div>
          </div>

          {/* شبكة كروت العيادات بحجم مريح ومتناسق */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
            {clinics.map((clinic) => {
              const activeEntry = activeClinicsWithDoctors.find(item => item.clinic.id === clinic.id);
              const doctor = activeEntry?.assignedDoctor || doctors.find(d => d.clinicId === clinic.id);
              const isAvailable = Boolean(activeEntry && doctor && doctor.status === 'available');
              const hoursText = doctor?.scheduleHours || clinic.workingHours || officialWorkingHours;

              return (
                <div
                  key={clinic.id}
                  onClick={() => handleBookClinic(clinic.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleBookClinic(clinic.id);
                    }
                  }}
                  className="group rounded-2xl bg-white hover:bg-emerald-50/20 dark:bg-slate-900 dark:hover:bg-slate-800/90 border border-slate-200/90 hover:border-emerald-700/60 dark:border-white/10 dark:hover:border-amber-400/60 p-4 sm:p-5 transition-all duration-200 flex items-center justify-between gap-3.5 shadow-xs hover:shadow-md cursor-pointer"
                >
                  {/* يمين الكارت: الأيقونة + اسم العيادة الكامل + الطبيب والغرفة */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/90 border border-emerald-200/80 dark:border-emerald-700/50 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      {getClinicIcon(clinic.iconName || clinic.icon || 'Activity', clinic.name)}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1 text-right">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-base sm:text-lg leading-snug text-slate-900 dark:text-white group-hover:text-emerald-800 dark:group-hover:text-amber-300 transition-colors">
                          {clinic.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-amber-300">
                          {formatDoctorName(doctor?.name)}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-emerald-600 dark:bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                          <span>{isAvailable ? 'متاحة الآن' : 'استراحة'}</span>
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span>غرفة {clinic.room}</span>
                        <span>•</span>
                        <span>{hoursText}</span>
                      </div>
                    </div>
                  </div>

                  {/* يسار الكارت: السعر + زر الحجز بحجم مريح وواضح */}
                  <div className="flex flex-col items-end justify-between gap-2.5 shrink-0 border-r border-slate-100 dark:border-white/10 pr-3.5">
                    <div className="text-left">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-semibold">قيمة الكشف</span>
                      <span className="text-lg sm:text-xl font-black text-emerald-900 dark:text-amber-400 font-mono">
                        {clinic.fee}
                      </span>{' '}
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-300">ج.م</span>
                    </div>

                    <span className="px-4 py-2 rounded-xl bg-emerald-900 group-hover:bg-emerald-800 dark:bg-amber-400 dark:group-hover:bg-amber-300 text-white dark:text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors shadow-2xs">
                      <span>احجز</span>
                      <ArrowLeft className="w-3.5 h-3.5 text-amber-300 dark:text-slate-950" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. قسم مواعيد العمل والعنوان والاستعلامات بحجم مريح ومقروء */}
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-white/10 p-5 sm:p-6 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-slate-900 dark:text-white">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-white/10 border border-emerald-200/70 dark:border-white/15 flex items-center justify-center text-emerald-800 dark:text-amber-400 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-500 dark:text-amber-300">مواعيد العمل الرسمية</h4>
              <p className="text-xs sm:text-sm text-slate-900 dark:text-white font-bold mt-1 leading-relaxed">{officialWorkingHours}</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-white/10 border border-emerald-200/70 dark:border-white/15 flex items-center justify-center text-emerald-800 dark:text-amber-400 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-500 dark:text-amber-300">عنوان المجمع الطبي</h4>
              <p className="text-xs sm:text-sm text-slate-900 dark:text-white font-bold mt-1 leading-relaxed">المقر الرئيسي — مبنى العيادات التخصصية</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-white/10 border border-emerald-200/70 dark:border-white/15 flex items-center justify-center text-emerald-800 dark:text-amber-400 shrink-0">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-500 dark:text-amber-300">الاستعلامات وخدمة المراجعين</h4>
              <p className="text-xs sm:text-sm text-slate-900 dark:text-white font-bold mt-1 leading-relaxed">{supportInfoText}</p>
            </div>
          </div>
        </section>

    </div>
  );
};
