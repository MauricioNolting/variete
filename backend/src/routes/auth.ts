import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Admin login
router.post('/admin/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Se requieren las credenciales de acceso.' });
    return;
  }
  try {
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      res.status(401).json({ error: 'Credenciales incorrectas.' });
      return;
    }
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Credenciales incorrectas.' });
      return;
    }
    const token = jwt.sign({ id: admin.id, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });
    res.json({ message: 'Sesión iniciada exitosamente.', role: 'admin' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Client register
router.post('/client/register', async (req: Request, res: Response) => {
  const { localName, address, cityId, phone, email } = req.body;
  if (!localName || !address || !cityId || !phone) {
    res.status(400).json({ error: 'Todos los campos obligatorios deben ser completados.' });
    return;
  }
  try {
    const existing = await prisma.client.findUnique({ where: { phone } });
    if (existing) {
      res.status(409).json({ error: 'Ya existe un establecimiento registrado con ese número de teléfono.' });
      return;
    }
    const city = await prisma.city.findUnique({ where: { id: Number(cityId) } });
    if (!city || !city.isActive) {
      res.status(400).json({ error: 'La ciudad seleccionada no se encuentra disponible.' });
      return;
    }
    const client = await prisma.client.create({
      data: { localName, address, cityId: Number(cityId), phone, email: email || null },
    });
    const token = jwt.sign({ id: client.id, role: 'client' }, JWT_SECRET, { expiresIn: '365d' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json({
      message: 'Registro completado exitosamente.',
      token,
      client: { id: client.id, localName: client.localName },
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Client login
router.post('/client/login', async (req: Request, res: Response) => {
  const { phone, localName } = req.body;
  if (!phone || !localName) {
    res.status(400).json({ error: 'Se requiere el número de teléfono y el nombre del establecimiento.' });
    return;
  }
  try {
    const client = await prisma.client.findFirst({
      where: {
        phone,
        localName: { equals: localName, mode: 'insensitive' },
      },
      include: { city: true },
    });
    if (!client) {
      res.status(401).json({ error: 'No se encontró ningún establecimiento con los datos proporcionados.' });
      return;
    }
    const token = jwt.sign({ id: client.id, role: 'client' }, JWT_SECRET, { expiresIn: '365d' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });
    res.json({ message: 'Sesión iniciada exitosamente.', token, client });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Get current session
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole === 'admin') {
      res.json({ role: 'admin', id: req.userId });
      return;
    }
    const client = await prisma.client.findUnique({
      where: { id: req.userId },
      include: { city: true },
    });
    if (!client) {
      res.status(404).json({ error: 'Sesión inválida.' });
      return;
    }
    res.json({ role: 'client', client });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Sesión cerrada exitosamente.' });
});

export default router;
