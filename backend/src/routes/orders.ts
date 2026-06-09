import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, AuthRequest } from '../middlewares/auth';
import { calculateCashback } from '../utils/cashback';
import { calculateClientTier } from '../utils/tiers';
import { sendWhatsAppToAdmin, sendOrderConfirmationEmail, sendOrderStatusEmail } from '../utils/notifications';

const router = Router();
const prisma = new PrismaClient();

// Client: create order
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { items, deliveryDate, preferredTimeRange, notes, cashbackToUse } = req.body;

  if (!items?.length || !deliveryDate || !preferredTimeRange) {
    res.status(400).json({ error: 'Se requieren los productos, la fecha de entrega y el rango horario.' });
    return;
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id: req.userId },
      include: { city: true },
    });
    if (!client) {
      res.status(404).json({ error: 'Cliente no encontrado.' });
      return;
    }

    // Validate and build order items
    const orderItems: { productId: number; categoryId: number; quantity: number; unitPrice: number; subtotal: number }[] = [];
    let subtotalBeforeCashback = 0;

    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || !product.isActive) {
        res.status(400).json({ error: `El producto "${item.productId}" no está disponible.` });
        return;
      }
      if (product.stock < item.quantity) {
        res.status(400).json({
          error: `El stock disponible de "${product.name}" es insuficiente para la cantidad solicitada.`,
        });
        return;
      }
      const subtotal = product.price * item.quantity;
      subtotalBeforeCashback += subtotal;
      orderItems.push({
        productId: product.id,
        categoryId: product.categoryId,
        quantity: item.quantity,
        unitPrice: product.price,
        subtotal,
      });
    }

    // Apply cashback balance
    let cashbackUsed = 0;
    if (cashbackToUse && cashbackToUse > 0) {
      cashbackUsed = Math.min(Number(cashbackToUse), client.cashbackBalance, subtotalBeforeCashback);
    }

    const totalAmount = subtotalBeforeCashback - cashbackUsed;

    // Get client tier for tier-based cashback benefits
    const tierResult = await calculateClientTier(client.id).catch(() => null);
    const clientTier = tierResult?.tier;

    // Calculate cashback earned (includes tier benefits if applicable)
    const { amount: cashbackEarned, ruleDescription } = await calculateCashback(
      orderItems,
      totalAmount,
      new Date(),
      clientTier
    );

    // Create order in transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          clientId: client.id,
          deliveryDate: new Date(deliveryDate),
          preferredTimeRange,
          notes: notes || null,
          totalAmount,
          cashbackUsed,
          cashbackEarned,
          items: {
            create: orderItems.map(({ productId, quantity, unitPrice, subtotal }) => ({
              productId,
              quantity,
              unitPrice,
              subtotal,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });

      // Deduct stock
      for (const item of orderItems) {
        const newStock = await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
        if (newStock.stock <= 0) {
          await tx.product.update({ where: { id: item.productId }, data: { isActive: false } });
        }
      }

      // Update client cashback balance
      const newBalance = client.cashbackBalance - cashbackUsed + cashbackEarned;
      await tx.client.update({
        where: { id: client.id },
        data: {
          cashbackBalance: newBalance,
          totalCashbackEarned: { increment: cashbackEarned },
        },
      });

      // Calcular fecha de vencimiento del saldo ganado
      const cashbackConfig = await tx.globalCashbackConfig.findUnique({ where: { id: 1 } });
      const expiresAt = cashbackConfig?.balanceExpiryDays
        ? new Date(Date.now() + cashbackConfig.balanceExpiryDays * 24 * 60 * 60 * 1000)
        : null;

      // Record cashback transactions
      if (cashbackEarned > 0) {
        await tx.cashbackTransaction.create({
          data: {
            clientId: client.id,
            orderId: newOrder.id,
            amount: cashbackEarned,
            type: 'EARNED',
            ruleDescription,
            expiresAt,
          },
        });
      }
      if (cashbackUsed > 0) {
        await tx.cashbackTransaction.create({
          data: {
            clientId: client.id,
            orderId: newOrder.id,
            amount: cashbackUsed,
            type: 'USED',
            ruleDescription: 'Saldo de beneficios aplicado al pedido',
          },
        });
      }

      return newOrder;
    });

    // Fetch updated client and admin config
    const [updatedClient, globalConfig] = await Promise.all([
      prisma.client.findUnique({ where: { id: client.id } }),
      prisma.globalConfig.findUnique({ where: { id: 1 } }),
    ]);

    // Send notifications (non-blocking)
    const notifData = {
      orderNumber: order.id,
      clientName: client.localName,
      cityName: client.city?.name || 'Sin ciudad',
      phone: client.phone,
      email: client.email || undefined,
      items: order.items.map((i) => ({
        name: i.product.name,
        quantity: i.quantity,
        subtotal: i.subtotal,
      })),
      total: totalAmount,
      cashbackUsed,
      cashbackEarned,
      deliveryDate: new Date(deliveryDate),
      preferredTimeRange,
      notes: notes || undefined,
      newCashbackBalance: updatedClient?.cashbackBalance || 0,
      createdAt: order.createdAt,
    };

    const adminWhatsapp = globalConfig?.adminWhatsappNumber || '';
    sendWhatsAppToAdmin(notifData, adminWhatsapp).catch(() => {});
    if (client.email) sendOrderConfirmationEmail(notifData).catch(() => {});

    res.status(201).json({
      message: 'Su pedido ha sido registrado exitosamente.',
      order: { id: order.id, totalAmount, cashbackUsed, cashbackEarned },
      newCashbackBalance: updatedClient?.cashbackBalance || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar el pedido.' });
  }
});

