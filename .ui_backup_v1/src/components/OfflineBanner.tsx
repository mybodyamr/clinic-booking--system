import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          id="offline-banner"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-amber-600 text-white px-4 py-2.5 text-xs font-semibold shadow-md flex items-center justify-between border-b border-amber-700 select-none z-50 relative"
          dir="rtl"
        >
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-amber-500/80 flex items-center justify-center shrink-0">
                <WifiOff className="w-3.5 h-3.5 text-white animate-pulse" />
              </div>
              <div>
                <span className="font-bold ml-1">أنت غير متصل بالإنترنت حالياً:</span>
                <span className="text-amber-100">
                  النظام يعمل بكفاءة في وضع عدم الاتصال (Offline PWA). يتم حفظ التغييرات محلياً وستتم المزامنة تلقائياً فور عودة الاتصال.
                </span>
              </div>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1 bg-amber-700/80 hover:bg-amber-800 text-white rounded-lg text-[11px] font-bold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>إعادة المحاولة</span>
            </button>
          </div>
        </motion.div>
      )}

      {showReconnected && (
        <motion.div
          id="reconnected-banner"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-emerald-600 text-white px-4 py-2 text-xs font-semibold shadow-md flex items-center justify-center gap-2 border-b border-emerald-700 select-none z-50 relative"
          dir="rtl"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-100" />
          <span>تم استعادة الاتصال بالإنترنت بنجاح. جاري مزامنة البيانات مع الخادم السحابي...</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
