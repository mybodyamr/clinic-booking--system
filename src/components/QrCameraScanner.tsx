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

export const QrCameraScanner: React.FC<QrCameraScannerProps> = ({
  onScanSuccess,
  active = true,
  hintText = 'وجّه كاميرا الجهاز نحو رمز QR الموجود بتذكرة المريض ليتم المسح تلقائياً'
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const hasScannedRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
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
      onScanSuccess(cleaned);
    },
    [onScanSuccess, playScanBeep, stopCameraStream]
  );

  const startCameraStream = useCallback(
    async (targetFacing: 'environment' | 'user') => {
      stopCameraStream();
      hasScannedRef.current = false;
      setDetectedFlash(false);
      setErrorMessage('');
      setCameraState('starting');

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        setCameraState('error');
        setErrorMessage(
          'متصفحك الحالي لا يدعم تشغيل الكاميرا مباشرة أو أن الاتصال غير آمن (يتطلب HTTPS). يمكنك الضغط على زر "مسح من صورة / كاميرا الهاتف" بالأسفل.'
        );
        return;
      }

      let stream: MediaStream | null = null;
      try {
        // المحاولة الأولى: الكاميرا المطلوبة (الخلفية افتراضياً) بدقة عالية لقراءة الباركود السريعة
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } catch {
        try {
          // المحاولة الاحتياطية: أي كاميرا متاحة على الجهاز (مفيد للابتوب أو بعض الهواتف)
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true
          });
        } catch (err: any) {
          setCameraState('error');
          const errName = String(err?.name || '');
          if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
            setErrorMessage(
              'تم رفض إذن الكاميرا من المتصفح. يرجى الضغط على أيقونة القفل 🔒 بجانب رابط الموقع في الأعلى والسماح للكاميرا (Allow)، أو استخدام زر "التقاط صورة الكود" بالأسفل.'
            );
          } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
            setErrorMessage('لم يتم العثور على كاميرا متصلة بهذا الجهاز.');
          } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
            setErrorMessage('الكاميرا مستخدمة حالياً بواسطة تطبيق آخر على جهازك. أغلق التطبيق الآخر ثم اضغط إعادة المحاولة.');
          } else {
            setErrorMessage('تعذر فتح الكاميرا تلقائياً. تأكد من منح صلاحية الكاميرا للمتصفح أو استخدم زر التقاط صورة الكود.');
          }
          return;
        }
      }

      if (!stream) return;
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

      // تجهيز BarcodeDetector الأصلي في المتصفح إن وجد لتسريع القراءة بجانب محرك jsQR
      let nativeDetector: any = null;
      if ('BarcodeDetector' in window) {
        try {
          const BarcodeDetectorClass = (window as any).BarcodeDetector;
          nativeDetector = new BarcodeDetectorClass({ formats: ['qr_code'] });
        } catch {
          nativeDetector = null;
        }
      }

      // حلقة المسح الضوئي المستمرة كل 130 مللي ثانية
      scanTimerRef.current = window.setInterval(async () => {
        if (hasScannedRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) return;

        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) return;

        // 1) الفحص عبر BarcodeDetector الأصلي إن توفر
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

        // 2) الفحص عبر محرك jsQR الموثوق على جميع المتصفحات (أندرويد وآيفون وكمبيوتر)
        const maxDim = 640;
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
      }, 130);
    },
    [handleDecodedResult, stopCameraStream]
  );

  useEffect(() => {
    if (active) {
      startCameraStream(facingMode);
    } else {
      stopCameraStream();
      setCameraState('stopped');
    }
    return () => {
      stopCameraStream();
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
      // torch not supported on this track
    }
  };

  const handleSwitchCamera = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // قراءة رمز QR من صورة ملتقطة بالكاميرا أو مرفوعة من المعرض (حل احتياطي مضمون 100%)
  const handleFileCaptureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingImage(true);
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 1000;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          canvas.width = Math.max(1, Math.floor(img.width * scale));
          canvas.height = Math.max(1, Math.floor(img.height * scale));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth'
            });
            if (code && code.data) {
              setIsProcessingImage(false);
              handleDecodedResult(code.data);
              return;
            }
          }
          setIsProcessingImage(false);
          setErrorMessage('لم يتم العثور على رمز QR واضح داخل الصورة الملتقطة. يرجى تقريب الكاميرا من مربع الـ QR والمحاولة مرة أخرى.');
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
        {/* شاشة الفيديو الحية للكاميرا */}
        <div className="relative w-full aspect-4/3 sm:aspect-16/10 max-h-[280px] bg-slate-950 flex items-center justify-center overflow-hidden">
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
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
              <div
                className={`w-44 h-44 sm:w-48 sm:h-48 rounded-2xl border-2 transition-all relative ${
                  detectedFlash
                    ? 'border-emerald-300 bg-emerald-400/20 scale-105'
                    : 'border-emerald-400/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]'
                }`}
              >
                {/* زوايا التركيز البصري */}
                <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-xl" />
                <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-xl" />
                <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-xl" />
                <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-xl" />

                {/* خط الليزر المتحرك */}
                <div className="absolute inset-x-2 top-1/2 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse" />
              </div>

              <span className="mt-3 px-3 py-1 rounded-full bg-slate-950/80 text-emerald-200 text-[11px] font-bold backdrop-blur-xs border border-emerald-500/30">
                الكاميرا تعمل الآن — ضع رمز QR داخل المربع
              </span>
            </div>
          )}

          {/* حالة جاري تشغيل الكاميرا */}
          {cameraState === 'starting' && (
            <div className="p-6 text-center space-y-3 text-white">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              </div>
              <div className="text-xs font-bold text-emerald-200">
                جاري فتح كاميرا الجهاز لمسح رمز QR...
              </div>
              <p className="text-[11px] text-slate-400">
                يرجى الضغط على "سماح / Allow" إذا طلب المتصفح إذن استخدام الكاميرا
              </p>
            </div>
          )}

          {/* حالة إيقاف الكاميرا مؤقتاً */}
          {cameraState === 'stopped' && (
            <div className="p-6 text-center space-y-3 text-white">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center">
                <Camera className="w-8 h-8 text-emerald-400" />
              </div>
              <div className="text-xs font-bold text-slate-200">تم إيقاف الكاميرا مؤقتاً</div>
              <button
                type="button"
                onClick={() => startCameraStream(facingMode)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Camera className="w-4 h-4" />
                <span>تشغيل الكاميرا الآن</span>
              </button>
            </div>
          )}

          {/* حالة تعذر فتح الكاميرا أو رفض الإذن */}
          {cameraState === 'error' && (
            <div className="p-5 text-center space-y-3 text-white max-w-md mx-auto">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-amber-400" />
              </div>
              <div className="text-xs font-bold text-amber-200 leading-relaxed">
                {errorMessage || 'تعذر تشغيل الكاميرا المباشرة في المتصفح'}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => startCameraStream(facingMode)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة محاولة فتح الكاميرا</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>التقاط صورة الكود بالكاميرا</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* شريط أدوات التحكم بالكاميرا في أسفل نافذة المسح */}
        <div className="bg-slate-900/95 border-t border-slate-800 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200">
          <div className="flex items-center gap-1.5 flex-wrap">
            {cameraState === 'active' ? (
              <>
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
              </>
            ) : (
              <button
                type="button"
                onClick={() => startCameraStream(facingMode)}
                className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>فتح الكاميرا المباشرة</span>
              </button>
            )}
          </div>

          {/* زر مسح من صورة أو كاميرا الهاتف الأصلية */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileCaptureChange}
              className="hidden"
            />
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
                  <span>مسح من صورة / كاميرا</span>
                </>
              )}
            </button>
          </div>
        </div>
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
