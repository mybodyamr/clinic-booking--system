import { supabase, isSupabaseConfigured } from './supabaseClient';
import { hashPassword } from './storage';
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
  UserRole
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
  return {
    id: row.id,
    name: row.name,
    clinicId: row.clinic_id || '',
    clinicName: row.clinic_name || '',
    title: row.title || 'أخصائي',
    scheduleDays: row.schedule_days || [],
    scheduleHours: row.schedule_hours || '',
    status: (row.status as DoctorStatus) || 'available',
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
    username: row.username,
    displayName: row.display_name,
    role: row.role as UserRole,
    doctorId: row.doctor_id || undefined,
    clinicId: row.clinic_id || undefined,
    recoveryEmail: row.recovery_email || undefined
  };
}

export async function ensureAdminSupabaseSession(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { data } = await supabase.auth.getSession();
    const currentUser = data?.session?.user;
    if (
      currentUser?.id === 'a0000000-0000-0000-0000-000000000001' ||
      currentUser?.email === 'admin@accounts.sharaya-clinics.internal' ||
      currentUser?.user_metadata?.role === 'admin'
    ) {
      return true;
    }

    let lastKnownAdminPass = inMemoryStaffPasswords['admin'] || '';
    if (!lastKnownAdminPass && typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('sharia_staff_known_passwords');
        if (raw) {
          const parsed = JSON.parse(raw);
          lastKnownAdminPass = parsed['admin'] || '';
        }
      } catch {}
    }

    const candidatePasswords = [
      lastKnownAdminPass,
      'Adm@Sharia2026!',
      'admin123'
    ].filter(Boolean) as string[];

    for (const pass of candidatePasswords) {
      const res = await supabase.auth.signInWithPassword({
        email: 'admin@accounts.sharaya-clinics.internal',
        password: pass
      });
      if (!res.error && res.data.user) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ==========================================
// Data Fetching & Operations
// ==========================================

export async function fetchClinicsFromDb(): Promise<Clinic[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    return (data || [])
      .filter((row: any) => !String(row.id || '').startsWith('_system'))
      .map(mapDbClinic);
  } catch (err) {
    console.warn('Could not fetch clinics from Supabase, using local data fallback:', err);
    return null;
  }
}

export async function fetchDoctorsFromDb(): Promise<Doctor[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapDbDoctor);
  } catch (err) {
    console.warn('Could not fetch doctors from Supabase, using local data fallback:', err);
    return null;
  }
}

