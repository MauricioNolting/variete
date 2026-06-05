import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { authenticateToken, requireAdmin, AuthRequest } from '../middlewares/auth';
import { uploadImage, deleteImage } from '../utils/cloudinary';

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

// Get all categories (public)
router.get('/', async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: { where: { isActive: true } } } } },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener categorías.' });
  }
});

// Admin: create category
router.post('/', authenticateToken, requireAdmin, upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'El nombre de la categoría es obligatorio.' });
      return;
    }
    let imageUrl: string | undefined;
    let cloudinaryPublicId: string | undefined;

    if (req.file) {
      const result = await uploadImage(req.file.buffer, 'variete/categorias');
      imageUrl = result.url;
      cloudinaryPublicId = result.publicId;
    }

    const category = await prisma.category.create({
      data: { name, imageUrl, cloudinaryPublicId },
    });
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear la categoría.' });
  }
});

// Admin: update category
router.put('/:id', authenticateToken, requireAdmin, upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    const category = await prisma.category.findUnique({ where: { id: Number(req.params.id) } });
    if (!category) {
      res.status(404).json({ error: 'Categoría no encontrada.' });
      return;
    }

    let imageUrl = category.imageUrl;
    let cloudinaryPublicId = category.cloudinaryPublicId;

    if (req.file) {
      if (cloudinaryPublicId) await deleteImage(cloudinaryPublicId);
      const result = await uploadImage(req.file.buffer, 'variete/categorias');
      imageUrl = result.url;
      cloudinaryPublicId = result.publicId;
    }

    const updated = await prisma.category.update({
      where: { id: Number(req.params.id) },
      data: { name: name || category.name, imageUrl, cloudinaryPublicId },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar la categoría.' });
  }
});

// Admin: delete category
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const category = await prisma.category.findUnique({ where: { id: Number(req.params.id) } });
    if (!category) {
      res.status(404).json({ error: 'Categoría no encontrada.' });
      return;
    }
    if (category.cloudinaryPublicId) {
      await deleteImage(category.cloudinaryPublicId);
    }
    // Delete product images too
    const products = await prisma.product.findMany({ where: { categoryId: Number(req.params.id) } });
    for (const p of products) {
      const imgs = p.images as { url: string; publicId: string }[];
      for (const img of imgs) await deleteImage(img.publicId);
    }
    await prisma.category.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Categoría eliminada exitosamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar la categoría.' });
  }
});

export default router;
