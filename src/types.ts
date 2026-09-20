export type UserRole = 'admin' | 'doctor' | 'reception' | 'cashier';

export type DoctorStatus = 'available' | 'break' | 'busy' | 'offline';

export type BookingStatus = 'waiting' | 'in-progress' | 'completed' | 'cancelled' | 'late';

export type PaymentStatus = 'paid' | 'unpaid' | 'exempt';

export type PaymentMethod = 'cash' | 'insurance' | 'charity_exempt';

export interface Clinic {
  id: string;
  name: string;
  iconName: string;
  specialty?: string;
  department?: string;
  description?: string;
  fee: number;
  room: string;
  floor: string;
  active?: boolean;
  isActive?: boolean;
  code?: string;
  workingDays?: string[];
  workingHours?: string;
}

export interface Doctor {
  id: string;
  name: string;
  clinicId: string;
  clinicName: string;
  title: string;
  scheduleDays: string[];
  scheduleHours: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  status: DoctorStatus;
  unavailableReason?: string;
  maxDailyBookings?: number;
  currentQueueNumber?: number;
  bio?: string;
  phone?: string;
}

export interface Booking {
  id: string;
  ticketNumber: string;
  patientName: string;
  patientPhone: string;
  nationalId?: string;
  clinicId: string;
  clinicName: string;
  doctorId: string;
  doctorName: string;
  date: string;
  timeSlot: string;
  queuePosition: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  fee: number;
  notes?: string;
  doctorDiagnosis?: string;
  createdAt: string;
  calledAt?: string;
  completedAt?: string;
  paidAt?: string;
  paymentMethod?: PaymentMethod;
}

export interface UserSession {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  doctorId?: string;
  clinicId?: string;
}

export interface StaffAccount {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  doctorId?: string;
  clinicId?: string;
  recoveryEmail?: string;
}

export type AppView = 
  | 'landing' 
  | 'booking' 
  | 'ticket' 
  | 'queue'
  | 'login' 
  | 'reception' 
  | 'doctor' 
  | 'cashier' 
  | 'admin';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

export interface DailyClinicScheduleItem {
  clinicId: string;
  isOpen: boolean;
  doctorId: string;
}

export interface DailyScheduleState {
  date: string;
  items: DailyClinicScheduleItem[];
}

export type SystemPermission = 
  | 'manage_doctor_attendance'
  | 'manage_daily_clinics'
  | 'manage_clinic_fees'
  | 'view_financial_reports'
  | 'manage_patient_exemptions';

export interface PermissionDefinition {
  key: SystemPermission;
  name: string;
  description: string;
}

export type RolePermissionsMap = Record<UserRole, SystemPermission[]>;
