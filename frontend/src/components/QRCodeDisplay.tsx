import { useState } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Download, X } from 'lucide-react';

const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://variete-charata.netlify.app';

export default function QRCodeDisplay() {
  const [open, setOpen] = useState(false);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(SITE_URL)}&bgcolor=1a1a1a&color=d97706&format=svg`;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(SITE_URL)}&bgcolor=1a1a1a&color=d97706&format=png`;
    a.download = 'variete-qr.png';
    a.click();
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary gap-2 text-sm">
        <QrCode size={16} /> Código QR del sitio
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-dark-950/90 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="card p-8 flex flex-col items-center gap-5 max-w-sm w-full mx-4"
          >
            <div className="flex items-center justify-between w-full">
              <h3 className="font-bold text-dark-100 flex items-center gap-2">
                <QrCode size={18} className="text-gold-500" /> Código QR — Varieté
              </h3>
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-dark-800 rounded-lg text-dark-400">
                <X size={18} />
              </button>
            </div>

            <div className="bg-dark-800 rounded-2xl p-4 border border-dark-700">
              <img src={qrUrl} alt="QR Varieté" className="w-64 h-64 rounded-xl" />
            </div>

            <p className="text-sm text-dark-400 text-center">
              Compartí este código para que tus clientes accedan directo al catálogo
            </p>
            <p className="text-xs text-dark-600 font-mono">{SITE_URL}</p>

            <button onClick={handleDownload} className="btn-primary w-full">
              <Download size={16} /> Descargar QR en alta resolución
            </button>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
