import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  Calendar, 
  Clock, 
  FileText, 
  Ticket, 
  AlertCircle,
  ExternalLink,
  Stethoscope
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { maskPhoneNumber } from '../services/storage';
import { fetchPatientHistoryByPhoneRpc } from '../services/supabaseService';
import { Booking } from '../types';

export const PatientHistoryModal: React.FC = () => {
  const { 
    patientHistoryModalOpen, 
    setPatientHistoryModalOpen, 
    patientHistoryPhone, 
    setPatientHistoryPhone,
    bookings,
    clinics,
    checkConsultationEligibility,
    navigate,
    setSelectedTicket,
    currentUser
  } = useApp();

  const [searchInput, setSearchInput] = useState(patientHistoryPhone || '');
  const [searched, setSearched] = useState(false);
  const [rpcHistoryBookings, setRpcHistoryBookings] = useState<Booking[] | null>(null);

  React.useEffect(() => {
    if (patientHistoryModalOpen) {
      setSearchInput(patientHistoryPhone || '');
      setRpcHistoryBookings(null);
      setSearched(false);
    }
  }, [patientHistoryModalOpen, patientHistoryPhone]);

  const localMatchingBookings = bookings.filter(b => 
    searchInput.trim() ? b.patientPhone.replace(/\s+/g, '') === searchInput.trim().replace(/\s+/g, '') : false
  );

  const activeConsultationsForPhone = React.useMemo(() => {
    const cleanPhone = searchInput.trim().replace(/\s+/g, '');
    if (!cleanPhone || cleanPhone.length < 8) return [];
    const detectedName = localMatchingBookings[0]?.patientName || rpcHistoryBookings?.[0]?.patientName;
    return clinics
      .map(c => {
        const elig = checkConsultationEligibility(cleanPhone, c.id, detectedName);
        return elig.eligible ? { clinic: c, ...elig } : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [searchInput, clinics, checkConsultationEligibility, localMatchingBookings, rpcHistoryBookings]);

  const patientBookings = React.useMemo(() => {
    if (!rpcHistoryBookings) return localMatchingBookings;
    const map = new Map<string, Booking>();
    for (const b of rpcHistoryBookings) map.set(b.id, b);
    for (const b of localMatchingBookings) {
      if (!map.has(b.id)) map.set(b.id, b);
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [rpcHistoryBookings, localMatchingBookings]);

  if (!patientHistoryModalOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearched(true);
    const cleanPhone = searchInput.trim().replace(/\s+/g, '');
    if (cleanPhone.length >= 10) {
      const rpcRows = await fetchPatientHistoryByPhoneRpc(cleanPhone);
      if (rpcRows) {
        setRpcHistoryBookings(rpcRows);
      }
    } else {
      setRpcHistoryBookings(null);
    }
  };

  const handleOpenTicket = (booking: any) => {
    setSelectedTicket(booking);
    setPatientHistoryModalOpen(false);
    navigate('ticket', booking.id);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* رأس النافذة */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">سجل حجوزات وكشوفات المريض</h3>
                <p className="text-xs text-slate-700 dark:text-slate-300">ابحث برقم الهاتف لاستعراض كافة التذاكر السابقة والحالية</p>
              </div>
            </div>
            <button
              onClick={() => setPatientHistoryModalOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* نموذج البحث */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="tel"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="أدخل رقم هاتف المريض (مثال: 01012345678)..."
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600 dark:focus:ring-emerald-500 font-medium placeholder:text-slate-400"
                  dir="ltr"
                  autoFocus
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm rounded-xl transition-all shadow-xs shrink-0 flex items-center gap-1.5"
              >
                <span>بحث</span>
              </button>
            </form>
          </div>

          {/* محتوى النتائج */}
          <div className="p-5 overflow-y-auto space-y-3 flex-1">
            {!searched && (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30 text-emerald-600" />
                <p className="font-semibold text-sm">أدخل رقم الهاتف واضغط بحث لعرض سجل الحجوزات</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">يمكنك استخدام الرقم التجريبي للتجربة: <span className="font-mono text-emerald-600 dark:text-emerald-400 cursor-pointer font-bold" onClick={() => setSearchInput('01012345678')}>01012345678</span></p>
              </div>
            )}

            {searched && activeConsultationsForPhone.length > 0 && (
              <div className="p-4 rounded-xl bg-teal-50 dark:bg-teal-950/70 border border-teal-300 dark:border-teal-700 space-y-2">
                <div className="flex items-center gap-2 text-teal-900 dark:text-teal-200 font-bold text-xs">
                  <Stethoscope className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>هذا المريض لديه استشارة مجانية سارية حالياً ({activeConsultationsForPhone.length}):</span>
                </div>
                <div className="space-y-1.5">
                  {activeConsultationsForPhone.map(item => (
                    <div
                      key={item.clinic.id}
                      className="px-3 py-2 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-teal-200 dark:border-teal-800 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-bold text-slate-900 dark:text-white">{item.clinic.name}</span>
                      <span className="text-teal-800 dark:text-teal-300 font-semibold">
                        تاريخ الكشف: {item.examDate} • متبقي {item.daysRemaining} يوم
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searched && patientBookings.length === 0 && activeConsultationsForPhone.length === 0 && (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-amber-500 opacity-60" />
                <p className="font-bold text-slate-800 dark:text-slate-200">لا توجد حجوزات أو استشارات سارية مسجلة بهذا الرقم</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">تأكد من كتابة الرقم بشكل صحيح أو قم بإنشاء حجز جديد للعيادة</p>
              </div>
            )}

            {searched && patientBookings.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                  <span>تم العثور على {patientBookings.length} تذكرة مسجلة</span>
                  <span className="font-mono">{maskPhoneNumber(searchInput)}</span>
                </div>

                {patientBookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-emerald-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-800 dark:text-emerald-300 text-sm bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                          {b.ticketNumber}
                        </span>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{b.clinicName}</h4>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          b.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : b.status === 'in-progress'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 animate-pulse'
                            : b.status === 'waiting'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {b.status === 'completed' ? 'تم الكشف' : b.status === 'in-progress' ? 'داخل العيادة' : b.status === 'waiting' ? 'في الانتظار' : 'ملغي'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-700 dark:text-slate-300 flex flex-wrap gap-x-4 gap-y-1 pt-1">
                        <span className="flex items-center gap-1">
                          <span className="text-slate-500 dark:text-slate-400">الطبيب:</span> {b.doctorName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> {b.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> {b.timeSlot}
                        </span>
                        <span className="flex items-center gap-1">
                          <Ticket className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> دور رقم: {b.queuePosition}
                        </span>
                      </div>

                      {b.doctorDiagnosis && (currentUser?.role === 'admin' || currentUser?.role === 'doctor') && (
                        <div className="mt-2 text-xs bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 block mb-0.5">ملاحظات الطبيب والتشخيص:</span>
                          {b.doctorDiagnosis}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleOpenTicket(b)}
                      className="self-end sm:self-center px-3.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 border border-slate-300 dark:border-slate-700 hover:border-emerald-600 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>عرض التذكرة والـ QR</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* تذييل النافذة */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex justify-end">
            <button
              onClick={() => setPatientHistoryModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              إغلاق
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
