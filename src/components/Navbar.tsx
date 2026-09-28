import React from 'react';
import { 
  Hospital, 
  CalendarPlus, 
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

  // عناصر التنقل: للزوار لا يتم تكرار أزرار (الرئيسية / حجز موعد كشف) لأنها موجودة بالفعل في الشعار وبطل الصفحة الرئيسية
  // وللموظفين يظهر لكل موظف تبويب القسم الخاص به فقط مع الرئيسية
  const getNavItems = (): { id: AppView; label: string; icon: React.ReactNode }[] => {
    if (!currentUser) {
      return [];
    }

    if (currentUser.role === 'doctor') {
      return [
        { id: 'landing', label: 'الرئيسية', icon: <Hospital className="w-4 h-4" /> },
        { id: 'doctor', label: 'بوابة الطبيب', icon: <Stethoscope className="w-4 h-4" /> }
      ];
    }

    if (currentUser.role === 'reception') {
      return [
        { id: 'landing', label: 'الرئيسية', icon: <Hospital className="w-4 h-4" /> },
        { id: 'reception', label: 'مكتب الاستقبال', icon: <UserCheck className="w-4 h-4" /> }
      ];
    }

    if (currentUser.role === 'cashier') {
      return [
        { id: 'landing', label: 'الرئيسية', icon: <Hospital className="w-4 h-4" /> },
        { id: 'cashier', label: 'الخزينة والتحصيل', icon: <Receipt className="w-4 h-4" /> }
      ];
    }

    // مدير النظام (admin)
    return [
      { id: 'landing', label: 'الرئيسية', icon: <Hospital className="w-4 h-4" /> },
      { id: 'admin', label: 'الإدارة والتقارير', icon: <Settings className="w-4 h-4" /> },
      { id: 'reception', label: 'مكتب الاستقبال', icon: <UserCheck className="w-4 h-4" /> },
      { id: 'cashier', label: 'الخزينة والتحصيل', icon: <Receipt className="w-4 h-4" /> },
      { id: 'doctor', label: 'بوابة الطبيب', icon: <Stethoscope className="w-4 h-4" /> }
    ];
  };

  const navItems = getNavItems();

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return { text: 'مدير النظام', classes: 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-amber-400/20 dark:text-amber-300 dark:border-amber-400/40' };
      case 'doctor':
        return { text: 'طبيب استشاري', classes: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40' };
      case 'reception':
        return { text: 'مسؤول استقبال', classes: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-white/10 dark:text-slate-200 dark:border-white/20' };
      case 'cashier':
        return { text: 'مسؤول خزينة', classes: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40' };
      default:
        return { text: 'موظف', classes: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/20' };
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#050F0C]/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/10 shadow-2xs transition-colors duration-300 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-[72px] gap-4">
          
          {/* الهوية البصرية للمركز الطبي */}
          <div 
            onClick={() => navigate('landing')}
            className="flex items-center gap-3.5 cursor-pointer group shrink-0"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-900 dark:bg-gradient-to-br dark:from-emerald-900 dark:via-emerald-950 dark:to-slate-950 flex items-center justify-center text-amber-300 dark:text-amber-400 shadow-xs border border-emerald-800/60 group-hover:border-amber-400/60 transition-all">
              <Hospital className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight group-hover:text-emerald-800 dark:group-hover:text-amber-300 transition-colors">
                  عيادات الجمعية الشرعية
                </h1>
                <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-white/10 text-emerald-800 dark:text-amber-300 border border-emerald-200/70 dark:border-white/15">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
                  <span>العيادات التخصصية</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                منظومة الحجز الإلكتروني وإدارة العيادات
              </p>
            </div>
          </div>

          {/* شريط التنقل الرئيسي (يظهر للموظفين المسجلين للتنقل بين بواباتهم دون تكرار للزوار) */}
          {navItems.length > 0 && (
            <nav className="hidden md:flex items-center gap-1.5 bg-slate-100/90 dark:bg-white/[0.06] p-1.5 rounded-2xl border border-slate-200/70 dark:border-white/10">
              {navItems.map((item) => {
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-emerald-900 text-white dark:bg-amber-400 dark:text-slate-950 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-white/10'
                    }`}
                  >
                    <span className={isActive ? 'text-amber-300 dark:text-slate-950' : 'text-emerald-800 dark:text-amber-400'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* أدوات التحكم وحساب الموظف */}
          <div className="flex items-center gap-2">
            
            {currentUser && currentUser.role === 'admin' && (
              <button
                onClick={() => setPatientHistoryModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white border border-slate-200 dark:border-white/15 hover:bg-slate-200/70 dark:hover:bg-white/15 transition-colors cursor-pointer"
                title="البحث في سجل وتذاكر المريض برقم الهاتف"
              >
                <FileSearch className="w-4 h-4 text-emerald-800 dark:text-amber-400" />
                <span className="hidden lg:inline">سجل المريض</span>
              </button>
            )}

            {/* زر التبديل بين الوضع النهاري والليلي */}
            <button
              onClick={toggleTheme}
              aria-label="تبديل المظهر"
              title={theme === 'dark' ? 'تفعيل الوضع النهاري الكلاسيكي' : 'تفعيل الوضع الليلي الفخم'}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0 text-xs font-bold"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">نهاري</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-emerald-800" />
                  <span className="hidden sm:inline">ليلي</span>
                </>
              )}
            </button>

            {currentUser ? (
              <div className="flex items-center gap-2 pl-1 border-r border-slate-200 dark:border-white/15 pr-2.5">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                    {currentUser.displayName}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold mt-0.5 ${getRoleBadge(currentUser.role).classes}`}>
                    {getRoleBadge(currentUser.role).text}
                  </span>
                </div>
                <button
                  onClick={logout}
                  title="تسجيل الخروج"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-xs font-bold transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">خروج</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('login')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 dark:bg-white/10 dark:hover:bg-white/15 text-white text-xs font-bold border border-emerald-900 dark:border-white/15 transition-colors cursor-pointer shrink-0"
              >
                <LogIn className="w-3.5 h-3.5 text-amber-300 dark:text-amber-400" />
                <span>دخول الموظفين</span>
              </button>
            )}
          </div>

        </div>

        {/* شريط التنقل السفلي للشاشات الصغيرة (يظهر للموظفين فقط دون تكرار للزوار) */}
        {navItems.length > 0 && (
          <div className="flex md:hidden items-center gap-1.5 overflow-x-auto py-2.5 border-t border-slate-100 dark:border-white/10 no-scrollbar">
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-emerald-900 text-white dark:bg-amber-400 dark:text-slate-950'
                      : 'text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/10'
                  }`}
                >
                  <span className={isActive ? 'text-amber-300 dark:text-slate-950' : 'text-emerald-800 dark:text-amber-400'}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
};
