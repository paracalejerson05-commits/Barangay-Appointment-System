import type { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  try {
    const { appPromise } = await import('../server');
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error(
      '[Vercel API] Failed to initialize the server:',
      error instanceof Error ? error.message : 'Unknown initialization error'
    );
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({
      error: 'The API server could not initialize. Check Vercel Function Logs and required server environment variables.'
    }));
  }
}
