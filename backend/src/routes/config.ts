import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

// Get global config (includes tiers)
router.get('/', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const config = await prisma.globalConfig.findUnique({ where: { id: 1 } });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener configuración.' });
  }
});

// Public: get tier thresholds (for client profile)
router.get('/tiers', async (_req, res) => {
  try {
    const config = await prisma.globalConfig.findUnique({
      where: { id: 1 },
      select: { bronzeThreshold: true, silverThreshold: true, goldThreshold: true },
    });
    res.json(config || { bronzeThreshold: 1000, silverThreshold: 5000, goldThreshold: 15000 });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener categorías.' });
  }
});

// Update global config
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      lowStockThreshold, adminWhatsappNumber, emailFrom,
      bronzeThreshold, silverThreshold, goldThreshold,
    } = req.body;

    const config = await prisma.globalConfig.upsert({
      where: { id: 1 },
      update: {
        lowStockThreshold: lowStockThreshold ? Number(lowStockThreshold) : undefined,
        adminWhatsappNumber: adminWhatsappNumber ?? undefined,
        emailFrom: emailFrom ?? undefined,
        bronzeThreshold: bronzeThreshold ? Number(bronzeThreshold) : undefined,
        silverThreshold: silverThreshold ? Number(silverThreshold) : undefined,
        goldThreshold: goldThreshold ? Number(goldThreshold) : undefined,
      },
      create: {
        id: 1,
        lowStockThreshold: Number(lowStockThreshold) || 10,
        adminWhatsappNumber: adminWhatsappNumber || '',
        emailFrom: emailFrom || '',
        bronzeThreshold: Number(bronzeThreshold) || 1000,
        silverThreshold: Number(silverThreshold) || 5000,
        goldThreshold: Number(goldThreshold) || 15000,
      },
    });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar configuración.' });
  }
});

export default router;
