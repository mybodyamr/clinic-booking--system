import { createClient, SupabaseClient } from '@supabase/supabase-js';

const envProcess = typeof process !== 'undefined' ? process.env : undefined;

const getCandidateUrl = (): string => {
  const metaUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || '';
  const procUrl = envProcess?.VITE_SUPABASE_URL || '';
  for (const candidate of [metaUrl, procUrl]) {
    if (
      candidate && 
      !candidate.includes('placeholder') && 
      !candidate.includes('olfpqxtmywhfhglofebc') &&
      candidate.startsWith('https://')
    ) {
      return candidate.trim();
    }
  }
  return 'https://rugwzfaiensjdxtoipop.supabase.co';
};

const getCandidateKey = (): string => {
  const metaKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || '';
  const procKey = envProcess?.VITE_SUPABASE_ANON_KEY || '';
  for (const candidate of [metaKey, procKey]) {
    if (
      candidate && 
      !candidate.includes('placeholder') && 
      candidate.length > 20 &&
      !candidate.includes('0YGqEJcwas7CqewI4iL_sA_9E9CPQps')
    ) {
      return candidate.trim();
    }
  }
  return 'sb_publishable_-Xp2D-cOLleLXIrr_vR9qg_kCLhSuC2';
};

const rawUrl = getCandidateUrl();
const rawKey = getCandidateKey();

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
