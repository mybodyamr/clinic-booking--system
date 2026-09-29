import express, { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ALLOWED_STAFF_ROLES = ['admin', 'doctor', 'reception', 'cashier'] as const;
export type StaffRole = (typeof ALLOWED_STAFF_ROLES)[number];

export interface VerifiedStaffCaller {
  authUserId: string;
  staffId: string;
  username: string;
  displayName: string;
  role: StaffRole;
  doctorId: string | null;
  clinicId: string | null;
}

export interface AuthenticatedRequest extends Request {
  staffCaller?: VerifiedStaffCaller;
}

function sanitizeServerText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .replace(/(?:javascript|data|vbscript):/gi, '')
    .replace(/\bon\w+\s*=/gi, '')
    .trim();
}

function buildSyntheticAuthEmail(username: string): string {
  return `${username.trim().toLowerCase()}@accounts.sharaya-clinics.internal`;
}

function formatStaffAccountResponse(row: any) {
  return {
    id: row.id,
    authUserId: row.auth_user_id || null,
    auth_user_id: row.auth_user_id || null,
    username: row.username,
    displayName: row.display_name,
    display_name: row.display_name,
    role: row.role,
    doctorId: row.doctor_id || null,
    doctor_id: row.doctor_id || null,
    clinicId: row.clinic_id || null,
    clinic_id: row.clinic_id || null,
    recoveryEmail: row.recovery_email || null,
    recovery_email: row.recovery_email || null,
    createdAt: row.created_at || null,
    created_at: row.created_at || null,
  };
}

async function syncFallbackPasswordHashInDb(
  adminClient: SupabaseClient,
  _username: string,
  _newPlainPassword?: string,
  _oldUsername?: string,
  _removeUser?: boolean
): Promise<void> {
  // حماية قصوى: منع تخزين أي تجزئات كلمات مرور في جدول clinics العام وإزالة أي سجل قديم إن وُجد
  try {
    await adminClient
      .from('clinics')
      .delete()
      .eq('id', '_system_staff_passwords');
  } catch {
    // ignore cleanup error
  }
}

function extractServerProjectRefFromUrl(rawUrl: string): string | null {
  if (!rawUrl) return null;
  try {
    const host = new URL(rawUrl.trim()).hostname.toLowerCase();
    if (host.endsWith('.supabase.co')) {
      return host.slice(0, -'.supabase.co'.length) || null;
    }
    return null;
  } catch {
    return null;
  }
}

function extractServerJwtProjectRef(rawKey: string): string | null {
  if (!rawKey || !rawKey.includes('.')) return null;
  try {
    const parts = rawKey.trim().split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload?.ref === 'string' ? payload.ref.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * استخراج رابط مشروع Supabase على السيرفر فقط
 * مع اشتراط تطابق VITE_SUPABASE_URL (إن وُجد) لمنع التشغيل الجزئي أثناء تحديث متغيرات البيئة
 */
const ACTIVE_MAIN_SUPABASE_URL = 'https://rugwzfaiensjdxtoipop.supabase.co';

function isDeletedServerUrl(url: string): boolean {
  if (!url) return true;
  const lower = url.toLowerCase();
  return (
    lower.includes('placeholder') ||
    lower.includes('olfpqxtmywhfhglofebc') ||
    lower.includes('cjzzjrfsuztqcnvavtau') ||
    !lower.startsWith('https://')
  );
}

function getServerServiceRoleKey(expectedUrl?: string): string {
  const candidates = [
    (process.env.SUPABASE_ADMIN_SERVICE_KEY || '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  ];
  const urlRef = expectedUrl ? extractServerProjectRefFromUrl(expectedUrl) : null;
  for (const candidate of candidates) {
    if (
      !candidate ||
      candidate.startsWith('VITE_') ||
      candidate.includes('placeholder') ||
      candidate.includes('olfpqxtmywhfhglofebc') ||
      candidate.includes('cjzzjrfsuztqcnvavtau')
    ) {
      continue;
    }
    const keyRef = extractServerJwtProjectRef(candidate);
    if (keyRef) {
      if (keyRef === 'olfpqxtmywhfhglofebc' || keyRef === 'cjzzjrfsuztqcnvavtau') {
        continue;
      }
      if (urlRef && keyRef !== urlRef) {
        continue;
      }
    }
    return candidate;
  }
  return '';
}

function getServerSupabaseUrl(): string {
  const rawProjUrl = (process.env.VITE_SUPABASE_PROJECT_URL || '').trim();
  const rawServerUrl = (process.env.SUPABASE_URL || '').trim();
  const rawViteUrl = (process.env.VITE_SUPABASE_URL || '').trim();

  if (!isDeletedServerUrl(rawProjUrl)) {
    return rawProjUrl;
  }

  const validServerUrl = !isDeletedServerUrl(rawServerUrl) ? rawServerUrl : '';
  const validViteUrl = !isDeletedServerUrl(rawViteUrl) ? rawViteUrl : '';

  if (validServerUrl && validViteUrl) {
    const serverRef = extractServerProjectRefFromUrl(validServerUrl);
    const viteRef = extractServerProjectRefFromUrl(validViteUrl);
    if (serverRef && viteRef && serverRef !== viteRef) {
      return validViteUrl;
    }
    return validServerUrl;
  }

  if (validServerUrl || validViteUrl) {
    return validServerUrl || validViteUrl;
  }

  const serviceRoleKey = getServerServiceRoleKey(ACTIVE_MAIN_SUPABASE_URL);
  if (serviceRoleKey) {
    return ACTIVE_MAIN_SUPABASE_URL;
  }

  return '';
}

/**
 * إنشاء عميل Supabase Admin باستخدام SUPABASE_SERVICE_ROLE_KEY على السيرفر حصراً.
 * ممنوع تماماً تصدير المفتاح أو طباعته أو إرساله للعميل.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = getServerSupabaseUrl();
  const serviceRoleKey = getServerServiceRoleKey(supabaseUrl);

  if (!supabaseUrl || !supabaseUrl.startsWith('https://')) {
    throw new Error('SUPABASE_URL_NOT_CONFIGURED');
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * التحقق من هوية المستخدم عبر Authorization: Bearer <Supabase Access Token>
 * ومطابقة دوره الفعلي من جدول public.staff_accounts عبر auth_user_id المرتبط بـ auth.uid()
 * دون الثقة في أي role مرسل من الـ Frontend أو user_metadata.
 */
export async function verifyStaffFromBearerToken(
  authHeader: string | undefined
): Promise<
  | { ok: true; caller: VerifiedStaffCaller }
  | { ok: false; status: number; error: string }
> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      error: 'غير مصرح: رمز المصادقة (Bearer Token) مطلوب',
    };
  }

  const accessToken = authHeader.slice('Bearer '.length).trim();
  if (!accessToken) {
    return {
      ok: false,
      status: 401,
      error: 'غير مصرح: رمز المصادقة فارغ',
    };
  }

  let adminClient: SupabaseClient;
  try {
    adminClient = getSupabaseAdminClient();
  } catch {
    return {
      ok: false,
      status: 503,
      error: 'إعدادات خادم المصادقة السحابي غير مكتملة حالياً',
    };
  }

  const { data: userData, error: authError } = await adminClient.auth.getUser(accessToken);
  if (authError || !userData?.user?.id) {
    return {
      ok: false,
      status: 401,
      error: 'غير مصرح: جلسة المستخدم غير صالحة أو منتهية الصلاحية',
    };
  }

  const authUserId = userData.user.id;

  const { data: staffRow, error: staffError } = await adminClient
    .from('staff_accounts')
    .select('id, username, display_name, role, doctor_id, clinic_id, auth_user_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (staffError || !staffRow || staffRow.auth_user_id !== authUserId) {
    return {
      ok: false,
      status: 403,
      error: 'غير مصرح: الحساب غير مرتبط بسجل موظف معتمد في المنظومة',
    };
  }

  const allowedRoles = ['admin', 'reception', 'cashier', 'doctor'] as const;
  if (!allowedRoles.includes(staffRow.role as any)) {
    return {
      ok: false,
      status: 403,
      error: 'غير مصرح: دور الوظيفة غير صالح',
    };
  }

  return {
    ok: true,
    caller: {
      authUserId,
      staffId: staffRow.id,
      username: staffRow.username,
      displayName: staffRow.display_name,
      role: staffRow.role as VerifiedStaffCaller['role'],
      doctorId: staffRow.doctor_id || null,
      clinicId: staffRow.clinic_id || null,
    },
  };
}

/**
 * Middleware للتحقق الصارم من أن المستدعي Admin معتمد في staff_accounts
 */
export async function requireAdminAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await verifyStaffFromBearerToken(req.headers.authorization);
    if (!result.ok) {
      res.status(result.status).json({ ok: false, error: result.error });
      return;
    }

    if (result.caller.role !== 'admin') {
      res.status(403).json({
        ok: false,
        error: 'غير مصرح: هذه العملية مخصصة لمدير النظام (Admin) فقط',
      });
      return;
    }

    req.staffCaller = result.caller;
    next();
  } catch {
    res.status(500).json({
      ok: false,
      error: 'تعذر التحقق من صلاحيات المستخدم',
    });
  }
}

/**
 * التحقق من أن الـ Origin ينتمي لنفس التطبيق (بدون استخدام wildcard '*')
 */
