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

const supabaseSmartFetch: typeof fetch = async (input, init) => {
  return fetch(input, init);
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
    fetch: supabaseSmartFetch,
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// تغليف آمن لقنوات Realtime في المتصفح لمنع تسريب أي مفتاح في روابط WebSocket أو ظهور أخطاء بالكونسول
if (typeof window !== 'undefined') {
  const createSafeChannel = (channelName: string) => {
    const bc = getOrCreateBroadcastChannel(channelName);
    const listeners: Array<{ event: string; callback: (payload: any) => void }> = [];

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
      on: (_type: string, filter: { event?: string }, callback: (payload: any) => void) => {
        listeners.push({ event: filter?.event || '*', callback });
        return safeChannelObj;
      },
      subscribe: (callback?: (status: string, err?: any) => void) => {
        if (typeof callback === 'function') {
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
        return 'ok';
      },
      unsubscribe: async () => 'ok',
    };

    return safeChannelObj;
  };

  (baseClient as any).channel = (name: string) => createSafeChannel(name);
  (baseClient as any).removeChannel = async () => 'ok';
}

export const supabase: SupabaseClient = baseClient;

