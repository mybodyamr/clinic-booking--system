import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Home } from 'lucide-react';
import { clearAppCacheAndReload } from '../services/storage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearAndReload = () => {
    clearAppCacheAndReload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex items-center justify-center p-4 font-sans" dir="rtl">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              تحديث جديد في المنظومة
            </h2>

            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              تم إطلاق تحديث جديد للمنظومة، أو حدث تعارض في الملفات المؤقتة المخزنة بمتصفحك. لا تقلق، بيانات الحجوزات والعيادات محفوظة وآمنة.
            </p>

            <div className="space-y-3">
              <button
                onClick={this.handleClearAndReload}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold transition-all shadow-md hover:shadow-lg cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>تحديث المنظومة وإعادة التحميل</span>
              </button>

              <button
                onClick={this.handleReload}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-750 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium text-sm transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>إعادة المحاولة السريعة</span>
              </button>
            </div>

            {this.state.error && (
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700/60 text-left dir-ltr">
                <details className="text-[11px] text-slate-400 cursor-pointer">
                  <summary className="hover:text-slate-600 dark:hover:text-slate-300">تفاصيل فنية (Technical Details)</summary>
                  <pre className="mt-2 p-2 bg-slate-100 dark:bg-slate-950 rounded text-slate-600 dark:text-slate-400 overflow-x-auto">
                    {this.state.error.message}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
