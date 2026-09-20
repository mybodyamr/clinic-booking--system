import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tv, 
  Clock, 
  ArrowRight, 
  Maximize2, 
  Minimize2, 
  Hospital
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const QueueView: React.FC = () => {
  const { clinics, bookings, doctors, navigate } = useApp();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // تحديث الساعة الرقمية لحظياً
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className={`space-y-6 pb-16 ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-950 p-6 overflow-y-auto' : ''}`}>
      
      {/* شريط الإجراءات والتحكم العلوي */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('landing')}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
            title="العودة"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-emerald-800 text-amber-400 flex items-center justify-center font-bold">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>شاشة العرض المركزية لصالة الانتظار</span>
              <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
                بث مباشر
              </span>
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              متابعة الأدوار الحالية والمناداة في كافة العيادات التخصصية لحظة بلحظة
            </p>
          </div>
        </div>

        {/* الساعة الرقمية وأزرار العرض */}
        <div className="flex items-center gap-3 self-end sm:self-center">
          <div className="text-left font-mono bg-slate-100 dark:bg-slate-800/80 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {currentTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[10px] text-slate-500">
              {currentTime.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
            title="ملء الشاشة لشاشات الانتظار"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* بطاقات العيادات التخصصية وشاشات النداء */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {clinics.map(clinic => {
          const clinicBookings = bookings
            .filter(
              b => b.clinicId === clinic.id && 
                   b.date === todayStr && 
                   b.status !== 'cancelled' &&
                   (b.paymentStatus === 'paid' || b.paymentStatus === 'exempt')
            )
            .sort((a, b) => {
              const timeA = new Date(a.paidAt || a.createdAt).getTime();
              const timeB = new Date(b.paidAt || b.createdAt).getTime();
              return timeA - timeB;
            });

          // المريض الذي داخل العيادة الآن
          const currentPatient = clinicBookings.find(b => b.status === 'in-progress');
          
          // المرضى القادمون في الانتظار
          const waitingQueue = clinicBookings.filter(b => b.status === 'waiting');
          const latePatients = clinicBookings.filter(b => b.status === 'late');
          const nextPatient = waitingQueue[0];
          const followingPatients = waitingQueue.slice(1, 4);

          // الطبيب المتاح في العيادة
          const doctor = doctors.find(d => d.clinicId === clinic.id);

          return (
            <div
              key={clinic.id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden flex flex-col justify-between"
            >
              {/* ترويسة العيادة */}
              <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-white">{clinic.name}</h3>
                  <div className="text-xs text-emerald-300 font-medium">
                    {clinic.room} • {doctor?.name || 'طبيب استشاري'}
                  </div>
                </div>
                <span className="text-[11px] font-bold bg-emerald-800/80 px-2.5 py-1 rounded-lg border border-emerald-700">
                  {doctor?.status === 'available' ? 'العيادة تعمل' : 'في استراحة'}
                </span>
              </div>

              {/* قسم المريض الحالي بالداخل (Hero Focus) */}
              <div className="p-5 text-center bg-slate-50/70 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                  الدور الحالي داخل غرفة الكشف
                </div>

                {currentPatient ? (
                  <motion.div
                    key={currentPatient.id}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="space-y-1"
                  >
                    <div className="text-4xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono tracking-wider">
                      {currentPatient.ticketNumber}
                    </div>
                    <div className="font-bold text-base text-slate-900 dark:text-white">
                      {currentPatient.patientName}
                    </div>
                    <div className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                      رقم الدور: #{currentPatient.queuePosition}
                    </div>
                  </motion.div>
                ) : (
                  <div className="py-4 text-slate-400 text-xs font-medium">
                    العيادة شاغرة حالياً بانتظار استدعاء المريض
                  </div>
                )}
              </div>

              {/* قسم المريض التالي في الطابور */}
              <div className="p-4 space-y-3 flex-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>المريض التالي بالاستدعاء:</span>
                  <span className="text-emerald-700 dark:text-emerald-400">
                    باقي في الانتظار ({waitingQueue.length})
                  </span>
                </div>

                {nextPatient ? (
                  <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400 block">يرجى الاستعداد:</span>
                      <strong className="text-xs text-slate-900 dark:text-white">{nextPatient.patientName}</strong>
                    </div>
                    <span className="font-mono font-bold text-sm bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300">
                      {nextPatient.ticketNumber}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 text-center py-2">
                    لا يوجد مرضى في قائمة الانتظار لهذه العيادة
                  </div>
                )}

                {/* باقي أرقام الانتظار إن وجدت */}
                {followingPatients.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-[11px] text-slate-500 mb-1.5 font-medium">الأدوار التالية:</div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {followingPatients.map(p => (
                        <span
                          key={p.id}
                          className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-semibold"
                        >
                          {p.ticketNumber}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* شريط الإرشادات السفلي للعيادة */}
              <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 flex items-center justify-between font-medium">
                <span>تحديث تلقائي مستمر</span>
                <span>الجمعية الشرعية</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* شريط الإعلانات التوعوية الثابت بالأسفل (شريط الصالة الإخباري) */}
      <div className="p-4 rounded-2xl bg-emerald-950 text-emerald-200 border border-emerald-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2 font-bold text-white">
          <Hospital className="w-5 h-5 text-amber-400 shrink-0" />
          <span>تنبيه هام للمرضى والمراجعين الكرام:</span>
        </div>
        <div className="text-xs text-emerald-200/90 leading-relaxed">
          يرجى التواجد أمام باب العيادة عند ظهور رقم تذكرتك والتأكد من إبراز تذكرة الكشف أو الـ QR لطاقم التمريض.
        </div>
      </div>

    </div>
  );
};
