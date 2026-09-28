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
  HelpCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { validateEgyptianPhone, validateTripleName } from '../services/storage';
import { 
  getUpcomingDoctorSchedule, 
  getLocalDateStr, 
  formatArabicFullDate,
  getArabicDayName
} from '../services/scheduleService';

export const BookingView: React.FC = () => {
  const { createBooking, navigate, bookings, getActiveClinicsForBooking, checkClinicAvailabilityStatus } = useApp();

  const activeClinicsWithDoctors = getActiveClinicsForBooking();

  // الاعتماد الصارم على التاريخ الفعلي الحالي للنظام وليس على تاريخ يدوي
  const actualTodayStr = getLocalDateStr(new Date());

  const [selectedClinicId, setSelectedClinicId] = useState<string>(activeClinicsWithDoctors[0]?.clinic.id || '');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [timeSlot, setTimeSlot] = useState('04:30 عصراً');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // استخراج جدول حضور وتواجد الطبيب للأيام القادمة
  const upcomingDoctorSchedule = selectedDoctor 
    ? getUpcomingDoctorSchedule(selectedDoctor, 7, new Date(), bookings)
    : [];

  const getClinicIcon = (iconName: string) => {
    switch (iconName) {
      case 'HeartPulse': return <HeartPulse className="w-5 h-5 text-rose-500" />;
      case 'Baby': return <Baby className="w-5 h-5 text-amber-500" />;
      case 'Eye': return <Eye className="w-5 h-5 text-emerald-500" />;
      case 'Bone': return <Bone className="w-5 h-5 text-indigo-500" />;
      case 'Smile': return <Smile className="w-5 h-5 text-teal-500" />;
      case 'Ear': return <Ear className="w-5 h-5 text-blue-500" />;
      case 'Sparkles': return <Sparkles className="w-5 h-5 text-fuchsia-500" />;
      default: return <Activity className="w-5 h-5 text-emerald-600" />;
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
      timeSlot,
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
      
      {/* رأس الصفحة وزر العودة */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('landing')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 bg-white dark:bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors shadow-xs"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للرئيسية</span>
        </button>

        <div className="text-left text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-800">
          حجز فوري مباشر بدون حساب
        </div>
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          حجز تذكرة كشف طبي بالعيادات
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 max-w-lg mx-auto">
          اختر العيادة التخصصية والطبيب المعالج، ثم أدخل بيانات المريض للحصول على تذكرتك الفورية
        </p>
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
                          <span>د. {assignedDoctor.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* الخطوة 2: اختيار الطبيب والموعد */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-center font-bold">2</span>
              <span>الطبيب المسؤول وموعد الكشف</span>
            </h3>
            <div className="text-xs text-slate-700 dark:text-slate-300">
              الدور المتوقع: <strong className="text-emerald-800 dark:text-emerald-300 font-mono text-sm">#{currentClinicBookingsCount + 1}</strong>
            </div>
          </div>

          {/* الطبيب المعالج المسؤول اليوم عن العيادة */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              الطبيب المعالج المسؤول اليوم:
            </label>
            {selectedDoctor ? (
              <div className="p-4 rounded-xl border border-emerald-600/70 bg-emerald-50/40 dark:bg-emerald-950/40 ring-1 ring-emerald-500/20 text-right">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 flex items-center justify-center font-bold">
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">د. {selectedDoctor.name}</div>
                      <div className="text-xs text-slate-600 dark:text-slate-300">{selectedDoctor.title} • {selectedClinic?.name}</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                    الطبيب المكلف اليوم
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>فترة التواجد والعمل: {selectedDoctor.scheduleHours}</span>
                </div>
                {selectedDoctor.scheduleDays && selectedDoctor.scheduleDays.length > 0 && (
                  <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 mt-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span>أيام العمل الأسبوعية المعتمدة: {selectedDoctor.scheduleDays.join('، ')}</span>
                  </div>
                )}

                {/* بطاقة ورسالة ترحيبية توضيحية لسياسة مواعيد الحجز */}
                <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50/60 to-emerald-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/70 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-right">
                      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                        <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                          <span>أهلاً ومرحباً بكم في العيادات التخصصية</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200/70 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 font-semibold">
                            إرشاد المواعيد
                          </span>
                        </h4>
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                          اليوم الحالي: {formatArabicFullDate(new Date())}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed">
                        نحيطكم علماً بأن <strong>الحجز الفعلي واستخراج التذكرة متاح حصرياً لليوم الحالي</strong>، بينما تُعرض بقية الأيام في جدول الطبيب أدناه <strong>للعلم المسبق فقط بمواعيد وأيام حضوره</strong>، وسيتم فتح حجز كل موعد تلقائياً في صباح نفس اليوم فور حلول تاريخه الفعلي.
                      </p>
                    </div>
                  </div>
                </div>

                {/* جدول أيام حضور وتواجد الطبيب (الأيام القادمة) */}
                <div className="mt-3.5 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/60 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                      <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>جدول مواعيد حضور وتواجد الطبيب بالعيادة (الأيام القادمة):</span>
                    </div>

                    {/* زر وتلميح (Tooltip) إرشادي تفاعلي بجانب الجدول */}
                    <div className="relative group self-start sm:self-auto">
                      <button
                        type="button"
                        aria-label="تلميح توضيحي لجدول المواعيد"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300/80 dark:border-emerald-700 text-[11px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition cursor-help shadow-2xs"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>تلميح: نظام حجز المواعيد</span>
                      </button>

                      {/* نافذة التلميح المنبثقة عند التمرير (Tooltip Card) */}
                      <div className="absolute z-40 bottom-full sm:bottom-auto sm:top-full mt-1.5 mb-1.5 left-0 sm:left-auto sm:right-0 w-72 p-3 bg-slate-900/95 backdrop-blur-md text-white text-[11px] rounded-xl shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-200 leading-relaxed text-right border border-slate-700">
                        <div className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                          <Info className="w-4 h-4 shrink-0" />
                          <span>توضيح هام للمرضى:</span>
                        </div>
                        <ul className="space-y-1.5 text-slate-200 text-[10.5px]">
                          <li className="flex items-start gap-1.5">
                            <span className="text-emerald-400 font-bold shrink-0">✅</span>
                            <span><strong>اليوم الحالي:</strong> متاح للحجز فوراً حتى استيفاء السعة اليومية.</span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="text-amber-400 font-bold shrink-0">🔒</span>
                            <span><strong>الأيام القادمة:</strong> تظهر لمعرفة جدول حضور الطبيب مقدماً فقط، ويُفتح حجزها تلقائياً صباح كل يوم.</span>
                          </li>
                        </ul>
                        <div className="text-[10px] text-slate-400 mt-2 pt-1.5 border-t border-slate-700/80">
                          نظام مستشفى وعيادات متكامل يضمن العدالة ومنع الحجوزات الوهمية المسبقة.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* قائمة كروت الأيام القادمة مع تلميحات لكل يوم */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    {upcomingDoctorSchedule.map((item) => {
                      const isToday = item.isToday;
                      const isScheduled = item.isScheduled;

                      // نص التلميح المخصص لكل بطاقة
                      const cardTooltip = isToday
                        ? item.badgeType === 'available'
                          ? '✅ اليوم الحالي: متاح للحجز الآن واستخراج تذكرة الكشف'
                          : `⚠️ اليوم الحالي: ${item.statusText}`
                        : isScheduled
                        ? `🔒 للعلم فقط: الطبيب متواجد بالعيادة يوم ${item.dayName} (${item.dayMonthStr}). الحجز مقفل حالياً ويُفتح تلقائياً في نفس اليوم.`
                        : `✕ إجازة: الطبيب غير متواجد بالعيادة يوم ${item.dayName}`;

                      return (
                        <div
                          key={item.dateStr}
                          title={cardTooltip}
                          className={`relative group p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between cursor-help ${
                            isToday
                              ? item.badgeType === 'available'
                                ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/60 ring-2 ring-emerald-500/30 shadow-xs'
                                : 'border-amber-400 bg-amber-500/10 dark:bg-amber-950/40'
                              : isScheduled
                              ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs hover:border-emerald-400/60'
                              : 'border-slate-200/50 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-900/30 opacity-60'
                          }`}
                        >
                          {/* التلميح التفاعلي الصغير عند الوقوف فوق الكارت */}
                          <div className="absolute z-30 bottom-full mb-1.5 right-1/2 translate-x-1/2 w-44 p-2 bg-slate-900/95 text-white text-[10px] rounded-lg shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-center leading-tight border border-slate-700">
                            {cardTooltip}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95"></div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-[11px] text-slate-900 dark:text-white">
                                {item.dayName}
                              </span>
                              {isToday ? (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-600 text-white shadow-2xs">
                                  اليوم
                                </span>
                              ) : isScheduled ? (
                                <span className="px-1 py-0.2 rounded text-[8.5px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                                  للعلم فقط
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {item.dayMonthStr}
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              {item.dayMonthStr}
                            </div>
                          </div>

                          <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px]">
                            {isToday ? (
                              item.badgeType === 'available' ? (
                                <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>متاح للحجز ✅</span>
                                </div>
                              ) : (
                                <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span className="truncate">{item.statusText}</span>
                                </div>
                              )
                            ) : isScheduled ? (
                              <div className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                                <div className="leading-tight">
                                  <div className="font-bold text-[10px] text-slate-800 dark:text-slate-200">متواجد بالعيادة</div>
                                  <div className="text-[9px] text-amber-700 dark:text-amber-400 font-semibold">للعلم بجدوله فقط</div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-slate-600 dark:text-slate-400 text-[10px]">
                                ✕ إجازة الطبيب
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* تنبيه إرشادي للمريض يوضح مواعيد فتح الحجز */}
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2">
                    <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      <strong>تذكير بجدول الطبيب:</strong> الحجز الإلكتروني متاح حصراً لليوم الحالي ({formatArabicFullDate(new Date())}). الأيام القادمة المجدولة للطبيب معروضة للاطلاع المسبق على جدول حضوره، ويتم فتح حجزها تلقائياً مع بداية كل يوم وفقاً للتاريخ الفعلي.
                    </span>
                  </div>
                </div>
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

          {/* التاريخ الفعلي وفترة الحضور */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>تاريخ الكشف الفعلي (حجز اليوم الحالي فقط):</span>
              </label>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">
                    {formatArabicFullDate(new Date())}
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>حجز مباشر لليوم الفعلي الحالي</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800">
                  اليوم الفعلي ✅
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>الفترة الزمنية المفضلة للحضور بالعيادة:</span>
              </label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                <option value="01:30 ظهراً">01:30 ظهراً - فترة مبكرة</option>
                <option value="03:00 عصراً">03:00 عصراً</option>
                <option value="04:30 عصراً">04:30 عصراً</option>
                <option value="06:00 مساءً">06:00 مساءً</option>
                <option value="07:30 مساءً">07:30 مساءً</option>
                <option value="09:00 مساءً">09:00 مساءً - فترة مسائية</option>
              </select>
            </div>
          </div>
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
        <div className="bg-emerald-950 text-white rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6 border border-emerald-800">
          <div>
            <div className="text-xs text-emerald-300 font-semibold mb-1">ملخص الحجز المبدئي:</div>
            <div className="font-bold text-lg text-white">
              {selectedClinic?.name} — {selectedDoctor?.name}
            </div>
            <div className="text-xs text-emerald-200/80 mt-1 flex items-center gap-3">
              <span>التاريخ: {formatArabicFullDate(new Date())}</span>
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
            className="px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-base rounded-xl shadow-lg transition-all shrink-0 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
