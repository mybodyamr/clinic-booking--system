import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  hashPassword,
  getDeletedClinicIds,
  getDeletedDoctorIds,
  getDeletedBookingIds,
  markClinicDeletedLocally,
  unmarkClinicDeletedLocally,
  markDoctorDeletedLocally,
  unmarkDoctorDeletedLocally,
  markBookingDeletedLocally
} from './storage';
import { 
  Clinic, 
  Doctor, 
  Booking, 
  StaffAccount, 
  DailyScheduleState, 
  DailyClinicScheduleItem, 
  UserSession,
  DoctorStatus,
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
  UserRole,
  SystemErrorLog
} from '../types';

// ==========================================
// Mappers: Database Rows -> TypeScript Types
// ==========================================

export function mapDbClinic(row: any): Clinic {
  return {
    id: row.id,
    name: row.name,
    iconName: row.icon_name || 'Stethoscope',
    specialty: row.specialty,
    department: row.department,
    description: row.description,
    fee: Number(row.price || 50),
    room: row.room_number || '',
    floor: row.floor || '',
    active: row.is_open_today ?? true,
    isActive: row.is_open_today ?? true,
    isOpenToday: row.is_open_today ?? true,
    workingDays: row.working_days || [],
    workingHours: row.working_hours || ''
  };
}

export function mapDbDoctor(row: any): Doctor {
  const rawStatus = (row.status as DoctorStatus) || 'available';
  const effectiveStatus: DoctorStatus = row.is_present_today === false ? 'offline' : rawStatus;
  return {
    id: row.id,
    name: row.name,
    clinicId: row.clinic_id || '',
    clinicName: row.clinic_name || '',
    title: row.title || 'أخصائي',
    scheduleDays: row.schedule_days || [],
    scheduleHours: row.schedule_hours || '',
    status: effectiveStatus,
    unavailableReason: row.unavailable_reason || undefined,
    maxDailyBookings: Number(row.max_daily_patients || 30),
    currentQueueNumber: Number(row.current_queue_number || 0),
    phone: row.phone || '',
    bio: row.bio || ''
  };
}

export function mapDbBooking(row: any): Booking {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    patientName: row.patient_name,
    patientPhone: row.patient_phone,
    clinicId: row.clinic_id,
    clinicName: row.clinic_name,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    date: typeof row.date === 'string' ? row.date.split('T')[0] : row.date,
    timeSlot: row.time_slot,
    queuePosition: Number(row.queue_position || 1),
    status: row.status as BookingStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    paymentMethod: row.payment_method as PaymentMethod | undefined,
    fee: Number(row.fee || 0),
    notes: row.notes || undefined,
    doctorDiagnosis: row.doctor_diagnosis || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    calledAt: row.called_at || undefined,
    completedAt: row.completed_at || undefined,
    paidAt: row.paid_at || undefined
  };
}

export function mapDbStaff(row: any): StaffAccount {
  return {
    id: row.id,
    authUserId: row.auth_user_id || row.authUserId || undefined,
    username: row.username,
    displayName: row.display_name || row.displayName,
    role: row.role as UserRole,
    doctorId: row.doctor_id || row.doctorId || undefined,
    clinicId: row.clinic_id || row.clinicId || undefined,
    recoveryEmail: row.recovery_email || row.recoveryEmail || undefined
  };
}

const SAFE_ENTITY_ID_REGEX = /^[a-zA-Z0-9_.-]{2,80}$/;

function isValidEntityId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    SAFE_ENTITY_ID_REGEX.test(id.trim()) &&
    !id.includes('..')
  );
}

function getCurrentStoredSession(): UserSession | null {
  try {
    const raw =
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('sharaya_session_v2')) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('sharaya_session_v2'));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function ensureActiveSupabaseSession(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      return true;
    }
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    return Boolean(!refreshErr && refreshed?.session?.access_token);
  } catch {
    return false;
  }
}

export async function ensureAdminSupabaseSession(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    // لا يتم تفعيل أو تحديث الجلسة الإدارية إذا كان المستخدم الحالي مسجلاً بدور آخر غير admin
    const parsedSession = getCurrentStoredSession();
    if (parsedSession?.role && parsedSession.role !== 'admin') {
      return false;
    }

    return await ensureActiveSupabaseSession();
  } catch {
    return false;
  }
}

export async function getAdminBearerToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    // 1. قراءة الجلسة الحالية أولاً مباشرة
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      return data.session.access_token;
    }

    // 2. لا تُستدعى ensureAdminSupabaseSession إلا عند عدم وجود جلسة حالية، ثم يُعاد التحقق من الجلسة
    const ensured = await ensureAdminSupabaseSession();
    if (!ensured) return null;

    const { data: rechecked } = await supabase.auth.getSession();
    return rechecked?.session?.access_token || null;
  } catch {
    return null;
  }
}

// ==========================================
// Data Fetching & Operations
// ==========================================

export async function fetchClinicsFromDb(): Promise<Clinic[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const deletedIds = getDeletedClinicIds();
    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    return (data || [])
      .filter(
        (row: any) =>
          !String(row.id || '').startsWith('_system') &&
          row.description !== '__DELETED_CLINIC__' &&
          !deletedIds.has(String(row.id))
      )
      .map(mapDbClinic);
  } catch (err) {
    console.warn('Could not fetch clinics from Supabase, using local data fallback:', err);
    return null;
  }
}

export async function fetchDoctorsFromDb(): Promise<Doctor[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const deletedIds = getDeletedDoctorIds();
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    return (data || [])
      .filter((row: any) => row.bio !== '__DELETED_DOCTOR__' && !deletedIds.has(String(row.id)))
      .map(mapDbDoctor);
  } catch (err) {
    console.warn('Could not fetch doctors from Supabase, using local data fallback:', err);
    return null;
  }
}

