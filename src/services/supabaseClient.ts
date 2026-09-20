import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

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
