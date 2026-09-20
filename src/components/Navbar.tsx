import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Moon, 
  Sun, 
  Search, 
  LogOut, 
  UserCheck, 
  CalendarPlus, 
  LayoutDashboard, 
  Stethoscope, 
  Receipt, 
  Download,
  Hospital
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Navbar: React.FC = () => {
  const { 
    theme, 
    toggleTheme, 
    currentUser, 
    logout, 
    navigate, 
    activeView,
    setPatientHistoryModalOpen 
  } = useApp();

  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const getRoleBadge = () => {
    if (!currentUser) return null;
    switch (currentUser.role) {
      case 'admin':
        return { label: 'مدير المنظومة', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' };
      case 'doctor':
        return { label: 'طبيب معالج', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' };
      case 'reception':
        return { label: 'مسؤول استقبال', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' };
      case 'cashier':
        return { label: 'أمين الخزينة', color: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' };
    }
  };

  const roleInfo = getRoleBadge();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        
        {/* الشعار واسم المؤسسة */}
        <div 
          onClick={() => navigate('landing')}
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group select-none min-w-0"
        >
          <motion.div 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-950 dark:from-emerald-700 dark:to-emerald-900 flex items-center justify-center text-amber-400 shadow-md border border-emerald-700/40 relative overflow-hidden shrink-0"
          >
            <div className="absolute inset-0 bg-radial from-amber-400/20 to-transparent opacity-50" />
            <Hospital className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300 relative z-10" />
          </motion.div>
          <div className="min-w-0">
            <div className="font-bold text-sm sm:text-lg leading-tight text-slate-900 dark:text-white flex items-center gap-1.5 sm:gap-2">
              <span className="truncate">عيادات الجمعية الشرعية</span>
              <span className="hidden md:inline text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                رعاية طبية خيرية
              </span>
            </div>
            <div className="hidden sm:block text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 font-medium truncate">
              المنظومة الرقمية لحجوزات وإدارة أدوار العيادات
            </div>
          </div>
        </div>

        {/* الروابط وأزرار التحكم */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          
          {/* زر تثبيت تطبيق PWA إذا كان متاحاً في المتصفح */}
          {installPrompt && (
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:text-amber-100 bg-amber-100 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900 transition-all shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
              <span>تثبيت التطبيق</span>
            </motion.button>
          )}

          {/* زر تبديل المظهر داكن / فاتح لراحة العين أثناء المناوبات */}
          <motion.button
            whileTap={{ rotate: 180, scale: 0.85 }}
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-amber-400 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 transition-all cursor-pointer shadow-2xs"
            aria-label={theme === 'dark' ? 'التبديل إلى الوضع النهاري الفاتح' : 'التبديل إلى الوضع الليلي الداكن'}
            title={theme === 'dark' ? 'تفعيل الوضع النهاري (فاتح)' : 'تفعيل الوضع الليلي للمناوبات (داكن)'}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400 drop-shadow-xs" />
            ) : (
              <Moon className="w-5 h-5 text-slate-700" />
            )}
          </motion.button>

          {/* إذا كان المستخدم مسجل دخول */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              {/* شارة المستخدم والدور */}
              <div 
                onClick={() => {
                  if (currentUser.role === 'admin') navigate('admin');
                  if (currentUser.role === 'doctor') navigate('doctor');
                  if (currentUser.role === 'reception') navigate('reception');
                  if (currentUser.role === 'cashier') navigate('cashier');
                }}
                className="cursor-pointer flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:border-emerald-500/50 transition-all"
              >
                <div className="w-7 h-7 rounded-md bg-emerald-700 text-white flex items-center justify-center text-xs font-bold">
                  {currentUser.displayName.charAt(0)}
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-900 dark:text-white leading-none">
                    {currentUser.displayName.split(' ')[0]}
                  </div>
                  {roleInfo && (
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      {roleInfo.label}
                    </span>
                  )}
                </div>
              </div>

              {/* أزرار الانتقال السريع للموظف */}
              {currentUser.role === 'admin' && activeView !== 'admin' && (
                <button
                  onClick={() => navigate('admin')}
                  className="p-2 text-slate-600 dark:text-slate-300 hover:text-emerald-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                  title="لوحة الإدارة"
                >
                  <LayoutDashboard className="w-5 h-5" />
                </button>
              )}

              {currentUser.role === 'doctor' && activeView !== 'doctor' && (
                <button
                  onClick={() => navigate('doctor')}
                  className="p-2 text-slate-600 dark:text-slate-300 hover:text-emerald-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                  title="شاشة الطبيب"
                >
                  <Stethoscope className="w-5 h-5" />
                </button>
              )}

              {currentUser.role === 'reception' && activeView !== 'reception' && (
                <button
                  onClick={() => navigate('reception')}
                  className="p-2 text-slate-600 dark:text-slate-300 hover:text-emerald-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                  title="شاشة الاستقبال"
                >
                  <UserCheck className="w-5 h-5" />
                </button>
              )}

              {currentUser.role === 'cashier' && activeView !== 'cashier' && (
                <button
                  onClick={() => navigate('cashier')}
                  className="p-2 text-slate-600 dark:text-slate-300 hover:text-emerald-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                  title="الخزينة والصندوق"
                >
                  <Receipt className="w-5 h-5" />
                </button>
              )}

              {/* زر تسجيل الخروج */}
              <button
                onClick={logout}
                className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                title="تسجيل الخروج"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            /* إذا كان زائراً أو مريضاً */
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => navigate('login')}
                className="px-2.5 sm:px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all whitespace-nowrap"
              >
                <span className="hidden sm:inline">دخول الكادر الطبي</span>
                <span className="sm:hidden">دخول</span>
              </button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('booking')}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-all whitespace-nowrap"
              >
                <CalendarPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>حجز كشف</span>
              </motion.button>
            </div>
          )}

        </div>

      </div>
    </header>
  );
};
