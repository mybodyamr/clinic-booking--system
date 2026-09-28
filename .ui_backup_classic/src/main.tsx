import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// المعالجة الفورية لأي خطأ في تحميل ملفات الجافاسكريبت بعد التحديثات (Vite Chunk Load Recovery)
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite preload error detected after new deployment, reloading...', event);
  window.location.reload();
});

window.addEventListener('error', (event) => {
  const msg = event?.message || '';
  if (
    msg.includes('Loading chunk') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed')
  ) {
    console.warn('Dynamic script loading error detected, reloading fresh application...');
    window.location.reload();
  }
});

// تسجيل الـ Service Worker لتمكين دعم PWA والعمل دون اتصال مع التحديث التلقائي الفوري
const isProduction = import.meta.env.PROD || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');

if ('serviceWorker' in navigator && isProduction) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // فحص وجود أي تحديث جديد تم رفعه إلى Vercel أو الخادم
        registration.update();

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New application version installed, activating...');
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
