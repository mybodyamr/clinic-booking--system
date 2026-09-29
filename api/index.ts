import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../server.js';

let cachedApp: ReturnType<typeof createApiApp> | null = null;

function getApp() {
  if (!cachedApp) {
    cachedApp = createApiApp();
  }
  return cachedApp;
}

export default function handler(
  req: IncomingMessage & { url?: string; originalUrl?: string },
  res: ServerResponse
) {
  try {
    const rawUrl = req.url || '/';
    const parsedUrl = new URL(rawUrl, 'http://localhost');
    const vpath = parsedUrl.searchParams.get('__vpath');

    if (vpath !== null) {
      parsedUrl.searchParams.delete('__vpath');
      const cleanVpath = vpath.replace(/^\/+/, '');
      const searchStr = parsedUrl.searchParams.toString();
      req.url = `/api/${cleanVpath}${searchStr ? `?${searchStr}` : ''}`;
    } else if (!rawUrl.startsWith('/api')) {
      req.url = `/api${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
    }

    const app = getApp();
    return app(req as any, res as any);
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        ok: false,
        error: 'حدث خطأ داخلي في الخادم',
        message: err?.message || 'Internal server error',
      })
    );
  }
}