function isOriginAllowed(origin: string, req: Request): boolean {
  const normalizedOrigin = origin.replace(/\/+$/, '');

  const configuredAppUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (configuredAppUrl && normalizedOrigin === configuredAppUrl) {
    return true;
  }

  const host = req.get('host');
  if (host) {
    if (
      normalizedOrigin === `https://${host}` ||
      normalizedOrigin === `http://${host}`
    ) {
      return true;
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    if (
      normalizedOrigin === 'http://localhost:3000' ||
      normalizedOrigin === 'http://127.0.0.1:3000'
    ) {
      return true;
    }
  }

  return false;
}

export interface RecoveryEmailDispatchParams {
  toEmail: string;
  username: string;
  displayName: string;
  otpCode: string;
}

export interface ServerRecoveryOptions {
  nowProvider?: () => number;
  isEmailConfigured?: () => boolean;
  sendRecoveryEmail?: (
    params: RecoveryEmailDispatchParams
  ) => Promise<{ sent: boolean; reason?: 'NOT_CONFIGURED' | 'PROVIDER_FAILED' }>;
}

export function createApiApp(options?: ServerRecoveryOptions) {
  const app = express();
  const getNow = options?.nowProvider || (() => Date.now());

  app.disable('x-powered-by');

  // ترويسات الحماية الأمنية الشاملة (HTTP Security Headers) ضد XSS و Clickjacking و MIME Sniffing
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors *;"
    );
    next();
  });

  // إعدادات CORS آمنة ومقيدة بنطاق التطبيق نفسه فقط دون wildcard
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (origin) {
      if (!isOriginAllowed(origin, req)) {
        res.status(403).json({ ok: false, error: 'Origin not allowed by CORS' });
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, apikey, x-client-info, prefer, range, accept-profile, content-profile'
      );
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Range-Unit');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  });

  app.use(express.json({ limit: '100kb' }));

  // Endpoint الفحص الأساسي للخادم (Phase 2)
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  });

  // Endpoint التحقق من جلسة وصلاحية Admin عبر staff_accounts (Phase 2)
  app.get('/api/admin/verify', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({
      ok: true,
      caller: {
        staffId: req.staffCaller?.staffId,
        username: req.staffCaller?.username,
        role: req.staffCaller?.role,
      },
    });
  });

  // ============================================================================
  // Phase 3: إنشاء وإدارة حسابات الموظفين من لوحة Admin (حصر الصلاحية بـ Admin)
  // ============================================================================

  // 1) جلب قائمة جميع حسابات الموظفين
  app.get('/api/admin/staff', requireAdminAuth, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const adminClient = getSupabaseAdminClient();
      const { data, error } = await adminClient
        .from('staff_accounts')
        .select('id, auth_user_id, username, display_name, role, doctor_id, clinic_id, recovery_email, created_at')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (error) {
        res.status(500).json({ ok: false, error: 'تعذر جلب قائمة حسابات الموظفين' });
        return;
      }

      res.status(200).json({
        ok: true,
        staff: (data || []).map(formatStaffAccountResponse),
      });
    } catch {
      res.status(500).json({ ok: false, error: 'حدث خطأ أثناء جلب قائمة الموظفين' });
    }
  });

  // 2) إنشاء حساب موظف جديد في auth.users وربطه في public.staff_accounts
  const handleCreateStaff = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const adminClient = getSupabaseAdminClient();

      const rawUsername = req.body?.username;
      const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';
      const rawDisplayName = req.body?.displayName ?? req.body?.display_name;
      const rawRole = req.body?.role;
      const rawDoctorId = req.body?.doctorId ?? req.body?.doctor_id;
      const rawClinicId = req.body?.clinicId ?? req.body?.clinic_id;
      const rawRecoveryEmail = req.body?.recoveryEmail ?? req.body?.recovery_email;

      // أ) التحقق من اسم المستخدم
      const cleanUsername = typeof rawUsername === 'string' ? rawUsername.trim().toLowerCase() : '';
      if (!cleanUsername || !/^[a-z0-9_.-]{3,30}$/.test(cleanUsername)) {
        res.status(400).json({
          ok: false,
          error: 'اسم المستخدم غير صالح: يجب أن يتكون من 3 إلى 30 حرفاً إنجليزياً أو أرقاماً أو (._-) بدون مسافات',
        });
        return;
      }

      // ب) التحقق من كلمة المرور
      if (!rawPassword || rawPassword.length < 6) {
        res.status(400).json({
          ok: false,
          error: 'كلمة المرور مطلوبة ويجب ألا تقل عن 6 أحرف',
        });
        return;
      }

      // ج) التحقق من الاسم الظاهر
      const cleanDisplayName = sanitizeServerText(rawDisplayName);
      if (!cleanDisplayName || cleanDisplayName.length < 2) {
        res.status(400).json({
          ok: false,
          error: 'الاسم الظاهر للموظف مطلوب',
        });
        return;
      }

      // د) التحقق الصارم من الدور (admin, doctor, reception, cashier فقط)
      const cleanRole = typeof rawRole === 'string' ? rawRole.trim() : '';
      if (!ALLOWED_STAFF_ROLES.includes(cleanRole as StaffRole)) {
        res.status(400).json({
          ok: false,
          error: 'الدور الوظيفي غير صالح؛ الأدوار المسموحة فقط هي: admin, doctor, reception, cashier',
        });
        return;
      }
      const validRole = cleanRole as StaffRole;

      // هـ) التحقق من البريد الإلكتروني للاستعادة (إن وُجد)
      let cleanRecoveryEmail: string | null = null;
      if (typeof rawRecoveryEmail === 'string' && rawRecoveryEmail.trim().length > 0) {
        const emailCandidate = rawRecoveryEmail.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCandidate)) {
          res.status(400).json({
            ok: false,
            error: 'صيغة البريد الإلكتروني للاستعادة غير صحيحة',
          });
          return;
        }
        cleanRecoveryEmail = emailCandidate;
      }

      // و) التحقق من doctor_id و clinic_id في حالة دور doctor
      let finalDoctorId: string | null = null;
      let finalClinicId: string | null = null;

      if (validRole === 'doctor') {
        const candidateDocId = typeof rawDoctorId === 'string' ? rawDoctorId.trim() : '';
        if (!candidateDocId) {
          res.status(400).json({
            ok: false,
            error: 'يجب تحديد الطبيب المرتبط (doctor_id) عند إنشاء حساب بدور طبيب (doctor)',
          });
          return;
        }

        const { data: doctorRow, error: docErr } = await adminClient
          .from('doctors')
          .select('id, name, clinic_id')
          .eq('id', candidateDocId)
          .maybeSingle();

        if (docErr || !doctorRow) {
          res.status(400).json({
            ok: false,
            error: 'الطبيب المحدد (doctor_id) غير موجود في قاعدة البيانات',
          });
          return;
        }

        finalDoctorId = doctorRow.id;

        const candidateClinicId = typeof rawClinicId === 'string' ? rawClinicId.trim() : '';
        if (candidateClinicId) {
          const { data: clinicRow, error: clinicErr } = await adminClient
            .from('clinics')
            .select('id, name')
            .eq('id', candidateClinicId)
            .maybeSingle();

          if (clinicErr || !clinicRow || String(clinicRow.id).startsWith('_system')) {
            res.status(400).json({
              ok: false,
              error: 'العيادة المحددة (clinic_id) غير موجودة في قاعدة البيانات',
            });
            return;
          }

          if (doctorRow.clinic_id && doctorRow.clinic_id !== clinicRow.id) {
            res.status(400).json({
              ok: false,
              error: 'العيادة المحددة لا تتطابق مع العيادة المسجل عليها الطبيب المختار',
            });
            return;
          }

          finalClinicId = clinicRow.id;
        } else {
          finalClinicId = doctorRow.clinic_id || null;
        }
      }

      // ز) التحقق من عدم تكرار username في staff_accounts
      const { data: existingStaff } = await adminClient
        .from('staff_accounts')
        .select('id, username')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (existingStaff) {
        res.status(409).json({
          ok: false,
          error: 'اسم المستخدم مسجل بالفعل لموظف آخر في المنظومة',
        });
        return;
      }

      // ح) إنشاء المستخدم في Supabase Auth (auth.users)
      const syntheticEmail = buildSyntheticAuthEmail(cleanUsername);
      let createdAuthUserId: string | null = null;
      let shouldDeleteAuthOnRollback = false;

      const { data: createdAuth, error: createAuthError } = await adminClient.auth.admin.createUser({
        email: syntheticEmail,
        password: rawPassword,
        email_confirm: true,
        user_metadata: {
          role: validRole,
          username: cleanUsername,
          display_name: cleanDisplayName,
        },
      });

      if (createAuthError || !createdAuth?.user?.id) {
        // فحص ما إذا كان هناك حساب يتيم (Orphan) في auth.users غير مرتبط بأي صف في staff_accounts
        const { data: usersList } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const orphanUser = usersList?.users?.find(
          (u) => u.email?.toLowerCase() === syntheticEmail.toLowerCase()
        );

        if (orphanUser) {
          const { data: linkedCheck } = await adminClient
            .from('staff_accounts')
            .select('id')
            .eq('auth_user_id', orphanUser.id)
            .maybeSingle();

          if (!linkedCheck) {
            const { error: updateOrphanErr } = await adminClient.auth.admin.updateUserById(orphanUser.id, {
              password: rawPassword,
              email_confirm: true,
              user_metadata: {
                role: validRole,
                username: cleanUsername,
                display_name: cleanDisplayName,
              },
            });
            if (!updateOrphanErr) {
              createdAuthUserId = orphanUser.id;
              shouldDeleteAuthOnRollback = true;
            }
          }
        }

        if (!createdAuthUserId) {
          res.status(400).json({
            ok: false,
            error: 'تعذر إنشاء حساب المصادقة للموظف؛ قد يكون اسم المستخدم مستخدماً بالفعل',
          });
          return;
        }
      } else {
        createdAuthUserId = createdAuth.user.id;
        shouldDeleteAuthOnRollback = true;
      }

      // ط) إدراج السجل في public.staff_accounts مع ربط auth_user_id
      const slug = cleanUsername.replace(/[^a-z0-9]/g, '-') || validRole;
      const newStaffId = `staff-${slug}-${Date.now().toString().slice(-6)}`;

      const { data: insertedStaff, error: insertStaffError } = await adminClient
        .from('staff_accounts')
        .insert({
          id: newStaffId,
          auth_user_id: createdAuthUserId,
          username: cleanUsername,
          display_name: cleanDisplayName,
          role: validRole,
          doctor_id: finalDoctorId,
          clinic_id: finalClinicId,
          recovery_email: cleanRecoveryEmail,
        })
        .select('id, auth_user_id, username, display_name, role, doctor_id, clinic_id, recovery_email, created_at')
        .single();

      if (insertStaffError || !insertedStaff) {
        // Rollback تلقائي في حال فشل الإدراج في staff_accounts لمنع بقاء حساب يتيم في auth.users
        if (shouldDeleteAuthOnRollback && createdAuthUserId) {
          try {
            await adminClient.auth.admin.deleteUser(createdAuthUserId);
          } catch {
            // ignore rollback cleanup error
          }
        }
        res.status(500).json({
          ok: false,
          error: 'فشل حفظ سجل الموظف في قاعدة البيانات وتم التراجع عن إنشاء حساب المصادقة تلقائياً',
        });
        return;
      }

      // ي) مزامنة التجزئة الاحتياطية لدعم وضع Offline/Local Fallback
      await syncFallbackPasswordHashInDb(adminClient, cleanUsername, rawPassword);

      res.status(201).json({
        ok: true,
        staff: formatStaffAccountResponse(insertedStaff),
      });
    } catch {
      res.status(500).json({
        ok: false,
        error: 'حدث خطأ داخلي أثناء إنشاء حساب الموظف',
      });
    }
  };

  app.post('/api/admin/staff', requireAdminAuth, handleCreateStaff);
  app.post('/api/admin/create-staff', requireAdminAuth, handleCreateStaff);

  // 3) تعديل بيانات حساب موظف حالي (مع تحديث auth.users و staff_accounts)
  const handleUpdateStaff = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const adminClient = getSupabaseAdminClient();
      const staffId = String(req.params.id || '').trim();

      if (!staffId) {
        res.status(400).json({ ok: false, error: 'معرف حساب الموظف مطلوب' });
        return;
      }

      const { data: currentAcc, error: fetchErr } = await adminClient
        .from('staff_accounts')
        .select('*')
        .eq('id', staffId)
        .maybeSingle();

      if (fetchErr || !currentAcc) {
        res.status(404).json({ ok: false, error: 'حساب الموظف غير موجود' });
        return;
      }

      const oldUsername = String(currentAcc.username || '').trim().toLowerCase();
      let effectiveUsername = oldUsername;

      if (req.body?.username !== undefined) {
        const candidateUsername = String(req.body.username || '').trim().toLowerCase();
        if (!candidateUsername || !/^[a-z0-9_.-]{3,30}$/.test(candidateUsername)) {
          res.status(400).json({
            ok: false,
            error: 'اسم المستخدم غير صالح: يجب أن يتكون من 3 إلى 30 حرفاً إنجليزياً أو أرقاماً أو (._-) بدون مسافات',
          });
          return;
        }

        // حماية اسم المستخدم الأساسي admin من التغيير
        if (oldUsername === 'admin' && candidateUsername !== 'admin') {
          res.status(400).json({
            ok: false,
            error: 'لا يمكن تغيير اسم المستخدم للحساب الإداري الرئيسي (admin)',
          });
          return;
        }

        if (candidateUsername !== oldUsername) {
          const { data: dupCheck } = await adminClient
            .from('staff_accounts')
            .select('id')
            .ilike('username', candidateUsername)
            .neq('id', staffId)
            .maybeSingle();

          if (dupCheck) {
            res.status(409).json({
              ok: false,
              error: 'اسم المستخدم الجديد مسجل بالفعل لموظف آخر',
            });
            return;
          }
          effectiveUsername = candidateUsername;
        }
      }

      let effectiveDisplayName = String(currentAcc.display_name || '');
      const rawDisplayName = req.body?.displayName ?? req.body?.display_name;
      if (rawDisplayName !== undefined) {
        const cleanName = sanitizeServerText(rawDisplayName);
        if (!cleanName || cleanName.length < 2) {
          res.status(400).json({ ok: false, error: 'الاسم الظاهر للموظف لا يمكن أن يكون فارغاً' });
          return;
        }
        effectiveDisplayName = cleanName;
      }

      let effectiveRole = currentAcc.role as StaffRole;
      if (req.body?.role !== undefined) {
        const candidateRole = String(req.body.role || '').trim();
        if (!ALLOWED_STAFF_ROLES.includes(candidateRole as StaffRole)) {
          res.status(400).json({
            ok: false,
            error: 'الدور الوظيفي غير صالح؛ الأدوار المسموحة فقط هي: admin, doctor, reception, cashier',
          });
          return;
        }

        if (currentAcc.role === 'admin' && candidateRole !== 'admin') {
          if (oldUsername === 'admin') {
            res.status(400).json({
              ok: false,
              error: 'لا يمكن تغيير الدور الوظيفي لحساب المدير الرئيسي (admin)',
            });
            return;
          }
          const { count: adminCount } = await adminClient
            .from('staff_accounts')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'admin');

          if ((adminCount ?? 0) <= 1) {
            res.status(400).json({
              ok: false,
              error: 'لا يمكن تغيير دور آخر حساب مدير متبقٍ في المنظومة',
            });
            return;
          }
        }
        effectiveRole = candidateRole as StaffRole;
      }

      let effectiveRecoveryEmail: string | null = currentAcc.recovery_email || null;
      const rawRecoveryEmail = req.body?.recoveryEmail ?? req.body?.recovery_email;
      if (rawRecoveryEmail !== undefined) {
        if (rawRecoveryEmail === null || String(rawRecoveryEmail).trim() === '') {
          effectiveRecoveryEmail = null;
        } else {
          const emailCandidate = String(rawRecoveryEmail).trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCandidate)) {
            res.status(400).json({
              ok: false,
              error: 'صيغة البريد الإلكتروني للاستعادة غير صحيحة',
            });
            return;
          }
          effectiveRecoveryEmail = emailCandidate;
        }
      }

      const rawPassword = typeof req.body?.password === 'string' && req.body.password.length > 0
        ? req.body.password
        : undefined;
      if (rawPassword !== undefined && rawPassword.length < 6) {
        res.status(400).json({
          ok: false,
          error: 'يجب ألا تقل كلمة المرور الجديدة عن 6 أحرف',
        });
        return;
      }

      let effectiveDoctorId: string | null = null;
      let effectiveClinicId: string | null = null;

      if (effectiveRole === 'doctor') {
        const rawDocId = req.body?.doctorId !== undefined
          ? req.body.doctorId
          : req.body?.doctor_id !== undefined
          ? req.body.doctor_id
          : currentAcc.doctor_id;
        const candidateDocId = typeof rawDocId === 'string' ? rawDocId.trim() : '';

        if (!candidateDocId) {
          res.status(400).json({
            ok: false,
            error: 'يجب تحديد الطبيب المرتبط (doctor_id) لحساب الطبيب',
          });
          return;
        }

        const { data: doctorRow, error: docErr } = await adminClient
          .from('doctors')
          .select('id, clinic_id')
          .eq('id', candidateDocId)
          .maybeSingle();

        if (docErr || !doctorRow) {
          res.status(400).json({
            ok: false,
            error: 'الطبيب المحدد (doctor_id) غير موجود في قاعدة البيانات',
          });
          return;
        }

        effectiveDoctorId = doctorRow.id;

        const rawClnId = req.body?.clinicId !== undefined
          ? req.body.clinicId
          : req.body?.clinic_id !== undefined
          ? req.body.clinic_id
          : doctorRow.clinic_id || currentAcc.clinic_id;
        const candidateClinicId = typeof rawClnId === 'string' ? rawClnId.trim() : '';

        if (candidateClinicId) {
          const { data: clinicRow, error: clinicErr } = await adminClient
            .from('clinics')
            .select('id')
            .eq('id', candidateClinicId)
            .maybeSingle();

          if (clinicErr || !clinicRow || String(clinicRow.id).startsWith('_system')) {
            res.status(400).json({
              ok: false,
              error: 'العيادة المحددة (clinic_id) غير موجودة في قاعدة البيانات',
            });
            return;
          }

          if (doctorRow.clinic_id && doctorRow.clinic_id !== clinicRow.id) {
            res.status(400).json({
              ok: false,
              error: 'العيادة المحددة لا تتطابق مع عيادة الطبيب المختار',
            });
            return;
          }
          effectiveClinicId = clinicRow.id;
        } else {
          effectiveClinicId = doctorRow.clinic_id || null;
        }
      }

      // تحديث حساب auth.users المرتبط فقط إذا كان الحساب مرتبطاً مسبقاً بـ auth_user_id
      // (ممنوع إنشاء حساب سحابي تلقائياً لأي حساب قديم غير مرتبط بـ auth_user_id أو استخدام كلمة مرور افتراضية)
      const effectiveAuthUserId: string | null = currentAcc.auth_user_id || null;
      const syntheticEmail = buildSyntheticAuthEmail(effectiveUsername);

      if (effectiveAuthUserId) {
        const authUpdates: Record<string, any> = {
          email: syntheticEmail,
          email_confirm: true,
          user_metadata: {
            role: effectiveRole,
            username: effectiveUsername,
            display_name: effectiveDisplayName,
          },
        };
        if (rawPassword) {
          authUpdates.password = rawPassword;
        }

        const { error: authUpdErr } = await adminClient.auth.admin.updateUserById(
          effectiveAuthUserId,
          authUpdates
        );

        if (authUpdErr) {
          res.status(400).json({
            ok: false,
            error: 'تعذر تحديث بيانات المصادقة لهذا الحساب',
          });
          return;
        }
      } else if (rawPassword) {
        res.status(400).json({
          ok: false,
          error: `الحساب (${oldUsername}) هو حساب محلي قديم غير مرتبط بـ Supabase Auth؛ لا يتم إنشاء أو ربط حساب سحابي له تلقائياً أثناء التعديل.`,
        });
        return;
      }

      const { data: updatedStaff, error: updStaffErr } = await adminClient
        .from('staff_accounts')
        .update({
          auth_user_id: effectiveAuthUserId,
          username: effectiveUsername,
          display_name: effectiveDisplayName,
          role: effectiveRole,
          doctor_id: effectiveDoctorId,
          clinic_id: effectiveClinicId,
          recovery_email: effectiveRecoveryEmail,
        })
        .eq('id', staffId)
        .select('id, auth_user_id, username, display_name, role, doctor_id, clinic_id, recovery_email, created_at')
        .single();

      if (updStaffErr || !updatedStaff) {
        res.status(500).json({
          ok: false,
          error: 'تعذر تحديث سجل الموظف في قاعدة البيانات',
        });
        return;
      }

      if (rawPassword || effectiveUsername !== oldUsername) {
        await syncFallbackPasswordHashInDb(adminClient, effectiveUsername, rawPassword, oldUsername);
      }

      res.status(200).json({
        ok: true,
        staff: formatStaffAccountResponse(updatedStaff),
      });
    } catch {
      res.status(500).json({
        ok: false,
        error: 'حدث خطأ داخلي أثناء تحديث حساب الموظف',
      });
    }
  };

  app.put('/api/admin/staff/:id', requireAdminAuth, handleUpdateStaff);
  app.patch('/api/admin/staff/:id', requireAdminAuth, handleUpdateStaff);

  // 4) إعادة تعيين كلمة مرور موظف بواسطة Admin
  const handleResetStaffPassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const adminClient = getSupabaseAdminClient();
      const targetId = String(req.params.id || req.body?.staffId || req.body?.id || '').trim();
      const targetUsername = String(req.body?.username || '').trim().toLowerCase();
      const newPassword = typeof req.body?.newPassword === 'string'
        ? req.body.newPassword
        : typeof req.body?.password === 'string'
        ? req.body.password
        : '';

      if (!newPassword || newPassword.length < 6) {
        res.status(400).json({
          ok: false,
          error: 'كلمة المرور الجديدة مطلوبة ويجب ألا تقل عن 6 أحرف',
        });
        return;
      }

      let query = adminClient.from('staff_accounts').select('*');
      if (targetId) {
        query = query.eq('id', targetId);
      } else if (targetUsername) {
        query = query.ilike('username', targetUsername);
      } else {
        res.status(400).json({
          ok: false,
          error: 'يجب تحديد معرف الموظف أو اسم المستخدم لإعادة تعيين كلمة المرور',
        });
        return;
      }

      const { data: staffRow, error: staffErr } = await query.maybeSingle();
      if (staffErr || !staffRow) {
        res.status(404).json({
          ok: false,
          error: 'حساب الموظف غير موجود',
        });
        return;
      }

      const cleanUsername = String(staffRow.username).trim().toLowerCase();
      const syntheticEmail = buildSyntheticAuthEmail(cleanUsername);
      const authUserId: string | null = staffRow.auth_user_id || null;

      if (!authUserId) {
        res.status(400).json({
          ok: false,
          error: `الحساب (${cleanUsername}) غير مرتبط بحساب مصادقة سحابي (auth_user_id)؛ لا يتم إنشاء حساب سحابي تلقائياً دون عملية ربط مستقلة وصريحة من المدير.`,
        });
        return;
      }

      const { error: updErr } = await adminClient.auth.admin.updateUserById(authUserId, {
        email: syntheticEmail,
        password: newPassword,
        email_confirm: true,
      });
      if (updErr) {
        res.status(400).json({
          ok: false,
          error: 'تعذر تحديث كلمة المرور في خدمة المصادقة',
        });
        return;
      }

      await syncFallbackPasswordHashInDb(adminClient, cleanUsername, newPassword);

      res.status(200).json({
        ok: true,
        staffId: staffRow.id,
        username: cleanUsername,
      });
    } catch {
      res.status(500).json({
        ok: false,
        error: 'حدث خطأ داخلي أثناء إعادة تعيين كلمة المرور',
      });
    }
  };

  app.post('/api/admin/staff/:id/reset-password', requireAdminAuth, handleResetStaffPassword);
  app.patch('/api/admin/staff/:id/reset-password', requireAdminAuth, handleResetStaffPassword);
  app.post('/api/admin/staff/:id/password', requireAdminAuth, handleResetStaffPassword);
  app.patch('/api/admin/staff/:id/password', requireAdminAuth, handleResetStaffPassword);
  app.post('/api/admin/staff/reset-password', requireAdminAuth, handleResetStaffPassword);

  // 4-ب) عملية مستقلة وصريحة من Admin لإنشاء وربط حساب سحابي لحساب قديم غير مرتبط بـ auth_user_id
  app.post('/api/admin/staff/:id/link-auth', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const adminClient = getSupabaseAdminClient();
      const staffId = String(req.params.id || '').trim();
      const confirmLink = req.body?.confirmLink === true;
      const confirmedUsername = String(req.body?.username || '').trim().toLowerCase();
      const newPassword = typeof req.body?.password === 'string' ? req.body.password : '';

      if (!staffId || !confirmLink) {
        res.status(400).json({
          ok: false,
          error: 'يجب تأكيد ربط الحساب صراحةً (confirmLink: true) مع تحديد معرف الحساب',
        });
        return;
      }

      if (!newPassword || newPassword.length < 6) {
        res.status(400).json({
          ok: false,
          error: 'يجب أن يحدد المدير كلمة مرور صريحة لا تقل عن 6 أحرف لإنشاء الحساب السحابي',
        });
        return;
      }

      const { data: staffRow, error: staffErr } = await adminClient
        .from('staff_accounts')
        .select('*')
        .eq('id', staffId)
        .maybeSingle();

      if (staffErr || !staffRow) {
        res.status(404).json({ ok: false, error: 'حساب الموظف غير موجود' });
        return;
      }

      const cleanUsername = String(staffRow.username).trim().toLowerCase();
      if (!confirmedUsername || confirmedUsername !== cleanUsername) {
        res.status(400).json({
          ok: false,
          error: 'يجب توضيح وتأكيد اسم المستخدم المطابق للحساب المراد ربطه بالمصادقة السحابية',
        });
        return;
      }

      if (staffRow.auth_user_id) {
        res.status(409).json({
          ok: false,
          error: 'هذا الحساب مرتبط بالفعل بحساب مصادقة سحابي (auth_user_id)',
        });
        return;
      }

      const syntheticEmail = buildSyntheticAuthEmail(cleanUsername);
      const { data: createdAuth, error: createErr } = await adminClient.auth.admin.createUser({
        email: syntheticEmail,
        password: newPassword,
        email_confirm: true,
        user_metadata: {
          role: staffRow.role,
          username: cleanUsername,
          display_name: staffRow.display_name,
        },
      });

      if (createErr || !createdAuth?.user?.id) {
        res.status(400).json({
          ok: false,
          error: 'تعذر إنشاء حساب المصادقة السحابي لهذا الموظف',
        });
        return;
      }

      const { data: updatedStaff, error: updErr } = await adminClient
        .from('staff_accounts')
        .update({ auth_user_id: createdAuth.user.id })
        .eq('id', staffId)
        .select('id, auth_user_id, username, display_name, role, doctor_id, clinic_id, recovery_email, created_at')
        .single();

      if (updErr || !updatedStaff) {
        try {
          await adminClient.auth.admin.deleteUser(createdAuth.user.id);
        } catch {}
        res.status(500).json({
          ok: false,
          error: 'فشل ربط الحساب في قاعدة البيانات وتم التراجع تلقائياً',
        });
        return;
      }

      await syncFallbackPasswordHashInDb(adminClient, cleanUsername, newPassword);

      res.status(200).json({
        ok: true,
        staff: formatStaffAccountResponse(updatedStaff),
      });
    } catch {
      res.status(500).json({
        ok: false,
        error: 'حدث خطأ داخلي أثناء ربط الحساب بالمصادقة السحابية',
      });
    }
  });

  // 5) حذف حساب موظف من staff_accounts وحذف مستخدم auth.users المرتبط به
  app.delete('/api/admin/staff/:id', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const adminClient = getSupabaseAdminClient();
      const staffId = String(req.params.id || '').trim();

      if (!staffId) {
        res.status(400).json({ ok: false, error: 'معرف حساب الموظف مطلوب' });
        return;
      }

      const { data: targetAcc, error: fetchErr } = await adminClient
        .from('staff_accounts')
        .select('*')
        .eq('id', staffId)
        .maybeSingle();

      if (fetchErr || !targetAcc) {
        res.status(404).json({ ok: false, error: 'حساب الموظف غير موجود' });
        return;
      }

      // منع المدير من حذف حسابه الحالي المسجل به
      if (
        targetAcc.id === req.staffCaller?.staffId ||
        (targetAcc.auth_user_id && targetAcc.auth_user_id === req.staffCaller?.authUserId)
      ) {
        res.status(400).json({
          ok: false,
          error: 'لا يمكنك حذف حسابك الشخصي المسجل به حالياً',
        });
        return;
      }

      // منع حذف الحساب الإداري الرئيسي أو آخر حساب admin في المنظومة
      if (targetAcc.role === 'admin') {
        if (String(targetAcc.username).trim().toLowerCase() === 'admin') {
          res.status(400).json({
            ok: false,
            error: 'لا يمكن حذف حساب المدير الرئيسي للمنظومة (admin)',
          });
          return;
        }

        const { count: adminCount } = await adminClient
          .from('staff_accounts')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'admin');

        if ((adminCount ?? 0) <= 1) {
          res.status(400).json({
            ok: false,
            error: 'لا يمكن حذف آخر حساب مدير متبقٍ في المنظومة لضمان استمرارية الإدارة',
          });
          return;
        }
      }

      const authUserIdToDelete: string | null = targetAcc.auth_user_id || null;
      const targetUsername = String(targetAcc.username || '').trim().toLowerCase();

      const { error: deleteStaffErr } = await adminClient
        .from('staff_accounts')
        .delete()
        .eq('id', staffId);

      if (deleteStaffErr) {
        res.status(500).json({
          ok: false,
          error: 'تعذر حذف سجل الموظف من قاعدة البيانات',
        });
        return;
      }

      if (authUserIdToDelete) {
        try {
          await adminClient.auth.admin.deleteUser(authUserIdToDelete);
        } catch {
          // ignore if already removed from auth.users
        }
      }

      await syncFallbackPasswordHashInDb(adminClient, targetUsername, undefined, undefined, true);

      res.status(200).json({
        ok: true,
        deletedId: staffId,
        username: targetUsername,
      });
    } catch {
      res.status(500).json({
        ok: false,
        error: 'حدث خطأ داخلي أثناء حذف حساب الموظف',
      });
    }
  });

  // ============================================================================
  // Phase 4: استعادة كلمة المرور (Forgot Password via 6-digit OTP & One-Time Reset Token)
  // ============================================================================

  // إعدادات الأمان والصلاحية الزمنية لرموز الاستعادة
  const OTP_TTL_MS = 10 * 60 * 1000; // 10 دقائق صلاحية كود OTP
  const OTP_TTL_SECONDS = 600;
  const OTP_MAX_ATTEMPTS = 3; // بحد أقصى 3 محاولات تحقق
  const OTP_REQUEST_COOLDOWN_MS = 60 * 1000; // دقيقة واحدة بين كل طلب وآخر
  const OTP_REQUEST_COOLDOWN_SECONDS = 60;
  const RESET_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 دقائق صلاحية رمز إعادة التعيين أحادي الاستخدام
  const RESET_TOKEN_TTL_SECONDS = 300;
  const GENERIC_OTP_REQUEST_MESSAGE =
    'إذا كانت البيانات المدخلة مطابقة لحساب مفعل، فسيتم إرسال رمز التحقق المكون من 6 أرقام إلى البريد الإلكتروني المسجل.';
  const SAFE_RECOVERY_UNAVAILABLE_MESSAGE =
    'خدمة استعادة كلمة المرور غير متاحة مؤقتاً. يرجى المحاولة لاحقاً أو التواصل مع إدارة النظام.';

  // قراءة مفتاح التوقيع RECOVERY_HMAC_SECRET بشكل إلزامي وصارم دون أي Fallback مشتق أو مؤقت
  const getRecoveryHmacSecret = (): Buffer | null => {
    const rawSecret = (process.env.RECOVERY_HMAC_SECRET || '').trim();
    if (!rawSecret || rawSecret.startsWith('VITE_') || rawSecret.length < 32) {
      return null;
    }
    return Buffer.from(rawSecret, 'utf8');
  };

  // خريطة تهدئة مساعدة للطلبات الموجهة لأسماء مستخدمين غير موجودة في قاعدة البيانات فقط (لمنع كشف وجود الحساب)
  const nonExistentUserCooldownByKey = new Map<string, number>();

  const computeRecoveryHmacHex = (
    hmacSecret: Buffer,
    purpose: 'otp' | 'reset_token',
    username: string,
    requestId: string,
    secretValue: string
  ): string => {
    const prefix = purpose === 'otp' ? 'otp:' : 'token:';
    const digest = crypto
      .createHmac('sha256', hmacSecret)
      .update(`${purpose}:${username.toLowerCase()}:${requestId}:${secretValue}`)
      .digest('hex');
    return `${prefix}${digest}`;
  };

  const timingSafeStringMatch = (a: string, b: string): boolean => {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  };

  const cleanupNonExistentCooldownMap = (now: number): void => {
    for (const [key, lastAt] of nonExistentUserCooldownByKey.entries()) {
      if (now - lastAt > OTP_TTL_MS) {
        nonExistentUserCooldownByKey.delete(key);
      }
    }
  };

  const isEmailProviderConfigured = (): boolean => {
    const smtpUser = (process.env.SMTP_USER || '').trim();
    const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
    const fromEmail = (process.env.RECOVERY_FROM_EMAIL || '').trim();
    return Boolean(
      smtpUser &&
        !smtpUser.startsWith('VITE_') &&
        smtpPass &&
        !smtpPass.startsWith('VITE_') &&
        fromEmail &&
        !fromEmail.startsWith('VITE_')
    );
  };

  const sendOtpViaConfiguredEmailProvider = async (params: {
    toEmail: string;
    username: string;
    displayName: string;
    otpCode: string;
  }): Promise<{ sent: boolean; reason?: 'NOT_CONFIGURED' | 'PROVIDER_FAILED' }> => {
    const smtpUser = (process.env.SMTP_USER || '').trim();
    const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
    const fromEmail = (process.env.RECOVERY_FROM_EMAIL || '').trim();

    if (
      !smtpUser ||
      smtpUser.startsWith('VITE_') ||
      !smtpPass ||
      smtpPass.startsWith('VITE_') ||
      !fromEmail ||
      fromEmail.startsWith('VITE_')
    ) {
      return { sent: false, reason: 'NOT_CONFIGURED' };
    }

    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"عيادات الجمعية الشرعية" <${fromEmail}>`,
        to: params.toEmail,
        subject: 'رمز استعادة كلمة المرور - عيادات الجمعية الشرعية',
        html: `
          <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; line-height: 1.8; color: #0f172a; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
            <h2 style="color: #047857; margin-top: 0;">استعادة كلمة المرور لحساب الموظف</h2>
            <p>مرحباً <strong>${sanitizeServerText(params.displayName)}</strong> (@${sanitizeServerText(params.username)})،</p>
            <p>تم طلب رمز تحقق لإعادة تعيين كلمة المرور الخاصة بحسابك. رمز التحقق المكون من 6 أرقام هو:</p>
            <div style="background: #f8fafc; border: 2px dashed #059669; border-radius: 12px; padding: 16px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #065f46; margin: 20px 0;">
              ${params.otpCode}
            </div>
            <p style="font-size: 13px; color: #475569;">هذا الرمز صالح لمدة <strong>10 دقائق فقط</strong> وبحد أقصى ${OTP_MAX_ATTEMPTS} محاولات. إذا لم تطلب هذا الرمز، يرجى تجاهل هذه الرسالة.</p>
          </div>
        `,
        text: `رمز استعادة كلمة المرور لحساب (${params.username}): ${params.otpCode} - صالح لمدة 10 دقائق فقط.`,
      });

      return { sent: true };
    } catch {
      return { sent: false, reason: 'PROVIDER_FAILED' };
    }
  };

  const checkEmailProviderReady = options?.isEmailConfigured || isEmailProviderConfigured;
  const dispatchRecoveryEmail = options?.sendRecoveryEmail || sendOtpViaConfiguredEmailProvider;

  // 1) طلب كود استعادة OTP باستخدام اسم المستخدم وبريد الاستعادة المسجل
  app.post('/api/auth/forgot-password/request-otp', async (req: Request, res: Response) => {
    try {
      const now = getNow();
      cleanupNonExistentCooldownMap(now);

      const rawUsername = typeof req.body?.username === 'string' ? req.body.username : '';
      const rawEmail =
        typeof req.body?.recoveryEmail === 'string'
          ? req.body.recoveryEmail
          : typeof req.body?.email === 'string'
          ? req.body.email
          : '';

      const cleanUsername = rawUsername.trim().toLowerCase();
      const cleanEmail = rawEmail.trim().toLowerCase();

      if (!cleanUsername || !/^[a-z0-9_.-]{3,30}$/.test(cleanUsername)) {
        res.status(400).json({
          ok: false,
          error: 'يرجى إدخال اسم مستخدم صحيح.',
        });
        return;
      }

      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({
          ok: false,
          error: 'يرجى إدخال البريد الإلكتروني المسجل بصيغة صحيحة.',
        });
        return;
      }

      // 1. فحص إلزامي لوجود RECOVERY_HMAC_SECRET (Fail-Closed بدون أي Fallback)
      const hmacSecret = getRecoveryHmacSecret();
      if (!hmacSecret) {
        console.error(
          '[ForgotPassword] CRITICAL: RECOVERY_HMAC_SECRET is missing or invalid (must be at least 32 chars and server-only).'
        );
        res.status(503).json({
          ok: false,
          code: 'RECOVERY_SERVICE_UNAVAILABLE',
          error: SAFE_RECOVERY_UNAVAILABLE_MESSAGE,
        });
        return;
      }

      // 2. فحص جاهزية مزود البريد على الخادم أولاً
      if (!checkEmailProviderReady()) {
        res.status(503).json({
          ok: false,
          code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
          error:
            'خدمة إرسال البريد الإلكتروني غير مهيأة حالياً على الخادم. يرجى ضبط متغيرات Gmail SMTP (SMTP_USER و SMTP_PASS و RECOVERY_FROM_EMAIL) في إعدادات بيئة السيرفر.',
        });
        return;
      }

      const adminClient = getSupabaseAdminClient();

      // 3. التحقق من وجود جدول public.password_reset_codes أو التبديل الآمن لـ auth.users.app_metadata عند PGRST205
      const { data: latestResetRow, error: tableCheckErr } = await adminClient
        .from('password_reset_codes')
        .select('id, created_at')
        .eq('username', cleanUsername)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const useAppMetadataFallback = tableCheckErr?.code === 'PGRST205';

      if (tableCheckErr && !useAppMetadataFallback) {
        console.error(
          '[ForgotPassword] CRITICAL: Table public.password_reset_codes is missing or inaccessible:',
          tableCheckErr.code || 'UNKNOWN',
          tableCheckErr.message || ''
        );
        res.status(503).json({
          ok: false,
          code: 'RECOVERY_STORAGE_UNAVAILABLE',
          error: SAFE_RECOVERY_UNAVAILABLE_MESSAGE,
        });
        return;
      }

      if (!useAppMetadataFallback && latestResetRow?.created_at) {
        const lastCreatedMs = new Date(latestResetRow.created_at).getTime();
        const elapsedDbMs = now - lastCreatedMs;
        if (Number.isFinite(lastCreatedMs) && elapsedDbMs >= 0 && elapsedDbMs < OTP_REQUEST_COOLDOWN_MS) {
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((OTP_REQUEST_COOLDOWN_MS - elapsedDbMs) / 1000)
          );
          res.status(429).json({
            ok: false,
            error: `يرجى الانتظار ${retryAfterSeconds} ثانية قبل طلب رمز تحقق جديد.`,
            retryAfterSeconds,
          });
          return;
        }
      }

      // فحص Cooldown لأسماء المستخدمين غير الموجودة لمنع كشف وجود الحساب عبر تكرار الطلبات
      const cooldownKey = `user:${cleanUsername}:${cleanEmail}`;
      const lastNonExistentAt = nonExistentUserCooldownByKey.get(cooldownKey) || 0;
      const elapsedMemMs = now - lastNonExistentAt;
      if (lastNonExistentAt > 0 && elapsedMemMs < OTP_REQUEST_COOLDOWN_MS) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((OTP_REQUEST_COOLDOWN_MS - elapsedMemMs) / 1000)
        );
        res.status(429).json({
          ok: false,
          error: `يرجى الانتظار ${retryAfterSeconds} ثانية قبل طلب رمز تحقق جديد.`,
          retryAfterSeconds,
        });
        return;
      }

      const { data: staffRow, error: staffErr } = await adminClient
        .from('staff_accounts')
        .select('id, auth_user_id, username, display_name, recovery_email')
        .ilike('username', cleanUsername)
        .maybeSingle();

      const storedRecoveryEmail =
        typeof staffRow?.recovery_email === 'string'
          ? staffRow.recovery_email.trim().toLowerCase()
          : '';

      // إذا كان المستخدم غير موجود، أو غير مرتبط بـ auth_user_id، أو البريد غير مطابق:
      // نُرجع نفس الاستجابة العامة (200 OK) بدون كشف وجود الحساب أو البريد إطلاقاً
      if (
        staffErr ||
        !staffRow ||
        !staffRow.auth_user_id ||
        !storedRecoveryEmail ||
        storedRecoveryEmail !== cleanEmail
      ) {
        nonExistentUserCooldownByKey.set(cooldownKey, now);
        res.status(200).json({
          ok: true,
          message: GENERIC_OTP_REQUEST_MESSAGE,
        });
        return;
      }

      // توليد OTP عشوائي آمن من 6 أرقام وتخزين الـ HMAC فقط
      const otpCode = crypto.randomInt(100000, 1000000).toString();
      const requestId = crypto.randomUUID();
      const otpHashHex = computeRecoveryHmacHex(
        hmacSecret,
        'otp',
        cleanUsername,
        requestId,
        otpCode
      );

      if (useAppMetadataFallback) {
        const authUid = String(staffRow.auth_user_id);
        const { data: authUserRes, error: authUserErr } = await adminClient.auth.admin.getUserById(authUid);
        if (authUserErr || !authUserRes?.user) {
          res.status(503).json({
            ok: false,
            code: 'RECOVERY_STORAGE_UNAVAILABLE',
            error: SAFE_RECOVERY_UNAVAILABLE_MESSAGE,
          });
          return;
        }
        const currentMeta = (authUserRes.user.app_metadata || {}) as Record<string, any>;
        const prevReset = currentMeta.password_reset_state;
        if (prevReset?.created_at) {
          const lastMs = new Date(prevReset.created_at).getTime();
          const elapsedMs = now - lastMs;
          if (Number.isFinite(lastMs) && elapsedMs >= 0 && elapsedMs < OTP_REQUEST_COOLDOWN_MS) {
            const retryAfterSeconds = Math.max(1, Math.ceil((OTP_REQUEST_COOLDOWN_MS - elapsedMs) / 1000));
            res.status(429).json({
              ok: false,
              error: `يرجى الانتظار ${retryAfterSeconds} ثانية قبل طلب رمز تحقق جديد.`,
              retryAfterSeconds,
            });
            return;
          }
        }

        const newResetState = {
          id: requestId,
          user_id: authUid,
          username: cleanUsername,
          email: storedRecoveryEmail,
          code_hash: otpHashHex,
          attempts_left: OTP_MAX_ATTEMPTS,
          expires_at: new Date(now + OTP_TTL_MS).toISOString(),
          is_used: false,
          created_at: new Date(now).toISOString(),
        };

        const { error: saveMetaErr } = await adminClient.auth.admin.updateUserById(authUid, {
          app_metadata: {
            ...currentMeta,
            password_reset_state: newResetState,
          },
        });

        if (saveMetaErr) {
          res.status(503).json({
            ok: false,
            code: 'RECOVERY_STORAGE_UNAVAILABLE',
            error: SAFE_RECOVERY_UNAVAILABLE_MESSAGE,
          });
          return;
        }
      } else {
        const { data: rpcCreateData, error: rpcCreateErr } = await adminClient.rpc(
          'rpc_create_password_reset_otp',
          {
            p_request_id: requestId,
            p_user_id: String(staffRow.auth_user_id),
            p_username: cleanUsername,
            p_email: storedRecoveryEmail,
            p_code_hash: otpHashHex,
            p_ttl_seconds: OTP_TTL_SECONDS,
            p_cooldown_seconds: OTP_REQUEST_COOLDOWN_SECONDS,
          }
        );

        if (rpcCreateErr || !rpcCreateData) {
          console.error(
            '[ForgotPassword] CRITICAL: Failed to execute rpc_create_password_reset_otp:',
            rpcCreateErr?.code || 'NO_DATA',
            rpcCreateErr?.message || ''
          );
          res.status(503).json({
            ok: false,
            code: 'RECOVERY_STORAGE_UNAVAILABLE',
            error: SAFE_RECOVERY_UNAVAILABLE_MESSAGE,
          });
          return;
        }

        if (rpcCreateData.ok !== true) {
          if (rpcCreateData.reason === 'COOLDOWN') {
            const retryAfterSeconds = Number(rpcCreateData.retry_after_seconds) || OTP_REQUEST_COOLDOWN_SECONDS;
            res.status(429).json({
              ok: false,
              error: `يرجى الانتظار ${retryAfterSeconds} ثانية قبل طلب رمز تحقق جديد.`,
              retryAfterSeconds,
            });
            return;
          }

          res.status(503).json({
            ok: false,
            code: 'RECOVERY_STORAGE_UNAVAILABLE',
            error: SAFE_RECOVERY_UNAVAILABLE_MESSAGE,
          });
          return;
        }
      }

      const emailResult = await dispatchRecoveryEmail({
        toEmail: storedRecoveryEmail,
        username: cleanUsername,
        displayName: String(staffRow.display_name || cleanUsername),
        otpCode,
      });

      if (!emailResult.sent) {
        // حذف السجل الذي تم إنشاؤه في حال فشل إرسال البريد حتى يتمكن الموظف من إعادة المحاولة دون انتظار Cooldown
        try {
          if (useAppMetadataFallback) {
            const authUid = String(staffRow.auth_user_id);
            const { data: authUserRes } = await adminClient.auth.admin.getUserById(authUid);
            if (authUserRes?.user) {
              const currentMeta = { ...(authUserRes.user.app_metadata || {}), password_reset_state: null };
              await adminClient.auth.admin.updateUserById(authUid, { app_metadata: currentMeta });
            }
          } else {
            await adminClient.from('password_reset_codes').delete().eq('id', requestId);
          }
        } catch {}

        res.status(503).json({
          ok: false,
          code: 'EMAIL_SEND_FAILED',
          error: 'تعذر إرسال رمز التحقق عبر مزود البريد الإلكتروني حالياً. يرجى المحاولة لاحقاً أو مراجعة إعدادات المزود.',
        });
        return;
      }

      res.status(200).json({
        ok: true,
        message: GENERIC_OTP_REQUEST_MESSAGE,
      });
    } catch (err: any) {
      console.error('[ForgotPassword] Unexpected error in request-otp:', err?.code || err?.name || 'ERR');
      res.status(500).json({
        ok: false,
        error: 'حدث خطأ داخلي أثناء معالجة طلب استعادة كلمة المرور.',
      });
    }
  });

  // 2) التحقق من كود OTP (صالح لمدة 10 دقائق، بحد أقصى 3 محاولات) وإصدار reset token أحادي الاستخدام (5 دقائق)
  app.post('/api/auth/forgot-password/verify-otp', async (req: Request, res: Response) => {
    try {
      const now = getNow();
      const rawUsername = typeof req.body?.username === 'string' ? req.body.username : '';
      const rawEmail =
        typeof req.body?.recoveryEmail === 'string'
          ? req.body.recoveryEmail
          : typeof req.body?.email === 'string'
          ? req.body.email
          : '';
      const rawOtp = typeof req.body?.otp === 'string' ? req.body.otp : '';

      const cleanUsername = rawUsername.trim().toLowerCase();
      const cleanEmail = rawEmail.trim().toLowerCase();
      const cleanOtp = rawOtp
        .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
        .trim();

      if (!cleanUsername || !cleanEmail || !/^\d{6}$/.test(cleanOtp)) {
        res.status(400).json({
          ok: false,
          error: 'يرجى إدخال رمز التحقق المكون من 6 أرقام بشكل صحيح.',
        });
        return;
      }

      const hmacSecret = getRecoveryHmacSecret();
      if (!hmacSecret) {
        console.error(
          '[ForgotPassword] CRITICAL: RECOVERY_HMAC_SECRET is missing or invalid during verify-otp.'
        );
        res.status(503).json({
          ok: false,
          code: 'RECOVERY_SERVICE_UNAVAILABLE',
          error: SAFE_RECOVERY_UNAVAILABLE_MESSAGE,
        });
        return;
      }

      const adminClient = getSupabaseAdminClient();
      let activeRow: any = null;
      let fallbackAuthUid = '';
      let fallbackCurrentMeta: Record<string, any> = {};

      const { data: dbActiveRow, error: fetchErr } = await adminClient
        .from('password_reset_codes')
        .select('id, username, email, code_hash, attempts_left, expires_at, is_used')
        .eq('username', cleanUsername)
        .eq('is_used', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const useAppMetadataFallback = fetchErr?.code === 'PGRST205';

      if (fetchErr && !useAppMetadataFallback) {
        console.error(
          '[ForgotPassword] CRITICAL: Failed to read public.password_reset_codes in verify-otp:',
          fetchErr.code || 'UNKNOWN',
          fetchErr.message || ''
        );
        res.status(503).json({
          ok: false,
          code: 'RECOVERY_STORAGE_UNAVAILABLE',
          error: SAFE_RECOVERY_UNAVAILABLE_MESSAGE,
        });
        return;
      }

      if (useAppMetadataFallback) {
        const { data: staffRow } = await adminClient
          .from('staff_accounts')
          .select('auth_user_id')
          .ilike('username', cleanUsername)
          .maybeSingle();
        if (staffRow?.auth_user_id) {
          fallbackAuthUid = String(staffRow.auth_user_id);
          const { data: authUserRes } = await adminClient.auth.admin.getUserById(fallbackAuthUid);
          if (authUserRes?.user) {
            fallbackCurrentMeta = (authUserRes.user.app_metadata || {}) as Record<string, any>;
            const state = fallbackCurrentMeta.password_reset_state;
            if (state && !state.is_used && String(state.username || '').toLowerCase() === cleanUsername) {
              activeRow = state;
            }
          }
        }
      } else {
        activeRow = dbActiveRow;
      }

      if (!activeRow || activeRow.is_used || !String(activeRow.code_hash || '').startsWith('otp:')) {
        res.status(400).json({
          ok: false,
          error: 'رمز التحقق غير صحيح أو منتهي الصلاحية.',
        });
        return;
      }

      const requestId = String(activeRow.id);
      const candidateOtpHashHex = computeRecoveryHmacHex(
        hmacSecret,
        'otp',
        cleanUsername,
        requestId,
        cleanOtp
      );

      // مقارنة زمنية آمنة (Timing-Safe) في Node.js قبل تمرير النتيجة للدالة الذرية في قاعدة البيانات
      const isHashMatchedInMemory =
        String(activeRow.email || '').trim().toLowerCase() === cleanEmail &&
        timingSafeStringMatch(candidateOtpHashHex, String(activeRow.code_hash));

      const rawResetToken = crypto.randomBytes(32).toString('hex');
      const newTokenHashHex = computeRecoveryHmacHex(
        hmacSecret,
        'reset_token',
        cleanUsername,
        requestId,
        rawResetToken
      );

      if (useAppMetadataFallback) {
        const expMs = new Date(activeRow.expires_at).getTime();
        if (now > expMs) {
          await adminClient.auth.admin.updateUserById(fallbackAuthUid, {
            app_metadata: {
              ...fallbackCurrentMeta,
              password_reset_state: { ...activeRow, is_used: true, attempts_left: 0 },
            },
          });
          res.status(400).json({
            ok: false,
            error: 'انتهت صلاحية رمز التحقق (10 دقائق). يرجى طلب رمز جديد.',
          });
          return;
        }

        if (Number(activeRow.attempts_left ?? 0) <= 0) {
          await adminClient.auth.admin.updateUserById(fallbackAuthUid, {
            app_metadata: {
              ...fallbackCurrentMeta,
              password_reset_state: { ...activeRow, is_used: true, attempts_left: 0 },
            },
          });
          res.status(429).json({
            ok: false,
            error: 'تم تجاوز الحد الأقصى لمحاولات التحقق (3 محاولات). يرجى طلب رمز تحقق جديد.',
          });
          return;
        }

        if (!isHashMatchedInMemory) {
          const remaining = Math.max(0, Number(activeRow.attempts_left ?? 1) - 1);
          await adminClient.auth.admin.updateUserById(fallbackAuthUid, {
            app_metadata: {
              ...fallbackCurrentMeta,
              password_reset_state: {
                ...activeRow,
                attempts_left: remaining,
                is_used: remaining <= 0,
              },
            },
          });

          if (remaining <= 0) {
            res.status(429).json({
              ok: false,
              error: 'تم تجاوز الحد الأقصى لمحاولات التحقق (3 محاولات). يرجى طلب رمز تحقق جديد.',
            });
            return;
          }

          res.status(400).json({
            ok: false,
            error: `رمز التحقق غير صحيح. المحاولات المتبقية: ${remaining}`,
          });
          return;
        }

        await adminClient.auth.admin.updateUserById(fallbackAuthUid, {
          app_metadata: {
            ...fallbackCurrentMeta,
            password_reset_state: {
              ...activeRow,
              code_hash: newTokenHashHex,
              attempts_left: 1,
              expires_at: new Date(now + RESET_TOKEN_TTL_MS).toISOString(),
              is_used: false,
            },
          },
        });
      } else {
        const { data: verifyRpcData, error: verifyRpcErr } = await adminClient.rpc(
          'rpc_verify_password_reset_otp',
          {
            p_row_id: requestId,
            p_username: cleanUsername,
            p_email: cleanEmail,
            p_candidate_otp_hash: isHashMatchedInMemory ? candidateOtpHashHex : 'otp:__mismatch__',
            p_new_token_hash: newTokenHashHex,
            p_token_ttl_seconds: RESET_TOKEN_TTL_SECONDS,
          }
        );

        if (verifyRpcErr || !verifyRpcData) {
          console.error(
            '[ForgotPassword] CRITICAL: Failed to execute rpc_verify_password_reset_otp:',
            verifyRpcErr?.code || 'NO_DATA',
            verifyRpcErr?.message || ''
          );
          res.status(503).json({
            ok: false,
            code: 'RECOVERY_STORAGE_UNAVAILABLE',
            error: SAFE_RECOVERY_UNAVAILABLE_MESSAGE,
          });
          return;
        }

        if (verifyRpcData.ok !== true) {
          const reason = String(verifyRpcData.reason || '');
          if (reason === 'EXPIRED') {
            res.status(400).json({
              ok: false,
              error: 'انتهت صلاحية رمز التحقق (10 دقائق). يرجى طلب رمز جديد.',
            });
            return;
          }

          if (reason === 'MAX_ATTEMPTS') {
            res.status(429).json({
              ok: false,
              error: 'تم تجاوز الحد الأقصى لمحاولات التحقق (3 محاولات). يرجى طلب رمز تحقق جديد.',
            });
            return;
          }

          if (reason === 'MISMATCH') {
            const remaining = Number(verifyRpcData.attempts_left ?? 1);
            res.status(400).json({
              ok: false,
              error: `رمز التحقق غير صحيح. المحاولات المتبقية: ${remaining}`,
            });
            return;
          }

          res.status(400).json({
            ok: false,
            error: 'رمز التحقق غير صحيح أو منتهي الصلاحية.',
          });
          return;
        }
      }

      res.status(200).json({
        ok: true,
        resetToken: rawResetToken,
        expiresInSeconds: Math.floor(RESET_TOKEN_TTL_MS / 1000),
      });
    } catch (err: any) {
      console.error('[ForgotPassword] Unexpected error in verify-otp:', err?.code || err?.name || 'ERR');
      res.status(500).json({
        ok: false,
        error: 'حدث خطأ داخلي أثناء التحقق من الرمز.',
      });
    }
  });

  // 3) تعيين كلمة المرور الجديدة عبر Supabase Admin API وإبطال الرمز والـ OTP المرتبطين ذرياً
  app.post('/api/auth/forgot-password/reset-password', async (req: Request, res: Response) => {
    try {
      const now = getNow();
      const rawUsername = typeof req.body?.username === 'string' ? req.body.username : '';
      const rawEmail =
        typeof req.body?.recoveryEmail === 'string'
          ? req.body.recoveryEmail
          : typeof req.body?.email === 'string'
          ? req.body.email
          : '';
      const rawResetToken = typeof req.body?.resetToken === 'string' ? req.body.resetToken : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
      const confirmPassword =
        typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : newPassword;

      const cleanUsername = rawUsername.trim().toLowerCase();
      const cleanEmail = rawEmail.trim().toLowerCase();
      const cleanResetToken = rawResetToken.trim();

      if (!cleanUsername || !cleanResetToken) {
        res.status(400).json({
          ok: false,
          error: 'بيانات جلسة استعادة كلمة المرور غير مكتملة أو غير صالحة.',
        });
        return;
      }

      if (!newPassword || newPassword.length < 6) {
        res.status(400).json({
          ok: false,
          error: 'يجب ألا تقل كلمة المرور الجديدة عن 6 أحرف.',
        });
        return;
      }

      if (newPassword !== confirmPassword) {
        res.status(400).json({
          ok: false,
          error: 'كلمة المرور الجديدة وتأكيدها غير متطابقين.',
        });
        return;
      }

      const hmacSecret = getRecoveryHmacSecret();
      if (!hmacSecret) {
        console.error(
          '[ForgotPassword] CRITICAL: RECOVERY_HMAC_SECRET is missing or invalid during reset-password.'
        );
        res.status(503).json({
          ok: false,
          code: 'RECOVERY_SERVICE_UNAVAILABLE',
          error: SAFE_RECOVERY_UNAVAILABLE_MESSAGE,
        });
        return;
      }

      const adminClient = getSupabaseAdminClient();
      let activeRow: any = null;
      let fallbackAuthUid = '';
      let fallbackCurrentMeta: Record<string, any> = {};

      const { data: dbActiveRow, error: fetchErr } = await adminClient
        .from('password_reset_codes')
        .select('id, user_id, username, email, code_hash, attempts_left, expires_at, is_used')
        .eq('username', cleanUsername)
        .eq('is_used', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const useAppMetadataFallback = fetchErr?.code === 'PGRST205';

      if (fetchErr && !useAppMetadataFallback) {
        console.error(
          '[ForgotPassword] CRITICAL: Failed to read public.password_reset_codes in reset-password:',
          fetchErr.code || 'UNKNOWN',
          fetchErr.message || ''
        );
        res.status(503).json({
          ok: false,
          code: 'RECOVERY_STORAGE_UNAVAILABLE',
          error: SAFE_RECOVERY_UNAVAILABLE_MESSAGE,
        });
        return;
      }

      if (useAppMetadataFallback) {
        const { data: staffRow } = await adminClient
          .from('staff_accounts')
          .select('auth_user_id')
          .ilike('username', cleanUsername)
          .maybeSingle();
        if (staffRow?.auth_user_id) {
          fallbackAuthUid = String(staffRow.auth_user_id);
          const { data: authUserRes } = await adminClient.auth.admin.getUserById(fallbackAuthUid);
          if (authUserRes?.user) {
            fallbackCurrentMeta = (authUserRes.user.app_metadata || {}) as Record<string, any>;
            const state = fallbackCurrentMeta.password_reset_state;
            if (state && !state.is_used && String(state.username || '').toLowerCase() === cleanUsername) {
              activeRow = state;
            }
          }
        }
      } else {
        activeRow = dbActiveRow;
      }

      if (
        !activeRow ||
        activeRow.is_used ||
        !String(activeRow.code_hash || '').startsWith('token:') ||
        (cleanEmail && String(activeRow.email || '').trim().toLowerCase() !== cleanEmail)
      ) {
        res.status(400).json({
          ok: false,
          error: 'رمز استعادة كلمة المرور غير صالح أو تم استخدامه مسبقاً.',
        });
        return;
      }

      const requestId = String(activeRow.id);
      const candidateTokenHashHex = computeRecoveryHmacHex(
        hmacSecret,
        'reset_token',
        cleanUsername,
        requestId,
        cleanResetToken
      );

      const isTokenMatchedInMemory = timingSafeStringMatch(
        candidateTokenHashHex,
        String(activeRow.code_hash)
      );

      let consumedUserId = '';

      if (useAppMetadataFallback) {
        const expMs = new Date(activeRow.expires_at).getTime();
        if (now > expMs) {
          await adminClient.auth.admin.updateUserById(fallbackAuthUid, {
            app_metadata: {
              ...fallbackCurrentMeta,
              password_reset_state: {
                ...activeRow,
                is_used: true,
                attempts_left: 0,
                code_hash: `expired:${requestId}`,
              },
            },
          });
          res.status(400).json({
            ok: false,
            error: 'انتهت صلاحية رمز استعادة كلمة المرور (5 دقائق). يرجى طلب رمز تحقق جديد.',
          });
          return;
        }

        if (!isTokenMatchedInMemory) {
          res.status(400).json({
            ok: false,
            error: 'رمز استعادة كلمة المرور غير صالح.',
          });
          return;
        }

        await adminClient.auth.admin.updateUserById(fallbackAuthUid, {
          app_metadata: {
            ...fallbackCurrentMeta,
            password_reset_state: {
              ...activeRow,
              is_used: true,
              attempts_left: 0,
              code_hash: `used:${requestId}`,
            },
          },
        });
        consumedUserId = fallbackAuthUid;
      } else {
        // استهلاك ذري أحادي الاستخدام للـ resetToken في قاعدة البيانات قبل تحديث كلمة المرور (One-Time Burn-on-Use)
        const { data: consumeRpcData, error: consumeRpcErr } = await adminClient.rpc(
          'rpc_consume_password_reset_token',
          {
            p_row_id: requestId,
            p_username: cleanUsername,
            p_email: cleanEmail,
            p_candidate_token_hash: isTokenMatchedInMemory ? candidateTokenHashHex : 'token:__mismatch__',
          }
        );

        if (consumeRpcErr || !consumeRpcData) {
          console.error(
            '[ForgotPassword] CRITICAL: Failed to execute rpc_consume_password_reset_token:',
            consumeRpcErr?.code || 'NO_DATA',
            consumeRpcErr?.message || ''
          );
          res.status(503).json({
            ok: false,
            code: 'RECOVERY_STORAGE_UNAVAILABLE',
            error: SAFE_RECOVERY_UNAVAILABLE_MESSAGE,
          });
          return;
        }

        if (consumeRpcData.ok !== true) {
          const reason = String(consumeRpcData.reason || '');
          if (reason === 'EXPIRED') {
            res.status(400).json({
              ok: false,
              error: 'انتهت صلاحية رمز استعادة كلمة المرور (5 دقائق). يرجى طلب رمز تحقق جديد.',
            });
            return;
          }

          if (reason === 'INVALID_TOKEN') {
            res.status(400).json({
              ok: false,
              error: 'رمز استعادة كلمة المرور غير صالح.',
            });
            return;
          }

          res.status(400).json({
            ok: false,
            error: 'رمز استعادة كلمة المرور غير صالح أو تم استخدامه مسبقاً.',
          });
          return;
        }

        consumedUserId = String(consumeRpcData.user_id || activeRow.user_id || '');
      }

      const { data: staffRow, error: staffErr } = await adminClient
        .from('staff_accounts')
        .select('id, auth_user_id, username')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (
        staffErr ||
        !staffRow ||
        !staffRow.auth_user_id ||
        String(staffRow.auth_user_id) !== consumedUserId
      ) {
        res.status(400).json({
          ok: false,
          error: 'تعذر التحقق من حساب المصادقة المرتبط.',
        });
        return;
      }

      const { error: updateAuthErr } = await adminClient.auth.admin.updateUserById(
        consumedUserId,
        {
          password: newPassword,
          email_confirm: true,
        }
      );

      if (updateAuthErr) {
        console.error(
          '[ForgotPassword] Failed to update user password in Supabase Auth:',
          updateAuthErr.message || 'AUTH_UPDATE_ERROR'
        );
        res.status(500).json({
          ok: false,
          error: 'تعذر تحديث كلمة المرور في خدمة المصادقة السحابية. يرجى طلب رمز تحقق جديد والمحاولة مرة أخرى.',
        });
        return;
      }

      await syncFallbackPasswordHashInDb(adminClient, cleanUsername, newPassword);

      res.status(200).json({
        ok: true,
        message: 'تم تعيين كلمة المرور الجديدة بنجاح. يمكنك الآن تسجيل الدخول.',
      });
    } catch (err: any) {
      console.error('[ForgotPassword] Unexpected error in reset-password:', err?.code || err?.name || 'ERR');
      res.status(500).json({
        ok: false,
        error: 'حدث خطأ داخلي أثناء إعادة تعيين كلمة المرور.',
      });
    }
  });

  // ذاكرة تخزين مؤقت قصيرة الأمد (15 ثانية) للتحقق التشفيري من رموز JWT ومنع التزوير عبر الكونسول
  const verifiedJwtCache = new Map<string, { userId: string; expiresAt: number }>();
  const bridgeRateBuckets = new Map<string, { count: number; resetAt: number }>();

  const checkBridgeRateLimit = (key: string, maxRequests: number, windowMs: number): boolean => {
    const now = getNow();
    if (bridgeRateBuckets.size > 5000) {
      for (const [k, v] of bridgeRateBuckets.entries()) {
        if (now > v.resetAt) bridgeRateBuckets.delete(k);
      }
    }
    const existing = bridgeRateBuckets.get(key);
    if (!existing || now > existing.resetAt) {
      bridgeRateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    existing.count += 1;
    return existing.count <= maxRequests;
  };

  // جسر اتصال آمن (Server-Side Supabase Bridge) لدعم التوافق التام مع قاعدة البيانات دون كشف أي مفاتيح بالمتصفح
  app.use('/api/supabase-bridge', async (req: Request, res: Response) => {
    try {
      const supabaseUrl = getServerSupabaseUrl();
      const serviceRoleKey = getServerServiceRoleKey(supabaseUrl);
      if (!supabaseUrl || !serviceRoleKey) {
        res.status(503).json({ message: 'Supabase server configuration unavailable' });
        return;
      }

      const clientIp =
        (typeof req.headers['x-forwarded-for'] === 'string'
          ? req.headers['x-forwarded-for'].split(',')[0].trim()
          : '') ||
        req.socket?.remoteAddress ||
        'unknown';

      if (!checkBridgeRateLimit(`general:${clientIp}`, 300, 60_000)) {
        res.status(429).json({ message: 'تم تجاوز الحد المسموح من الطلبات، يرجى الانتظار قليلاً.' });
        return;
      }

      const subPath = req.originalUrl.replace(/^\/api\/supabase-bridge/, '') || '/';
      const cleanPathOnly = subPath.split('?')[0];

      // حماية ضد Path Traversal أو محاولات التلاعب بالمسارات (SSRF / Injection)
      let decodedPath = cleanPathOnly;
      try {
        decodedPath = decodeURIComponent(cleanPathOnly);
      } catch {
        res.status(400).json({ message: 'Invalid URL encoding in bridge path' });
        return;
      }

      if (
        !cleanPathOnly.startsWith('/') ||
        cleanPathOnly.startsWith('//') ||
        decodedPath.includes('..') ||
        decodedPath.includes('\\') ||
        /[\u0000-\u001F\u007F]/.test(decodedPath)
      ) {
        res.status(400).json({ message: 'Invalid bridge path' });
        return;
      }

      const targetUrlObj = new URL(subPath, supabaseUrl);
      const expectedOrigin = new URL(supabaseUrl).origin;
      if (targetUrlObj.origin !== expectedOrigin) {
        res.status(400).json({ message: 'Invalid upstream target origin' });
        return;
      }

      // التحقق التشفيري الحقيقي من رمز المستخدم الموثق (JWT) عبر Supabase Auth لمنع تزوير الرموز من الكونسول
      let authenticatedUserJwt: string | null = null;
      let authenticatedUserId: string | null = null;
      const authHeader = req.headers.authorization;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const candidateToken = authHeader.slice('Bearer '.length).trim();
        const parts = candidateToken.split('.');
        if (parts.length === 3 && candidateToken !== serviceRoleKey) {
          try {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
            if (payload && payload.role === 'authenticated' && typeof payload.sub === 'string') {
              const tokenHash = crypto.createHash('sha256').update(candidateToken).digest('hex');
              const now = getNow();
              const cached = verifiedJwtCache.get(tokenHash);
              if (cached && cached.expiresAt > now) {
                authenticatedUserJwt = candidateToken;
                authenticatedUserId = cached.userId;
              } else {
                const adminClient = getSupabaseAdminClient();
                const { data: userData, error: authErr } = await adminClient.auth.getUser(candidateToken);
                if (!authErr && userData?.user?.id) {
                  authenticatedUserJwt = candidateToken;
                  authenticatedUserId = userData.user.id;
                  verifiedJwtCache.set(tokenHash, {
                    userId: userData.user.id,
                    expiresAt: now + 15_000,
                  });
                }
              }
            }
          } catch {
            authenticatedUserJwt = null;
            authenticatedUserId = null;
          }
        }
      }

      // 1) مسارات المصادقة (/auth/v1/*) باستثناء مسارات الإدارة (/auth/v1/admin/*)
      if (cleanPathOnly.startsWith('/auth/v1/')) {
        if (cleanPathOnly.startsWith('/auth/v1/admin')) {
          res.status(403).json({ message: 'Forbidden admin auth path' });
          return;
        }

        // حماية الخادم ضد هجمات تخمين كلمات المرور (Brute Force) عبر الكونسول أو الـ API
        if (req.method === 'POST' && cleanPathOnly === '/auth/v1/token') {
          const emailTarget = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'anon';
          if (!checkBridgeRateLimit(`auth_token:${clientIp}:${emailTarget}`, 15, 15 * 60_000)) {
            res.status(429).json({
              error: 'over_request_rate_limit',
              error_description: 'تم حظر محاولات الدخول مؤقتاً بسبب كثرة المحاولات الخاطئة. يرجى الانتظار 15 دقيقة.',
              message: 'تم حظر محاولات الدخول مؤقتاً بسبب كثرة المحاولات الخاطئة. يرجى الانتظار 15 دقيقة.',
            });
            return;
          }
        }

        const forwardHeaders: Record<string, string> = {
          apikey: serviceRoleKey,
        };
        if (req.headers['content-type']) {
          forwardHeaders['Content-Type'] = String(req.headers['content-type']);
        } else {
          forwardHeaders['Content-Type'] = 'application/json';
        }
        if (authenticatedUserJwt) {
          forwardHeaders['Authorization'] = `Bearer ${authenticatedUserJwt}`;
        }

        const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
        const upstreamRes = await fetch(targetUrlObj.toString(), {
          method: req.method,
          headers: forwardHeaders,
          body: hasBody && req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : undefined,
        });

        const contentType = upstreamRes.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);
        const textBody = await upstreamRes.text();
        res.status(upstreamRes.status).send(textBody);
        return;
      }

      // 2) مسارات البيانات والدوال (/rest/v1/*)
      if (cleanPathOnly.startsWith('/rest/v1/')) {
        const isReadMethod = req.method === 'GET' || req.method === 'HEAD';

        // دالة مساعدة للحصول على تاريخ اليوم بتوقيت القاهرة (YYYY-MM-DD)
        const getCairoTodayDateStr = (): string => {
          try {
            return new Intl.DateTimeFormat('en-CA', {
              timeZone: 'Africa/Cairo',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            }).format(new Date());
          } catch {
            return new Date().toISOString().split('T')[0];
          }
        };

        // دالة مساعدة لإرجاع طابور الانتظار العام مع إخفاء الأسماء وحجب الهواتف والتشخيصات تماماً
        const sendSafePublicQueueDisplay = async () => {
          const adminClient = getSupabaseAdminClient();
          const { data: rows, error: bErr } = await adminClient
            .from('bookings')
            .select('id, ticket_number, patient_name, clinic_id, clinic_name, doctor_id, doctor_name, date, queue_position, status, payment_status, called_at, paid_at, notes')
            .in('status', ['waiting', 'in-progress', 'late', 'completed'])
            .in('payment_status', ['paid', 'exempt'])
            .order('queue_position', { ascending: true });

          if (bErr) {
            res.status(500).json({ message: 'Failed to load public queue' });
            return;
          }

          const safeQueue = (rows || [])
            .filter((r: any) => r.notes !== '__PURGED_PAST_BOOKING__')
            .map((r: any) => {
              const parts = String(r.patient_name || '').trim().split(/\s+/).filter(Boolean);
              const maskedName =
                parts.length >= 2
                  ? `${parts[0]} ${parts[1].charAt(0)}.`
                  : parts[0] || 'مريض';
              return {
                id: r.id,
                ticket_number: r.ticket_number,
                clinic_id: r.clinic_id,
                clinic_name: r.clinic_name,
                doctor_id: r.doctor_id,
                doctor_name: r.doctor_name,
                date: r.date,
                queue_position: r.queue_position,
                status: r.status,
                called_at: r.called_at,
                paid_at: r.paid_at,
                patient_display_name: maskedName,
              };
            });

          res.status(200).json(safeQueue);
        };

        // في حال عدم وجود جلسة مستخدم موثق (زائر عام / شاشة الحجز أو الانتظار)
        if (!authenticatedUserJwt) {
          const allowedPublicReadTables = new Set([
            '/rest/v1/clinics',
            '/rest/v1/doctors',
            '/rest/v1/daily_schedule',
            '/rest/v1/public_queue_display',
            '/rest/v1/bookings',
            '/rest/v1/staff_accounts',
            '/rest/v1/settings',
          ]);
          const allowedPublicRpcs = new Set([
            '/rest/v1/rpc/create_public_booking',
            '/rest/v1/rpc/get_patient_ticket_secure',
            '/rest/v1/rpc/report_client_error',
          ]);

          const isAllowedRead = isReadMethod && allowedPublicReadTables.has(cleanPathOnly);
          const isAllowedRpc = req.method === 'POST' && allowedPublicRpcs.has(cleanPathOnly);

          if (!isAllowedRead && !isAllowedRpc) {
            res.status(401).json({ message: 'Unauthorized public operation' });
            return;
          }

          // حماية ضد الإغراق الآلي للحجوزات العامة عبر الكونسول أو السكربتات
          if (req.method === 'POST' && cleanPathOnly === '/rest/v1/rpc/create_public_booking') {
            if (!checkBridgeRateLimit(`public_booking:${clientIp}`, 15, 10 * 60_000)) {
              res.status(429).json({
                message: 'تم تجاوز الحد المسموح من طلبات الحجز المتتالية. يرجى الانتظار بضع دقائق والمحاولة مجدداً.',
              });
              return;
            }
          }

          // منع أي زائر غير مسجل من قراءة بيانات جدول bookings الخام (حماية أرقام الهواتف والأسماء والتشخيصات)
          if (isReadMethod && cleanPathOnly === '/rest/v1/bookings') {
            await sendSafePublicQueueDisplay();
            return;
          }
        }

        // معالجة العرض العام لشاشة الانتظار (سواء لزائر أو لمستخدم مسجل)
        if (isReadMethod && cleanPathOnly === '/rest/v1/public_queue_display') {
          await sendSafePublicQueueDisplay();
          return;
        }

        // حماية استرجاع تذكرة المريض العامة عبر اشتراط تطابق معرف التذكرة مع آخر 10 أرقام من هاتف المريض
        if (req.method === 'POST' && cleanPathOnly === '/rest/v1/rpc/get_patient_ticket_secure') {
          const bookingId = typeof req.body?.p_booking_id === 'string' ? req.body.p_booking_id.trim() : '';
          const rawPhone = String(req.body?.p_patient_phone || '').replace(/\D/g, '');
          const normPhone = rawPhone.length >= 10 ? rawPhone.slice(-10) : '';

          if (!bookingId || normPhone.length < 10) {
            res.status(200).json(null);
            return;
          }

          const adminClient = getSupabaseAdminClient();
          const { data: ticketRow, error: ticketErr } = await adminClient
            .from('bookings')
            .select('id, ticket_number, patient_name, patient_phone, clinic_id, clinic_name, doctor_id, doctor_name, date, time_slot, queue_position, status, payment_status, payment_method, fee, notes, created_at, called_at, completed_at, paid_at')
            .eq('id', bookingId)
            .maybeSingle();

          if (ticketErr || !ticketRow || ticketRow.notes === '__PURGED_PAST_BOOKING__') {
            res.status(200).json(null);
            return;
          }

          const rowPhoneDigits = String(ticketRow.patient_phone || '').replace(/\D/g, '');
          if (rowPhoneDigits.length < 10 || rowPhoneDigits.slice(-10) !== normPhone) {
            res.status(200).json(null);
            return;
          }

          res.status(200).json(ticketRow);
          return;
        }

        // فحص التذكرة لموظفي الاستقبال والخزينة والإدارة (بما يشمل التذاكر غير المسددة لتوجيه المريض للخزينة عند مسح QR)
        if (req.method === 'POST' && cleanPathOnly === '/rest/v1/rpc/verify_ticket_for_staff') {
          if (!authenticatedUserJwt) {
            res.status(401).json({ message: 'غير مصرح: يجب تسجيل الدخول كموظف معتمد لفحص التذكرة' });
            return;
          }

          const verified = await verifyStaffFromBearerToken(`Bearer ${authenticatedUserJwt}`);
          if (!verified.ok || !['admin', 'cashier', 'reception'].includes(verified.caller.role)) {
            res.status(403).json({ message: 'غير مصرح بفحص التذاكر' });
            return;
          }

          const rawLookup = typeof req.body?.p_lookup === 'string' ? req.body.p_lookup.trim() : '';
          if (!rawLookup) {
            res.status(200).json(null);
            return;
          }

          const cleanDigits = rawLookup.replace(/\D/g, '');
          const normPhone = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : '';
          const cairoToday = getCairoTodayDateStr();
          const utcToday = new Date().toISOString().split('T')[0];

          const adminClient = getSupabaseAdminClient();
          const { data: todayRows } = await adminClient
            .from('bookings')
            .select('id, ticket_number, patient_name, patient_phone, clinic_id, clinic_name, doctor_id, doctor_name, date, time_slot, queue_position, status, payment_status, payment_method, fee, notes, created_at, called_at, completed_at, paid_at')
            .in('date', Array.from(new Set([cairoToday, utcToday])))
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });

          const matchedRow = (todayRows || []).find((r: any) => {
            if (r.notes === '__PURGED_PAST_BOOKING__') return false;
            if (String(r.id) === rawLookup) return true;
            if (String(r.ticket_number || '').toLowerCase() === rawLookup.toLowerCase()) return true;
            if (normPhone) {
              const rDigits = String(r.patient_phone || '').replace(/\D/g, '');
              if (rDigits.length >= 10 && rDigits.slice(-10) === normPhone) return true;
            }
            return false;
          });

          res.status(200).json(matchedRow || null);
          return;
        }

        // معالجة إنشاء حجز جديد (create_public_booking) مع مزامنة جدول اليوم وتوحيد تاريخ اليوم بتوقيت القاهرة
        if (req.method === 'POST' && cleanPathOnly === '/rest/v1/rpc/create_public_booking') {
          const adminClient = getSupabaseAdminClient();
          const cairoToday = getCairoTodayDateStr();
          const targetClinicId = typeof req.body?.p_clinic_id === 'string' ? req.body.p_clinic_id.trim() : '';

          // 1. التأكد من تطابق clinics.is_open_today مع جدول تشغيل اليوم (daily_schedule) إن وُجد
          if (targetClinicId && !targetClinicId.startsWith('_system')) {
            try {
              const { data: schedRow } = await adminClient
                .from('daily_schedule')
                .select('is_open')
                .eq('date', cairoToday)
                .eq('clinic_id', targetClinicId)
                .maybeSingle();

              if (schedRow && typeof schedRow.is_open === 'boolean') {
                await adminClient
                  .from('clinics')
                  .update({ is_open_today: schedRow.is_open })
                  .eq('id', targetClinicId);
              }
            } catch {
              // ignore schedule sync pre-check error
            }
          }

          const rpcRes = await fetch(targetUrlObj.toString(), {
            method: 'POST',
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
              Accept: String(req.headers['accept'] || 'application/json'),
            },
            body: JSON.stringify(req.body || {}),
          });

          const ct = rpcRes.headers.get('content-type') || 'application/json';
          const rawText = await rpcRes.text();

          if (!rpcRes.ok) {
            res.setHeader('Content-Type', ct);
            res.status(rpcRes.status).send(rawText);
            return;
          }

          try {
            const createdRow = JSON.parse(rawText);
            if (createdRow && typeof createdRow === 'object' && createdRow.id) {
              // إذا كان تاريخ الحجز المُنشأ بتوقيت UTC مختلفاً عن تاريخ اليوم في القاهرة (بين 12 ص و 3 ص بتوقيت مصر)
              if (createdRow.date !== cairoToday) {
                const { data: sameDayRows } = await adminClient
                  .from('bookings')
                  .select('id, queue_position')
                  .eq('clinic_id', createdRow.clinic_id)
                  .eq('date', cairoToday)
                  .neq('id', createdRow.id);

                const maxPos = (sameDayRows || []).reduce(
                  (acc: number, item: any) => Math.max(acc, Number(item.queue_position) || 0),
                  0
                );
                const nextPos = maxPos + 1;
                const nextTicket = `T-${String(nextPos).padStart(3, '0')}`;

                const { data: fixedRow } = await adminClient
                  .from('bookings')
                  .update({
                    date: cairoToday,
                    queue_position: nextPos,
                    ticket_number: nextTicket,
                  })
                  .eq('id', createdRow.id)
                  .select('*')
                  .maybeSingle();

                if (fixedRow) {
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.status(200).json(fixedRow);
                  return;
                }
                createdRow.date = cairoToday;
              }
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.status(200).json(createdRow);
              return;
            }
          } catch {
            // fall through
          }

          res.setHeader('Content-Type', ct);
          res.status(rpcRes.status).send(rawText);
          return;
        }

        // معالجة تأكيد الدفع بالخزينة (confirm_payment) مع توحيد توقيت القاهرة وحفظ الحالة في جدول bookings
        if (req.method === 'POST' && cleanPathOnly === '/rest/v1/rpc/confirm_payment') {
          if (!authenticatedUserJwt) {
            res.status(401).json({ message: 'غير مصرح: يجب تسجيل الدخول لتأكيد عمليات السداد' });
            return;
          }

          const verified = await verifyStaffFromBearerToken(`Bearer ${authenticatedUserJwt}`);
          if (!verified.ok || !['admin', 'cashier', 'reception'].includes(verified.caller.role)) {
            res.status(403).json({ message: 'غير مصرح بتأكيد عمليات الدفع' });
            return;
          }

          const bookingId = typeof req.body?.p_booking_id === 'string' ? req.body.p_booking_id.trim() : '';
          const paymentType = typeof req.body?.p_payment_type === 'string' ? req.body.p_payment_type.trim() : '';

          if (!bookingId || !['cash', 'insurance', 'charity_exempt'].includes(paymentType)) {
            res.status(400).json({ message: 'بيانات تأكيد الدفع غير صالحة' });
            return;
          }

          const adminClient = getSupabaseAdminClient();
          const newPaymentStatus = paymentType === 'charity_exempt' ? 'exempt' : 'paid';
          const nowIso = new Date().toISOString();

          const { data: updatedBooking, error: updErr } = await adminClient
            .from('bookings')
            .update({
              payment_status: newPaymentStatus,
              payment_method: paymentType,
              paid_at: nowIso,
            })
            .eq('id', bookingId)
            .neq('status', 'cancelled')
            .select('id, ticket_number, patient_name, patient_phone, clinic_id, clinic_name, doctor_id, doctor_name, date, time_slot, queue_position, status, payment_status, payment_method, fee, notes, created_at, called_at, completed_at, paid_at')
            .maybeSingle();

          if (updErr || !updatedBooking) {
            res.status(400).json({ message: updErr?.message || 'تعذر تأكيد سداد الحجز في قاعدة البيانات' });
            return;
          }

          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.status(200).json(updatedBooking);
          return;
        }

        // حفظ حالة إرسال رسالة واتساب للمريض في قاعدة بيانات Supabase (_system_whatsapp_sent)
        if (req.method === 'POST' && cleanPathOnly === '/rest/v1/rpc/mark_whatsapp_sent') {
          if (!authenticatedUserJwt) {
            res.status(401).json({ message: 'غير مصرح' });
            return;
          }

          const verified = await verifyStaffFromBearerToken(`Bearer ${authenticatedUserJwt}`);
          if (!verified.ok || !['admin', 'cashier', 'reception'].includes(verified.caller.role)) {
            res.status(403).json({ message: 'غير مصرح' });
            return;
          }

          const bookingId = typeof req.body?.p_booking_id === 'string' ? req.body.p_booking_id.trim() : '';
          if (!bookingId) {
            res.status(400).json({ message: 'معرف الحجز مطلوب' });
            return;
          }

          const adminClient = getSupabaseAdminClient();
          const { data: existingRow } = await adminClient
            .from('clinics')
            .select('description')
            .eq('id', '_system_whatsapp_sent')
            .maybeSingle();

          let sentMap: Record<string, boolean> = {};
          if (existingRow?.description) {
            try {
              const parsed = JSON.parse(existingRow.description);
              if (parsed && typeof parsed === 'object') {
                sentMap = parsed;
              }
            } catch {}
          }

          sentMap[bookingId] = true;
          const keys = Object.keys(sentMap);
          if (keys.length > 500) {
            const trimmed: Record<string, boolean> = {};
            for (const k of keys.slice(-500)) {
              trimmed[k] = true;
            }
            sentMap = trimmed;
          }

          await adminClient.from('clinics').upsert({
            id: '_system_whatsapp_sent',
            name: 'System WhatsApp Sent Tracker',
            specialty: 'System',
            room_number: '0',
            floor: '0',
            price: 0,
            description: JSON.stringify(sentMap),
            is_open_today: false,
          });

          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.status(200).json(sentMap);
          return;
        }

        // معالجة تسجيل أخطاء النظام (report_client_error) من أي جهاز وحفظها في قاعدة البيانات (_system_error_logs)
        if (req.method === 'POST' && cleanPathOnly === '/rest/v1/rpc/report_client_error') {
          const errPayload = req.body?.p_error;
          if (!errPayload || typeof errPayload !== 'object' || !errPayload.id) {
            res.status(400).json({ message: 'بيانات الخطأ غير صالحة' });
            return;
          }

          const adminClient = getSupabaseAdminClient();
          const { data: existingRow } = await adminClient
            .from('clinics')
            .select('description')
            .eq('id', '_system_error_logs')
            .maybeSingle();

          let logsList: any[] = [];
          if (existingRow?.description) {
            try {
              const parsed = JSON.parse(existingRow.description);
              if (Array.isArray(parsed)) {
                logsList = parsed;
              }
            } catch {}
          }

          const merged = [
            { ...errPayload, syncedToDb: true },
            ...logsList.filter((item: any) => item && item.id !== errPayload.id),
          ].slice(0, 100);

          await adminClient.from('clinics').upsert({
            id: '_system_error_logs',
            name: 'System Error Logs',
            specialty: 'System',
            room_number: '0',
            floor: '0',
            price: 0,
            description: JSON.stringify(merged),
            is_open_today: false,
          });

          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.status(200).json(merged);
          return;
        }

        // معالجة حذف حجز المريض بواسطة الموظف المعتمد (الخزينة / الاستقبال / الإدارة) في حال حجز المريض ولم يحضر
        if (req.method === 'POST' && cleanPathOnly === '/rest/v1/rpc/delete_booking_by_staff') {
          if (!authenticatedUserJwt) {
            res.status(401).json({ message: 'غير مصرح: يجب تسجيل الدخول لحذف الحجز' });
            return;
          }

          const verified = await verifyStaffFromBearerToken(`Bearer ${authenticatedUserJwt}`);
          if (!verified.ok || !['admin', 'cashier', 'reception'].includes(verified.caller.role)) {
            res.status(403).json({ message: 'غير مصرح بحذف الحجوزات' });
            return;
          }

          const bookingId = typeof req.body?.p_booking_id === 'string' ? req.body.p_booking_id.trim() : '';
          if (!bookingId) {
            res.status(400).json({ message: 'معرف الحجز مطلوب' });
            return;
          }

          const adminClient = getSupabaseAdminClient();

          // 1. الحذف الفعلي من جدول bookings باستخدام صلاحية الخادم
          await adminClient
            .from('bookings')
            .delete()
            .eq('id', bookingId);

          // 2. التحقق مما إذا كان هناك تريجر يمنع الحذف الفيزيائي، وفي هذه الحالة يتم وسم السجل بالحذف النهائي والإلغاء
          const { data: checkRemaining } = await adminClient
            .from('bookings')
            .select('id')
            .eq('id', bookingId)
            .maybeSingle();

          if (checkRemaining?.id) {
            await adminClient
              .from('bookings')
              .update({
                notes: '__PURGED_PAST_BOOKING__',
                status: 'cancelled',
              })
              .eq('id', bookingId);
          }

          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.status(200).json({ ok: true, deletedId: bookingId });
          return;
        }

        // تهيئة تلقائية لجدول تشغيل اليوم (daily_schedule) على الخادم عند بداية يوم جديد إذا كان فارغاً
        if (isReadMethod && cleanPathOnly === '/rest/v1/daily_schedule') {
          const schedRes = await fetch(targetUrlObj.toString(), {
            method: req.method,
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              Accept: String(req.headers['accept'] || 'application/json'),
            },
          });

          const ct = schedRes.headers.get('content-type') || 'application/json';
          const rawText = await schedRes.text();
          if (!schedRes.ok) {
            res.setHeader('Content-Type', ct);
            res.status(schedRes.status).send(rawText);
            return;
          }

          try {
            const parsed = JSON.parse(rawText);
            const dateParam = targetUrlObj.searchParams.get('date');
            const eqDate = dateParam && dateParam.startsWith('eq.') ? dateParam.slice(3).trim() : '';
            if (Array.isArray(parsed) && parsed.length === 0 && /^\d{4}-\d{2}-\d{2}$/.test(eqDate)) {
              const adminClient = getSupabaseAdminClient();
              const [{ data: allClinics }, { data: allDoctors }] = await Promise.all([
                adminClient.from('clinics').select('id, is_open_today, description').order('id', { ascending: true }),
                adminClient.from('doctors').select('id, clinic_id, bio').order('id', { ascending: true }),
              ]);

              const validClinics = (allClinics || []).filter(
                (c: any) => !String(c.id || '').startsWith('_system') && c.description !== '__DELETED_CLINIC__'
              );
              const validDoctors = (allDoctors || []).filter((d: any) => d.bio !== '__DELETED_DOCTOR__');

              if (validClinics.length > 0) {
                const seedRows = validClinics.map((c: any) => {
                  const doc = validDoctors.find((d: any) => d.clinic_id === c.id);
                  return {
                    date: eqDate,
                    clinic_id: c.id,
                    doctor_id: doc?.id || null,
                    is_open: c.is_open_today !== false,
                  };
                });

                const { data: seeded } = await adminClient
                  .from('daily_schedule')
                  .upsert(seedRows, { onConflict: 'date,clinic_id' })
                  .select('*');

                if (seeded && seeded.length > 0) {
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.status(200).json(seeded);
                  return;
                }
              }
            }
          } catch {
            // fall through
          }

          res.setHeader('Content-Type', ct);
          res.status(schedRes.status).send(rawText);
          return;
        }

        // حماية سجل زيارات المريض برقم الهاتف: محصور حصراً بالموظفين الموثقين (admin, cashier, reception)
        if (req.method === 'POST' && cleanPathOnly === '/rest/v1/rpc/get_patient_history_by_phone') {
          if (!authenticatedUserJwt) {
            res.status(401).json({ message: 'غير مصرح: يجب تسجيل الدخول كموظف معتمد للبحث في سجل المرضى' });
            return;
          }

          const verified = await verifyStaffFromBearerToken(`Bearer ${authenticatedUserJwt}`);
          if (!verified.ok || !['admin', 'cashier', 'reception'].includes(verified.caller.role)) {
            res.status(403).json({ message: 'غير مصرح بالوصول إلى سجل زيارات المرضى' });
            return;
          }

          const callerRole = verified.caller.role;
          const rawPhone = String(req.body?.p_patient_phone || '').replace(/\D/g, '');
          const normPhone = rawPhone.length >= 10 ? rawPhone.slice(-10) : '';
          if (normPhone.length < 10) {
            res.status(200).json([]);
            return;
          }

          const adminClient = getSupabaseAdminClient();
          const { data: allBookings } = await adminClient
            .from('bookings')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);

          const matched = (allBookings || [])
            .filter((r: any) => {
              if (r.notes === '__PURGED_PAST_BOOKING__') return false;
              if (callerRole === 'reception' && (!['paid', 'exempt'].includes(r.payment_status) || r.status === 'cancelled')) {
                return false;
              }
              const digits = String(r.patient_phone || '').replace(/\D/g, '');
              return digits.length >= 10 && digits.slice(-10) === normPhone;
            })
            .map((r: any) => ({
              ...r,
              doctor_diagnosis: callerRole === 'admin' ? r.doctor_diagnosis : null,
              notes: callerRole === 'admin' ? r.notes : null,
            }));

          res.status(200).json(matched);
          return;
        }

        // معالجة قراءة staff_accounts مع حجب البريد الإلكتروني للاستعادة (recovery_email) عن غير المدير (Admin)
        if (isReadMethod && cleanPathOnly === '/rest/v1/staff_accounts') {
          let isCallerAdmin = false;
          if (authenticatedUserJwt && authenticatedUserId) {
            const verified = await verifyStaffFromBearerToken(`Bearer ${authenticatedUserJwt}`);
            if (verified.ok && verified.caller.role === 'admin') {
              isCallerAdmin = true;
            }
          }

          const staffRes = await fetch(targetUrlObj.toString(), {
            method: req.method,
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              Accept: String(req.headers['accept'] || 'application/json'),
            },
          });

          const ct = staffRes.headers.get('content-type') || 'application/json';
          const rawText = await staffRes.text();
          if (!staffRes.ok) {
            res.setHeader('Content-Type', ct);
            res.status(staffRes.status).send(rawText);
            return;
          }

          try {
            const parsed = JSON.parse(rawText);
            const sanitizeStaffRow = (row: any) => {
              if (!row || typeof row !== 'object') return row;
              if (isCallerAdmin) return row;
              // إخفاء البريد الإلكتروني للاستعادة ومعرف المصادقة الداخلي عن الزوار وغير المديرين
              const safeCopy = { ...row };
              delete safeCopy.recovery_email;
              delete safeCopy.recoveryEmail;
              return safeCopy;
            };
            const sanitizedPayload = Array.isArray(parsed)
              ? parsed.map(sanitizeStaffRow)
              : sanitizeStaffRow(parsed);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.status(200).json(sanitizedPayload);
            return;
          } catch {
            res.setHeader('Content-Type', ct);
            res.status(staffRes.status).send(rawText);
            return;
          }
        }

        // تصفية جدول العيادات عند القراءة لمنع تسريب أي سجل كلمات مرور قديم (_system_staff_passwords)
        if (isReadMethod && cleanPathOnly === '/rest/v1/clinics') {
          if (subPath.includes('_system_staff_passwords')) {
            res.status(200).json(
              String(req.headers['accept'] || '').includes('vnd.pgrst.object') ? null : []
            );
            return;
          }

          const clinicsRes = await fetch(targetUrlObj.toString(), {
            method: req.method,
            headers: {
              apikey: serviceRoleKey,
              Authorization: authenticatedUserJwt
                ? `Bearer ${authenticatedUserJwt}`
                : `Bearer ${serviceRoleKey}`,
              Accept: String(req.headers['accept'] || 'application/json'),
            },
          });

          const ct = clinicsRes.headers.get('content-type') || 'application/json';
          const rawText = await clinicsRes.text();
          if (!clinicsRes.ok) {
            res.setHeader('Content-Type', ct);
            res.status(clinicsRes.status).send(rawText);
            return;
          }

          try {
            const parsed = JSON.parse(rawText);
            if (Array.isArray(parsed)) {
              const filtered = parsed.filter((row: any) => row?.id !== '_system_staff_passwords');
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.status(200).json(filtered);
              return;
            }
            if (parsed && typeof parsed === 'object' && parsed.id === '_system_staff_passwords') {
              res.status(200).json(null);
              return;
            }
          } catch {
            // pass through if not JSON
          }

          res.setHeader('Content-Type', ct);
          res.status(clinicsRes.status).send(rawText);
          return;
        }

        // منع كتابة أي سجل _system_staff_passwords عبر الجسر نهائياً
        if (!isReadMethod && cleanPathOnly === '/rest/v1/clinics') {
          const bodyId = req.body && typeof req.body === 'object' ? req.body.id : undefined;
          if (bodyId === '_system_staff_passwords' || subPath.includes('_system_staff_passwords')) {
            res.status(403).json({ message: 'Storing password hashes in clinics table is forbidden' });
            return;
          }
        }

        // معالجة تحديثات الموظفين الموثقين (الأطباء، الاستقبال، الخزينة، الإدارة) لضمان الحفظ الفعلي في قاعدة البيانات دون تعارض مع سياسات RLS القديمة
        if (authenticatedUserJwt) {
          const verified = await verifyStaffFromBearerToken(`Bearer ${authenticatedUserJwt}`);
          if (verified.ok) {
            const callerRole = verified.caller.role;

            // (أ) تحديث بيانات الحضور والجدول الأسبوعي في جدول doctors
            if (
              (req.method === 'PATCH' || req.method === 'PUT') &&
              cleanPathOnly === '/rest/v1/doctors' &&
              ['admin', 'reception', 'doctor'].includes(callerRole)
            ) {
              const bodyObj = req.body && typeof req.body === 'object' ? req.body : {};
              const bodyKeys = Object.keys(bodyObj);
              const allowedKeys = new Set([
                'status',
                'is_present_today',
                'unavailable_reason',
                'schedule_days',
                'schedule_hours',
              ]);
              const isAllowedForRole =
                callerRole === 'admin' ||
                (bodyKeys.length > 0 && bodyKeys.every((k) => allowedKeys.has(k)));

              if (isAllowedForRole) {
                const srvHeaders: Record<string, string> = {
                  apikey: serviceRoleKey,
                  Authorization: `Bearer ${serviceRoleKey}`,
                  'Content-Type': 'application/json',
                };
                for (const hName of ['accept', 'prefer']) {
                  const val = req.headers[hName];
                  if (typeof val === 'string' && val.length > 0) {
                    srvHeaders[hName] = val;
                  }
                }
                const docUpdRes = await fetch(targetUrlObj.toString(), {
                  method: req.method,
                  headers: srvHeaders,
                  body: JSON.stringify(bodyObj),
                });
                const ct = docUpdRes.headers.get('content-type');
                if (ct) res.setHeader('Content-Type', ct);
                res.status(docUpdRes.status).send(await docUpdRes.text());
                return;
              }
            }

            // (ب) حفظ وتحديث جدول تشغيل اليوم (daily_schedule) من الإدارة أو الموظف المفوض (الاستقبال / الخزينة)
            if (
              !isReadMethod &&
              cleanPathOnly === '/rest/v1/daily_schedule' &&
              ['admin', 'reception', 'cashier'].includes(callerRole)
            ) {
              const srvHeaders: Record<string, string> = {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
              };
              for (const hName of ['accept', 'prefer']) {
                const val = req.headers[hName];
                if (typeof val === 'string' && val.length > 0) {
                  srvHeaders[hName] = val;
                }
              }
              const schedUpdRes = await fetch(targetUrlObj.toString(), {
                method: req.method,
                headers: srvHeaders,
                body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}),
              });
              const ct = schedUpdRes.headers.get('content-type');
              if (ct) res.setHeader('Content-Type', ct);
              res.status(schedUpdRes.status).send(await schedUpdRes.text());
              return;
            }

            // (ج) تحديث حالة فتح العيادة اليوم أو سعر الكشف (clinics) من الإدارة أو الموظف المفوض
            if (
              !isReadMethod &&
              cleanPathOnly === '/rest/v1/clinics' &&
              ['admin', 'reception', 'cashier'].includes(callerRole)
            ) {
              const bodyObj = req.body && typeof req.body === 'object' ? req.body : {};
              const bodyKeys = Object.keys(bodyObj);
              const allowedDelegatedClinicKeys = new Set(['is_open_today', 'price']);
              const isErrorOrWhatsappLog =
                bodyObj.id === '_system_error_logs' || bodyObj.id === '_system_whatsapp_sent';
              const isAllowedClinicWrite =
                callerRole === 'admin' ||
                isErrorOrWhatsappLog ||
                (bodyKeys.length > 0 && bodyKeys.every((k) => allowedDelegatedClinicKeys.has(k)));

              if (isAllowedClinicWrite) {
                const srvHeaders: Record<string, string> = {
                  apikey: serviceRoleKey,
                  Authorization: `Bearer ${serviceRoleKey}`,
                  'Content-Type': 'application/json',
                };
                for (const hName of ['accept', 'prefer']) {
                  const val = req.headers[hName];
                  if (typeof val === 'string' && val.length > 0) {
                    srvHeaders[hName] = val;
                  }
                }
                const clinicUpdRes = await fetch(targetUrlObj.toString(), {
                  method: req.method,
                  headers: srvHeaders,
                  body: JSON.stringify(bodyObj),
                });
                const ct = clinicUpdRes.headers.get('content-type');
                if (ct) res.setHeader('Content-Type', ct);
                res.status(clinicUpdRes.status).send(await clinicUpdRes.text());
                return;
              }
            }

            // (د) تحديث وحذف الحجوزات (bookings) للموظفين المعتمدين (admin, cashier, reception) وفق الصلاحيات المسموحة
            if (
              !isReadMethod &&
              cleanPathOnly === '/rest/v1/bookings' &&
              ['admin', 'cashier', 'reception'].includes(callerRole)
            ) {
              const bodyObj = req.body && typeof req.body === 'object' ? req.body : {};
              const bodyKeys = Object.keys(bodyObj);
              const allowedReceptionBookingKeys = new Set(['status', 'called_at', 'completed_at', 'notes']);
              const isPurgeFallback =
                bodyObj.notes === '__PURGED_PAST_BOOKING__' && bodyObj.status === 'cancelled' && bodyKeys.length === 2;

              const isAllowedBookingMutation =
                callerRole === 'admin' ||
                req.method === 'DELETE' ||
                isPurgeFallback ||
                (callerRole === 'reception' &&
                  (req.method === 'PATCH' || req.method === 'PUT') &&
                  bodyKeys.length > 0 &&
                  bodyKeys.every((k) => allowedReceptionBookingKeys.has(k)));

              if (isAllowedBookingMutation) {
                const srvHeaders: Record<string, string> = {
                  apikey: serviceRoleKey,
                  Authorization: `Bearer ${serviceRoleKey}`,
                };
                for (const hName of ['accept', 'prefer', 'range', 'content-type']) {
                  const val = req.headers[hName];
                  if (typeof val === 'string' && val.length > 0) {
                    srvHeaders[hName] = val;
                  }
                }
                const hasBBody = req.method !== 'GET' && req.method !== 'HEAD';
                const bRes = await fetch(targetUrlObj.toString(), {
                  method: req.method,
                  headers: srvHeaders,
                  body:
                    hasBBody && req.body !== undefined && req.body !== null
                      ? typeof req.body === 'string'
                        ? req.body
                        : JSON.stringify(req.body)
                      : undefined,
                });
                for (const copyHeader of ['content-type', 'content-range', 'preference-applied']) {
                  const hVal = bRes.headers.get(copyHeader);
                  if (hVal) res.setHeader(copyHeader, hVal);
                }
                res.status(bRes.status).send(await bRes.text());
                return;
              }
            }
          }
        }

        const forwardHeaders: Record<string, string> = {
          apikey: serviceRoleKey,
          Authorization: authenticatedUserJwt
            ? `Bearer ${authenticatedUserJwt}`
            : `Bearer ${serviceRoleKey}`,
        };

        for (const hName of ['accept', 'prefer', 'range', 'content-type', 'accept-profile', 'content-profile']) {
          const val = req.headers[hName];
          if (typeof val === 'string' && val.length > 0) {
            forwardHeaders[hName] = val;
          }
        }

        const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
        const upstreamRes = await fetch(targetUrlObj.toString(), {
          method: req.method,
          headers: forwardHeaders,
          body:
            hasBody && req.body !== undefined && req.body !== null
              ? typeof req.body === 'string'
                ? req.body
                : JSON.stringify(req.body)
              : undefined,
        });

        for (const copyHeader of ['content-type', 'content-range', 'preference-applied']) {
          const hVal = upstreamRes.headers.get(copyHeader);
          if (hVal) res.setHeader(copyHeader, hVal);
        }

        const responseText = await upstreamRes.text();
        res.status(upstreamRes.status).send(responseText);
        return;
      }

      res.status(404).json({ message: 'Unsupported bridge path' });
    } catch {
      res.status(502).json({ message: 'Failed to reach upstream Supabase service' });
    }
  });

  // مسار 404 لأي طلب API غير معرف
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ ok: false, error: 'المسار المطلوب غير موجود' });
  });

  return app;
}

async function startServer() {
  const app = createApiApp();
  const port = Number(process.env.PORT) || 3000;

  // ربط الواجهة الأمامية (Vite في بيئة التطوير أو الملفات المبنية في بيئة الإنتاج على Cloud Run)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // معالجة الأخطاء المركزية بدون تسريب أي تفاصيل داخلية أو أسرار
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) {
      res.status(500).json({
        ok: false,
        error: 'حدث خطأ داخلي في الخادم',
      });
    }
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer();
}