export async function fetchBookingsFromDb(): Promise<Booking[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    // قراءة الجلسة المحلية الحالية للتحقق من الدور
    let storedRole: string | undefined;
    try {
      const storedSessionRaw =
        (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('sharaya_session_v2')) ||
        (typeof localStorage !== 'undefined' && localStorage.getItem('sharaya_session_v2'));
      if (storedSessionRaw) {
        storedRole = JSON.parse(storedSessionRaw)?.role;
      }
    } catch {}

    // شاشة الطبيب مسؤولة عن الحضور والجدول الأسبوعي فقط ولا تستدعي جدول الحجوزات
    if (storedRole === 'doctor') {
      return null;
    }

    // إذا كانت الجلسة المحلية لمدير النظام فقط، نضمن جلسة الأدمن السحابية، وللموظفين الآخرين نضمن تحديث جلستهم النشطة
    if (storedRole === 'admin') {
      await ensureAdminSupabaseSession();
    } else if (storedRole === 'reception' || storedRole === 'cashier') {
      await ensureActiveSupabaseSession();
    }

    const deletedBookingIds = getDeletedBookingIds();
    const { data: sessionData } = await supabase.auth.getSession();
    const hasAuthSession = Boolean(sessionData?.session?.user);

    // إذا كان الزائر غير مسجل الدخول (anon)، نستخدم العرض العام الآمن لشاشة الانتظار بدلاً من جدول الحجوزات المباشر
    if (!hasAuthSession) {
      const { data: pubData, error: pubError } = await supabase
        .from('public_queue_display')
        .select('*');
      if (!pubError && pubData) {
        return pubData
          .filter((row: any) => !deletedBookingIds.has(String(row.id)))
          .map((row: any) => ({
          id: row.id,
          ticketNumber: row.ticket_number,
          patientName: row.patient_display_name || 'مريض',
          patientPhone: '',
          clinicId: row.clinic_id,
          clinicName: row.clinic_name,
          doctorId: row.doctor_id || '',
          doctorName: row.doctor_name,
          date: typeof row.date === 'string' ? row.date.split('T')[0] : row.date,
          timeSlot: '',
          queuePosition: Number(row.queue_position) || 1,
          status: (row.status as BookingStatus) || 'waiting',
          paymentStatus: 'paid',
          fee: 0,
          createdAt: row.called_at || new Date().toISOString(),
          calledAt: row.called_at || undefined,
          paidAt: row.paid_at || undefined
        }));
      }
      // في حال لم يكن الـ View منشأً بعد في قاعدة البيانات، نرجع الحقول الآمنة فقط لشاشة الانتظار
      const { data: fallbackRows, error: fallbackErr } = await supabase
        .from('bookings')
        .select('id, ticket_number, patient_name, clinic_id, clinic_name, doctor_id, doctor_name, date, queue_position, status, called_at, paid_at, notes')
        .neq('status', 'cancelled')
        .order('queue_position', { ascending: true });
      if (fallbackErr || !fallbackRows) return null;
      return fallbackRows
        .filter((row: any) => row.notes !== '__PURGED_PAST_BOOKING__' && !deletedBookingIds.has(String(row.id)))
        .map((row: any) => {
          const parts = String(row.patient_name || '').trim().split(/\s+/).filter(Boolean);
          const maskedName =
            parts.length >= 2 ? `${parts[0]} ${parts[1].charAt(0)}.` : parts[0] || 'مريض';
          return {
            id: row.id,
            ticketNumber: row.ticket_number,
            patientName: maskedName,
            patientPhone: '',
            clinicId: row.clinic_id,
            clinicName: row.clinic_name,
            doctorId: row.doctor_id || '',
            doctorName: row.doctor_name,
            date: typeof row.date === 'string' ? row.date.split('T')[0] : row.date,
            timeSlot: '',
            queuePosition: Number(row.queue_position) || 1,
            status: (row.status as BookingStatus) || 'waiting',
            paymentStatus: 'paid',
            fee: 0,
            createdAt: row.called_at || new Date().toISOString(),
            calledAt: row.called_at || undefined,
            paidAt: row.paid_at || undefined
          };
        });
    }

    // 1. قراءة تاريخ القطع المخزن سحابياً إن وجد
    let cloudCutoff = '';
    try {
      const { data: cutoffSetting } = await supabase
        .from('clinics')
        .select('description')
        .eq('id', '_system_bookings_cutoff_date')
        .maybeSingle();
      if (cutoffSetting?.description) {
        cloudCutoff = cutoffSetting.description.trim();
      }
    } catch {}

    // قراءة تاريخ القطع المحلي كاحتياط
    let localCutoff = '';
    if (typeof localStorage !== 'undefined') {
      try {
        localCutoff = localStorage.getItem('sharaya_bookings_cutoff_v2') || '';
      } catch {}
    }

    const effectiveCutoff = cloudCutoff || localCutoff;

    // استعلام الحجوزات حسب صلاحية RLS للدور المسجل حالياً مع استبعاد الحجوزات الموسومة بالحذف
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .or('notes.is.null,notes.neq.__PURGED_PAST_BOOKING__')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const validRows = (data || []).filter((row: any) => {
      if (deletedBookingIds.has(String(row.id))) return false;
      if (row.notes === '__PURGED_PAST_BOOKING__') return false;
      if (effectiveCutoff && row.date < effectiveCutoff) return false;
      return true;
    });

    return validRows.map(mapDbBooking);
  } catch (err) {
    console.warn('Could not fetch bookings from Supabase, using local data fallback:', err);
    return null;
  }
}

export async function fetchDailyScheduleFromDb(dateStr: string): Promise<DailyScheduleState | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('daily_schedule')
      .select('*')
      .eq('date', dateStr);
    if (error) throw error;
    
    const items: DailyClinicScheduleItem[] = (data || []).map((row: any) => ({
      clinicId: row.clinic_id,
      doctorId: row.doctor_id || '',
      isOpen: Boolean(row.is_open)
    }));

    return {
      date: dateStr,
      items
    };
  } catch (err) {
    console.warn('Could not fetch daily schedule from Supabase, using local data fallback:', err);
    return null;
  }
}

export async function fetchStaffAccountsFromDb(): Promise<StaffAccount[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const token = await getAdminBearerToken();
    if (token) {
      try {
        const res = await fetch('/api/admin/staff', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const payload = await res.json();
          if (payload?.ok && Array.isArray(payload.staff)) {
            return payload.staff.map(mapDbStaff);
          }
        }
      } catch {
        // fallback below
      }
    }

    const { data, error } = await supabase
      .from('staff_accounts')
      .select('*')
      .order('id', { ascending: true });

    if (!error && data) {
      return data.map(mapDbStaff);
    }

    const { data: safeData, error: safeErr } = await supabase
      .from('staff_accounts')
      .select('id, auth_user_id, username, display_name, role, doctor_id, clinic_id, created_at')
      .order('id', { ascending: true });
    if (safeErr) throw safeErr;
    return (safeData || []).map(mapDbStaff);
  } catch (err) {
    console.warn('Could not fetch staff accounts from Supabase, using local data fallback:', err);
    return null;
  }
}

// ==========================================
// RPC Functions (طِبقاً لـ supabase_schema.sql)
// ==========================================

