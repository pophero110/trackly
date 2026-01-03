import { Request, Response, NextFunction } from 'express';

/**
 * CORS middleware for development and production
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:8080',
  ];

  const origin = req.headers.origin;
  const isDevelopment = process.env.NODE_ENV !== 'production';

  // Allow local network origins in development (e.g., accessing from phone on same network)
  const isLocalNetworkOrigin = origin && (
    origin.startsWith('http://192.168.') ||
    origin.startsWith('http://10.') ||
    origin.startsWith('http://172.') ||
    allowedOrigins.includes(origin)
  );

  if (origin && (isDevelopment && isLocalNetworkOrigin || allowedOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
}
