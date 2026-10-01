import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { recordLocalSystemError } from './services/storage';
import { reportClientErrorToDb } from './services/supabaseService';

// المعالجة الفورية لأي خطأ في تحميل ملفات الجافاسكريبت بعد التحديثات (Vite Chunk Load Recovery) مع توثيقه في قاعدة البيانات
window.addEventListener('vite:preloadError', (event: Event) => {
  console.warn('Vite preload error detected after new deployment, logging & reloading...', event);
  const payload = (event as any)?.payload;
  const entry = recordLocalSystemError({
    source: 'vite:preloadError',
    message: payload?.message || 'فشل تحميل حزمة تحديثات الواجهة (vite:preloadError)',
    stack: payload?.stack || String(payload || 'vite:preloadError'),
  });
  Promise.race([
    reportClientErrorToDb(entry),
    new Promise((resolve) => setTimeout(resolve, 350)),
  ]).finally(() => {
    window.location.reload();
  });
});

window.addEventListener('error', (event) => {
  const msg = event?.message || '';
  const isChunkError =
    msg.includes('Loading chunk') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed');

  if (isChunkError) {
    console.warn('Dynamic script loading error detected, logging & reloading fresh application...');
    const entry = recordLocalSystemError({
      source: 'ChunkLoadError',
      message: msg || 'خطأ في تحميل ملفات البرمجة الديناميكية (ChunkLoadError)',
      stack: event?.error?.stack || `${event?.filename || ''}:${event?.lineno || 0}`,
    });
    Promise.race([
      reportClientErrorToDb(entry),
      new Promise((resolve) => setTimeout(resolve, 350)),
    ]).finally(() => {
      window.location.reload();
    });
  } else if (msg && !msg.includes('ResizeObserver loop')) {
    const entry = recordLocalSystemError({
      source: 'RuntimeError',
      message: msg,
      stack: event?.error?.stack || `${event?.filename || ''}:${event?.lineno || 0}:${event?.colno || 0}`,
    });
    reportClientErrorToDb(entry).catch(() => {});
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason;
  const msg = reason?.message || (typeof reason === 'string' ? reason : '');
  if (!msg || msg.includes('WebSocket') || msg.includes('vite')) return;
  const entry = recordLocalSystemError({
    source: 'UnhandledRejection',
    message: msg,
    stack: reason?.stack || String(reason),
  });
  reportClientErrorToDb(entry).catch(() => {});
});

// تسجيل الـ Service Worker لتمكين دعم PWA والعمل دون اتصال مع التحديث التلقائي الفوري
const isProduction = import.meta.env.PROD || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');

if ('serviceWorker' in navigator && isProduction) {
  window.addEventListener('load', () => {
    if ('caches' in window) {
      window.caches.keys().then((keys) => {
        keys.forEach((key) => {
          if (key !== 'sharaya-clinics-v8') {
            window.caches.delete(key);
          }
        });
      }).catch(() => {});
    }

    navigator.serviceWorker
      .register('/sw.js?v=8', { updateViaCache: 'none' })
      .then((registration) => {
        // فحص وجود أي تحديث جديد تم رفعه إلى Vercel أو الخادم بدون الاعتماد على الكاش
        registration.update();

        // فحص تلقائي للتحديثات عند عودة المستخدم للتطبيق أو كل دقيقة لضمان تحديث فوري للجميع بدون مسح يدوي للكاش
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        });
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60_000);

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      })
      .catch((err) => {
        console.log('Service Worker registration skipped:', err);
      });
  });

  // إعادة تحميل تلقائية سلسة عند تفعيل إصدار جديد من الـ Service Worker
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
