import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowRight, 
  Maximize2, 
  Minimize2,
  MonitorPlay,
  Clock,
  BellRing,
  Stethoscope,
  MapPin,
  UserCheck,
  Sparkles,
  HeartPulse,
  Baby,
  Eye,
  Bone,
  Smile,
  Ear,
  Activity,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getLocalDateStr } from '../services/scheduleService';
import heroHospitalImg from '../assets/images/hospital_doctor_hero_1790597353764.jpg';

export const QueueView: React.FC = () => {
  const { clinics, bookings, doctors, navigate } = useApp();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = getLocalDateStr();

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // اختصار تخصص العيادة ليظهر بشكل واضح ومباشر (مثل: باطنة، أطفال، رمد، عظام...)
  const getShortSpecialty = (fullName: string) => {
    return fullName.replace(/^عيادة\s+/, '').trim();
  };

  const getClinicIcon = (iconName: string, name: string, isBusy: boolean) => {
    const colorClass = isBusy ? 'text-amber-300' : 'text-emerald-300';
    if (iconName === 'HeartPulse' || name.includes('باطنة')) return <HeartPulse className={`w-5 h-5 ${colorClass}`} />;
    if (iconName === 'Baby' || name.includes('أطفال')) return <Baby className={`w-5 h-5 ${colorClass}`} />;
    if (iconName === 'Eye' || name.includes('رمد')) return <Eye className={`w-5 h-5 ${colorClass}`} />;
    if (iconName === 'Bone' || name.includes('عظام')) return <Bone className={`w-5 h-5 ${colorClass}`} />;
    if (iconName === 'Smile' || name.includes('أسنان')) return <Smile className={`w-5 h-5 ${colorClass}`} />;
    if (iconName === 'Ear' || name.includes('أنف')) return <Ear className={`w-5 h-5 ${colorClass}`} />;
    if (iconName === 'Sparkles' || name.includes('جلدية')) return <Sparkles className={`w-5 h-5 ${colorClass}`} />;
    return <Activity className={`w-5 h-5 ${colorClass}`} />;
  };

  // حساب إحصائيات سريعة لأعلى الشاشة
  const busyClinicsCount = clinics.filter(clinic =>
    bookings.some(
      b =>
        b.clinicId === clinic.id &&
        b.date === todayStr &&
        b.status === 'in-progress' &&
        (b.paymentStatus === 'paid' || b.paymentStatus === 'exempt')
    )
  ).length;

  const availableClinicsCount = clinics.length - busyClinicsCount;

  return (
    <div className={`space-y-8 pb-16 ${isFullscreen ? 'fixed inset-0 z-50 bg-[#050E0B] p-6 overflow-y-auto' : ''}`}>
      
      {/* 1. ترويسة شاشة الانتظار الفخمة مع دليل الألوان المتباينة */}
      <div className="relative rounded-3xl overflow-hidden bg-slate-950 text-white p-6 sm:p-8 shadow-2xl border border-white/10">
        <img
          src={heroHospitalImg}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-slate-950/95 via-emerald-950/90 to-slate-950/85" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <button
              onClick={() => navigate('landing')}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white transition-colors cursor-pointer shrink-0"
              title="العودة للرئيسية"
            >
              <ArrowRight className="w-5 h-5" />
            </button>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-amber-300 text-xs font-bold">
                <MonitorPlay className="w-3.5 h-3.5 text-amber-400" />
                <span>شاشة النداء الآلي ومتابعة الأدوار بالعيادات</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                لوحة دخول المرضى للعيادات التخصصية
              </h1>
              <p className="text-xs sm:text-sm text-slate-300">
                متابعة مباشرة لرقم الدور، اسم المريض، وتخصص العيادة مع تنبيه الاستعداد للدخول
              </p>
            </div>
          </div>

          {/* الساعة الرقمية + مؤشر التباين اللوني (مشغولة vs متاحة) */}
          <div className="flex flex-wrap items-center gap-3 self-stretch lg:self-center justify-between lg:justify-end">
            
            {/* دليل الألوان المتباينة */}
            <div className="flex items-center gap-2.5 bg-white/[0.06] backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15 text-xs font-bold">
              <div className="flex items-center gap-1.5 text-amber-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <span>عيادة مشغولة ({busyClinicsCount})</span>
              </div>
              <span className="text-white/20">|</span>
              <div className="flex items-center gap-1.5 text-emerald-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span>عيادة متاحة ({availableClinicsCount})</span>
              </div>
            </div>

            {/* الساعة */}
            <div className="text-left font-mono bg-white/[0.08] backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15">
              <div className="text-base font-extrabold text-amber-400 flex items-center gap-1.5 justify-end">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>{currentTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              <div className="text-[11px] text-slate-300 font-sans font-medium">
                {currentTime.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>

            <button
              onClick={toggleFullscreen}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white transition-colors cursor-pointer"
              title="ملء الشاشة"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 2. شبكة بطاقات العيادات المنفصلة (Professional Grid Layout) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clinics.map((clinic, idx) => {
          const clinicBookings = bookings
            .filter(
              b =>
                b.clinicId === clinic.id &&
                b.date === todayStr &&
                b.status !== 'cancelled' &&
                (b.paymentStatus === 'paid' || b.paymentStatus === 'exempt')
            )
            .sort((a, b) => {
              const timeA = new Date(a.paidAt || a.createdAt).getTime();
              const timeB = new Date(b.paidAt || b.createdAt).getTime();
              return timeA - timeB;
            });

          // المريض الموجود داخل غرفة الكشف حالياً
          const inProgressPatient = clinicBookings.find(b => b.status === 'in-progress');
          // قائمة الانتظار المرتبة
          const waitingQueue = clinicBookings.filter(b => b.status === 'waiting');
          // المريض الذي يستعد للدخول (إما أول منتظر أثناء انشغال العيادة، أو أول منتظر ليدخل فوراً)
          const nextPreparingPatient = waitingQueue[0] || null;
          // المريض المعروض كـبطاقة رئيسية في العيادة
          const primaryPatient = inProgressPatient || nextPreparingPatient;

          const doctor = doctors.find(d => d.clinicId === clinic.id);
          const shortSpecialty = getShortSpecialty(clinic.name);

          // تحديد ما إذا كانت العيادة مشغولة حالياً بكشف جاري أو متاحة
          const isClinicBusy = Boolean(inProgressPatient);

          return (
            <motion.div
              key={clinic.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className={`rounded-3xl overflow-hidden flex flex-col justify-between transition-all duration-300 shadow-2xl border-2 ${
                isClinicBusy
                  ? 'bg-gradient-to-b from-[#231608] via-[#17120B] to-slate-950 border-amber-400/80 shadow-amber-500/10'
                  : 'bg-gradient-to-b from-[#07221B] via-[#071813] to-slate-950 border-emerald-500/60 shadow-emerald-500/10'
              }`}
            >
              {/* أ. شريط حالة العيادة العلوي المتباين (مشغولة vs متاحة) */}
              <div
                className={`px-5 py-3.5 flex items-center justify-between gap-2 border-b ${
                  isClinicBusy
                    ? 'bg-gradient-to-l from-amber-500/25 via-amber-500/15 to-transparent border-amber-400/30'
                    : 'bg-gradient-to-l from-emerald-500/25 via-emerald-500/15 to-transparent border-emerald-500/30'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      isClinicBusy
                        ? 'bg-amber-400/20 border-amber-400/50'
                        : 'bg-emerald-500/20 border-emerald-400/50'
                    }`}
                  >
                    {getClinicIcon(clinic.iconName || clinic.icon || 'Activity', clinic.name, isClinicBusy)}
                  </div>
                  <div className="truncate">
                    <h2 className="text-base sm:text-lg font-extrabold text-white truncate">
                      {clinic.name}
                    </h2>
                    <div className="text-[11px] text-slate-300 flex items-center gap-2 truncate">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-400" />
                        {clinic.room}
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 truncate">
                        <Stethoscope className="w-3 h-3 text-slate-400" />
                        {doctor?.name || 'طبيب استشاري'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* شارة الحالة المتباينة بوضوح */}
                <span
                  className={`px-3 py-1 rounded-full text-xs font-extrabold border flex items-center gap-1.5 shrink-0 ${
                    isClinicBusy
                      ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-500/20'
                      : 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isClinicBusy ? 'bg-slate-950 animate-ping' : 'bg-slate-950'
                    }`}
                  />
                  <span>{isClinicBusy ? 'مشغولة الآن' : 'متاحة الآن'}</span>
                </span>
              </div>

              {/* ب. جسم البطاقة الرئيسي: رقم الدور (T006) + اسم المريض + تخصص العيادة بجانب بعض */}
              <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                {primaryPatient ? (
                  <div className="space-y-3.5">
                    {/* عنوان حالة المريض المعروض */}
                    <div className="flex items-center justify-between text-xs font-bold">
                      {isClinicBusy ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-300">
                          <BellRing className="w-4 h-4 text-amber-400 animate-bounce" />
                          <span>المريض المتواجد داخل الكشف الآن:</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-emerald-300">
                          <UserCheck className="w-4 h-4 text-emerald-400" />
                          <span>المريض المطلوب دخوله الآن:</span>
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-slate-400">
                        دور #{primaryPatient.queuePosition}
                      </span>
                    </div>

                    {/* الشريط الموحد الواضح: [T006]  [عمرو]  [باطنة] */}
                    <div
                      className={`p-4 rounded-2xl border-2 flex items-center justify-between gap-3 shadow-lg ${
                        isClinicBusy
                          ? 'bg-amber-400/15 border-amber-400/70'
                          : 'bg-emerald-500/15 border-emerald-400/70'
                      }`}
                    >
                      {/* 1. رقم الدور (T006) */}
                      <span
                        className={`font-mono text-xl sm:text-2xl font-black px-3.5 py-2 rounded-xl shrink-0 tracking-wider shadow-sm ${
                          isClinicBusy
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-emerald-400 text-slate-950'
                        }`}
                      >
                        {primaryPatient.ticketNumber}
                      </span>

                      {/* 2. اسم المريض بجانب الرقم */}
                      <span className="text-lg sm:text-xl font-extrabold text-white truncate flex-1 text-center">
                        {primaryPatient.patientName}
                      </span>

                      {/* 3. تخصص العيادة بجانب الاسم */}
                      <span
                        className={`text-xs sm:text-sm font-extrabold px-3 py-1.5 rounded-xl border shrink-0 ${
                          isClinicBusy
                            ? 'bg-amber-950/90 text-amber-300 border-amber-500/50'
                            : 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
                        }`}
                      >
                        {shortSpecialty}
                      </span>
                    </div>

                    {/* ج. تنبيه واضح بأن المريض يستعد للدخول */}
                    {isClinicBusy && nextPreparingPatient ? (
                      <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-amber-400/40 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-extrabold text-amber-300">
                          <span className="flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                            <span>يستعد للدخول بعد الحجز الحالي:</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-200">
                            استعد للدخول
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="font-mono text-sm font-black px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/40 shrink-0">
                            {nextPreparingPatient.ticketNumber}
                          </span>
                          <span className="text-sm font-extrabold text-white truncate flex-1 text-center">
                            {nextPreparingPatient.patientName}
                          </span>
                          <span className="text-xs font-bold text-slate-300 bg-white/10 px-2.5 py-1 rounded-lg shrink-0">
                            {shortSpecialty}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center gap-2 text-xs font-extrabold text-emerald-200">
                        <BellRing className="w-4 h-4 text-emerald-300 animate-pulse shrink-0" />
                        <span>يرجى من المريض الاستعداد والتوجه لباب العيادة للدخول الآن</span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* حالة العيادة المتاحة تماماً بدون منتظرين حالياً */
                  <div className="py-8 px-4 rounded-2xl bg-white/[0.04] border border-dashed border-emerald-500/30 text-center space-y-2 my-auto">
                    <div className="text-sm font-extrabold text-emerald-300">
                      العيادة متاحة وجاهزة لاستقبال المراجعين فوراً
                    </div>
                    <p className="text-xs text-slate-400">
                      تخصص: <strong className="text-white">{shortSpecialty}</strong> • لا يوجد انتظار حالياً
                    </p>
                  </div>
                )}

                {/* د. شريط سفلي بعدد المنتظرين بالعيادة */}
                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                  <span>إجمالي المنتظرين بالعيادة:</span>
                  <span className="font-mono font-extrabold text-white bg-white/10 px-2.5 py-0.5 rounded-lg">
                    {waitingQueue.length} مراجع
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

    </div>
  );
};
