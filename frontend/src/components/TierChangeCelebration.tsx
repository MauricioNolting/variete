import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Sparkles } from 'lucide-react';

type TierName = 'BRONZE' | 'SILVER' | 'GOLD';

interface Props {
  change?: 'UP' | 'DOWN' | null;
  tier?: TierName;
  previousTier?: TierName | null;
}

const TIER_META: Record<TierName, { label: string; emoji: string; color: string }> = {
  GOLD:   { label: 'Oro',    emoji: '🥇', color: 'text-yellow-400' },
  SILVER: { label: 'Plata',  emoji: '🥈', color: 'text-gray-300' },
  BRONZE: { label: 'Bronce', emoji: '🥉', color: 'text-amber-600' },
};

// Guard de módulo: el cartel se muestra una sola vez por sesión y por transición concreta
let shownKey: string | null = null;

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  delay: Math.random() * 0.5,
  size: Math.random() * 12 + 8,
  color: ['#d97706', '#f59e0b', '#fbbf24', '#10b981', '#34d399', '#ffffff'][Math.floor(Math.random() * 6)],
  rotation: Math.random() * 360,
}));

export default function TierChangeCelebration({ change, tier, previousTier }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!change || !tier) return;
    const key = `${previousTier ?? '?'}->${tier}`;
    if (shownKey === key) return; // ya se mostró esta transición en la sesión
    shownKey = key;
    setVisible(true);
  }, [change, tier, previousTier]);

  if (!change || !tier) return null;

  const meta = TIER_META[tier];
  const prevMeta = previousTier ? TIER_META[previousTier] : null;
  const isUp = change === 'UP';

  const close = () => setVisible(false);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={close}
        >
          {/* Confetti solo en ascenso */}
          {isUp && PARTICLES.map((p) => (
            <motion.div
              key={p.id}
              initial={{ y: '60vh', x: `${p.x}vw`, opacity: 1, scale: 0, rotate: 0 }}
              animate={{
                y: [null, '-20vh', '-60vh'],
                opacity: [null, 1, 0],
                scale: [null, 1, 0.5],
                rotate: [null, p.rotation, p.rotation * 2],
              }}
              transition={{ duration: 1.9, delay: p.delay, ease: 'easeOut' }}
              className="absolute rounded-sm"
              style={{ backgroundColor: p.color, width: p.size, height: p.size }}
            />
          ))}

          {/* Tarjeta principal */}
          <motion.div
            initial={{ scale: 0, rotate: isUp ? -8 : 0, y: isUp ? 0 : 20 }}
            animate={{ scale: 1, rotate: 0, y: 0 }}
            transition={{ type: 'spring', damping: 13, stiffness: 200, delay: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative text-center px-8 py-9 rounded-3xl border-2 shadow-2xl max-w-sm w-full ${
              isUp ? 'border-gold-500' : 'border-dark-600'
            }`}
            style={{
              background: isUp
                ? 'linear-gradient(135deg, #1a1a1a 0%, #2d1500 100%)'
                : 'linear-gradient(135deg, #161616 0%, #1d1d1f 100%)',
            }}
          >
            {isUp && (
              <div className="absolute inset-0 rounded-3xl pointer-events-none" style={{
                boxShadow: '0 0 60px rgba(217, 119, 6, 0.4), 0 0 120px rgba(217, 119, 6, 0.2)',
              }} />
            )}

            {/* Emoji / icono */}
            <motion.div
              animate={isUp ? { rotate: [0, -6, 6, -6, 6, 0], scale: [1, 1.15, 1] } : { scale: [1, 1.08, 1] }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="text-6xl mb-3"
            >
              {meta.emoji}
            </motion.div>

            {/* Encabezado */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={`inline-flex items-center gap-1.5 text-sm font-semibold mb-1 ${
                isUp ? 'text-gold-400' : 'text-dark-300'
              }`}
            >
              {isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {isUp ? '¡Felicitaciones!' : 'Tu categoría cambió'}
            </motion.div>

            {/* Título */}
            <motion.h2
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 11, delay: 0.6 }}
              className="text-2xl font-black text-dark-50 mb-3"
            >
              {isUp ? 'Ascendiste a' : 'Pasaste a'}{' '}
              <span className={meta.color}>Categoría {meta.label}</span>
            </motion.h2>

            {/* Mensaje (chamullo) */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85 }}
              className="text-sm text-dark-300 leading-relaxed mb-6"
            >
              {isUp ? (
                <>
                  Tu fidelidad tiene premio: ahora sos cliente{' '}
                  <span className={`font-semibold ${meta.color}`}>{meta.label}</span> y desbloqueás
                  mejores beneficios, más cashback y ventajas exclusivas en cada compra.
                  {' '}¡Gracias por seguir eligiéndonos! ✨
                </>
              ) : (
                <>
                  Seguís disfrutando de beneficios como cliente{' '}
                  <span className={`font-semibold ${meta.color}`}>{meta.label}</span>.
                  {prevMeta && (
                    <>
                      {' '}Y estás a unas pocas compras de recuperar tu{' '}
                      <span className={`font-semibold ${prevMeta.color}`}>Categoría {prevMeta.label}</span>{' '}
                      y volver a acceder a mayores ahorros y ventajas.
                    </>
                  )}
                  {' '}¡Te esperamos de vuelta arriba! 💪
                </>
              )}
            </motion.p>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
              onClick={close}
              className={isUp ? 'btn-primary w-full' : 'btn-secondary w-full'}
            >
              {isUp ? <><Sparkles size={16} /> ¡Genial!</> : 'Entendido'}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
