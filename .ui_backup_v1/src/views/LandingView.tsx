import React from 'react';
import { 
  CalendarPlus, 
  ShieldCheck, 
  Clock, 
  MapPin, 
  PhoneCall, 
  CheckCircle2, 
  MonitorPlay,
  ArrowLeft,
  Stethoscope,
  Building2,
  LockKeyhole
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getLocalDateStr } from '../services/scheduleService';

export const LandingView: React.FC = () => {
  const { 
    navigate, 
    clinics, 
    doctors, 
    bookings, 
    supportInfoText, 
    getActiveClinicsForBooking,
    currentUser 
  } = useApp();

  const todayStr = getLocalDateStr();
  const todayBookingsCount = bookings.filter(b => b.date === todayStr && b.status !== 'cancelled').length;
  const availableDoctorsCount = doctors.filter(d => d.status === 'available').length;
  const activeClinicsWithDoctors = getActiveClinicsForBooking();

  return (
    <div className="space-y-8 pb-12">
      
      {/* الشريط المؤسسي العلوي + لوحة المؤشرات الرقمية الموحدة */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
        <div className="p-6 sm:p-8 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-xs bg-emerald-600 inline-block" />
              <span>بوابة الخدمات الطبية الرقمية — عيادات الجمعية الشرعية</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug">
              نظام حجز الكشوفات الطبية وإدارة طوابير العيادات
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              إصدار فوري لتذكرة الكشف الإلكترونية المزودة برمز التحقق (QR Code)، مع متابعة حية ومباشرة لحركة الدور في العيادات التخصصية.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => navigate('booking')}
              className="px-5 py-3 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
            >
              <CalendarPlus className="w-4 h-4" />
              <span>حجز تذكرة كشف الآن</span>
            </button>
            <button
              onClick={() => navigate('queue')}
              className="px-4 py-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              <MonitorPlay className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>شاشة الانتظار الحية</span>
            </button>
          </div>
        </div>

        {/* شريط الإحصائيات الهندسي الموحد (Tabular Ledger Bar) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-200 dark:divide-slate-800 bg-slate-50/60 dark:bg-slate-950/50">
          <div className="p-4 sm:px-6 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">العيادات التخصصية</span>
            <div className="text-left">
              <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono">{clinics.length}</span>
              <span className="text-[11px] text-slate-500 mr-1">عيادة</span>
            </div>
          </div>

          <div className="p-4 sm:px-6 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">الأطباء المناوبون الآن</span>
            <div className="text-left">
              <span className="text-xl font-extrabold text-emerald-800 dark:text-emerald-400 font-mono">{availableDoctorsCount}</span>
              <span className="text-[11px] text-slate-500 mr-1">طبيب متاح</span>
            </div>
          </div>

          <div className="p-4 sm:px-6 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">حجوزات اليوم المسجلة</span>
            <div className="text-left">
              <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono">{todayBookingsCount}</span>
              <span className="text-[11px] text-slate-500 mr-1">حالة</span>
            </div>
          </div>

          <div className="p-4 sm:px-6 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">نظام الرسوم الخيري</span>
            <div className="text-left">
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">مدعّم + إعفاء تكافلي</span>
            </div>
          </div>
        </div>
      </section>

      {/* الشبكة الرئيسية غير المتماثلة: (7 أعمدة بوابة المريض والعيادات المفتوحة | 5 أعمدة بوابة الموظفين والدعم) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* العمود الأيمن (7 أعمدة): مسار المريض + جدول العيادات المتاحة اليوم */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* بطاقة مسار حجز المريض في 3 خطوات عملية */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  خطوات الحجز والمراجعة الطبية للمريض
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  حجز مباشر لليوم الحالي بدون الحاجة لإنشاء حساب مسبق
                </p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                متاح الآن
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-emerald-800 dark:text-emerald-400 font-mono">01</span>
                  <span className="text-[10px] font-semibold text-slate-400">من الهاتف أو الموقع</span>
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">إصدار التذكرة والـ QR</div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  اختر العيادة، اكتب الاسم الثلاثي ورقم الهاتف، واحفظ صورة التذكرة.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-emerald-800 dark:text-emerald-400 font-mono">02</span>
                  <span className="text-[10px] font-semibold text-slate-400">فور الوصول للمركز</span>
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">تأكيد شباك الخزينة</div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  أبرز رمز الـ QR للكاشير لسداد الكشف (أو التأمين / الإعفاء) وتفعيل دورك.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-emerald-800 dark:text-emerald-400 font-mono">03</span>
                  <span className="text-[10px] font-semibold text-slate-400">مكتب الاستقبال</span>
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">الدخول لغرفة الكشف</div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  تابع رقمك على شاشة الانتظار وتوجه للاستقبال عند النداء على تذكرتك.
                </p>
              </div>
            </div>

            <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>تعمل صورة التذكرة المحفوظة على الهاتف حتى بدون اتصال بالإنترنت عند الوصول.</span>
              </div>
              <button
                onClick={() => navigate('booking')}
                className="px-4 py-2.5 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 shrink-0 transition-colors cursor-pointer"
              >
                <span>البدء بحجز تذكرة</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* جدول العيادات التخصصية المتاحة للحجز اليوم */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  بيان العيادات التخصصية المفتوحة اليوم ({activeClinicsWithDoctors.length})
                </h3>
              </div>
              <button
                onClick={() => navigate('booking')}
                className="text-xs font-bold text-emerald-800 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                عرض صفحة الحجز الكاملة ←
              </button>
            </div>

            {activeClinicsWithDoctors.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                لا توجد عيادات مفتوحة في هذه اللحظة — يرجى مراجعة مواعيد العمل أو التواصل مع الاستقبال.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {activeClinicsWithDoctors.map(({ clinic, assignedDoctor }) => {
                  const waitingCount = bookings.filter(
                    b => b.clinicId === clinic.id && b.date === todayStr && b.status === 'waiting' && (b.paymentStatus === 'paid' || b.paymentStatus === 'exempt')
                  ).length;

                  return (
                    <div
                      key={clinic.id}
                      onClick={() => navigate('booking')}
                      className="p-4 sm:px-5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {clinic.name}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            ({clinic.room} • {clinic.floor})
                          </span>
                        </div>
                        {assignedDoctor && (
                          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                              <Stethoscope className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                              <span>{assignedDoctor.name}</span>
                            </span>
                            <span>•</span>
                            <span>المواعيد: {assignedDoctor.scheduleHours || clinic.workingHours || '9:00 ص - 9:00 م'}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                        <div className="text-right sm:text-left">
                          <div className="text-xs font-extrabold text-slate-900 dark:text-white font-mono">
                            {clinic.fee} ج.م
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            بالانتظار: {waitingCount}
                          </div>
                        </div>
                        <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-emerald-900 hover:text-white text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors">
                          احجز الآن
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* العمود الأيسر (5 أعمدة): بوابة الكادر الطبي والإداري + معلومات المركز */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* بوابة دخول الموظفين والكادر الطبي */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-2xs">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <LockKeyhole className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                  <span>منطقة العمل الداخلية (محمية بصلاحيات الأدوار)</span>
                </div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  بوابة الكادر الطبي والإداري
                </h2>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              مخصصة للأطباء، مسؤولي الاستقبال، مسؤولي الخزينة والتحصيل، وإدارة النظام لمتابعة الحالات وتأكيد الحجوزات.
            </p>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                <div className="font-bold text-slate-900 dark:text-white">الخزينة والتحصيل</div>
                <div className="text-[11px] text-slate-500 mt-0.5">تأكيد السداد، الإعفاء، والحجز الحضوري</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                <div className="font-bold text-slate-900 dark:text-white">مكتب الاستقبال</div>
                <div className="text-[11px] text-slate-500 mt-0.5">إدارة الطابور، مسح الـ QR، وحضور الأطباء</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                <div className="font-bold text-slate-900 dark:text-white">شاشة الطبيب</div>
                <div className="text-[11px] text-slate-500 mt-0.5">تنظيم جدول المناوبات وحالة التواجد</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                <div className="font-bold text-slate-900 dark:text-white">الإدارة العامة</div>
                <div className="text-[11px] text-slate-500 mt-0.5">إدارة العيادات، الحسابات، والتقارير</div>
              </div>
            </div>

            {currentUser ? (
              <button
                onClick={() => navigate(currentUser.role === 'admin' ? 'admin' : currentUser.role)}
                className="w-full py-3 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-emerald-800 dark:hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>الانتقال إلى لوحة عملي ({currentUser.displayName})</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('login')}
                className="w-full py-3 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>تسجيل دخول الموظفين</span>
              </button>
            )}
          </div>

          {/* بيانات المركز ومواعيد العمل والاستفسارات */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              معلومات المقر ومواعيد العمل الرسمية
            </h3>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-800 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">عنوان المجمع الطبي:</span>
                  <span>المقر الرئيسي للجمعية الشرعية — مجمع العيادات التخصصية (الطابق الأول والثاني)</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-emerald-800 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">ساعات العمل اليومية:</span>
                  <span>السبت إلى الخميس: الفترة الصباحية (9:00 ص - 2:00 م) | الفترة المسائية (4:00 م - 9:00 م)</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <PhoneCall className="w-4 h-4 text-emerald-800 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">الاستفسارات وخدمة المراجعين:</span>
                  <p className="leading-relaxed mt-0.5">{supportInfoText}</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
