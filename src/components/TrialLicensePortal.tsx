import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Clock,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Calendar,
  RefreshCw,
  Trash2,
  X,
  Phone,
  Eye,
  EyeOff,
  Sliders,
  Hospital,
  Power,
  Plus,
  Minus,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SystemTrialLicenseConfig } from '../types';
import { verifySecretDeveloperCredentials } from '../services/storage';

// حفظ المراجع الأصلية لدوال الكونسول قبل تعطيلها لإمكانية استعادتها عند رغبة المطور
const ORIGINAL_CONSOLE = {
  log: typeof console !== 'undefined' ? console.log.bind(console) : () => {},
  info: typeof console !== 'undefined' ? console.info.bind(console) : () => {},
  warn: typeof console !== 'undefined' ? console.warn.bind(console) : () => {},
  debug: typeof console !== 'undefined' ? console.debug.bind(console) : () => {},
  table: typeof console !== 'undefined' ? console.table?.bind(console) : () => {},
  dir: typeof console !== 'undefined' ? console.dir?.bind(console) : () => {},
  clear: typeof console !== 'undefined' ? console.clear?.bind(console) : () => {},
};

export const TrialLicensePortal: React.FC = () => {
  const {
    trialLicenseConfig,
    updateTrialLicenseConfig,
    isDeveloperPortalOpen,
    setIsDeveloperPortalOpen,
    currentView,
    selectivePurgeRecords,
    addToast,
  } = useApp();

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [devToolsDetected, setDevToolsDetected] = useState<boolean>(false);
  const [devSessionBypass, setDevSessionBypass] = useState<boolean>(false);
  const devToolsStrikeCountRef = useRef<number>(0);

  const isShieldEnabled =
    trialLicenseConfig.blockDevTools !== false &&
    !isDeveloperPortalOpen &&
    !devSessionBypass;

  // تحديث العداد كل 15 ثانية لضمان دقة العد التنازلي والإغلاق اللحظي فور انتهاء الوقت
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 15000);
    return () => window.clearInterval(interval);
  }, []);

  // ==================== درع الحماية رباعي الطبقات ضد فتح الكونسول والفحص (Anti-DevTools Shield) ====================
  useEffect(() => {
    if (!isShieldEnabled) {
      // استعادة الكونسول الطبيعي إذا قام المطور (Amrr) بفتح البوابة السرية أو إيقاف الحماية
      console.log = ORIGINAL_CONSOLE.log;
      console.info = ORIGINAL_CONSOLE.info;
      console.warn = ORIGINAL_CONSOLE.warn;
      console.debug = ORIGINAL_CONSOLE.debug;
      if (ORIGINAL_CONSOLE.table) console.table = ORIGINAL_CONSOLE.table;
      if (ORIGINAL_CONSOLE.dir) console.dir = ORIGINAL_CONSOLE.dir;
      setDevToolsDetected(false);
      devToolsStrikeCountRef.current = 0;
      return;
    }

    const printSecurityWarning = () => {
      try {
        ORIGINAL_CONSOLE.clear?.();
        ORIGINAL_CONSOLE.log(
          '%c⛔ تحذير أمني مشدد — عيادات الجمعية الشرعية بأوسيم',
          'color: #ef4444; font-size: 22px; font-weight: 900; font-family: Cairo, sans-serif; text-shadow: 0 1px 2px rgba(0,0,0,0.3);'
        );
        ORIGINAL_CONSOLE.log(
          '%cهذه المنظومة الطبية محمية بالكامل. يُحظر تماماً فتح أدوات المطور (Console / Inspect) أو محاولة فحص أو نسخ الشيفرة المصدرية.',
          'color: #fbbf24; font-size: 14px; font-weight: bold; font-family: Cairo, sans-serif;'
        );
      } catch {}
    };

    // 1. تفريغ وتعطيل أوامر الكونسول بالكامل
    printSecurityWarning();
    const noop = () => {};
    console.log = noop;
    console.info = noop;
    console.warn = noop;
    console.debug = noop;
    console.table = noop;
    console.dir = noop;

    // 2. منع كليك يمين (Right-Click Inspect)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // 3. منع جميع اختصارات الكيبورد الخاصة بفتح الكونسول أو عرض المصدر (F12, Ctrl+Shift+I/J/C/K, Ctrl+U, Ctrl+S)
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = (e.key || '').toUpperCase();
      const code = e.keyCode || e.which;

      const isF12 = key === 'F12' || code === 123;
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey || e.altKey;

      // Ctrl+Shift+I / J / C / K أو Cmd+Option+I / J / C / K
      const isInspectShortcut =
        isCtrlOrCmd && isShift && (key === 'I' || key === 'J' || key === 'C' || key === 'K' || code === 73 || code === 74 || code === 67 || code === 75);

      // Ctrl+U (عرض المصدر)
      const isViewSource = isCtrlOrCmd && (key === 'U' || code === 85);

      if (isF12 || isInspectShortcut || isViewSource) {
        e.preventDefault();
        e.stopPropagation();
        printSecurityWarning();
        return false;
      }
    };

    // 4. الرصد النشط لفتح الكونسول من قائمة المتصفح العلوية (More Tools -> Developer Tools)
    const detectOpenDevTools = () => {
      let detectedNow = false;

      // أ) فحص فرق أبعاد النافذة على أجهزة الكمبيوتر (خارج الـ iframe وبشاشة غير ملمسية)
      const isStandaloneWindow = window.self === window.top;
      const isDesktopDevice =
        typeof navigator !== 'undefined' &&
        navigator.maxTouchPoints === 0 &&
        window.innerWidth >= 768;

      if (isStandaloneWindow && isDesktopDevice && window.outerWidth > 0 && window.outerHeight > 0) {
        const dpr = window.devicePixelRatio || 1;
        const rawWidthDiff = window.outerWidth - window.innerWidth;
        const scaledWidthDiff = window.outerWidth - window.innerWidth * dpr;
        const rawHeightDiff = window.outerHeight - window.innerHeight;
        const scaledHeightDiff = window.outerHeight - window.innerHeight * dpr;

        const isWidthDocked = rawWidthDiff > 240 && scaledWidthDiff > 240;
        const isHeightDocked = rawHeightDiff > 280 && scaledHeightDiff > 280;

        if (isWidthDocked || isHeightDocked) {
          detectedNow = true;
        }
      }

      // ب) مصيدة التوقيت وفحص الكونسول (Debugger Timing Trap)
      const start = performance.now();
      try {
        // eslint-disable-next-line no-debugger
        debugger;
      } catch {}
      const elapsed = performance.now() - start;
      if (elapsed > 120) {
        detectedNow = true;
      }

      if (detectedNow) {
        devToolsStrikeCountRef.current += 1;
        printSecurityWarning();
        if (devToolsStrikeCountRef.current >= 1) {
          setDevToolsDetected(true);
        }
      } else {
        devToolsStrikeCountRef.current = 0;
        setDevToolsDetected(false);
      }
    };

    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', detectOpenDevTools);

    const detectorInterval = window.setInterval(detectOpenDevTools, 2000);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', detectOpenDevTools);
      window.clearInterval(detectorInterval);
    };
  }, [isShieldEnabled]);

  // حالات نافذة فتح البوابة من شاشة القفل أو الضغط السري (5 ضغطات)
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [unlockUser, setUnlockUser] = useState('');
  const [unlockPass, setUnlockPass] = useState('');
  const [showUnlockPass, setShowUnlockPass] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [unlockLoading, setUnlockLoading] = useState(false);

  // حالات لوحة تحكم المطور السرية
  const [draftConfig, setDraftConfig] = useState<SystemTrialLicenseConfig>(trialLicenseConfig);
  const [customDaysInput, setCustomDaysInput] = useState<string>(
    String(trialLicenseConfig.trialDays || 7)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [confirmPurgeOpen, setConfirmPurgeOpen] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  // مزامنة المسودة عند فتح البوابة أو تغير الإعدادات السحابية
  useEffect(() => {
    if (isDeveloperPortalOpen) {
      setDraftConfig(trialLicenseConfig);
      setCustomDaysInput(String(trialLicenseConfig.trialDays || 7));
    }
  }, [isDeveloperPortalOpen, trialLicenseConfig]);

  // الاستماع لحدث الفتح السري (5 ضغطات متتالية على شعار المستشفى في التذييل)
  useEffect(() => {
    const handleSecretTrigger = () => {
      setUnlockUser('');
      setUnlockPass('');
      setUnlockError('');
      setUnlockModalOpen(true);
    };
    window.addEventListener('sharaya:open-secret-dev-unlock', handleSecretTrigger);
    return () => window.removeEventListener('sharaya:open-secret-dev-unlock', handleSecretTrigger);
  }, []);

  const expiresAtMs = new Date(trialLicenseConfig.expiresAt).getTime();
  const isTimeExpired = Number.isFinite(expiresAtMs) ? nowMs >= expiresAtMs : false;
  const isTrialActive = trialLicenseConfig.mode === 'trial' && !isTimeExpired;
  const isSystemLocked =
    trialLicenseConfig.mode === 'locked' ||
    (trialLicenseConfig.mode === 'trial' && isTimeExpired);

  const isStaffView =
    currentView === 'admin' ||
    currentView === 'finance' ||
    currentView === 'reception' ||
    currentView === 'cashier' ||
    currentView === 'doctor';

  const shouldShowLockScreen =
    isSystemLocked && (trialLicenseConfig.lockPublicPagesOnExpiry || isStaffView);

  // حساب الأيام والساعات والدقائق المتبقية
  const getRemainingParts = (targetIso: string) => {
    const target = new Date(targetIso).getTime();
    if (!Number.isFinite(target)) return { days: 0, hours: 0, minutes: 0, totalMs: 0 };
    const diff = Math.max(0, target - nowMs);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { days, hours, minutes, totalMs: diff };
  };

  const liveRemaining = getRemainingParts(trialLicenseConfig.expiresAt);
  const draftRemaining = getRemainingParts(draftConfig.expiresAt);

  // تحويل ISO إلى قيمة مناسبة لـ input[type="datetime-local"] بالتوقيت المحلي
  const toLocalDateTimeInputValue = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');
    if (!unlockUser.trim() || !unlockPass.trim()) {
      setUnlockError('يرجى إدخال اسم المستخدم السري وكلمة المرور');
      return;
    }

    setUnlockLoading(true);
    const verified = await verifySecretDeveloperCredentials(unlockUser, unlockPass);
    setUnlockLoading(false);

    if (!verified) {
      setUnlockError('بيانات مطور المنظومة غير صحيحة');
      return;
    }

    setUnlockModalOpen(false);
    setUnlockUser('');
    setUnlockPass('');
    setDevSessionBypass(true);
    setDevToolsDetected(false);
    setIsDeveloperPortalOpen(true);
  };

  const applyDaysFromNow = (daysCount: number) => {
    const safeDays = Math.max(1, Math.min(3650, Math.round(Number(daysCount) || 7)));
    const start = new Date();
    const end = new Date(start.getTime() + safeDays * 24 * 60 * 60 * 1000);
    setCustomDaysInput(String(safeDays));
    setDraftConfig((prev) => ({
      ...prev,
      mode: 'trial',
      trialDays: safeDays,
      startedAt: start.toISOString(),
      expiresAt: end.toISOString(),
    }));
  };

  const shiftCurrentExpiry = (deltaHours: number) => {
    const baseMs = Math.max(Date.now(), new Date(draftConfig.expiresAt).getTime() || Date.now());
    const nextEnd = new Date(baseMs + deltaHours * 60 * 60 * 1000);
    const diffDays = Math.max(
      1,
      Math.ceil((nextEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );
    setCustomDaysInput(String(diffDays));
    setDraftConfig((prev) => ({
      ...prev,
      mode: 'trial',
      trialDays: diffDays,
      expiresAt: nextEnd.toISOString(),
    }));
  };

  const handleSaveConfig = async (overrideConfig?: SystemTrialLicenseConfig) => {
    const targetConfig = overrideConfig || draftConfig;
    setIsSaving(true);
    const ok = await updateTrialLicenseConfig(targetConfig);
    setIsSaving(false);

    addToast({
      type: ok ? 'success' : 'info',
      title: ok
        ? 'تم الحفظ والمزامنة اللحظية مع Supabase ✅'
        : 'تم حفظ إعدادات الترخيص محلياً',
      message:
        targetConfig.mode === 'permanent'
          ? 'تم تفعيل النسخة الدائمة النهائية بنجاح وإلغاء جميع قيود الفترة التجريبية.'
          : targetConfig.mode === 'locked'
          ? 'تم قفل وإيقاف النظام فورياً على جميع الأجهزة المتصلة.'
          : `تم ضبط الفترة التجريبية بنجاح (تنتهي في ${new Date(
              targetConfig.expiresAt
            ).toLocaleString('ar-EG')}).`,
    });
  };

  const handleQuickPurgeTrialData = async () => {
    setIsPurging(true);
    try {
      await selectivePurgeRecords({
        purgePastBookings: false,
        purgeAllBookings: true,
        purgeShiftHandovers: true,
        purgeFinanceExpenses: true,
        purgeConsultationStamps: true,
        purgeWhatsAppAndPrintLogs: true,
        purgeSystemErrorLogs: true,
      });
      setConfirmPurgeOpen(false);
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <>
      {/* 0. شاشة الحماية الفورية عند رصد فتح أدوات المطور / الكونسول (Anti-DevTools Lock Overlay) */}
      <AnimatePresence>
        {devToolsDetected && isShieldEnabled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9997] bg-gradient-to-br from-rose-950 via-[#04152b] to-slate-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 text-center no-print select-none"
          >
            <div className="max-w-lg w-full bg-white/5 backdrop-blur-xl border-2 border-rose-500/40 rounded-3xl p-6 sm:p-9 shadow-2xl space-y-5">
              <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border-2 border-rose-400/50 text-rose-300 flex items-center justify-center mx-auto shadow-lg">
                <ShieldAlert className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-300 text-xs font-extrabold">
                  حماية المنظومة الطبية النشطة
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  تم رصد فتح أدوات المطور (Console / Inspect) 🔒
                </h2>
              </div>

              <p className="text-sm text-slate-200 leading-relaxed font-medium bg-white/5 border border-white/10 rounded-2xl p-4">
                لأسباب أمنية ولحماية خصوصية بيانات المرضى والشيفرة المصدرية للمنظومة، يُمنع فتح
                نافذة الفحص أو وحدة التحكم (Console). يرجى إغلاق نافذة أدوات المطور فوراً للعودة إلى
                شاشة العمل تلقائياً.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    devToolsStrikeCountRef.current = 0;
                    setDevToolsDetected(false);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-md transition-all"
                >
                  لقد أغلقت النافذة — متابعة العمل
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUnlockUser('');
                    setUnlockPass('');
                    setUnlockError('');
                    setUnlockModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold border border-white/15 transition-all"
                >
                  بوابة المطور 🔑
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. شريط الفترة التجريبية العلوي الأنيق */}
      {isTrialActive && trialLicenseConfig.showBannerToStaff && (
        <div className="no-print bg-gradient-to-r from-[#062142] via-[#0b315e] to-[#062142] text-white border-b border-amber-400/30 px-3 py-2 text-xs shadow-xs relative z-40">
          <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/40 shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span>
                نسخة العرض التجريبية المعتمدة لمجلس الإدارة — عيادات الجمعية الشرعية بأوسيم
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold text-amber-200">
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                <span>
                  المتبقي من الفترة التجريبية:{' '}
                  <strong className="text-white font-extrabold">
                    {liveRemaining.days} يوم و {liveRemaining.hours} ساعة و {liveRemaining.minutes}{' '}
                    دقيقة
                  </strong>
                </span>
              </div>

              <span className="hidden md:inline text-[11px] text-slate-300">
                (حتى{' '}
                {new Date(trialLicenseConfig.expiresAt).toLocaleDateString('ar-EG', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
                )
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. شاشة القفل الكاملة عند انتهاء الفترة التجريبية أو القفل الفوري عن بُعد */}
      <AnimatePresence>
        {shouldShowLockScreen && !isDeveloperPortalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-gradient-to-br from-[#04152b] via-[#072346] to-[#041224] text-white flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto no-print"
          >
            <div className="max-w-xl w-full bg-white/5 backdrop-blur-xl border border-white/15 rounded-3xl p-6 sm:p-10 text-center shadow-2xl space-y-6 my-auto">
              <div className="w-20 h-20 rounded-3xl bg-amber-400/15 border-2 border-amber-400/40 text-amber-300 flex items-center justify-center mx-auto shadow-lg">
                <Lock className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-extrabold">
                  <Hospital className="w-3.5 h-3.5" />
                  <span>عيادات الجمعية الشرعية التخصصية بأوسيم</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight pt-1">
                  {trialLicenseConfig.mode === 'locked'
                    ? 'النظام متوقف مؤقتاً لاعتماد الترخيص'
                    : 'انتهت الفترة التجريبية المخصصة لمعاينة المنظومة'}
                </h1>
              </div>

              <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-medium bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5">
                {trialLicenseConfig.lockMessage ||
                  'انتهت الفترة التجريبية المخصصة لمعاينة ومراجعة المنظومة بنجاح. جميع البيانات والإعدادات محفوظة بالكامل — لتفعيل النسخة الدائمة المعتمدة يرجى التواصل مع مسؤول تطوير المنظومة.'}
              </p>

              <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-4 flex items-center gap-3 text-right">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div className="text-xs sm:text-sm text-emerald-100 font-semibold leading-relaxed">
                  جميع سجلات العيادات، جداول الأطباء، الحجوزات، والتقارير المالية محفوظة ومؤمنة
                  بالكامل في قاعدة البيانات السحابية وستعمل فوراً بمجرد تفعيل الترخيص الدائم.
                </div>
              </div>

              {trialLicenseConfig.developerPhone && (
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/10 border border-white/20 text-amber-300 font-bold text-sm">
                  <Phone className="w-4 h-4" />
                  <span>للتواصل والتفعيل الفوري: {trialLicenseConfig.developerPhone}</span>
                </div>
              )}

              <div className="pt-4 border-t border-white/10 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setUnlockUser('');
                    setUnlockPass('');
                    setUnlockError('');
                    setUnlockModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold transition-all"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>بوابة التفعيل واعتماد الترخيص</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. نافذة التحقق السري لفتح بوابة المطور (من شاشة القفل أو الاختصار السري) */}
      <AnimatePresence>
        {unlockModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 no-print"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#062142] text-amber-300 flex items-center justify-center">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                      بوابة اعتماد وترخيص النظام
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      مخصصة لمسؤول تطوير المنظومة فقط
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUnlockModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUnlockSubmit} className="space-y-4">
                {unlockError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{unlockError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    اسم المستخدم السري للمطور
                  </label>
                  <input
                    type="text"
                    value={unlockUser}
                    onChange={(e) => setUnlockUser(e.target.value)}
                    placeholder="أدخل اسم المستخدم..."
                    autoComplete="off"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    كلمة المرور السرية
                  </label>
                  <div className="relative">
                    <input
                      type={showUnlockPass ? 'text' : 'password'}
                      value={unlockPass}
                      onChange={(e) => setUnlockPass(e.target.value)}
                      placeholder="••••••••••••"
                      autoComplete="off"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600 pl-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowUnlockPass(!showUnlockPass)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showUnlockPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setUnlockModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={unlockLoading}
                    className="px-5 py-2.5 rounded-xl bg-[#062142] hover:bg-[#0a2e5c] text-white text-xs font-extrabold shadow-md transition-all"
                  >
                    {unlockLoading ? 'جاري التحقق...' : 'فتح لوحة التحكم السرية'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. البوابة السرية الكاملة للمطور (م. عمرو) للتحكم في الفترة التجريبية والترخيص عن بُعد */}
      <AnimatePresence>
        {isDeveloperPortalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto no-print"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              className="bg-white dark:bg-slate-900 border-2 border-[#062142] dark:border-amber-400/40 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto"
            >
              {/* هيدر البوابة السرية */}
              <div className="bg-gradient-to-r from-[#062142] via-[#0b315e] to-[#062142] text-white px-5 py-4 sm:px-7 sm:py-5 flex items-center justify-between gap-4 shrink-0 border-b border-amber-400/30">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-400/20 border border-amber-400/50 text-amber-300 flex items-center justify-center shrink-0 shadow-inner">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-black text-white">
                        بوابة المطور السرية — التحكم المركزي في الترخيص والفترة التجريبية
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                        Supabase Realtime Sync
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      مرحباً م. عمرو (`Amrr`) • تحكم كامل عن بُعد في أيام التجربة، منع الكونسول،
                      الإيقاف الفوري، أو التفعيل الدائم
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDeveloperPortalOpen(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
                  title="إغلاق البوابة السرية"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* محتوى البوابة القابل للتمرير */}
              <div className="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1">
                {/* ملخص الحالة الحية الحالية */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      الحالة المطبقة حالياً على جميع الأجهزة:
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {trialLicenseConfig.mode === 'permanent' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-extrabold text-sm border border-emerald-300 dark:border-emerald-700">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>نسخة دائمة مفعّلة بالكامل (بدون وقت انتهاء)</span>
                        </span>
                      ) : isSystemLocked ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 font-extrabold text-sm border border-rose-300 dark:border-rose-700">
                          <Lock className="w-4 h-4" />
                          <span>
                            {trialLicenseConfig.mode === 'locked'
                              ? 'مغلق فورياً بواسطة المطور (Kill Switch)'
                              : 'انتهت الفترة التجريبية والنظام مغلق حالياً'}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 font-extrabold text-sm border border-amber-300 dark:border-amber-700">
                          <Clock className="w-4 h-4" />
                          <span>
                            فترة تجريبية نشطة — متبقي {liveRemaining.days} يوم و{' '}
                            {liveRemaining.hours} ساعة و {liveRemaining.minutes} دقيقة
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 sm:text-left">
                    <div>
                      <span className="font-bold text-slate-500">تاريخ انتهاء التجربة: </span>
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {new Date(draftConfig.expiresAt).toLocaleString('ar-EG')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      آخر تحديث:{' '}
                      {new Date(trialLicenseConfig.updatedAt).toLocaleString('ar-EG')}
                    </div>
                  </div>
                </div>

                {/* القسم 1: اختيار وضع الترخيص السريع */}
                <div className="space-y-3">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-600" />
                    <span>1. اختر وضع تشغيل المنظومة (تبديل فوري)</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* بطاقة وضع الفترة التجريبية */}
                    <button
                      type="button"
                      onClick={() =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          mode: 'trial',
                        }))
                      }
                      className={`p-4 rounded-2xl border-2 text-right transition-all flex flex-col justify-between gap-2 ${
                        draftConfig.mode === 'trial'
                          ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                          <Clock className="w-5 h-5" />
                        </span>
                        {draftConfig.mode === 'trial' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
                            محدد حالياً
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                          ⏳ وضع الفترة التجريبية
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          يعمل البرنامج بكامل مميزاته لعدد الأيام المحدد ثم يقفل تلقائياً لحين
                          الاعتماد.
                        </p>
                      </div>
                    </button>

                    {/* بطاقة التفعيل الدائم النهائي */}
                    <button
                      type="button"
                      onClick={() =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          mode: 'permanent',
                        }))
                      }
                      className={`p-4 rounded-2xl border-2 text-right transition-all flex flex-col justify-between gap-2 ${
                        draftConfig.mode === 'permanent'
                          ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5" />
                        </span>
                        {draftConfig.mode === 'permanent' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white">
                            محدد حالياً
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                          ✅ تفعيل النسخة الدائمة
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          إلغاء المؤقت التجريبي نهائياً وتحويل المنظومة للنسخة الرسمية الدائمة مدى
                          الحياة.
                        </p>
                      </div>
                    </button>

                    {/* بطاقة القفل الفوري عن بعد */}
                    <button
                      type="button"
                      onClick={() =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          mode: 'locked',
                        }))
                      }
                      className={`p-4 rounded-2xl border-2 text-right transition-all flex flex-col justify-between gap-2 ${
                        draftConfig.mode === 'locked'
                          ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/30 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                          <Power className="w-5 h-5" />
                        </span>
                        {draftConfig.mode === 'locked' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white">
                            محدد حالياً
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                          🔒 إيقاف وقفل فوري (Kill Switch)
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          قفل المنظومة في نفس الثانية على جميع الأجهزة المفتوحة مع حفظ كافة
                          البيانات.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* القسم 2: تعديل عدد الأيام والتاريخ والوقت بحرية كاملة */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 bg-white dark:bg-slate-900">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#062142] dark:text-amber-400" />
                      <span>2. التحكم الحر في عدد أيام التجربة وتاريخ الانتهاء</span>
                    </h3>
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                      المدة في المسودة الآن: {draftRemaining.days} يوم و {draftRemaining.hours} ساعة
                    </span>
                  </div>

                  {/* إدخال رقم أيام مخصص + أزرار جاهزة */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        اكتب عدد أيام التجربة الذي تريده (من الآن):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={3650}
                          value={customDaysInput}
                          onChange={(e) => setCustomDaysInput(e.target.value)}
                          className="w-28 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-extrabold text-sm text-center"
                        />
                        <button
                          type="button"
                          onClick={() => applyDaysFromNow(Number(customDaysInput) || 7)}
                          className="px-4 py-2 rounded-xl bg-[#062142] hover:bg-[#0b315e] text-white text-xs font-extrabold transition-all shadow-xs"
                        >
                          ضبط من اللحظة الحالية ({customDaysInput || 7} يوم)
                        </button>
                      </div>

                      {/* أزرار سريعة لعدد الأيام */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {[
                          { label: 'يوم واحد', days: 1 },
                          { label: '3 أيام', days: 3 },
                          { label: '5 أيام', days: 5 },
                          { label: '7 أيام (أسبوع)', days: 7 },
                          { label: '14 يوم (أسبوعين)', days: 14 },
                          { label: '30 يوم (شهر)', days: 30 },
                        ].map((preset) => (
                          <button
                            key={preset.days}
                            type="button"
                            onClick={() => applyDaysFromNow(preset.days)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-colors"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* تحديد تاريخ وساعة انتهاء دقيقة أو زيادة/إنقاص سريع */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        أو حدد تاريخ وساعة انتهاء الفترة التجريبية بالضبط:
                      </label>
                      <input
                        type="datetime-local"
                        value={toLocalDateTimeInputValue(draftConfig.expiresAt)}
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const picked = new Date(e.target.value);
                          if (!isNaN(picked.getTime())) {
                            const diffDays = Math.max(
                              1,
                              Math.ceil((picked.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                            );
                            setCustomDaysInput(String(diffDays));
                            setDraftConfig((prev) => ({
                              ...prev,
                              mode: 'trial',
                              trialDays: diffDays,
                              expiresAt: picked.toISOString(),
                            }));
                          }
                        }}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs"
                      />

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => shiftCurrentExpiry(24)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold"
                        >
                          <Plus className="w-3 h-3" />
                          <span>تمديد +1 يوم</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => shiftCurrentExpiry(72)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold"
                        >
                          <Plus className="w-3 h-3" />
                          <span>تمديد +3 أيام</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => shiftCurrentExpiry(168)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold"
                        >
                          <Plus className="w-3 h-3" />
                          <span>تمديد +7 أيام</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => shiftCurrentExpiry(-24)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] font-bold"
                        >
                          <Minus className="w-3 h-3" />
                          <span>إنقاص -1 يوم</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* القسم 3: إعدادات الحماية ضد الكونسول وعرض الشريط ورسالة القفل */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 bg-white dark:bg-slate-900">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    3. درع منع الكونسول وخيارات العرض ورسالة التوقف
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className="flex items-start gap-3 p-3 rounded-xl border-2 border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
                      <input
                        type="checkbox"
                        checked={draftConfig.blockDevTools !== false}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            blockDevTools: e.target.checked,
                          }))
                        }
                        className="mt-1 w-4 h-4 accent-emerald-600"
                      />
                      <div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                          🛡️ تفعيل درع منع الكونسول والفحص (Anti-DevTools)
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          يعطل F12، كليك يمين، اختصارات الفحص، ويقفل الشاشة إذا فتح أي شخص الكونسول.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <input
                        type="checkbox"
                        checked={draftConfig.showBannerToStaff}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            showBannerToStaff: e.target.checked,
                          }))
                        }
                        className="mt-1 w-4 h-4 accent-[#062142]"
                      />
                      <div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                          إظهار شريط العد التنازلي للفترة التجريبية أعلى النظام
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          يمكنك إخفاؤه إذا أردت أن تعمل الفترة التجريبية في الخلفية بصمت تام.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <input
                        type="checkbox"
                        checked={draftConfig.lockPublicPagesOnExpiry}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            lockPublicPagesOnExpiry: e.target.checked,
                          }))
                        }
                        className="mt-1 w-4 h-4 accent-[#062142]"
                      />
                      <div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                          إغلاق جميع الشاشات (بما فيها الرئيسية والحجز) عند الانتهاء
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          تغلق المنظومة بالكامل وتظهر شاشة الاعتماد الرسمية فور انتهاء المهلة.
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        رسالة شاشة انتهاء الفترة التجريبية / الإيقاف:
                      </label>
                      <textarea
                        rows={2}
                        value={draftConfig.lockMessage}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            lockMessage: e.target.value,
                          }))
                        }
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        رقم تواصل المطور (اختياري):
                      </label>
                      <input
                        type="text"
                        value={draftConfig.developerPhone || ''}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            developerPhone: e.target.value,
                          }))
                        }
                        placeholder="مثال: 010xxxxxxxx"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* القسم 4: تصفير داتا التجربة لبدء التشغيل الرسمي النظيف */}
                <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs sm:text-sm font-extrabold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4" />
                      <span>تصفير الحجوزات والعمليات التجريبية لبدء التشغيل الرسمي (بضغطة واحدة)</span>
                    </h4>
                    <p className="text-[11px] text-rose-700 dark:text-rose-400 leading-relaxed">
                      يمسح جميع الحجوزات التجريبية، تسليمات الشفتات، المصروفات التجريبية، وبصمات
                      الاستشارة — مع الحفاظ التام على جميع العيادات، الأطباء، الجداول، وحسابات
                      الموظفين.
                    </p>
                  </div>

                  {!confirmPurgeOpen ? (
                    <button
                      type="button"
                      onClick={() => setConfirmPurgeOpen(true)}
                      className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-rose-600 hover:text-white text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-extrabold transition-all shrink-0"
                    >
                      تصفير بيانات التجربة 🧹
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={isPurging}
                        onClick={handleQuickPurgeTrialData}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-sm"
                      >
                        {isPurging ? 'جاري التصفير...' : 'تأكيد المسح النهائي'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmPurgeOpen(false)}
                        className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700"
                      >
                        تراجع
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* فوتر البوابة السرية وأزرار الحفظ والمزامنة */}
              <div className="bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 px-5 py-4 sm:px-7 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                  💡 تلميح: يمكنك فتح هذه البوابة السرية في أي وقت بكتابة{' '}
                  <code className="text-slate-800 dark:text-amber-300 font-bold">Amrr</code> في
                  صفحة دخول الموظفين، أو بالضغط 5 ضغطات متتالية على أيقونة درع المستشفى أسفل الموقع.
                </div>

                <div className="flex items-center gap-2.5 mr-auto">
                  <button
                    type="button"
                    onClick={() => setIsDeveloperPortalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    إغلاق
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveConfig()}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#062142] to-[#0d3b73] hover:from-[#0a2e5c] hover:to-[#12498c] text-white text-xs sm:text-sm font-extrabold shadow-lg transition-all"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جاري المزامنة مع Supabase...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-amber-300" />
                        <span>حفظ وتطبيق لحظياً على جميع الأجهزة</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
