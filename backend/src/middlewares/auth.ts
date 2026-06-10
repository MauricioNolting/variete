import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: 'admin' | 'client';
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const prisma = new PrismaClient();

// Throttle lastSeenAt writes: only update if last write was more than this ago
const PRESENCE_THROTTLE_MS = 60 * 1000; // 1 min
const lastSeenCache = new Map<number, number>();

function touchPresence(clientId: number) {
  const now = Date.now();
  const last = lastSeenCache.get(clientId) || 0;
  if (now - last < PRESENCE_THROTTLE_MS) return; // skip frequent writes
  lastSeenCache.set(clientId, now);
  // Fire-and-forget — never block the request
  prisma.client.update({
    where: { id: clientId },
    data: { lastSeenAt: new Date() },
  }).catch(() => {});
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'Acceso no autorizado. Se requiere autenticación.' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number; role: 'admin' | 'client' };
    req.userId = payload.id;
    req.userRole = payload.role;
    if (payload.role === 'client') touchPresence(payload.id);
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada. Por favor inicie sesión nuevamente.' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: 'Acceso restringido. Se requieren privilegios de administrador.' });
    return;
  }
  next();
}

export function requireClient(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'client') {
    res.status(403).json({ error: 'Acceso restringido a clientes.' });
    return;
  }
  next();
}