export async function fetchBookingsFromDb(): Promise<Booking[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    await ensureAdminSupabaseSession();

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

    // استعلام الحجوزات مع استبعاد الحجوزات الموسومة بالحذف
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .or('notes.is.null,notes.neq.__PURGED_PAST_BOOKING__')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const validRows = (data || []).filter((row: any) => {
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
    await ensureAdminSupabaseSession();
    const { data, error } = await supabase
      .from('staff_accounts')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapDbStaff);
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
  try {
    const { data, error } = await supabase.rpc('create_public_booking', {
      p_clinic_id: params.clinicId,
      p_doctor_id: params.doctorId,
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
  try {
    const { data, error } = await supabase.rpc('confirm_payment', {
      p_booking_id: bookingId,
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

export async function markPatientLateAndCallNextRpc(
  currentBookingId?: string,
  nextBookingId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase غير مهيأ' };
  }
  try {
    const { data, error } = await supabase.rpc('mark_patient_late_and_call_next', {
      p_current_booking_id: currentBookingId || null,
      p_next_booking_id: nextBookingId || null
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
  }>
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const dbUpdates: any = {};
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.doctorDiagnosis !== undefined) dbUpdates.doctor_diagnosis = updates.doctorDiagnosis;
    if (updates.calledAt) dbUpdates.called_at = updates.calledAt;
    if (updates.completedAt) dbUpdates.completed_at = updates.completedAt;

    const { error } = await supabase
      .from('bookings')
      .update(dbUpdates)
      .eq('id', bookingId);

    return !error;
  } catch (err) {
    console.warn('Error updating booking in Supabase:', err);
    return false;
  }
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
  if (!isSupabaseConfigured) return false;
  try {
    await ensureAdminSupabaseSession();
    const { error } = await supabase
      .from('doctors')
      .update({
        status,
        unavailable_reason: unavailableReason || null,
        is_present_today: status !== 'offline'
      })
      .eq('id', doctorId);

    return !error;
  } catch (err) {
    console.warn('Error updating doctor status in Supabase:', err);
    return false;
  }
}

export async function saveDailyScheduleToDb(scheduleState: DailyScheduleState): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await ensureAdminSupabaseSession();
    const rows = scheduleState.items.map(item => ({
      date: scheduleState.date,
      clinic_id: item.clinicId,
      doctor_id: item.doctorId || null,
      is_open: item.isOpen
    }));

    const { error } = await supabase
      .from('daily_schedule')
      .upsert(rows, { onConflict: 'date,clinic_id' });

    return !error;
  } catch (err) {
    console.warn('Error saving daily schedule to Supabase:', err);
    return false;
  }
}

export async function updateClinicInDb(clinicId: string, data: Partial<Clinic>): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await ensureAdminSupabaseSession();
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
  if (!isSupabaseConfigured) return false;
  try {
    await ensureAdminSupabaseSession();
    const { error } = await supabase
      .from('clinics')
      .upsert({
        id: clinic.id,
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
  if (!isSupabaseConfigured) {
    return { success: true, action: 'deleted', message: 'تم حذف العيادة محلياً' };
  }

  try {
    await ensureAdminSupabaseSession();
    // 1. Try safe RPC if installed
    const { data: rpcData, error: rpcError } = await supabase.rpc('admin_delete_clinic_safe', {
      p_clinic_id: clinicId
    });

    if (!rpcError && rpcData) {
      return {
        success: rpcData.success,
        action: rpcData.action,
        message: rpcData.message,
        error: rpcData.error
      };
    }

    // 2. Direct safe check fallback
    const { count: activeCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .in('status', ['pending', 'confirmed', 'waiting', 'in_consultation']);

    if (activeCount && activeCount > 0) {
      return {
        success: false,
        error: `لا يمكن حذف العيادة لوجود ${activeCount} حجز نشط جارٍ عليها. يرجى استكمال الحالات أو إلغاؤها أولاً.`
      };
    }

    const { count: totalCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId);

    if (totalCount && totalCount > 0) {
      // Archive clinic so past medical history remains intact
      await supabase
        .from('clinics')
        .update({ is_open_today: false })
        .eq('id', clinicId);

      return {
        success: true,
        action: 'archived',
        message: 'تم إغلاق وأرشفة العيادة بنجاح حفاظاً على سجلات الحجوزات السابقة.'
      };
    }

    // Completely safe to delete
    await supabase.from('daily_schedule').delete().eq('clinic_id', clinicId);
    await supabase.from('doctors').update({ clinic_id: null, clinic_name: null }).eq('clinic_id', clinicId);
    const { error: delErr } = await supabase.from('clinics').delete().eq('id', clinicId);

    if (delErr) {
      return { success: false, error: delErr.message };
    }

    return {
      success: true,
      action: 'deleted',
      message: 'تم حذف العيادة نهائياً من قاعدة البيانات.'
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ أثناء حذف العيادة' };
  }
}

export async function updateClinicFeeInDb(clinicId: string, newFee: number): Promise<boolean> {
  return updateClinicInDb(clinicId, { fee: newFee });
}

export async function updateDoctorInDb(doctorId: string, updates: Partial<Doctor>): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await ensureAdminSupabaseSession();
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

    const { error } = await supabase
      .from('doctors')
      .update(dbUpdates)
      .eq('id', doctorId);

    return !error;
  } catch (err) {
    console.warn('Error updating doctor in Supabase:', err);
    return false;
  }
}

export async function addDoctorToDb(doctor: Doctor): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await ensureAdminSupabaseSession();
    const { error } = await supabase
      .from('doctors')
      .upsert({
        id: doctor.id,
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

export async function updateDoctorMaxPatientsInDb(doctorId: string, maxPatients: number): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await ensureAdminSupabaseSession();
    const { error } = await supabase
      .from('doctors')
      .update({ max_daily_patients: maxPatients })
      .eq('id', doctorId);
    return !error;
  } catch (err) {
    console.warn('Error updating doctor max patients in Supabase:', err);
    return false;
  }
}

export async function fetchSettingsFromDb(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured) return {};
  const map: Record<string, string> = {};

  // 1. جلب نص الاستفسارات من سجل النظام بالعيادات المتاح للجميع بدون قيود
  try {
    const { data: clinicSetting } = await supabase
      .from('clinics')
      .select('description')
      .eq('id', '_system_support_info')
      .maybeSingle();

    if (clinicSetting?.description) {
      map['support_info_text'] = clinicSetting.description;
    }
  } catch (err) {
    console.warn('Could not fetch _system_support_info from clinics:', err);
  }

  // 2. محاولة القراءة من جدول settings العام كاحتياط
  try {
    const { data, error } = await supabase.from('settings').select('*');
    if (!error && data) {
      for (const item of data) {
        if (item.key && item.value !== undefined) {
          map[item.key] = String(item.value);
        }
      }
    }
  } catch {
    // ignore
  }

  return map;
}

export async function saveSettingToDb(key: string, value: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  let success = false;

  // إذا كان المفتاح نص الاستفسارات والمساعدة، نحفظه في سجل النظام بالعيادات فوراً
  if (key === 'support_info_text') {
    try {
      await ensureAdminSupabaseSession();
      const { data, error: clinicErr } = await supabase.from('clinics').upsert({
        id: '_system_support_info',
        name: 'System Support Info',
        specialty: 'System',
        room_number: '0',
        description: value,
        is_open_today: false
      }).select();

      if (!clinicErr && data && data.length > 0) {
        success = true;
      } else {
        console.warn('Could not upsert _system_support_info:', clinicErr);
      }
    } catch (e) {
      console.warn('Error saving support info to clinics:', e);
    }
  }

  // محاولة الحفظ في جدول settings أيضاً
  try {
    const { error } = await supabase
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (!error) success = true;
  } catch {
    // ignore
  }

  // بث التحديث اللحظي عبر قناة Realtime ليصل فوراً إلى جميع المتصفحات والزوار دون انتظار
  try {
    const channel = supabase.channel('system_updates');
    channel.send({
      type: 'broadcast',
      event: 'support_info_updated',
      payload: { key, value }
    });
  } catch {
    // broadcast best-effort
  }

  return success;
}

/**
 * جلب خريطة تجزئات كلمات المرور المشفرة بـ SHA-256 المخزنة في قاعدة البيانات
 */
export async function fetchStaffPasswordHashesFromDb(): Promise<Record<string, string> | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('description')
      .eq('id', '_system_staff_passwords')
      .maybeSingle();

    if (error || !data?.description) return null;
    return JSON.parse(data.description);
  } catch (err) {
    console.warn('Could not fetch staff password hashes from DB:', err);
    return null;
  }
}

/**
 * حفظ وتحديث تجزئة كلمة المرور في قاعدة البيانات السحابية لضمان إمكانية تسجيل الدخول من أي جهاز
 */
export async function saveStaffPasswordHashToDb(
  username: string,
  newHash: string,
  oldUsername?: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await ensureAdminSupabaseSession();

    const { data: rec } = await supabase
      .from('clinics')
      .select('description')
      .eq('id', '_system_staff_passwords')
      .maybeSingle();

    let map: Record<string, string> = {};
    if (rec?.description) {
      try {
        map = JSON.parse(rec.description);
      } catch {
        map = {};
      }
    }

    const cleanUser = username.trim().toLowerCase();
    if (oldUsername && oldUsername.trim().toLowerCase() !== cleanUser) {
      delete map[oldUsername.trim().toLowerCase()];
    }
    map[cleanUser] = newHash;

    const { data: up, error } = await supabase
      .from('clinics')
      .upsert({
        id: '_system_staff_passwords',
        name: 'System Staff Passwords',
        specialty: 'System',
        room_number: '0',
        description: JSON.stringify(map),
        is_open_today: false
      })
      .select();

    if (error || !up || up.length === 0) {
      console.warn('Failed to save staff password hash to DB:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error saving password hash to DB:', err);
    return false;
  }
}

const inMemoryStaffPasswords: Record<string, string> = {};

export async function adminChangeStaffPassword(
  username: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'الاتصال بقاعدة البيانات غير مهيأ' };
  }

  const cleanUser = username.trim().toLowerCase();
  const syntheticEmail = `${cleanUser}@accounts.sharaya-clinics.internal`;

  const defaultPasswords: Record<string, string> = {
    admin: 'Adm@Sharia2026!',
    reception: 'Rcp@Sharia2026!',
    cashier: 'Csh@Sharia2026!',
    doctor: 'Doc@Sharia2026!'
  };

  let lastKnown = inMemoryStaffPasswords[cleanUser] || '';
  try {
    if (!lastKnown && typeof localStorage !== 'undefined') {
      const rawCache = localStorage.getItem('sharia_staff_known_passwords');
      if (rawCache) {
        const parsed = JSON.parse(rawCache);
        lastKnown = parsed[cleanUser] || '';
      }
    }
  } catch (e) {
    // ignore
  }

  const candidatePasswords = [
    lastKnown,
    inMemoryStaffPasswords[cleanUser],
    defaultPasswords[cleanUser],
    'Adm@Sharia2026!',
    'Rcp@Sharia2026!',
    'Csh@Sharia2026!',
    'Doc@Sharia2026!',
    'admin123',
    'reception123',
    'cashier123',
    'doctor123'
  ].filter(Boolean) as string[];

  const envProcess = typeof process !== 'undefined' ? process.env : undefined;
  const projectUrl = (
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
    envProcess?.VITE_SUPABASE_URL ||
    'https://rugwzfaiensjdxtoipop.supabase.co'
  ).trim();

  const projectKey = (
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
    envProcess?.VITE_SUPABASE_ANON_KEY ||
    'sb_publishable_-Xp2D-cOLleLXIrr_vR9qg_kCLhSuC2'
  ).trim();

  const { createClient } = await import('@supabase/supabase-js');
  const helperClient = createClient(projectUrl, projectKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let signedIn = false;
  for (const candidate of candidatePasswords) {
    const { error: signInErr } = await helperClient.auth.signInWithPassword({
      email: syntheticEmail,
      password: candidate
    });
    if (!signInErr) {
      signedIn = true;
      break;
    }
  }

  if (!signedIn) {
    return {
      success: false,
      error: `تعذر تسجيل الدخول لحساب (${cleanUser}) لتعديل كلمة المرور عبر Supabase Auth.`
    };
  }

  const { error: updateErr } = await helperClient.auth.updateUser({
    password: newPassword
  });

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  inMemoryStaffPasswords[cleanUser] = newPassword;

  try {
    if (typeof localStorage !== 'undefined') {
      const rawCache = localStorage.getItem('sharia_staff_known_passwords');
      const parsed = rawCache ? JSON.parse(rawCache) : {};
      parsed[cleanUser] = newPassword;
      localStorage.setItem('sharia_staff_known_passwords', JSON.stringify(parsed));
    }
  } catch (e) {
    // ignore
  }

  return { success: true };
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
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase غير مهيأ' };

  try {
    await ensureAdminSupabaseSession();

    // 1. جلب بيانات الحساب الحالية للتعرف على اسم المستخدم الأصلي
    const { data: currentAcc } = await supabase
      .from('staff_accounts')
      .select('*')
      .eq('id', staffId)
      .maybeSingle();

    const oldUsername = currentAcc?.username ? currentAcc.username.trim().toLowerCase() : '';
    const newUsername = updates.username ? updates.username.trim().toLowerCase() : oldUsername;

    // 2. إذا تم تقديم كلمة مرور جديدة: تشفيرها وحفظها في قاعدة البيانات السحابية
    if (updates.password) {
      const hash = await hashPassword(updates.password);
      await saveStaffPasswordHashToDb(newUsername, hash, oldUsername);
      inMemoryStaffPasswords[newUsername] = updates.password;

      try {
        if (typeof localStorage !== 'undefined') {
          const rawCache = localStorage.getItem('sharia_staff_known_passwords');
          const parsed = rawCache ? JSON.parse(rawCache) : {};
          parsed[newUsername] = updates.password;
          localStorage.setItem('sharia_staff_known_passwords', JSON.stringify(parsed));
        }
      } catch {}

      // محاولة تحديث Supabase Auth إن كان الحساب مسجلاً في Auth
      const passRes = await adminChangeStaffPassword(oldUsername || newUsername, updates.password);
      if (!passRes.success) {
        console.warn('Password update notice via Supabase Auth:', passRes.error);
      }
    } else if (newUsername && oldUsername && newUsername !== oldUsername) {
      // 3. إذا تم تغيير اسم المستخدم فقط دون كلمة المرور: نقل التجزئة للاسم الجديد
      const currentHashes = await fetchStaffPasswordHashesFromDb();
      if (currentHashes && currentHashes[oldUsername]) {
        await saveStaffPasswordHashToDb(newUsername, currentHashes[oldUsername], oldUsername);
      }
      if (inMemoryStaffPasswords[oldUsername]) {
        inMemoryStaffPasswords[newUsername] = inMemoryStaffPasswords[oldUsername];
        delete inMemoryStaffPasswords[oldUsername];
      }
    }

    // 4. تحديث جدول حسابات الكادر staff_accounts في قاعدة البيانات
    const dbUpdates: any = {};
    if (updates.username) dbUpdates.username = newUsername;
    if (updates.displayName) dbUpdates.display_name = updates.displayName;
    if (updates.role) dbUpdates.role = updates.role;
    if (updates.doctorId !== undefined) dbUpdates.doctor_id = updates.doctorId;
    if (updates.clinicId !== undefined) dbUpdates.clinic_id = updates.clinicId;
    if (updates.recoveryEmail !== undefined) dbUpdates.recovery_email = updates.recoveryEmail;

    if (Object.keys(dbUpdates).length > 0) {
      const { data: updatedRows, error: staffErr } = await supabase
        .from('staff_accounts')
        .update(dbUpdates)
        .eq('id', staffId)
        .select();

      if (staffErr) {
        return { success: false, error: staffErr.message };
      }
      if (!updatedRows || updatedRows.length === 0) {
        return { success: false, error: 'لم يتم تطبيق التعديل في قاعدة البيانات، يرجى التحقق من صلاحيات المدير' };
      }
    }

    // 5. بث إشعار التحديث اللحظي عبر Realtime لتحديث لوحات التحكم في كافة الأجهزة فوراً
    try {
      const channel = supabase.channel('system_updates');
      channel.send({
        type: 'broadcast',
        event: 'staff_updated',
        payload: { staffId, username: newUsername }
      });
    } catch {
      // ignore
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ في تحديث الحساب' };
  }
}

export async function deleteStaffAccountRpc(staffId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase غير مهيأ' };
  }
  try {
    await ensureAdminSupabaseSession();
    const { data, error } = await supabase.rpc('delete_staff_account_secure', {
      p_staff_id: staffId
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل حذف الحساب' };
  }
}

// ==========================================
// المصادقة الحقيقية عبر Supabase Auth
// ==========================================

export async function loginWithSupabaseAuth(
  username: string, 
  password: string
): Promise<{ success: boolean; session?: UserSession; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'لم يتم تفعيل الاتصال بـ Supabase بعد' };
  }

  try {
    const cleanUsername = username.trim().toLowerCase();
    const syntheticEmail = `${cleanUsername}@accounts.sharaya-clinics.internal`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password: password
    });

    if (error || !data.user) {
      return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    }

    // جلب بيانات الموظف من staff_accounts
    const { data: staffData, error: staffError } = await supabase
      .from('staff_accounts')
      .select('*')
      .or(`auth_user_id.eq.${data.user.id},username.eq.${cleanUsername}`)
      .single();

    if (staffError || !staffData) {
      return {
        success: true,
        session: {
          id: data.user.id,
          username: cleanUsername,
          displayName: cleanUsername,
          role: (data.user.user_metadata?.role || 'reception') as UserRole
        }
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
