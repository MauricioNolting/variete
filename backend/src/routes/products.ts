import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { authenticateToken, requireAdmin, AuthRequest } from '../middlewares/auth';
import { uploadImage, deleteImage } from '../utils/cloudinary';

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

// Get all active products (public)
router.get('/', async (req, res) => {
  try {
    const { category, search, page = '1', limit = '50' } = req.query;
    const where: Record<string, unknown> = { isActive: true };
    if (category) where.categoryId = Number(category);
    if (search) {
      where.name = { contains: String(search), mode: 'insensitive' };
    }
    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });
    const total = await prisma.product.count({ where });
    res.json({ products, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el catálogo de productos.' });
  }
});

// Get single product (public)
router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
      include: { category: true },
    });
    if (!product) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el producto.' });
  }
});

// Admin: get all products including inactive
router.get('/admin/all', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener productos.' });
  }
});

// Admin: create product
router.post('/', authenticateToken, requireAdmin, upload.array('images', 10), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, categoryId, stock, price, mainImageIndex } = req.body;
    if (!name || !categoryId || stock === undefined || price === undefined) {
      res.status(400).json({ error: 'Se requieren nombre, categoría, stock y precio.' });
      return;
    }

    const files = req.files as Express.Multer.File[];
    const imageData: { url: string; publicId: string }[] = [];

    for (const file of files || []) {
      const result = await uploadImage(file.buffer, 'variete/productos');
      imageData.push(result);
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        categoryId: Number(categoryId),
        stock: Number(stock),
        price: Number(price),
        images: imageData,
        mainImageIndex: Number(mainImageIndex) || 0,
        isActive: Number(stock) > 0,
      },
      include: { category: true },
    });

    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear el producto.' });
  }
});

// Admin: update product
router.put('/:id', authenticateToken, requireAdmin, upload.array('images', 10), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, categoryId, stock, price, mainImageIndex, removeImages, isActive } = req.body;
    const product = await prisma.product.findUnique({ where: { id: Number(req.params.id) } });
    if (!product) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }

    let existingImages = product.images as { url: string; publicId: string }[];

    // Remove specified images
    if (removeImages) {
      const toRemove: string[] = JSON.parse(removeImages);
      for (const publicId of toRemove) {
        await deleteImage(publicId);
      }
      existingImages = existingImages.filter((img) => !toRemove.includes(img.publicId));
    }

    // Upload new images
    const files = req.files as Express.Multer.File[];
    for (const file of files || []) {
      const result = await uploadImage(file.buffer, 'variete/productos');
      existingImages.push(result);
    }

    const newStock = stock !== undefined ? Number(stock) : product.stock;
    const updated = await prisma.product.update({
      where: { id: Number(req.params.id) },
      data: {
        name: name || product.name,
        description: description ?? product.description,
        categoryId: categoryId ? Number(categoryId) : product.categoryId,
        stock: newStock,
        price: price !== undefined ? Number(price) : product.price,
        images: existingImages,
        mainImageIndex: mainImageIndex !== undefined ? Number(mainImageIndex) : product.mainImageIndex,
        isActive: isActive !== undefined ? isActive === 'true' || isActive === true : newStock > 0,
      },
      include: { category: true },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar el producto.' });
  }
});

// Admin: quick stock update
router.patch('/:id/stock', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { stock } = req.body;
    const updated = await prisma.product.update({
      where: { id: Number(req.params.id) },
      data: { stock: Number(stock), isActive: Number(stock) > 0 },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar el stock.' });
  }
});

// Admin: delete product
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: Number(req.params.id) } });
    if (!product) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }
    const images = product.images as { url: string; publicId: string }[];
    for (const img of images) {
      await deleteImage(img.publicId);
    }
    await prisma.product.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Producto eliminado exitosamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar el producto.' });
  }
});

export default router;
