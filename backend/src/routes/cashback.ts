import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, AuthRequest } from '../middlewares/auth';
import { calculateCashback } from '../utils/cashback';

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

// Public: calculate cashback for a cart
router.post('/calculate', async (req, res) => {
  try {
    const { items, orderTotal } = req.body;
    if (!items || orderTotal === undefined) {
      res.status(400).json({ error: 'Se requieren los ítems y el total del pedido.' });
      return;
    }
    const result = await calculateCashback(items, Number(orderTotal));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Error al calcular beneficios.' });
  }
});

// Client: get my cashback transactions + real available balance
router.get('/my/transactions', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const transactions = await prisma.cashbackTransaction.findMany({
      where: { clientId: req.userId },
      include: { order: { select: { id: true, createdAt: true, totalAmount: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Calcular saldo real (excluyendo vencidos)
    const effectiveBalance = transactions.reduce((acc, t) => {
      if (t.type === 'EARNED') {
        if (!t.expiresAt || t.expiresAt > now) return acc + t.amount;
        return acc; // vencido
      }
      return acc - t.amount; // USED
    }, 0);

    // Próximo vencimiento
    const nextExpiry = transactions
      .filter((t) => t.type === 'EARNED' && t.expiresAt && t.expiresAt > now)
      .sort((a, b) => new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime())[0];

    res.json({ transactions, effectiveBalance: Math.max(0, effectiveBalance), nextExpiry });
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
    const { type, percentage, minAmount, startDate, endDate, specificDates, categoryId, productId } = req.body;
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
    const { percentage, isActive, minAmount, startDate, endDate, specificDates } = req.body;
    const rule = await prisma.cashbackRule.update({
      where: { id: Number(req.params.id) },
      data: {
        percentage: percentage !== undefined ? Number(percentage) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        minAmount: minAmount !== undefined ? Number(minAmount) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        specificDates: specificDates !== undefined ? specificDates : undefined,
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
