import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { toPng } from 'html-to-image';
import { 
  Download, 
  Share2, 
  MapPin, 
  Stethoscope, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  Hospital,
  Loader2,
  Clock
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
          dark: '#0F172A',
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
      <div className="max-w-lg mx-auto text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">لم يتم العثور على تذكرة كشف نشطة</h2>
        <p className="text-xs text-slate-500">يمكنك إصدار تذكرة جديدة لليوم الحالي من صفحة الحجز المباشر.</p>
        <button
          onClick={() => navigate('booking')}
          className="px-5 py-2.5 bg-emerald-900 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs cursor-pointer"
        >
          حجز تذكرة جديدة
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
        message: `تم تنزيل التذكرة (${ticket.ticketNumber}) بصيغة صورة واضحة على جهازك.`
      });
    } catch (err) {
      console.error('خطأ أثناء تحويل التذكرة إلى صورة:', err);
      addToast({
        type: 'error',
        title: 'تعذر حفظ الصورة',
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
        text: `تذكرة كشف عيادات الجمعية الشرعية: ${ticket.ticketNumber} | المريض: ${ticket.patientName} | الدور: #${ticket.queuePosition}`
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      addToast({
        type: 'success',
        title: 'تم النسخ',
        message: 'تم نسخ بيانات التذكرة إلى الحافظة.'
      });
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-16">
      
      {/* شريط التحكم العلوي */}
      <div className="flex items-center justify-between no-print">
        <button
          onClick={() => navigate('landing')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 bg-white dark:bg-slate-900 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للرئيسية</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            <span>{copied ? 'تم النسخ' : 'مشاركة'}</span>
          </button>

          <button
            onClick={handleDownloadImage}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>جاري التنزيل...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>تنزيل التذكرة كصورة</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* إشعار إرشادي أعلى التذكرة */}
      <div className="no-print px-4 py-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span>تم إصدار التذكرة رسمياً — اضغط على <strong>"تنزيل التذكرة كصورة"</strong> للاحتفاظ بها على هاتفك بدون إنترنت.</span>
        </div>
        <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
          {ticket.ticketNumber}
        </span>
      </div>

      {/* وثيقة التذكرة الرسمية (مصممة كمستند طبي مطبوع يعمل بصورة مثالية عند التنزيل) */}
      <div ref={ticketRef} className="rounded-xl overflow-hidden bg-white border border-slate-300 shadow-sm text-slate-900 select-none">
        
        {/* رأس المستند الرسمي */}
        <div className="bg-slate-900 text-white px-6 py-5 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-emerald-800 border border-emerald-700 flex items-center justify-center text-white shrink-0">
              <Hospital className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg leading-tight">
                عيادات الجمعية الشرعية التخصصية
              </h2>
              <p className="text-[11px] text-slate-300 mt-0.5">
                بطاقة حجز ومراجعة كشف طبي • صالحة لليوم المسجل فقط
              </p>
            </div>
          </div>

          <div className="text-left bg-slate-800 border border-slate-700 px-3.5 py-1.5 rounded-lg shrink-0">
            <div className="text-[10px] text-slate-400 font-semibold">كود التذكرة</div>
            <div className="font-mono font-extrabold text-base text-white tracking-wider">
              {ticket.ticketNumber}
            </div>
          </div>
        </div>

        {/* جسم التذكرة المهيكل */}
        <div className="p-6 space-y-5 bg-white">
          
          {/* القسم الرئيسي: العيادة والطبيب + رقم الدور */}
          <div className="grid grid-cols-1 sm:grid-cols-12 border border-slate-200 rounded-lg overflow-hidden">
            <div className="sm:col-span-8 p-4 bg-slate-50/70 space-y-2 border-b sm:border-b-0 sm:border-l border-slate-200">
              <div className="text-[11px] font-bold text-emerald-800 uppercase">
                بيانات العيادة التخصصية
              </div>
              <div className="text-xl font-extrabold text-slate-900">
                {ticket.clinicName}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700 pt-1">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Stethoscope className="w-3.5 h-3.5 text-emerald-800" />
                  <span>{ticket.doctorName}</span>
                </span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>{clinic?.room || 'غرفة الكشف'} • {clinic?.floor || 'الطابق الأول'}</span>
                </span>
              </div>
            </div>

            <div className="sm:col-span-4 p-4 bg-white flex flex-col items-center justify-center text-center">
              <span className="text-[11px] font-bold text-slate-500">رقم الدور بالطابور</span>
              <span className="text-4xl font-black text-slate-900 font-mono tracking-tight my-0.5">
                #{ticket.queuePosition}
              </span>
              <span className="text-[11px] font-semibold text-emerald-800">
                {patientsAhead === 0 ? 'الدور التالي بالعيادة' : `أمامك ${patientsAhead} بالانتظار (~${estimatedWaitMinutes} د)`}
              </span>
            </div>
          </div>

          {/* جدول البيانات الهندسي (Data Grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200 text-xs">
            <div className="p-3 space-y-1">
              <span className="text-[10px] font-semibold text-slate-500 block">اسم المريض</span>
              <span className="font-bold text-slate-900 block truncate">{ticket.patientName}</span>
            </div>

            <div className="p-3 space-y-1">
              <span className="text-[10px] font-semibold text-slate-500 block">رقم الهاتف</span>
              <span className="font-bold text-slate-900 font-mono block" dir="ltr">{maskPhoneNumber(ticket.patientPhone)}</span>
            </div>

            <div className="p-3 space-y-1">
              <span className="text-[10px] font-semibold text-slate-500 block">التاريخ والفترة</span>
              <span className="font-bold text-slate-900 font-mono block">{ticket.date}</span>
              <span className="text-[10px] text-slate-600 block">{ticket.timeSlot}</span>
            </div>

            <div className="p-3 space-y-1">
              <span className="text-[10px] font-semibold text-slate-500 block">قيمة الكشف وحالة السداد</span>
              <span className="font-extrabold text-slate-900 font-mono block">{ticket.fee} ج.م</span>
              <span className={`text-[10px] font-bold block ${
                ticket.paymentStatus === 'paid' || ticket.paymentStatus === 'exempt'
                  ? 'text-emerald-800'
                  : 'text-amber-800'
              }`}>
                {ticket.paymentStatus === 'paid'
                  ? 'مسددة ومؤكدة بالخزينة'
                  : ticket.paymentStatus === 'exempt'
                  ? 'مؤكدة (إعفاء خيري)'
                  : 'تُسدد بالخزينة عند الوصول'}
              </span>
            </div>
          </div>

          {/* مسار خطوات المراجع داخل المركز (الخطوة 1: الخزينة -> الخطوة 2: الاستقبال) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className={`p-3.5 rounded-lg border flex items-start gap-3 ${
              ticket.paymentStatus === 'unpaid'
                ? 'bg-amber-50/60 border-amber-300 text-slate-900'
                : 'bg-emerald-50/50 border-emerald-200 text-slate-900'
            }`}>
              <div className={`w-6 h-6 rounded font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                ticket.paymentStatus === 'unpaid'
                  ? 'bg-amber-700 text-white'
                  : 'bg-emerald-800 text-white'
              }`}>
                {ticket.paymentStatus === 'unpaid' ? '1' : '✓'}
              </div>
              <div className="space-y-0.5">
                <div className="font-bold text-slate-900">
                  الخطوة الأولى: شباك الخزينة (الكاشير)
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {ticket.paymentStatus === 'unpaid'
                    ? `أبرز رمز الـ QR لمسؤول الخزينة فور وصولك لتأكيد التذكرة وسداد الرسوم (${ticket.fee} ج.م) أو الإعفاء.`
                    : 'تم تأكيد وسداد التذكرة بالخزينة بنجاح وإدراجك في طابور الاستقبال.'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 text-slate-900 flex items-start gap-3">
              <div className="w-6 h-6 rounded bg-slate-800 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </div>
              <div className="space-y-0.5">
                <div className="font-bold text-slate-900">
                  الخطوة الثانية: مكتب الاستقبال والعيادة
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  بعد تأكيد الخزينة، أبرز نفس الرمز لمسؤول الاستقبال عند النداء على دورك (<strong>#{ticket.queuePosition}</strong>) للدخول للطبيب.
                </p>
              </div>
            </div>
          </div>

          {/* قسم رمز التحقق الإلكتروني (QR Code) */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/40 flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="space-y-2 text-center sm:text-right">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <ShieldCheck className="w-4 h-4 text-emerald-800 shrink-0" />
                <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                  رمز التحقق الإلكتروني الموحد (QR Code)
                </h4>
              </div>
              <p className="text-xs text-slate-600 max-w-sm leading-relaxed">
                صالح للمسح الضوئي المباشر لدى <strong>شباك الخزينة</strong> ولدى <strong>مكتب الاستقبال</strong>، ويعمل من صورة التذكرة المحفوظة على هاتفك بدون الحاجة للاتصال بالإنترنت.
              </p>
              <div className="inline-flex items-center gap-3 text-[11px] font-bold text-slate-800 bg-white px-3 py-1 rounded border border-slate-200 font-mono">
                <span>التذكرة: {ticket.ticketNumber}</span>
                <span>|</span>
                <span>الدور: #{ticket.queuePosition}</span>
                <span>|</span>
                <span>{ticket.date}</span>
              </div>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-slate-300 shrink-0 flex flex-col items-center">
              {qrDataUrl ? (
                <img 
                  src={qrDataUrl} 
                  alt="QR Code" 
                  className="w-28 h-28 object-contain"
                />
              ) : (
                <div className="w-28 h-28 flex items-center justify-center text-xs text-slate-400">
                  <Clock className="w-4 h-4 animate-spin" />
                </div>
              )}
            </div>
          </div>

        </div>

        {/* شريط التذييل السفلي للوثيقة */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600 font-medium">
          <span>عيادات الجمعية الشرعية التخصصية — وثيقة حجز إلكترونية</span>
          <span className="font-mono">{ticket.id}</span>
        </div>

      </div>
    </div>
  );
};
