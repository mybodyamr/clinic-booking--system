import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ShieldCheck, 
  User, 
  Lock, 
  ArrowRight, 
  KeyRound, 
  AlertCircle,
  Stethoscope,
  UserCheck,
  Receipt,
  LayoutDashboard,
  Hospital,
  HelpCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DEMO_CREDENTIALS } from '../data/mockData';

export const LoginView: React.FC = () => {
  const { login, navigate, resetPasswordByAdmin } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'success'>('request');
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotReason, setForgotReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setIsLoading(true);
    const result = await login(username, password);
    setIsLoading(false);

    if (!result.success) {
      setError(result.error || 'بيانات الدخول غير صحيحة، يرجى التحقق من اسم المستخدم أو استخدام الحسابات التجريبية بالأسفل');
    }
  };

  const handleQuickLogin = async (demoUser: string, demoPass: string) => {
    setUsername(demoUser);
    setPassword(demoPass);
    setError('');
    setIsLoading(true);
    await login(demoUser, demoPass);
    setIsLoading(false);
  };

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsername.trim()) return;
    setForgotStep('success');
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 pb-16">
      
      {/* زر العودة للرئيسية */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('landing')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 bg-white dark:bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors shadow-xs"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للرئيسية</span>
        </button>

        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          بوابة الدخول الموحدة للموظفين
        </div>
      </div>

      {/* بطاقة تسجيل الدخول الرئيسية */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-800/95 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700/80 shadow-xl space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-800 text-amber-400 mx-auto flex items-center justify-center shadow-md border border-emerald-700">
            <Hospital className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            تسجيل دخول الكادر الطبي والإداري
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto">
            منظومة دخول موحدة للأطباء، ومسؤولي الاستقبال، والخزينة، وإدارة العيادات
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-center gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <div>{error}</div>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-4 h-4 text-emerald-600" />
              <span>اسم المستخدم أو الكود الوظيفي:</span>
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="مثال: admin أو reception أو doctor"
              dir="ltr"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>كلمة المرور:</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotUsername(username);
                  setForgotStep('request');
                  setForgotPasswordOpen(true);
                }}
                className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>نسيت كلمة المرور؟</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={isLoading}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
          >
            <KeyRound className="w-4 h-4 text-amber-300" />
            <span>{isLoading ? 'جاري التحقق...' : 'تسجيل الدخول والتوجيه للوحة التحكم'}</span>
          </motion.button>
        </form>

        {/* الحسابات التجريبية للاختبار السريع الفوري (Demo-Only Feature) */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700/60 space-y-3">
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-[11px] leading-relaxed flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold block">ملاحظة أمان بيئة العرض التجريبية (Demo-Only):</strong>
              أزرار الدخول السريع أدناه مخصصة لاختبار المنظومة فقط بدون كلمة مرور. يجب إزالتها بالكامل عند ربط النظام بقاعدة بيانات حقيقية ونشره الفعلي لضمان الأمان.
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              حسابات تجريبية سريعة لتجربة الأدوار المختلفة:
            </span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
              اضغط للدخول المباشر
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {DEMO_CREDENTIALS.map((cred) => (
              <button
                key={cred.username}
                type="button"
                onClick={() => handleQuickLogin(cred.username, cred.password)}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-600 dark:hover:border-emerald-500 bg-slate-50 dark:bg-slate-900/60 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/40 text-right transition-all group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {cred.role === 'admin' && <LayoutDashboard className="w-4 h-4 text-emerald-600" />}
                    {cred.role === 'reception' && <UserCheck className="w-4 h-4 text-amber-600" />}
                    {cred.role === 'cashier' && <Receipt className="w-4 h-4 text-teal-600" />}
                    {cred.role === 'doctor' && <Stethoscope className="w-4 h-4 text-blue-600" />}
                    <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                      {cred.role === 'admin' ? 'الإدارة' : cred.role === 'reception' ? 'الاستقبال' : cred.role === 'cashier' ? 'الخزينة' : 'طبيب باطنة'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">({cred.username})</span>
                </div>
                <div className="text-[11px] text-slate-500 line-clamp-1">
                  {cred.displayName}
                </div>
              </button>
            ))}
          </div>
        </div>

      </motion.div>

      {/* للمرضى: التذكير بعدم الحاجة لتسجيل الدخول */}
      <div className="text-center p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
        <span className="font-bold block">هل أنت مريض أو مراجع؟</span>
        <span>لا تحتاج لتسجيل الدخول إطلاقاً. يمكنك حجز موعدك مباشرة واستلام التذكرة من الصفحة الرئيسية.</span>
        <div className="pt-2">
          <button
            onClick={() => navigate('booking')}
            className="font-bold underline text-emerald-700 dark:text-emerald-400 hover:text-emerald-800"
          >
            اضغط هنا للانتقال المباشر لحجز كشف طبي
          </button>
        </div>
      </div>

      {/* نافذة استعادة / إعادة تعيين كلمة المرور (Forgot Password Flow) */}
      {forgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  استعادة وتعيين كلمة المرور
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setForgotPasswordOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {forgotStep === 'request' ? (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  لحماية بيانات المرضى والمنظومة، يتم إعادة تعيين كلمات المرور للكادر الطبي والإداري عبر مراجعة المشرف العام أو تقديم طلب استعادة فوري:
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    اسم المستخدم أو الكود الوظيفي:
                  </label>
                  <input
                    type="text"
                    required
                    value={forgotUsername}
                    onChange={(e) => setForgotUsername(e.target.value)}
                    placeholder="مثال: reception أو doctor أو admin"
                    dir="ltr"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    رقم الهاتف المسجل لاستلام رمز التحقق:
                  </label>
                  <input
                    type="tel"
                    required
                    value={forgotPhone}
                    onChange={(e) => setForgotPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    dir="ltr"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    سبب طلب إعادة التعيين (اختياري):
                  </label>
                  <textarea
                    rows={2}
                    value={forgotReason}
                    onChange={(e) => setForgotReason(e.target.value)}
                    placeholder="فقدان الرمز أو تعذر الدخول..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setForgotPasswordOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md cursor-pointer transition-colors"
                  >
                    إرسال طلب الاستعادة
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 py-2 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    تم استلام طلب استعادة الحساب بنجاح
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
                    تم إرسال تعليمات إعادة التعيين ورابط التحقق إلى الهاتف أو المشرف المسؤول عن حساب ({forgotUsername}).
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-[11px] text-slate-600 dark:text-slate-400 text-right space-y-1">
                  <div><strong>للحالات العاجلة:</strong> يرجى مراجعة مدير المنظومة في غرفة الإدارة لتعيين كلمة مرور مؤقتة فوراً.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setForgotPasswordOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  العودة لتسجيل الدخول
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}

    </div>
  );
};
