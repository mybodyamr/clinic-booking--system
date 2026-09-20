import React from 'react';
import { motion } from 'motion/react';
import { 
  CalendarPlus, 
  ShieldCheck, 
  Clock, 
  Users, 
  Sparkles, 
  MapPin, 
  PhoneCall, 
  CheckCircle, 
  Activity
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const LandingView: React.FC = () => {
  const { navigate, clinics, doctors, bookings, supportInfoText } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];
  const todayBookingsCount = bookings.filter(b => b.date === todayStr && b.status !== 'cancelled').length;
  const availableDoctorsCount = doctors.filter(d => d.status === 'available').length;

  return (
    <div className="space-y-16 pb-16">
      
      {/* القسم الرئيسي (المساران الأساسيان بدقة ووضوح فائق) */}
      <section className="relative overflow-hidden pt-8 pb-12 sm:pt-12 sm:pb-16 bg-gradient-to-b from-emerald-900/10 via-emerald-800/5 to-transparent dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 rounded-3xl p-6 sm:p-10 border border-emerald-900/10 dark:border-emerald-800/30">
        
        {/* خلفية جمالية خافتة */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
          
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>خدمة طبية خيرية متطورة لجميع أفراد المجتمع</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight"
          >
            رعاية صحية بأرقى المعايير، <br className="hidden sm:inline" />
            تنظيم ذكي لدورك دون عناء الانتظار
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed"
          >
            نظام عيادات الجمعية الشرعية التخصصية يتيح لك حجز موعد الكشف مباشرة واستلام تذكرة رقمية فورية برمز QR ورقم الدور، ومتابعة طابور العيادة لحظة بلحظة.
          </motion.p>

          {/* المساران الحصريان الإلزاميان (Patient Direct Booking + Staff Unified Login) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto text-right"
          >
            {/* المسار الأول: حجز موعد كشف طبي (بدون تسجيل دخول إطلاقاً) */}
            <div 
              onClick={() => navigate('booking')}
              className="group cursor-pointer p-6 rounded-2xl bg-white dark:bg-slate-800 border-2 border-emerald-600/70 hover:border-emerald-700 dark:border-emerald-600 hover:shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 left-0 h-1.5 bg-emerald-600" />
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <CalendarPlus className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-2 flex items-center justify-between">
                  <span>حجز موعد كشف طبي</span>
                  <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                    متاح للجميع مجاناً
                  </span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  حجز فوري مباشر لجميع العيادات التخصصية <strong>بدون الحاجة لإنشاء حساب أو تسجيل دخول</strong>، مع استلام التذكرة ورمز الـ QR مباشرة.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                <span>ابدأ الحجز الآن</span>
                <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span>
              </div>
            </div>

            {/* المسار الثاني: دخول الكادر الطبي والإداري (بوابة موحدة للمدير، الاستقبال، الصراف، الطبيب) */}
            <div 
              onClick={() => navigate('login')}
              className="group cursor-pointer p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-6 h-6 text-slate-700 dark:text-slate-200" />
                </div>
                <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-2 flex items-center justify-between">
                  <span>بوابة الكادر الطبي والإداري</span>
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                    تسجيل دخول موحد
                  </span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  شاشة دخول موحدة لكافة الموظفين المصرح لهم: (<strong>الإدارة، شؤون الاستقبال، الخزينة والصندوق، والأطباء</strong>) مع توجيه تلقائي حسب الصلاحية.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-slate-700 dark:text-slate-300 font-bold text-sm">
                <span>دخول الموظفين</span>
                <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span>
              </div>
            </div>

          </motion.div>

        </div>
      </section>

      {/* شريط الإحصائيات والأرقام المباشرة */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{todayBookingsCount}</div>
            <div className="text-xs text-slate-500">كشوفات مسجلة اليوم</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{clinics.length}</div>
            <div className="text-xs text-slate-500">عيادة تخصصية نشطة</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">15 دقيقة</div>
            <div className="text-xs text-slate-500">متوسط وقت الكشف</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{availableDoctorsCount}</div>
            <div className="text-xs text-slate-500">أطباء متاحون الآن</div>
          </div>
        </div>
      </section>

      {/* قسم الطمأنينة والمصداقية الخيرية */}
      <section className="rounded-2xl p-6 sm:p-8 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">رسوم رمزية ودعم الحالات غير القادرة</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              أسعار الكشوفات رمزية لخدمة أهالينا، مع إعفاءات كاملة للحالات المتعففة بقرار لجنة التكافل الاجتماعي.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">أجهزة ومعدات طبية متقدمة</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              عيادات مجهزة بأحدث أجهزة السونار، مناظير الأنف والأذن، ووحدات الأسنان الحديثة لضمان دقة التشخيص.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">استفسارات ومساعدة فورية</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {supportInfoText}
            </p>
          </div>
        </div>
      </section>

    </div>
  );
};
