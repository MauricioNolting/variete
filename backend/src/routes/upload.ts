import { Router, Response } from 'express';
import multer from 'multer';
import { authenticateToken, requireAdmin, AuthRequest } from '../middlewares/auth';
import { uploadImage, deleteImage } from '../utils/cloudinary';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Upload image to Cloudinary
router.post('/', authenticateToken, requireAdmin, upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No se proporcionó ningún archivo.' });
      return;
    }
    const folder = req.body.folder || 'variete/general';
    const result = await uploadImage(req.file.buffer, folder);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Error al subir la imagen.' });
  }
});

// Delete image from Cloudinary
router.delete('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { publicId } = req.body;
    if (!publicId) {
      res.status(400).json({ error: 'Se requiere el ID público de la imagen.' });
      return;
    }
    await deleteImage(publicId);
    res.json({ message: 'Imagen eliminada exitosamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar la imagen.' });
  }
});

export default router;
