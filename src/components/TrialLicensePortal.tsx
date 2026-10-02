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
  Copy,
  FileCheck2,
  Archive,
  HardDriveDownload,
  HardDriveUpload,
  FolderDown,
  FolderUp,
  Maximize2,
  Minimize2,
  Key,
  Zap,
  Activity,
  CheckCheck,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  SystemTrialLicenseConfig,
  BlockedSecurityEntity,
  SecurityIntrusionAttempt,
  DeveloperBroadcastMessage,
  GeneratedLicenseKey,
} from '../types';
import {
  verifySecretDeveloperCredentials,
  getHardwareDeviceFingerprint,
  fetchVisitorNetworkIdentity,
  checkClockRollbackTamper,
  DMCA_OWNERSHIP_CERTIFICATE_ID,
  generateSignedLicenseKey,
  verifySignedLicenseKey,
  saveBookings,
  saveClinics,
  saveDoctors,
  saveDailySchedule,
  saveShiftHandovers,
  saveFinanceLedger,
  saveInsuranceContracts,
  saveTrialLicenseConfig,
} from '../services/storage';
import {
  saveTrialLicenseConfigToDb,
  saveShiftHandoversToDb,
  saveFinanceLedgerToDb,
  saveInsuranceContractsToDb,
} from '../services/supabaseService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

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
    clinics,
    doctors,
    dailySchedule,
    bookings,
    shiftHandovers,
    financeLedger,
    insuranceContracts,
    staffAccounts,
    supportInfoText,
    officialWorkingHours,
    rolePermissions,
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

  // فحص قفل الدومين ضد نسخ الكود وتشغيله على موقع آخر غير معتمد (Anti-Clone Domain Protection)
  const currentHost =
    typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : 'localhost';
  const configuredDomains = Array.isArray(trialLicenseConfig.authorizedDomainsList)
    ? trialLicenseConfig.authorizedDomainsList.map((d) => d.trim().toLowerCase()).filter(Boolean)
    : [];
  const isBuiltInSafeDevHost =
    currentHost === 'localhost' ||
    currentHost === '127.0.0.1' ||
    currentHost.endsWith('.run.app');
  const isAuthorizedHost =
    !trialLicenseConfig.enforceAuthorizedDomainLock ||
    isBuiltInSafeDevHost ||
    configuredDomains.length === 0 ||
    configuredDomains.some((d) => currentHost === d || currentHost.endsWith(`.${d}`));
  const isUnauthorizedDomainClone =
    Boolean(trialLicenseConfig.enforceAuthorizedDomainLock) &&
    !isAuthorizedHost &&
    !isDeveloperPortalOpen &&
    !devSessionBypass;

  const domainCloneReportedRef = useRef<boolean>(false);
  useEffect(() => {
    if (isUnauthorizedDomainClone && !domainCloneReportedRef.current) {
      domainCloneReportedRef.current = true;
      reportSecurityIntrusion(
        'unauthorized_domain_clone',
        `محاولة تشغيل نسخة مقلدة/منسوخة على دومين غير مصرح به (${currentHost})`
      );
    } else if (!isUnauthorizedDomainClone) {
      domainCloneReportedRef.current = false;
    }
  }, [isUnauthorizedDomainClone, currentHost]);

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

  const [activePortalTab, setActivePortalTab] = useState<
    'license' | 'keys' | 'archive' | 'demo' | 'shields' | 'devices' | 'purge'
  >('license');

  // وضع الشاشة الكاملة وسرعة الاتصال اللحظية بالسيرفر
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [serverPingMs, setServerPingMs] = useState<number | null>(null);

  // حالات مولد مفاتيح التراخيص المشفرة
  const [keyGenType, setKeyGenType] = useState<'trial_extension' | 'permanent' | 'emergency'>('trial_extension');
  const [keyGenDays, setKeyGenDays] = useState<number>(30);
  const [keyGenLabel, setKeyGenLabel] = useState<string>('تجديد ترخيص عيادات الجمعية الشرعية بأوسيم');
  const [keyGenDomain, setKeyGenDomain] = useState<string>('');
  const [recentlyGeneratedKey, setRecentlyGeneratedKey] = useState<GeneratedLicenseKey | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // حالات تفعيل الترخيص عبر الكود (Redeem License Key Modal)
  const [redeemModalOpen, setRedeemModalOpen] = useState(false);
  const [redeemKeyInput, setRedeemKeyInput] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const [redeemSuccessMsg, setRedeemSuccessMsg] = useState('');

  // استماع لحدث الشاشة الكاملة
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullScreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullScreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setIsFullScreen(false);
        }
      }
    } catch {}
  };

  // قياس سرعة الاتصال بالسيرفر السحابي كل 18 ثانية
  useEffect(() => {
    let isMounted = true;
    const checkPing = async () => {
      const t0 = performance.now();
      try {
        if (isSupabaseConfigured) {
          await supabase.from('clinics').select('id').limit(1);
        } else {
          await fetch('/manifest.webmanifest', { cache: 'no-store' });
        }
        const diff = Math.round(performance.now() - t0);
        if (isMounted) setServerPingMs(diff);
      } catch {
        if (isMounted) setServerPingMs(null);
      }
    };
    checkPing();
    const interval = window.setInterval(checkPing, 18000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const [keepRecentDaysInput, setKeepRecentDaysInput] = useState<string>(
    String(trialLicenseConfig.keepRecentDaysDefault || 10)
  );
  const [archiveCycleInput, setArchiveCycleInput] = useState<string>(
    String(trialLicenseConfig.archiveCycleMonths || 4)
  );
  const [isPruningArchive, setIsPruningArchive] = useState(false);
  const [confirmArchivePruneOpen, setConfirmArchivePruneOpen] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any>(null);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // حالات لوحة تحكم المطور السرية
  const [draftConfig, setDraftConfig] = useState<SystemTrialLicenseConfig>(trialLicenseConfig);
  const [customDaysInput, setCustomDaysInput] = useState<string>(
    String(trialLicenseConfig.trialDays || 7)
  );
  const [manualBanTarget, setManualBanTarget] = useState('');
  const [manualBanReason, setManualBanReason] = useState('');
  const [newDomainInput, setNewDomainInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmPurgeOpen, setConfirmPurgeOpen] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  // مزامنة المسودة عند فتح البوابة أو تغير الإعدادات السحابية
  useEffect(() => {
    if (isDeveloperPortalOpen) {
      setDraftConfig(trialLicenseConfig);
      setCustomDaysInput(String(trialLicenseConfig.trialDays || 7));
      setKeepRecentDaysInput(String(trialLicenseConfig.keepRecentDaysDefault || 10));
      setArchiveCycleInput(String(trialLicenseConfig.archiveCycleMonths || 4));
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

  // توليد مفتاح ترخيص جديد مشفر
  const handleGenerateKeySubmit = async () => {
    try {
      const newKey = generateSignedLicenseKey(
        keyGenType,
        keyGenDays,
        keyGenLabel,
        keyGenDomain
      );
      const existingKeys = Array.isArray(draftConfig.generatedLicenseKeys)
        ? draftConfig.generatedLicenseKeys
        : [];
      const updatedKeys = [newKey, ...existingKeys].slice(0, 80);
      const nextConfig: SystemTrialLicenseConfig = {
        ...draftConfig,
        generatedLicenseKeys: updatedKeys,
      };
      setDraftConfig(nextConfig);
      await handleSaveConfig(nextConfig);
      setRecentlyGeneratedKey(newKey);
      addToast({
        type: 'success',
        title: 'تم توليد كود الترخيص المشفر بنجاح 🔑',
        message: `الكود: ${newKey.keyCode} جاهز للإرسال للعميل.`,
      });
    } catch {
      addToast({
        type: 'error',
        title: 'فشل التوليد',
        message: 'حدث خطأ أثناء توليد مفتاح الترخيص المشفر.',
      });
    }
  };

  const handleCopyKey = (code: string, id: string) => {
    try {
      navigator.clipboard.writeText(code);
      setCopiedKeyId(id);
      setTimeout(() => setCopiedKeyId(null), 3000);
      addToast({
        type: 'info',
        title: 'تم نسخ الكود للحافظة',
        message: code,
      });
    } catch {}
  };

  // معالجة تفعيل كود الترخيص (من شاشة القفل أو البانر أو البوابة)
  const handleRedeemKeySubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setRedeemError('');
    setRedeemSuccessMsg('');

    const code = redeemKeyInput.trim().toUpperCase();
    if (!code) {
      setRedeemError('يرجى كتابة أو لصق كود الترخيص');
      return;
    }

    setRedeemLoading(true);
    try {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
      const usedKeys = Array.isArray(trialLicenseConfig.usedLicenseKeyCodes)
        ? trialLicenseConfig.usedLicenseKeyCodes
        : [];
      const verification = verifySignedLicenseKey(code, usedKeys, currentHost);

      if (!verification.valid || !verification.type) {
        setRedeemError(verification.error || 'كود الترخيص غير صالح أو غير معتمد');
        setRedeemLoading(false);
        return;
      }

      // حساب التمديد أو التفعيل الدائم
      let nextMode: 'trial' | 'permanent' | 'locked' = trialLicenseConfig.mode;
      let nextExpiresAt = trialLicenseConfig.expiresAt;
      const durationDays = verification.durationDays || 30;

      if (verification.type === 'permanent') {
        nextMode = 'permanent';
        const farFuture = new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000);
        nextExpiresAt = farFuture.toISOString();
      } else {
        nextMode = 'trial';
        const currentExpMs = new Date(trialLicenseConfig.expiresAt).getTime();
        const baseMs = Math.max(Date.now(), Number.isFinite(currentExpMs) ? currentExpMs : Date.now());
        const extendedDate = new Date(baseMs + durationDays * 24 * 60 * 60 * 1000);
        nextExpiresAt = extendedDate.toISOString();
      }

      // حرق الكود سحابياً لمنع استخدامه مرة أخرى
      const updatedUsedCodes = [code, ...usedKeys];
      const updatedKeysList = (trialLicenseConfig.generatedLicenseKeys || []).map((k) =>
        k.keyCode === code
          ? {
              ...k,
              isRedeemed: true,
              redeemedAt: new Date().toISOString(),
              redeemedBy: currentUser ? `${currentUser.displayName} (${currentUser.username})` : 'مستخدم عبر شاشة التفعيل',
            }
          : k
      );

      const nextConfig: SystemTrialLicenseConfig = {
        ...trialLicenseConfig,
        mode: nextMode,
        expiresAt: nextExpiresAt,
        usedLicenseKeyCodes: updatedUsedCodes,
        generatedLicenseKeys: updatedKeysList,
        updatedAt: new Date().toISOString(),
      };

      const ok = await updateTrialLicenseConfig(nextConfig);
      if (ok) {
        setRedeemSuccessMsg(
          verification.type === 'permanent'
            ? 'مبروك! تم اعتماد وتفعيل الترخيص الدائم غير المحدود مدى الحياة بنجاح 👑'
            : `مبروك! تم تفعيل كود الترخيص وتمديد عمل المنظومة بنجاح لمدة ${durationDays} يوم إضافية ✨`
        );
        addToast({
          type: 'success',
          title: 'تم تفعيل كود الترخيص بنجاح',
          message: verification.label || 'تم تحديث ترخيص المنظومة بنجاح.',
        });
        setTimeout(() => {
          setRedeemModalOpen(false);
          setRedeemKeyInput('');
          setRedeemSuccessMsg('');
        }, 2200);
      } else {
        setRedeemError('تعذر حفظ التفعيل السحابي، يرجى التحقق من اتصال الإنترنت');
      }
    } catch (err: any) {
      setRedeemError('حدث خطأ غير متوقع أثناء معالجة كود الترخيص');
    } finally {
      setRedeemLoading(false);
    }
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

  // تصدير وتحميل ملف الأرشيف الكامل على جهاز المطور مع اسم يحمل التواريخ بدقة
  const handleDownloadFullBackup = () => {
    try {
      const validDates = bookings
        .map((b) => b.date)
        .filter((d): d is string => typeof d === 'string' && d.length >= 8)
        .sort();
      const minDate = validDates[0] || new Date().toISOString().slice(0, 10);
      const maxDate = validDates[validDates.length - 1] || new Date().toISOString().slice(0, 10);
      const dateStr = new Date().toISOString().slice(0, 10);

      const backupPayload = {
        backupMetadata: {
          systemTitle: 'منظومة عيادات الجمعية الشرعية التخصصية بأوسيم',
          developer: 'Eng. Amr (Amrr)',
          generatedAt: new Date().toISOString(),
          firstBookingDate: minDate,
          lastBookingDate: maxDate,
          totalBookingsCount: bookings.length,
          totalClinicsCount: clinics.length,
          totalDoctorsCount: doctors.length,
          totalShiftHandoversCount: shiftHandovers.length,
          totalExpensesCount: financeLedger?.expenses?.length || 0,
          version: 'v31_archive_format',
          certificateId: DMCA_OWNERSHIP_CERTIFICATE_ID,
        },
        clinics,
        doctors,
        dailySchedule,
        bookings,
        shiftHandovers,
        financeLedger,
        insuranceContracts,
        staffAccounts: staffAccounts.map((s) => ({ ...s, passwordHash: undefined })),
        supportInfoText,
        officialWorkingHours,
        rolePermissions,
        trialLicenseConfig: draftConfig,
      };

      const jsonStr = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `Sharaya_Archive_From_${minDate}_To_${maxDate}_Date_${dateStr}.json`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addToast({
        type: 'success',
        title: 'تم تنزيل ملف الأرشيف بنجاح 📥',
        message: `تم تحميل ملف الأرشيف الكامل (${bookings.length} حجز) باسم (${filename}) على جهازك بأمان.`,
      });
    } catch {
      addToast({
        type: 'error',
        title: 'فشل تصدير الأرشيف',
        message: 'حدث خطأ أثناء تجميع ملف النسخة الاحتياطية. يرجى المحاولة مرة أخرى.',
      });
    }
  };

  // تصدير وتحميل أرشيف الحجوزات القديمة فقط (المستهدفة للتفريغ)
  const handleDownloadOldArchiveOnly = () => {
    try {
      const keepDays = Math.max(1, Math.min(365, Number(keepRecentDaysInput) || 10));
      const cutoffTime = Date.now() - keepDays * 24 * 60 * 60 * 1000;
      const cutoff = new Date(cutoffTime).toISOString().slice(0, 10);
      const oldBookings = bookings.filter((b) => b.date < cutoff);

      if (oldBookings.length === 0) {
        addToast({
          type: 'info',
          title: 'لا توجد حجوزات قديمة',
          message: `جميع الحجوزات الحالية (${bookings.length}) تقع ضمن فترة الحماية (آخر ${keepDays} يوماً).`,
        });
        return;
      }

      const validDates = oldBookings
        .map((b) => b.date)
        .filter((d): d is string => typeof d === 'string' && d.length >= 8)
        .sort();
      const minDate = validDates[0] || 'Start';
      const maxDate = cutoff;
      const dateStr = new Date().toISOString().slice(0, 10);

      const oldArchivePayload = {
        archiveMetadata: {
          systemTitle: 'أرشيف الحجوزات السابقة — عيادات الجمعية الشرعية بأوسيم',
          developer: 'Eng. Amr (Amrr)',
          generatedAt: new Date().toISOString(),
          cutoffDate: cutoff,
          firstBookingDate: minDate,
          lastBookingDate: maxDate,
          totalBookingsCount: oldBookings.length,
          certificateId: DMCA_OWNERSHIP_CERTIFICATE_ID,
        },
        bookings: oldBookings,
      };

      const jsonStr = JSON.stringify(oldArchivePayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `Sharaya_Old_Archive_Before_${cutoff}_From_${minDate}_To_${maxDate}_Date_${dateStr}.json`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addToast({
        type: 'success',
        title: 'تم تنزيل أرشيف الحجوزات القديمة 📥',
        message: `تم تنزيل (${oldBookings.length} حجز قديم) باسم (${filename}) بنجاح. يمكنك الآن تفريغها من Supabase وأنت مطمئن.`,
      });
    } catch {
      addToast({
        type: 'error',
        title: 'فشل تصدير الأرشيف',
        message: 'حدث خطأ أثناء تجميع ملف الأرشيف.',
      });
    }
  };

  // تفريغ الحجوزات السابقة لتاريخ محدد مع الإبقاء على آخر X يوماً
  const handlePruneBeforeDays = async () => {
    const keepDays = Math.max(1, Math.min(365, Number(keepRecentDaysInput) || 10));
    const cutoffTime = Date.now() - keepDays * 24 * 60 * 60 * 1000;
    const cutoffDateStr = new Date(cutoffTime).toISOString().slice(0, 10);

    setIsPruningArchive(true);
    try {
      const toRemoveCount = bookings.filter((b) => b.date < cutoffDateStr).length;
      await selectivePurgeRecords({
        purgePastBookings: true,
        purgeAllBookings: false,
        beforeDate: cutoffDateStr,
        purgeShiftHandovers: false,
        purgeFinanceExpenses: false,
        purgeConsultationStamps: false,
        purgeWhatsAppAndPrintLogs: false,
        purgeSystemErrorLogs: false,
      });

      const cycleMonths = Number(archiveCycleInput) || draftConfig.archiveCycleMonths || 4;
      const nextArchive = new Date();
      nextArchive.setMonth(nextArchive.getMonth() + cycleMonths);

      const nextConfig: SystemTrialLicenseConfig = {
        ...draftConfig,
        archiveCycleMonths: cycleMonths,
        lastArchiveDate: new Date().toISOString(),
        nextArchiveDate: nextArchive.toISOString(),
        keepRecentDaysDefault: keepDays,
      };
      setDraftConfig(nextConfig);
      await handleSaveConfig(nextConfig);

      setConfirmArchivePruneOpen(false);
      addToast({
        type: 'success',
        title: 'تم تفريغ الأرشيف القديم بنجاح 🧹',
        message: `تم تفريغ ${toRemoveCount} حجز قديم ما قبل تاريخ (${cutoffDateStr}) من Supabase، والإبقاء الكامل على آخر ${keepDays} يوماً والعيادات والأطباء.`,
      });
    } finally {
      setIsPruningArchive(false);
    }
  };

  // معالجة اختيار ملف للاسترجاع
  const handleFileRestoreSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed && (Array.isArray(parsed.bookings) || Array.isArray(parsed.clinics))) {
          setPendingRestoreData(parsed);
          setRestoreModalOpen(true);
        } else {
          addToast({
            type: 'error',
            title: 'ملف غير صالح',
            message: 'الملف المختار ليس ملف نسخة احتياطية صالح لنظام العيادات.',
          });
        }
      } catch {
        addToast({
          type: 'error',
          title: 'خطأ في قراءة الملف',
          message: 'تعذر قراءة ملف JSON المختار. تأكد من صحة الملف.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // تأكيد استرجاع البيانات من الملف
  const handleConfirmRestore = async () => {
    if (!pendingRestoreData) return;
    setIsRestoring(true);
    try {
      if (Array.isArray(pendingRestoreData.clinics) && pendingRestoreData.clinics.length > 0) {
        saveClinics(pendingRestoreData.clinics);
      }
      if (Array.isArray(pendingRestoreData.doctors) && pendingRestoreData.doctors.length > 0) {
        saveDoctors(pendingRestoreData.doctors);
      }
      if (Array.isArray(pendingRestoreData.bookings) && pendingRestoreData.bookings.length > 0) {
        saveBookings(pendingRestoreData.bookings);
      }
      if (Array.isArray(pendingRestoreData.shiftHandovers)) {
        saveShiftHandovers(pendingRestoreData.shiftHandovers);
        if (isSupabaseConfigured) {
          await saveShiftHandoversToDb(pendingRestoreData.shiftHandovers).catch(() => {});
        }
      }
      if (pendingRestoreData.financeLedger && typeof pendingRestoreData.financeLedger === 'object') {
        saveFinanceLedger(pendingRestoreData.financeLedger);
        if (isSupabaseConfigured) {
          await saveFinanceLedgerToDb(pendingRestoreData.financeLedger).catch(() => {});
        }
      }
      if (Array.isArray(pendingRestoreData.insuranceContracts)) {
        saveInsuranceContracts(pendingRestoreData.insuranceContracts);
        if (isSupabaseConfigured) {
          await saveInsuranceContractsToDb(pendingRestoreData.insuranceContracts).catch(() => {});
        }
      }
      if (pendingRestoreData.trialLicenseConfig && typeof pendingRestoreData.trialLicenseConfig === 'object') {
        saveTrialLicenseConfig(pendingRestoreData.trialLicenseConfig);
        setDraftConfig(pendingRestoreData.trialLicenseConfig);
        if (isSupabaseConfigured) {
          await saveTrialLicenseConfigToDb(pendingRestoreData.trialLicenseConfig).catch(() => {});
        }
      }

      setRestoreModalOpen(false);
      setPendingRestoreData(null);
      addToast({
        type: 'success',
        title: 'تم استرجاع النسخة الاحتياطية بنجاح 🔄',
        message: 'تم استرجاع السجلات ودمجها مع قاعدة البيانات بنجاح.',
      });
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch {
      addToast({
        type: 'error',
        title: 'فشل الاسترجاع',
        message: 'حدث خطأ أثناء تطبيق بيانات النسخة الاحتياطية.',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const nextArchiveMs = draftConfig.nextArchiveDate
    ? new Date(draftConfig.nextArchiveDate).getTime()
    : new Date(draftConfig.startedAt || Date.now()).getTime() + 4 * 30 * 24 * 60 * 60 * 1000;
  const isArchiveDue = Number.isFinite(nextArchiveMs) ? Date.now() >= nextArchiveMs : false;
  const daysUntilArchive = Math.ceil((nextArchiveMs - Date.now()) / (24 * 60 * 60 * 1000));
  const keepDaysNum = Math.max(1, Math.min(365, Number(keepRecentDaysInput) || 10));
  const cutoffTimeMs = Date.now() - keepDaysNum * 24 * 60 * 60 * 1000;
  const cutoffDateStr = new Date(cutoffTimeMs).toISOString().slice(0, 10);
  const eligibleForArchiveCount = bookings.filter((b) => b.date < cutoffDateStr).length;
  const preservedRecentBookingsCount = bookings.filter((b) => b.date >= cutoffDateStr).length;

  // تفصيل وحسابات استهلاك قاعدة بيانات Supabase الحية بالمللي بايت
  const estimatedBookingsKb = Math.round(bookings.length * 1.8);
  const estimatedHandoversKb = Math.round((shiftHandovers?.length || 0) * 1.4);
  const estimatedExpensesKb = Math.round((financeLedger?.expenses?.length || 0) * 1.2);
  const estimatedLogsKb = Math.round((draftConfig.intrusionLogs?.length || 0) * 2.2);
  const estimatedConfigKb = 55;
  const totalEstimatedDbKb =
    estimatedBookingsKb + estimatedHandoversKb + estimatedExpensesKb + estimatedLogsKb + estimatedConfigKb;
  const totalEstimatedDbMb = (totalEstimatedDbKb / 1024).toFixed(2);
  const maxQuotaMb = 500;
  const quotaPercentage = Math.min(
    100,
    Math.max(0.1, Number(((Number(totalEstimatedDbMb) / maxQuotaMb) * 100).toFixed(2)))
  );

  const recentBookingsIn7Days = bookings.filter((b) => {
    const t = new Date(b.createdAt || b.date).getTime();
    return !isNaN(t) && Date.now() - t < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const dailyRate = Math.max(1, Math.round(recentBookingsIn7Days / 7) || 12);
  const kbRemaining = maxQuotaMb * 1024 - totalEstimatedDbKb;
  const estimatedDaysUntilFull = Math.max(1, Math.round(kbRemaining / (dailyRate * 1.8)));
  const estimatedYearsUntilFull = (estimatedDaysUntilFull / 365).toFixed(1);
  const estimatedDbSizeKb = totalEstimatedDbKb;

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

      {/* 0-أ-1. شاشة قفل النسخ المقلدة عند تشغيل الكود على دومين غير مصرح به (DMCA Anti-Clone Lock) */}
      <AnimatePresence>
        {isUnauthorizedDomainClone && !matchedBanEntity && !isDeveloperPortalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-gradient-to-br from-[#2a040a] via-[#13061f] to-slate-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 text-center no-print select-none"
          >
            <div className="max-w-lg w-full bg-white/5 backdrop-blur-xl border-2 border-rose-500/60 rounded-3xl p-6 sm:p-9 shadow-2xl space-y-5">
              <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border-2 border-rose-400/60 text-rose-300 flex items-center justify-center mx-auto shadow-lg">
                <FileCheck2 className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-300 text-xs font-extrabold">
                  حماية حقوق الملكية الفكرية الرقمية (DMCA Anti-Clone)
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  ⛔ هذا النطاق ({currentHost}) غير مرخص لتشغيل المنظومة
                </h2>
              </div>

              <p className="text-sm text-slate-200 leading-relaxed font-medium bg-white/5 border border-white/10 rounded-2xl p-4">
                تم رصد محاولة تشغيل نسخة منسوخة على نطاق غير معتمد. هذه المنظومة محمية ببصمة الملكية
                الفكرية المشفرة (<code className="text-amber-300">{DMCA_OWNERSHIP_CERTIFICATE_ID.slice(0, 28)}...</code>) وتم إرسال عنوان النطاق والـ IP إلى رادار المطور الأصلي.
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
                  بوابة المطور الأصلي 🔑
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

              <button
                type="button"
                onClick={() => {
                  setRedeemKeyInput('');
                  setRedeemError('');
                  setRedeemSuccessMsg('');
                  setRedeemModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-200 border border-emerald-400/50 text-[11px] font-black transition-all shrink-0 shadow-xs"
              >
                <Key className="w-3.5 h-3.5 text-emerald-300" />
                <span>تفعيل كود ترخيص 🔑</span>
              </button>
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

              <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setRedeemKeyInput('');
                    setRedeemError('');
                    setRedeemSuccessMsg('');
                    setRedeemModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg transition-all scale-105"
                >
                  <Key className="w-4 h-4 text-emerald-200" />
                  <span>إدخال كود التفعيل والترخيص 🔑</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUnlockUser('');
                    setUnlockPass('');
                    setUnlockError('');
                    setUnlockModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold transition-all"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>بوابة المطور 🔑</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2-ب. نافذة إدخال وتفعيل كود الترخيص المشفر للعميل أو الإدارة */}
      <AnimatePresence>
        {redeemModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 no-print"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 text-right"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                    <Key className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-base">
                      تفعيل كود وترخيص المنظومة 🔑
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      أدخل كود الترخيص الرقمي المعتمد من مسؤول تطوير النظام
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRedeemModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {redeemError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{redeemError}</span>
                </div>
              )}

              {redeemSuccessMsg ? (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg">
                    <CheckCheck className="w-7 h-7" />
                  </div>
                  <h4 className="font-black text-emerald-800 dark:text-emerald-200 text-sm">
                    {redeemSuccessMsg}
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    جاري تحديث المنظومة والمزامنة السحابية تلقائياً...
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRedeemKeySubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                      كود الترخيص الرقمي (License Key):
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={redeemKeyInput}
                        onChange={(e) => setRedeemKeyInput(e.target.value.toUpperCase())}
                        placeholder="SHR-EXT-030D-XXXX-YYYY"
                        dir="ltr"
                        autoFocus
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase text-center"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      * الكود مكون من 5 مقاطع يبدأ بـ SHR ويتم التحقق من ختمه الرقمي سحابياً.
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRedeemModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={redeemLoading || !redeemKeyInput.trim()}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {redeemLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>جاري التحقق والتفعيل...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 text-amber-300" />
                          <span>تفعيل الترخيص فوراً</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
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

                <div className="flex items-center gap-2">
                  <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/25 border border-white/10 text-[11px] font-bold text-slate-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{serverPingMs ? `${serverPingMs}ms` : 'متصل'}</span>
                  </div>

                  <button
                    type="button"
                    onClick={toggleFullScreen}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
                    title={isFullScreen ? 'الخروج من الشاشة الكاملة (Esc)' : 'وضع الشاشة الكاملة (HUD)'}
                  >
                    {isFullScreen ? (
                      <Minimize2 className="w-4 h-4 text-amber-300" />
                    ) : (
                      <Maximize2 className="w-4 h-4 text-slate-200" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDeveloperPortalOpen(false)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
                    title="إغلاق البوابة السرية"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* شريط التبويبات فائق السرعة والمصمم لسرعة التبديل والتنقل الفوري 0ms */}
              <div className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2.5 flex items-center gap-1.5 sm:gap-2 overflow-x-auto shrink-0 scrollbar-none">
                {[
                  {
                    id: 'license',
                    label: '⏱️ الترخيص والمدة',
                    badge:
                      draftConfig.mode === 'permanent'
                        ? 'دائم'
                        : isSystemLocked
                        ? 'مغلق'
                        : `${liveRemaining.days}ي`,
                    badgeColor:
                      draftConfig.mode === 'permanent'
                        ? 'bg-emerald-600 text-white'
                        : isSystemLocked
                        ? 'bg-rose-600 text-white'
                        : 'bg-amber-600 text-white',
                  },
                  {
                    id: 'keys',
                    label: '🔑 مولد التراخيص',
                    badge:
                      (draftConfig.generatedLicenseKeys || []).length > 0
                        ? `${(draftConfig.generatedLicenseKeys || []).length}`
                        : undefined,
                    badgeColor: 'bg-violet-600 text-white',
                  },
                  {
                    id: 'archive',
                    label: '💾 الأرشفة وتفريغ Supabase',
                    badge: isArchiveDue ? '⚠️ موعد الأرشيف' : `${daysUntilArchive} يوم`,
                    badgeColor: isArchiveDue
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-blue-600 text-white',
                  },
                  {
                    id: 'demo',
                    label: '🧪 البيانات المعزولة',
                    badge: isolatedDemoRecordsCount > 0 ? `${isolatedDemoRecordsCount}` : undefined,
                    badgeColor: 'bg-emerald-600 text-white',
                  },
                  {
                    id: 'shields',
                    label: '🛡️ الحماية وDMCA',
                    badge: draftConfig.enforceAuthorizedDomainLock ? 'قفل الدومين' : undefined,
                    badgeColor: 'bg-indigo-600 text-white',
                  },
                  {
                    id: 'devices',
                    label: '📡 المتصلين والرادار',
                    badge:
                      liveConnectedDevices.length > 0
                        ? `${liveConnectedDevices.length} متصل`
                        : undefined,
                    badgeColor: 'bg-emerald-600 text-white',
                  },
                  {
                    id: 'purge',
                    label: '🧹 تصفير رسمي',
                    badge: undefined,
                    badgeColor: '',
                  },
                ].map((tab) => {
                  const isActive = activePortalTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActivePortalTab(tab.id as any)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all shrink-0 select-none ${
                        isActive
                          ? 'bg-[#062142] text-amber-300 shadow-md ring-2 ring-amber-400/50 scale-[1.02]'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.badge && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${tab.badgeColor}`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
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

                {/* كارت مراقبة مساحة قاعدة البيانات اللحظية واستهلاك سوبابيز (Supabase Live Storage Meter) */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 text-white p-4 sm:p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Database className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="text-xs font-black text-white flex items-center gap-2">
                          <span>مساحة تخزين Supabase المستهلكة (Live Database Meter)</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {quotaPercentage}% مستهلك
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          باقة مجانية 500 MB دائمة • متبقي {estimatedYearsUntilFull} سنة بالمعدل الحالي
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActivePortalTab('archive')}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold transition-all border border-white/10"
                      >
                        إدارة الأرشيف والتفريغ 💾
                      </button>
                    </div>
                  </div>

                  {/* شريط الاستهلاك التفاعلي */}
                  <div className="space-y-1.5">
                    <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          quotaPercentage > 85
                            ? 'bg-rose-500 shadow-rose-500/50'
                            : quotaPercentage > 70
                            ? 'bg-amber-500 shadow-amber-500/50'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-emerald-500/50'
                        }`}
                        style={{ width: `${Math.max(1, quotaPercentage)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <span>
                          المستهلك: <strong className="text-white">{totalEstimatedDbMb} MB</strong> ({totalEstimatedDbKb.toLocaleString()} KB)
                        </span>
                        <span className="text-slate-600 dark:text-slate-500">•</span>
                        <span>
                          السعة المجانية: <strong className="text-white">{maxQuotaMb} MB</strong>
                        </span>
                      </div>
                      <div className="text-emerald-400 font-bold">
                        🟢 مساحة فارغة آمنة: {(maxQuotaMb - Number(totalEstimatedDbMb)).toFixed(1)} MB
                      </div>
                    </div>
                  </div>

                  {/* تفاصيل استهلاك الجداول */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
                    <div className="bg-white/5 rounded-xl p-2">
                      <div className="text-slate-400">سجلات الحجوزات:</div>
                      <div className="font-extrabold text-white">
                        {bookings.length} حجز (~{estimatedBookingsKb} KB)
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-2">
                      <div className="text-slate-400">شيفتات الاستقبال:</div>
                      <div className="font-extrabold text-white">
                        {shiftHandovers?.length || 0} شفت (~{estimatedHandoversKb} KB)
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-2">
                      <div className="text-slate-400">سجلات الخزينة:</div>
                      <div className="font-extrabold text-white">
                        {financeLedger?.expenses?.length || 0} مصروف (~{estimatedExpensesKb} KB)
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-2">
                      <div className="text-slate-400">رادار الأمان والمحاولات:</div>
                      <div className="font-extrabold text-white">
                        {draftConfig.intrusionLogs?.length || 0} محاولة (~{estimatedLogsKb} KB)
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1. تبويب أوضاع الترخيص والتحكم في المدة */}
                {activePortalTab === 'license' && (
                  <div className="space-y-6">
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
                              onClick={() => shiftCurrentExpiry(720)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 text-[11px] font-extrabold"
                            >
                              <Plus className="w-3 h-3" />
                              <span>+30 يوم (شهر)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => shiftCurrentExpiry(2160)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 text-[11px] font-extrabold"
                            >
                              <Plus className="w-3 h-3" />
                              <span>+90 يوم (3 شهور)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDraftConfig((prev) => ({
                                  ...prev,
                                  mode: 'permanent',
                                }));
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 text-[11px] font-black"
                            >
                              <Sparkles className="w-3 h-3 text-amber-500" />
                              <span>تحويل لترخيص دائم 👑</span>
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
                  </div>
                )}

                {/* 1-ب. تبويب مولد ومخزن مفاتيح وتراخيص التفعيل المشفرة */}
                {activePortalTab === 'keys' && (
                  <div className="space-y-6">
                    {/* بانر القسم */}
                    <div className="rounded-2xl border-2 border-violet-500/40 bg-gradient-to-br from-[#12082b] via-[#1a0f3c] to-[#0a051d] text-white p-5 sm:p-6 space-y-3 shadow-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-violet-500/20 border border-violet-400/40 text-violet-300 flex items-center justify-center shrink-0 shadow-inner">
                          <Key className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-black text-white">
                              مركز توليد وإدارة مفاتيح التراخيص المشفرة (Cryptographic Key Vault)
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-violet-500/20 text-violet-300 border border-violet-400/40">
                              SHA-256 HMAC Signed Keys
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            توليد أكواد ترخيص مشفرة وموقعة رقمياً بختم مطور النظام. ترسلها للمركز أو العميل لتفعيل المنظومة عن بُعد فور استلام الرسوم دون إعطائهم أي بيانات سرية.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* كارت توليد كود ترخيص جديد */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5 shadow-sm">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Zap className="w-4 h-4 text-violet-500" />
                        <span>1. إعداد وتوليد كود ترخيص جديد</span>
                      </h4>

                      <div className="space-y-4">
                        {/* نوع الترخيص */}
                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-2">
                            نوع الترخيص المستهدف:
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {[
                              {
                                type: 'trial_extension',
                                title: '⏳ تمديد فترة تجريبية',
                                desc: 'إضافة عدد محدد من الأيام للترخيص',
                              },
                              {
                                type: 'permanent',
                                title: '👑 ترخيص دائم مدى الحياة',
                                desc: 'إلغاء جميع القيود الزمنية نهائياً',
                              },
                              {
                                type: 'emergency',
                                title: '⚡ ترخيص طوارئ استثنائي',
                                desc: 'تمديد مؤقت لمدة سريعة لحل مشكلة',
                              },
                            ].map((item) => (
                              <button
                                key={item.type}
                                type="button"
                                onClick={() => setKeyGenType(item.type as any)}
                                className={`p-3 rounded-xl border-2 text-right transition-all flex flex-col gap-1 ${
                                  keyGenType === item.type
                                    ? 'border-violet-500 bg-violet-50/70 dark:bg-violet-950/40 shadow-xs'
                                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                                }`}
                              >
                                <div className="font-extrabold text-xs text-slate-900 dark:text-white">
                                  {item.title}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                  {item.desc}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* المدة إذا كان تمديداً */}
                        {keyGenType !== 'permanent' && (
                          <div className="space-y-2">
                            <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                              مدة الترخيص (بالأيام):
                            </label>
                            <div className="flex flex-wrap items-center gap-2">
                              {[
                                { label: '30 يوم (شهر)', days: 30 },
                                { label: '60 يوم (شهرين)', days: 60 },
                                { label: '90 يوم (3 شهور)', days: 90 },
                                { label: '180 يوم (6 شهور)', days: 180 },
                                { label: '365 يوم (سنة)', days: 365 },
                              ].map((preset) => (
                                <button
                                  key={preset.days}
                                  type="button"
                                  onClick={() => setKeyGenDays(preset.days)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    keyGenDays === preset.days
                                      ? 'bg-violet-600 text-white shadow-xs'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                                  }`}
                                >
                                  {preset.label}
                                </button>
                              ))}

                              <div className="flex items-center gap-1.5 ms-auto">
                                <span className="text-xs text-slate-500">أيام مخصصة:</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={3650}
                                  value={keyGenDays}
                                  onChange={(e) => setKeyGenDays(Math.max(1, Number(e.target.value) || 1))}
                                  className="w-20 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold text-center"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* اسم العميل / سبب الصدور */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                              اسم المستفيد / جهة الترخيص:
                            </label>
                            <input
                              type="text"
                              value={keyGenLabel}
                              onChange={(e) => setKeyGenLabel(e.target.value)}
                              placeholder="مثال: عيادات الجمعية الشرعية بأوسيم — اشتراك الربع الأول"
                              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                              حصر الكود على دومين محدد (اختياري):
                            </label>
                            <input
                              type="text"
                              value={keyGenDomain}
                              onChange={(e) => setKeyGenDomain(e.target.value.toLowerCase())}
                              placeholder="اتركه فارغاً لأي دومين، أو اكتب (sharaya-clinics.com)"
                              dir="ltr"
                              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-medium"
                            />
                          </div>
                        </div>

                        {/* زر التوليد الفوري */}
                        <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            * المفتاح مشفر برمجياً وموقع برقم أمان سري، ولا يمكن استخدامه سوى مرة واحدة.
                          </p>

                          <button
                            type="button"
                            onClick={handleGenerateKeySubmit}
                            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-black shadow-md transition-all flex items-center gap-2"
                          >
                            <Zap className="w-4 h-4 text-amber-300" />
                            <span>توليد كود التفعيل المشفر الآن ⚡</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* كارت الكود المولد حديثاً */}
                    {recentlyGeneratedKey && (
                      <div className="rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 p-5 sm:p-6 space-y-4 shadow-xl">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-sm">
                            <CheckCheck className="w-5 h-5" />
                            <span>تم توليد كود ترخيص جديد بنجاح! جاهز للإرسال للعميل:</span>
                          </div>
                          <span className="text-xs text-slate-400">
                            النوع: {recentlyGeneratedKey.type === 'permanent' ? 'دائم 👑' : `${recentlyGeneratedKey.durationDays} يوم`}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-black/40 border border-emerald-500/30 flex-wrap">
                          <div className="font-mono font-black text-emerald-300 text-base sm:text-lg tracking-wider select-all" dir="ltr">
                            {recentlyGeneratedKey.keyCode}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopyKey(recentlyGeneratedKey.keyCode, recentlyGeneratedKey.id)}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2 shadow-sm transition-all"
                          >
                            {copiedKeyId === recentlyGeneratedKey.id ? (
                              <>
                                <CheckCheck className="w-4 h-4" />
                                <span>تم النسخ!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                <span>نسخ الكود</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 space-y-1">
                          <div className="font-bold text-amber-300 text-[11px]">رسالة مقترحة لإرسالها للعميل على الواتساب:</div>
                          <p className="text-[11px] text-slate-200 leading-relaxed font-mono">
                            "مرحباً بحضرتك، مرفق كود تفعيل منظومة العيادات التخصصية المعتمد: [{recentlyGeneratedKey.keyCode}]، مدة الترخيص: ({recentlyGeneratedKey.durationDays > 0 ? `${recentlyGeneratedKey.durationDays} يوم` : 'دائم'}). يرجى الضغط على زر (تفعيل كود ترخيص 🔑) في الشاشة ولصق الكود."
                          </p>
                        </div>
                      </div>
                    )}

                    {/* مخزن وتاريخ الأكواد السابقة (Keys Vault) */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-violet-500" />
                          <span>2. مخزن وسجل مفاتيح التراخيص المولدة ({((draftConfig.generatedLicenseKeys || []).length)})</span>
                        </h4>
                        <span className="text-[11px] text-slate-500">
                          محفوظة سحابياً ومشفرة
                        </span>
                      </div>

                      {(!draftConfig.generatedLicenseKeys || draftConfig.generatedLicenseKeys.length === 0) ? (
                        <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                          لم يتم توليد أي مفاتيح ترخيص حتى الآن. استخدم النموذج أعلاه لتوليد أول كود.
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-72 overflow-y-auto">
                          {draftConfig.generatedLicenseKeys.map((k) => (
                            <div
                              key={k.id}
                              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <code className="font-mono font-black text-slate-900 dark:text-white text-xs select-all" dir="ltr">
                                    {k.keyCode}
                                  </code>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                      k.isRedeemed
                                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                    }`}
                                  >
                                    {k.isRedeemed ? 'تم التفعيل والاستخدام ✅' : 'جاهز للاستخدام 🟢'}
                                  </span>
                                  {k.type === 'permanent' && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                      دائم 👑
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {k.label} • {new Date(k.createdAt).toLocaleDateString('ar-EG')}
                                  {k.redeemedAt && ` • تم التفعيل في: ${new Date(k.redeemedAt).toLocaleDateString('ar-EG')}`}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleCopyKey(k.keyCode, k.id)}
                                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 self-start sm:self-auto"
                              >
                                {copiedKeyId === k.id ? (
                                  <>
                                    <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>تم النسخ</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                                    <span>نسخ الكود</span>
                                  </>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. تبويب الأرشفة الذكية وتفريغ مساحة Supabase وحفظ النسخ الاحتياطية */}
                {activePortalTab === 'archive' && (
                  <div className="space-y-6">
                    {/* بانر القسم الرئيسي */}
                    <div className="rounded-2xl border-2 border-[#062142] dark:border-amber-400/40 bg-gradient-to-br from-[#062142] via-[#0b315e] to-[#04152b] text-white p-5 sm:p-6 space-y-3 shadow-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0 shadow-inner">
                          <Archive className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-black text-white">
                              مركز إدارة الأرشفة الدورية وتفريغ مساحة Supabase الذكي
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                              Rolling Retention & Safe Archiving
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            تنظيم دوري للنسخ الاحتياطية وتنزيلها على جهازك بتسمية وتواريخ دقيقة، مع تفريغ الحجوزات القديمة دورياً لإبقاء قاعدة بيانات Supabase خفيفة وسريعة ومجانية 100% مدى الحياة، مع الحفاظ التام على آخر أيام العمل والعيادات والأطباء.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 1. إعدادات دورة الأرشفة وتحديد فترة الإبقاء */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* كارت دورة الأرشفة بالشهور */}
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <label className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[#062142] dark:text-amber-400" />
                            <span>1. تحديد دورة الأرشفة (كل كم شهر؟):</span>
                          </label>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                              isArchiveDue
                                ? 'bg-rose-500 text-white animate-pulse'
                                : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                            }`}
                          >
                            {isArchiveDue ? '⚠️ حان موعد الأرشفة والتفريغ' : `متبقي ${daysUntilArchive} يوم`}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={24}
                            value={archiveCycleInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              setArchiveCycleInput(val);
                              const num = Number(val);
                              if (num > 0) {
                                const nextDate = new Date();
                                nextDate.setMonth(nextDate.getMonth() + num);
                                setDraftConfig((prev) => ({
                                  ...prev,
                                  archiveCycleMonths: num,
                                  nextArchiveDate: nextDate.toISOString(),
                                }));
                              }
                            }}
                            className="w-24 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-sm text-center"
                          />
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            شهر (دورة النسخ الدوري)
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {[
                            { label: 'كل شهر', months: 1 },
                            { label: 'كل شهرين', months: 2 },
                            { label: 'كل 3 شهور', months: 3 },
                            { label: 'كل 4 شهور (الموصى به)', months: 4 },
                            { label: 'كل 6 شهور', months: 6 },
                          ].map((item) => (
                            <button
                              key={item.months}
                              type="button"
                              onClick={() => {
                                setArchiveCycleInput(String(item.months));
                                const nextDate = new Date();
                                nextDate.setMonth(nextDate.getMonth() + item.months);
                                setDraftConfig((prev) => ({
                                  ...prev,
                                  archiveCycleMonths: item.months,
                                  nextArchiveDate: nextDate.toISOString(),
                                }));
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                Number(archiveCycleInput) === item.months
                                  ? 'bg-[#062142] text-amber-300 ring-2 ring-amber-400/50'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-bold">موعد الأرشفة القادم:</span>
                            <span className="font-extrabold text-slate-900 dark:text-white">
                              {new Date(nextArchiveMs).toLocaleDateString('ar-EG', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-bold">آخر أرشفة مسجلة:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {draftConfig.lastArchiveDate
                                ? new Date(draftConfig.lastArchiveDate).toLocaleDateString('ar-EG')
                                : 'لم تُجرَ أرشفة بعد'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* كارت فترة الحماية والإبقاء (Retention Window) */}
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <label className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>2. فترة الإبقاء والحماية (كم يوماً أخيراً يظل محفوظاً؟):</span>
                          </label>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                            محمي 100%
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={keepRecentDaysInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              setKeepRecentDaysInput(val);
                              const num = Number(val);
                              if (num > 0) {
                                setDraftConfig((prev) => ({
                                  ...prev,
                                  keepRecentDaysDefault: num,
                                }));
                              }
                            }}
                            className="w-24 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-sm text-center"
                          />
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            يوماً (لا يتم مسحها أبداً)
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {[
                            { label: 'آخر 7 أيام (أسبوع)', days: 7 },
                            { label: 'آخر 10 أيام (المثالي)', days: 10 },
                            { label: 'آخر 14 يوم (أسبوعين)', days: 14 },
                            { label: 'آخر 30 يوم (شهر)', days: 30 },
                          ].map((item) => (
                            <button
                              key={item.days}
                              type="button"
                              onClick={() => {
                                setKeepRecentDaysInput(String(item.days));
                                setDraftConfig((prev) => ({
                                  ...prev,
                                  keepRecentDaysDefault: item.days,
                                }));
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                Number(keepRecentDaysInput) === item.days
                                  ? 'bg-emerald-700 text-white ring-2 ring-emerald-400/50'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>

                        <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-emerald-800 dark:text-emerald-300 font-bold">
                              تاريخ نقطة الفصل (Cutoff):
                            </span>
                            <span className="font-extrabold text-slate-900 dark:text-white font-mono">
                              {cutoffDateStr}
                            </span>
                          </div>
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                            الحجوزات من ({cutoffDateStr}) حتى اللحظة ({preservedRecentBookingsCount} حجز) محمية ومستمرة كلياً، وما قبل ذلك ({eligibleForArchiveCount} حجز) يدخل في الأرشيف والتفريغ.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 2. كروت إحصائيات السجلات والمساحة في Supabase */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                        <span className="text-[11px] font-bold text-slate-500">إجمالي الحجوزات السحابية:</span>
                        <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                          {bookings.length} <span className="text-xs font-normal text-slate-500">حجز</span>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-1">
                        <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                          المرشحة للأرشفة والتفريغ:
                        </span>
                        <div className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-400">
                          {eligibleForArchiveCount} <span className="text-xs font-normal">حجز قديم</span>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-1">
                        <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                          المحمية الجارية (آخر {keepDaysNum} يوماً):
                        </span>
                        <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400">
                          {preservedRecentBookingsCount} <span className="text-xs font-normal">حجز نشط</span>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-1">
                        <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300">العيادات والأطباء:</span>
                        <div className="text-sm sm:text-base font-black text-blue-900 dark:text-blue-200 pt-1">
                          {clinics.length} عيادة • {doctors.length} طبيب
                        </div>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold block">
                          محفوظة للأبد 100%
                        </span>
                      </div>
                    </div>

                    {/* 3. خطوات العمل الآمنة: تنزيل الأرشيف ثم تفريغ السحابة */}
                    <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <HardDriveDownload className="w-4 h-4 text-emerald-600" />
                        <span>الخطوة 1: تنزيل ملف الأرشيف وحفظه على جهاز الكمبيوتر</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={handleDownloadFullBackup}
                          className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-right transition-all flex items-start gap-3 group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-[#062142] text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <FolderDown className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                              تحميل الأرشيف الشامل (Full Backup)
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              ملف JSON يحمل اسم النطاق الزمني بالكامل مع العيادات والأطباء والإعدادات.
                            </p>
                            <span className="inline-block mt-2 px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-mono font-bold">
                              Sharaya_Archive_From_{bookings.length > 0 ? (bookings.map(b => b.date).filter(Boolean).sort()[0] || 'start') : 'none'}_To_...json
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={handleDownloadOldArchiveOnly}
                          disabled={eligibleForArchiveCount === 0}
                          className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-right transition-all flex items-start gap-3 group disabled:opacity-50"
                        >
                          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Archive className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                              تحميل أرشيف السجلات القديمة فقط ({eligibleForArchiveCount} حجز)
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              ملف مخصص للحجوزات السابقة لتاريخ ({cutoffDateStr}) تمهيداً لتفريغها.
                            </p>
                            <span className="inline-block mt-2 px-2.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-mono font-bold">
                              Sharaya_Old_Archive_Before_{cutoffDateStr}.json
                            </span>
                          </div>
                        </button>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <h4 className="text-xs sm:text-sm font-black text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                            <Trash2 className="w-4 h-4" />
                            <span>الخطوة 2: تفريغ الحجوزات المؤرشفة فقط من Supabase</span>
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            يتم تنفيذها بعد حفظ الملف على جهازك لتوفير المساحة وتصفير المؤقت للدورة القادمة.
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={eligibleForArchiveCount === 0}
                          onClick={() => setConfirmArchivePruneOpen(true)}
                          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md transition-all shrink-0 flex items-center justify-center gap-2 disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>تفريغ السجلات المؤرشفة ({eligibleForArchiveCount} حجز) 🧹</span>
                        </button>
                      </div>
                    </div>

                    {/* 4. استرجاع ورفع أرشيف سابق إلى Supabase */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 sm:p-5 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                            <FolderUp className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                              استرجاع ورفع أرشيف سابق (Restore Backup) 🔄
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              إذا أردت إعادة أي ملف أرشيف سابق ورفعه مرة أخرى إلى Supabase
                            </p>
                          </div>
                        </div>

                        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-slate-700 text-xs font-black cursor-pointer shadow-xs transition-all">
                          <HardDriveUpload className="w-4 h-4 text-emerald-600" />
                          <span>اختيار ملف الأرشيف (.json) للاسترجاع</span>
                          <input
                            type="file"
                            accept=".json,application/json"
                            onChange={handleFileRestoreSelected}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. تبويب بيانات العرض التجريبية المعزولة */}
                {activePortalTab === 'demo' && (
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
                )}

                {/* 4. تبويب دروع الحماية السيبرانية وبصمة الملكية الفكرية DMCA */}
                {activePortalTab === 'shields' && (
                  <div className="space-y-6">
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

                {/* القسم 5-ب: شهادة الملكية الفكرية الرقمية وحماية الدومين ضد النسخ (DMCA & Anti-Clone Shield) */}
                <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20 p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-9 h-9 rounded-xl bg-[#062142] text-amber-300 flex items-center justify-center">
                        <FileCheck2 className="w-5 h-5" />
                      </span>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                          📜 بصمة الملكية الفكرية الرقمية (DMCA) وحماية الدومين ضد النسخ والتقليد
                        </h3>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          إثبات ملكيتك المشفر داخل الكود وبيانات جوجل (Schema.org) لإغلاق أي موقع مقلد
                          من جوجل والاستضافة فوراً
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const dmcaReportText = `DMCA Copyright Infringement & Impersonation Takedown Notice
Original Copyright Holder & Lead Software Engineer: Eng. Amr (Amrr)
Original System Title: منظومة عيادات الجمعية الشرعية التخصصية بأوسيم (Sharaya Specialized Medical Clinics System)
Official Authorized URL: ${typeof window !== 'undefined' ? window.location.origin : ''}
Cryptographic DMCA Ownership Signature (Embedded in HTML Meta & Schema.org JSON-LD):
${DMCA_OWNERSHIP_CERTIFICATE_ID}

Statement of Good Faith:
I am the original creator and copyright holder of the source code, UI architecture, and digital schema bearing the cryptographic ownership signature above. Any unauthorized reproduction, clone, or impersonation of this medical platform infringes upon my intellectual property rights under the Digital Millennium Copyright Act (DMCA).`;
                        navigator.clipboard?.writeText(dmcaReportText);
                        addToast({
                          type: 'success',
                          title: 'تم نسخ وثيقة بلاغ DMCA الرسمية 📋',
                          message:
                            'تم نسخ النص القانوني وبصمة الملكية المشفرة لتقديمها لجوجل أو شركة الاستضافة لإغلاق أي موقع مقلد.',
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#062142] hover:bg-[#0b315e] text-amber-300 text-xs font-extrabold shadow-xs transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>📋 نسخ وثيقة بلاغ جوجل DMCA الجاهزة</span>
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300/60 dark:border-amber-700/50 text-xs space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-slate-600 dark:text-slate-300">
                        بصمة الملكية المشفرة المزروعة في الكود ومحرك بحث جوجل:
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-[11px]">
                        مفعّلة وموثقة في index.html + Schema.org ✅
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 text-amber-300 font-mono text-[11px] break-all select-all">
                      {DMCA_OWNERSHIP_CERTIFICATE_ID}
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    <label className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(draftConfig.enforceAuthorizedDomainLock)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const currentList = Array.isArray(draftConfig.authorizedDomainsList)
                            ? draftConfig.authorizedDomainsList
                            : [];
                          const nextList =
                            checked && currentList.length === 0 && currentHost
                              ? [currentHost, 'vercel.app']
                              : currentList;
                          setDraftConfig((prev) => ({
                            ...prev,
                            enforceAuthorizedDomainLock: checked,
                            authorizedDomainsList: nextList,
                          }));
                        }}
                        className="mt-1 w-4 h-4 accent-[#062142]"
                      />
                      <div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                          🔒 تفعيل قفل الدومين المعتمد (منع تشغيل الكود إذا تم نسخه لدومين آخر)
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          إذا قام أي شخص بنسخ ملفات الموقع ورفعها على دومين آخر غير مكتوب بالأسفل،
                          يقفل الموقع في وجهه بشاشة انتهاك ملكية فكرية ويبلّغك في الرادار!
                        </p>
                      </div>
                    </label>

                    {draftConfig.enforceAuthorizedDomainLock && (
                      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          النطاقات (Domains) المسموح لها بتشغيل المنظومة (الدومين الحالي:{' '}
                          <code className="text-emerald-600 font-extrabold">{currentHost}</code>):
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(draftConfig.authorizedDomainsList || []).map((dom) => (
                            <span
                              key={dom}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
                            >
                              <span>{dom}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setDraftConfig((prev) => ({
                                    ...prev,
                                    authorizedDomainsList: (prev.authorizedDomainsList || []).filter(
                                      (item) => item !== dom
                                    ),
                                  }))
                                }
                                className="text-rose-500 hover:text-rose-700"
                                title="حذف النطاق"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newDomainInput}
                            onChange={(e) => setNewDomainInput(e.target.value)}
                            placeholder="أضف دومين معتمد (مثال: my-clinic.vercel.app)"
                            className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const clean = newDomainInput
                                .trim()
                                .toLowerCase()
                                .replace(/^https?:\/\//, '')
                                .replace(/\/.*$/, '');
                              if (!clean) return;
                              setDraftConfig((prev) => ({
                                ...prev,
                                authorizedDomainsList: Array.from(
                                  new Set([...(prev.authorizedDomainsList || []), clean])
                                ),
                              }));
                              setNewDomainInput('');
                            }}
                            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-extrabold"
                          >
                            + إضافة الدومين
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 5. تبويب المتصلين لايف والرادار والبث الفوري */}
            {activePortalTab === 'devices' && (
              <div className="space-y-6">
                {/* إرسال رسالة منبثقة فورية لجميع الشاشات المفتوحة الآن */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3 bg-white dark:bg-slate-900">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-amber-500" />
                      <span>إرسال رسالة منبثقة فورية على شاشة الإدارة والموظفين لايف</span>
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
              </div>
            )}

            {/* 6. تبويب تصفير العمليات الرسمي */}
            {activePortalTab === 'purge' && (
              <div className="space-y-6">
                {/* القسم 8: تصفير شامل لجميع الحجوزات عند بدء التشغيل الرسمي */}
                <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs sm:text-sm font-extrabold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4" />
                      <span>
                        مسح شامل لجميع الحجوزات والعمليات (لتسليم النظام فارغاً بالكامل)
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
            )}
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

      {/* نافذة تأكيد تفريغ الأرشيف من Supabase */}
      <AnimatePresence>
        {confirmArchivePruneOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 no-print"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border-2 border-rose-500/50 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="w-11 h-11 rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    تأكيد تفريغ السجلات المؤرشفة من Supabase 🧹
                  </h3>
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">
                    تفريغ ذكي وآمن: حذف القديم فقط مع الحماية الكاملة لآخر الأيام
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 space-y-2.5 leading-relaxed">
                <p className="font-extrabold text-sm">
                  هل قمت بتحميل ملف الأرشيف وحفظه على جهازك أولاً؟
                </p>
                <ul className="list-disc list-inside space-y-1 font-semibold text-slate-700 dark:text-slate-300">
                  <li>
                    سيتم حذف <strong className="text-rose-600 font-black">{eligibleForArchiveCount} حجز قديم</strong> تم إجراؤها ما قبل تاريخ ({cutoffDateStr}) من Supabase.
                  </li>
                  <li>
                    سيتم الإبقاء بنسبة 100% على <strong className="text-emerald-600 font-black">{preservedRecentBookingsCount} حجز جاري</strong> (آخر {keepDaysNum} يوماً).
                  </li>
                  <li>
                    العيادات ({clinics.length})، الأطباء ({doctors.length})، وحسابات الموظفين <strong className="text-emerald-600 font-black">لن تُمَس أبداً</strong>.
                  </li>
                  <li>
                    سيتم تصفير عداد الدورة وتحديد موعد الأرشفة القادم بعد ({archiveCycleInput || 4}) شهور تلقائياً.
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isPruningArchive}
                  onClick={() => setConfirmArchivePruneOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  تراجع وإلغاء
                </button>
                <button
                  type="button"
                  disabled={isPruningArchive || eligibleForArchiveCount === 0}
                  onClick={handlePruneBeforeDays}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isPruningArchive ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري التفريغ من Supabase...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>نعم، قمت بالتحميل — تفريغ {eligibleForArchiveCount} حجز قديم</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* نافذة تأكيد استرجاع ورفع الأرشيف إلى Supabase */}
      <AnimatePresence>
        {restoreModalOpen && pendingRestoreData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 no-print"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border-2 border-emerald-500/50 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <FolderUp className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    تأكيد استرجاع ورفع الأرشيف إلى Supabase 🔄
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    تم فحص محتويات ملف النسخة الاحتياطية بنجاح
                  </p>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">تاريخ إنشاء الأرشيف:</span>
                  <span className="font-extrabold text-slate-900 dark:text-white font-mono">
                    {pendingRestoreData.backupMetadata?.generatedAt
                      ? new Date(pendingRestoreData.backupMetadata.generatedAt).toLocaleString('ar-EG')
                      : 'ملف خارجي'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">عدد الحجوزات في الملف:</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    {Array.isArray(pendingRestoreData.bookings) ? pendingRestoreData.bookings.length : 0} حجز
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">نطاق التواريخ:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">
                    {pendingRestoreData.backupMetadata?.firstBookingDate || '-'} إلى{' '}
                    {pendingRestoreData.backupMetadata?.lastBookingDate || '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">العيادات والأطباء:</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {Array.isArray(pendingRestoreData.clinics) ? pendingRestoreData.clinics.length : 0} عيادة •{' '}
                    {Array.isArray(pendingRestoreData.doctors) ? pendingRestoreData.doctors.length : 0} طبيب
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 font-semibold leading-relaxed">
                ⚠️ تنبيه: سيتم دمج هذه البيانات مع السجلات الحالية ورفعها ومزامنتها مباشرة إلى قاعدة بيانات Supabase.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isRestoring}
                  onClick={() => {
                    setRestoreModalOpen(false);
                    setPendingRestoreData(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={isRestoring}
                  onClick={handleConfirmRestore}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md flex items-center gap-2"
                >
                  {isRestoring ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري الاسترجاع والرفع إلى Supabase...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تأكيد الاسترجاع والرفع السحابي الآن</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
