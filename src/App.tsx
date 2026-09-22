/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { ToastContainer } from './components/ToastContainer';
import { PatientHistoryModal } from './components/PatientHistoryModal';
import { LandingView } from './views/LandingView';
import { BookingView } from './views/BookingView';
import { TicketView } from './views/TicketView';
import { QueueView } from './views/QueueView';
import { LoginView } from './views/LoginView';
import { ReceptionView } from './views/ReceptionView';
import { DoctorView } from './views/DoctorView';
import { CashierView } from './views/CashierView';
import { AdminView } from './views/AdminView';
import { OfflineBanner } from './components/OfflineBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Hospital, Moon, Sun } from 'lucide-react';

const AppContent: React.FC = () => {
  const { currentView, theme, toggleTheme } = useApp();

  const renderView = () => {
    switch (currentView) {
      case 'landing':
        return <LandingView />;
      case 'booking':
        return <BookingView />;
      case 'ticket':
        return <TicketView />;
      case 'queue':
        return <QueueView />;
      case 'login':
        return <LoginView />;
      case 'reception':
        return <ReceptionView />;
      case 'doctor':
        return <DoctorView />;
      case 'cashier':
        return <CashierView />;
      case 'admin':
        return <AdminView />;
      default:
        return <LandingView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      
      {/* شريط تنبيه انقطاع الاتصال بالإنترنت ووضع الـ PWA Offline */}
      <OfflineBanner />

      {/* الشريط العلوي العام */}
      <Navbar />

      {/* المحتوى الرئيسي للشاشة الحالية مع تأثيرات انتقال ناعمة */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* التذييل الطبي الرسمي للجمعية الشرعية */}
      <footer className="no-print border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-800 text-amber-300 flex items-center justify-center">
              <Hospital className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              عيادات الجمعية الشرعية التخصصية
            </span>
            <span>— رعاية صحية تكافلية متميزة</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            {/* زر تبديل الوضع الليلي لراحة العين في التذييل */}
            <button
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-850 transition-colors cursor-pointer"
              title="تبديل مظهر النظام (الوضع الليلي للمناوبات / الوضع النهاري)"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>الوضع النهاري (فاتح)</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600" />
                  <span>الوضع الليلي للمناوبات (داكن)</span>
                </>
              )}
            </button>
            <span className="hidden sm:inline">نظام إدارة العيادات والحجوزات الفورية (PWA)</span>
          </div>
        </div>
      </footer>

      {/* حاوية الإشعارات التفاعلية */}
      <ToastContainer />

      {/* نافذة البحث السريع في سجلات وتذاكر المرضى */}
      <PatientHistoryModal />

    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
