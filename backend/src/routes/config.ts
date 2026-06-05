import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const config = await prisma.globalConfig.findUnique({ where: { id: 1 } });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener configuración.' });
  }
});

router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { lowStockThreshold, adminWhatsappNumber, emailFrom } = req.body;
    const config = await prisma.globalConfig.upsert({
      where: { id: 1 },
      update: {
        lowStockThreshold: lowStockThreshold ? Number(lowStockThreshold) : undefined,
        adminWhatsappNumber: adminWhatsappNumber ?? undefined,
        emailFrom: emailFrom ?? undefined,
      },
      create: {
        id: 1,
        lowStockThreshold: Number(lowStockThreshold) || 10,
        adminWhatsappNumber: adminWhatsappNumber || '',
        emailFrom: emailFrom || '',
      },
    });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar configuración.' });
  }
});

export default router;
