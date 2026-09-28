-- ==============================================================================
-- منظومة عيادات الجمعية الشرعية - سكربت تهيئة قاعدة بيانات Supabase الشامل
-- ==============================================================================

-- تفعيل ملحق pgcrypto للتشفير والأرقام العشوائية
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- دالة مساعدة لإرجاع تاريخ اليوم الحالي حسب التوقيت الرسمي لجمهورية مصر العربية (Africa/Cairo)
CREATE OR REPLACE FUNCTION public.get_cairo_today()
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT (now() AT TIME ZONE 'Africa/Cairo')::date;
$$;

GRANT EXECUTE ON FUNCTION public.get_cairo_today() TO anon, authenticated, service_role;

-- 1. جدول العيادات (clinics)
CREATE TABLE IF NOT EXISTS public.clinics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  room_number TEXT NOT NULL,
  floor TEXT DEFAULT 'الأول',
  price NUMERIC NOT NULL DEFAULT 50,
  is_open_today BOOLEAN NOT NULL DEFAULT true,
  icon_name TEXT DEFAULT 'Stethoscope',
  description TEXT,
  department TEXT,
  working_days TEXT[] DEFAULT ARRAY['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
  working_hours TEXT DEFAULT '9:00 ص - 9:00 م',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. جدول الأطباء (doctors)
CREATE TABLE IF NOT EXISTS public.doctors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  title TEXT DEFAULT 'أخصائي',
  clinic_id TEXT REFERENCES public.clinics(id) ON DELETE SET NULL,
  clinic_name TEXT NOT NULL,
  is_present_today BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'busy', 'break', 'offline')),
  unavailable_reason TEXT,
  schedule_days TEXT[] DEFAULT ARRAY['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
  schedule_hours TEXT DEFAULT '10:00 ص - 2:00 م',
  max_daily_patients INTEGER NOT NULL DEFAULT 30,
  current_queue_number INTEGER DEFAULT 0,
  phone TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. جدول التشغيل اليومي (daily_schedule)
CREATE TABLE IF NOT EXISTS public.daily_schedule (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date DATE NOT NULL DEFAULT public.get_cairo_today(),
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  doctor_id TEXT REFERENCES public.doctors(id) ON DELETE SET NULL,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, clinic_id)
);

-- 4. جدول حسابات الكادر والموظفين (staff_accounts)
CREATE TABLE IF NOT EXISTS public.staff_accounts (
  id TEXT PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'reception', 'cashier', 'doctor')),
  doctor_id TEXT REFERENCES public.doctors(id) ON DELETE SET NULL,
  clinic_id TEXT REFERENCES public.clinics(id) ON DELETE SET NULL,
  recovery_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4.1 جدول رموز التحقق المؤقتة لاستعادة كلمة المرور (password_reset_codes)
