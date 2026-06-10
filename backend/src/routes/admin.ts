import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, AuthRequest } from '../middlewares/auth';
import { deleteImage } from '../utils/cloudinary';

const router = Router();
const prisma = new PrismaClient();

type ResetTarget = 'orders' | 'clients' | 'products' | 'categories' | 'cashback' | 'cities';

const VALID_TARGETS: ResetTarget[] = ['orders', 'clients', 'products', 'categories', 'cashback', 'cities'];

// Admin: selective data reset (password-protected, destructive)
router.post('/reset', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { password, targets } = req.body as { password?: string; targets?: ResetTarget[] };

  // 1. Validaciones de entrada
  if (!password) {
    res.status(400).json({ error: 'Debe ingresar su contraseña para confirmar el reseteo.' });
    return;
  }
  if (!Array.isArray(targets) || targets.length === 0) {
    res.status(400).json({ error: 'Debe seleccionar al menos un conjunto de datos para resetear.' });
    return;
  }
  const cleanTargets = targets.filter((t) => VALID_TARGETS.includes(t));
  if (cleanTargets.length === 0) {
    res.status(400).json({ error: 'Selección de datos inválida.' });
    return;
  }

  // 2. Verificar la contraseña del admin autenticado
  try {
    const admin = await prisma.admin.findUnique({ where: { id: req.userId } });
    if (!admin) {
      res.status(401).json({ error: 'Administrador no encontrado.' });
      return;
    }
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Contraseña incorrecta. No se eliminó ningún dato.' });
      return;
    }
  } catch {
    res.status(500).json({ error: 'Error al verificar las credenciales.' });
    return;
  }

  const has = (t: ResetTarget) => cleanTargets.includes(t);

  // 3. Resolver qué tablas hay que limpiar (respetando dependencias / claves foráneas)
  const flags = {
    transactions: false,        // CashbackTransaction
    orderItems: false,          // OrderItem
    orders: false,              // Order
    cashbackRules: false,       // CashbackRule
    tierBenefits: false,        // TierBenefit
    promotions: false,          // Promotion (FK a Product)
    products: false,            // Product
    categories: false,          // Category
    clients: false,             // Client
    visitDates: false,          // CityVisitDate
    cities: false,              // City
    resetClientCashback: false, // poner saldos/categoría de clientes en 0
    detachClientCity: false,    // clients.cityId = null
  };

  // Pedidos → pedidos + ítems + transacciones + reset de saldos
  if (has('orders')) {
    flags.transactions = true; flags.orderItems = true; flags.orders = true; flags.resetClientCashback = true;
  }
  // Clientes → cadena de pedidos + clientes
  if (has('clients')) {
    flags.transactions = true; flags.orderItems = true; flags.orders = true; flags.clients = true;
  }
  // Productos → requiere quitar ítems de pedido y reglas que los referencian (implica pedidos)
  if (has('products')) {
    flags.transactions = true; flags.orderItems = true; flags.orders = true;
    flags.cashbackRules = true; flags.promotions = true; flags.products = true; flags.resetClientCashback = true;
  }
  // Categorías → requiere quitar productos primero
  if (has('categories')) {
    flags.transactions = true; flags.orderItems = true; flags.orders = true;
    flags.cashbackRules = true; flags.promotions = true; flags.products = true;
    flags.categories = true; flags.resetClientCashback = true;
  }
  // Beneficios → reglas + beneficios por nivel + transacciones + reset de saldos
  if (has('cashback')) {
    flags.transactions = true; flags.cashbackRules = true; flags.tierBenefits = true; flags.resetClientCashback = true;
  }
  // Ciudades → fechas de visita + ciudades (desvincula clientes si no se borran)
  if (has('cities')) {
    flags.visitDates = true; flags.cities = true;
    if (!flags.clients) flags.detachClientCity = true;
  }

  // 4. Recolectar identificadores de imágenes de Cloudinary ANTES de borrar
  const cloudinaryIds: string[] = [];
  try {
    if (flags.products) {
      const products = await prisma.product.findMany({ select: { images: true } });
      for (const p of products) {
        const imgs = (p.images as { url: string; publicId: string }[]) || [];
        for (const img of imgs) if (img?.publicId) cloudinaryIds.push(img.publicId);
      }
    }
    if (flags.categories) {
      const cats = await prisma.category.findMany({ select: { cloudinaryPublicId: true } });
      for (const c of cats) if (c.cloudinaryPublicId) cloudinaryIds.push(c.cloudinaryPublicId);
    }
  } catch {
    // no bloquear el reseteo si falla la lectura de imágenes
  }

  // 5. Ejecutar borrados en orden seguro, dentro de una transacción
  const deleted: Record<string, number> = {};
  try {
    await prisma.$transaction(async (tx) => {
      if (flags.transactions) deleted.transactions = (await tx.cashbackTransaction.deleteMany({})).count;
      if (flags.orderItems)   deleted.orderItems   = (await tx.orderItem.deleteMany({})).count;
      if (flags.orders)       deleted.orders       = (await tx.order.deleteMany({})).count;
      if (flags.cashbackRules) deleted.cashbackRules = (await tx.cashbackRule.deleteMany({})).count;
      if (flags.tierBenefits) deleted.tierBenefits = (await tx.tierBenefit.deleteMany({})).count;
      if (flags.promotions)   deleted.promotions   = (await tx.promotion.deleteMany({})).count;
      if (flags.products)     deleted.products     = (await tx.product.deleteMany({})).count;
      if (flags.categories)   deleted.categories   = (await tx.category.deleteMany({})).count;

      if (flags.detachClientCity) {
        await tx.client.updateMany({ data: { cityId: null } });
      }
      if (flags.clients)      deleted.clients      = (await tx.client.deleteMany({})).count;
      if (flags.visitDates)   deleted.visitDates   = (await tx.cityVisitDate.deleteMany({})).count;
      if (flags.cities)       deleted.cities       = (await tx.city.deleteMany({})).count;

      // Reset de saldos/categoría solo si los clientes NO fueron eliminados
      if (flags.resetClientCashback && !flags.clients) {
        await tx.client.updateMany({
          data: {
            cashbackBalance: 0,
            totalCashbackEarned: 0,
            tierValidUntil: null,
            notifiedTier: null,
          },
        });
      }
    });
  } catch (err) {
    console.error('Error en reseteo:', err);
    res.status(500).json({ error: 'Error al resetear los datos. No se aplicó ningún cambio.' });
    return;
  }

  // 6. Borrar imágenes de Cloudinary (best-effort, fuera de la transacción)
  for (const id of cloudinaryIds) {
    deleteImage(id).catch(() => {});
  }

  res.json({
    message: 'Reseteo completado exitosamente.',
    targets: cleanTargets,
    deleted,
  });
});

export default router;
