import { createClient, SupabaseClient } from '@supabase/supabase-js';

const BRIDGE_PROXY_KEY_MARKER = 'sharaya-internal-bridge-client';

const getBridgeBaseUrl = (): string => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/supabase-bridge`;
  }
  return 'http://127.0.0.1:3000/api/supabase-bridge';
};

const rawUrl = getBridgeBaseUrl();
const rawKey = BRIDGE_PROXY_KEY_MARKER;

export const isSupabaseConfigured = true;

const CLOUD_REALTIME_URL =
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_SUPABASE_PROJECT_URL || import.meta.env?.VITE_SUPABASE_URL)) ||
  'https://rugwzfaiensjdxtoipop.supabase.co';

const CLOUD_REALTIME_PUB_KEY =
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_SUPABASE_PUBLIC_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY)) ||
  'sb_publishable_-Xp2D-cOLleLXIrr_vR9qg_kCLhSuC2';

// جميع الاستعلامات تمر عبر جسر الخادم (/api/supabase-bridge) مع منع الكاش نهائياً، مع مسار احتياطي مباشر للسحابة عند إعادة تشغيل الخادم
const supabaseBridgeFetch: typeof fetch = async (input, init) => {
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const isRead = method === 'GET' || method === 'HEAD';

  const rawUrlStr =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;

  let finalInput: RequestInfo | URL = input;
  if (isRead) {
    try {
      const u = new URL(rawUrlStr, typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:3000');
      u.searchParams.set('_cb', `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
      finalInput = u.toString();
    } catch {
      finalInput = input;
    }
  }

  try {
    return await fetch(finalInput, {
      ...init,
      cache: 'no-store',
    });
  } catch (err) {
    // في حال إعادة تشغيل خادم الواجهة الخلفية لحظياً، نرسل الطلب مباشرة إلى Supabase السحابي لضمان عدم انقطاع الاتصال
    const targetStr = typeof finalInput === 'string' ? finalInput : rawUrlStr;
    const bridgeIdx = targetStr.indexOf('/api/supabase-bridge');
    if (bridgeIdx !== -1) {
      const subPath = targetStr.slice(bridgeIdx + '/api/supabase-bridge'.length);
      const directUrl = `${CLOUD_REALTIME_URL.replace(/\/+$/, '')}${subPath}`;
      const directHeaders = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      directHeaders.set('apikey', CLOUD_REALTIME_PUB_KEY);
      const authHeader = directHeaders.get('Authorization') || directHeaders.get('authorization');
      if (!authHeader || authHeader.includes(BRIDGE_PROXY_KEY_MARKER)) {
        directHeaders.set('Authorization', `Bearer ${CLOUD_REALTIME_PUB_KEY}`);
      }
      return await fetch(directUrl, {
        ...init,
        headers: directHeaders,
        cache: 'no-store',
      });
    }
    throw err;
  }
};

// قناة تزامن محلية آمنة بين التبويبات بدون كشف أي مفاتيح في عناوين WebSocket
const localBroadcastChannels = new Map<string, BroadcastChannel>();

const getOrCreateBroadcastChannel = (name: string): BroadcastChannel | null => {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  let bc = localBroadcastChannels.get(name);
  if (!bc) {
    try {
      bc = new BroadcastChannel(`sharaya_sync_${name}`);
      localBroadcastChannels.set(name, bc);
    } catch {
      return null;
    }
  }
  return bc;
};

const baseClient: SupabaseClient = createClient(rawUrl, rawKey, {
  global: {
    fetch: supabaseBridgeFetch,
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

const cloudRealtimeClient: SupabaseClient | null =
  typeof window !== 'undefined'
    ? createClient(CLOUD_REALTIME_URL, CLOUD_REALTIME_PUB_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      })
    : null;

// تغليف مزدوج لقنوات Realtime يجمع بين Supabase Cloud Realtime عبر الأجهزة المختلفة و BroadcastChannel للتبويبات المحلية
if (typeof window !== 'undefined') {
  const createSafeChannel = (channelName: string) => {
    const bc = getOrCreateBroadcastChannel(channelName);
    const listeners: Array<{ type: string; event: string; callback: (payload: any) => void }> = [];
    const cloudCh = cloudRealtimeClient
      ? cloudRealtimeClient.channel(channelName, {
          config: { broadcast: { self: false } },
        })
      : null;

    if (bc) {
      bc.onmessage = (ev) => {
        const data = ev.data;
        if (!data) return;
        for (const l of listeners) {
          if (l.event === '*' || l.event === data.event) {
            try {
              l.callback(data);
            } catch {
              // ignore callback error
            }
          }
        }
      };
    }

    const safeChannelObj: any = {
      on: (type: string, filter: any, callback: (payload: any) => void) => {
        const evtName = filter?.event || '*';
        listeners.push({ type, event: evtName, callback });
        if (cloudCh) {
          try {
            (cloudCh as any).on(type, filter, (payload: any) => {
              try {
                callback(payload);
              } catch {
                // ignore callback error
              }
            });
          } catch {
            // ignore cloud listener registration error
          }
        }
        return safeChannelObj;
      },
      subscribe: (callback?: (status: string, err?: any) => void) => {
        if (cloudCh) {
          try {
            cloudCh.subscribe((status: string, err?: any) => {
              if (typeof callback === 'function') {
                callback(status, err);
              }
            });
          } catch {
            if (typeof callback === 'function') {
              setTimeout(() => callback('SUBSCRIBED'), 0);
            }
          }
        } else if (typeof callback === 'function') {
          setTimeout(() => callback('SUBSCRIBED'), 0);
        }
        return safeChannelObj;
      },
      send: async (payload: any) => {
        try {
          bc?.postMessage(payload);
        } catch {
          // ignore
        }
        if (cloudCh) {
          try {
            await cloudCh.send(payload);
          } catch {
            // ignore cloud send error
          }
        }
        return 'ok';
      },
      unsubscribe: async () => {
        if (cloudCh) {
          try {
            await cloudCh.unsubscribe();
          } catch {
            // ignore
          }
        }
        return 'ok';
      },
      _cloudCh: cloudCh,
    };

    return safeChannelObj;
  };

  (baseClient as any).channel = (name: string) => createSafeChannel(name);
  (baseClient as any).removeChannel = async (ch: any) => {
    if (ch?._cloudCh && cloudRealtimeClient) {
      try {
        await cloudRealtimeClient.removeChannel(ch._cloudCh);
      } catch {
        // ignore
      }
    }
    return 'ok';
  };
}

export const supabase: SupabaseClient = baseClient;
