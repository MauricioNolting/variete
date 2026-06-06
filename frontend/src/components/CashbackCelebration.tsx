import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '../utils/format';

interface CashbackCelebrationProps {
  amount: number;
  onClose: () => void;
}

const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  delay: Math.random() * 0.4,
  size: Math.random() * 12 + 8,
  color: ['#d97706', '#f59e0b', '#fbbf24', '#10b981', '#34d399', '#ffffff'][Math.floor(Math.random() * 6)],
  rotation: Math.random() * 360,
}));

export default function CashbackCelebration({ amount, onClose }: CashbackCelebrationProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 500);
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
        >
          {/* Particles */}
          {PARTICLES.map((p) => (
            <motion.div
              key={p.id}
              initial={{ y: '60vh', x: `${p.x}vw`, opacity: 1, scale: 0, rotate: 0 }}
              animate={{
                y: [null, '-20vh', '-60vh'],
                opacity: [null, 1, 0],
                scale: [null, 1, 0.5],
                rotate: [null, p.rotation, p.rotation * 2],
              }}
              transition={{ duration: 1.8, delay: p.delay, ease: 'easeOut' }}
              className="absolute w-3 h-3 rounded-sm"
              style={{ backgroundColor: p.color, width: p.size, height: p.size }}
            />
          ))}

          {/* Coins */}
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={`coin-${i}`}
              initial={{ scale: 0, y: 0, x: (i - 4) * 40, opacity: 1 }}
              animate={{
                scale: [0, 1.5, 1],
                y: [0, -120 - Math.random() * 80, -200],
                opacity: [0, 1, 0],
              }}
              transition={{ duration: 1.4, delay: i * 0.08, ease: 'easeOut' }}
              className="absolute text-3xl"
            >
              💰
            </motion.div>
          ))}

          {/* Main card */}
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
            className="relative text-center px-10 py-10 rounded-3xl border-2 border-gold-500 shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d1500 100%)' }}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-3xl" style={{
              boxShadow: '0 0 60px rgba(217, 119, 6, 0.4), 0 0 120px rgba(217, 119, 6, 0.2)',
            }} />

            <motion.div
              animate={{ rotate: [0, -5, 5, -5, 5, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-6xl mb-4"
            >
              🎉
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-lg text-dark-300 font-medium mb-2"
            >
              ¡Beneficio acumulado!
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 10, delay: 0.6 }}
              className="text-5xl font-black text-gold-400 mb-4"
              style={{ textShadow: '0 0 30px rgba(217,119,6,0.8)' }}
            >
              {formatCurrency(amount)}
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="text-dark-400 text-sm"
            >
              disponibles para su próxima compra
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="text-dark-600 text-xs mt-4"
            >
              Toque para cerrar
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