export async function createPublicBookingRpc(params: {
  clinicId: string;
  doctorId: string;
  patientName: string;
  patientPhone: string;
  timeSlot?: string;
  notes?: string;
}): Promise<{ success: boolean; data?: Booking; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase غير مهيأ' };
  }
  if (!isValidEntityId(params.clinicId) || !isValidEntityId(params.doctorId)) {
    return { success: false, error: 'معرف العيادة أو الطبيب غير صالح' };
  }
  try {
    const { data, error } = await supabase.rpc('create_public_booking', {
      p_clinic_id: params.clinicId.trim(),
      p_doctor_id: params.doctorId.trim(),
      p_patient_name: params.patientName,
      p_patient_phone: params.patientPhone,
      p_time_slot: params.timeSlot || '10:00 ص - 10:30 ص',
      p_notes: params.notes || null
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: mapDbBooking(data) };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ أثناء حجز التذكرة' };
  }
}

export async function confirmPaymentRpc(
  bookingId: string, 
  paymentType: PaymentMethod
): Promise<{ success: boolean; data?: Booking; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase غير مهيأ' };
  }
  if (!isValidEntityId(bookingId)) {
    return { success: false, error: 'معرف الحجز غير صالح' };
  }
  try {
    await ensureActiveSupabaseSession();
    const { data, error } = await supabase.rpc('confirm_payment', {
      p_booking_id: bookingId.trim(),
      p_payment_type: paymentType
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: mapDbBooking(data) };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل تأكيد الدفع' };
  }
}

export async function fetchPatientHistoryByPhoneRpc(
  patientPhone: string
): Promise<Booking[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    await ensureActiveSupabaseSession();
    const { data, error } = await supabase.rpc('get_patient_history_by_phone', {
      p_patient_phone: patientPhone
    });
    if (error) throw error;
    if (!Array.isArray(data)) return [];
    return data.map(mapDbBooking);
  } catch (err) {
    console.warn('Could not fetch patient history via RPC:', err);
    return null;
  }
}

export async function fetchPatientTicketSecureRpc(
  ticketNumberOrId: string,
  patientPhone: string
): Promise<Booking | null> {
  if (!isSupabaseConfigured || !ticketNumberOrId || !patientPhone) return null;
  const cleanTicketOrId = ticketNumberOrId.trim();
  if (!isValidEntityId(cleanTicketOrId)) return null;
  try {
    const cleanPhoneDigits = patientPhone.replace(/\D/g, '');
    const phoneLast4 = cleanPhoneDigits.slice(-4);
    const { data, error } = await supabase.rpc('get_patient_ticket_secure', {
      p_ticket_number: cleanTicketOrId,
      p_phone_last_4: phoneLast4
    });
    if (error || !data || typeof data !== 'object') return null;
    if (data.success && data.ticket && data.ticket.id) {
      return mapDbBooking({
        ...data.ticket,
        patient_phone: patientPhone
      });
    }
    if (data.id) {
      return mapDbBooking(data);
    }
    return null;
  } catch {
    return null;
  }
}

export async function verifyTicketForStaffRpc(
  lookup: string
): Promise<Booking | null> {
  if (!isSupabaseConfigured || !lookup) return null;
  try {
    await ensureActiveSupabaseSession();
    const { data, error } = await supabase.rpc('verify_ticket_for_staff', {
      p_lookup: lookup.trim()
    });
    if (error || !data || typeof data !== 'object' || !data.id) return null;
    return mapDbBooking(data);
  } catch {
    return null;
  }
}

export async function markPatientLateAndCallNextRpc(
  currentBookingId?: string,
  nextBookingId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase غير مهيأ' };
  }
  if (
    (currentBookingId && !isValidEntityId(currentBookingId)) ||
    (nextBookingId && !isValidEntityId(nextBookingId))
  ) {
    return { success: false, error: 'معرف الحجز غير صالح' };
  }
  try {
    await ensureActiveSupabaseSession();
    const { error } = await supabase.rpc('mark_patient_late_and_call_next', {
      p_current_booking_id: currentBookingId ? currentBookingId.trim() : null,
      p_next_booking_id: nextBookingId ? nextBookingId.trim() : null
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ في تحديث الدور' };
  }
}

export async function updateBookingStatusInDb(
  bookingId: string,
  updates: Partial<{
    status: BookingStatus;
    doctorDiagnosis: string;
    calledAt: string;
    completedAt: string;
    paidAt: string;
    queuePosition: number;
  }>
): Promise<boolean> {
  if (!isSupabaseConfigured || !isValidEntityId(bookingId)) return false;
  try {
    await ensureActiveSupabaseSession();
    const dbUpdates: any = {};
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.doctorDiagnosis !== undefined) dbUpdates.doctor_diagnosis = updates.doctorDiagnosis;
    if (updates.calledAt) dbUpdates.called_at = updates.calledAt;
    if (updates.completedAt) dbUpdates.completed_at = updates.completedAt;
    if (updates.paidAt) dbUpdates.paid_at = updates.paidAt;
    if (typeof updates.queuePosition === 'number') dbUpdates.queue_position = updates.queuePosition;

    const { error } = await supabase
      .from('bookings')
      .update(dbUpdates)
      .eq('id', bookingId.trim());

    return !error;
  } catch (err) {
    console.warn('Error updating booking in Supabase:', err);
    return false;
  }
}

export async function deleteBookingFromDb(
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidEntityId(bookingId)) {
    return { success: false, error: 'معرف الحجز غير صالح' };
  }
  const cleanBookingId = bookingId.trim();
  markBookingDeletedLocally(cleanBookingId);

  if (!isSupabaseConfigured) {
    return { success: true };
  }

  await ensureActiveSupabaseSession();
  let deletedInCloud = false;

  // 1. استدعاء دالة RPC المعتمدة لحذف الحجز بواسطة الموظف (الخزينة / الاستقبال / الإدارة)
  try {
    const { data, error } = await supabase.rpc('delete_booking_by_staff', {
      p_booking_id: cleanBookingId
    });
    if (!error && data) {
      deletedInCloud = true;
    }
  } catch {
    // fallback below
  }

  // 2. محاولة الحذف المباشر من جدول bookings
  if (!deletedInCloud) {
    try {
      const { error: delErr } = await supabase
        .from('bookings')
        .delete()
        .eq('id', cleanBookingId);
      if (!delErr) {
        deletedInCloud = true;
      }
    } catch {}
  }

  // 3. احتياط إضافي: وسم السجل بالحذف النهائي والإلغاء لضمان عدم ظهوره في أي استعلام
  if (!deletedInCloud) {
    try {
      const { error: updErr } = await supabase
        .from('bookings')
        .update({
          notes: '__PURGED_PAST_BOOKING__',
          status: 'cancelled'
        })
        .eq('id', cleanBookingId);
      if (!updErr) {
        deletedInCloud = true;
      }
    } catch {}
  }

  // 4. بث إشعار الحذف اللحظي لجميع الشاشات والأجهزة المتصلة عبر Realtime
  try {
    const channel = supabase.channel('system_updates');
    channel.send({
      type: 'broadcast',
      event: 'booking_deleted',
      payload: { bookingId: cleanBookingId }
    });
  } catch {}

  return { success: true };
}

