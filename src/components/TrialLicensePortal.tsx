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
  Ban,
  Unlock,
  Cpu,
  Globe,
  Radar,
  Megaphone,
  Send,
  Users,
  LogOut,
  Database,
  Layers,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  SystemTrialLicenseConfig,
  BlockedSecurityEntity,
  SecurityIntrusionAttempt,
  DeveloperBroadcastMessage,
} from '../types';
import {
  verifySecretDeveloperCredentials,
  getHardwareDeviceFingerprint,
  fetchVisitorNetworkIdentity,
  checkClockRollbackTamper,
} from '../services/storage';

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

const VIEW_ARABIC_NAMES: Record<string, string> = {
  landing: 'الصفحة الرئيسية العامة',
  booking: 'شاشة حجز موعد مريض',
  ticket: 'شاشة عرض تذكرة الحجز',
  queue: 'شاشة النداء والانتظار',
  login: 'صفحة تسجيل دخول الموظفين',
  reception: 'مكتب الاستقبال',
  doctor: 'بوابة الطبيب',
  cashier: 'شاشة الخزينة والتحصيل',
  finance: 'الإدارة المالية والتأمين',
  admin: 'لوحة الإدارة العليا والتقارير',
};

export const TrialLicensePortal: React.FC = () => {
  const {
    trialLicenseConfig,
    updateTrialLicenseConfig,
    reportSecurityIntrusion,
    liveConnectedDevices,
    forceLogoutDevice,
    injectIsolatedDemoData,
    removeIsolatedDemoDataOnly,
    isolatedDemoRecordsCount,
    isDeveloperPortalOpen,
    setIsDeveloperPortalOpen,
    currentView,
    currentUser,
    selectivePurgeRecords,
    addToast,
  } = useApp();

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [devToolsDetected, setDevToolsDetected] = useState<boolean>(false);
  const [devSessionBypass, setDevSessionBypass] = useState<boolean>(false);
  const devToolsStrikeCountRef = useRef<number>(0);

  // بيانات بصمة الجهاز الحالي وعنوان الـ IP والدولة
  const [myDeviceHw] = useState(() => getHardwareDeviceFingerprint());
  const [myNetworkInfo, setMyNetworkInfo] = useState<{
    ip: string;
    ispLocation: string;
    countryCode: string;
  }>({
    ip: 'جاري الفحص...',
    ispLocation: '',
    countryCode: 'UNKNOWN',
  });

  useEffect(() => {
    let mounted = true;
    fetchVisitorNetworkIdentity().then((info) => {
      if (mounted) setMyNetworkInfo(info);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const isShieldEnabled =
    trialLicenseConfig.blockDevTools !== false &&
    !isDeveloperPortalOpen &&
    !devSessionBypass;

  // فحص ما إذا كان هذا الجهاز (ببصمة الهاردوير أو عنوان الـ IP) محظوراً أمنياً
  const matchedBanEntity: BlockedSecurityEntity | undefined =
    !isDeveloperPortalOpen && !devSessionBypass
      ? (trialLicenseConfig.blockedEntities || []).find(
          (b) =>
            (b.deviceFingerprint && b.deviceFingerprint === myDeviceHw.fingerprintId) ||
            (b.ip &&
              myNetworkInfo.ip &&
              myNetworkInfo.ip !== 'غير معروف' &&
              myNetworkInfo.ip !== 'جاري الفحص...' &&
              b.ip === myNetworkInfo.ip)
        )
      : undefined;

  // فحص حظر الـ VPN أو الاتصال من خارج جمهورية مصر العربية (Geo-Fence Egypt Only)
  const isVpnOrOutsideEgyptBlocked =
    Boolean(trialLicenseConfig.blockNonEgyptVpn) &&
    !isDeveloperPortalOpen &&
    !devSessionBypass &&
    myNetworkInfo.countryCode !== 'UNKNOWN' &&
    myNetworkInfo.countryCode !== 'EG';

  const vpnBlockReportedRef = useRef<boolean>(false);
  useEffect(() => {
    if (isVpnOrOutsideEgyptBlocked && !vpnBlockReportedRef.current) {
      vpnBlockReportedRef.current = true;
      reportSecurityIntrusion(
        'vpn_geo_block',
        `محاولة فتح النظام عبر VPN أو من خارج مصر (${myNetworkInfo.countryCode} - ${myNetworkInfo.ispLocation})`
      );
    } else if (!isVpnOrOutsideEgyptBlocked) {
      vpnBlockReportedRef.current = false;
    }
  }, [isVpnOrOutsideEgyptBlocked, myNetworkInfo.countryCode, myNetworkInfo.ispLocation]);

  // فحص التلاعب بتأخير ساعة الجهاز (Anti-Time Travel)
  const clockTamperStatus =
    !isDeveloperPortalOpen && !devSessionBypass
      ? checkClockRollbackTamper(trialLicenseConfig)
      : { isTampered: false, behindByMinutes: 0 };

  const clockTamperReportedRef = useRef<boolean>(false);
  useEffect(() => {
    if (clockTamperStatus.isTampered && !clockTamperReportedRef.current) {
      clockTamperReportedRef.current = true;
      reportSecurityIntrusion(
        'clock_rollback',
        `محاولة تأخير ساعة الجهاز للوراء بمقدار (${clockTamperStatus.behindByMinutes} دقيقة) لخداع الفترة التجريبية`
      );
    } else if (!clockTamperStatus.isTampered) {
      clockTamperReportedRef.current = false;
    }
  }, [clockTamperStatus.isTampered, clockTamperStatus.behindByMinutes]);

  // منع النسخ وتحديد النصوص وسحب الصور عند تفعيل خيار Anti-Copy
  useEffect(() => {
    if (!trialLicenseConfig.antiCopyAndPrint || isDeveloperPortalOpen || devSessionBypass) {
      return;
    }

    const preventAction = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
    };

    window.addEventListener('copy', preventAction, true);
    window.addEventListener('cut', preventAction, true);
    window.addEventListener('dragstart', preventAction, true);
    window.addEventListener('selectstart', preventAction, true);

    return () => {
      window.removeEventListener('copy', preventAction, true);
      window.removeEventListener('cut', preventAction, true);
      window.removeEventListener('dragstart', preventAction, true);
      window.removeEventListener('selectstart', preventAction, true);
    };
  }, [trialLicenseConfig.antiCopyAndPrint, isDeveloperPortalOpen, devSessionBypass]);

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
          '%cهذه المنظومة الطبية محمية بالكامل. يتم تسجيل عنوان الـ IP وبصمة الهاردوير الخاصة بجهازك تلقائياً عند أي محاولة فحص أو تلاعب.',
          'color: #fbbf24; font-size: 14px; font-weight: bold; font-family: Cairo, sans-serif;'
        );
      } catch {}
    };

    printSecurityWarning();
    const noop = () => {};
    console.log = noop;
    console.info = noop;
    console.warn = noop;
    console.debug = noop;
    console.table = noop;
    console.dir = noop;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = (e.key || '').toUpperCase();
      const code = e.keyCode || e.which;

      const isF12 = key === 'F12' || code === 123;
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey || e.altKey;

      const isInspectShortcut =
        isCtrlOrCmd &&
        isShift &&
        (key === 'I' ||
          key === 'J' ||
          key === 'C' ||
          key === 'K' ||
          code === 73 ||
          code === 74 ||
          code === 67 ||
          code === 75);

      const isViewSource = isCtrlOrCmd && (key === 'U' || code === 85);

      if (isF12 || isInspectShortcut || isViewSource) {
        e.preventDefault();
        e.stopPropagation();
        printSecurityWarning();
        reportSecurityIntrusion(
          'shortcut_inspect',
          `محاولة فتح الفحص عبر اختصار لوحة المفاتيح (${isF12 ? 'F12' : isViewSource ? 'Ctrl+U' : 'Ctrl+Shift+' + key})`
        );
        return false;
      }
    };

    const detectOpenDevTools = () => {
      let detectedNow = false;

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
        if (devToolsStrikeCountRef.current === 1) {
          reportSecurityIntrusion(
            'devtools_open',
            'فتح نافذة أدوات المطور / الكونسول من قائمة المتصفح'
          );
        }
        setDevToolsDetected(true);
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

  // حالات الرسالة المنبثقة الفورية من المطور
  const [dismissedBroadcastId, setDismissedBroadcastId] = useState<string>(() => {
    try {
      return sessionStorage.getItem('sharaya_dismissed_broadcast_id') || '';
    } catch {
      return '';
    }
  });
  const [broadcastTitleInput, setBroadcastTitleInput] = useState('تنبيه من مسؤول تطوير المنظومة');
  const [broadcastBodyInput, setBroadcastBodyInput] = useState('');
  const [broadcastTargetInput, setBroadcastTargetInput] = useState<'staff_only' | 'everyone'>(
    'staff_only'
  );

  // حالات لوحة تحكم المطور السرية
  const [draftConfig, setDraftConfig] = useState<SystemTrialLicenseConfig>(trialLicenseConfig);
  const [customDaysInput, setCustomDaysInput] = useState<string>(
    String(trialLicenseConfig.trialDays || 7)
  );
  const [manualBanTarget, setManualBanTarget] = useState('');
  const [manualBanReason, setManualBanReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmPurgeOpen, setConfirmPurgeOpen] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

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

  // هل يجب إظهار الرسالة المنبثقة الفورية من المطور؟
  const activeBroadcast = trialLicenseConfig.activeBroadcastMessage;
  const shouldShowBroadcastModal =
    Boolean(activeBroadcast && activeBroadcast.id && activeBroadcast.id !== dismissedBroadcastId) &&
    (activeBroadcast?.target === 'everyone' || Boolean(currentUser) || isStaffView);

  const handleDismissBroadcast = (id: string) => {
    setDismissedBroadcastId(id);
    try {
      sessionStorage.setItem('sharaya_dismissed_broadcast_id', id);
    } catch {}
  };

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
          : `تم ضبط الفترة التجريبية وإعدادات الحماية بنجاح.`,
    });
  };

  // إرسال رسالة منبثقة فورية لجميع الشاشات المفتوحة
  const handleSendLiveBroadcast = async () => {
    if (!broadcastBodyInput.trim()) return;
    const newMsg: DeveloperBroadcastMessage = {
      id: `bcast-${Date.now()}`,
      title: broadcastTitleInput.trim() || 'تنبيه من مسؤول تطوير المنظومة',
      message: broadcastBodyInput.trim(),
      target: broadcastTargetInput,
      sentAt: new Date().toISOString(),
    };
    const nextConfig: SystemTrialLicenseConfig = {
      ...draftConfig,
      activeBroadcastMessage: newMsg,
    };
    setBroadcastBodyInput('');
    setDraftConfig(nextConfig);
    await handleSaveConfig(nextConfig);
  };

  const handleClearLiveBroadcast = async () => {
    const nextConfig: SystemTrialLicenseConfig = {
      ...draftConfig,
      activeBroadcastMessage: null,
    };
    setDraftConfig(nextConfig);
    await handleSaveConfig(nextConfig);
  };

  // حظر فوري لـ IP وبصمة جهاز من سجل الرادار أو المتصلين لايف
  const handleBanAttemptEntity = async (attempt: {
    ip?: string;
    deviceFingerprint: string;
    deviceDetails: string;
    typeLabel?: string;
  }) => {
    const currentBlocked = Array.isArray(draftConfig.blockedEntities)
      ? draftConfig.blockedEntities
      : [];
    const alreadyBanned = currentBlocked.some(
      (b) =>
        (b.deviceFingerprint && b.deviceFingerprint === attempt.deviceFingerprint) ||
        (b.ip && attempt.ip && attempt.ip !== 'غير معروف' && b.ip === attempt.ip)
    );
    if (alreadyBanned) return;

    const newBan: BlockedSecurityEntity = {
      id: `ban-${Date.now()}`,
      ip: attempt.ip && attempt.ip !== 'غير معروف' ? attempt.ip : undefined,
      deviceFingerprint: attempt.deviceFingerprint,
      deviceDetails: attempt.deviceDetails,
      reason: `حظر بأمر المطور${attempt.typeLabel ? ` (${attempt.typeLabel})` : ''}`,
      blockedAt: new Date().toISOString(),
      autoBlocked: false,
    };

    const nextConfig: SystemTrialLicenseConfig = {
      ...draftConfig,
      blockedEntities: [newBan, ...currentBlocked],
    };
    setDraftConfig(nextConfig);
    await handleSaveConfig(nextConfig);
  };

  // إلغاء حظر IP أو بصمة جهاز
  const handleUnbanEntity = async (banId: string) => {
    const currentBlocked = Array.isArray(draftConfig.blockedEntities)
      ? draftConfig.blockedEntities
      : [];
    const nextConfig: SystemTrialLicenseConfig = {
      ...draftConfig,
      blockedEntities: currentBlocked.filter((b) => b.id !== banId),
    };
    setDraftConfig(nextConfig);
    await handleSaveConfig(nextConfig);
  };

  // إضافة حظر يدوي لـ IP أو بصمة جهاز
  const handleAddManualBan = async () => {
    const target = manualBanTarget.trim();
    if (!target) return;
    const isFingerprint = target.toUpperCase().startsWith('FP-');
    const currentBlocked = Array.isArray(draftConfig.blockedEntities)
      ? draftConfig.blockedEntities
      : [];

    const newBan: BlockedSecurityEntity = {
      id: `ban-${Date.now()}`,
      ip: isFingerprint ? undefined : target,
      deviceFingerprint: isFingerprint ? target.toUpperCase() : undefined,
      deviceDetails: isFingerprint ? 'حظر يدوي ببصمة الجهاز' : `حظر يدوي لعنوان IP (${target})`,
      reason: manualBanReason.trim() || 'حظر يدوي مباشر بواسطة مسؤول تطوير المنظومة',
      blockedAt: new Date().toISOString(),
      autoBlocked: false,
    };

    const nextConfig: SystemTrialLicenseConfig = {
      ...draftConfig,
      blockedEntities: [newBan, ...currentBlocked],
    };
    setManualBanTarget('');
    setManualBanReason('');
    setDraftConfig(nextConfig);
    await handleSaveConfig(nextConfig);
  };

  // مسح سجل رادار المحاولات
  const handleClearIntrusionLogs = async () => {
    const nextConfig: SystemTrialLicenseConfig = {
      ...draftConfig,
      intrusionLogs: [],
    };
    setDraftConfig(nextConfig);
    await handleSaveConfig(nextConfig);
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
      {/* علامة مائية خفيفة في الخلفية أثناء الفترة التجريبية (تختفي تلقائياً عند تفعيل النسخة الدائمة) */}
      {isTrialActive && trialLicenseConfig.showTrialWatermark && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[35] pointer-events-none select-none overflow-hidden flex flex-wrap items-center justify-around opacity-[0.045] dark:opacity-[0.06] no-print"
        >
          {Array.from({ length: 12 }).map((_, idx) => (
            <div
              key={idx}
              className="-rotate-12 text-lg sm:text-2xl font-black text-slate-900 dark:text-amber-300 whitespace-nowrap p-8"
            >
              نسخة معاينة تجريبية • عيادات الجمعية الشرعية بأوسيم • تطوير م. عمرو
            </div>
          ))}
        </div>
      )}

      {/* نافذة الرسالة المنبثقة الفورية المرسلة من المطور لجميع الشاشات */}
      <AnimatePresence>
        {shouldShowBroadcastModal && activeBroadcast && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9996] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 no-print"
          >
            <motion.div
              initial={{ scale: 0.92, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 16, opacity: 0 }}
              className="max-w-lg w-full bg-white dark:bg-slate-900 border-2 border-[#062142] dark:border-amber-400/50 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="bg-gradient-to-r from-[#062142] via-[#0b315e] to-[#062142] text-white px-6 py-4 flex items-center gap-3 border-b border-amber-400/30">
                <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{activeBroadcast.title}</h3>
                  <p className="text-[11px] text-amber-200">
                    إشعار فوري مباشر • {new Date(activeBroadcast.sentAt).toLocaleTimeString('ar-EG')}
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-line bg-slate-50 dark:bg-slate-800/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                  {activeBroadcast.message}
                </p>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDismissBroadcast(activeBroadcast.id)}
                    className="px-6 py-2.5 rounded-xl bg-[#062142] hover:bg-[#0b315e] text-white text-xs sm:text-sm font-extrabold shadow-md transition-all"
                  >
                    تم الاطلاع — متابعة العمل
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 0-أ. شاشة الحظر الأمني الكامل للـ IP وبصمة عتاد الجهاز (حتى مع تشغيل VPN) */}
      <AnimatePresence>
        {matchedBanEntity && !isDeveloperPortalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-gradient-to-br from-[#2a040a] via-[#170409] to-[#080204] text-white flex flex-col items-center justify-center p-4 sm:p-6 text-center no-print select-none"
          >
            <div className="max-w-lg w-full bg-white/5 backdrop-blur-xl border-2 border-rose-500/50 rounded-3xl p-6 sm:p-9 shadow-2xl space-y-5">
              <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border-2 border-rose-400/60 text-rose-400 flex items-center justify-center mx-auto shadow-lg">
                <Ban className="w-11 h-11" />
              </div>

              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-300 text-xs font-extrabold">
                  قرار حظر أمني مشدد
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  ⛔ تم حظر هذا الجهاز وعنوان الـ IP من الوصول للمنظومة
                </h1>
              </div>

              <p className="text-sm text-rose-100/90 leading-relaxed font-semibold bg-rose-950/50 border border-rose-500/30 rounded-2xl p-4">
                {matchedBanEntity.reason ||
                  'تم رصد محاولات فحص أو تلاعب أمني غير مصرح بها من هذا الجهاز وتم إدراج بصمة العتاد وعنوان الشبكة في قائمة الحظر.'}
              </p>

              <div className="bg-black/40 border border-white/10 rounded-2xl p-3.5 text-xs text-slate-300 space-y-1.5 font-mono text-right">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-bold">بصمة عتاد الجهاز:</span>
                  <span className="text-amber-300 font-bold">{myDeviceHw.fingerprintId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans font-bold">عنوان الشبكة (IP):</span>
                  <span className="text-rose-300 font-bold">{myNetworkInfo.ip}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setUnlockUser('');
                    setUnlockPass('');
                    setUnlockError('');
                    setUnlockModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-bold border border-white/10 transition-all"
                >
                  بوابة المطور 🔑
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 0-أ-2. شاشة حظر برامج الـ VPN أو الاتصال من خارج مصر */}
      <AnimatePresence>
        {isVpnOrOutsideEgyptBlocked && !matchedBanEntity && !isDeveloperPortalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9997] bg-gradient-to-br from-[#04152b] via-[#170b29] to-slate-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 text-center no-print select-none"
          >
            <div className="max-w-lg w-full bg-white/5 backdrop-blur-xl border-2 border-rose-400/50 rounded-3xl p-6 sm:p-9 shadow-2xl space-y-5">
              <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border-2 border-rose-400/60 text-rose-300 flex items-center justify-center mx-auto shadow-lg">
                <Globe className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-300 text-xs font-extrabold">
                  حماية النطاق الجغرافي المصري 🇪🇬
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  ⛔ يُمنع استخدام برامج الـ VPN أو الاتصال من خارج مصر
                </h2>
              </div>

              <p className="text-sm text-slate-200 leading-relaxed font-medium bg-white/5 border border-white/10 rounded-2xl p-4">
                هذه المنظومة الطبية مخصصة للعمل داخل جمهورية مصر العربية فقط. يرجى إيقاف برنامج الـ
                VPN أو البروكسي فوراً وإعادة تحميل الصفحة للمتابعة.
              </p>

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setUnlockUser('');
                    setUnlockPass('');
                    setUnlockError('');
                    setUnlockModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-bold border border-white/15"
                >
                  بوابة المطور 🔑
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 0-ب. شاشة الحماية ضد تأخير تاريخ وساعة الجهاز (Anti-Time Travel Overlay) */}
      <AnimatePresence>
        {clockTamperStatus.isTampered && !matchedBanEntity && !isDeveloperPortalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9997] bg-gradient-to-br from-[#04152b] via-[#1e1b4b] to-slate-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 text-center no-print select-none"
          >
            <div className="max-w-lg w-full bg-white/5 backdrop-blur-xl border-2 border-amber-400/50 rounded-3xl p-6 sm:p-9 shadow-2xl space-y-5">
              <div className="w-20 h-20 rounded-3xl bg-amber-400/20 border-2 border-amber-400/60 text-amber-300 flex items-center justify-center mx-auto shadow-lg">
                <Clock className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-extrabold">
                  حماية التوقيت السحابي المركزي
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  ⏱️ تم رصد تلاعب في تاريخ وساعة الجهاز
                </h2>
              </div>

              <p className="text-sm text-slate-200 leading-relaxed font-medium bg-white/5 border border-white/10 rounded-2xl p-4">
                ساعة هذا الجهاز متأخرة عن التوقيت الفعلي للخادم السحابي. لا يمكن تشغيل المنظومة أو
                تجاوز الفترة التجريبية عبر إرجاع تاريخ الكمبيوتر أو الهاتف للوراء. يرجى ضبط التاريخ
                والساعة الصحيحين للمتابعة.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setNowMs(Date.now())}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-md transition-all"
                >
                  لقد قمت بضبط الساعة — إعادة الفحص
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

      {/* 0-ج. شاشة الحماية الفورية عند رصد فتح أدوات المطور / الكونسول (Anti-DevTools Lock Overlay) */}
      <AnimatePresence>
        {devToolsDetected && isShieldEnabled && !matchedBanEntity && (
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
                نافذة الفحص أو وحدة التحكم (Console). تم تسجيل بصمة الجهاز ({myDeviceHw.fingerprintId}
                ) وعنوان الـ IP ({myNetworkInfo.ip}) في رادار الحماية. يرجى إغلاق النافذة فوراً.
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
        {shouldShowLockScreen && !matchedBanEntity && !isDeveloperPortalOpen && (
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

      {/* 4. البوابة السرية الكاملة للمطور (م. عمرو) */}
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
              className="bg-white dark:bg-slate-900 border-2 border-[#062142] dark:border-amber-400/40 rounded-3xl max-w-5xl w-full max-h-[93vh] flex flex-col shadow-2xl overflow-hidden my-auto"
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
                        بوابة المطور السرية — التحكم المركزي الشامل ورادار الحماية السيبرانية
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                        Supabase Realtime Sync
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      مرحباً م. عمرو (`Amrr`) • تحكم كامل عن بُعد في التجربة، المتصلين لايف، البث
                      الفوري، البيانات المعزولة، وحظر المخترقين
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
                      جهازك الحالي كمطور: <code className="font-bold">{myDeviceHw.fingerprintId}</code> • IP:{' '}
                      <code className="font-bold">{myNetworkInfo.ip}</code> (مستثنى دائماً)
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

                {/* القسم 3: حقن وسحب بيانات العرض التجريبية المعزولة بضغطة زر */}
                <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 sm:p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                        <Database className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                          3. بيانات العرض التجريبية المعزولة (بدون لمس أي بيانات أصلية أو مدخلة)
                        </h3>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          بضغطة زر يمكنك إضافة حركات تجريبية لمعاينة التقارير، وبضغطة زر تسحبها
                          وحدها وتترك كل بياناتهم كما هي 100%
                        </p>
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-full bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                      السجلات التجريبية المعزولة حالياً: {isolatedDemoRecordsCount} سجل
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      disabled={isDemoLoading}
                      onClick={async () => {
                        setIsDemoLoading(true);
                        await injectIsolatedDemoData();
                        setIsDemoLoading(false);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-extrabold shadow-sm transition-all"
                    >
                      <Layers className="w-4 h-4" />
                      <span>➕ حقن بيانات عرض تجريبية واقعية الآن</span>
                    </button>

                    <button
                      type="button"
                      disabled={isDemoLoading || isolatedDemoRecordsCount === 0}
                      onClick={async () => {
                        setIsDemoLoading(true);
                        await removeIsolatedDemoDataOnly();
                        setIsDemoLoading(false);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-amber-50 text-amber-800 dark:text-amber-300 border-2 border-amber-400/60 text-xs font-extrabold transition-all disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>🧹 سحب وإزالة البيانات التجريبية فقط (مع حفظ بياناتهم 100%)</span>
                    </button>
                  </div>
                </div>

                {/* القسم 4: إرسال رسالة منبثقة فورية لجميع الشاشات المفتوحة الآن */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3 bg-white dark:bg-slate-900">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-amber-500" />
                      <span>4. إرسال رسالة منبثقة فورية على شاشة الإدارة والموظفين لايف</span>
                    </h3>
                    {draftConfig.activeBroadcastMessage && (
                      <button
                        type="button"
                        onClick={handleClearLiveBroadcast}
                        className="px-3 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-800"
                      >
                        إلغاء وإخفاء الرسالة المعروضة حالياً
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={broadcastTitleInput}
                      onChange={(e) => setBroadcastTitleInput(e.target.value)}
                      placeholder="عنوان الرسالة..."
                      className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={broadcastBodyInput}
                      onChange={(e) => setBroadcastBodyInput(e.target.value)}
                      placeholder="اكتب نص الرسالة الفورية التي ستظهر في منتصف الشاشة..."
                      className="sm:col-span-2 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="bcastTarget"
                          checked={broadcastTargetInput === 'staff_only'}
                          onChange={() => setBroadcastTargetInput('staff_only')}
                        />
                        <span>للموظفين والإدارة فقط</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="bcastTarget"
                          checked={broadcastTargetInput === 'everyone'}
                          onChange={() => setBroadcastTargetInput('everyone')}
                        />
                        <span>لجميع الشاشات المفتوحة (بما فيها الرئيسية)</span>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={handleSendLiveBroadcast}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#062142] hover:bg-[#0b315e] text-white text-xs font-extrabold shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5 text-amber-300" />
                      <span>إرسال الرسالة للشاشات الآن 🚀</span>
                    </button>
                  </div>
                </div>

                {/* القسم 5: دروع الحماية السيبرانية وخيارات العرض */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 bg-white dark:bg-slate-900">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    5. دروع الحماية السيبرانية وخيارات العرض
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <label className="flex items-start gap-3 p-3 rounded-xl border-2 border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20 cursor-pointer">
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
                          🛡️ درع منع الكونسول والفحص (Anti-DevTools)
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          يعطل F12، كليك يمين، اختصارات الفحص، ويقفل الشاشة إذا فتح أي شخص الكونسول.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl border-2 border-rose-500/40 bg-rose-50/40 dark:bg-rose-950/20 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draftConfig.autoBanAfterStrikes !== false}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            autoBanAfterStrikes: e.target.checked,
                          }))
                        }
                        className="mt-1 w-4 h-4 accent-rose-600"
                      />
                      <div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                          🚫 حظر تلقائي بعد 3 محاولات اختراق (Auto-Ban)
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          يحظر الـ IP وبصمة عتاد جهاز المخترق تلقائياً بعد 3 محاولات فحص أو تلاعب.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl border-2 border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draftConfig.antiClockTamper !== false}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            antiClockTamper: e.target.checked,
                          }))
                        }
                        className="mt-1 w-4 h-4 accent-amber-600"
                      />
                      <div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                          ⏱️ حماية التوقيت السحابي (منع تأخير الساعة)
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          يكشف فوراً أي محاولة لإرجاع تاريخ الكمبيوتر أو الموبايل للوراء لخداع
                          التجربة.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <input
                        type="checkbox"
                        checked={Boolean(draftConfig.blockNonEgyptVpn)}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            blockNonEgyptVpn: e.target.checked,
                          }))
                        }
                        className="mt-1 w-4 h-4 accent-[#062142]"
                      />
                      <div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                          🇪🇬 منع الـ VPN والاتصال من خارج مصر
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          يقفل النظام أمام أي اتصال قادم عبر VPN أجنبي خارج جمهورية مصر العربية.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <input
                        type="checkbox"
                        checked={Boolean(draftConfig.antiCopyAndPrint)}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            antiCopyAndPrint: e.target.checked,
                          }))
                        }
                        className="mt-1 w-4 h-4 accent-[#062142]"
                      />
                      <div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                          🚫 منع تحديد ونسخ النصوص والصور (Anti-Copy)
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          يمنع نسخ الجداول والنصوص أو سحب الصور من شاشات النظام.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <input
                        type="checkbox"
                        checked={Boolean(draftConfig.showTrialWatermark)}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            showTrialWatermark: e.target.checked,
                          }))
                        }
                        className="mt-1 w-4 h-4 accent-[#062142]"
                      />
                      <div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                          💧 علامة مائية خفيفة في الخلفية أثناء التجربة
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          تظهر في الخلفية وقت التجربة وتختفي أوتوماتيك عند تفعيل النسخة الدائمة.
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
                          إغلاق جميع الشاشات عند انتهاء المهلة
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          تغلق المنظومة بالكامل وتظهر شاشة الاعتماد الرسمية فور انتهاء الوقت.
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
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

                {/* القسم 6: الأجهزة المتصلة بالنظام الآن لايف (Live Online Sessions) */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3 bg-white dark:bg-slate-900">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                        <Users className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                          6. الأجهزة المتصلة بالنظام الآن لايف ({liveConnectedDevices.length})
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          يعرض كل من يفتح الموقع في هذه اللحظة مع إمكانية طرده من الجلسة أو حظر
                          جهازه فوراً
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {liveConnectedDevices.map((dev) => {
                      const isMe = dev.deviceFingerprint === myDeviceHw.fingerprintId;
                      return (
                        <div
                          key={dev.deviceFingerprint}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                                {dev.activeUsername}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 text-[11px] font-bold">
                                الشاشة الحالية: {VIEW_ARABIC_NAMES[dev.currentView] || dev.currentView}
                              </span>
                              {isMe && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-extrabold">
                                  جهازك الحالي كمطور
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              <span>IP: {dev.ip}</span>
                              {dev.ispLocation && <span className="font-sans">({dev.ispLocation})</span>}
                              <span>• {dev.deviceFingerprint}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {dev.deviceDetails}
                            </div>
                          </div>

                          {!isMe && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => forceLogoutDevice(dev.deviceFingerprint)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold shadow-2xs"
                              >
                                <LogOut className="w-3.5 h-3.5" />
                                <span>طرد من الجلسة</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleBanAttemptEntity({
                                    ip: dev.ip,
                                    deviceFingerprint: dev.deviceFingerprint,
                                    deviceDetails: dev.deviceDetails,
                                    typeLabel: 'حظر مباشر من شاشة المتصلين لايف',
                                  })
                                }
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-2xs"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>حظر الجهاز</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* القسم 7: رادار كشف محاولات الاختراق وحظر الـ IP وبصمة الجهاز */}
                <div className="rounded-2xl border-2 border-[#062142]/30 dark:border-amber-400/30 bg-slate-50/70 dark:bg-slate-800/40 p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                        <Radar className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                          7. رادار كشف محاولات الاختراق وحظر الـ IP وبصمة الجهاز (حتى مع VPN)
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          يسجل عنوان الـ IP، شركة الإنترنت، وبصمة كارت الشاشة والمعالج لأي شخص يحاول
                          فحص الكود أو التلاعب بالنظام
                        </p>
                      </div>
                    </div>

                    {(draftConfig.intrusionLogs?.length || 0) > 0 && (
                      <button
                        type="button"
                        onClick={handleClearIntrusionLogs}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-50 text-rose-600 border border-rose-200 dark:border-rose-800 text-xs font-bold"
                      >
                        مسح سجل الرادار ({draftConfig.intrusionLogs?.length})
                      </button>
                    )}
                  </div>

                  {/* خانة إضافة حظر يدوي لـ IP أو بصمة جهاز */}
                  <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <input
                      type="text"
                      value={manualBanTarget}
                      onChange={(e) => setManualBanTarget(e.target.value)}
                      placeholder="أدخل عنوان IP (مثال: 197.55.x.x) أو بصمة جهاز (FP-XXXXXXXX)..."
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={manualBanReason}
                      onChange={(e) => setManualBanReason(e.target.value)}
                      placeholder="سبب الحظر (اختياري)..."
                      className="sm:w-56 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualBan}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shrink-0"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>إضافة للحظر الفوري</span>
                    </button>
                  </div>

                  {/* قائمة المحظورين حالياً */}
                  {(draftConfig.blockedEntities?.length || 0) > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-extrabold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                        <Ban className="w-3.5 h-3.5" />
                        <span>
                          قائمة عناوين الـ IP والأجهزة المحظورة حالياً (
                          {draftConfig.blockedEntities?.length}):
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {(draftConfig.blockedEntities || []).map((ban) => (
                          <div
                            key={ban.id}
                            className="p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/70 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                {ban.ip && (
                                  <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[11px] font-mono font-bold">
                                    IP: {ban.ip}
                                  </span>
                                )}
                                {ban.deviceFingerprint && (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-900 text-amber-300 text-[11px] font-mono font-bold">
                                    {ban.deviceFingerprint}
                                  </span>
                                )}
                                {ban.autoBlocked && (
                                  <span className="text-[10px] font-extrabold text-rose-700 dark:text-rose-300">
                                    (حظر تلقائي)
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">
                                {ban.reason}
                              </p>
                              {ban.deviceDetails && (
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                  {ban.deviceDetails}
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleUnbanEntity(ban.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold shrink-0 shadow-2xs"
                            >
                              <Unlock className="w-3 h-3" />
                              <span>فك الحظر</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* جدول سجل الرادار للمحاولات المرصودة */}
                  {(draftConfig.intrusionLogs?.length || 0) === 0 ? (
                    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400 font-bold">
                      ✅ لم يتم رصد أي محاولات اختراق أو تلاعب حتى الآن. أي محاولة لفتح الكونسول أو
                      تأخير الساعة أو تعديل المتصفح ستظهر هنا فوراً بكامل بيانات الجهاز والـ IP.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {(draftConfig.intrusionLogs || []).map((item) => {
                        const matchingBan = (draftConfig.blockedEntities || []).find(
                          (b) =>
                            (b.deviceFingerprint &&
                              b.deviceFingerprint === item.deviceFingerprint) ||
                            (b.ip && item.ip !== 'غير معروف' && b.ip === item.ip)
                        );

                        return (
                          <div
                            key={item.id}
                            className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-2xs"
                          >
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 text-xs font-extrabold border border-rose-200 dark:border-rose-800">
                                  ⚠️ {item.typeLabel}
                                </span>
                                {item.strikeCount && (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold">
                                    المحاولة رقم {item.strikeCount}
                                  </span>
                                )}
                                <span className="text-[11px] font-bold text-slate-500">
                                  🕒 {new Date(item.timestamp).toLocaleString('ar-EG')}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold">
                                  <Globe className="w-3 h-3 text-blue-600" />
                                  <span>IP: {item.ip}</span>
                                </span>
                                {item.ispLocation && (
                                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                    ({item.ispLocation})
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#062142] text-amber-300 font-mono text-[11px] font-bold">
                                  <Cpu className="w-3 h-3" />
                                  <span>{item.deviceFingerprint}</span>
                                </span>
                                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                  👤 الحساب: {item.activeUsername || 'زائر'}
                                </span>
                              </div>

                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                💻 مواصفات الجهاز: {item.deviceDetails}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {matchingBan ? (
                                <button
                                  type="button"
                                  onClick={() => handleUnbanEntity(matchingBan.id)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-xs"
                                >
                                  <Unlock className="w-3.5 h-3.5" />
                                  <span>محظور — فك الحظر</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleBanAttemptEntity(item)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-xs"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>حظر هذا الـ IP والجهاز فوراً</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* القسم 8: تصفير شامل لجميع الحجوزات عند بدء التشغيل الرسمي */}
                <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs sm:text-sm font-extrabold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4" />
                      <span>
                        8. مسح شامل لجميع الحجوزات والعمليات (لتسليم النظام فارغاً بالكامل)
                      </span>
                    </h4>
                    <p className="text-[11px] text-rose-700 dark:text-rose-400 leading-relaxed">
                      يمسح كافة الحجوزات والتسليمات والمصروفات بالكامل لتسليم النظام في أول يوم عمل
                      رسمي — مع الحفاظ على العيادات والأطباء والجداول.
                    </p>
                  </div>

                  {!confirmPurgeOpen ? (
                    <button
                      type="button"
                      onClick={() => setConfirmPurgeOpen(true)}
                      className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-rose-600 hover:text-white text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-extrabold transition-all shrink-0"
                    >
                      تصفير شامل للعمليات 🧹
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
