import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, AuthRequest } from '../middlewares/auth';
import { calculateCashback } from '../utils/cashback';
import { calculateClientTier } from '../utils/tiers';

const router = Router();
const prisma = new PrismaClient();

// Public: get active rules summary
router.get('/rules/active', async (_req, res) => {
  try {
    const rules = await prisma.cashbackRule.findMany({
      where: { isActive: true },
      include: { category: true, product: true },
      orderBy: { percentage: 'desc' },
    });
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener reglas de beneficios.' });
  }
});

// Public: get global cashback config
router.get('/config', async (_req, res) => {
  try {
    const config = await prisma.globalCashbackConfig.findUnique({ where: { id: 1 } });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener configuración de beneficios.' });
  }
});

// Authenticated: calculate cashback preview for a cart (includes tier benefits)
router.post('/calculate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { items, orderTotal } = req.body;
    if (!items || orderTotal === undefined) {
      res.status(400).json({ error: 'Se requieren los ítems y el total del pedido.' });
      return;
    }
    // Include the client's tier benefits in the preview calculation
    const tierResult = await calculateClientTier(req.userId!).catch(() => null);
    const clientTier = tierResult?.tier;
    const result = await calculateCashback(items, Number(orderTotal), new Date(), clientTier);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Error al calcular beneficios.' });
  }
});

// Client: get my cashback transactions + real available balance + pending expirations
router.get('/my/transactions', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const transactions = await prisma.cashbackTransaction.findMany({
      where: { clientId: req.userId },
      include: { order: { select: { id: true, createdAt: true, totalAmount: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Total de saldo consumido (USED)
    const totalUsed = transactions
      .filter((t) => t.type === 'USED')
      .reduce((sum, t) => sum + t.amount, 0);

    // Lotes EARNED activos (no vencidos). Cada lote es consumible.
    // Orden de consumo FIFO: primero el que vence antes; los que no vencen, al final.
    const earnedLots = transactions
      .filter((t) => t.type === 'EARNED' && (!t.expiresAt || t.expiresAt > now))
      .map((t) => ({ amount: t.amount, expiresAt: t.expiresAt, createdAt: t.createdAt }))
      .sort((a, b) => {
        if (a.expiresAt && b.expiresAt) return a.expiresAt.getTime() - b.expiresAt.getTime();
        if (a.expiresAt) return -1;  // a vence, b no → a primero
        if (b.expiresAt) return 1;   // b vence, a no → b primero
        return a.createdAt.getTime() - b.createdAt.getTime(); // ambos sin vencimiento → más antiguo primero
      });

    // Consumir el saldo usado, empezando por los lotes que vencen antes
    let toConsume = totalUsed;
    for (const lot of earnedLots) {
      if (toConsume <= 0) break;
      const consume = Math.min(lot.amount, toConsume);
      lot.amount -= consume;
      toConsume -= consume;
    }

    // Lotes que aún tienen saldo disponible
    const liveLots = earnedLots.filter((l) => l.amount > 0.001);

    // Saldo efectivo = suma de los lotes vivos (incluye los que no vencen)
    const effectiveBalance = liveLots.reduce((sum, l) => sum + l.amount, 0);

    // Saldos a vencer: solo lotes vivos que tienen fecha de vencimiento, agrupados por fecha
    const grouped: Record<string, { expiresAt: Date; amount: number; ordersCount: number }> = {};
    for (const lot of liveLots) {
      if (!lot.expiresAt) continue;
      const key = lot.expiresAt.toISOString().split('T')[0];
      if (!grouped[key]) {
        grouped[key] = { expiresAt: lot.expiresAt, amount: 0, ordersCount: 0 };
      }
      grouped[key].amount += lot.amount;
      grouped[key].ordersCount += 1;
    }
    const pendingExpirations = Object.values(grouped)
      .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());

    // Próximo vencimiento = el lote vivo que vence antes
    const nextExpiry = pendingExpirations.length > 0
      ? { expiresAt: pendingExpirations[0].expiresAt }
      : null;

    res.json({
      transactions,
      effectiveBalance: Math.max(0, effectiveBalance),
      nextExpiry,
      pendingExpirations,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el historial de beneficios.' });
  }
});

// Admin: get all rules
router.get('/rules', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const rules = await prisma.cashbackRule.findMany({
      include: { category: true, product: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener reglas de beneficios.' });
  }
});

// Admin: create rule
router.post('/rules', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type, percentage, minAmount, startDate, endDate, specificDates, categoryId, productId, expiryDays } = req.body;
    if (!type || !percentage) {
      res.status(400).json({ error: 'Se requiere tipo y porcentaje de la regla.' });
      return;
    }
    const rule = await prisma.cashbackRule.create({
      data: {
        type,
        percentage: Number(percentage),
        minAmount: minAmount ? Number(minAmount) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        specificDates: specificDates || null,
        categoryId: categoryId ? Number(categoryId) : null,
        productId: productId ? Number(productId) : null,
        expiryDays: expiryDays ? Number(expiryDays) : null,
      },
      include: { category: true, product: true },
    });
    res.status(201).json(rule);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear la regla de beneficios.' });
  }
});

// Admin: update rule
router.put('/rules/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { percentage, isActive, minAmount, startDate, endDate, specificDates, expiryDays } = req.body;
    const rule = await prisma.cashbackRule.update({
      where: { id: Number(req.params.id) },
      data: {
        percentage: percentage !== undefined ? Number(percentage) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        minAmount: minAmount !== undefined ? Number(minAmount) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        specificDates: specificDates !== undefined ? specificDates : undefined,
        expiryDays: expiryDays !== undefined ? (expiryDays ? Number(expiryDays) : null) : undefined,
      },
      include: { category: true, product: true },
    });
    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar la regla de beneficios.' });
  }
});