export async function deleteBookingsBeforeDateFromDb(dateStr: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await ensureAdminSupabaseSession();

    // 1. محاولة الحذف المباشر لجدول الحجوزات
    try {
      await supabase
        .from('bookings')
        .delete()
        .lt('date', dateStr);
    } catch {}

    // 2. تحديث وتطهير جميع الحجوزات السابقة في قاعدة البيانات لوسمها بالحذف وإلغائها نهائياً
    try {
      await supabase
        .from('bookings')
        .update({
          notes: '__PURGED_PAST_BOOKING__',
          status: 'cancelled'
        })
        .lt('date', dateStr);
    } catch (err) {
      console.warn('Error purging past bookings in Supabase:', err);
    }

    // 3. تثبيت تاريخ القطع في سجل النظام السحابي لتعميمه وحمايته من استرجاع البيانات القديمة
    try {
      await supabase.from('clinics').upsert({
        id: '_system_bookings_cutoff_date',
        name: 'System Bookings Cutoff Date',
        specialty: 'System',
        room_number: '0',
        floor: '0',
        price: 0,
        description: dateStr,
        is_open_today: false
      });
    } catch (err) {
      console.warn('Error saving cutoff date to clinics setting:', err);
    }

    // 4. بث إشعار التحديث اللحظي عبر Realtime
    try {
      const channel = supabase.channel('system_updates');
      channel.send({
        type: 'broadcast',
        event: 'bookings_purged',
        payload: { cutoffDate: dateStr }
      });
    } catch {}

    return true;
  } catch (err) {
    console.warn('Error deleting old bookings in Supabase:', err);
    return false;
  }
}

export async function updateDoctorStatusInDb(
  doctorId: string,
  status: DoctorStatus,
  unavailableReason?: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !isValidEntityId(doctorId)) return false;
  const cleanDoctorId = doctorId.trim();

  // التحقق من عدم تجاوز الطبيب لمعرفه الشخصي
  const currentSession = getCurrentStoredSession();
  if (
    currentSession?.role === 'doctor' &&
    currentSession.doctorId &&
    currentSession.doctorId !== cleanDoctorId
  ) {
    console.warn('Blocked cross-doctor status modification attempt');
    return false;
  }

  try {
    await ensureActiveSupabaseSession();
    const { data, error } = await supabase
      .from('doctors')
      .update({
        status,
        unavailable_reason: unavailableReason || null,
        is_present_today: status !== 'offline'
      })
      .eq('id', cleanDoctorId)
      .select('id')
      .maybeSingle();

    return Boolean(!error && data?.id);
  } catch (err) {
    console.warn('Error updating doctor status in Supabase:', err);
    return false;
  }
}

export async function saveDailyScheduleToDb(scheduleState: DailyScheduleState): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await ensureActiveSupabaseSession();
    const rows = scheduleState.items
      .filter(item => isValidEntityId(item.clinicId))
      .map(item => ({
        date: scheduleState.date,
        clinic_id: item.clinicId.trim(),
        doctor_id: item.doctorId && isValidEntityId(item.doctorId) ? item.doctorId.trim() : null,
        is_open: item.isOpen
      }));

    const { error } = await supabase
      .from('daily_schedule')
      .upsert(rows, { onConflict: 'date,clinic_id' });

    // مزامنة حالة الفتح اليومي مع جدول clinics.is_open_today لضمان توافق دالة create_public_booking في قاعدة البيانات
    await Promise.all(
      scheduleState.items
        .filter(item => isValidEntityId(item.clinicId))
        .map(item =>
          supabase
            .from('clinics')
            .update({ is_open_today: item.isOpen })
            .eq('id', item.clinicId.trim())
        )
    ).catch(() => {});

    return !error;
  } catch (err) {
    console.warn('Error saving daily schedule to Supabase:', err);
    return false;
  }
}

export async function updateClinicInDb(clinicId: string, data: Partial<Clinic>): Promise<boolean> {
  if (!isSupabaseConfigured || !isValidEntityId(clinicId) || clinicId.trim().startsWith('_system')) {
    return false;
  }
  try {
    await ensureActiveSupabaseSession();
    const updates: any = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.fee !== undefined) updates.price = data.fee;
    if (data.room !== undefined) updates.room_number = data.room;
    if (data.floor !== undefined) updates.floor = data.floor;
    if (data.specialty !== undefined) updates.specialty = data.specialty;
    if (data.department !== undefined) updates.department = data.department;
    if (data.description !== undefined) updates.description = data.description;
    if (data.iconName !== undefined) updates.icon_name = data.iconName;
    if (data.active !== undefined) updates.is_open_today = data.active;
    if (data.isActive !== undefined) updates.is_open_today = data.isActive;
    if (data.isOpenToday !== undefined) updates.is_open_today = data.isOpenToday;
    if (data.workingDays !== undefined) updates.working_days = data.workingDays;
    if (data.workingHours !== undefined) updates.working_hours = data.workingHours;

    const { error } = await supabase
      .from('clinics')
      .update(updates)
      .eq('id', clinicId);

    if (error) {
      console.warn('Error updating clinic in Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error updating clinic in Supabase:', err);
    return false;
  }
}

export async function addClinicToDb(clinic: Clinic): Promise<boolean> {
  if (!isValidEntityId(clinic.id) || clinic.id.trim().startsWith('_system')) {
    return false;
  }
  const cleanClinicId = clinic.id.trim();
  unmarkClinicDeletedLocally(cleanClinicId);
  if (!isSupabaseConfigured) return false;
  try {
    await ensureAdminSupabaseSession();
    const { error } = await supabase
      .from('clinics')
      .upsert({
        id: cleanClinicId,
        name: clinic.name,
        price: clinic.fee,
        room_number: clinic.room,
        floor: clinic.floor,
        specialty: clinic.specialty || clinic.name,
        department: clinic.department || 'العيادات الخارجية',
        description: clinic.description || '',
        icon_name: clinic.iconName || 'Stethoscope',
        is_open_today: clinic.active ?? true,
        working_days: clinic.workingDays || ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
        working_hours: clinic.workingHours || '9:00 ص - 9:00 م'
      });
    return !error;
  } catch (err) {
    console.warn('Error adding clinic to Supabase:', err);
    return false;
  }
}

