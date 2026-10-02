export type UserRole = 'admin' | 'doctor' | 'reception' | 'cashier' | 'finance_manager';

export type DoctorStatus = 'available' | 'break' | 'busy' | 'offline';

export type BookingStatus = 'waiting' | 'in-progress' | 'completed' | 'cancelled' | 'late';

export type PaymentStatus = 'paid' | 'unpaid' | 'exempt';

export type PaymentMethod = 'cash' | 'insurance' | 'charity_exempt' | 'consultation';

export interface InsuranceCompanyContract {
  id: string;
  companyName: string;
  name?: string;
  cardCategories: string[];
  defaultCopayHint?: string;
  notes?: string;
  isActive: boolean;
  active?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface BookingInsuranceDetails {
  bookingId?: string;
  companyId: string;
  companyName: string;
  cardCategory: string;
  cardNumber: string;
  copayInputRaw: string;
  copayRateText?: string;
  copayPercentage: number;
  originalFee: number;
  originalClinicFee?: number;
  patientPaidAmount: number;
  insuranceCoveredAmount: number;
  insuranceClaimAmount?: number;
  recordedBy?: string;
  recordedAt?: string;
}

export type ShiftHandoverType =
  | 'reception_shift'
  | 'cashier_to_management'
  | 'cashier_to_colleague';

export type ShiftHandoverStatus =
  | 'delivered_to_management'
  | 'pending_colleague'
  | 'accepted_exact'
  | 'discrepancy_reported';

export interface ShiftHandoverRecord {
  id: string;
  department: 'reception' | 'cashier';
  fromStaffId: string;
  fromStaffUsername: string;
  fromStaffName: string;
  toStaffId: string;
  toStaffUsername: string;
  toStaffName: string;
  handoverType: ShiftHandoverType;
  expectedAmount?: number;
  actualReceivedAmount?: number;
  status: ShiftHandoverStatus;
  notes?: string;
  acknowledgmentNotes?: string;
  createdAt: string;
  acknowledgedAt?: string;
  shiftDate: string;
  managerApproved?: boolean;
  managerApprovedBy?: string;
  managerApprovedAt?: string;
  managerNotes?: string;
}

export type ExpenseCategory =
  | 'medical_supplies'
  | 'utilities_bills'
  | 'utilities_maintenance'
  | 'maintenance'
  | 'hospitality'
  | 'hospitality_Allowance'
  | 'refund_return'
  | 'petty_cash'
  | 'other';

export interface FinanceExpenseRecord {
  id: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  title: string;
  recipient?: string;
  recipientName?: string;
  notes?: string;
  recordedBy: string;
  recordedByUsername: string;
  createdBy?: string;
  createdAt: string;
}

export interface InsuranceClaimSettlementRecord {
  id: string;
  companyId?: string;
  companyName: string;
  settlementDate: string;
  paymentDate?: string;
  periodFrom?: string;
  periodTo?: string;
  claimedAmount?: number;
  paidAmount: number;
  amountPaid?: number;
  paymentMethod?: 'bank_transfer' | 'cheque' | 'cash';
  paymentReference?: string;
  referenceNumber?: string;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface DoctorCommissionRule {
  doctorId: string;
  doctorName: string;
  clinicId: string;
  clinicName: string;
  consultationFee: number;
  targetCasesCount: number;
  targetPercentage: number;
  belowCasesCount: number;
  belowPercentage: number;
  aboveCasesCount: number;
  abovePercentage: number;
  notes?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface FinanceLedgerState {
  expenses: FinanceExpenseRecord[];
  settlements: InsuranceClaimSettlementRecord[];
  doctorCommissionRules?: Record<string, DoctorCommissionRule>;
}

export interface SelectivePurgeOptions {
  purgePastBookings: boolean;
  purgeAllBookings: boolean;
  beforeDate?: string;
  purgeShiftHandovers: boolean;
  purgeFinanceExpenses?: boolean;
  purgeConsultationStamps: boolean;
  purgeWhatsAppAndPrintLogs: boolean;
  purgeSystemErrorLogs: boolean;
}

export interface ConsultationStamp {
  phone: string;
  patientName?: string;
  clinicId: string;
  examDate: string;
  updatedAt: string;
}

export interface ConsultationRegistryState {
  windowDays: number;
  clinicWindows?: Record<string, number>;
  stamps: ConsultationStamp[];
  consultationBookingIds: string[];
}

export interface Clinic {
  id: string;
  name: string;
  iconName: string;
  icon?: string;
  specialty?: string;
  department?: string;
  description?: string;
  fee: number;
  room: string;
  floor: string;
  active?: boolean;
  isActive?: boolean;
  isOpenToday?: boolean;
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
  insuranceDetails?: BookingInsuranceDetails;
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
  authUserId?: string;
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
  | 'finance'
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
  | 'confirm_payments_exemptions'
  | 'call_queue_patients'
  | 'manage_patient_exemptions'
  | 'manage_insurance_contracts'
  | 'selective_data_purge';

export interface PermissionDefinition {
  key: SystemPermission;
  name: string;
  description: string;
}

export type RolePermissionsMap = Record<UserRole, SystemPermission[]>;

export type SystemErrorSource =
  | 'ErrorBoundary'
  | 'vite:preloadError'
  | 'ChunkLoadError'
  | 'RuntimeError'
  | 'UnhandledRejection';

export interface SystemErrorLog {
  id: string;
  source: SystemErrorSource;
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  deviceInfo: string;
  userRole?: string;
  username?: string;
  timestamp: string;
  resolved?: boolean;
  syncedToDb?: boolean;
}

export type SystemLicenseMode = 'trial' | 'permanent' | 'locked';

export interface SystemTrialLicenseConfig {
  mode: SystemLicenseMode;
  trialDays: number;
  startedAt: string;
  expiresAt: string;
  showBannerToStaff: boolean;
  lockPublicPagesOnExpiry: boolean;
  blockDevTools?: boolean;
  lockMessage: string;
  developerPhone?: string;
  updatedAt: string;
}


