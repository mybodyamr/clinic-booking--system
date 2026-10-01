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
import { trackPatientQueueByPhoneRpc, PatientLiveQueueResult } from '../services/supabaseService';
import heroHospitalImg from '../assets/images/hospital_doctor_hero_1790597353764.jpg';

export const TicketView: React.FC = () => {
  const { selectedTicket, bookings, clinics, navigate, addToast } = useApp();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [liveQueueInfo, setLiveQueueInfo] = useState<PatientLiveQueueResult | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);

  const baseTicket = (selectedTicket && bookings.find(b => b.id === selectedTicket.id)) || selectedTicket || bookings[0];
  const ticket = liveQueueInfo?.booking && liveQueueInfo.booking.id === baseTicket?.id ? liveQueueInfo.booking : baseTicket;

  useEffect(() => {
    let isMounted = true;
    const refreshLiveTicket = async () => {
      if (!baseTicket?.patientPhone) return;
      const results = await trackPatientQueueByPhoneRpc(baseTicket.patientPhone);
      if (!isMounted || !results) return;
      const matched = results.find(r => r.booking.id === baseTicket.id) || results[0] || null;
      if (matched) {
        setLiveQueueInfo(matched);
      }
    };
    refreshLiveTicket();
    const interval = setInterval(refreshLiveTicket, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [baseTicket?.id, baseTicket?.patientPhone]);

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
          dark: '#064E3B',
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
      <div className="max-w-lg mx-auto text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-4 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">لم يتم العثور على تذكرة كشف نشطة</h2>
        <p className="text-xs text-slate-500">يمكنك إصدار تذكرة جديدة لليوم الحالي من صفحة الحجز المباشر.</p>
        <button
          onClick={() => navigate('booking')}
          className="px-5 py-2.5 rounded-xl bg-emerald-900 text-white font-bold text-xs cursor-pointer"
        >
          حجز موعد كشف جديد
        </button>
      </div>
    );
  }

  const clinic = clinics.find(c => c.id === ticket.clinicId);
  
  const paidWaitingInSameClinic = bookings
    .filter(
      b =>
        b.clinicId === ticket.clinicId &&
        b.date === ticket.date &&
        b.status === 'waiting' &&
        (b.paymentStatus === 'paid' || b.paymentStatus === 'exempt')
    )
    .sort((a, b) => {
      const tA = new Date(a.paidAt || a.createdAt || 0).getTime();
      const tB = new Date(b.paidAt || b.createdAt || 0).getTime();
      if (tA !== tB) return tA - tB;
      return (a.queuePosition || 0) - (b.queuePosition || 0);
    });

  const currentInProgress = bookings.find(
    b =>
      b.clinicId === ticket.clinicId &&
      b.date === ticket.date &&
      b.status === 'in-progress' &&
      (b.paymentStatus === 'paid' || b.paymentStatus === 'exempt')
  );

  const isTicketPaid = ticket.paymentStatus === 'paid' || ticket.paymentStatus === 'exempt';
  const myPaidIndex = paidWaitingInSameClinic.findIndex(b => b.id === ticket.id);
  const localPatientsAhead = isTicketPaid
    ? (myPaidIndex >= 0 ? myPaidIndex : paidWaitingInSameClinic.length) +
      (currentInProgress && currentInProgress.id !== ticket.id ? 1 : 0)
    : paidWaitingInSameClinic.length + (currentInProgress ? 1 : 0);

  const patientsAhead =
    liveQueueInfo !== null ? liveQueueInfo.paidWaitingAheadCount : localPatientsAhead;
  const estimatedWaitMinutes = patientsAhead * 12;

  const handleDownloadTicketImage = async () => {
    if (!ticketRef.current || isDownloading) return;
    setIsDownloading(true);
    try {
      const dataUrl = await toPng(ticketRef.current, {
        quality: 1,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = `تذكرة-${ticket.ticketNumber}-${ticket.patientName.replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast({
        type: 'success',
        title: 'تم حفظ التذكرة',
        message: 'تم حفظ صورة التذكرة بجودة عالية بنجاح'
      });
    } catch (err) {
      console.error('فشل حفظ التذكرة كصورة:', err);
      addToast({
        type: 'error',
        title: 'تعذر حفظ الصورة',
        message: 'يرجى أخذ لقطة شاشة (Screenshot) للتذكرة'
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareWhatsApp = () => {
    const shareText = `تذكرة حجز كشف طبي — عيادات الجمعية الشرعية\n` +
      `رقم التذكرة: ${ticket.ticketNumber}\n` +
      `رقم الدور: #${ticket.queuePosition}\n` +
      `المريض: ${ticket.patientName}\n` +
      `العيادة: ${ticket.clinicName}\n` +
      `الطبيب: ${ticket.doctorName}\n` +
      `التاريخ: ${ticket.date} (${ticket.timeSlot})\n` +
      `قيمة الكشف: ${ticket.fee} ج.م`;

    if (navigator.share) {
      navigator.share({
        title: `تذكرة حجز ${ticket.ticketNumber}`,
        text: shareText,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText);
      setCopied(true);
      addToast({
        type: 'info',
        title: 'تم النسخ',
        message: 'تم نسخ تفاصيل التذكرة للحافظة'
      });
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-16">
      
      {/* شريط التحكم العلوي */}
      <div className="no-print bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('landing')}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            title="العودة للرئيسية"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-1.5 font-extrabold text-sm text-slate-900 dark:text-white">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>تم إصدار تذكرة الكشف الإلكترونية بنجاح</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              يرجى حفظ التذكرة كصورة على الهاتف لإبرازها في الخزينة ومكتب الاستقبال
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShareWhatsApp}
            className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copied ? 'تم النسخ' : 'مشاركة'}</span>
          </button>

          <button
            onClick={handleDownloadTicketImage}
            disabled={isDownloading}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            {isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>{isDownloading ? 'جاري الحفظ...' : 'حفظ التذكرة كصورة'}</span>
          </button>
        </div>
      </div>

      {/* وثيقة التذكرة الطبية المعتمدة */}
      <div 
        ref={ticketRef}
        className="bg-white text-slate-900 rounded-2xl border border-slate-300 shadow-lg overflow-hidden"
      >
        
        {/* رأس الوثيقة الرسمي */}
        <div className="relative bg-slate-950 text-white px-6 py-5 overflow-hidden">
          <img
            src={heroHospitalImg}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-slate-950/95 via-emerald-950/90 to-slate-950/90" />

          <div className="relative z-10 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-900/90 border border-emerald-700/70 flex items-center justify-center text-amber-400 shrink-0">
                <Hospital className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-extrabold tracking-tight text-white truncate">
                  عيادات الجمعية الشرعية التخصصية
                </h1>
                <p className="text-[10px] sm:text-[11px] text-slate-300 truncate">
                  بطاقة موعد كشف طبي إلكترونية • صالحة ليوم الحجز
                </p>
              </div>
            </div>

            <div className="text-left bg-white/10 backdrop-blur-md border border-amber-400/40 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl shrink-0">
              <div className="text-[10px] text-amber-300 font-bold">رقم التذكرة</div>
              <div className="font-mono font-extrabold text-lg sm:text-xl text-white tracking-wider">
                {ticket.ticketNumber}
              </div>
            </div>
          </div>
        </div>

        {/* جسم التذكرة */}
        <div className="p-6 space-y-5 bg-white">
          
          {/* العيادة والطبيب + ترتيب الدور */}
          <div className="grid grid-cols-1 sm:grid-cols-12 border border-slate-200 rounded-xl overflow-hidden">
            <div className="sm:col-span-8 p-4 bg-slate-50/70 space-y-2 border-b sm:border-b-0 sm:border-l border-slate-200">
              <div className="text-[11px] font-bold text-emerald-800">
                بيانات العيادة التخصصية
              </div>
              <div className="text-xl font-extrabold text-slate-900">
                {ticket.clinicName}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700 pt-1">
                <span className="inline-flex items-center gap-1.5 font-bold">
                  <Stethoscope className="w-3.5 h-3.5 text-emerald-800" />
                  <span>{ticket.doctorName}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{clinic?.room || 'غرفة الكشف'} • {clinic?.floor || 'الطابق الأول'}</span>
                </span>
              </div>
            </div>

            <div className="sm:col-span-4 p-4 bg-emerald-950 text-white flex flex-col items-center justify-center text-center">
              <span className="text-[11px] font-bold text-amber-300">ترتيب الدور بالطابور</span>
              <span className="text-4xl font-black text-white font-mono tracking-tight my-0.5">
                #{ticket.queuePosition}
              </span>
              <span className="text-[11px] font-medium text-emerald-200">
                {patientsAhead === 0 ? 'الدور التالي بالعيادة' : `أمامك ${patientsAhead} بالانتظار (~${estimatedWaitMinutes} د)`}
              </span>
            </div>
          </div>

          {/* جدول بيانات المراجع والحجز */}
          <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200 text-xs">
            <div className="p-3.5 space-y-1">
              <span className="text-[10px] font-semibold text-slate-500 block">اسم المراجع</span>
              <span className="font-bold text-slate-900 block truncate">{ticket.patientName}</span>
            </div>

            <div className="p-3.5 space-y-1">
              <span className="text-[10px] font-semibold text-slate-500 block">رقم الهاتف</span>
              <span className="font-bold text-slate-900 font-mono block" dir="ltr">{maskPhoneNumber(ticket.patientPhone)}</span>
            </div>

            <div className="p-3.5 space-y-1">
              <span className="text-[10px] font-semibold text-slate-500 block">التاريخ والموعد</span>
              <span className="font-bold text-slate-900 font-mono block">{ticket.date}</span>
              <span className="text-[10px] text-slate-600 block">{ticket.timeSlot}</span>
            </div>

            <div className="p-3.5 space-y-1">
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

          {/* مسار المراجع عند الوصول */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
              ticket.paymentStatus === 'unpaid'
                ? 'bg-amber-50/60 border-amber-200 text-slate-900'
                : 'bg-emerald-50/50 border-emerald-200 text-slate-900'
            }`}>
              <div className={`w-6 h-6 rounded-md font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                ticket.paymentStatus === 'unpaid'
                  ? 'bg-amber-700 text-white'
                  : 'bg-emerald-800 text-white'
              }`}>
                {ticket.paymentStatus === 'unpaid' ? '01' : '✓'}
              </div>
              <div className="space-y-0.5">
                <div className="font-bold text-slate-900">
                  الخطوة الأولى: شباك الخزينة
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {ticket.paymentStatus === 'unpaid'
                    ? `أبرز رمز الـ QR لمسؤول الخزينة فور وصولك لتأكيد التذكرة وسداد الرسوم (${ticket.fee} ج.م).`
                    : 'تم تأكيد وسداد التذكرة بالخزينة وإدراجك في طابور الاستقبال.'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 text-slate-900 flex items-start gap-3">
              <div className="w-6 h-6 rounded-md bg-slate-900 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                02
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
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="space-y-2 text-center sm:text-right">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <ShieldCheck className="w-4 h-4 text-emerald-800 shrink-0" />
                <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                  رمز التحقق الإلكتروني الموحد (QR Code)
                </h4>
              </div>
              <p className="text-xs text-slate-600 max-w-sm leading-relaxed">
                صالح للمسح الضوئي المباشر لدى <strong>شباك الخزينة</strong> ولدى <strong>مكتب الاستقبال</strong>، ويعمل من صورة التذكرة المحفوظة على هاتفك دون الحاجة للاتصال بالإنترنت.
              </p>
              <div className="inline-flex items-center gap-3 text-[11px] font-bold text-slate-800 bg-white px-3 py-1 rounded-lg border border-slate-200 font-mono">
                <span>التذكرة: {ticket.ticketNumber}</span>
                <span>|</span>
                <span>الدور: #{ticket.queuePosition}</span>
                <span>|</span>
                <span>{ticket.date}</span>
              </div>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-slate-300 shrink-0 flex flex-col items-center shadow-2xs">
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
        <div className="px-4 sm:px-6 py-3 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-1 text-[10px] sm:text-[11px] text-slate-600 font-medium text-center sm:text-right">
          <span>مجمع عيادات الجمعية الشرعية التخصصية — وثيقة حجز إلكترونية معتمدة</span>
          <span className="font-mono break-all">{ticket.id}</span>
        </div>

      </div>
    </div>
  );
};