// Client: get my orders
router.get('/my', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: { clientId: req.userId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener los pedidos.' });
  }
});

// Admin: get all orders
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { city, status, date, page = '1', limit = '50' } = req.query;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (date) {
      const d = new Date(String(date));
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.createdAt = { gte: d, lt: next };
    }
    if (city) {
      where.client = { cityId: Number(city) };
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        client: { include: { city: true } },
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });
    const total = await prisma.order.count({ where });
    res.json({ orders, total });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pedidos.' });
  }
});

// Admin: update order status
router.patch('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: { client: true },
    });
    if (!order) {
      res.status(404).json({ error: 'Pedido no encontrado.' });
      return;
    }
    const updated = await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: { status },
    });

    // Send email notification only when order starts being prepared (not on delivery)
    if (order.client.email && status === 'PREPARING') {
      sendOrderStatusEmail(order.client.email, order.client.localName, order.id, status).catch(() => {});
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar el estado del pedido.' });
  }
});

// Admin: dashboard stats
router.get('/admin/stats', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 7);

    const config = await prisma.globalConfig.findUnique({ where: { id: 1 } });
    const threshold = config?.lowStockThreshold || 10;

    const [pendingOrders, todayOrders, weekOrders, lowStockProducts, cashbackStats] = await Promise.all([
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.product.findMany({
        where: { stock: { lte: threshold, gt: 0 }, isActive: true },
        select: { id: true, name: true, stock: true },
      }),
      prisma.cashbackTransaction.aggregate({
        _sum: { amount: true },
        where: { type: 'EARNED' },
      }),
    ]);

    const cashbackUsedStats = await prisma.cashbackTransaction.aggregate({
      _sum: { amount: true },
      where: { type: 'USED' },
    });

    const weekRevenue = await prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { createdAt: { gte: weekStart }, status: { not: 'CANCELLED' } },
    });

    res.json({
      pendingOrders,
      todayOrders,
      weekOrders,
      lowStockProducts,
      weekRevenue: weekRevenue._sum.totalAmount || 0,
      cashbackEmitted: cashbackStats._sum.amount || 0,
      cashbackUsed: cashbackUsedStats._sum.amount || 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener estadísticas.' });
  }
});

// Admin: billing report
router.get('/admin/billing', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type = 'all', period = 'month', year, month } = req.query;

    const now = new Date();
    const y = year ? Number(year) : now.getFullYear();
    const m = month ? Number(month) - 1 : now.getMonth(); // 0-based

    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;

    if (period === 'week') {
      dateFrom = new Date(now);
      dateFrom.setDate(dateFrom.getDate() - 7);
      // no upper bound — up to now
    } else if (period === 'month') {
      dateFrom = new Date(y, m, 1);
      dateTo   = new Date(y, m + 1, 1);   // exclusive: 1st of next month
    } else if (period === 'year') {
      dateFrom = new Date(y, 0, 1);
      dateTo   = new Date(y + 1, 0, 1);   // exclusive: Jan 1 of next year
    }

    const statusFilter = type === 'paid'
      ? { status: 'DELIVERED' as const }
      : type === 'pending'
      ? { status: { in: ['PENDING', 'PREPARING'] as const } }
      : { status: { not: 'CANCELLED' as const } };

    const where: Record<string, unknown> = { ...statusFilter };
    if (dateFrom && dateTo) {
      where.createdAt = { gte: dateFrom, lt: dateTo };
    } else if (dateFrom) {
      where.createdAt = { gte: dateFrom };
    }

    const [orders, totals] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { client: { include: { city: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.aggregate({
        where,
        _sum: { totalAmount: true },
        _count: true,
      }),
    ]);

    res.json({
      orders,
      total: totals._sum.totalAmount || 0,
      count: totals._count,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el reporte de facturación.' });
  }
});

export default router;
