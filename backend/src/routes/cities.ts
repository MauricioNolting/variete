import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

// Get active cities with upcoming visit dates (public)
router.get('/', async (_req, res) => {
  try {
    const cities = await prisma.city.findMany({
      where: { isActive: true },
      include: {
        visitDates: {
          where: { date: { gte: new Date() } },
          orderBy: { date: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(cities);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener ciudades.' });
  }
});

// Admin: get all cities
router.get('/admin/all', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const cities = await prisma.city.findMany({
      include: {
        visitDates: { orderBy: { date: 'asc' } },
        _count: { select: { clients: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(cities);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener ciudades.' });
  }
});

// Admin: create city
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'El nombre de la ciudad es obligatorio.' });
      return;
    }
    const city = await prisma.city.create({ data: { name } });
    res.status(201).json(city);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear la ciudad.' });
  }
});

// Admin: toggle city active status
router.patch('/:id/toggle', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const city = await prisma.city.findUnique({ where: { id: Number(req.params.id) } });
    if (!city) {
      res.status(404).json({ error: 'Ciudad no encontrada.' });
      return;
    }
    const updated = await prisma.city.update({
      where: { id: Number(req.params.id) },
      data: { isActive: !city.isActive },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar el estado de la ciudad.' });
  }
});

// Admin: delete city
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const clientCount = await prisma.client.count({ where: { cityId: Number(req.params.id) } });
    if (clientCount > 0) {
      // Mark clients as city-unassigned
      await prisma.client.updateMany({
        where: { cityId: Number(req.params.id) },
        data: { cityId: null },
      });
    }
    await prisma.city.delete({ where: { id: Number(req.params.id) } });
    res.json({
      message: `Ciudad eliminada exitosamente.${clientCount > 0 ? ` ${clientCount} establecimiento(s) quedaron sin ciudad asignada.` : ''}`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar la ciudad.' });
  }
});

// Admin: set visit dates for a city
router.put('/:id/dates', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { dates } = req.body; // array of ISO date strings
    if (!Array.isArray(dates)) {
      res.status(400).json({ error: 'Se requiere un arreglo de fechas.' });
      return;
    }
    // Remove all existing dates and replace
    await prisma.cityVisitDate.deleteMany({ where: { cityId: Number(req.params.id) } });
    const now = new Date();
    const futureDates = dates
      .map((d: string) => new Date(d))
      .filter((d) => d > now);

    await prisma.cityVisitDate.createMany({
      data: futureDates.map((d) => ({ cityId: Number(req.params.id), date: d })),
    });

    const city = await prisma.city.findUnique({
      where: { id: Number(req.params.id) },
      include: { visitDates: { orderBy: { date: 'asc' } } },
    });
    res.json(city);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar las fechas de visita.' });
  }
});

// Get visit dates for a specific city (public)
router.get('/:id/dates', async (req, res) => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dates = await prisma.cityVisitDate.findMany({
      where: { cityId: Number(req.params.id), date: { gte: tomorrow } },
      orderBy: { date: 'asc' },
    });
    res.json(dates);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener fechas de visita.' });
  }
});

export default router;
