import { createClient, SupabaseClient } from '@supabase/supabase-js';

const envProcess = typeof process !== 'undefined' ? process.env : undefined;

const rawUrl = (
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  envProcess?.VITE_SUPABASE_URL ||
  'https://rugwzfaiensjdxtoipop.supabase.co'
).trim();

const rawKey = (
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  envProcess?.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_-Xp2D-cOLleLXIrr_vR9qg_kCLhSuC2'
).trim();

// التحقق من أن الرابط ليس الرابط المحذوف القديم أو مجرد قالب وهمي
const isDefunctOrPlaceholder = 
  !rawUrl || 
  rawUrl.includes('placeholder') || 
  rawUrl.includes('olfpqxtmywhfhglofebc') || 
  !rawKey || 
  rawKey.includes('placeholder') ||
  rawKey.length < 20;

export const isSupabaseConfigured = Boolean(
  !isDefunctOrPlaceholder && 
  rawUrl.startsWith('https://')
);

// منع انهيار التطبيق في حال لم يتم إدخال المتغيرات بعد
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(rawUrl, rawKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : createClient('https://placeholder-project.supabase.co', 'placeholder-anon-key');
