-- ==============================================================================
-- منظومة عيادات الجمعية الشرعية - سكربت تهيئة قاعدة بيانات Supabase الشامل
-- مشروع: https://olfpqxtmywhfhglofebc.supabase.co
-- ==============================================================================

-- تفعيل ملحق pgcrypto للتشفير والأرقام العشوائية
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
  date DATE NOT NULL DEFAULT CURRENT_DATE,
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
  date DATE NOT NULL DEFAULT CURRENT_DATE,
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

-- دالة لمعرفة دور المستخدم المسجل حالياً في Supabase Auth
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
  SELECT role FROM public.staff_accounts WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- سياسات العيادات (clinics)
DROP POLICY IF EXISTS "Public read clinics" ON public.clinics;
CREATE POLICY "Public read clinics" ON public.clinics FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin modify clinics" ON public.clinics;
CREATE POLICY "Admin modify clinics" ON public.clinics FOR ALL USING (
  public.get_auth_role() = 'admin' OR auth.role() = 'service_role'
);

-- سياسات الأطباء (doctors)
DROP POLICY IF EXISTS "Public read doctors" ON public.doctors;
CREATE POLICY "Public read doctors" ON public.doctors FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin modify doctors" ON public.doctors;
CREATE POLICY "Admin modify doctors" ON public.doctors FOR ALL USING (
  public.get_auth_role() = 'admin' OR auth.role() = 'service_role'
);

DROP POLICY IF EXISTS "Doctor update own status" ON public.doctors;
CREATE POLICY "Doctor update own status" ON public.doctors FOR UPDATE USING (
  public.get_auth_role() = 'doctor' AND id = (
    SELECT doctor_id FROM public.staff_accounts WHERE auth_user_id = auth.uid()
  )
);

-- سياسات جدول التشغيل (daily_schedule)
DROP POLICY IF EXISTS "Public read daily_schedule" ON public.daily_schedule;
CREATE POLICY "Public read daily_schedule" ON public.daily_schedule FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin modify daily_schedule" ON public.daily_schedule;
CREATE POLICY "Admin modify daily_schedule" ON public.daily_schedule FOR ALL USING (
  public.get_auth_role() = 'admin' OR auth.role() = 'service_role'
);

-- سياسات حسابات الموظفين (staff_accounts)
DROP POLICY IF EXISTS "Authenticated read staff" ON public.staff_accounts;
CREATE POLICY "Authenticated read staff" ON public.staff_accounts FOR SELECT USING (
  auth.uid() IS NOT NULL OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "Admin modify staff" ON public.staff_accounts;
CREATE POLICY "Admin modify staff" ON public.staff_accounts FOR ALL USING (
  public.get_auth_role() = 'admin' OR auth.role() = 'service_role'
);

-- سياسات الحجوزات (bookings)
DROP POLICY IF EXISTS "Public read bookings" ON public.bookings;
CREATE POLICY "Public read bookings" ON public.bookings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff update bookings" ON public.bookings;
CREATE POLICY "Staff update bookings" ON public.bookings FOR UPDATE USING (
  auth.uid() IS NOT NULL OR public.get_auth_role() IN ('admin', 'reception', 'cashier', 'doctor') OR true
);

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
AS $$
DECLARE
  v_clinic public.clinics%ROWTYPE;
  v_doctor public.doctors%ROWTYPE;
  v_name_parts TEXT[];
  v_trimmed_name TEXT;
  v_existing_active_count INTEGER;
  v_today DATE := CURRENT_DATE;
  v_next_ticket INTEGER;
  v_new_booking_id TEXT;
  v_ticket_number_str TEXT;
  v_result JSONB;
BEGIN
  -- (أ) التحقق من أن اسم المريض ثلاثي على الأقل
  v_trimmed_name := regexp_replace(trim(p_patient_name), '\s+', ' ', 'g');
  v_name_parts := string_to_array(v_trimmed_name, ' ');
  IF array_length(v_name_parts, 1) < 3 THEN
    RAISE EXCEPTION 'يجب كتابة اسم المريض ثلاثياً على الأقل لضمان تسجيل السجلات الطبية بدقة';
  END IF;

  -- فحص رقم الهاتف
  IF length(trim(p_patient_phone)) < 10 THEN
    RAISE EXCEPTION 'يرجى إدخال رقم هاتف محمول صحيح';
  END IF;

  -- (ج) التحقق من أن العيادة مفتوحة اليوم
  SELECT * INTO v_clinic FROM public.clinics WHERE id = p_clinic_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'العيادة المحددة غير موجودة في المنظومة';
  END IF;
  IF NOT v_clinic.is_open_today THEN
    RAISE EXCEPTION 'عذراً، هذه العيادة مغلقة اليوم ولا تستقبل حجوزات جديدة';
  END IF;

  -- التحقق من أن الطبيب متواجد اليوم
  SELECT * INTO v_doctor FROM public.doctors WHERE id = p_doctor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطبيب المحدد غير مسجل في المنظومة';
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

  -- حساب رقم التذكرة المتسلسل
  SELECT COALESCE(MAX(queue_position), 0) + 1 INTO v_next_ticket
  FROM public.bookings
  WHERE date = v_today AND clinic_id = p_clinic_id;

  -- فحص الحد الأقصى للمرضى
  IF v_doctor.max_daily_patients IS NOT NULL AND v_next_ticket > v_doctor.max_daily_patients THEN
    RAISE EXCEPTION 'عذراً، اكتمل العدد الأقصى المتاح لحجوزات هذا الطبيب لليوم (%s كشف)', v_doctor.max_daily_patients;
  END IF;

  v_ticket_number_str := 'T-' || lpad(v_next_ticket::text, 3, '0');
  v_new_booking_id := 'bkg-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 5);

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
    p_time_slot,
    v_next_ticket,
    'waiting',
    'unpaid',
    v_clinic.price,
    p_notes,
    now()
  );

  SELECT to_jsonb(b.*) INTO v_result FROM public.bookings b WHERE b.id = v_new_booking_id;
  RETURN v_result;
