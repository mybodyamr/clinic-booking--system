import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Stethoscope, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Send, 
  Activity, 
  Sparkles,
  Search,
  X,
  CalendarDays,
  Check
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { maskPhoneNumber } from '../services/storage';

const COMMON_DAYS = [
  'السبت',
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة'
];

const ABSENCE_REASONS = [
  'عذر طارئ',
  'مؤتمر علمي / دراسات عليا',
  'ارتباط بعمليات جراحية',
  'إجازة اعتيادية',
  'وعكة صحية',
  'ظروف شخصية'
];

export const DoctorView: React.FC = () => {
  const { 
    currentUser, 
    doctors, 
    bookings, 
    updateDoctorStatus, 
    updateDoctorSchedule,
    updateBookingStatus, 
    addDoctorDiagnosis, 
    addToast 
  } = useApp();

  // تحديد الطبيب المرتبط بالجلسة الحالية
  const currentDoctor = doctors.find(d => d.id === currentUser?.doctorId) || doctors[0];
  const [activeNotes, setActiveNotes] = useState<{ [key: string]: string }>({});
  const [patientSearch, setPatientSearch] = useState('');

  // حالات نافذة سبب عدم الحضور
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState(ABSENCE_REASONS[0]);
  const [customReason, setCustomReason] = useState('');

  // حالات تعديل الجدول الأسبوعي
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>(currentDoctor.scheduleDays || []);
  const [scheduleHours, setScheduleHours] = useState<string>(currentDoctor.scheduleHours || '04:00 عصراً - 08:00 مساءً');

  const todayStr = new Date().toISOString().split('T')[0];

  // قائمة حجوزات عيادة هذا الطبيب لليوم (تظهر فقط الحجوزات المسددة أو المعفاة من الكاشير)
  const todayClinicBookings = bookings.filter(
    b => b.doctorId === currentDoctor.id && 
         b.date === todayStr && 
         b.status !== 'cancelled' &&
         (b.paymentStatus === 'paid' || b.paymentStatus === 'exempt')
  ).sort((a, b) => new Date(a.paidAt || a.createdAt).getTime() - new Date(b.paidAt || b.createdAt).getTime());

  const waitingPatients = todayClinicBookings.filter(b => b.status === 'waiting');
  const currentPatient = todayClinicBookings.find(b => b.status === 'in-progress');
  const completedPatients = todayClinicBookings.filter(b => b.status === 'completed');

  const filteredPatients = todayClinicBookings.filter(b => 
    b.patientName.includes(patientSearch) || b.ticketNumber.includes(patientSearch)
  );

  const handleSetAvailable = () => {
    updateDoctorStatus(currentDoctor.id, 'available');
  };

  const handleOpenReasonModal = () => {
    setShowReasonModal(true);
  };

  const handleConfirmUnavailable = () => {
    const finalReason = customReason.trim() ? customReason.trim() : selectedReason;
    updateDoctorStatus(currentDoctor.id, 'offline', finalReason);
    setShowReasonModal(false);
    setCustomReason('');
  };

  const handleToggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSaveSchedule = () => {
    if (selectedDays.length === 0) {
      addToast({
        type: 'error',
        title: 'حدد أيام العمل',
        message: 'يرجى اختيار يوم واحد على الأقل في جدول عملك الأسبوعي.'
      });
      return;
    }
    updateDoctorSchedule(currentDoctor.id, selectedDays, scheduleHours);
    setShowScheduleModal(false);
  };

  // مناداة المريض التالي في الطابور
  const handleCallNextPatient = () => {
    if (waitingPatients.length === 0) {
      addToast({
        type: 'info',
        title: 'قائمة الانتظار فارغة',
        message: 'لا يوجد مرضى في قائمة الانتظار حالياً.'
      });
      return;
    }

    if (currentPatient) {
      updateBookingStatus(currentPatient.id, 'completed');
    }

    const next = waitingPatients[0];
    updateBookingStatus(next.id, 'in-progress');
    addToast({
      type: 'success',
      title: 'مناداة المريض التالي',
      message: `تم استدعاء المريض: ${next.patientName} (تذكرة ${next.ticketNumber}) للدخول للكشف.`
    });
  };

  const handleFinishConsultation = (bookingId: string) => {
    const notesText = activeNotes[bookingId];
    if (notesText && notesText.trim()) {
      addDoctorDiagnosis(bookingId, notesText);
    }
    updateBookingStatus(bookingId, 'completed');
    addToast({
      type: 'success',
      title: 'اكتمل الكشف الطبي',
      message: 'تم إنهاء الكشف وحفظ سجل الزيارة بنجاح.'
    });
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

        {/* أزرار التحكم: متاح / غير متاح + تعديل الجدول الأسبوعي */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* زر تبديل الحالة المباشر */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/90 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={handleSetAvailable}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                currentDoctor.status === 'available'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>متاح للعمل</span>
            </button>

            <button
              onClick={handleOpenReasonModal}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                currentDoctor.status === 'offline'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>غير متاح (سبب الغياب)</span>
            </button>
          </div>

          {/* زر تحديد الجدول الأسبوعي */}
          <button
            onClick={() => {
              setSelectedDays(currentDoctor.scheduleDays || []);
              setScheduleHours(currentDoctor.scheduleHours || '04:00 عصراً - 08:00 مساءً');
              setShowScheduleModal(true);
            }}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-800 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 cursor-pointer"
          >
            <CalendarDays className="w-4 h-4 text-emerald-600" />
            <span>جدولي الأسبوعي</span>
          </button>
        </div>
      </div>

      {/* شريط الإحصائيات السريعة للعيادة */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{todayClinicBookings.length}</div>
            <div className="text-xs text-slate-500">حالات مؤكدة ومسددة اليوم</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{waitingPatients.length}</div>
            <div className="text-xs text-slate-500">في انتظار الدخول</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{completedPatients.length}</div>
            <div className="text-xs text-slate-500">تم الكشف عليهم</div>
          </div>
        </div>
      </div>

      {/* الحالة المحورية: المريض الموجود داخل العيادة الآن */}
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/60 border border-emerald-500/40 text-emerald-200 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>الحالة النشطة داخل غرفة الكشف الآن</span>
            </div>

            {currentPatient ? (
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                  <span>{currentPatient.patientName}</span>
                  <span className="font-mono text-base bg-emerald-700/80 px-3 py-1 rounded-xl border border-emerald-600">
                    {currentPatient.ticketNumber}
                  </span>
                </h2>
                <div className="text-xs text-emerald-200/90 mt-2 flex flex-wrap gap-4">
                  <span>رقم الهاتف: {maskPhoneNumber(currentPatient.patientPhone)}</span>
                  <span>•</span>
                  <span>رقم الدور: #{currentPatient.queuePosition}</span>
                  <span>•</span>
                  <span>الموعد: {currentPatient.timeSlot}</span>
                </div>
              </div>
            ) : (
              <div className="py-3">
                <h2 className="text-xl font-bold text-emerald-100">
                  لا يوجد مريض داخل العيادة حالياً
                </h2>
                <p className="text-xs text-emerald-300/80 mt-1">
                  اضغط على زر "مناداة المريض التالي" لبدء كشف جديد من قائمة الانتظار
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCallNextPatient}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>مناداة المريض التالي ({waitingPatients.length} بالانتظار)</span>
            </motion.button>

            {currentPatient && (
              <button
                onClick={() => handleFinishConsultation(currentPatient.id)}
                className="px-6 py-3 bg-white text-emerald-900 hover:bg-emerald-50 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>إنهاء الكشف وحفظ السجل</span>
              </button>
            )}
          </div>
        </div>

        {/* حقل تدوين التقرير والتشخيص الطبي المباشر */}
        {currentPatient && (
          <div className="mt-6 pt-6 border-t border-emerald-700/60">
            <label className="block text-xs font-bold text-emerald-200 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-300" />
              <span>تدوين التشخيص والعلاج للمريض (يُحفظ في سجله الطبي):</span>
            </label>
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={activeNotes[currentPatient.id] ?? (currentPatient.doctorDiagnosis || '')}
                onChange={(e) => setActiveNotes({ ...activeNotes, [currentPatient.id]: e.target.value })}
                placeholder="اكتب التشخيص، الأدوية الموصوفة، أو التوصيات الطبية هنا..."
                className="flex-1 p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-white placeholder:text-emerald-400/50 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={() => {
                  const notes = activeNotes[currentPatient.id];
                  if (notes) addDoctorDiagnosis(currentPatient.id, notes);
                }}
                className="px-4 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer"
                title="حفظ الملاحظة فوراً"
              >
                <Send className="w-3.5 h-3.5" />
                <span>حفظ التقرير</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* قائمة طابور المرضى المؤكدين لعيادة الطبيب اليوم */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="font-bold text-sm text-slate-900 dark:text-white">
            قائمة مرضى العيادة اليوم ({filteredPatients.length})
          </div>
          <div className="relative max-w-xs w-full">
            <input
              type="text"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder="بحث في أسماء أو تذاكر المرضى..."
              className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
          </div>
        </div>

        {filteredPatients.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            لا توجد حجوزات مؤكدة ومسددة في عيادتك اليوم حتى الآن
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {filteredPatients.map(b => (
              <div
                key={b.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  b.status === 'in-progress' ? 'bg-blue-50/60 dark:bg-blue-950/30' : 'hover:bg-slate-50/60 dark:hover:bg-slate-750'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                      {b.ticketNumber}
                    </span>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{b.patientName}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      b.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : b.status === 'in-progress'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {b.status === 'completed' ? 'تم الكشف' : b.status === 'in-progress' ? 'داخل العيادة' : 'في الانتظار'}
                    </span>
                  </div>
                  <div className="text-slate-500 flex gap-4">
                    <span>دور رقم: #{b.queuePosition}</span>
                    <span>الموعد: {b.timeSlot}</span>
                    <span>الهاتف: {maskPhoneNumber(b.patientPhone)}</span>
                  </div>
                  {b.doctorDiagnosis && (
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 bg-emerald-50 dark:bg-emerald-950/50 p-2 rounded-lg">
                      <strong>التشخيص المسجل:</strong> {b.doctorDiagnosis}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {b.status === 'waiting' && (
                    <button
                      onClick={() => updateBookingStatus(b.id, 'in-progress')}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs cursor-pointer"
                    >
                      إدخال الآن
                    </button>
                  )}
                  {b.status === 'in-progress' && (
                    <button
                      onClick={() => handleFinishConsultation(b.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs cursor-pointer"
                    >
                      إنهاء الكشف
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* نافذة تحديد سبب عدم الحضور / الغياب */}
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
                  <span>تحديد سبب عدم الحضور / الغياب</span>
                </div>
                <button 
                  onClick={() => setShowReasonModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-slate-600 dark:text-slate-300">
                  يرجى تحديد سبب عدم التواجد في العيادة لإظهاره لإدارة المركز والاستقبال:
                </p>

                <div className="space-y-2">
                  {ABSENCE_REASONS.map(reason => (
                    <label 
                      key={reason}
                      onClick={() => setSelectedReason(reason)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedReason === reason
                          ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-bold'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>{reason}</span>
                      {selectedReason === reason && <Check className="w-4 h-4 text-rose-600" />}
                    </label>
                  ))}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    أو سبب آخر (اختياري):
                  </label>
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="مثال: ظرف أسري طارئ، مناوبة مستشفى..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleConfirmUnavailable}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
                >
                  تأكيد وتسجيل الحالة غير متاح
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
                  <span>تحديد الجدول الأسبوعي ومواعيد العيادة</span>
                </div>
                <button 
                  onClick={() => setShowScheduleModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 dark:text-slate-200 mb-2">
                    أيام التواجد الأسبوعية بالعيادة:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {COMMON_DAYS.map(day => {
                      const isSelected = selectedDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleToggleDay(day)}
                          className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                          <span>{day}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                    أوقات العمل والتواجد في كل يوم:
                  </label>
                  <input
                    type="text"
                    value={scheduleHours}
                    onChange={(e) => setScheduleHours(e.target.value)}
                    placeholder="مثال: من 04:00 عصراً إلى 08:30 مساءً"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    تظهر هذه المواعيد للمرضى عند اختيار موعد الكشف بالعيادة.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSaveSchedule}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
                >
                  حفظ الجدول الأسبوعي
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
