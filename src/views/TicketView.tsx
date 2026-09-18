import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import QRCode from 'qrcode';
import { toPng } from 'html-to-image';
import { 
  Download, 
  Share2, 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Stethoscope, 
  CheckCircle2, 
  Sparkles, 
  Hourglass,
  ArrowRight,
  ShieldCheck,
  Hospital,
  Loader2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { maskPhoneNumber } from '../services/storage';

export const TicketView: React.FC = () => {
  const { selectedTicket, bookings, clinics, navigate, addToast } = useApp();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  // إذا لم يتم تحديد تذكرة، نأخذ أحدث تذكرة مسجلة
  const ticket = selectedTicket || bookings[0];

  useEffect(() => {
    if (ticket) {
      // توليد رمز QR يحتوي على تفاصيل التذكرة للتحقق عند الاستقبال
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
        width: 240,
        margin: 1,
        color: {
          dark: '#0F5B46',
          light: '#FFFFFF'
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
      <div className="text-center py-20 space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">لم يتم العثور على تذكرة كشف</h2>
        <button
          onClick={() => navigate('booking')}
          className="px-6 py-2.5 bg-emerald-700 text-white rounded-xl font-bold text-sm cursor-pointer"
        >
          حجز تذكرة جديدة الآن
        </button>
      </div>
    );
  }

  const clinic = clinics.find(c => c.id === ticket.clinicId);

  // حساب كم شخص قبله في الانتظار بالعيادة اليوم
  const patientsAhead = bookings.filter(b => 
    b.clinicId === ticket.clinicId && 
    b.date === ticket.date && 
    b.status === 'waiting' && 
    (b.paymentStatus === 'paid' || b.paymentStatus === 'exempt') &&
    b.queuePosition < ticket.queuePosition
  ).length;

  const estimatedWaitMinutes = patientsAhead * 15;

  // تنزيل التذكرة كصورة PNG عالية الدقة عبر html-to-image
  const handleDownloadImage = async () => {
    if (!ticketRef.current) return;
    try {
      setIsDownloading(true);
      const dataUrl = await toPng(ticketRef.current, {
        cacheBust: true,
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `تذكرة-${ticket.ticketNumber}-${ticket.patientName.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
      addToast({
        type: 'success',
        title: 'تم تنزيل التذكرة كصورة',
        message: `تم حفظ تذكرة ${ticket.ticketNumber} بنجاح في ملفات جهازك.`
      });
    } catch (err) {
      console.error('خطأ أثناء تحويل التذكرة إلى صورة:', err);
      addToast({
        type: 'error',
        title: 'فشل التنزيل',
        message: 'تعذر تنزيل الصورة، يرجى التقاط لقطة شاشة للشاشة.'
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `تذكرة كشف - ${ticket.clinicName}`,
        text: `تذكرة كشف بالجمعية الشرعية: ${ticket.ticketNumber} - مريض: ${ticket.patientName} - دور رقم: ${ticket.queuePosition}`
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      addToast({
        type: 'success',
        title: 'تم نسخ الرابط',
        message: 'تم نسخ رابط التذكرة إلى الحافظة بنجاح.'
      });
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-16">
      
      {/* شريط الإجراءات والعودة */}
      <div className="flex items-center justify-between no-print">
        <button
          onClick={() => navigate('landing')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 bg-white dark:bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors shadow-xs cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>الرئيسية</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-xs cursor-pointer"
            title="مشاركة التذكرة"
          >
            <Share2 className="w-4 h-4 text-emerald-600" />
            <span>{copied ? 'تم النسخ!' : 'مشاركة'}</span>
          </button>

          {/* زر تنزيل التذكرة كصورة بدلاً من الطباعة التقليدية */}
          <button
            onClick={handleDownloadImage}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>تنزيل التذكرة كصورة</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* تنبيه لحظي سار للمريض */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="no-print p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200"
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
          <span>تم تسجيل حجزك بنجاح! احتفظ بالتذكرة بالضغط على "تنزيل التذكرة كصورة".</span>
        </div>
        <div className="font-bold font-mono bg-emerald-200/60 dark:bg-emerald-900 px-2 py-0.5 rounded-md">
          {ticket.ticketNumber}
        </div>
      </motion.div>

      {/* تصميم التذكرة المخصص مع ref للتنزيل كصورة */}
      <div ref={ticketRef} className="rounded-3xl overflow-hidden bg-white shadow-xl border border-slate-200 select-none">
        
        {/* شريط الرأس الطبي الفاخر */}
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-950 text-white p-6 relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-800 border border-emerald-600 flex items-center justify-center text-amber-400 shadow-inner">
                <Hospital className="w-7 h-7" />
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight tracking-tight">عيادات الجمعية الشرعية التخصصية</h2>
                <p className="text-xs text-emerald-200 font-medium mt-0.5">تذكرة مراجعة كشف طبي معتمدة</p>
              </div>
            </div>

            <div className="text-left">
              <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">حالة الكشف</div>
              <span className={`inline-block mt-0.5 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                ticket.status === 'completed'
                  ? 'bg-emerald-500 text-white'
                  : ticket.status === 'in-progress'
                  ? 'bg-blue-500 text-white'
                  : ticket.status === 'late'
                  ? 'bg-rose-500 text-white'
                  : ticket.status === 'waiting'
                  ? 'bg-amber-400 text-amber-950'
                  : 'bg-slate-500 text-white'
              }`}>
                {ticket.status === 'completed' 
                  ? 'تم الكشف' 
                  : ticket.status === 'in-progress' 
                  ? 'داخل الكشف' 
                  : ticket.status === 'late'
                  ? 'متأخر عن الحضور'
                  : ticket.status === 'waiting' 
                  ? 'في قائمة الانتظار' 
                  : 'ملغي'}
              </span>
            </div>
          </div>
        </div>

        {/* جسم التذكرة الأساسي */}
        <div className="p-6 sm:p-8 space-y-6 text-slate-800">
          
          {/* قسم رقم الدور والعيادة المركزية */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
            <div>
              <div className="text-xs font-semibold text-slate-500">العيادة التخصصية:</div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">
                {ticket.clinicName}
              </div>
              <div className="text-xs text-slate-600 flex items-center justify-center sm:justify-start gap-1.5 mt-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>{clinic?.room || 'غرفة العيادة'} • {clinic?.floor || 'الطابق الأول'}</span>
              </div>
            </div>

            <div className="bg-white px-6 py-3 rounded-2xl border-2 border-emerald-600 shadow-xs flex flex-col items-center">
              <span className="text-[11px] font-bold text-slate-500">رقم الدور في الطابور</span>
              <span className="text-3xl font-extrabold text-emerald-700 font-mono tracking-wider">
                {ticket.queuePosition}
              </span>
              <span className="text-[10px] font-semibold text-emerald-800 mt-0.5">
                كود التذكرة: {ticket.ticketNumber}
              </span>
            </div>
          </div>

          {/* مؤشر حالة الانتظار التفاعلي */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Hourglass className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                {patientsAhead === 0 ? (
                  <span className="font-bold">أنت المريض التالي مباشرة في قائمة الانتظار!</span>
                ) : (
                  <span>أمامك <strong>{patientsAhead}</strong> مرضى مؤكدين في قائمة الانتظار حالياً</span>
                )}
              </div>
            </div>
            <div className="font-semibold text-amber-800">
              الوقت التقديري: {estimatedWaitMinutes > 0 ? `~${estimatedWaitMinutes} دقيقة` : 'جاهز للدخول'}
            </div>
          </div>

          {/* تفاصيل التذكرة والمريض */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border-y border-dashed border-slate-200 py-5">
            <div className="space-y-1">
              <span className="text-slate-500 font-semibold block">اسم المريض:</span>
              <span className="font-bold text-slate-900 text-sm">{ticket.patientName}</span>
            </div>

            <div className="space-y-1">
              <span className="text-slate-500 font-semibold block">رقم الهاتف المسجل:</span>
              <span className="font-bold text-slate-900 font-mono text-sm">{maskPhoneNumber(ticket.patientPhone)}</span>
            </div>

            <div className="space-y-1">
              <span className="text-slate-500 font-semibold block">الطبيب المعالج:</span>
              <span className="font-bold text-slate-900">{ticket.doctorName}</span>
            </div>

            <div className="space-y-1">
              <span className="text-slate-500 font-semibold block">موعد الحضور:</span>
              <span className="font-bold text-slate-900">{ticket.date} ({ticket.timeSlot})</span>
            </div>

            <div className="space-y-1">
              <span className="text-slate-500 font-semibold block">رسوم الكشف:</span>
              <span className="font-bold text-emerald-800">{ticket.fee} ج.م</span>
            </div>

            <div className="space-y-1">
              <span className="text-slate-500 font-semibold block">حالة السداد بالخزينة:</span>
              <span className={`font-bold ${
                ticket.paymentStatus === 'paid' 
                  ? 'text-emerald-700' 
                  : ticket.paymentStatus === 'exempt'
                  ? 'text-blue-700'
                  : 'text-amber-700'
              }`}>
                {ticket.paymentStatus === 'paid' 
                  ? 'تم التأكيد والسداد بالخزينة' 
                  : ticket.paymentStatus === 'exempt' 
                  ? 'معفى خيري' 
                  : 'بانتظار السداد (يرجى مراجعة الخزينة فور الوصول)'}
              </span>
            </div>
          </div>

          {/* رمز الاستجابة السريعة QR Code للتحقق السريع في الاستقبال */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-2">
            <div className="space-y-2 text-center sm:text-right">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-sm text-slate-900">رمز التحقق الإلكتروني (QR)</h4>
              </div>
              <p className="text-xs text-slate-600 max-w-xs leading-relaxed">
                أبرز هذا الرمز لمسؤول الاستقبال عند الوصول للعيادة ليتم مسحه وتأكيد حضورك ودخولك فوراً.
              </p>
              <div className="text-[11px] text-slate-500 font-mono">
                رقم التذكرة: {ticket.ticketNumber}
              </div>
            </div>

            <div className="p-3 bg-white rounded-2xl border-2 border-emerald-600/30 shadow-md shrink-0">
              {qrDataUrl ? (
                <img 
                  src={qrDataUrl} 
                  alt={`QR Code for Ticket ${ticket.ticketNumber}`}
                  className="w-36 h-36 object-contain"
                />
              ) : (
                <div className="w-36 h-36 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                  جاري توليد الرمز...
                </div>
              )}
            </div>
          </div>

        </div>

        {/* تخريم التذكرة والحد السفلي */}
        <div className="relative h-7 bg-slate-100 border-t border-dashed border-slate-300 flex items-center justify-between px-4 text-[10px] text-slate-500 font-medium">
          <span>عيادات الجمعية الشرعية — رعاية طبية وتكافل اجتماعي</span>
          <span>نتمنى لكم دوام الصحة والعافية</span>
        </div>
      </div>

      {/* روابط سريعة للمريض */}
      <div className="text-center pt-2 space-y-2 no-print">
        <button
          onClick={() => navigate('booking')}
          className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
        >
          + حجز كشف في عيادة أخرى
        </button>
      </div>

    </div>
  );
};
