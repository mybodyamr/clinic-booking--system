import React from 'react';
import { 
  Hospital, 
  CalendarPlus, 
  MonitorPlay, 
  UserCheck, 
  Stethoscope, 
  Receipt, 
  Settings, 
  LogIn, 
  LogOut, 
  Sun, 
  Moon,
  FileSearch
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AppView } from '../types';

export const Navbar: React.FC = () => {
  const { 
    theme, 
    toggleTheme, 
    currentUser, 
    activeView, 
    navigate, 
    logout,
    setPatientHistoryModalOpen
  } = useApp();

  // بناء عناصر التنقل حسب حالة تسجيل الدخول وصلاحية الدور
  const getNavItems = () => {
    const publicItems: { id: AppView; label: string; icon: React.ReactNode }[] = [
      { id: 'landing', label: 'الرئيسية', icon: <Hospital className="w-4 h-4" /> },
      { id: 'booking', label: 'حجز كشف', icon: <CalendarPlus className="w-4 h-4" /> },
      { id: 'queue', label: 'شاشة الانتظار الحية', icon: <MonitorPlay className="w-4 h-4" /> },
    ];

    if (!currentUser) {
      return publicItems;
    }

    const staffItems: { id: AppView; label: string; icon: React.ReactNode }[] = [
      ...publicItems
    ];

    if (currentUser.role === 'reception' || currentUser.role === 'admin') {
      staffItems.push({
        id: 'reception',
        label: 'مكتب الاستقبال',
        icon: <UserCheck className="w-4 h-4" />
      });
    }

    if (currentUser.role === 'doctor' || currentUser.role === 'admin') {
      staffItems.push({
        id: 'doctor',
        label: 'شاشة الطبيب',
        icon: <Stethoscope className="w-4 h-4" />
      });
    }

    if (currentUser.role === 'cashier' || currentUser.role === 'admin') {
      staffItems.push({
        id: 'cashier',
        label: 'الخزينة والتحصيل',
        icon: <Receipt className="w-4 h-4" />
      });
    }

    if (currentUser.role === 'admin') {
      staffItems.push({
        id: 'admin',
        label: 'إدارة النظام',
        icon: <Settings className="w-4 h-4" />
      });
    }

    return staffItems;
  };

  const navItems = getNavItems();

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return { text: 'مدير النظام', classes: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-800' };
      case 'doctor':
        return { text: 'طبيب معالج', classes: 'bg-emerald-900/10 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-700/30' };
      case 'reception':
        return { text: 'مسؤول استقبال', classes: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700' };
      case 'cashier':
        return { text: 'مسؤول خزينة', classes: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700' };
      default:
        return { text: 'موظف', classes: 'bg-slate-100 text-slate-700 border-slate-300' };
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* الهوية المؤسسية الرسمية */}
          <div 
            onClick={() => navigate('landing')}
            className="flex items-center gap-3 cursor-pointer group shrink-0"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-900 dark:bg-emerald-800 flex items-center justify-center text-white border border-emerald-950 dark:border-emerald-700 transition-colors">
              <Hospital className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  عيادات الجمعية الشرعية
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  المنظومة الطبية
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                نظام الحجز الفوري وإدارة العيادات التخصصية
              </p>
            </div>
          </div>

          {/* روابط التنقل المكتبية */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-emerald-900 text-white dark:bg-emerald-700 dark:text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* أدوات النظام والملف الشخصي */}
          <div className="flex items-center gap-2">
            
            {/* زر سجل المرضى للموظفين المخولين */}
            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'reception' || currentUser.role === 'cashier') && (
              <button
                onClick={() => setPatientHistoryModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                title="البحث في سجل زيارات المريض برقم الهاتف"
              >
                <FileSearch className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span className="hidden md:inline">سجل المريض</span>
              </button>
            )}

            {/* زر تبديل الإضاءة */}
            <button
              onClick={toggleTheme}
              aria-label="تبديل المظهر"
              title={theme === 'dark' ? 'التحويل للوضع النهاري' : 'التحويل للوضع الليلي'}
              className="w-9 h-9 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* حالة جلسة الموظف */}
            {currentUser ? (
              <div className="flex items-center gap-2 pl-1 border-r border-slate-200 dark:border-slate-800 pr-2.5">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                    {currentUser.displayName}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold mt-0.5 ${getRoleBadge(currentUser.role).classes}`}>
                    {getRoleBadge(currentUser.role).text}
                  </span>
                </div>
                <button
                  onClick={logout}
                  title="تسجيل الخروج"
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">خروج</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('login')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white border border-slate-800 dark:border-slate-700 transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>دخول الكادر</span>
              </button>
            )}
          </div>
        </div>

        {/* شريط التنقل السفلي للهواتف والشاشات المتوسطة */}
        <div className="flex lg:hidden items-center gap-1 overflow-x-auto py-2 border-t border-slate-100 dark:border-slate-900 no-scrollbar">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-900 text-white dark:bg-emerald-700 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
