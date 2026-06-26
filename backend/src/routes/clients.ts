import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

// Admin: get currently-online clients (active within the last 5 minutes)
router.get('/online', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const ONLINE_WINDOW_MIN = 5;
    const since = new Date(Date.now() - ONLINE_WINDOW_MIN * 60 * 1000);
    const clients = await prisma.client.findMany({
      where: { lastSeenAt: { gte: since } },
      select: {
        id: true,
        localName: true,
        lastSeenAt: true,
        city: { select: { name: true } },
      },
      orderBy: { lastSeenAt: 'desc' },
    });
    res.json({ count: clients.length, windowMinutes: ONLINE_WINDOW_MIN, clients });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios conectados.' });
  }
});

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

// Admin: delete client (cascade)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.$transaction([
      prisma.cashbackTransaction.deleteMany({ where: { clientId: id } }),
      prisma.orderItem.deleteMany({ where: { order: { clientId: id } } }),
      prisma.order.deleteMany({ where: { clientId: id } }),
      prisma.client.delete({ where: { id } }),
    ]);
    res.json({ message: 'Cliente eliminado exitosamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el cliente.' });
  }
});

// Admin: adjust (deduct) client cashback balance
router.post('/:id/adjust-cashback', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { amount, reason } = req.body;
    if (!amount || Number(amount) <= 0) {
      res.status(400).json({ error: 'Ingrese un monto válido mayor a cero.' });
      return;
    }
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      res.status(404).json({ error: 'Cliente no encontrado.' });
      return;
    }
    const deduct = Math.min(Number(amount), client.cashbackBalance);
    await prisma.$transaction([
      prisma.cashbackTransaction.create({
        data: {
          clientId: id,
          amount: deduct,
          type: 'USED',
          ruleDescription: reason || 'Ajuste manual por administrador',
        },
      }),
      prisma.client.update({
        where: { id },
        data: { cashbackBalance: { decrement: deduct } },
      }),
    ]);
    res.json({ message: `Se descontaron $${deduct.toFixed(2)} del saldo del cliente.`, deducted: deduct });
  } catch (err) {
    res.status(500).json({ error: 'Error al ajustar el saldo de beneficios.' });
  }
});

// Client: get my tier (calculated dynamically) + detect tier change vs last notified
router.get('/me/tier', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { calculateClientTier } = await import('../utils/tiers');
    const tier = await calculateClientTier(req.userId!);

    // Detectar ascenso / descenso comparando con la última categoría notificada
    const client = await prisma.client.findUnique({
      where: { id: req.userId },
      select: { notifiedTier: true },
    });
    const rank: Record<string, number> = { BRONZE: 0, SILVER: 1, GOLD: 2 };
    const previousTier = client?.notifiedTier ?? null;
    let tierChanged: 'UP' | 'DOWN' | null = null;

    if (previousTier && previousTier !== tier.tier) {
      tierChanged = rank[tier.tier] > rank[previousTier] ? 'UP' : 'DOWN';
    }

    // Persistir la categoría actual como "notificada" para que el cartel aparezca solo una vez
    if (previousTier !== tier.tier) {
      await prisma.client.update({
        where: { id: req.userId },
        data: { notifiedTier: tier.tier },
      }).catch(() => {});
    }

    res.json({ ...tier, tierChanged, previousTier: tierChanged ? previousTier : undefined });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular la categoría.' });
  }
});

// Client: get my profile
router.get('/me/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Procesar vencimientos para que el saldo mostrado esté siempre actualizado
    const { processClientCashbackExpiry } = await import('../utils/cashbackExpiry');
    await processClientCashbackExpiry(req.userId!).catch(() => {});

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