// Admin: toggle rule
router.patch('/rules/:id/toggle', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rule = await prisma.cashbackRule.findUnique({ where: { id: Number(req.params.id) } });
    if (!rule) {
      res.status(404).json({ error: 'Regla no encontrada.' });
      return;
    }
    const updated = await prisma.cashbackRule.update({
      where: { id: Number(req.params.id) },
      data: { isActive: !rule.isActive },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar el estado de la regla.' });
  }
});

// Admin: delete rule
router.delete('/rules/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await prisma.cashbackRule.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Regla de beneficios eliminada exitosamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar la regla de beneficios.' });
  }
});

// Admin: update global cashback config
router.put('/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { stackRules, maxPercentage, balanceExpiryDays } = req.body;
    const { maxAmount } = req.body;
    const config = await prisma.globalCashbackConfig.upsert({
      where: { id: 1 },
      update: {
        stackRules: stackRules !== undefined ? Boolean(stackRules) : undefined,
        maxPercentage: maxPercentage !== undefined ? (maxPercentage ? Number(maxPercentage) : null) : undefined,
        maxAmount: maxAmount !== undefined ? (maxAmount ? Number(maxAmount) : null) : undefined,
        balanceExpiryDays: balanceExpiryDays !== undefined ? (balanceExpiryDays ? Number(balanceExpiryDays) : null) : undefined,
      },
      create: {
        id: 1,
        stackRules: Boolean(stackRules),
        maxPercentage: maxPercentage ? Number(maxPercentage) : null,
        maxAmount: maxAmount ? Number(maxAmount) : null,
        balanceExpiryDays: balanceExpiryDays ? Number(balanceExpiryDays) : null,
      },
    });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar la configuración de beneficios.' });
  }
});

// Public: get tier benefits visible for a given tier level
// BRONZE sees all, SILVER sees SILVER+GOLD, GOLD sees only GOLD
router.get('/tier-benefits', async (req, res) => {
  try {
    const { tier } = req.query;
    const validTiers: Record<string, string[]> = {
      GOLD:   ['GOLD'],
      SILVER: ['SILVER', 'GOLD'],
      BRONZE: ['BRONZE', 'SILVER', 'GOLD'],
    };
    const allowedTiers = tier ? (validTiers[String(tier).toUpperCase()] || validTiers.BRONZE) : ['BRONZE', 'SILVER', 'GOLD'];
    const benefits = await prisma.tierBenefit.findMany({
      where: { isActive: true, tier: { in: allowedTiers } },
      orderBy: [{ tier: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(benefits);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener beneficios por categoría.' });
  }
});

// Admin: CRUD for tier benefits
router.get('/tier-benefits/admin', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const benefits = await prisma.tierBenefit.findMany({ orderBy: [{ tier: 'asc' }, { createdAt: 'asc' }] });
    res.json(benefits);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener beneficios.' });
  }
});

router.post('/tier-benefits', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { tier, title, percentage, description, expiryDays } = req.body;
    if (!tier || !title) {
      res.status(400).json({ error: 'Se requiere la categoría y el título del beneficio.' });
      return;
    }
    const benefit = await prisma.tierBenefit.create({
      data: {
        tier,
        title,
        percentage: percentage ? Number(percentage) : null,
        description: description || null,
        expiryDays: expiryDays ? Number(expiryDays) : null,
      },
    });
    res.status(201).json(benefit);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear el beneficio.' });
  }
});

router.put('/tier-benefits/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { tier, title, percentage, description, isActive, expiryDays } = req.body;
    const benefit = await prisma.tierBenefit.update({
      where: { id: Number(req.params.id) },
      data: {
        tier: tier ?? undefined,
        title: title ?? undefined,
        percentage: percentage !== undefined ? (percentage ? Number(percentage) : null) : undefined,
        description: description !== undefined ? (description || null) : undefined,
        expiryDays: expiryDays !== undefined ? (expiryDays ? Number(expiryDays) : null) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });
    res.json(benefit);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar el beneficio.' });
  }
});

router.delete('/tier-benefits/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await prisma.tierBenefit.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Beneficio eliminado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar el beneficio.' });
  }
});

// Admin: cashback financial summary
router.get('/summary', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const [emitted, used, pendingClients] = await Promise.all([
      prisma.cashbackTransaction.aggregate({ _sum: { amount: true }, where: { type: 'EARNED' } }),
      prisma.cashbackTransaction.aggregate({ _sum: { amount: true }, where: { type: 'USED' } }),
      prisma.client.aggregate({ _sum: { cashbackBalance: true } }),
    ]);
    res.json({
      totalEmitted: emitted._sum.amount || 0,
      totalUsed: used._sum.amount || 0,
      pendingBalance: pendingClients._sum.cashbackBalance || 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener resumen de beneficios.' });
  }
});

export default router;