export async function deleteClinicFromDb(
  clinicId: string
): Promise<{ success: boolean; action?: 'deleted' | 'archived'; message?: string; error?: string }> {
  if (!isValidEntityId(clinicId) || clinicId.trim().startsWith('_system')) {
    return { success: false, error: 'معرف العيادة غير صالح' };
  }
  const cleanClinicId = clinicId.trim();
  if (!isSupabaseConfigured) {
    markClinicDeletedLocally(cleanClinicId);
    return { success: true, action: 'deleted', message: 'تم حذف العيادة محلياً' };
  }

  try {
    await ensureAdminSupabaseSession();

    // 1. فحص عدم وجود حجوزات نشطة جارية حالياً على العيادة
    const { count: activeCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', cleanClinicId)
      .in('status', ['waiting', 'in-progress', 'late']);

    if (activeCount && activeCount > 0) {
      return {
        success: false,
        error: `لا يمكن حذف العيادة لوجود ${activeCount} حجز نشط جارٍ عليها. يرجى استكمال الحالات أو إلغاؤها أولاً.`
      };
    }

    // 2. فك ارتباط جدول اليوم والأطباء وحذف العيادة نهائياً
    await supabase.from('daily_schedule').delete().eq('clinic_id', cleanClinicId);
    await supabase.from('doctors').update({ clinic_id: null, clinic_name: null }).eq('clinic_id', cleanClinicId);

    const { data: delData, error: delErr } = await supabase
      .from('clinics')
      .delete()
      .eq('id', cleanClinicId)
      .select('id');

    if (delErr || !delData || delData.length === 0) {
      // في حال وجود قيد مرجعي أو عدم حذف الصف مباشرة، نضع وسم الحذف النهائي لمنع عودتها عند التحديث
      await supabase
        .from('clinics')
        .update({ is_open_today: false, description: '__DELETED_CLINIC__' })
        .eq('id', cleanClinicId);
    }

    markClinicDeletedLocally(cleanClinicId);

    return {
      success: true,
      action: 'deleted',
      message: 'تم حذف العيادة نهائياً من قاعدة البيانات.'
    };
  } catch (err: any) {
    markClinicDeletedLocally(cleanClinicId);
    return { success: true, action: 'deleted', message: 'تم حذف العيادة نهائياً.' };
  }
}

export async function updateClinicFeeInDb(clinicId: string, newFee: number): Promise<boolean> {
  return updateClinicInDb(clinicId, { fee: newFee });
}

export async function updateDoctorInDb(doctorId: string, updates: Partial<Doctor>): Promise<boolean> {
  if (!isSupabaseConfigured || !isValidEntityId(doctorId)) return false;
  const cleanDoctorId = doctorId.trim();

  // منع الطبيب من تمرير معرف طبيب آخر عند تعديل الجدول الزمني أو الحالة
  const currentSession = getCurrentStoredSession();
  if (
    currentSession?.role === 'doctor' &&
    currentSession.doctorId &&
    currentSession.doctorId !== cleanDoctorId
  ) {
    console.warn('Blocked cross-doctor profile modification attempt');
    return false;
  }

  try {
    await ensureActiveSupabaseSession();
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.title !== undefined) {
      dbUpdates.title = updates.title;
      dbUpdates.specialty = updates.title;
    }
    if ((updates as any).specialty !== undefined) dbUpdates.specialty = (updates as any).specialty;
    if (updates.clinicId !== undefined) dbUpdates.clinic_id = updates.clinicId;
    if (updates.clinicName !== undefined) dbUpdates.clinic_name = updates.clinicName;
    if (updates.scheduleDays !== undefined) dbUpdates.schedule_days = updates.scheduleDays;
    if (updates.scheduleHours !== undefined) dbUpdates.schedule_hours = updates.scheduleHours;
    if (updates.maxDailyBookings !== undefined) dbUpdates.max_daily_patients = updates.maxDailyBookings;
    if (updates.status !== undefined) {
      dbUpdates.status = updates.status;
      dbUpdates.is_present_today = updates.status !== 'offline';
    }
    if (updates.unavailableReason !== undefined) dbUpdates.unavailable_reason = updates.unavailableReason;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;

    const { data, error } = await supabase
      .from('doctors')
      .update(dbUpdates)
      .eq('id', cleanDoctorId)
      .select('id')
      .maybeSingle();

    return Boolean(!error && data?.id);
  } catch (err) {
    console.warn('Error updating doctor in Supabase:', err);
    return false;
  }
}

export async function addDoctorToDb(doctor: Doctor): Promise<boolean> {
  if (!isValidEntityId(doctor.id)) return false;
  const cleanDoctorId = doctor.id.trim();
  unmarkDoctorDeletedLocally(cleanDoctorId);
  if (!isSupabaseConfigured) return false;
  try {
    await ensureAdminSupabaseSession();
    const { error } = await supabase
      .from('doctors')
      .upsert({
        id: cleanDoctorId,
        name: doctor.name,
        specialty: (doctor as any).specialty || doctor.title || 'عام',
        title: doctor.title || 'أخصائي',
        clinic_id: doctor.clinicId,
        clinic_name: doctor.clinicName,
        is_present_today: doctor.status !== 'offline',
        status: doctor.status || 'available',
        unavailable_reason: doctor.unavailableReason || null,
        schedule_days: doctor.scheduleDays || ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
        schedule_hours: doctor.scheduleHours || '9:00 ص - 3:00 م',
        max_daily_patients: doctor.maxDailyBookings || 30,
        current_queue_number: doctor.currentQueueNumber || 0,
        phone: doctor.phone || null,
        bio: doctor.bio || null
      });
    return !error;
  } catch (err) {
    console.warn('Error adding doctor to Supabase:', err);
    return false;
  }
}

export async function deleteDoctorFromDb(
  doctorId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!isValidEntityId(doctorId)) {
    return { success: false, error: 'معرف الطبيب غير صالح' };
  }
  const cleanDoctorId = doctorId.trim();
  if (!isSupabaseConfigured) {
    markDoctorDeletedLocally(cleanDoctorId);
    return { success: true, message: 'تم حذف الطبيب محلياً' };
  }

  try {
    await ensureAdminSupabaseSession();

    const { count: activeCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', cleanDoctorId)
      .in('status', ['waiting', 'in-progress', 'late']);

    if (activeCount && activeCount > 0) {
      return {
        success: false,
        error: `لا يمكن حذف الطبيب لوجود ${activeCount} حجز نشط جارٍ له حالياً. يرجى استكمال الحالات أو إلغاؤها أولياً.`
      };
    }

    await supabase.from('daily_schedule').update({ doctor_id: null }).eq('doctor_id', cleanDoctorId);
    await supabase.from('staff_accounts').update({ doctor_id: null }).eq('doctor_id', cleanDoctorId);

    const { data: delData, error: delErr } = await supabase
      .from('doctors')
      .delete()
      .eq('id', cleanDoctorId)
      .select('id');

    if (delErr || !delData || delData.length === 0) {
      await supabase
        .from('doctors')
        .update({ is_present_today: false, status: 'offline', bio: '__DELETED_DOCTOR__' })
        .eq('id', cleanDoctorId);
    }

    markDoctorDeletedLocally(cleanDoctorId);
    return {
      success: true,
      message: 'تم حذف الطبيب نهائياً من النظام.'
    };
  } catch (err: any) {
    markDoctorDeletedLocally(cleanDoctorId);
    return { success: true, message: 'تم حذف الطبيب نهائياً.' };
  }
}

