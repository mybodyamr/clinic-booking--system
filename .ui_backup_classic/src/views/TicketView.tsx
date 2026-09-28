import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import QRCode from 'qrcode';
import { toPng } from 'html-to-image';
import { 
  Download, 
  Share2, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  MapPin, 
  Stethoscope, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Hospital,
  Loader2,
  Coins
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { maskPhoneNumber } from '../services/storage';

export const TicketView: React.FC = () => {
  const { selectedTicket, bookings, clinics, navigate, addToast } = useApp();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  // ربط التذكرة بأحدث نسخة حية في قائمة الحجوزات مع الاحتفاظ بها كمرجع احتياطي
  const ticket = (selectedTicket && bookings.find(b => b.id === selectedTicket.id)) || selectedTicket || bookings[0];

  useEffect(() => {
    if (ticket) {
      const qrPayload = JSON.stringify({
        id: ticket.id,
        ticket: ticket.ticketNumber,
        clinic: ticket.clinicName,
        patient: ticket.patientName,
        phone: ticket.patientPhone,
        date: ticket.date,
        queuePosition: ticket.queuePosition
      });

      QRCode.toDataURL(qrPayload, {
        width: 220,
        margin: 1,
        color: {
          dark: '#064e3b',
          light: '#ffffff'
        }
      }).then(url => {
        setQrDataUrl(url);
      }).catch(err => {
        console.error('فشل إنشاء رمز QR:', err);
      });
    }
  }, [ticket]);

  if (!ticket) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-4">
        <div className="text-xl font-bold text-slate-800 dark:text-slate-200">لا توجد تذكرة محددة حالياً</div>
        <button
          onClick={() => navigate('booking')}
          className="px-6 py-2.5 bg-emerald-700 text-white rounded-xl font-bold text-sm"
        >
          حجز موعد جديد
        </button>
      </div>
    );
  }

  const clinic = clinics.find(c => c.id === ticket.clinicId);

  const patientsAhead = bookings.filter(b => 
    b.clinicId === ticket.clinicId && 
    b.date === ticket.date && 
    b.status === 'waiting' && 
    (b.paymentStatus === 'paid' || b.paymentStatus === 'exempt') &&
    b.queuePosition < ticket.queuePosition
  ).length;

  const estimatedWaitMinutes = patientsAhead * 15;

  const handleDownloadImage = async () => {
    if (!ticketRef.current) return;
    try {
      setIsDownloading(true);
      const dataUrl = await toPng(ticketRef.current, {
        cacheBust: true,
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `تذكرة-${ticket.ticketNumber}-${ticket.patientName.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
      addToast({
        type: 'success',
        title: 'تم حفظ صورة التذكرة',
        message: `تم تنزيل التذكرة (${ticket.ticketNumber}) كصورة واضحة على جهازك.`
      });
    } catch (err) {
      console.error('خطأ أثناء تحويل التذكرة إلى صورة:', err);
      addToast({
        type: 'error',
        title: 'تعذر حفظ الصورة تلقائياً',
        message: 'يرجى التقاط لقطة شاشة (Screenshot) للتذكرة.'
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `تذكرة كشف - ${ticket.clinicName}`,
        text: `تذكرة كشف عيادات الجمعية الشرعية: ${ticket.ticketNumber} - المريض: ${ticket.patientName} - الدور: #${ticket.queuePosition}`
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      addToast({
        type: 'success',
        title: 'تم النسخ',
        message: 'تم نسخ بيانات التذكرة إلى الحافظة'
      });
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-16">
      
      {/* شريط الإجراءات العلوي (لا يظهر في الصورة المحفوظة) */}
      <div className="flex items-center justify-between no-print">
        <button
          onClick={() => navigate('landing')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-700 bg-white dark:bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للرئيسية</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{copied ? 'تم النسخ!' : 'مشاركة'}</span>
          </button>

          <button
            onClick={handleDownloadImage}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50 cursor-pointer"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                <span>جاري حفظ الصورة...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-amber-300" />
                <span>تنزيل التذكرة كصورة</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* رسالة تأكيد النجاح */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="no-print p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-3 text-emerald-950 dark:text-emerald-200"
      >
        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="text-xs leading-relaxed">
          <strong className="block text-sm font-bold">تم إصدار تذكرة الحجز بنجاح!</strong>
          <span>احتفظ بصورة هذه التذكرة على هاتفك، وتوجه أولاً لشباك الخزينة (الكاشير) عند وصولك للمركز.</span>
        </div>
      </motion.div>

      {/* بطاقة التذكرة الرسمية القابلة للتنزيل كصورة */}
      <motion.div
        ref={ticketRef}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl overflow-hidden bg-white text-slate-900 shadow-2xl border-2 border-emerald-800/20 select-none"
      >
        {/* ترويسة التذكرة */}
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white p-6 relative overflow-hidden">
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-xs border border-white/25 flex items-center justify-center text-amber-300 shadow-md shrink-0">
                <Hospital className="w-7 h-7" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1 text-[11px] text-amber-300 font-bold mb-0.5">
                  <Sparkles className="w-3 h-3" />
                  <span>بطاقة حجز إلكترونية معتمدة</span>
                </div>
                <h2 className="font-extrabold text-lg sm:text-xl text-white leading-tight">
                  عيادات الجمعية الشرعية التخصصية
                </h2>
              </div>
            </div>

            <div className="text-left bg-black/25 backdrop-blur-xs px-3.5 py-2 rounded-2xl border border-white/15 shrink-0">
              <span className="text-[10px] text-emerald-200 block font-semibold">رقم التذكرة</span>
              <span className="font-mono font-black text-base sm:text-lg text-amber-300 tracking-wider">
                {ticket.ticketNumber}
              </span>
            </div>
          </div>
        </div>

        {/* جسم التذكرة */}
        <div className="p-6 space-y-5 bg-white">
          
          {/* العيادة ورقم الدور */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-right">
              <span className="text-[11px] font-bold text-emerald-700 block">العيادة التخصصية والطبيب المعالج</span>
              <h3 className="text-xl font-extrabold text-slate-900">{ticket.clinicName}</h3>
              <div className="text-xs font-bold text-emerald-900 flex items-center justify-center sm:justify-start gap-1.5">
                <Stethoscope className="w-4 h-4 text-emerald-700" />
                <span>{ticket.doctorName}</span>
              </div>
            </div>

            <div className="bg-white px-5 py-3 rounded-2xl border-2 border-emerald-600/30 text-center shadow-2xs shrink-0 min-w-[130px]">
              <span className="text-[11px] font-bold text-slate-500 block">رقم دورك بالطابور</span>
              <span className="text-3xl font-black text-emerald-800 font-mono block my-0.5">
                #{ticket.queuePosition}
              </span>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 inline-block">
                {patientsAhead === 0 ? 'أنت التالي بالدور' : `أمامك ${patientsAhead} بالانتظار`}
              </span>
            </div>
          </div>

          {/* تفاصيل الحجز والمريض */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <div className="text-slate-500 flex items-center gap-1 font-medium">
                <User className="w-3.5 h-3.5 text-emerald-700" />
                <span>اسم المريض:</span>
              </div>
              <div className="font-bold text-slate-900 text-sm truncate">{ticket.patientName}</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <div className="text-slate-500 flex items-center gap-1 font-medium">
                <Phone className="w-3.5 h-3.5 text-emerald-700" />
                <span>رقم الهاتف:</span>
              </div>
              <div className="font-bold text-slate-900 text-sm font-mono" dir="ltr">
                {maskPhoneNumber(ticket.patientPhone)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <div className="text-slate-500 flex items-center gap-1 font-medium">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                <span>التاريخ والموعد:</span>
              </div>
              <div className="font-bold text-slate-900">{ticket.date} ({ticket.timeSlot})</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <div className="text-slate-500 flex items-center gap-1 font-medium">
                <Coins className="w-3.5 h-3.5 text-emerald-700" />
                <span>رسوم الكشف:</span>
              </div>
              <div className="font-bold text-emerald-800">
                {ticket.fee} ج.م ({ticket.paymentStatus === 'paid' ? 'مسددة ✓' : ticket.paymentStatus === 'exempt' ? 'إعفاء خيري ✓' : 'تُسدد بالخزينة'})
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
              <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>موقع العيادة: {clinic?.room || 'غرفة الكشف'} — {clinic?.floor || 'الطابق الأول'}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-500 font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>انتظار متوقع: ~{estimatedWaitMinutes} دقيقة</span>
            </div>
          </div>

          {/* خط فاصل مثقب على شكل تذكرة */}
          <div className="relative py-1 flex items-center">
            <div className="w-full border-t-2 border-dashed border-slate-200"></div>
          </div>

          {/* مسار خطوات المريض (1. الخزينة -> 2. الاستقبال) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className={`p-3 rounded-xl border ${
              ticket.paymentStatus === 'unpaid'
                ? 'bg-amber-50/90 border-amber-300'
                : 'bg-emerald-50/80 border-emerald-200'
            }`}>
              <div className="font-extrabold text-slate-900 mb-1 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[11px] flex items-center justify-center font-bold">1</span>
                <span>أولاً: شباك الخزينة (الكاشير)</span>
              </div>
              <p className="text-[11px] text-slate-700 leading-relaxed">
                {ticket.paymentStatus === 'unpaid'
                  ? 'أبرز هذا الرمز لمسؤول الخزينة فور وصولك لسداد رسوم الكشف وتفعيل دورك.'
                  : 'تم تأكيد وسداد تذكرتك بالخزينة بنجاح ✓'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="font-extrabold text-slate-900 mb-1 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-800 text-white text-[11px] flex items-center justify-center font-bold">2</span>
                <span>ثانياً: مكتب الاستقبال</span>
              </div>
              <p className="text-[11px] text-slate-700 leading-relaxed">
                بعد تأكيد الخزينة، أبرز نفس الرمز لموظف الاستقبال عند النداء على دورك (#{ticket.queuePosition}) للدخول للطبيب.
              </p>
            </div>
          </div>

          {/* منطقة رمز الاستجابة السريعة QR Code */}
          <div className="pt-1 flex flex-col items-center justify-center text-center space-y-2.5">
            <div className="p-3 bg-white rounded-2xl border-2 border-emerald-800/20 shadow-sm inline-block">
              {qrDataUrl ? (
                <img 
                  src={qrDataUrl} 
                  alt="QR Code" 
                  className="w-36 h-36 object-contain mx-auto"
                />
              ) : (
                <div className="w-36 h-36 flex items-center justify-center text-xs text-slate-400">
                  جاري توليد الرمز...
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>رمز التحقق الإلكتروني الموحد (صالح للخزينة والاستقبال بدون إنترنت)</span>
            </div>
          </div>

        </div>

        {/* شريط التذييل السفلي للتذكرة */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <span>عيادات الجمعية الشرعية التخصصية</span>
          <span className="font-mono">{ticket.ticketNumber}</span>
        </div>
      </motion.div>

    </div>
  );
};
