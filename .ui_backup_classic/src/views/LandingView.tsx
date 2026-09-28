import React from 'react';
import { motion } from 'motion/react';
import { 
  CalendarPlus, 
  ShieldCheck, 
  Clock, 
  HeartPulse, 
  Baby, 
  Eye, 
  Bone, 
  Smile, 
  Ear, 
  Sparkles, 
  Activity,
  MapPin, 
  PhoneCall, 
  CheckCircle2, 
  Users,
  MonitorPlay,
  ArrowLeft,
  Stethoscope,
  Hospital
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getLocalDateStr } from '../services/scheduleService';

export const LandingView: React.FC = () => {
  const { navigate, clinics, doctors, bookings, supportInfoText, getActiveClinicsForBooking } = useApp();

  const todayStr = getLocalDateStr();
  const todayBookingsCount = bookings.filter(b => b.date === todayStr && b.status !== 'cancelled').length;
  const availableDoctorsCount = doctors.filter(d => d.status === 'available').length;
  const activeClinicsWithDoctors = getActiveClinicsForBooking();

  const getClinicIcon = (iconName: string) => {
    switch (iconName) {
      case 'HeartPulse': return <HeartPulse className="w-6 h-6 text-rose-500" />;
      case 'Baby': return <Baby className="w-6 h-6 text-amber-500" />;
      case 'Eye': return <Eye className="w-6 h-6 text-emerald-500" />;
      case 'Bone': return <Bone className="w-6 h-6 text-indigo-500" />;
      case 'Smile': return <Smile className="w-6 h-6 text-teal-500" />;
      case 'Ear': return <Ear className="w-6 h-6 text-blue-500" />;
      case 'Sparkles': return <Sparkles className="w-6 h-6 text-fuchsia-500" />;
      default: return <Activity className="w-6 h-6 text-emerald-600" />;
    }
  };

  return (
    <div className="space-y-10 pb-16">
      
      {/* القسم الترحيبي الرئيسي (Hero Banner) */}
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-900 text-white p-6 sm:p-10 lg:p-12 shadow-2xl border border-emerald-800/60">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-5 text-right">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-800/70 border border-emerald-600/40 text-amber-300 text-xs font-bold">
              <Sparkles className="w-4 h-4" />
              <span>رعاية طبية تكافلية متميزة بأسعار رمزية</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight text-white">
              عيادات الجمعية الشرعية التخصصية
            </h1>

            <p className="text-sm sm:text-base text-emerald-100/90 leading-relaxed max-w-2xl">
              منظومة رقمية متكاملة لحجز الكشوفات الطبية واستخراج تذكرة الدور المزودة برمز (QR Code) فوراً بدون الحاجة لإنشاء حساب، مع متابعة حية ومباشرة لحركة الطابور في كافة العيادات.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('booking')}
                className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-extrabold text-sm sm:text-base shadow-lg flex items-center gap-2 cursor-pointer transition-all"
              >
                <CalendarPlus className="w-5 h-5" />
                <span>احجز تذكرة كشف الآن</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('queue')}
                className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm sm:text-base border border-white/20 backdrop-blur-xs flex items-center gap-2 cursor-pointer transition-all"
              >
                <MonitorPlay className="w-5 h-5 text-amber-300" />
                <span>شاشة الانتظار الحية</span>
              </motion.button>
            </div>
          </div>

          {/* بطاقات الإحصائيات السريعة داخل البانر */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3.5">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1">
              <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center mb-2">
                <Hospital className="w-5 h-5" />
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">{clinics.length}</div>
              <div className="text-xs text-emerald-200 font-medium">عيادات تخصصية مجهزة</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1">
              <div className="w-9 h-9 rounded-xl bg-emerald-400/20 text-emerald-300 flex items-center justify-center mb-2">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">{availableDoctorsCount}</div>
              <div className="text-xs text-emerald-200 font-medium">أطباء متواجدون اليوم</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1">
              <div className="w-9 h-9 rounded-xl bg-sky-400/20 text-sky-300 flex items-center justify-center mb-2">
                <Users className="w-5 h-5" />
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">{todayBookingsCount}</div>
              <div className="text-xs text-emerald-200 font-medium">حجوزات اليوم النشطة</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1">
              <div className="w-9 h-9 rounded-xl bg-rose-400/20 text-rose-300 flex items-center justify-center mb-2">
                <HeartPulse className="w-5 h-5" />
              </div>
              <div className="text-lg font-extrabold text-amber-300">إعفاء خيري</div>
              <div className="text-xs text-emerald-200 font-medium">كشف مدعّم وتكافل اجتماعي</div>
            </div>
          </div>
        </div>
      </section>

      {/* البوابتان الرئيسيتان: بوابة المرضى والمراجعين & بوابة الكادر الطبي والإداري */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* البطاقة 1: بوابة المرضى والمراجعين */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-md flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
                <CalendarPlus className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                بدون حساب أو تسجيل مسبق
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              بوابة المرضى وحجز الكشوفات
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              احجز موعدك في أقل من دقيقة واحصل على تذكرة إلكترونية فورية تحتوي على رقم دورك ورمز QR، ثم توجه لشباك الخزينة عند وصولك لتأكيد الحجز والدخول للعيادة.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 pt-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>اختيار العيادة والطبيب المتاح لليوم الحالي بسهولة</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>تنزيل التذكرة كصورة واضحة على الهاتف تعمل بدون إنترنت</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>متابعة رقم الدور الحالي مباشرة عبر شاشة الانتظار الحية</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => navigate('booking')}
            className="w-full py-3.5 px-6 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <span>ابدأ حجز تذكرة الكشف الآن</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* البطاقة 2: بوابة الكادر الطبي والإداري */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-md flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                دخول الموظفين والأطباء
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              بوابة الكادر الطبي والإداري
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              منصة عمل موحدة ومحمية بصلاحيات الأدوار لإدارة الخزينة والتحصيل، مكتب الاستقبال والنداء الآلي، شاشة الطبيب المعالج، ولوحة الإدارة العامة والتقارير.
            </p>

            <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-slate-900 dark:text-white">الخزينة والتحصيل</div>
                <div className="text-[11px] text-slate-500 mt-0.5">تأكيد السداد، الإعفاء، والواتساب</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-slate-900 dark:text-white">مكتب الاستقبال</div>
                <div className="text-[11px] text-slate-500 mt-0.5">إدارة الطابور ومسح الـ QR</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-slate-900 dark:text-white">شاشة الطبيب</div>
                <div className="text-[11px] text-slate-500 mt-0.5">تحديث التواجد والجدول الأسبوعي</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-slate-900 dark:text-white">الإدارة والتقارير</div>
                <div className="text-[11px] text-slate-500 mt-0.5">إدارة العيادات، الحسابات، والإكسل</div>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('login')}
            className="w-full py-3.5 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>تسجيل دخول الموظفين والأطباء</span>
          </button>
        </div>

      </section>

      {/* قسم العيادات التخصصية المتاحة */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              العيادات التخصصية المتاحة اليوم
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              اختر العيادة التخصصية للاطلاع على الطبيب المناوب وحجز تذكرتك مباشرة
            </p>
          </div>
          <button
            onClick={() => navigate('booking')}
            className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline self-start sm:self-auto cursor-pointer"
          >
            عرض جميع العيادات والحجز ←
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(activeClinicsWithDoctors.length > 0 ? activeClinicsWithDoctors.map(i => i.clinic) : clinics).map((clinic) => {
            const doctor = doctors.find(d => d.clinicId === clinic.id);
            const waitingCount = bookings.filter(
              b => b.clinicId === clinic.id && b.date === todayStr && b.status === 'waiting' && (b.paymentStatus === 'paid' || b.paymentStatus === 'exempt')
            ).length;

            return (
              <div
                key={clinic.id}
                onClick={() => navigate('booking')}
                className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-emerald-500/50 transition-all cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700/70 flex items-center justify-center">
                      {getClinicIcon(clinic.iconName)}
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      الكشف: {clinic.fee} ج.م
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      {clinic.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {clinic.description}
                    </p>
                  </div>

                  {doctor && (
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700/70 text-xs space-y-1">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{doctor.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {clinic.room} • {clinic.floor}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-700/70 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    في الانتظار الآن: <strong className="text-emerald-700 dark:text-emerald-400 font-mono">{waitingCount}</strong>
                  </span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <span>احجز الآن</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* شريط معلومات التواصل ومواعيد العمل */}
      <section className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">عنوان المجمع الطبي</h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              المقر الرئيسي للجمعية الشرعية — مجمع العيادات التخصصية، الطابق الأول والثاني
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">مواعيد العمل الرسمية</h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              يومياً من السبت إلى الخميس — الفترة الصباحية (9 ص - 2 م) والفترة المسائية (4 م - 9 م)
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 flex items-center justify-center shrink-0">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">الاستفسارات وخدمة المراجعين</h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {supportInfoText}
            </p>
          </div>
        </div>
      </section>

    </div>
  );
};