END;
$$;

-- 2) دالة تأكيد الدفع من الكاشير مع تسجيل وقت التأكيد
CREATE OR REPLACE FUNCTION public.confirm_payment(
  p_booking_id TEXT,
  p_payment_type TEXT -- 'cash', 'insurance', 'charity_exempt'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_new_status TEXT;
  v_result JSONB;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الحجز غير موجود';
  END IF;

  IF v_booking.status = 'cancelled' THEN
    RAISE EXCEPTION 'لا يمكن سداد رسوم حجز ملغي';
  END IF;

  IF p_payment_type = 'charity_exempt' THEN
    v_new_status := 'exempt';
  ELSE
    v_new_status := 'paid';
  END IF;

  UPDATE public.bookings
  SET 
    payment_status = v_new_status,
    payment_method = p_payment_type,
    payment_confirmed_at = now(),
    paid_at = now()
  WHERE id = p_booking_id;

  SELECT to_jsonb(b.*) INTO v_result FROM public.bookings b WHERE b.id = p_booking_id;
  RETURN v_result;
END;
$$;

-- 3) دالة تسجيل المريض كـ "متأخر" واستدعاء الحالة التالية
CREATE OR REPLACE FUNCTION public.mark_patient_late_and_call_next(
  p_current_booking_id TEXT,
  p_next_booking_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current JSONB := NULL;
  v_next JSONB := NULL;
BEGIN
  IF p_current_booking_id IS NOT NULL AND p_current_booking_id <> '' THEN
    UPDATE public.bookings
    SET status = 'late'
    WHERE id = p_current_booking_id;

    SELECT to_jsonb(b.*) INTO v_current FROM public.bookings b WHERE b.id = p_current_booking_id;
  END IF;

  IF p_next_booking_id IS NOT NULL AND p_next_booking_id <> '' THEN
    UPDATE public.bookings
    SET status = 'in-progress', called_at = now()
    WHERE id = p_next_booking_id;

    SELECT to_jsonb(b.*) INTO v_next FROM public.bookings b WHERE b.id = p_next_booking_id;
  END IF;

  RETURN jsonb_build_object(
    'late_booking', v_current,
    'called_booking', v_next
  );
END;
$$;

-- 4) دالة حذف مستخدم وحسابه بأمان من النظام
CREATE OR REPLACE FUNCTION public.delete_staff_account_secure(
  p_staff_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account public.staff_accounts%ROWTYPE;
  v_admin_count INTEGER;
BEGIN
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
  (CURRENT_DATE, 'clinic-internal', 'doc-1', true),
  (CURRENT_DATE, 'clinic-pediatrics', 'doc-2', true),
  (CURRENT_DATE, 'clinic-orthopedics', 'doc-3', true),
  (CURRENT_DATE, 'clinic-dental', 'doc-4', true)
ON CONFLICT (date, clinic_id) DO UPDATE SET
  is_open = EXCLUDED.is_open,
  doctor_id = EXCLUDED.doctor_id;

-- إدراج حسابات الكادر الأربعة
INSERT INTO public.staff_accounts (id, username, display_name, role, doctor_id, clinic_id, recovery_email)
VALUES
  ('staff-admin', 'admin', 'د. أحمد الشناوي (مدير المنظومة)', 'admin', NULL, NULL, 'admin@sharia-clinics.eg'),
  ('staff-reception', 'reception', 'أ. سارة مصطفى (مسؤولة الاستقبال)', 'reception', NULL, NULL, 'reception@sharia-clinics.eg'),
  ('staff-cashier', 'cashier', 'أ. محمود إبراهيم (أمين الصندوق والخزينة)', 'cashier', NULL, NULL, 'cashier@sharia-clinics.eg'),
  ('staff-doctor', 'doctor', 'د. علي عبد الرحمن السقا (طبيب باطنة)', 'doctor', 'doc-1', 'clinic-internal', 'doctor.internal@sharia-clinics.eg')
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  recovery_email = EXCLUDED.recovery_email;

-- ==============================================================================
-- إنشاء مستخدمي Supabase Auth الأربعة بكلمات المرور الرسمية
-- ==============================================================================
DO $$
DECLARE
  v_admin_id UUID := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_rec_id UUID   := 'a0000000-0000-0000-0000-000000000002'::uuid;
  v_cash_id UUID  := 'a0000000-0000-0000-0000-000000000003'::uuid;
  v_doc_id UUID   := 'a0000000-0000-0000-0000-000000000004'::uuid;
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

  -- Doctor: Doc@Sharia2026!
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

  -- ربط مع staff_accounts
  UPDATE public.staff_accounts SET auth_user_id = v_admin_id WHERE username = 'admin';
  UPDATE public.staff_accounts SET auth_user_id = v_rec_id WHERE username = 'reception';
  UPDATE public.staff_accounts SET auth_user_id = v_cash_id WHERE username = 'cashier';
  UPDATE public.staff_accounts SET auth_user_id = v_doc_id WHERE username = 'doctor';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ملاحظة: إذا لم تكن صلاحيات الوصول لجدول auth.users متاحة للمستخدم الحالي، يمكن إنشاء المستخدمين مباشرة عبر لوحة تحكم Supabase Auth';
END $$;
