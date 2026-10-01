import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowRight, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  CheckCircle2, 
  AlertCircle,
  Stethoscope,
  HeartPulse,
  Baby,
  Eye,
  Bone,
  Smile,
  Ear,
  Sparkles,
  Activity,
  Lock,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { validateEgyptianPhone, validateTripleName } from '../services/storage';
import { 
  getUpcomingDoctorSchedule, 
  getLocalDateStr, 
  formatArabicFullDate,
  getArabicDayName
} from '../services/scheduleService';
import heroHospitalImg from '../assets/images/hospital_doctor_hero_1790597353764.jpg';

export const BookingView: React.FC = () => {
  const {
    createBooking,
    navigate,
    bookings,
    getActiveClinicsForBooking,
    checkClinicAvailabilityStatus,
    officialWorkingHours
  } = useApp();

  const activeClinicsWithDoctors = getActiveClinicsForBooking();

  // الاعتماد الصارم على التاريخ الفعلي الحالي للنظام وليس على تاريخ يدوي
  const actualTodayStr = getLocalDateStr(new Date());

  const [selectedClinicId, setSelectedClinicId] = useState<string>(() => {
    try {
      const preselected = sessionStorage.getItem('preselected_clinic_id');
      if (preselected && activeClinicsWithDoctors.some(item => item.clinic.id === preselected)) {
        sessionStorage.removeItem('preselected_clinic_id');
        return preselected;
      }
    } catch {}
    return activeClinicsWithDoctors[0]?.clinic.id || '';
  });
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [showUpcomingSchedule, setShowUpcomingSchedule] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatDoctorDisplayName = (rawName?: string) => {
    if (!rawName) return '';
    const trimmed = rawName.trim();
    if (trimmed.startsWith('د.') || trimmed.startsWith('د/') || trimmed.startsWith('د ')) {
      return trimmed;
    }
    return `د. ${trimmed}`;
  };

  // تحديث العيادة المختارة تلقائياً إذا تغيرت العيادات النشطة أو اعتذر الطبيب
  React.useEffect(() => {
    if (activeClinicsWithDoctors.length > 0) {
      if (!selectedClinicId || !activeClinicsWithDoctors.some(item => item.clinic.id === selectedClinicId)) {
        setSelectedClinicId(activeClinicsWithDoctors[0].clinic.id);
      }
    } else {
      setSelectedClinicId('');
    }
  }, [activeClinicsWithDoctors, selectedClinicId]);

  const currentSelection = activeClinicsWithDoctors.find(item => item.clinic.id === selectedClinicId);
  const selectedClinic = currentSelection?.clinic;
  const selectedDoctor = currentSelection?.assignedDoctor;

  // الميعاد الفعلي المحدد للطبيب أو العيادة تلقائياً (دون تدخل أو اختيار عشوائي من المريض)
  const effectiveWorkingHours =
    selectedDoctor?.scheduleHours?.trim() ||
    selectedClinic?.workingHours?.trim() ||
    officialWorkingHours?.trim() ||
    '9:00 ص - 5:00 م';

  // استخراج جدول حضور وتواجد الطبيب للأيام القادمة
  const upcomingDoctorSchedule = selectedDoctor 
    ? getUpcomingDoctorSchedule(selectedDoctor, 7, new Date(), bookings)
    : [];

  const getClinicIcon = (iconName: string) => {
    switch (iconName) {
      case 'HeartPulse': return <HeartPulse className="w-5 h-5 text-emerald-800 dark:text-emerald-400" />;
      case 'Baby': return <Baby className="w-5 h-5 text-emerald-800 dark:text-emerald-400" />;
      case 'Eye': return <Eye className="w-5 h-5 text-emerald-800 dark:text-emerald-400" />;
      case 'Bone': return <Bone className="w-5 h-5 text-emerald-800 dark:text-emerald-400" />;
      case 'Smile': return <Smile className="w-5 h-5 text-emerald-800 dark:text-emerald-400" />;
      case 'Ear': return <Ear className="w-5 h-5 text-emerald-800 dark:text-emerald-400" />;
      case 'Sparkles': return <Sparkles className="w-5 h-5 text-emerald-800 dark:text-emerald-400" />;
      default: return <Activity className="w-5 h-5 text-emerald-800 dark:text-emerald-400" />;
    }
  };

  // عدد الحجوزات الموجودة اليوم لنفس العيادة
  const currentClinicBookingsCount = bookings.filter(
    b => b.clinicId === selectedClinicId && b.date === actualTodayStr && b.status !== 'cancelled'
  ).length;

  // الفحص الصارم للركائز الأربعة لتوافر العيادة والحجز لليوم الفعلي الحالي
  const availabilityStatus = (selectedClinicId && selectedDoctor)
    ? checkClinicAvailabilityStatus(selectedClinicId, selectedDoctor.id, actualTodayStr)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (availabilityStatus && !availabilityStatus.allowed) {
      setErrors({ form: availabilityStatus.reason || 'العيادة غير متاحة للحجز حالياً.' });
      return;
    }

    const nameValidation = validateTripleName(patientName);
    if (!nameValidation.valid) {
      newErrors.patientName = nameValidation.error || 'يجب كتابة اسم المريض ثلاثياً على الأقل (مثال: محمد أحمد علي)';
    }

    const phoneValidation = validateEgyptianPhone(patientPhone);
    if (!phoneValidation.valid) {
      newErrors.patientPhone = phoneValidation.error || 'رقم الهاتف غير صحيح';
    }

    if (!selectedClinicId || !selectedClinic) {
      newErrors.clinic = 'يرجى اختيار عيادة تخصصية مفتوحة ومتاحة اليوم';
    }

    if (!selectedDoctor) {
      newErrors.doctor = 'العيادة المختارة لا يتوفر بها طبيب مناوب حالياً';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const result = await createBooking({
      patientName,
      patientPhone,
      clinicId: selectedClinicId,
      doctorId: selectedDoctor!.id,
      date: actualTodayStr,
      timeSlot: effectiveWorkingHours,
      fee: selectedClinic?.fee || 30
    });

    setIsSubmitting(false);

    if (result.success && result.booking) {
      navigate('ticket', result.booking.id);
    } else if (result.error) {
      setErrors({ form: result.error });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      
      {/* ترويسة الحجز الرسمية الراقية (نهاري كلاسيكي هادئ / ليلي فخم) */}
      <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-slate-950 text-slate-900 dark:text-white p-6 sm:p-8 shadow-sm dark:shadow-lg border border-slate-200/90 dark:border-slate-800 transition-colors duration-300">
        <img
          src={heroHospitalImg}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-10 dark:opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-white/95 via-[#F5FAF7]/95 to-emerald-50/85 dark:from-slate-950/95 dark:via-emerald-950/90 dark:to-slate-950/85" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/50 text-emerald-900 dark:text-amber-300 text-xs font-bold">
              <span>حجز إلكتروني فوري ومباشر</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              حجز موعد كشف طبي بالعيادات التخصصية
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl">
              اختر العيادة التخصصية والطبيب المعالج، ثم سجل بيانات المراجع لإصدار تذكرة الكشف الإلكترونية المزودة برمز التحقق (QR Code)
            </p>
          </div>

          <button
            onClick={() => navigate('landing')}
            className="self-start sm:self-center inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-white bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/15 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة للرئيسية</span>
          </button>
        </div>
      </div>

      {errors.form && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-sm flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>{errors.form}</div>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* الخطوة 1: اختيار العيادة التخصصية */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-center font-bold">1</span>
              <span>اختر العيادة التخصصية</span>
            </h3>
            {selectedClinic && (
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                قيمة الكشف: {selectedClinic.fee} ج.م
              </span>
            )}
          </div>

          {activeClinicsWithDoctors.length === 0 ? (
            <div className="p-8 text-center bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-1">
              <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <p className="font-bold text-sm">لا توجد عيادات تخصصية مفتوحة ومتاحة للحجز اليوم حالياً</p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                يرجى مراجعة إدارة المركز أو الاستقبال، أو معاودة المحاولة لاحقاً.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeClinicsWithDoctors.map(({ clinic, assignedDoctor }) => {
                const isSelected = clinic.id === selectedClinicId;
                return (
                  <div
                    key={clinic.id}
                    onClick={() => setSelectedClinicId(clinic.id)}
                    className={`p-4 rounded-xl border text-right cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/50 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center shadow-xs">
                        {getClinicIcon(clinic.iconName)}
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                        {clinic.name}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                        {clinic.room} • {clinic.floor}
                      </div>
                      {assignedDoctor && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-xs text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1.5">
                          <Stethoscope className="w-3.5 h-3.5 shrink-0" />
                          <span>{formatDoctorDisplayName(assignedDoctor.name)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* الخطوة 2: بطاقة الطبيب المدمجة وموعد العيادة المعتمد */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-center font-bold">2</span>
              <span>الطبيب المسؤول وموعد الكشف</span>
            </h3>
            <div className="text-xs text-slate-700 dark:text-slate-300">
              الدور المتوقع: <strong className="text-emerald-800 dark:text-emerald-300 font-mono text-sm">#{currentClinicBookingsCount + 1}</strong>
            </div>
          </div>

          {selectedDoctor ? (
            <div className="p-4 rounded-xl border border-emerald-600/60 bg-emerald-50/30 dark:bg-emerald-950/30 space-y-3.5 text-right">
              {/* بيانات الطبيب الأساسية */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 flex items-center justify-center font-bold shrink-0">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                      {formatDoctorDisplayName(selectedDoctor.name)}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      {selectedDoctor.title} • {selectedClinic?.name}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 shrink-0">
                  الطبيب المكلف اليوم ✓
                </span>
              </div>

              {/* التاريخ الفعلي + ميعاد عمل العيادة في شبكة مدمجة واحدة */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>تاريخ الكشف (اليوم الفعلي)</span>
                    </div>
                    <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white mt-0.5">
                      {formatArabicFullDate(new Date())}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                    اليوم ✅
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>مواعيد عمل العيادة اليوم</span>
                    </div>
                    <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white mt-0.5" dir="rtl">
                      {effectiveWorkingHours}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                    ميعاد معتمد ⏰
                  </span>
                </div>
              </div>

              {/* التوجيه الذكي للدور + زر عرض جدول الأسبوع القابل للطي */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
                <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    رقم دورك المتوقع: <strong className="font-mono text-emerald-800 dark:text-emerald-300">#{currentClinicBookingsCount + 1}</strong> — الدخول بأسبقية تأكيد التذكرة في الخزينة.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowUpcomingSchedule(prev => !prev)}
                  className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-slate-800 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700 text-[11px] font-bold transition-colors cursor-pointer shrink-0"
                >
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{showUpcomingSchedule ? 'إخفاء جدول أيام الطبيب' : 'عرض جدول أيام الطبيب القادمة'}</span>
                  {showUpcomingSchedule ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* جدول الـ 7 أيام القادمة (يفتح فقط عند الطلب لعدم تكديس الشاشة) */}
              {showUpcomingSchedule && (
                <div className="pt-3 border-t border-emerald-200/60 dark:border-emerald-800/60 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <span>
                      أيام تواجد الطبيب المعتمدة: <strong>{selectedDoctor.scheduleDays?.join('، ') || 'يومياً'}</strong>
                    </span>
                    <span className="text-emerald-800 dark:text-emerald-300 font-semibold">
                      * الحجز متاح لليوم الحالي فقط ويُفتح تلقائياً صباح كل يوم عمل
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    {upcomingDoctorSchedule.map((item) => {
                      const isToday = item.isToday;
                      const isScheduled = item.isScheduled;

                      return (
                        <div
                          key={item.dateStr}
                          className={`p-2.5 rounded-xl border text-right flex flex-col justify-between ${
                            isToday
                              ? item.badgeType === 'available'
                                ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/60 ring-1 ring-emerald-500/30'
                                : 'border-amber-400 bg-amber-500/10 dark:bg-amber-950/40'
                              : isScheduled
                              ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                              : 'border-slate-200/50 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-900/30 opacity-60'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="font-bold text-[11px] text-slate-900 dark:text-white">
                                {item.dayName}
                              </span>
                              {isToday && (
                                <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-300">
                                  اليوم
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                              {item.dayMonthStr}
                            </div>
                          </div>

                          <div className="mt-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px]">
                            {isToday ? (
                              item.badgeType === 'available' ? (
                                <span className="font-bold text-emerald-800 dark:text-emerald-300">متاح للحجز ✅</span>
                              ) : (
                                <span className="font-bold text-amber-800 dark:text-amber-300 truncate block">{item.statusText}</span>
                              )
                            ) : isScheduled ? (
                              <span className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5 shrink-0" />
                                <span>للعلم بجدوله</span>
                              </span>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400">✕ إجازة</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-xs text-slate-500 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-200 dark:border-slate-700">
              يرجى اختيار العيادة أعلاه لعرض الطبيب المكلف.
            </div>
          )}

          {/* تنبيه توافر العيادة الصارم بناءً على الركائز الأربعة */}
          {availabilityStatus && !availabilityStatus.allowed && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 rounded-xl border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block mb-0.5">الحجز غير متاح في هذا التاريخ أو التوقيت:</strong>
                <span>{availabilityStatus.reason}</span>
              </div>
            </div>
          )}
        </div>

        {/* الخطوة 3: بيانات المريض الشخصية */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-center font-bold">3</span>
            <span>بيانات المريض والتواصل</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-600" />
                <span>اسم المريض الثلاثي (إجباري):</span>
              </label>
              <input
                type="text"
                required
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="مثال: محمد أحمد علي"
                className={`w-full px-3.5 py-2.5 rounded-xl border ${
                  errors.patientName ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                } bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 font-medium`}
              />
              {errors.patientName ? (
                <div className="text-xs text-rose-500 mt-1 font-medium">{errors.patientName}</div>
              ) : (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  يجب كتابة اسم ثلاثي كامل على الأقل (3 كلمات مفصولة بمسافات)
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>رقم الهاتف المحمول:</span>
              </label>
              <input
                type="tel"
                required
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="01012345678"
                dir="ltr"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-right ${
                  errors.patientPhone ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                } bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 font-medium`}
              />
              {errors.patientPhone && (
                <div className="text-xs text-rose-500 mt-1 font-medium">{errors.patientPhone}</div>
              )}
              <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                يستخدم لاستعراض التذكرة وسجل المريض لاحقاً
              </div>
            </div>
          </div>
        </div>

        {/* ملخص التأكيد وزر الحجز الفوري */}
        <div className="bg-emerald-950 text-white rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 border border-emerald-800">
          <div className="min-w-0">
            <div className="text-xs text-emerald-300 font-semibold mb-1">ملخص الحجز المبدئي:</div>
            <div className="font-bold text-base sm:text-lg text-white break-words">
              {selectedClinic?.name} — {selectedDoctor?.name}
            </div>
            <div className="text-xs text-emerald-200/80 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>التاريخ: {formatArabicFullDate(new Date())}</span>
              <span>•</span>
              <span>مواعيد العيادة: {effectiveWorkingHours}</span>
              <span>•</span>
              <span>رسوم الكشف: {selectedClinic?.fee} ج.م</span>
              <span>•</span>
              <span>الدفع بالخزينة عند الحضور</span>
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={isSubmitting || Boolean(availabilityStatus && !availabilityStatus.allowed)}
            whileHover={!(availabilityStatus && !availabilityStatus.allowed) ? { scale: 1.02 } : {}}
            whileTap={!(availabilityStatus && !availabilityStatus.allowed) ? { scale: 0.98 } : {}}
            className="w-full sm:w-auto min-h-[48px] px-6 sm:px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-sm sm:text-base rounded-xl shadow-lg transition-all shrink-0 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-center"
          >
            <CheckCircle2 className="w-5 h-5 text-amber-300" />
            <span>
              {isSubmitting 
                ? 'جاري إصدار التذكرة...' 
                : (availabilityStatus && !availabilityStatus.allowed)
                  ? (availabilityStatus.isNotScheduledToday
                      ? `الطبيب غير متواجد اليوم (${getArabicDayName(new Date())}) — يُفتح في أيام حضوره`
                      : availabilityStatus.isFullyBooked
                      ? `اكتمل العدد الأقصى لكشوفات اليوم (${availabilityStatus.maxAllowed} حالة)`
                      : availabilityStatus.isShiftEnded
                      ? 'انتهت مناوبة العيادة اليوم'
                      : availabilityStatus.isOffline
                      ? 'الطبيب معتذر عن عيادة اليوم'
                      : 'الحجز غير متاح حالياً')
                  : 'تأكيد الحجز الفوري لليوم واستخراج التذكرة'}
            </span>
          </motion.button>
        </div>

      </form>
    </div>
  );
};
