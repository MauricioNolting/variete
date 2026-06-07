/**
 * Sistema de categorías de clientes — Varieté
 *
 * Ciclo para ORO:
 *   - Tu tier en el período N = calculado a partir del gasto del período N-1.
 *   - Si en el período N te corresponde ORO, al inicio de ese período tenés
 *     una ventana de gracia (configurable, ej. 14 días).
 *   - Si durante esa ventana hacés una compra ≥ X% del total del período N-1,
 *     el ORO queda "bloqueado" hasta el final del período N+1.
 *   - En el período N+2 se recalcula desde cero con el gasto del período N+1.
 *
 * Ciclo para PLATA / BRONCE:
 *   - Sin período de gracia. Cada período tu tier = lo que ganaste el período anterior.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type TierName = 'BRONZE' | 'SILVER' | 'GOLD';

export interface TierResult {
  tier: TierName;
  label: string;
  emoji: string;
  color: string;
  periodSpending: number;
  periodStart: Date;
  periodEnd: Date;
  nextEvalDate: Date;
  inGracePeriod: boolean;
  gracePeriodEnd?: Date;
  graceRetained: boolean;
  graceSpending?: number;
  graceThreshold?: number;
  tierValidUntil?: Date;
  message?: string;
}

function getTierBySpending(
  spending: number,
  thresholds: { bronze: number; silver: number; gold: number }
): TierName {
  if (spending >= thresholds.gold) return 'GOLD';
  if (spending >= thresholds.silver) return 'SILVER';
  return 'BRONZE';
}

function getTierMeta(tier: TierName): { label: string; emoji: string; color: string } {
  switch (tier) {
    case 'GOLD':   return { label: 'Categoría Oro',   emoji: '🥇', color: 'text-yellow-400' };
    case 'SILVER': return { label: 'Categoría Plata', emoji: '🥈', color: 'text-gray-300' };
    default:       return { label: 'Categoría Bronce',emoji: '🥉', color: 'text-amber-600' };
  }
}

function getPeriodBoundaries(date: Date, periodType: string) {
  if (periodType === 'QUARTERLY') {
    const q = Math.floor(date.getMonth() / 3);
    const start = new Date(date.getFullYear(), q * 3, 1);
    const end   = new Date(date.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
    const prevStart = new Date(date.getFullYear(), q * 3 - 3, 1);
    const prevEnd   = new Date(date.getFullYear(), q * 3, 0, 23, 59, 59);
    const nextEnd   = new Date(date.getFullYear(), q * 3 + 6, 0, 23, 59, 59);
    return { start, end, prevStart, prevEnd, nextEnd };
  }
  // MONTHLY
  const start     = new Date(date.getFullYear(), date.getMonth(), 1);
  const end       = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
  const prevStart = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const prevEnd   = new Date(date.getFullYear(), date.getMonth(), 0, 23, 59, 59);
  const nextEnd   = new Date(date.getFullYear(), date.getMonth() + 2, 0, 23, 59, 59);
  return { start, end, prevStart, prevEnd, nextEnd };
}

async function getSpend(clientId: number, from: Date, to: Date): Promise<number> {
  const orders = await prisma.order.findMany({
    where: { clientId, createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
    select: { totalAmount: true },
  });
  return orders.reduce((s, o) => s + o.totalAmount, 0);
}

export async function calculateClientTier(clientId: number): Promise<TierResult> {
  const now = new Date();

  const [config, client] = await Promise.all([
    prisma.globalConfig.findUnique({ where: { id: 1 } }),
    prisma.client.findUnique({ where: { id: clientId } }),
  ]);

  if (!client) throw new Error('Cliente no encontrado');

  const thresholds = {
    bronze: config?.bronzeThreshold ?? 1000,
    silver: config?.silverThreshold ?? 5000,
    gold:   config?.goldThreshold   ?? 15000,
  };
  const periodType     = config?.tierPeriodType        ?? 'MONTHLY';
  const graceDays      = config?.tierGracePeriodDays   ?? 14;
  const graceRetainPct = config?.tierGraceRetainPercent ?? 20;

  const { start: curStart, end: curEnd, prevStart, prevEnd, nextEnd } =
    getPeriodBoundaries(now, periodType);

  // ── 1. GOLD BLOQUEADO VÍA GRACIA ANTERIOR ──────────────────────────────────
  const tierValidUntil = (client as any).tierValidUntil
    ? new Date((client as any).tierValidUntil)
    : null;

  if (tierValidUntil && now <= tierValidUntil) {
    const meta = getTierMeta('GOLD');
    return {
      tier: 'GOLD',
      ...meta,
      periodSpending: 0,
      periodStart:    curStart,
      periodEnd:      curEnd,
      nextEvalDate:   new Date(tierValidUntil.getTime() + 86400000),
      inGracePeriod:  false,
      graceRetained:  true,
      tierValidUntil,
      message: `Categoría Oro asegurada hasta el ${tierValidUntil.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}.`,
    };
  }

  // ── 2. CÁLCULO NORMAL ──────────────────────────────────────────────────────
  const prevSpending = await getSpend(clientId, prevStart, prevEnd);
  const earnedTier   = getTierBySpending(prevSpending, thresholds);

  const gracePeriodEnd = new Date(curStart);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + graceDays);
  const inGracePeriod = now <= gracePeriodEnd;

  let finalTier      = earnedTier;
  let graceRetained  = false;
  let graceSpending  = 0;
  let graceThreshold = 0;

  if (inGracePeriod && earnedTier === 'GOLD') {
    // El cliente GANÓ oro este período — verificar si quiere extenderlo al siguiente
    graceSpending  = await getSpend(clientId, curStart, now);
    graceThreshold = prevSpending * (graceRetainPct / 100);

    if (graceSpending >= graceThreshold) {
      // Asegurar oro hasta el fin del PRÓXIMO período completo
      await prisma.client.update({
        where: { id: clientId },
        data: { tierValidUntil: nextEnd } as any,
      }).catch(() => {});
      finalTier     = 'GOLD';
      graceRetained = true;
    }
  }

  // ── 3. MENSAJES INFORMATIVOS ──────────────────────────────────────────────
  let message: string | undefined;
  const periodLabel = periodType === 'QUARTERLY' ? 'trimestre' : 'mes';

  if (inGracePeriod && earnedTier === 'GOLD') {
    if (graceRetained) {
      message = `¡Categoría Oro asegurada para el próximo ${periodLabel} también!`;
    } else {
      const daysLeft = Math.max(
        1,
        Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / 86400000)
      );
      const needed = graceThreshold - graceSpending;
      message = `Tiene ${daysLeft} día(s) para realizar una compra de ${formatCurrency(needed)} y extender su Oro al próximo ${periodLabel}.`;
    }
  } else if (earnedTier !== 'BRONZE') {
    message = `Su categoría se recalculará al inicio del próximo ${periodLabel}.`;
  }

  const meta = getTierMeta(finalTier);
  const nextEvalDate = new Date(curEnd);
  nextEvalDate.setDate(nextEvalDate.getDate() + 1);

  return {
    tier: finalTier,
    ...meta,
    periodSpending: prevSpending,
    periodStart:    prevStart,
    periodEnd:      prevEnd,
    nextEvalDate,
    inGracePeriod:  inGracePeriod && earnedTier === 'GOLD',
    gracePeriodEnd: (inGracePeriod && earnedTier === 'GOLD') ? gracePeriodEnd : undefined,
    graceRetained,
    graceSpending:  (inGracePeriod && earnedTier === 'GOLD') ? graceSpending : undefined,
    graceThreshold: (inGracePeriod && earnedTier === 'GOLD') ? graceThreshold : undefined,
    message,
  };
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
}