export async function updateDoctorMaxPatientsInDb(doctorId: string, maxPatients: number): Promise<boolean> {
  if (!isSupabaseConfigured || !isValidEntityId(doctorId)) return false;
  try {
    await ensureAdminSupabaseSession();
    const { error } = await supabase
      .from('doctors')
      .update({ max_daily_patients: maxPatients })
      .eq('id', doctorId.trim());
    return !error;
  } catch (err) {
    console.warn('Error updating doctor max patients in Supabase:', err);
    return false;
  }
}

export async function fetchSettingsFromDb(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured) return {};
  const map: Record<string, string> = {};

  // جلب الإعدادات العامة ومواعيد العمل الرسمية وصلاحيات الأدوار وحالات إرسال واتساب من سجلات النظام بجدول العيادات
  try {
    const { data: clinicSettings } = await supabase
      .from('clinics')
      .select('id, description')
      .in('id', ['_system_support_info', '_system_working_hours', '_system_role_permissions', '_system_whatsapp_sent', '_system_error_logs']);

    if (Array.isArray(clinicSettings)) {
      for (const row of clinicSettings) {
        if (row.id === '_system_support_info' && row.description) {
          map['support_info_text'] = row.description;
        } else if (row.id === '_system_working_hours' && row.description) {
          map['official_working_hours_text'] = row.description;
        } else if (row.id === '_system_role_permissions' && row.description) {
          map['role_permissions'] = row.description;
        } else if (row.id === '_system_whatsapp_sent' && row.description) {
          map['whatsapp_sent_ids'] = row.description;
        } else if (row.id === '_system_error_logs' && row.description) {
          map['system_error_logs_json'] = row.description;
        }
      }
    }
  } catch (err) {
    console.warn('Could not fetch system settings from clinics:', err);
  }

  return map;
}

export async function markWhatsAppSentInDb(bookingId: string): Promise<Record<string, boolean> | null> {
  if (!isSupabaseConfigured || !isValidEntityId(bookingId)) return null;
  const cleanBookingId = bookingId.trim();
  try {
    await ensureActiveSupabaseSession();
    const { data, error } = await supabase.rpc('mark_whatsapp_sent', {
      p_booking_id: cleanBookingId
    });
    if (error || !data || typeof data !== 'object') return null;

    try {
      const channel = supabase.channel('system_updates');
      channel.send({
        type: 'broadcast',
        event: 'whatsapp_sent_updated',
        payload: { bookingId: cleanBookingId, sentIds: data }
      });
    } catch {}

    return data as Record<string, boolean>;
  } catch {
    return null;
  }
}

export async function saveSettingToDb(key: string, value: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  let success = false;

  // حفظ الإعدادات النصية أو مواعيد العمل الرسمية أو صلاحيات الأدوار أو سجلات الأخطاء في سجل النظام بجدول العيادات
  if (
    key === 'support_info_text' ||
    key === 'official_working_hours_text' ||
    key === 'role_permissions' ||
    key === 'system_error_logs_json'
  ) {
    const targetId =
      key === 'support_info_text'
        ? '_system_support_info'
        : key === 'official_working_hours_text'
        ? '_system_working_hours'
        : key === 'system_error_logs_json'
        ? '_system_error_logs'
        : '_system_role_permissions';
    const targetName =
      key === 'support_info_text'
        ? 'System Support Info'
        : key === 'official_working_hours_text'
        ? 'System Official Working Hours'
        : key === 'system_error_logs_json'
        ? 'System Error Logs'
        : 'System Role Permissions';
    try {
      await ensureAdminSupabaseSession();
      const { data, error: clinicErr } = await supabase.from('clinics').upsert({
        id: targetId,
        name: targetName,
        specialty: 'System',
        room_number: '0',
        description: value,
        is_open_today: false
      }).select();

      if (!clinicErr && data && data.length > 0) {
        success = true;
      } else {
        console.warn(`Could not upsert ${targetId}:`, clinicErr);
      }
    } catch (e) {
      console.warn(`Error saving ${targetId} to clinics:`, e);
    }
  }

  // بث التحديث اللحظي عبر قناة Realtime ليصل فوراً إلى جميع المتصفحات والزوار دون انتظار
  try {
    const channel = supabase.channel('system_updates');
    const eventName =
      key === 'role_permissions'
        ? 'role_permissions_updated'
        : key === 'official_working_hours_text'
        ? 'working_hours_updated'
        : key === 'system_error_logs_json'
        ? 'error_logs_updated'
        : 'support_info_updated';
    channel.send({
      type: 'broadcast',
      event: eventName,
      payload: { key, value }
    });
  } catch {
    // broadcast best-effort
  }

  return success;
}

/**
 * إرسال خطأ نظام من أي جهاز (مريض أو موظف أو شاشة عرض) إلى قاعدة البيانات وبثه لحظياً للوحة تحكم الأدمن
 */
export async function reportClientErrorToDb(errorLog: SystemErrorLog): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  let saved = false;

  // 1. البث اللحظي عبر قناة Realtime ليظهر فوراً في لوحة تحكم الأدمن المفتوحة على أي جهاز
  try {
    const channel = supabase.channel('system_updates');
    channel.send({
      type: 'broadcast',
      event: 'error_logged',
      payload: { errorLog: { ...errorLog, syncedToDb: true } }
    });
  } catch {
    // ignore broadcast error
  }

  // 2. المحاولة الأولى: استدعاء دالة RPC المخصصة لتسجيل الأخطاء من أي جهاز (بما في ذلك الأجهزة غير المسجلة للدخول)
  try {
    const { data, error } = await supabase.rpc('report_client_error', {
      p_error: { ...errorLog, syncedToDb: true }
    });
    if (!error && data) {
      saved = true;
    }
  } catch {
    // fallback to direct upsert
  }

  // 3. المحاولة الاحتياطية: التحديث المباشر لسجل _system_error_logs في جدول clinics
  if (!saved) {
    try {
      const { data: existingRow } = await supabase
        .from('clinics')
        .select('description')
        .eq('id', '_system_error_logs')
        .maybeSingle();

      let currentLogs: SystemErrorLog[] = [];
      if (existingRow?.description) {
        try {
          const parsed = JSON.parse(existingRow.description);
          if (Array.isArray(parsed)) currentLogs = parsed;
        } catch {}
      }

      const merged = [
        { ...errorLog, syncedToDb: true },
        ...currentLogs.filter(item => item.id !== errorLog.id)
      ].slice(0, 100);

      const { error: upsertErr } = await supabase.from('clinics').upsert({
        id: '_system_error_logs',
        name: 'System Error Logs',
        specialty: 'System',
        room_number: '0',
        description: JSON.stringify(merged),
        is_open_today: false
      });

      if (!upsertErr) {
        saved = true;
      }
    } catch {
      // ignore
    }
  }

  return saved;
}

