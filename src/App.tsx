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
import { LoginView } from './views/LoginView';
import { ReceptionView } from './views/ReceptionView';
import { DoctorView } from './views/DoctorView';
import { CashierView } from './views/CashierView';
import { AdminView } from './views/AdminView';
import { FinanceManagerView } from './views/FinanceManagerView';
import { OfflineBanner } from './components/OfflineBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Hospital, Moon, Sun, ShieldCheck } from 'lucide-react';

const AppContent: React.FC = () => {
  const { currentView, currentUser, theme, toggleTheme } = useApp();

  const renderView = () => {
    switch (currentView) {
      case 'landing':
        return <LandingView />;
      case 'booking':
        if (currentUser?.role === 'doctor') {
          return <DoctorView />;
        }
        return <BookingView />;
      case 'ticket':
        return <TicketView />;
      case 'login':
        return <LoginView />;
      case 'reception':
        if (!currentUser || (currentUser.role !== 'reception' && currentUser.role !== 'admin')) {
          return <LoginView />;
        }
        return <ReceptionView />;
      case 'doctor':
        if (!currentUser || (currentUser.role !== 'doctor' && currentUser.role !== 'admin')) {
          return <LoginView />;
        }
        return <DoctorView />;
      case 'cashier':
        if (
          !currentUser ||
          (currentUser.role !== 'cashier' &&
            currentUser.role !== 'admin' &&
            currentUser.role !== 'finance_manager')
        ) {
          return <LoginView />;
        }
        return <CashierView />;
      case 'finance':
        if (!currentUser || (currentUser.role !== 'finance_manager' && currentUser.role !== 'admin')) {
          return <LoginView />;
        }
        return <FinanceManagerView />;
      case 'admin':
        if (!currentUser || currentUser.role !== 'admin') {
          return <LoginView />;
        }
        return <AdminView />;
      default:
        return <LandingView />;
    }
  };

  return (
    <div className="min-h-dvh w-full overflow-x-clip bg-[#F8FBF9] dark:bg-[#06110E] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300 print:bg-white print:text-black print:min-h-0">
      
      {/* شريط تنبيه انقطاع الاتصال بالإنترنت ووضع الـ PWA Offline */}
      <div className="no-print">
        <OfflineBanner />
      </div>

      {/* الشريط العلوي العام */}
      <Navbar />

      {/* المحتوى الرئيسي للشاشة الحالية — متجاوب مع الهواتف، الأجهزة اللوحية، وشاشات الكمبيوتر العريضة */}
      <main className="relative z-10 flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-7 lg:py-8 print:p-0 print:m-0 print:max-w-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full min-w-0"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* التذييل الطبي المؤسسي الهادئ والكلاسيكي (يدعم الوضع النهاري والليلي وحواف آيفون الآمنة) */}
      <footer className="relative z-10 no-print border-t border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#040B09]/95 backdrop-blur-md py-5 sm:py-6 pb-safe text-xs text-slate-500 dark:text-slate-400 transition-colors duration-300">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-center sm:text-right">
          <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-900 dark:bg-emerald-950 text-amber-300 dark:text-amber-400 flex items-center justify-center border border-emerald-800/60 shadow-2xs shrink-0">
              <Hospital className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span>مجمع عيادات الجمعية الشرعية التخصصية</span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-white/5 text-emerald-800 dark:text-amber-300 border border-emerald-200/70 dark:border-white/10">
                  <ShieldCheck className="w-3 h-3 text-emerald-700 dark:text-amber-400" />
                  <span>منظومة طبية رقمية معتمدة</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                رعاية صحية تخصصية بإشراف نخبة من الأطباء الاستشاريين
              </p>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            جميع الحقوق محفوظة © {new Date().getFullYear()} • عيادات الجمعية الشرعية التخصصية
          </div>
        </div>
      </footer>

      {/* حاوية الإشعارات التفاعلية */}
      <div className="no-print">
        <ToastContainer />
      </div>

      {/* نافذة البحث السريع في سجلات وتذاكر المرضى */}
      <div className="no-print">
        <PatientHistoryModal />
      </div>

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
