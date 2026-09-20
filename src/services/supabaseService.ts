import { supabase, isSupabaseConfigured } from './supabaseClient';
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
    return (data || []).map(mapDbClinic);
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
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapDbBooking);
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

export async function updateDoctorStatusInDb(
  doctorId: string,
  status: DoctorStatus,
  unavailableReason?: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
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

export async function updateClinicFeeInDb(clinicId: string, newFee: number): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase
      .from('clinics')
      .update({ price: newFee })
      .eq('id', clinicId);
    return !error;
  } catch (err) {
    console.warn('Error updating clinic fee in Supabase:', err);
    return false;
  }
}

export async function updateDoctorMaxPatientsInDb(doctorId: string, maxPatients: number): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
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

export async function deleteStaffAccountRpc(staffId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase غير مهيأ' };
  }
  try {
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

export function subscribeToBookingsRealtime(onUpdate: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};

  try {
    const channel = supabase
      .channel('public:bookings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (e) {
    console.warn('Realtime subscription error:', e);
    return () => {};
  }
}
