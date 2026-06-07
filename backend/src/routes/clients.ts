import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

// Admin: get all clients
router.get('/', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const clients = await prisma.client.findMany({
      include: {
        city: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener clientes.' });
  }
});

// Admin: get client detail
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        city: true,
        orders: {
          include: { items: { include: { product: true } } },
          orderBy: { createdAt: 'desc' },
        },
        cashbackTransactions: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!client) {
      res.status(404).json({ error: 'Cliente no encontrado.' });
      return;
    }
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el cliente.' });
  }
});

// Client: get my tier (calculated dynamically)
router.get('/me/tier', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { calculateClientTier } = await import('../utils/tiers');
    const tier = await calculateClientTier(req.userId!);
    res.json(tier);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular la categoría.' });
  }
});

// Client: get my profile
router.get('/me/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.userId },
      include: { city: true },
    });
    if (!client) {
      res.status(404).json({ error: 'Cliente no encontrado.' });
      return;
    }
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el perfil.' });
  }
});

// Client: update my profile
router.put('/me/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { address, email } = req.body;
    const updated = await prisma.client.update({
      where: { id: req.userId },
      data: { address, email: email || null },
      include: { city: true },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar el perfil.' });
  }
});

export default router;
