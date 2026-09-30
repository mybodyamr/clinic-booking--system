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
    const vpath = parsedUrl.searchParams.get('__vpath') ?? parsedUrl.searchParams.get('__path');

    if (vpath !== null) {
      parsedUrl.searchParams.delete('__vpath');
      parsedUrl.searchParams.delete('__path');
      const cleanVpath = vpath.replace(/^\/+/, '');
      const searchStr = parsedUrl.searchParams.toString();
      const restoredUrl = `/api/${cleanVpath}${searchStr ? `?${searchStr}` : ''}`;
      req.url = restoredUrl;
      req.originalUrl = restoredUrl;
    } else if (!rawUrl.startsWith('/api')) {
      const restoredUrl = `/api${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
      req.url = restoredUrl;
      req.originalUrl = restoredUrl;
    } else {
      req.originalUrl = req.url;
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
