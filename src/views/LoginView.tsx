import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ShieldCheck, 
  User, 
  Lock, 
  ArrowRight, 
  KeyRound, 
  AlertCircle,
  Hospital,
  HelpCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  Mail,
  X,
  RefreshCw
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  requestPasswordRecoveryOtp,
  verifyPasswordRecoveryOtp,
  completePasswordRecoveryReset
} from '../services/supabaseService';
import {
  hashPassword,
  saveStaffPasswordHash,
  resetLoginAttempts
} from '../services/storage';

const normalizeOtpDigits = (value: string): string =>
  value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '')
    .slice(0, 6);

export const LoginView: React.FC = () => {
  const { login, navigate } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // حالات استعادة كلمة المرور (Phase 4: 3 خطوات + شاشة إتمام)
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'verify' | 'reset' | 'done'>('request');
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotResetToken, setForgotResetToken] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotErrorCode, setForgotErrorCode] = useState<string | undefined>(undefined);
  const [forgotInfoMessage, setForgotInfoMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const resetForgotPasswordModalState = (initialUsername = '') => {
    setForgotUsername(initialUsername);
    setForgotEmail('');
    setForgotOtp('');
    setForgotResetToken('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setShowForgotPassword(false);
    setForgotLoading(false);
    setForgotError('');
    setForgotErrorCode(undefined);
    setForgotInfoMessage('');
    setForgotStep('request');
  };

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
      setError(result.error || 'بيانات الدخول غير صحيحة، يرجى التحقق من اسم المستخدم وكلمة المرور');
    }
  };

  // الخطوة 1: طلب كود OTP عبر اسم المستخدم وبريد الاستعادة المسجل
  const handleRequestOtpSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setForgotError('');
    setForgotErrorCode(undefined);

    const cleanUser = forgotUsername.trim().toLowerCase();
    const cleanMail = forgotEmail.trim().toLowerCase();

    if (!cleanUser || !cleanMail) {
      setForgotError('يرجى إدخال اسم المستخدم والبريد الإلكتروني المسجل للاستعادة.');
      return;
    }

    setForgotLoading(true);
    const res = await requestPasswordRecoveryOtp(cleanUser, cleanMail);
    setForgotLoading(false);

    if (!res.success) {
      setForgotError(res.error || 'تعذر إرسال طلب استعادة كلمة المرور حالياً.');
      setForgotErrorCode(res.code);
      if (typeof res.retryAfterSeconds === 'number' && res.retryAfterSeconds > 0) {
        setResendCooldown(res.retryAfterSeconds);
      }
      return;
    }

    setForgotOtp('');
    setForgotResetToken('');
    setResendCooldown(60);
    setForgotInfoMessage(
      res.message ||
        'إذا كانت البيانات المدخلة مطابقة لحساب مفعل، فسيتم إرسال رمز التحقق المكون من 6 أرقام إلى البريد الإلكتروني المسجل.'
    );
    setForgotStep('verify');
  };

  // الخطوة 2: التحقق من كود OTP واستلام رمز إعادة التعيين أحادي الاستخدام
  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotErrorCode(undefined);

    const cleanOtp = normalizeOtpDigits(forgotOtp);
    if (!/^\d{6}$/.test(cleanOtp)) {
      setForgotError('يرجى إدخال رمز التحقق المكون من 6 أرقام بشكل صحيح.');
      return;
    }

    setForgotLoading(true);
    const res = await verifyPasswordRecoveryOtp(
      forgotUsername.trim().toLowerCase(),
      forgotEmail.trim().toLowerCase(),
      cleanOtp
    );
    setForgotLoading(false);

    if (!res.success || !res.resetToken) {
      setForgotError(res.error || 'رمز التحقق غير صحيح أو منتهي الصلاحية.');
      return;
    }

    setForgotResetToken(res.resetToken);
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotStep('reset');
  };

  // الخطوة 3: تعيين كلمة المرور الجديدة (6 أحرف على الأقل) وتحديث Supabase Auth
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotErrorCode(undefined);

    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      setForgotError('يجب ألا تقل كلمة المرور الجديدة عن 6 أحرف.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('كلمة المرور الجديدة وتأكيدها غير متطابقين.');
      return;
    }

    if (!forgotResetToken) {
      setForgotError('انتهت جلسة التحقق. يرجى طلب رمز تحقق جديد.');
      setForgotStep('request');
      return;
    }

    const cleanUser = forgotUsername.trim().toLowerCase();
    const cleanMail = forgotEmail.trim().toLowerCase();

    setForgotLoading(true);
    const res = await completePasswordRecoveryReset({
      username: cleanUser,
      recoveryEmail: cleanMail,
      resetToken: forgotResetToken,
      newPassword: forgotNewPassword,
      confirmPassword: forgotConfirmPassword,
    });
    setForgotLoading(false);

    if (!res.success) {
      setForgotError(res.error || 'تعذر تعيين كلمة المرور الجديدة.');
      return;
    }

    // تحديث التجزئة الاحتياطية محلياً وتصفير محاولات الدخول الفاشلة
    try {
      const newHash = await hashPassword(forgotNewPassword);
      saveStaffPasswordHash(cleanUser, newHash);
      resetLoginAttempts(cleanUser);
    } catch {
      // local fallback update is best-effort
    }

    setUsername(cleanUser);
    setPassword('');
    setForgotOtp('');
    setForgotResetToken('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotInfoMessage(
      res.message || 'تم تعيين كلمة المرور الجديدة بنجاح. يمكنك الآن تسجيل الدخول.'
    );
    setForgotStep('done');
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
            منظومة دخول موحدة للأطباء، ومسؤولي الاستقبال، والخزينة، ومدير المالية، وإدارة العيادات
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
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="مثال: admin أو finance أو reception أو cashier أو doctor"
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
                  resetForgotPasswordModalState(username);
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
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
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

      {/* نافذة استعادة / إعادة تعيين كلمة المرور (Phase 4: 3 خطوات عبر كود OTP) */}
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

            {/* شريط خطوات الاستعادة الثلاث */}
            {forgotStep !== 'done' && (
              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold text-center">
                <div
                  className={`py-1.5 px-2 rounded-xl border ${
                    forgotStep === 'request'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-300'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  1. طلب الكود
                </div>
                <div
                  className={`py-1.5 px-2 rounded-xl border ${
                    forgotStep === 'verify'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-300'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  2. إدخال الكود
                </div>
                <div
                  className={`py-1.5 px-2 rounded-xl border ${
                    forgotStep === 'reset'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-300'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  3. كلمة المرور
                </div>
              </div>
            )}

            {forgotError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs space-y-1.5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="font-semibold leading-relaxed">{forgotError}</div>
                </div>
                {forgotErrorCode === 'EMAIL_PROVIDER_NOT_CONFIGURED' && (
                  <div
                    dir="ltr"
                    className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-rose-200 dark:border-rose-800/70 text-[11px] font-mono text-slate-700 dark:text-slate-300 space-y-0.5"
                  >
                    <div className="font-bold text-rose-700 dark:text-rose-300">
                      Required Server Environment Variables:
                    </div>
                    <div>• SMTP_USER</div>
                    <div>• SMTP_PASS</div>
                    <div>• RECOVERY_FROM_EMAIL</div>
                  </div>
                )}
              </div>
            )}

            {/* الخطوة 1: طلب كود الاستعادة OTP */}
            {forgotStep === 'request' && (
              <form onSubmit={handleRequestOtpSubmit} className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  أدخل اسم المستخدم وبريد الاستعادة المسجلين للحساب لإرسال رمز تحقق مكون من 6 أرقام (صالح لمدة 10 دقائق):
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    اسم المستخدم أو الكود الوظيفي:
                  </label>
                  <input
                    type="text"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={forgotUsername}
                    onChange={(e) => setForgotUsername(e.target.value)}
                    placeholder="مثال: admin أو reception أو cashier أو doctor"
                    dir="ltr"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    بريد الاستعادة المسجل للحساب (recovery_email):
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="amrrmybody@gmail.com"
                      dir="ltr"
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
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
                    disabled={forgotLoading || resendCooldown > 0}
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {forgotLoading
                      ? 'جاري الطلب...'
                      : resendCooldown > 0
                      ? `انتظر (${resendCooldown}ث)`
                      : 'طلب رمز التحقق (OTP)'}
                  </button>
                </div>
              </form>
            )}

            {/* الخطوة 2: إدخال كود التحقق OTP المكون من 6 أرقام */}
            {forgotStep === 'verify' && (
              <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
                {forgotInfoMessage && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200 text-xs leading-relaxed">
                    {forgotInfoMessage}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    رمز التحقق المكون من 6 أرقام (OTP):
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(normalizeOtpDigits(e.target.value))}
                    placeholder="123456"
                    dir="ltr"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-center tracking-[0.4em] text-base font-bold focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>صالح لمدة 10 دقائق (بحد أقصى 3 محاولات)</span>
                    <button
                      type="button"
                      disabled={forgotLoading || resendCooldown > 0}
                      onClick={() => handleRequestOtpSubmit()}
                      className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>
                        {resendCooldown > 0
                          ? `إعادة الإرسال بعد ${resendCooldown}ث`
                          : 'إعادة إرسال الرمز'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotError('');
                      setForgotErrorCode(undefined);
                      setResendCooldown(0);
                      setForgotStep('request');
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    تعديل البيانات
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading || forgotOtp.trim().length !== 6}
                    className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {forgotLoading ? 'جاري التحقق...' : 'تحقق من الرمز والمتابعة'}
                  </button>
                </div>
              </form>
            )}

            {/* الخطوة 3: تعيين كلمة المرور الجديدة */}
            {forgotStep === 'reset' && (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200 text-xs leading-relaxed">
                  تم التحقق من الرمز بنجاح. يرجى تعيين كلمة مرور جديدة (6 أحرف على الأقل) خلال 5 دقائق.
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    كلمة المرور الجديدة (6 أحرف على الأقل):
                  </label>
                  <div className="relative">
                    <input
                      type={showForgotPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="••••••••"
                      dir="ltr"
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(!showForgotPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showForgotPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    تأكيد كلمة المرور الجديدة:
                  </label>
                  <input
                    type={showForgotPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500"
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
                    disabled={forgotLoading}
                    className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {forgotLoading ? 'جاري الحفظ...' : 'حفظ كلمة المرور الجديدة'}
                  </button>
                </div>
              </form>
            )}

            {/* شاشة إتمام تعيين كلمة المرور */}
            {forgotStep === 'done' && (
              <div className="space-y-4 py-2 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    تم تحديث كلمة المرور بنجاح
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
                    {forgotInfoMessage ||
                      'تم تحديث كلمة المرور في خدمة المصادقة السحابية وإبطال رمز الاستعادة. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.'}
                  </p>
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
