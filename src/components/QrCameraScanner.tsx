import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  SwitchCamera,
  Flashlight,
  ImageUp,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface QrCameraScannerProps {
  onScanSuccess: (decodedText: string) => void;
  active?: boolean;
  hintText?: string;
}

// وعد مشترك على مستوى المكون لمنع إلغاء نافذة إذن الكاميرا في Chrome عند إعادة التركيب السريع (StrictMode)
let sharedPendingMediaPromise: Promise<MediaStream> | null = null;

export const QrCameraScanner: React.FC<QrCameraScannerProps> = ({
  onScanSuccess,
  active = true,
  hintText = 'وجّه كاميرا الجهاز نحو رمز QR الموجود بتذكرة المريض ليتم المسح تلقائياً'
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const unmountStopTimeoutRef = useRef<number | null>(null);
  const hasScannedRef = useRef<boolean>(false);
  const isStartingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // حفظ دالة الاستجابة في Ref لمنع إعادة تشغيل الكاميرا أو اختفاء نافذة الإذن عند تحديث الصفحة في الخلفية
  const onScanSuccessRef = useRef(onScanSuccess);
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  const [cameraState, setCameraState] = useState<'starting' | 'active' | 'stopped' | 'error'>('starting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [detectedFlash, setDetectedFlash] = useState<boolean>(false);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);

  // صوت صفارة قصيرة عند نجاح قراءة الكود
  const playScanBeep = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // ignore audio errors
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(100);
      }
    } catch {
      // ignore vibrate errors
    }
  }, []);

  const stopCameraStream = useCallback(() => {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    isStartingRef.current = false;
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const handleDecodedResult = useCallback(
    (rawText: string) => {
      const cleaned = rawText.trim();
      if (!cleaned || hasScannedRef.current) return;
      hasScannedRef.current = true;
      setDetectedFlash(true);
      playScanBeep();
      stopCameraStream();
      setCameraState('stopped');
      onScanSuccessRef.current(cleaned);
    },
    [playScanBeep, stopCameraStream]
  );

  const requestCameraStream = async (targetFacing: 'environment' | 'user'): Promise<MediaStream> => {
    if (sharedPendingMediaPromise) {
      return sharedPendingMediaPromise;
    }

    const promise = (async () => {
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 720 },
            height: { ideal: 720 }
          }
        });
      } catch (firstErr: any) {
        const firstErrName = String(firstErr?.name || '');
        if (firstErrName !== 'NotAllowedError' && firstErrName !== 'PermissionDeniedError') {
          return await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true
          });
        }
        throw firstErr;
      } finally {
        sharedPendingMediaPromise = null;
      }
    })();

    sharedPendingMediaPromise = promise;
    return promise;
  };

  const startCameraStream = useCallback(
    async (targetFacing: 'environment' | 'user', forceRestart = false) => {
      if (unmountStopTimeoutRef.current) {
        window.clearTimeout(unmountStopTimeoutRef.current);
        unmountStopTimeoutRef.current = null;
      }

      if (isStartingRef.current && !forceRestart) return;
      if (streamRef.current && streamRef.current.active && !forceRestart) return;

      if (forceRestart && streamRef.current) {
        stopCameraStream();
      }

      isStartingRef.current = true;
      hasScannedRef.current = false;
      setDetectedFlash(false);
      setErrorMessage('');
      setCameraState('starting');

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        isStartingRef.current = false;
        setCameraState('error');
        setErrorMessage(
          'متصفحك الحالي لا يدعم البث المباشر للكاميرا. اضغط على زر "التقاط صورة الكود بالكاميرا" بالأسفل لمسح التذكرة فوراً.'
        );
        return;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await requestCameraStream(targetFacing);
      } catch (err: any) {
        isStartingRef.current = false;
        if (!isMountedRef.current) return;
        setCameraState('error');
        const errName = String(err?.name || '');
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          setErrorMessage(
            'الكاميرا تحتاج موافقتك للعمل: إذا كان هناك أيقونة عائمة على الشاشة (مثل ماسنجر أو مسجل الشاشة) قم بإخفائها لأن نظام أندرويد يمنع الضغط على "Allow" في وجودها، أو اضغط زر "التقاط صورة الكود بالكاميرا (بديل فوري)" بالأسفل.'
          );
        } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
          setErrorMessage('لم يتم العثور على كاميرا متصلة بهذا الجهاز.');
        } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
          setErrorMessage('الكاميرا مشغولة بتطبيق آخر حالياً. أغلق التطبيقات الأخرى واضغط إعادة المحاولة.');
        } else {
          setErrorMessage('تعذر فتح البث المباشر للكاميرا. اضغط "تشغيل الكاميرا الآن" أو استخدم زر "التقاط صورة الكود".');
        }
        return;
      }

      isStartingRef.current = false;
      if (!isMountedRef.current) {
        stream.getTracks().forEach(t => {
          try {
            t.stop();
          } catch {}
        });
        return;
      }

      streamRef.current = stream;

      // فحص دعم الفلاش (Torch) في الكاميرا الخلفية
      try {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
          const caps = videoTrack.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
          setTorchSupported(Boolean(caps && caps.torch));
        }
      } catch {
        setTorchSupported(false);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        try {
          await videoRef.current.play();
        } catch {
          // ignore play interruption
        }
      }

      setCameraState('active');

      let nativeDetector: any = null;
      if ('BarcodeDetector' in window) {
        try {
          const BarcodeDetectorClass = (window as any).BarcodeDetector;
          nativeDetector = new BarcodeDetectorClass({ formats: ['qr_code'] });
        } catch {
          nativeDetector = null;
        }
      }

      if (scanTimerRef.current) {
        window.clearInterval(scanTimerRef.current);
      }

      scanTimerRef.current = window.setInterval(async () => {
        if (hasScannedRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) return;

        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) return;

        if (nativeDetector) {
          try {
            const barcodes = await nativeDetector.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              handleDecodedResult(String(barcodes[0].rawValue));
              return;
            }
          } catch {
            // fallback to jsQR below
          }
        }

        const maxDim = 600;
        const scale = Math.min(1, maxDim / Math.max(vw, vh));
        const cw = Math.max(1, Math.floor(vw * scale));
        const ch = Math.max(1, Math.floor(vh * scale));

        if (canvas.width !== cw) canvas.width = cw;
        if (canvas.height !== ch) canvas.height = ch;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, cw, ch);
        const imageData = ctx.getImageData(0, 0, cw, ch);
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });

        if (qrCode && qrCode.data && qrCode.data.trim()) {
          handleDecodedResult(qrCode.data);
        }
      }, 140);
    },
    [handleDecodedResult, stopCameraStream]
  );

  // تشغيل الكاميرا بثبات تام دون تأثر بـ StrictMode أو إعادة الرسم
  useEffect(() => {
    isMountedRef.current = true;
    if (unmountStopTimeoutRef.current) {
      window.clearTimeout(unmountStopTimeoutRef.current);
      unmountStopTimeoutRef.current = null;
    }

    if (active) {
      startCameraStream(facingMode, false);
    } else {
      stopCameraStream();
      setCameraState('stopped');
    }

    return () => {
      isMountedRef.current = false;
      unmountStopTimeoutRef.current = window.setTimeout(() => {
        if (!isMountedRef.current) {
          stopCameraStream();
        }
      }, 150);
    };
  }, [active, facingMode, startCameraStream, stopCameraStream]);

  const handleToggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    const nextTorch = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextTorch } as any]
      });
      setTorchOn(nextTorch);
    } catch {
      // torch not supported
    }
  };

  const handleSwitchCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCameraStream(nextMode, true);
  };

  // قراءة رمز QR من صورة ملتقطة بالكاميرا أو مرفوعة من المعرض (يدعم BarcodeDetector + jsQR متعدد الأحجام)
  const handleFileCaptureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingImage(true);
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        try {
          // 1. محاولة القراءة السريعة بمحرك المتصفح الأصلي BarcodeDetector إن وجد
          if ('BarcodeDetector' in window) {
            try {
              const BarcodeDetectorClass = (window as any).BarcodeDetector;
              const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
              const found = await detector.detect(img);
              if (found && found.length > 0 && found[0].rawValue) {
                setIsProcessingImage(false);
                handleDecodedResult(String(found[0].rawValue));
                return;
              }
            } catch {
              // نكمل بـ jsQR بالأسفل
            }
          }

          // 2. محاولة القراءة عبر jsQR بعدة أحجام لضمان قراءة صور الكاميرا عالية الدقة
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          const targetSizes = [1000, 650, 1400];

          if (ctx) {
            for (const maxDim of targetSizes) {
              const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
              canvas.width = Math.max(1, Math.floor(img.width * scale));
              canvas.height = Math.max(1, Math.floor(img.height * scale));
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'attemptBoth'
              });
              if (code && code.data && code.data.trim()) {
                setIsProcessingImage(false);
                handleDecodedResult(code.data);
                return;
              }
            }
          }

          setIsProcessingImage(false);
          setErrorMessage('لم يتم العثور على رمز QR واضح داخل الصورة. يرجى تقريب الكاميرا من مربع الـ QR والمحاولة مرة أخرى.');
        } catch {
          setIsProcessingImage(false);
          setErrorMessage('تعذر تحليل الصورة. يرجى المحاولة مرة أخرى.');
        }
      };
      img.onerror = () => {
        setIsProcessingImage(false);
        setErrorMessage('تعذر قراءة ملف الصورة المختار.');
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-2.5">
      <div className="bg-slate-950 rounded-2xl overflow-hidden border-2 border-emerald-500/70 relative shadow-inner">
        {/* حاوية الكاميرا المرنة — لا تقص الأزرار في حالة الخطأ أو التوقف */}
        <div
          className={`relative w-full bg-slate-950 flex items-center justify-center overflow-hidden ${
            cameraState === 'active'
              ? 'aspect-4/3 sm:aspect-16/10 max-h-[260px]'
              : 'min-h-[210px] py-5 px-4'
          }`}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full object-cover transition-opacity duration-200 ${
              cameraState === 'active' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'
            }`}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* إطار التوجيه الأخضر وخط الليزر المتحرك أثناء عمل الكاميرا */}
          {cameraState === 'active' && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-3">
              <div
                className={`w-40 h-40 sm:w-44 sm:h-44 rounded-2xl border-2 transition-all relative ${
                  detectedFlash
                    ? 'border-emerald-300 bg-emerald-400/20 scale-105'
                    : 'border-emerald-400/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]'
                }`}
              >
                <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-xl" />
                <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-xl" />
                <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-xl" />
                <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-xl" />
                <div className="absolute inset-x-2 top-1/2 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse" />
              </div>

              <span className="mt-2.5 px-3 py-1 rounded-full bg-slate-950/85 text-emerald-200 text-[11px] font-bold backdrop-blur-xs border border-emerald-500/30">
                الكاميرا تعمل الآن — ضع رمز QR داخل المربع
              </span>
            </div>
          )}

          {/* حالة جاري تشغيل الكاميرا */}
          {cameraState === 'starting' && (
            <div className="text-center space-y-2.5 text-white">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
              </div>
              <div className="text-xs font-bold text-emerald-200">
                جاري فتح كاميرا الجهاز لمسح رمز QR...
              </div>
              <p className="text-[11px] text-slate-300 max-w-xs mx-auto leading-relaxed">
                اضغط على <strong>"Allow while visiting the site"</strong> عند ظهور رسالة المتصفح (وتأكد من إبعاد أي أيقونة عائمة على الشاشة).
              </p>
            </div>
          )}

          {/* حالة إيقاف الكاميرا مؤقتاً */}
          {cameraState === 'stopped' && (
            <div className="text-center space-y-3 text-white">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center">
                <Camera className="w-7 h-7 text-emerald-400" />
              </div>
              <div className="text-xs font-bold text-slate-200">تم إيقاف الكاميرا مؤقتاً</div>
              <button
                type="button"
                onClick={() => startCameraStream(facingMode, true)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Camera className="w-4 h-4" />
                <span>تشغيل الكاميرا الآن</span>
              </button>
            </div>
          )}

          {/* حالة تعذر فتح الكاميرا أو رفض الإذن */}
          {cameraState === 'error' && (
            <div className="text-center space-y-3 text-white max-w-md mx-auto">
              <div className="w-11 h-11 mx-auto rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-xs font-bold text-amber-200 leading-relaxed px-1">
                {errorMessage || 'تعذر تشغيل البث المباشر للكاميرا في المتصفح'}
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => startCameraStream(facingMode, true)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>إعادة تشغيل الكاميرا</span>
                </button>
                <button
                  type="button"
                  disabled={isProcessingImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {isProcessingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري قراءة الكود...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>التقاط صورة الكود فوراً</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* مدخل الصورة المخفي لالتقاط الكود مباشرة بالكاميرا أو المعرض */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileCaptureChange}
          className="hidden"
        />

        {/* شريط أدوات التحكم بالكاميرا — يظهر فقط عندما يكون البث المباشر للكاميرا نشطاً لمنع تكرار الأزرار */}
        {cameraState === 'active' && (
          <div className="bg-slate-900/95 border-t border-slate-800 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handleSwitchCamera}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-[11px] inline-flex items-center gap-1.5 cursor-pointer border border-slate-700"
                title="تبديل بين الكاميرا الخلفية والأمامية"
              >
                <SwitchCamera className="w-3.5 h-3.5 text-emerald-400" />
                <span>تبديل الكاميرا</span>
              </button>

              {torchSupported && (
                <button
                  type="button"
                  onClick={handleToggleTorch}
                  className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] inline-flex items-center gap-1.5 cursor-pointer border ${
                    torchOn
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                  }`}
                  title="تشغيل أو إيقاف كشاف الهاتف"
                >
                  <Flashlight className="w-3.5 h-3.5" />
                  <span>{torchOn ? 'إيقاف الفلاش' : 'الفلاش'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  setCameraState('stopped');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer border border-rose-800/60"
              >
                <CameraOff className="w-3.5 h-3.5" />
                <span>إيقاف</span>
              </button>
            </div>

            <button
              type="button"
              disabled={isProcessingImage}
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[11px] inline-flex items-center gap-1.5 cursor-pointer border border-slate-700"
              title="مسح رمز QR عبر التقاط صورة أو اختيار صورة التذكرة من الهاتف"
            >
              {isProcessingImage ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري الفحص...</span>
                </>
              ) : (
                <>
                  <ImageUp className="w-3.5 h-3.5" />
                  <span>مسح من صورة</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* رسالة توضيحية أو خطأ قراءة صورة */}
      {errorMessage && cameraState === 'active' ? (
        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-[11px] font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{errorMessage}</span>
        </div>
      ) : (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center font-medium flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{hintText}</span>
        </div>
      )}
    </div>
  );
};
