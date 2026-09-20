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
  Activity
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { validateEgyptianPhone, validateTripleName } from '../services/storage';

export const BookingView: React.FC = () => {
  const { createBooking, navigate, bookings, getActiveClinicsForBooking, checkClinicAvailabilityStatus } = useApp();

  const activeClinicsWithDoctors = getActiveClinicsForBooking();

  const [selectedClinicId, setSelectedClinicId] = useState<string>(activeClinicsWithDoctors[0]?.clinic.id || '');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [timeSlot, setTimeSlot] = useState('04:30 عصراً');
  const [bookingDate, setBookingDate] = useState<string>(new Date().toISOString().split('T')[0]);
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
    b => b.clinicId === selectedClinicId && b.date === bookingDate && b.status !== 'cancelled'
  ).length;

  // الفحص الصارم للركائز الأربعة لتوافر العيادة والحجز
  const availabilityStatus = (selectedClinicId && selectedDoctor)
    ? checkClinicAvailabilityStatus(selectedClinicId, selectedDoctor.id, bookingDate)
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
      date: bookingDate,
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
                    <span>أيام العمل الأسبوعية: {selectedDoctor.scheduleDays.join('، ')}</span>
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

          {/* التاريخ وفترة الحضور */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>تاريخ الكشف:</span>
              </label>
              <input
                type="date"
                value={bookingDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setBookingDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>الفترة الزمنية المفضلة للحضور:</span>
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
              <span>التاريخ: {bookingDate}</span>
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
                  ? 'الحجز غير متاح حالياً'
                  : 'تأكيد الحجز واستخراج التذكرة'}
            </span>
          </motion.button>
        </div>

      </form>
    </div>
  );
};
