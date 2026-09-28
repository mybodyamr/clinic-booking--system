import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../server';

const app = createApiApp();

export default function handler(
  req: IncomingMessage & { url?: string },
  res: ServerResponse
) {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }
  return app(req as any, res as any);
}
