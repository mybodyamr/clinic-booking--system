import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Stethoscope, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  CalendarDays, 
  Check 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { 
  parseDoctorShiftTimes, 
  format24To12Arabic 
} from '../services/scheduleService';

const COMMON_DAYS = [
  'السبت',
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة'
];

const MANDATORY_ABSENCE_REASONS = [
  'عذر طارئ',
  'ارتباط بعمليات'
] as const;

export const DoctorView: React.FC = () => {
  const { 
    currentUser, 
    doctors, 
    updateDoctorStatus, 
    updateDoctorSchedule,
    addToast 
  } = useApp();

  // تحديد الطبيب المرتبط بالجلسة الحالية
  const currentDoctor =
    doctors.find(d => d.id === currentUser?.doctorId) ||
    (currentUser?.clinicId ? doctors.find(d => d.clinicId === currentUser.clinicId) : undefined) ||
    doctors[0];

  // حالات نافذة سبب عدم الحضور (إلزامية: عذر طارئ أو ارتباط بعمليات)
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>(MANDATORY_ABSENCE_REASONS[0]);
  const [customReason, setCustomReason] = useState('');

  // حالات تعديل الجدول الأسبوعي
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>(currentDoctor?.scheduleDays || []);
  
  const initialShiftTimes = currentDoctor ? parseDoctorShiftTimes(currentDoctor) : { startTime: '14:00', endTime: '20:00', formattedArabic: 'من 2:00 م إلى 8:00 م' };
  const [shiftStartTime, setShiftStartTime] = useState<string>(
    currentDoctor?.shiftStartTime || initialShiftTimes.startTime || '14:00'
  );
  const [shiftEndTime, setShiftEndTime] = useState<string>(
    currentDoctor?.shiftEndTime || initialShiftTimes.endTime || '20:00'
  );

  if (!currentDoctor) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">لا يوجد أطباء مسجلون حالياً في النظام.</p>
      </div>
    );
  }

  const currentShiftDisplay = parseDoctorShiftTimes(currentDoctor);

  const handleSetAvailable = () => {
    updateDoctorStatus(currentDoctor.id, 'available');
  };

  const handleOpenReasonModal = () => {
    setShowReasonModal(true);
  };

  const handleConfirmUnavailable = async () => {
    const finalReason = customReason.trim() ? customReason.trim() : selectedReason;
    const ok = await updateDoctorStatus(currentDoctor.id, 'offline', finalReason);
    if (ok) {
      setShowReasonModal(false);
      setCustomReason('');
    }
  };

  const handleToggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSaveSchedule = async () => {
    if (selectedDays.length === 0) {
      addToast({
        type: 'error',
        title: 'حدد أيام العمل',
        message: 'يرجى اختيار يوم واحد على الأقل في جدول عملك الأسبوعي.'
      });
      return;
    }

    if (!shiftStartTime || !shiftEndTime) {
      addToast({
        type: 'error',
        title: 'حدد أوقات المناوبة',
        message: 'يرجى إدخال وقت بداية ووقت نهاية المناوبة.'
      });
      return;
    }

    const formattedHours = `من ${format24To12Arabic(shiftStartTime)} إلى ${format24To12Arabic(shiftEndTime)}`;
    const ok = await updateDoctorSchedule(currentDoctor.id, selectedDays, formattedHours, shiftStartTime, shiftEndTime);
    if (ok) {
      setShowScheduleModal(false);
    }
  };

  const openScheduleEditor = () => {
    setSelectedDays(currentDoctor.scheduleDays || []);
    const times = parseDoctorShiftTimes(currentDoctor);
    setShiftStartTime(currentDoctor.shiftStartTime || times.startTime || '14:00');
    setShiftEndTime(currentDoctor.shiftEndTime || times.endTime || '20:00');
    setShowScheduleModal(true);
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* رأس شاشة الطبيب وحالة التواجد وجدول العمل */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-950 text-white flex items-center justify-center font-bold text-xl shadow-md border border-emerald-700 shrink-0">
            <Stethoscope className="w-7 h-7 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {currentDoctor.name}
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {currentDoctor.clinicName}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {currentDoctor.title}
            </p>
            {currentDoctor.status === 'offline' && currentDoctor.unavailableReason && (
              <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 text-[11px] font-bold text-rose-800 dark:text-rose-300">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>سبب عدم التواجد: {currentDoctor.unavailableReason}</span>
              </div>
            )}
          </div>
        </div>

        {/* أزرار التحكم: حالة التواجد اليومي + جدولي الأسبوعي */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          
          {/* قسم حالة التواجد اليومي */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              حالة التواجد اليومي:
            </span>
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/90 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleSetAvailable}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  currentDoctor.status === 'available'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
                <span>🟢 متاح للعمل</span>
              </button>

              <button
                type="button"
                onClick={handleOpenReasonModal}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  currentDoctor.status === 'offline'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-300"></span>
                <span>🔴 غير متاح</span>
              </button>
            </div>
          </div>

          {/* زر تحديد الجدول الأسبوعي */}
          <div className="flex flex-col gap-1 sm:pt-5">
            <button
              type="button"
              onClick={openScheduleEditor}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-800 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 cursor-pointer shadow-2xs"
            >
              <CalendarDays className="w-4 h-4 text-emerald-600" />
              <span>جدولي الأسبوعي</span>
            </button>
          </div>
        </div>
      </div>

      {/* عرض تفاصيل الحضور اليومي والجدول الأسبوعي المعتمد للطبيب */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* بطاقة حالة الحضور اليومي */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                currentDoctor.status === 'available'
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
              }`}>
                {currentDoctor.status === 'available' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                  حالة الحضور اليومي بالعيادة
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  تتحكم في ظهور عيادتك للمرضى في شاشة الحجز اليومي
                </p>
              </div>
            </div>

            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              currentDoctor.status === 'available'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}>
              {currentDoctor.status === 'available' ? 'متاح للعمل اليوم' : 'غير متاح اليوم'}
            </span>
          </div>

          {currentDoctor.status === 'offline' ? (
            <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-900 dark:text-rose-200 space-y-1.5">
              <div className="font-bold">
                سبب الاعتذار المسجل: {currentDoctor.unavailableReason || 'اعتذار رسمي'}
              </div>
              <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed">
                العيادة متوقفة حالياً عن استقبال حجوزات جديدة لليوم. يمكنك إعادة تفعيل الحضور في أي وقت بالضغط على زر "متاح للعمل".
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-900 dark:text-emerald-200 space-y-1.5">
              <div className="font-bold">
                العيادة نشطة وتستقبل الحجوزات وفق جدولك المعتمد
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed">
                في حال وجود عذر طارئ أو ارتباط بعمليات، يرجى التحويل إلى "غير متاح" لإيقاف الحجز اليومي تلقائياً.
              </p>
            </div>
          )}
        </div>

        {/* بطاقة الجدول الأسبوعي وساعات العمل */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                  الجدول الأسبوعي وساعات العمل
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  أيام التواجد ومواعيد المناوبة المعتمدة للعيادة
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openScheduleEditor}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition-colors cursor-pointer"
            >
              تعديل الجدول
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="text-slate-500 dark:text-slate-400 font-semibold mb-1.5">
                أيام العمل الأسبوعية:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(currentDoctor.scheduleDays && currentDoctor.scheduleDays.length > 0) ? (
                  currentDoctor.scheduleDays.map(day => (
                    <span
                      key={day}
                      className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold"
                    >
                      {day}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400">لم يتم تحديد أيام عمل</span>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-semibold">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>ساعات المناوبة:</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">
                {currentDoctor.scheduleHours || currentShiftDisplay.formattedDisplay}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* نافذة تحديد سبب عدم الحضور / الغياب (إلزامية: عذر طارئ أو ارتباط بعمليات) */}
      <AnimatePresence>
        {showReasonModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-base">
                  <AlertCircle className="w-5 h-5" />
                  <span>حالة التواجد اليومي: تسجيل غير متاح</span>
                </div>
                <button 
                  onClick={() => setShowReasonModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-slate-700 dark:text-slate-300 font-medium">
                  يرجى تحديد سبب عدم التواجد (خانة إلزامية):
                </p>

                <div className="space-y-2">
                  {MANDATORY_ABSENCE_REASONS.map(reason => (
                    <label 
                      key={reason}
                      onClick={() => setSelectedReason(reason)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                        selectedReason === reason
                          ? 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/50 text-rose-900 dark:text-rose-100 font-bold shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full border-2 flex items-center justify-center border-rose-500">
                          {selectedReason === reason && <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>}
                        </span>
                        <span>{reason}</span>
                      </div>
                      {selectedReason === reason && <Check className="w-4 h-4 text-rose-600" />}
                    </label>
                  ))}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    تفاصيل إضافية عن العذر / المستشفى (اختياري):
                  </label>
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="مثال: مناوبة جراحية طارئة، ظرف أسري..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
                  تنبيه: عند تأكيد الحالة، ستختفي عيادتك فوراً وبشكل تلقائي من شاشة حجز المرضى الخارجية، ولن يتمكن أي مريض جديد من الحجز حتى تقوم بإعادة تفعيل الحالة إلى (متاح للعمل). الحجوزات القائمة لا يتم حذفها.
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleConfirmUnavailable}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
                >
                  تأكيد وتسجيل الحالة: غير متاح
                </button>
                <button
                  onClick={() => setShowReasonModal(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* نافذة تحديد الجدول الأسبوعي للطبيب */}
      <AnimatePresence>
        {showScheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-base">
                  <CalendarDays className="w-5 h-5 text-emerald-600" />
                  <span>الجدول الأسبوعي ومواعيد المناوبة</span>
                </div>
                <button 
                  onClick={() => setShowScheduleModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* اختيار أيام العمل */}
                <div>
                  <label className="block font-bold text-slate-800 dark:text-slate-200 mb-2">
                    أيام العمل الأسبوعية بالعيادة:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {COMMON_DAYS.map(day => {
                      const isSelected = selectedDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleToggleDay(day)}
                          className={`p-2 rounded-xl border text-center font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          <span>{day}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* أوقات بداية ونهاية المناوبة */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                  <div>
                    <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                      وقت بداية المناوبة:
                    </label>
                    <input
                      type="time"
                      value={shiftStartTime}
                      onChange={(e) => setShiftStartTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      {shiftStartTime ? format24To12Arabic(shiftStartTime) : ''}
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                      وقت نهاية المناوبة:
                    </label>
                    <input
                      type="time"
                      value={shiftEndTime}
                      onChange={(e) => setShiftEndTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      {shiftEndTime ? format24To12Arabic(shiftEndTime) : ''}
                    </span>
                  </div>
                </div>

                {/* استعراض ساعات المناوبة وتنبيه انتهاء الوقت */}
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-1">
                  <div className="font-bold text-emerald-900 dark:text-emerald-200 text-xs">
                    مواعيد العمل: من {format24To12Arabic(shiftStartTime)} إلى {format24To12Arabic(shiftEndTime)}
                  </div>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                    تنبيه: تتوقف العيادة تلقائياً عن استقبال الحجوزات وتختفي من شاشة حجز المرضى بمجرد حلول وقت نهاية المناوبة ({format24To12Arabic(shiftEndTime)}).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSaveSchedule}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
                >
                  حفظ الجدول والمواعيد
                </button>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