/**
 * تم إيقاف تخزين أو قراءة تجزئات كلمات المرور من جدول clinics العام نهائياً لدواعي الحماية الأمنية
 * حيث تتم كافة عمليات التحقق عبر Supabase Auth على الخادم حصراً.
 */
export async function fetchStaffPasswordHashesFromDb(): Promise<Record<string, string> | null> {
  return null;
}

export async function saveStaffPasswordHashToDb(
  _username: string,
  _newHash: string,
  _oldUsername?: string
): Promise<boolean> {
  return false;
}

export async function createStaffAccountInDb(input: {
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
  doctorId?: string | null;
  clinicId?: string | null;
  recoveryEmail?: string;
}): Promise<{ success: boolean; staff?: StaffAccount; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase غير مهيأ' };
  }

  try {
    const token = await getAdminBearerToken();
    if (!token) {
      return { success: false, error: 'غير مصرح: تعذر التحقق من جلسة مدير النظام (Admin)' };
    }

    const response = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        username: input.username.trim().toLowerCase(),
        password: input.password,
        displayName: input.displayName.trim(),
        role: input.role,
        doctorId: input.role === 'doctor' ? (input.doctorId || null) : null,
        clinicId: input.role === 'doctor' ? (input.clinicId || null) : null,
        recoveryEmail: input.recoveryEmail ? input.recoveryEmail.trim().toLowerCase() : null
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok || !payload?.staff) {
      return {
        success: false,
        error: payload?.error || 'تعذر إنشاء حساب الموظف'
      };
    }

    const cleanUser = input.username.trim().toLowerCase();

    try {
      const channel = supabase.channel('system_updates');
      channel.send({
        type: 'broadcast',
        event: 'staff_updated',
        payload: { staffId: payload.staff.id, username: cleanUser }
      });
    } catch {
      // ignore
    }

    return {
      success: true,
      staff: mapDbStaff(payload.staff)
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'حدث خطأ أثناء الاتصال بالخادم لإنشاء حساب الموظف'
    };
  }
}

export async function adminChangeStaffPassword(
  username: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'الاتصال بقاعدة البيانات غير مهيأ' };
  }

  const cleanUser = username.trim().toLowerCase();

  try {
    const token = await getAdminBearerToken();
    if (!token) {
      return {
        success: false,
        error: 'غير مصرح: يرجى تسجيل الدخول بحساب مدير النظام (Admin) لتنفيذ هذه العملية عبر الخادم'
      };
    }

    const response = await fetch('/api/admin/staff/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        username: cleanUser,
        newPassword
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      return {
        success: false,
        error: payload?.error || 'تعذر تحديث كلمة المرور عبر الخادم؛ لم يتم إجراء أي تعديل غير آمن'
      };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      error: 'تعذر الاتصال بالخادم (Backend) لتغيير كلمة المرور؛ تم إيقاف العملية للحفاظ على الأمان'
    };
  }
}

