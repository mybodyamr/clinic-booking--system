import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  Share2,
  PlusSquare,
  MoreVertical,
  CheckCircle2,
  X,
  Copy,
  Check
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useApp } from '../context/AppContext';

interface PWAInstallBannerProps {
  variant?: 'home-card' | 'navbar-button';
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ variant = 'home-card' }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isInAppBrowser, install } = usePWAInstall();
  const { addToast } = useApp();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [guideTab, setGuideTab] = useState<'android' | 'ios'>(isIOS ? 'ios' : 'android');
  const [copiedUrl, setCopiedUrl] = useState(false);

  // إذا كان التطبيق مفتوحاً بالفعل كتطبيق مثبت على الهاتف (Standalone)، نخفي خانة التثبيت تلقائياً
  if (isInstalled) {
    return null;
  }

  const handleTriggerInstall = async () => {
    if (isInstallable) {
      const result = await install();
      if (result === 'accepted') {
        addToast({
          type: 'success',
          title: 'جاري تثبيت التطبيق',
          message: 'تمت إضافة تطبيق عيادات الجمعية الشرعية إلى الشاشة الرئيسية لهاتفك بنجاح!'
        });
        return;
      }
      if (result === 'dismissed') {
        return;
      }
    }
    setGuideTab(isIOS ? 'ios' : 'android');
    setShowGuideModal(true);
  };

  const handleCopyAppLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiedUrl(true);
      addToast({
        type: 'success',
        title: 'تم نسخ رابط التطبيق',
        message: 'افتح متصفح Chrome أو Safari والصق الرابط لتثبيت التطبيق.'
      });
      setTimeout(() => setCopiedUrl(false), 3000);
    } catch {
      // ignore clipboard errors
    }
  };

  const renderGuideModal = () => {
    if (!showGuideModal) return null;

    return (
      <div
        className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
        onClick={() => setShowGuideModal(false)}
      >
        <div
          className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden text-right"
          onClick={e => e.stopPropagation()}
        >
          {/* رأس النافذة */}
          <div className="p-4 sm:p-5 bg-emerald-900 dark:bg-slate-800 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base">
                  تثبيت التطبيق على الشاشة الرئيسية
                </h3>
                <p className="text-[11px] text-emerald-100/90">
                  خطوتان بسيطتان لفتح العيادات كتطبيق مستقل على هاتفك
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* تنبيه إذا كان المستخدم يفتح الرابط من متصفح واتساب أو فيسبوك الداخلي */}
            {isInAppBrowser && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 text-xs space-y-2">
                <div className="font-extrabold">
                  تنبيه هام: أنت تتصفح من داخل تطبيق محادثة (واتساب / فيسبوك)
                </div>
                <p className="text-[11px] leading-relaxed">
                  لتثبيت التطبيق على شاشة هاتفك، انسخ الرابط بالأسفل وافتحه في متصفح <strong>Google Chrome</strong> (للأندرويد) أو <strong>Safari</strong> (للآيفون).
                </p>
                <button
                  type="button"
                  onClick={handleCopyAppLink}
                  className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedUrl ? 'تم نسخ الرابط بنجاح ✓' : 'نسخ رابط التطبيق لفتحه في المتصفح'}</span>
                </button>
              </div>
            )}

            {/* أزرار التبديل بين شرح الأندرويد والآيفون */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setGuideTab('android')}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  guideTab === 'android'
                    ? 'bg-emerald-900 text-white dark:bg-amber-400 dark:text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                هواتف أندرويد (Android)
              </button>
              <button
                type="button"
                onClick={() => setGuideTab('ios')}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  guideTab === 'ios'
                    ? 'bg-emerald-900 text-white dark:bg-amber-400 dark:text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                آيفون وآيباد (iPhone)
              </button>
            </div>

            {guideTab === 'android' ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>اضغط على قائمة المتصفح العلوية</span>
                      <MoreVertical className="w-4 h-4 text-emerald-700 dark:text-amber-400 inline" />
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      اضغط على الثلاث نقاط الرأسية <strong>(⋮)</strong> الموجودة في أعلى يمين أو يسار متصفح Google Chrome.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>اختر "تثبيت التطبيق" أو "الإضافة إلى الشاشة الرئيسية"</span>
                      <Download className="w-4 h-4 text-emerald-700 dark:text-amber-400 inline" />
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      اضغط على <strong>"تثبيت التطبيق" (Install App)</strong> ثم اضغط تأكيد التثبيت ليظهر شعار العيادات على شاشة هاتفك فوراً.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>اضغط على زر المشاركة في متصفح Safari</span>
                      <Share2 className="w-4 h-4 text-emerald-700 dark:text-amber-400 inline" />
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      في الشريط السفلي لمتصفح <strong>Safari</strong>، اضغط على أيقونة المشاركة (المربع الذي يخرج منه سهم للأعلى).
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>اختر "إضافة إلى الشاشة الرئيسية"</span>
                      <PlusSquare className="w-4 h-4 text-emerald-700 dark:text-amber-400 inline" />
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      مرر القائمة للأسفل واختر <strong>"إضافة إلى الشاشة الرئيسية" (Add to Home Screen)</strong> ثم اضغط <strong>إضافة (Add)</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 font-extrabold text-xs cursor-pointer transition-colors"
            >
              حسناً، فهمت الطريقة
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (variant === 'navbar-button') {
    return (
      <>
        <button
          type="button"
          onClick={handleTriggerInstall}
          className="flex items-center justify-center gap-1.5 min-h-[38px] px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-extrabold bg-emerald-50 hover:bg-emerald-100 dark:bg-amber-400/15 dark:hover:bg-amber-400/25 text-emerald-900 dark:text-amber-300 border border-emerald-300/80 dark:border-amber-400/40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          title="تثبيت تطبيق عيادات الجمعية الشرعية على الشاشة الرئيسية للهاتف"
        >
          <Download className="w-3.5 h-3.5 text-emerald-800 dark:text-amber-400 shrink-0" />
          <span className="hidden sm:inline">تثبيت التطبيق</span>
        </button>
        {renderGuideModal()}
      </>
    );
  }

  return (
    <>
      <section className="rounded-3xl bg-gradient-to-l from-emerald-950 via-emerald-900 to-teal-900 dark:from-slate-900 dark:via-emerald-950/90 dark:to-slate-900 border border-emerald-800/80 dark:border-amber-400/30 p-4 sm:p-6 text-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-md shrink-0 mt-0.5">
              <Smartphone className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>

            <div className="space-y-1 text-right">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold text-amber-300">
                  تطبيق الهاتف الذكي • للمستخدمين لأول مرة
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-white leading-snug">
                ثبّت تطبيق عيادات الجمعية الشرعية على الشاشة الرئيسية لهاتفك
              </h2>
              <p className="text-xs text-emerald-100/90 leading-relaxed max-w-2xl">
                احصل على وصول فوري بضغطة واحدة لحجز العيادات، عرض تذكرة الـ QR Code حتى بدون إنترنت، ومتابعة دورك في الطابور لحظة بلحظة بدون الحاجة للبحث عن الرابط مرة أخرى.
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-emerald-200 font-medium">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>سريع وخفيف بدون مساحة تخزين</span>
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>يدعم أندرويد وآيفون والكمبيوتر</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-2 shrink-0">
            <button
              type="button"
              onClick={handleTriggerInstall}
              className="min-h-[46px] px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-98 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>
                {isInstallable
                  ? 'تثبيت التطبيق الآن بضغطة واحدة'
                  : isIOS
                  ? 'طريقة التثبيت على الآيفون'
                  : isAndroid
                  ? 'تثبيت التطبيق على الهاتف'
                  : 'تثبيت التطبيق على الشاشة الرئيسية'}
              </span>
            </button>
            {!isInstallable && (
              <span className="text-[10px] text-emerald-200/80 text-center md:text-left">
                اضغط لعرض خطوات الإضافة السريعة للشاشة الرئيسية
              </span>
            )}
          </div>
        </div>
      </section>

      {renderGuideModal()}
    </>
  );
};