CREATE TABLE IF NOT EXISTS public.password_reset_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts_left INTEGER NOT NULL DEFAULT 3,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_username_created
  ON public.password_reset_codes (lower(username), created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_codes_active_username
  ON public.password_reset_codes (lower(username))
  WHERE is_used = false;

-- 5. جدول الحجوزات (bookings)
CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
  ticket_number TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  clinic_name TEXT NOT NULL,
  doctor_id TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
  doctor_name TEXT NOT NULL,
  date DATE NOT NULL DEFAULT public.get_cairo_today(),
  time_slot TEXT NOT NULL,
  queue_position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in-progress', 'completed', 'cancelled', 'late')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'exempt')),
  payment_method TEXT CHECK (payment_method IN ('cash', 'insurance', 'charity_exempt')),
  fee NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  doctor_diagnosis TEXT,
  called_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- فهارس تفرد (Unique Indexes) لضمان استحالة تكرار رقم الدور (queue_position) أو رقم التذكرة (ticket_number) لنفس العيادة في نفس اليوم تحت التزامن
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_daily_clinic_queue
  ON public.bookings (date, clinic_id, queue_position);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_daily_clinic_ticket
  ON public.bookings (date, clinic_id, upper(trim(ticket_number)));

-- تفعيل Realtime لجدول الحجوزات
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================================
-- سياسات الأمان والحماية (Row Level Security - RLS)
-- ==============================================================================

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;

-- دالة لمعرفة دور المستخدم المسجل حالياً في Supabase Auth
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.staff_accounts WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- سياسات العيادات (clinics)
DROP POLICY IF EXISTS "Public read clinics" ON public.clinics;
CREATE POLICY "Public read clinics" ON public.clinics FOR SELECT USING (
  id NOT IN ('_system_passwords', '_system_error_logs')
  OR public.get_auth_role() = 'admin'
  OR auth.role() = 'service_role'
);

DROP POLICY IF EXISTS "Admin modify clinics" ON public.clinics;
CREATE POLICY "Admin modify clinics" ON public.clinics FOR ALL USING (
  public.get_auth_role() = 'admin' OR auth.role() = 'service_role'
) WITH CHECK (
  public.get_auth_role() = 'admin' OR auth.role() = 'service_role'
);

-- سياسات الأطباء (doctors)
DROP POLICY IF EXISTS "Public read doctors" ON public.doctors;
CREATE POLICY "Public read doctors" ON public.doctors FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin modify doctors" ON public.doctors;
CREATE POLICY "Admin modify doctors" ON public.doctors FOR ALL USING (
  public.get_auth_role() = 'admin' OR auth.role() = 'service_role'
) WITH CHECK (
  public.get_auth_role() = 'admin' OR auth.role() = 'service_role'
);

DROP POLICY IF EXISTS "Doctor update own status" ON public.doctors;
CREATE POLICY "Doctor update own status" ON public.doctors FOR UPDATE USING (
  public.get_auth_role() = 'doctor' AND id = (
    SELECT doctor_id FROM public.staff_accounts WHERE auth_user_id = auth.uid()
  )
) WITH CHECK (
  public.get_auth_role() = 'doctor' AND id = (
    SELECT doctor_id FROM public.staff_accounts WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Reception update doctor attendance" ON public.doctors;
CREATE POLICY "Reception update doctor attendance" ON public.doctors FOR UPDATE USING (
  public.get_auth_role() = 'reception'
) WITH CHECK (
  public.get_auth_role() = 'reception'
);

-- تريجر حماية بيانات الأطباء الإدارية ومنع الطبيب أو الاستقبال من تغيير عيادة الطبيب أو بياناته الأساسية
CREATE OR REPLACE FUNCTION public.trg_doctor_self_update_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := public.get_auth_role();
  v_my_doctor_id TEXT;
BEGIN
  IF v_role = 'admin' OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF v_role = 'doctor' THEN
    SELECT doctor_id INTO v_my_doctor_id FROM public.staff_accounts WHERE auth_user_id = auth.uid() LIMIT 1;
    IF v_my_doctor_id IS NULL OR OLD.id <> v_my_doctor_id THEN
      RAISE EXCEPTION 'غير مصرح للطبيب بتعديل بيانات طبيب آخر';
    END IF;

    IF NEW.id <> OLD.id OR 
       NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR
       NEW.clinic_name IS DISTINCT FROM OLD.clinic_name OR
       NEW.name IS DISTINCT FROM OLD.name OR
       NEW.specialty IS DISTINCT FROM OLD.specialty OR
       NEW.title IS DISTINCT FROM OLD.title OR
       NEW.max_daily_patients IS DISTINCT FROM OLD.max_daily_patients OR
       NEW.current_queue_number IS DISTINCT FROM OLD.current_queue_number OR
       NEW.phone IS DISTINCT FROM OLD.phone OR
       NEW.bio IS DISTINCT FROM OLD.bio OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'غير مصرح للطبيب إلا بتعديل حالة التواجد والجدول الزمني وساعات العمل والاعتذار فقط';
    END IF;
    RETURN NEW;
  ELSIF v_role = 'reception' THEN
    IF NEW.id <> OLD.id OR 
       NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR
       NEW.clinic_name IS DISTINCT FROM OLD.clinic_name OR
       NEW.name IS DISTINCT FROM OLD.name OR
       NEW.specialty IS DISTINCT FROM OLD.specialty OR
       NEW.title IS DISTINCT FROM OLD.title OR
       NEW.schedule_days IS DISTINCT FROM OLD.schedule_days OR
       NEW.schedule_hours IS DISTINCT FROM OLD.schedule_hours OR
       NEW.max_daily_patients IS DISTINCT FROM OLD.max_daily_patients OR
       NEW.current_queue_number IS DISTINCT FROM OLD.current_queue_number OR
       NEW.phone IS DISTINCT FROM OLD.phone OR
       NEW.bio IS DISTINCT FROM OLD.bio OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'غير مصرح لموظف الاستقبال إلا بتعديل حالة حضور الطبيب اليومية فقط';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'غير مصرح لهذا الدور بتعديل بيانات الأطباء';
END;
$$;

DROP TRIGGER IF EXISTS trg_doctor_update_guard ON public.doctors;
CREATE TRIGGER trg_doctor_update_guard
BEFORE UPDATE ON public.doctors
FOR EACH ROW
EXECUTE FUNCTION public.trg_doctor_self_update_guard();

-- سياسات جدول التشغيل (daily_schedule)
DROP POLICY IF EXISTS "Public read daily_schedule" ON public.daily_schedule;
CREATE POLICY "Public read daily_schedule" ON public.daily_schedule FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin modify daily_schedule" ON public.daily_schedule;
CREATE POLICY "Admin modify daily_schedule" ON public.daily_schedule FOR ALL USING (
  public.get_auth_role() IN ('admin', 'reception', 'cashier') OR auth.role() = 'service_role'
) WITH CHECK (
  public.get_auth_role() IN ('admin', 'reception', 'cashier') OR auth.role() = 'service_role'
);

-- سياسات حسابات الموظفين (staff_accounts)
DROP POLICY IF EXISTS "Authenticated read staff" ON public.staff_accounts;
CREATE POLICY "Authenticated read staff" ON public.staff_accounts FOR SELECT USING (
  auth.uid() IS NOT NULL OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "Admin modify staff" ON public.staff_accounts;
CREATE POLICY "Admin modify staff" ON public.staff_accounts FOR ALL USING (
  public.get_auth_role() = 'admin' OR auth.role() = 'service_role'
) WITH CHECK (
  public.get_auth_role() = 'admin' OR auth.role() = 'service_role'
);

-- سياسات وصلاحيات رموز التحقق لاستعادة كلمة المرور (password_reset_codes) - حصر الوصول الصارم بالـ Backend / service_role
REVOKE ALL ON TABLE public.password_reset_codes FROM PUBLIC;
REVOKE ALL ON TABLE public.password_reset_codes FROM anon, authenticated;
GRANT ALL ON TABLE public.password_reset_codes TO service_role;

DROP POLICY IF EXISTS "Service role only password_reset_codes" ON public.password_reset_codes;
CREATE POLICY "Service role only password_reset_codes" ON public.password_reset_codes
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- دوال ذرية (Atomic RPCs) لإدارة دورة حياة OTP و Reset Token بأمان ضد الطلبات المتزامنة (حصر التنفيذ بـ service_role فقط)
CREATE OR REPLACE FUNCTION public.rpc_create_password_reset_otp(
  p_request_id UUID,
  p_user_id UUID,
  p_username TEXT,
  p_email TEXT,
  p_code_hash TEXT,
  p_ttl_seconds INTEGER DEFAULT 600,
  p_cooldown_seconds INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_username TEXT := lower(trim(p_username));
  v_clean_email TEXT := lower(trim(p_email));
  v_last_created_at TIMESTAMPTZ;
  v_elapsed_seconds NUMERIC;
  v_retry_after INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: service_role required';
  END IF;

  -- قفل ذري على مستوى المعاملة لاسم المستخدم لمنع تداخل طلبين متزامنين في نفس اللحظة
  PERFORM pg_advisory_xact_lock(hashtext('pwd_reset:' || v_clean_username));

  -- تنظيف السجلات المنتهية منذ أكثر من 24 ساعة للحفاظ على نظافة الجدول
  DELETE FROM public.password_reset_codes
  WHERE expires_at < (now() - interval '24 hours');

  -- فحص Cooldown (60 ثانية) من أحدث سجل لنفس المستخدم
  SELECT created_at
  INTO v_last_created_at
  FROM public.password_reset_codes
  WHERE lower(username) = v_clean_username
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_created_at IS NOT NULL THEN
    v_elapsed_seconds := EXTRACT(EPOCH FROM (now() - v_last_created_at));
    IF v_elapsed_seconds < p_cooldown_seconds THEN
      v_retry_after := GREATEST(1, CEIL(p_cooldown_seconds - v_elapsed_seconds)::INTEGER);
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'COOLDOWN',
        'retry_after_seconds', v_retry_after
      );
    END IF;
  END IF;

  -- إبطال أي سجل سابق غير مستخدم لنفس المستخدم داخل نفس المعاملة الذرية
  UPDATE public.password_reset_codes
  SET is_used = true,
      attempts_left = 0
  WHERE lower(username) = v_clean_username
    AND is_used = false;

  -- إدراج سجل الـ OTP الجديد
  INSERT INTO public.password_reset_codes (
    id,
    user_id,
    username,
    email,
    code_hash,
    attempts_left,
    expires_at,
    is_used,
    created_at
  ) VALUES (
    p_request_id,
    p_user_id,
    v_clean_username,
    v_clean_email,
    p_code_hash,
    3,
    now() + make_interval(secs => p_ttl_seconds),
    false,
    now()
  );

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_verify_password_reset_otp(
  p_row_id UUID,
  p_username TEXT,
  p_email TEXT,
  p_candidate_otp_hash TEXT,
  p_new_token_hash TEXT,
  p_token_ttl_seconds INTEGER DEFAULT 300
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.password_reset_codes%ROWTYPE;
  v_clean_username TEXT := lower(trim(p_username));
  v_clean_email TEXT := lower(trim(p_email));
  v_remaining INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: service_role required';
  END IF;

  -- قفل الصف ذرياً لمنع أي محاولات تحقق متزامنة من تخطي عداد المحاولات أو استخدام الكود مرتين
  SELECT *
  INTO v_row
  FROM public.password_reset_codes
  WHERE id = p_row_id
    AND lower(username) = v_clean_username
  FOR UPDATE;

  IF NOT FOUND OR v_row.is_used OR v_row.code_hash NOT LIKE 'otp:%' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_OR_MISSING');
  END IF;

  IF now() > v_row.expires_at THEN
    UPDATE public.password_reset_codes
    SET is_used = true,
        attempts_left = 0
    WHERE id = v_row.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'EXPIRED');
  END IF;

  IF v_row.attempts_left <= 0 THEN
    UPDATE public.password_reset_codes
    SET is_used = true,
        attempts_left = 0
    WHERE id = v_row.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'MAX_ATTEMPTS');
  END IF;

  IF lower(v_row.email) <> v_clean_email OR v_row.code_hash <> p_candidate_otp_hash THEN
    v_remaining := GREATEST(0, v_row.attempts_left - 1);
    UPDATE public.password_reset_codes
    SET attempts_left = v_remaining,
        is_used = (v_remaining <= 0)
    WHERE id = v_row.id;

    IF v_remaining <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'MAX_ATTEMPTS', 'attempts_left', 0);
    END IF;

    RETURN jsonb_build_object('ok', false, 'reason', 'MISMATCH', 'attempts_left', v_remaining);
  END IF;

  -- إبطال الـ OTP فوراً وتحويل السجل ذرياً إلى مرحلة reset_token بصلاحية 5 دقائق ومحاولة واحدة
  UPDATE public.password_reset_codes
  SET code_hash = p_new_token_hash,
      attempts_left = 1,
      expires_at = now() + make_interval(secs => p_token_ttl_seconds),
      is_used = false
  WHERE id = v_row.id;

  RETURN jsonb_build_object('ok', true, 'request_id', v_row.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_consume_password_reset_token(
  p_row_id UUID,
  p_username TEXT,
  p_email TEXT,
  p_candidate_token_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.password_reset_codes%ROWTYPE;
  v_clean_username TEXT := lower(trim(p_username));
  v_clean_email TEXT := lower(trim(p_email));
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: service_role required';
  END IF;

  -- قفل الصف ذرياً لضمان استهلاك resetToken مرة واحدة فقط وعدم إمكانية استخدامه في طلبين متزامنين
  SELECT *
  INTO v_row
  FROM public.password_reset_codes
  WHERE id = p_row_id
    AND lower(username) = v_clean_username
  FOR UPDATE;

  IF NOT FOUND OR v_row.is_used OR v_row.attempts_left <= 0 OR v_row.code_hash NOT LIKE 'token:%' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_OR_USED');
  END IF;

  IF v_clean_email <> '' AND lower(v_row.email) <> v_clean_email THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_OR_USED');
  END IF;

  IF now() > v_row.expires_at THEN
    UPDATE public.password_reset_codes
    SET is_used = true,
        attempts_left = 0,
        code_hash = 'expired:' || v_row.id::text
    WHERE id = v_row.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'EXPIRED');
  END IF;

  IF v_row.code_hash <> p_candidate_token_hash THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_TOKEN');
  END IF;

  -- استهلاك نهائي لا رجعة فيه (Burn-on-Use) قبل تحديث كلمة المرور
  UPDATE public.password_reset_codes
  SET is_used = true,
      attempts_left = 0,
      code_hash = 'used:' || v_row.id::text
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', v_row.user_id,
    'username', v_row.username
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_create_password_reset_otp(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_password_reset_otp(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_verify_password_reset_otp(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_verify_password_reset_otp(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_consume_password_reset_token(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_consume_password_reset_token(UUID, TEXT, TEXT, TEXT) TO service_role;

-- تريجر حماية أعمدة الحجوزات الحساسة ومنع تعديلها أو إدراجها بشكل غير مشروع (Defense-in-Depth)
CREATE OR REPLACE FUNCTION public.trg_bookings_column_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := public.get_auth_role();
  v_today DATE := public.get_cairo_today();
  v_clinic public.clinics%ROWTYPE;
  v_doctor public.doctors%ROWTYPE;
  v_expected_queue_pos INTEGER;
  v_expected_ticket_1 TEXT;
  v_expected_ticket_2 TEXT;
  v_trimmed_name TEXT;
BEGIN
  -- الأدمن و service_role معفيان من القيود
  IF v_role = 'admin' OR auth.role() = 'service_role' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  -- السماح بالحذف لمدير النظام أو عبر دالة الحذف الآمنة للموظفين المعتمدين (الكاشير / الاستقبال)
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(current_setting('app.in_delete_booking', true), '') = OLD.id THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'غير مصرح بحذف سجلات الحجوزات بشكل مباشر؛ يرجى استخدام دالة الحذف المعتمدة';
  END IF;

  -- منع الطبيب تماماً من التعامل مع جدول الحجوزات (إدراج أو تعديل)
  IF v_role = 'doctor' THEN
    RAISE EXCEPTION 'غير مصرح للطبيب بالوصول إلى سجلات الحجوزات أو إدارتها؛ صلاحية الطبيب مقتصرة على الحضور اليومي والجدول الأسبوعي فقط';
  END IF;

  -- حماية الإدراج (BEFORE INSERT): التحقق الصارم من كافة الحقول المولدة والحساسة لمنع التزوير
  IF TG_OP = 'INSERT' THEN
    -- 1. التحقق من التاريخ والحالة الابتدائية وحقول الدفع والتشخيص
    IF NEW.date IS DISTINCT FROM v_today THEN
      RAISE EXCEPTION 'غير مصرح بإدراج حجز خارج تاريخ اليوم الحالي بتوقيت القاهرة';
    END IF;

    IF NEW.status IS DISTINCT FROM 'waiting' THEN
      RAISE EXCEPTION 'غير مصرح بإدراج حجز جديد بحالة غير waiting';
    END IF;

    IF NEW.payment_status IS DISTINCT FROM 'unpaid' OR
       NEW.payment_method IS NOT NULL OR
       NEW.paid_at IS NOT NULL OR
       NEW.payment_confirmed_at IS NOT NULL THEN
      RAISE EXCEPTION 'غير مصرح بإدراج حجز مسدد أو معفى مسبقاً؛ يجب أن يبدأ الحجز بحالة unpaid ويتم السداد عبر confirm_payment فقط';
    END IF;

    IF NEW.doctor_diagnosis IS NOT NULL OR
       NEW.called_at IS NOT NULL OR
       NEW.completed_at IS NOT NULL THEN
      RAISE EXCEPTION 'غير مصرح بتمرير تشخيص طبي أو أوقات استدعاء أو إكمال عند إنشاء الحجز';
    END IF;

    -- 2. منع تزوير وقت الإنشاء (created_at)
    IF NEW.created_at IS NULL OR abs(extract(epoch from (NEW.created_at - now()))) > 5 THEN
      RAISE EXCEPTION 'غير مصرح بالتلاعب بوقت إنشاء الحجز (created_at)';
    END IF;

    -- 3. التحقق من صحة اسم المريض الثلاثي ورقم الهاتف
    v_trimmed_name := regexp_replace(trim(COALESCE(NEW.patient_name, '')), '\s+', ' ', 'g');
    IF array_length(string_to_array(v_trimmed_name, ' '), 1) < 3 THEN
      RAISE EXCEPTION 'يجب كتابة اسم المريض ثلاثياً على الأقل';
    END IF;

    IF length(regexp_replace(trim(COALESCE(NEW.patient_phone, '')), '\D', '', 'g')) < 10 THEN
      RAISE EXCEPTION 'يرجى إدخال رقم هاتف محمول صحيح';
    END IF;

    -- 4. قفل ذري على مستوى المعاملة والعيادة لمنع التداخل المتزامن (Concurrency Serialization) ثم التحقق من العيادة وعدم تزوير clinic_name أو fee
    PERFORM pg_advisory_xact_lock(hashtext('booking_seq:' || COALESCE(NEW.clinic_id, '') || ':' || v_today::text));

    SELECT * INTO v_clinic
    FROM public.clinics
    WHERE id = NEW.clinic_id
      AND id NOT LIKE '\_system%'
    FOR UPDATE;

    IF NOT FOUND OR NOT v_clinic.is_open_today THEN
      RAISE EXCEPTION 'العيادة المحددة غير موجودة أو مغلقة اليوم';
    END IF;

    IF NEW.clinic_name IS DISTINCT FROM v_clinic.name THEN
      RAISE EXCEPTION 'اسم العيادة (clinic_name) مزور أو غير مطابق للاسم الرسمي للعيادة';
    END IF;

    IF NEW.fee IS DISTINCT FROM v_clinic.price THEN
      RAISE EXCEPTION 'قيمة رسوم الكشف (fee) مزورة أو غير مطابقة للسعر الرسمي للعيادة';
    END IF;

    -- 5. التحقق من الطبيب وتبعيته للعيادة وحضوره وعدم تزوير doctor_name
    SELECT * INTO v_doctor
    FROM public.doctors
    WHERE id = NEW.doctor_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'الطبيب المحدد غير مسجل في المنظومة';
    END IF;

    IF v_doctor.clinic_id IS DISTINCT FROM NEW.clinic_id THEN
      RAISE EXCEPTION 'الطبيب المحدد لا يتبع العيادة المختارة';
    END IF;

    IF NOT v_doctor.is_present_today OR v_doctor.status = 'offline' THEN
      RAISE EXCEPTION 'الطبيب المحدد غير متواجد أو غير متاح اليوم';
    END IF;

    IF NEW.doctor_name IS DISTINCT FROM v_doctor.name THEN
      RAISE EXCEPTION 'اسم الطبيب (doctor_name) مزور أو غير مطابق للاسم الرسمي للطبيب';
    END IF;

    -- 6. التحقق الصارم من queue_position وعدم تجاوز الحد اليومي
    SELECT COALESCE(MAX(b.queue_position), 0) + 1
    INTO v_expected_queue_pos
    FROM public.bookings b
    WHERE b.date = v_today
      AND b.clinic_id = NEW.clinic_id;

    IF NEW.queue_position IS DISTINCT FROM v_expected_queue_pos THEN
      RAISE EXCEPTION 'رقم الدور (queue_position) مزور أو غير مطابق للدور التسلسلي المتوقع (%)', v_expected_queue_pos;
    END IF;

    IF v_doctor.max_daily_patients IS NOT NULL AND NEW.queue_position > v_doctor.max_daily_patients THEN
      RAISE EXCEPTION 'عذراً، اكتمل العدد الأقصى المتاح لحجوزات هذا الطبيب لليوم (%s كشف)', v_doctor.max_daily_patients;
    END IF;

    -- 7. التحقق الصارم من ticket_number لمنع تمرير رقم تذكرة مزور
    v_expected_ticket_1 := 'T-' || lpad(v_expected_queue_pos::text, 3, '0');
    v_expected_ticket_2 := COALESCE(NULLIF(split_part(v_clinic.name, ' ', 2), ''), 'كشف') || '-' || lpad(v_expected_queue_pos::text, 2, '0');

    IF NEW.ticket_number IS DISTINCT FROM v_expected_ticket_1
       AND NEW.ticket_number IS DISTINCT FROM v_expected_ticket_2 THEN
      RAISE EXCEPTION 'رقم التذكرة (ticket_number) مزور أو غير مطابق للرقم التسلسلي للنظام (%)', v_expected_ticket_1;
    END IF;

    NEW.created_at := now();
    RETURN NEW;
  END IF;

  -- قيود دور الاستقبال عند التعديل: الاستقبال مصرح له بتحديث حالة الطابور وتأكيد الوصول وإلغاء الحجز وملاحظات الاستقبال فقط لحجوزات اليوم المسددة وغير الملغاة
  IF v_role = 'reception' THEN
    IF OLD.date <> v_today THEN
      RAISE EXCEPTION 'غير مصرح لموظف الاستقبال بتعديل حجز خارج تاريخ اليوم الحالي';
    END IF;

    IF OLD.payment_status NOT IN ('paid', 'exempt') OR OLD.status = 'cancelled' THEN
      RAISE EXCEPTION 'غير مصرح لموظف الاستقبال بتنفيذ أي تعديل أو عملية طابور على حجز غير مسدد (unpaid) أو ملغي (cancelled)';
    END IF;

    IF NEW.id <> OLD.id OR
       NEW.fee IS DISTINCT FROM OLD.fee OR
       NEW.payment_status IS DISTINCT FROM OLD.payment_status OR
       NEW.payment_method IS DISTINCT FROM OLD.payment_method OR
       NEW.paid_at IS DISTINCT FROM OLD.paid_at OR
       NEW.payment_confirmed_at IS DISTINCT FROM OLD.payment_confirmed_at OR
       NEW.doctor_diagnosis IS DISTINCT FROM OLD.doctor_diagnosis OR
       NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR
       NEW.clinic_name IS DISTINCT FROM OLD.clinic_name OR
       NEW.doctor_id IS DISTINCT FROM OLD.doctor_id OR
       NEW.doctor_name IS DISTINCT FROM OLD.doctor_name OR
       NEW.patient_name IS DISTINCT FROM OLD.patient_name OR
       NEW.patient_phone IS DISTINCT FROM OLD.patient_phone OR
       NEW.ticket_number IS DISTINCT FROM OLD.ticket_number OR
       NEW.queue_position IS DISTINCT FROM OLD.queue_position OR
       NEW.date IS DISTINCT FROM OLD.date OR
       NEW.time_slot IS DISTINCT FROM OLD.time_slot OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'غير مصرح لموظف الاستقبال بتعديل البيانات المالية أو التشخيص الطبي أو العيادة أو بيانات المريض الأساسية';
    END IF;

    RETURN NEW;
  END IF;

  -- قيود دور الكاشير: يمنع تماماً من التعديل المباشر، ويسمح فقط بتمرير تحديث السداد من داخل confirm_payment RPC لنفس رقم الحجز حصراً
  IF v_role = 'cashier' THEN
    IF COALESCE(current_setting('app.in_confirm_payment', true), '') <> OLD.id THEN
      RAISE EXCEPTION 'غير مصرح للكاشير بالتعديل المباشر على جدول الحجوزات؛ يجب استخدام confirm_payment فقط';
    END IF;

    IF OLD.date <> v_today OR OLD.status IN ('cancelled', 'completed') THEN
      RAISE EXCEPTION 'غير مصرح للكاشير بتأكيد دفع حجز ملغي أو مكتمل أو خارج تاريخ اليوم';
    END IF;

    IF NEW.id <> OLD.id OR
       NEW.fee IS DISTINCT FROM OLD.fee OR
       NEW.doctor_diagnosis IS DISTINCT FROM OLD.doctor_diagnosis OR
       NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR
       NEW.clinic_name IS DISTINCT FROM OLD.clinic_name OR
       NEW.doctor_id IS DISTINCT FROM OLD.doctor_id OR
       NEW.doctor_name IS DISTINCT FROM OLD.doctor_name OR
       NEW.patient_name IS DISTINCT FROM OLD.patient_name OR
       NEW.patient_phone IS DISTINCT FROM OLD.patient_phone OR
       NEW.ticket_number IS DISTINCT FROM OLD.ticket_number OR
       NEW.date IS DISTINCT FROM OLD.date OR
       NEW.time_slot IS DISTINCT FROM OLD.time_slot OR
       NEW.queue_position IS DISTINCT FROM OLD.queue_position OR
       NEW.status IS DISTINCT FROM OLD.status OR
       NEW.notes IS DISTINCT FROM OLD.notes OR
       NEW.called_at IS DISTINCT FROM OLD.called_at OR
       NEW.completed_at IS DISTINCT FROM OLD.completed_at OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'غير مصرح للكاشير بتعديل أي بيانات غير حالة وطريقة ووقت السداد';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'غير مصرح لهذا الدور بتعديل جدول الحجوزات';
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_update_guard ON public.bookings;
CREATE TRIGGER trg_bookings_update_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.trg_bookings_column_guard();

-- سحب صلاحيات الوصول المباشر لجدول bookings عن anon و PUBLIC
REVOKE ALL ON TABLE public.bookings FROM PUBLIC;
REVOKE ALL ON TABLE public.bookings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bookings TO authenticated, service_role;

-- سياسات الحجوزات المحكمة (bookings RLS) - تنظيم القراءة والإضافة والتعديل بحسب الدور الوظيفي ونطاق العمل
DROP POLICY IF EXISTS "Public read bookings" ON public.bookings;
DROP POLICY IF EXISTS "Staff update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Doctor select own clinic bookings" ON public.bookings;
DROP POLICY IF EXISTS "Doctor update own clinic bookings" ON public.bookings;
DROP POLICY IF EXISTS "Reception select today bookings" ON public.bookings;
DROP POLICY IF EXISTS "Reception select bookings" ON public.bookings;
DROP POLICY IF EXISTS "Reception insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Reception update today bookings" ON public.bookings;
DROP POLICY IF EXISTS "Cashier select today bookings" ON public.bookings;
DROP POLICY IF EXISTS "Cashier select bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin full access bookings" ON public.bookings;
DROP POLICY IF EXISTS "Staff update allowed bookings" ON public.bookings;

-- ملاحظة أمنية: دور الطبيب (doctor) لا يملك أي صلاحية SELECT أو INSERT أو UPDATE أو DELETE على جدول bookings
-- لأن وظيفة الطبيب في النظام تقتصر حصرياً على إدارة حضوره اليومي وجدوله الأسبوعي في جدول doctors.

-- 1. قراءة الاستقبال لحجوزات اليوم المسددة أو المعفاة وغير الملغاة فقط بتوقيت مصر (لا يرى الاستقبال الحجوزات غير المدفوعة unpaid أو الملغاة cancelled)
CREATE POLICY "Reception select today bookings" ON public.bookings
FOR SELECT USING (
  public.get_auth_role() = 'reception'
  AND date = public.get_cairo_today()
  AND payment_status IN ('paid', 'exempt')
  AND status <> 'cancelled'
);

-- 2. صلاحية موظف الاستقبال لإنشاء الحجوزات للمرضى الحاضرين لليوم بتوقيت مصر (محمية بشروط صارمة تمنع التزوير وتعمل بالتكامل مع تريجر trg_bookings_column_guard)
CREATE POLICY "Reception insert bookings" ON public.bookings
FOR INSERT WITH CHECK (
  public.get_auth_role() = 'reception'
  AND date = public.get_cairo_today()
  AND status = 'waiting'
  AND payment_status = 'unpaid'
  AND payment_method IS NULL
  AND paid_at IS NULL
  AND payment_confirmed_at IS NULL
  AND doctor_diagnosis IS NULL
  AND called_at IS NULL
  AND completed_at IS NULL
  AND created_at IS NOT NULL
  AND abs(extract(epoch from (created_at - now()))) <= 5
  AND queue_position >= 1
  AND (
    ticket_number = 'T-' || lpad(queue_position::text, 3, '0')
    OR ticket_number = COALESCE(NULLIF(split_part(clinic_name, ' ', 2), ''), 'كشف') || '-' || lpad(queue_position::text, 2, '0')
  )
  AND EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = bookings.clinic_id
      AND c.id NOT LIKE '\_system%'
      AND c.is_open_today = true
      AND c.price = bookings.fee
      AND c.name = bookings.clinic_name
  )
  AND EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.id = bookings.doctor_id
      AND d.clinic_id = bookings.clinic_id
      AND d.is_present_today = true
      AND d.status <> 'offline'
      AND d.name = bookings.doctor_name
      AND (d.max_daily_patients IS NULL OR bookings.queue_position <= d.max_daily_patients)
  )
);

-- 3. تعديل الاستقبال مقيد بحجوزات اليوم المسددة أو المعفاة وغير الملغاة فقط بتوقيت مصر (ومحمي عمودياً عبر trg_bookings_column_guard)
CREATE POLICY "Reception update today bookings" ON public.bookings
FOR UPDATE USING (
  public.get_auth_role() = 'reception'
  AND date = public.get_cairo_today()
  AND payment_status IN ('paid', 'exempt')
  AND status <> 'cancelled'
) WITH CHECK (
  public.get_auth_role() = 'reception'
  AND date = public.get_cairo_today()
  AND payment_status IN ('paid', 'exempt')
  AND status IN ('waiting', 'in-progress', 'completed', 'late', 'cancelled')
);

-- 4. قراءة الكاشير لحجوزات اليوم بتوقيت مصر فقط لمتابعة التحصيل وتأكيد السداد وإصدار الإيصالات (بدون أي صلاحية UPDATE مباشر)
CREATE POLICY "Cashier select today bookings" ON public.bookings
FOR SELECT USING (
  public.get_auth_role() = 'cashier'
  AND date = public.get_cairo_today()
);

-- 5. وصول كامل وشامل لمدير النظام و service_role (قراءة، إضافة، تعديل، حذف وتطهير)
CREATE POLICY "Admin full access bookings" ON public.bookings
FOR ALL USING (
  public.get_auth_role() = 'admin' OR auth.role() = 'service_role'
) WITH CHECK (
  public.get_auth_role() = 'admin' OR auth.role() = 'service_role'
);

-- ==============================================================================
-- العرض العام لشاشة الانتظار (Public Queue Display View - محمي وخالٍ من البيانات الحساسة)
-- ==============================================================================
CREATE OR REPLACE VIEW public.public_queue_display 
WITH (security_invoker = false) AS
SELECT 
  b.id,
  b.ticket_number,
  b.clinic_id,
  b.clinic_name,
  b.doctor_name,
  b.queue_position,
  b.status,
  b.date,
  b.called_at,
  CASE 
    WHEN length(b.patient_name) > 0 THEN 
      split_part(trim(b.patient_name), ' ', 1) || ' ' || 
      COALESCE(substr(split_part(trim(b.patient_name), ' ', 2), 1, 1) || '.', '')
    ELSE 'مريض'
  END AS patient_display_name,
  b.doctor_id
FROM public.bookings b
WHERE b.date = public.get_cairo_today() 
  AND b.status IN ('waiting', 'in-progress', 'late')
  AND b.payment_status IN ('paid', 'exempt');

GRANT SELECT ON public.public_queue_display TO anon, authenticated, service_role;

-- ==============================================================================
-- استعلام تذكرة المريض الآمن (Secure Patient Ticket Lookup RPC)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_patient_ticket_secure(
  p_ticket_number TEXT,
  p_phone_last_4 TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_clean_last_4 TEXT;
BEGIN
  v_clean_last_4 := regexp_replace(COALESCE(trim(p_phone_last_4), ''), '\D', '', 'g');
  IF p_ticket_number IS NULL OR length(trim(p_ticket_number)) = 0 OR length(v_clean_last_4) <> 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'يرجى إدخال رقم التذكرة وآخر 4 أرقام من رقم الهاتف بشكل صحيح');
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE upper(trim(ticket_number)) = upper(trim(p_ticket_number))
    AND right(regexp_replace(patient_phone, '\D', '', 'g'), 4) = v_clean_last_4
    AND (notes IS NULL OR notes <> '__PURGED_PAST_BOOKING__')
  ORDER BY date DESC, created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'لم يتم العثور على تذكرة مطابقة لرقم التذكرة ورقم الهاتف المدخل');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ticket', jsonb_build_object(
      'id', v_booking.id,
      'ticket_number', v_booking.ticket_number,
      'clinic_id', v_booking.clinic_id,
      'clinic_name', v_booking.clinic_name,
      'doctor_id', v_booking.doctor_id,
      'doctor_name', v_booking.doctor_name,
      'date', v_booking.date,
      'time_slot', v_booking.time_slot,
      'queue_position', v_booking.queue_position,
      'status', v_booking.status,
      'payment_status', v_booking.payment_status,
      'fee', v_booking.fee
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_patient_ticket_secure(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_patient_ticket_secure(TEXT, TEXT) TO anon, authenticated, service_role;

-- ==============================================================================
-- استعلام سجل زيارات المريض برقم الهاتف للموظفين المعتمدين (Secure Patient History Lookup RPC)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_patient_history_by_phone(
  p_patient_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := public.get_auth_role();
  v_clean_phone TEXT;
  v_result JSONB;
BEGIN
  -- 1. التحقق من أن المستدعي موظف معتمد فقط (admin أو cashier أو reception فقط - يمنع doctor و anon)
  IF COALESCE(v_role, '') NOT IN ('admin', 'cashier', 'reception') AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'غير مصرح بالوصول إلى سجل زيارات المرضى';
  END IF;

  -- 2. اشتراط رقم هاتف كامل وصحيح لمنع الاستعلام الجزئي أو سحب كافة السجلات
  v_clean_phone := regexp_replace(COALESCE(trim(p_patient_phone), ''), '\D', '', 'g');
  IF length(v_clean_phone) < 10 OR length(v_clean_phone) > 15 THEN
    RAISE EXCEPTION 'يرجى إدخال رقم هاتف صحيح ومكتمل (10 أرقام على الأقل) للبحث في سجل المريض';
  END IF;

  -- 3. إرجاع السجلات المطابقة للرقم فقط مع حجب التشخيص الطبي والملاحظات عن الكاشير والاستقبال
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'ticket_number', b.ticket_number,
        'patient_name', b.patient_name,
        'patient_phone', b.patient_phone,
        'clinic_id', b.clinic_id,
        'clinic_name', b.clinic_name,
        'doctor_id', b.doctor_id,
        'doctor_name', b.doctor_name,
        'date', b.date,
        'time_slot', b.time_slot,
        'queue_position', b.queue_position,
        'status', b.status,
        'payment_status', b.payment_status,
        'payment_method', b.payment_method,
        'fee', b.fee,
        'created_at', b.created_at,
        'called_at', b.called_at,
        'completed_at', b.completed_at,
        'paid_at', b.paid_at,
        'doctor_diagnosis', CASE WHEN v_role = 'admin' OR auth.role() = 'service_role' THEN b.doctor_diagnosis ELSE NULL END,
        'notes', CASE WHEN v_role = 'admin' OR auth.role() = 'service_role' THEN b.notes ELSE NULL END
      )
      ORDER BY b.date DESC, b.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT *
    FROM public.bookings b
    WHERE regexp_replace(b.patient_phone, '\D', '', 'g') = v_clean_phone
      AND (b.notes IS NULL OR b.notes <> '__PURGED_PAST_BOOKING__')
      AND (v_role <> 'reception' OR (b.payment_status IN ('paid', 'exempt') AND b.status <> 'cancelled'))
    ORDER BY b.date DESC, b.created_at DESC
    LIMIT 50
  ) b;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_patient_history_by_phone(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_patient_history_by_phone(TEXT) TO authenticated, service_role;

-- ==============================================================================
-- دوال الـ RPC الآمنة (Stored Procedures - SECURITY DEFINER)
-- ==============================================================================

-- 1) دالة إنشاء حجز جديد آمن للمرضى
CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_clinic_id TEXT,
  p_doctor_id TEXT,
  p_patient_name TEXT,
  p_patient_phone TEXT,
  p_time_slot TEXT DEFAULT '10:00 ص - 10:30 ص',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic public.clinics%ROWTYPE;
  v_doctor public.doctors%ROWTYPE;
  v_name_parts TEXT[];
  v_trimmed_name TEXT;
  v_existing_active_count INTEGER;
  v_today DATE := public.get_cairo_today();
  v_next_ticket INTEGER;
  v_new_booking_id TEXT;
  v_ticket_number_str TEXT;
  v_result JSONB;
BEGIN
  -- منع دور الطبيب من إنشاء حجوزات للمرضى
  IF public.get_auth_role() = 'doctor' THEN
    RAISE EXCEPTION 'غير مصرح للطبيب بإنشاء حجوزات للمرضى';
  END IF;

  -- (أ) التحقق من أن اسم المريض ثلاثي على الأقل
  v_trimmed_name := regexp_replace(trim(COALESCE(p_patient_name, '')), '\s+', ' ', 'g');
  v_name_parts := string_to_array(v_trimmed_name, ' ');
  IF array_length(v_name_parts, 1) < 3 THEN
    RAISE EXCEPTION 'يجب كتابة اسم المريض ثلاثياً على الأقل لضمان تسجيل السجلات الطبية بدقة';
  END IF;

  -- فحص رقم الهاتف
  IF length(regexp_replace(trim(COALESCE(p_patient_phone, '')), '\D', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'يرجى إدخال رقم هاتف محمول صحيح';
  END IF;

  -- قفل ذري متسلسل (Transaction Advisory Lock + Row FOR UPDATE Lock) خاص بالعيادة وتاريخ اليوم لمنع أي Race Condition عند الحجز المتزامن
  PERFORM pg_advisory_xact_lock(hashtext('booking_seq:' || COALESCE(p_clinic_id, '') || ':' || v_today::text));

  -- (ج) التحقق من أن العيادة مفتوحة اليوم وليست سجلاً نظامياً (مع قفل صف العيادة لتسلسل توليد الأدوار المتزامنة)
  SELECT * INTO v_clinic
  FROM public.clinics
  WHERE id = p_clinic_id AND id NOT LIKE '\_system%'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'العيادة المحددة غير موجودة في المنظومة';
  END IF;
  IF NOT v_clinic.is_open_today THEN
    RAISE EXCEPTION 'عذراً، هذه العيادة مغلقة اليوم ولا تستقبل حجوزات جديدة';
  END IF;

  -- التحقق من وجود الطبيب وأنه تابع فعلاً للعيادة المحددة ومتواجد اليوم
  SELECT * INTO v_doctor FROM public.doctors WHERE id = p_doctor_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطبيب المحدد غير مسجل في المنظومة';
  END IF;
  IF v_doctor.clinic_id IS DISTINCT FROM p_clinic_id THEN
    RAISE EXCEPTION 'الطبيب المحدد لا يتبع العيادة المختارة؛ يرجى اختيار طبيب من نفس العيادة';
  END IF;
  IF NOT v_doctor.is_present_today OR v_doctor.status = 'offline' THEN
    RAISE EXCEPTION 'عذراً، الطبيب غير متواجد اليوم (%s)', COALESCE(v_doctor.unavailable_reason, 'اعتذار رسمي');
  END IF;

  -- (ب) التحقق من عدم وجود حجز نشط بنفس الهاتف والاسم في نفس العيادة اليوم
  SELECT count(*) INTO v_existing_active_count
  FROM public.bookings
  WHERE date = v_today
    AND clinic_id = p_clinic_id
    AND patient_phone = trim(p_patient_phone)
    AND patient_name = v_trimmed_name
    AND status IN ('waiting', 'in-progress', 'late');

  IF v_existing_active_count > 0 THEN
    RAISE EXCEPTION 'يوجد حجز نشط بالفعل لهذا المريض في نفس العيادة اليوم';
  END IF;

  -- حساب رقم التذكرة المتسلسل بشكل ذري محمي بالقفل
  SELECT COALESCE(MAX(queue_position), 0) + 1 INTO v_next_ticket
  FROM public.bookings
  WHERE date = v_today AND clinic_id = p_clinic_id;

  -- فحص الحد الأقصى للمرضى
  IF v_doctor.max_daily_patients IS NOT NULL AND v_next_ticket > v_doctor.max_daily_patients THEN
    RAISE EXCEPTION 'عذراً، اكتمل العدد الأقصى المتاح لحجوزات هذا الطبيب لليوم (%s كشف)', v_doctor.max_daily_patients;
  END IF;

  v_ticket_number_str := 'T-' || lpad(v_next_ticket::text, 3, '0');
  v_new_booking_id := 'bkg-' || extract(epoch from clock_timestamp())::bigint || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  -- إدراج الحجز
  INSERT INTO public.bookings (
    id,
    ticket_number,
    patient_name,
    patient_phone,
    clinic_id,
    clinic_name,
    doctor_id,
    doctor_name,
    date,
    time_slot,
    queue_position,
    status,
    payment_status,
    fee,
    notes,
    created_at
  ) VALUES (
    v_new_booking_id,
    v_ticket_number_str,
    v_trimmed_name,
    trim(p_patient_phone),
    v_clinic.id,
    v_clinic.name,
    v_doctor.id,
    v_doctor.name,
    v_today,
    COALESCE(p_time_slot, '10:00 ص - 10:30 ص'),
    v_next_ticket,
    'waiting',
    'unpaid',
    v_clinic.price,
    p_notes,
    now()
  );

  SELECT to_jsonb(b.*) - 'doctor_diagnosis' INTO v_result FROM public.bookings b WHERE b.id = v_new_booking_id;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_booking(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_booking(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 2) دالة تأكيد الدفع من الكاشير مع تسجيل وقت التأكيد
CREATE OR REPLACE FUNCTION public.confirm_payment(
  p_booking_id TEXT,
  p_payment_type TEXT -- 'cash', 'insurance', 'charity_exempt'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := public.get_auth_role();
  v_booking public.bookings%ROWTYPE;
  v_new_status TEXT;
  v_result JSONB;
BEGIN
  -- 1. التحقق الصارم من صلاحية المستدعي (cashier أو admin أو service_role فقط)
  IF COALESCE(v_role, '') NOT IN ('cashier', 'admin') AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'غير مصرح لك بتأكيد عمليات الدفع؛ هذه العملية مخصصة للكاشير أو مدير النظام فقط';
  END IF;

  -- 2. التحقق من صحة نوع الدفع المدخل
  IF p_payment_type IS NULL OR p_payment_type NOT IN ('cash', 'insurance', 'charity_exempt') THEN
    RAISE EXCEPTION 'طريقة الدفع غير صالحة؛ القيم المسموحة هي cash أو insurance أو charity_exempt';
  END IF;

  -- 3. التحقق من وجود الحجز وصلاحيته للسداد وعدم السماح بتمرير حجز خارج النطاق المسموح
  IF p_booking_id IS NULL OR length(trim(p_booking_id)) = 0 THEN
    RAISE EXCEPTION 'معرف الحجز مطلوب';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الحجز غير موجود';
  END IF;

  IF v_booking.status IN ('cancelled', 'completed') OR v_booking.notes = '__PURGED_PAST_BOOKING__' THEN
    RAISE EXCEPTION 'لا يمكن سداد رسوم حجز ملغي أو مكتمل';
  END IF;

  IF v_role = 'cashier' AND v_booking.date <> public.get_cairo_today() THEN
    RAISE EXCEPTION 'غير مصرح للكاشير بتأكيد دفع حجز خارج تاريخ اليوم الحالي';
  END IF;

  IF p_payment_type = 'charity_exempt' THEN
    v_new_status := 'exempt';
  ELSE
    v_new_status := 'paid';
  END IF;

  -- 4. تفعيل راية سياق المعاملة الآمنة مقيدة بمعرف الحجز المحدد حصراً ثم مسحها فوراً
  BEGIN
    PERFORM set_config('app.in_confirm_payment', p_booking_id, true);

    -- 5. تحديث أعمدة الدفع الأربعة فقط دون المساس بأي بيانات أخرى
    UPDATE public.bookings
    SET 
      payment_status = v_new_status,
      payment_method = p_payment_type,
      payment_confirmed_at = now(),
      paid_at = now()
    WHERE id = p_booking_id
      AND status NOT IN ('cancelled', 'completed')
      AND (v_role <> 'cashier' OR date = public.get_cairo_today());

    PERFORM set_config('app.in_confirm_payment', '', true);
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM set_config('app.in_confirm_payment', '', true);
      RAISE;
  END;

  SELECT to_jsonb(b.*) - 'doctor_diagnosis' INTO v_result FROM public.bookings b WHERE b.id = p_booking_id;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_payment(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_payment(TEXT, TEXT) TO authenticated, service_role;

-- 2-ب) دالة حذف حجز المريض بواسطة الموظف المعتمد (الكاشير / الاستقبال / الإدارة) في حال عدم حضور المريض
CREATE OR REPLACE FUNCTION public.delete_booking_by_staff(
  p_booking_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := public.get_auth_role();
  v_booking public.bookings%ROWTYPE;
BEGIN
  IF COALESCE(v_role, '') NOT IN ('admin', 'cashier', 'reception') AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'غير مصرح لك بحذف سجلات الحجوزات';
  END IF;

  IF p_booking_id IS NULL OR length(trim(p_booking_id)) = 0 THEN
    RAISE EXCEPTION 'معرف الحجز مطلوب';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = trim(p_booking_id);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'deleted_id', trim(p_booking_id));
  END IF;

  BEGIN
    PERFORM set_config('app.in_delete_booking', v_booking.id, true);

    DELETE FROM public.bookings
    WHERE id = v_booking.id;

    PERFORM set_config('app.in_delete_booking', '', true);
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM set_config('app.in_delete_booking', '', true);
      RAISE;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'deleted_id', v_booking.id,
    'ticket_number', v_booking.ticket_number
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_booking_by_staff(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_booking_by_staff(TEXT) TO authenticated, service_role;

-- 3) دالة تسجيل المريض كـ "متأخر" واستدعاء الحالة التالية
CREATE OR REPLACE FUNCTION public.mark_patient_late_and_call_next(
  p_current_booking_id TEXT,
  p_next_booking_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := public.get_auth_role();
  v_current_row public.bookings%ROWTYPE;
  v_next_row public.bookings%ROWTYPE;
  v_current JSONB := NULL;
  v_next JSONB := NULL;
BEGIN
  -- التحقق من صلاحية المستدعي (reception أو admin أو service_role فقط - يمنع doctor و cashier و anon)
  IF COALESCE(v_role, '') NOT IN ('reception', 'admin') AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'غير مصرح لك بإدارة طابور النداء أو تسجيل تأخر المرضى';
  END IF;

  IF p_current_booking_id IS NOT NULL AND p_current_booking_id <> '' THEN
    SELECT * INTO v_current_row FROM public.bookings WHERE id = p_current_booking_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'الحجز الحالي المحدد غير موجود';
    END IF;
    IF v_current_row.date <> public.get_cairo_today() OR v_current_row.status = 'cancelled' THEN
      RAISE EXCEPTION 'لا يمكن تعديل حجز ملغي أو خارج تاريخ اليوم';
    END IF;
    IF v_current_row.payment_status NOT IN ('paid', 'exempt') THEN
      RAISE EXCEPTION 'لا يمكن تنفيذ عملية طابور أو تسجيل تأخر لحجز غير مسدد';
    END IF;

    UPDATE public.bookings
    SET status = 'late'
    WHERE id = p_current_booking_id
      AND date = public.get_cairo_today()
      AND payment_status IN ('paid', 'exempt')
      AND status <> 'cancelled';

    SELECT CASE WHEN v_role = 'reception' THEN to_jsonb(b.*) - 'doctor_diagnosis' ELSE to_jsonb(b.*) END
    INTO v_current FROM public.bookings b WHERE b.id = p_current_booking_id;
  END IF;

  IF p_next_booking_id IS NOT NULL AND p_next_booking_id <> '' THEN
    SELECT * INTO v_next_row FROM public.bookings WHERE id = p_next_booking_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'الحجز التالي المحدد غير موجود';
    END IF;
    IF v_next_row.date <> public.get_cairo_today() OR v_next_row.status = 'cancelled' THEN
      RAISE EXCEPTION 'لا يمكن استدعاء حجز ملغي أو خارج تاريخ اليوم';
    END IF;
    IF v_next_row.payment_status NOT IN ('paid', 'exempt') THEN
      RAISE EXCEPTION 'لا يمكن استدعاء مريض قبل تأكيد السداد أو الإعفاء بالخزينة';
    END IF;

    UPDATE public.bookings
    SET status = 'in-progress', called_at = now()
    WHERE id = p_next_booking_id
      AND date = public.get_cairo_today()
      AND payment_status IN ('paid', 'exempt')
      AND status <> 'cancelled';

    SELECT CASE WHEN v_role = 'reception' THEN to_jsonb(b.*) - 'doctor_diagnosis' ELSE to_jsonb(b.*) END
    INTO v_next FROM public.bookings b WHERE b.id = p_next_booking_id;
  END IF;

  RETURN jsonb_build_object(
    'late_booking', v_current,
    'called_booking', v_next
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_patient_late_and_call_next(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_patient_late_and_call_next(TEXT, TEXT) TO authenticated, service_role;

-- 4) دالة حذف مستخدم وحسابه بأمان من النظام
CREATE OR REPLACE FUNCTION public.delete_staff_account_secure(
  p_staff_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := public.get_auth_role();
  v_account public.staff_accounts%ROWTYPE;
  v_admin_count INTEGER;
BEGIN
  IF COALESCE(v_role, '') <> 'admin' AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'غير مصرح لك بحذف حسابات الموظفين؛ هذه الصلاحية لمدير النظام فقط';
  END IF;

  SELECT * INTO v_account FROM public.staff_accounts WHERE id = p_staff_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'حساب الموظف غير موجود';
  END IF;

  IF v_account.role = 'admin' THEN
    SELECT count(*) INTO v_admin_count FROM public.staff_accounts WHERE role = 'admin';
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'لا يمكن حذف آخر حساب مدير متبقٍ في المنظومة لضمان استمرارية الإدارة';
    END IF;
  END IF;

  DELETE FROM public.staff_accounts WHERE id = p_staff_id;

  IF v_account.auth_user_id IS NOT NULL THEN
    BEGIN
      DELETE FROM auth.users WHERE id = v_account.auth_user_id;
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object('success', true, 'deleted_id', p_staff_id);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_staff_account_secure(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_staff_account_secure(TEXT) TO authenticated, service_role;

-- ==============================================================================
-- البيانات الأولية (Seed Data)
-- ==============================================================================

-- إدراج العيادات
INSERT INTO public.clinics (id, name, specialty, room_number, floor, price, is_open_today, icon_name, department, description)
VALUES 
  ('clinic-internal', 'عيادة الباطنة العامة والسكري', 'باطنة عامة وسكري', '101', 'الأول', 50, true, 'HeartPulse', 'قسم الباطنة', 'كشف ومتابعة أمراض الضغط، السكر، والجهاز الهضمي بأحدث الأجهزة'),
  ('clinic-pediatrics', 'عيادة طب وجراحة الأطفال', 'طب الأطفال وحديثي الولادة', '102', 'الأول', 45, true, 'Baby', 'قسم الأطفال', 'رعاية المواليد، متابعة النمو، والتطعيمات الإرشادية للأطفال'),
  ('clinic-orthopedics', 'عيادة جراحة العظام والمفاصل', 'جراحة العظام والمفاصل', '201', 'الثاني', 60, true, 'Bone', 'قسم الجراحة', 'تشخيص وعلاج آلام المفاصل، العمود الفقري، والكسور والإصابات'),
  ('clinic-dental', 'عيادة طب وجراحة الفم والأسنان', 'طب الأسنان', '202', 'الثاني', 55, true, 'Smile', 'قسم الأسنان', 'تنظيف، حشو، وعلاج جذور الأسنان بأعلى معايير التعقيم الطبي')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  is_open_today = EXCLUDED.is_open_today;

-- إدراج الأطباء
INSERT INTO public.doctors (id, name, specialty, title, clinic_id, clinic_name, is_present_today, status, schedule_days, schedule_hours, max_daily_patients, current_queue_number)
VALUES
  ('doc-1', 'د. علي عبد الرحمن السقا', 'باطنة عامة وسكري', 'استشاري أمراض الباطنة والسكري', 'clinic-internal', 'عيادة الباطنة العامة والسكري', true, 'available', ARRAY['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'], '9:00 ص - 3:00 م', 30, 0),
  ('doc-2', 'د. فاطمة الزهراء كمال', 'طب الأطفال وحديثي الولادة', 'أخصائية طب الأطفال وحديثي الولادة', 'clinic-pediatrics', 'عيادة طب وجراحة الأطفال', true, 'available', ARRAY['السبت', 'الأحد', 'الثلاثاء', 'الخميس'], '10:00 ص - 2:00 م', 25, 0),
  ('doc-3', 'د. حسام الدين عبد الله', 'جراحة العظام والمفاصل', 'استشاري جراحة العظام وإصابات الملاعب', 'clinic-orthopedics', 'عيادة جراحة العظام والمفاصل', true, 'available', ARRAY['الأحد', 'الثلاثاء', 'الأربعاء'], '12:00 م - 6:00 م', 20, 0),
  ('doc-4', 'د. منى الشاذلي', 'طب وجراحة الفم والأسنان', 'أخصائية تجميل وجراحة الأسنان', 'clinic-dental', 'عيادة طب وجراحة الفم والأسنان', true, 'available', ARRAY['السبت', 'الاثنين', 'الأربعاء'], '9:00 ص - 3:00 م', 20, 0)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_present_today = EXCLUDED.is_present_today,
  status = EXCLUDED.status;

-- إدراج جدول التشغيل اليومي الافتراضي
INSERT INTO public.daily_schedule (date, clinic_id, doctor_id, is_open)
VALUES 
  (public.get_cairo_today(), 'clinic-internal', 'doc-1', true),
  (public.get_cairo_today(), 'clinic-pediatrics', 'doc-2', true),
  (public.get_cairo_today(), 'clinic-orthopedics', 'doc-3', true),
  (public.get_cairo_today(), 'clinic-dental', 'doc-4', true)
ON CONFLICT (date, clinic_id) DO UPDATE SET
  is_open = EXCLUDED.is_open,
  doctor_id = EXCLUDED.doctor_id;

-- إدراج حسابات الكادر السبعة (مدير، استقبال، خزينة، و4 أطباء للعيادات التخصصية)
INSERT INTO public.staff_accounts (id, username, display_name, role, doctor_id, clinic_id, recovery_email)
VALUES
  ('staff-admin', 'admin', 'د. أحمد الشناوي (مدير المنظومة)', 'admin', NULL, NULL, 'admin@sharia-clinics.eg'),
  ('staff-reception', 'reception', 'أ. سارة مصطفى (مسؤولة الاستقبال)', 'reception', NULL, NULL, 'reception@sharia-clinics.eg'),
  ('staff-cashier', 'cashier', 'أ. محمود إبراهيم (أمين الصندوق والخزينة)', 'cashier', NULL, NULL, 'cashier@sharia-clinics.eg'),
  ('staff-doctor', 'doctor', 'د. علي عبد الرحمن السقا (طبيب باطنة)', 'doctor', 'doc-1', 'clinic-internal', 'doctor.internal@sharia-clinics.eg'),
  ('staff-doctor-pediatrics', 'doctor.pediatrics', 'د. فاطمة الزهراء كمال (طبيبة أطفال)', 'doctor', 'doc-2', 'clinic-pediatrics', 'doctor.pediatrics@sharia-clinics.eg'),
  ('staff-doctor-ortho', 'doctor.ortho', 'د. حسام الدين عبد الله (طبيب عظام)', 'doctor', 'doc-3', 'clinic-orthopedics', 'doctor.ortho@sharia-clinics.eg'),
  ('staff-doctor-dental', 'doctor.dental', 'د. منى الشاذلي (طبيبة أسنان)', 'doctor', 'doc-4', 'clinic-dental', 'doctor.dental@sharia-clinics.eg')
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  recovery_email = EXCLUDED.recovery_email;

-- إدراج سجلات النظام المخصصة للإعدادات وكلمات المرور المشفرة
INSERT INTO public.clinics (id, name, specialty, room_number, floor, price, is_open_today, description)
VALUES 
  ('_system_support_info', 'System Support Info', 'System', '0', 'الأول', 0, false, 'فريق الاستقبال في خدمتكم يومياً من 9:00 صباحاً حتى 10:00 مساءً للرد على كافة التساؤلات.\nللتواصل: 01014615606'),
  ('_system_staff_passwords', 'System Staff Passwords', 'System', '0', 'الأول', 0, false, '{"admin":"2e0ebbe2df13e248a1c1e9c1446a5d1a605484a416d66f4cc7802391d9a2b558","reception":"8d6a7d4173428e7073a5ad9b5209bc293336ed9ed5e08a25e0f82e6df653d804","cashier":"3a09f66bc67a9e66140e16d6e2279dd38dec038f51b01dcb2038a196fbef4ac6","doctor":"733d171967711964a0ea8dc5bbafa70e278008dbb225aaa23316f208e1e9f8c6","doctor.pediatrics":"733d171967711964a0ea8dc5bbafa70e278008dbb225aaa23316f208e1e9f8c6","doctor.ortho":"733d171967711964a0ea8dc5bbafa70e278008dbb225aaa23316f208e1e9f8c6","doctor.dental":"733d171967711964a0ea8dc5bbafa70e278008dbb225aaa23316f208e1e9f8c6"}')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- إنشاء مستخدمي Supabase Auth السبعة بكلمات المرور الرسمية وربطهم بـ staff_accounts
-- ==============================================================================
DO $$
DECLARE
  v_admin_id UUID    := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_rec_id UUID      := 'a0000000-0000-0000-0000-000000000002'::uuid;
  v_cash_id UUID     := 'a0000000-0000-0000-0000-000000000003'::uuid;
  v_doc_id UUID      := 'a0000000-0000-0000-0000-000000000004'::uuid;
  v_doc_ped_id UUID  := 'a0000000-0000-0000-0000-000000000005'::uuid;
  v_doc_orth_id UUID := 'a0000000-0000-0000-0000-000000000006'::uuid;
  v_doc_dent_id UUID := 'a0000000-0000-0000-0000-000000000007'::uuid;
BEGIN
  -- Admin: Adm@Sharia2026!
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at)
  VALUES (
    v_admin_id,
    '00000000-0000-0000-0000-000000000000',
    'admin@accounts.sharaya-clinics.internal',
    crypt('Adm@Sharia2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"admin","username":"admin","display_name":"د. أحمد الشناوي"}',
    'authenticated',
    'authenticated',
    now(),
    now()
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt('Adm@Sharia2026!', gen_salt('bf')),
    email_confirmed_at = now();

  -- Reception: Rcp@Sharia2026!
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at)
  VALUES (
    v_rec_id,
    '00000000-0000-0000-0000-000000000000',
    'reception@accounts.sharaya-clinics.internal',
    crypt('Rcp@Sharia2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"reception","username":"reception","display_name":"أ. سارة مصطفى"}',
    'authenticated',
    'authenticated',
    now(),
    now()
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt('Rcp@Sharia2026!', gen_salt('bf')),
    email_confirmed_at = now();

  -- Cashier: Csh@Sharia2026!
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at)
  VALUES (
    v_cash_id,
    '00000000-0000-0000-0000-000000000000',
    'cashier@accounts.sharaya-clinics.internal',
    crypt('Csh@Sharia2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"cashier","username":"cashier","display_name":"أ. محمود إبراهيم"}',
    'authenticated',
    'authenticated',
    now(),
    now()
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt('Csh@Sharia2026!', gen_salt('bf')),
    email_confirmed_at = now();

  -- Doctor (Internal): Doc@Sharia2026!
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at)
  VALUES (
    v_doc_id,
    '00000000-0000-0000-0000-000000000000',
    'doctor@accounts.sharaya-clinics.internal',
    crypt('Doc@Sharia2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"doctor","username":"doctor","display_name":"د. علي عبد الرحمن السقا"}',
    'authenticated',
    'authenticated',
    now(),
    now()
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt('Doc@Sharia2026!', gen_salt('bf')),
    email_confirmed_at = now();

  -- Doctor (Pediatrics): Doc@Sharia2026!
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at)
  VALUES (
    v_doc_ped_id,
    '00000000-0000-0000-0000-000000000000',
    'doctor.pediatrics@accounts.sharaya-clinics.internal',
    crypt('Doc@Sharia2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"doctor","username":"doctor.pediatrics","display_name":"د. فاطمة الزهراء كمال"}',
    'authenticated',
    'authenticated',
    now(),
    now()
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt('Doc@Sharia2026!', gen_salt('bf')),
    email_confirmed_at = now();

  -- Doctor (Orthopedics): Doc@Sharia2026!
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at)
  VALUES (
    v_doc_orth_id,
    '00000000-0000-0000-0000-000000000000',
    'doctor.ortho@accounts.sharaya-clinics.internal',
    crypt('Doc@Sharia2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"doctor","username":"doctor.ortho","display_name":"د. حسام الدين عبد الله"}',
    'authenticated',
    'authenticated',
    now(),
    now()
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt('Doc@Sharia2026!', gen_salt('bf')),
    email_confirmed_at = now();

  -- Doctor (Dental): Doc@Sharia2026!
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at)
  VALUES (
    v_doc_dent_id,
    '00000000-0000-0000-0000-000000000000',
    'doctor.dental@accounts.sharaya-clinics.internal',
    crypt('Doc@Sharia2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"doctor","username":"doctor.dental","display_name":"د. منى الشاذلي"}',
    'authenticated',
    'authenticated',
    now(),
    now()
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt('Doc@Sharia2026!', gen_salt('bf')),
    email_confirmed_at = now();

  -- ربط مع staff_accounts
  UPDATE public.staff_accounts SET auth_user_id = v_admin_id WHERE username = 'admin';
  UPDATE public.staff_accounts SET auth_user_id = v_rec_id WHERE username = 'reception';
  UPDATE public.staff_accounts SET auth_user_id = v_cash_id WHERE username = 'cashier';
  UPDATE public.staff_accounts SET auth_user_id = v_doc_id WHERE username = 'doctor';
  UPDATE public.staff_accounts SET auth_user_id = v_doc_ped_id WHERE username = 'doctor.pediatrics';
  UPDATE public.staff_accounts SET auth_user_id = v_doc_orth_id WHERE username = 'doctor.ortho';
  UPDATE public.staff_accounts SET auth_user_id = v_doc_dent_id WHERE username = 'doctor.dental';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ملاحظة: إذا لم تكن صلاحيات الوصول لجدول auth.users متاحة للمستخدم الحالي، يمكن إنشاء المستخدمين مباشرة عبر لوحة تحكم Supabase Auth';
END $$;

-- ----------------------------------------------------------------------------
-- تهيئة سجل مواعيد العمل الرسمية في جدول العيادات وسياسة التحديث المفوض
-- ----------------------------------------------------------------------------
INSERT INTO public.clinics (id, name, icon_name, specialty, department, description, price, room_number, floor, active, is_open_today, max_daily_capacity)
VALUES (
  '_system_working_hours',
  '_system_working_hours',
  'Clock',
  'system',
  'system',
  'يومياً من 9:00 ص حتى 10:00 م',
  0,
  '-',
  '-',
  FALSE,
  FALSE,
  0
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clinics (id, name, icon_name, specialty, department, description, price, room_number, floor, active, is_open_today, max_daily_capacity)
VALUES (
  '_system_error_logs',
  'System Error Logs',
  'AlertTriangle',
  'System',
  'system',
  '[]',
  0,
  '0',
  '-',
  FALSE,
  FALSE,
  0
) ON CONFLICT (id) DO NOTHING;

-- دالة آمنة لتسجيل أخطاء الواجهة (ErrorBoundary & vite:preloadError) من أي جهاز متصل (مريض أو موظف أو شاشة عرض)
CREATE OR REPLACE FUNCTION public.report_client_error(p_error JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_desc TEXT;
  v_logs JSONB := '[]'::JSONB;
  v_new_id TEXT;
BEGIN
  IF p_error IS NULL OR jsonb_typeof(p_error) <> 'object' THEN
    RETURN FALSE;
  END IF;

  v_new_id := COALESCE(p_error->>'id', 'err_' || extract(epoch from now())::bigint::text);

  SELECT description INTO v_existing_desc
  FROM public.clinics
  WHERE id = '_system_error_logs'
  FOR UPDATE;

  IF v_existing_desc IS NOT NULL AND v_existing_desc <> '' THEN
    BEGIN
      v_logs := v_existing_desc::JSONB;
      IF jsonb_typeof(v_logs) <> 'array' THEN
        v_logs := '[]'::JSONB;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_logs := '[]'::JSONB;
    END;
  END IF;

  -- إزالة أي تكرار لنفس المعرف وإضافة الخطأ الجديد في المقدمة مع الاحتفاظ بآخر 100 سجل
  SELECT COALESCE(jsonb_agg(elem), '[]'::JSONB)
  INTO v_logs
  FROM (
    SELECT p_error AS elem
    UNION ALL
    SELECT item AS elem
    FROM jsonb_array_elements(v_logs) AS item
    WHERE item->>'id' IS DISTINCT FROM v_new_id
    LIMIT 99
  ) sub;

  INSERT INTO public.clinics (
    id, name, icon_name, specialty, department, description, price, room_number, floor, active, is_open_today, max_daily_capacity
  ) VALUES (
    '_system_error_logs', 'System Error Logs', 'AlertTriangle', 'System', 'system', v_logs::TEXT, 0, '0', '-', FALSE, FALSE, 0
  )
  ON CONFLICT (id) DO UPDATE SET
    description = EXCLUDED.description,
    updated_at = NOW();

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_client_error(JSONB) TO anon, authenticated;

DROP POLICY IF EXISTS "clinics_staff_delegated_update" ON public.clinics;
CREATE POLICY "clinics_staff_delegated_update"
  ON public.clinics
  FOR UPDATE
  TO authenticated
  USING (
    public.get_auth_role() IN ('reception', 'cashier')
    AND id NOT IN ('_system_permissions', '_system_support_info', '_system_working_hours', '_system_passwords', '_system_error_logs')
  )
  WITH CHECK (
    public.get_auth_role() IN ('reception', 'cashier')
    AND id NOT IN ('_system_permissions', '_system_support_info', '_system_working_hours', '_system_passwords', '_system_error_logs')
  );