export async function updateStaffAccountInDb(
  staffId: string, 
  updates: {
    username?: string;
    password?: string;
    displayName?: string;
    role?: UserRole;
    doctorId?: string | null;
    clinicId?: string | null;
    recoveryEmail?: string;
  }
): Promise<{ success: boolean; staff?: StaffAccount; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase غير مهيأ' };
  if (!isValidEntityId(staffId)) {
    return { success: false, error: 'معرف حساب الموظف غير صالح' };
  }
  const cleanStaffId = staffId.trim();

  try {
    const token = await getAdminBearerToken();
    if (!token) {
      return {
        success: false,
        error: 'غير مصرح: يرجى تسجيل الدخول بحساب مدير النظام (Admin) لتعديل بيانات الموظف عبر الخادم'
      };
    }

    const response = await fetch(`/api/admin/staff/${encodeURIComponent(cleanStaffId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok || !payload?.staff) {
      return {
        success: false,
        error: payload?.error || 'تعذر تحديث بيانات حساب الموظف عبر الخادم؛ لم يتم إجراء أي تعديل بديل'
      };
    }

    const updatedStaff = mapDbStaff(payload.staff);

    try {
      const channel = supabase.channel('system_updates');
      channel.send({
        type: 'broadcast',
        event: 'staff_updated',
        payload: { staffId: cleanStaffId, username: updatedStaff.username }
      });
    } catch {}

    return { success: true, staff: updatedStaff };
  } catch {
    return {
      success: false,
      error: 'تعذر الاتصال بالخادم (Backend) لتحديث حساب الموظف؛ تم إيقاف العملية للحفاظ على الأمان'
    };
  }
}

export async function deleteStaffAccountRpc(staffId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase غير مهيأ' };
  }
  if (!isValidEntityId(staffId)) {
    return { success: false, error: 'معرف حساب الموظف غير صالح' };
  }
  const cleanStaffId = staffId.trim();
  try {
    const token = await getAdminBearerToken();
    if (!token) {
      return {
        success: false,
        error: 'غير مصرح: يرجى تسجيل الدخول بحساب مدير النظام (Admin) لحذف حساب الموظف عبر الخادم'
      };
    }

    const response = await fetch(`/api/admin/staff/${encodeURIComponent(cleanStaffId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      return {
        success: false,
        error: payload?.error || 'تعذر حذف حساب الموظف عبر الخادم؛ لم يتم إجراء أي حذف بديل'
      };
    }

    try {
      const channel = supabase.channel('system_updates');
      channel.send({
        type: 'broadcast',
        event: 'staff_updated',
        payload: { staffId: cleanStaffId, deleted: true }
      });
    } catch {}

    return { success: true };
  } catch {
    return {
      success: false,
      error: 'تعذر الاتصال بالخادم (Backend) لحذف حساب الموظف؛ تم إيقاف العملية للحفاظ على الأمان'
    };
  }
}

// ==========================================
// المصادقة الحقيقية عبر Supabase Auth
// ==========================================

export async function loginWithSupabaseAuth(
  username: string, 
  password: string
): Promise<{ success: boolean; session?: UserSession; authoritativeReject?: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'لم يتم تفعيل الاتصال بـ Supabase بعد' };
  }

  try {
    const cleanUsername = username.trim().toLowerCase();
    const syntheticEmail = `${cleanUsername}@accounts.sharaya-clinics.internal`;

    let { data, error } = await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password: password
    });

    if ((error || !data.user) && password !== password.trim() && password.trim().length > 0) {
      const retryRes = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password: password.trim()
      });
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error || !data.user) {
      const errMsg = (error?.message || '').toLowerCase();
      const isNetworkError =
        errMsg.includes('failed to fetch') ||
        errMsg.includes('networkerror') ||
        errMsg.includes('network request failed') ||
        errMsg.includes('load failed');

      if (!isNetworkError) {
        return {
          success: false,
          authoritativeReject: true,
          error: 'اسم المستخدم أو كلمة المرور غير صحيحة'
        };
      }
      return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    }

    // التحقق الصارم من هوية الموظف ودوره الوظيفي عبر الخادم (Server Service Role) بمطابقة auth_user_id = auth.uid() حصراً
    const accessToken = data.session?.access_token;
    if (accessToken) {
      try {
        const verifyRes = await fetch('/api/auth/staff-session', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        const verifyPayload = await verifyRes.json().catch(() => null);
        if (verifyRes.ok && verifyPayload?.ok && verifyPayload?.caller) {
          const caller = verifyPayload.caller;
          return {
            success: true,
            session: {
              id: caller.staffId,
              username: caller.username,
              displayName: caller.displayName,
              role: caller.role as UserRole,
              doctorId: caller.doctorId || undefined,
              clinicId: caller.clinicId || undefined
            }
          };
        }
        if (verifyRes.status === 403) {
          try {
            await supabase.auth.signOut();
          } catch {}
          return {
            success: false,
            authoritativeReject: true,
            error: verifyPayload?.error || 'هذا الحساب غير مسجل أو تم إيقافه من منظومة الموظفين'
          };
        }
      } catch {
        // fallback to bridge query below
      }
    }

    // استعلام احتياطي عبر جسر الخادم بشرط تطابق auth_user_id حصرياً (بدون أي مطابقة عمياء بالاسم)
    const { data: staffData, error: staffError } = await supabase
      .from('staff_accounts')
      .select('id, auth_user_id, username, display_name, role, doctor_id, clinic_id, created_at')
      .eq('auth_user_id', data.user.id)
      .maybeSingle();

    // إذا لم يكن الحساب مسجلاً في staff_accounts ومربوطاً بـ auth_user_id، نمنع الدخول ولا نثق في user_metadata
    if (staffError || !staffData || staffData.id === undefined) {
      try {
        await supabase.auth.signOut();
      } catch {}
      return {
        success: false,
        authoritativeReject: true,
        error: 'هذا الحساب غير مسجل أو تم إيقافه من منظومة الموظفين'
      };
    }

    return {
      success: true,
      session: {
        id: staffData.id,
        username: staffData.username,
        displayName: staffData.display_name,
        role: staffData.role as UserRole,
        doctorId: staffData.doctor_id || undefined,
        clinicId: staffData.clinic_id || undefined
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل تسجيل الدخول' };
  }
}

export async function logoutFromSupabase(): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('SignOut error:', e);
    }
  }
}

// ==========================================
// Phase 4: استعادة كلمة المرور (Forgot Password via 6-digit OTP)
// ==========================================

export async function requestPasswordRecoveryOtp(
  username: string,
  recoveryEmail: string
): Promise<{
  success: boolean;
  message?: string;
  code?: string;
  retryAfterSeconds?: number;
  error?: string;
}> {
  try {
    const response = await fetch('/api/auth/forgot-password/request-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username.trim().toLowerCase(),
        recoveryEmail: recoveryEmail.trim().toLowerCase(),
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      return {
        success: false,
        code: payload?.code,
        retryAfterSeconds: payload?.retryAfterSeconds,
        error:
          payload?.error ||
          'تعذر إرسال رمز الاستعادة حالياً؛ يرجى التحقق من البيانات أو المحاولة لاحقاً.',
      };
    }

    return {
      success: true,
      message: payload.message,
    };
  } catch {
    return {
      success: false,
      error: 'تعذر الاتصال بالخادم (Backend) لطلب رمز الاستعادة. يرجى التحقق من اتصال الشبكة.',
    };
  }
}

export async function verifyPasswordRecoveryOtp(
  username: string,
  recoveryEmail: string,
  otp: string
): Promise<{
  success: boolean;
  resetToken?: string;
  expiresInSeconds?: number;
  error?: string;
}> {
  try {
    const response = await fetch('/api/auth/forgot-password/verify-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username.trim().toLowerCase(),
        recoveryEmail: recoveryEmail.trim().toLowerCase(),
        otp: otp.trim(),
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok || !payload?.resetToken) {
      return {
        success: false,
        error: payload?.error || 'رمز التحقق غير صحيح أو منتهي الصلاحية.',
      };
    }

    return {
      success: true,
      resetToken: String(payload.resetToken),
      expiresInSeconds:
        typeof payload.expiresInSeconds === 'number' ? payload.expiresInSeconds : 300,
    };
  } catch {
    return {
      success: false,
      error: 'تعذر الاتصال بالخادم (Backend) للتحقق من الرمز.',
    };
  }
}

export async function completePasswordRecoveryReset(params: {
  username: string;
  recoveryEmail: string;
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const response = await fetch('/api/auth/forgot-password/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: params.username.trim().toLowerCase(),
        recoveryEmail: params.recoveryEmail.trim().toLowerCase(),
        resetToken: params.resetToken.trim(),
        newPassword: params.newPassword,
        confirmPassword: params.confirmPassword,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      return {
        success: false,
        error: payload?.error || 'تعذر تعيين كلمة المرور الجديدة.',
      };
    }

    return {
      success: true,
      message: payload.message,
    };
  } catch {
    return {
      success: false,
      error: 'تعذر الاتصال بالخادم (Backend) لتعيين كلمة المرور الجديدة.',
    };
  }
}

// ==========================================
// التحديث اللحظي (Realtime Subscription)
// ==========================================

export function subscribeToBookingsRealtime(onUpdate: (payload?: any) => void): () => void {
  if (!isSupabaseConfigured) return () => {};

  try {
    const channelName = `realtime-bookings-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        (payload) => {
          onUpdate(payload);
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.warn('Realtime channel status warning:', status, err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (e) {
    console.warn('Realtime subscription error:', e);
    return () => {};
  }
}
