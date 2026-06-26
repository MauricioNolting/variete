import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface Lot {
  amount: number;
  expiresAt: Date | null;
}

export interface ExpiryResult {
  balance: number;       // saldo real disponible tras procesar vencimientos
  liveLots: Lot[];       // lotes vivos (no vencidos), con saldo > 0
  expiredNow: number;    // monto recién vencido en esta corrida
}

/**
 * Procesa el vencimiento del saldo de un cliente de forma perezosa e idempotente.
 *
 * Reconstruye el estado de los lotes reproduciendo TODAS las transacciones en orden
 * cronológico (EARNED suma un lote; USED y EXPIRED consumen, empezando por el lote
 * que vence antes). Luego, los lotes que quedaron vivos pero ya pasaron su fecha de
 * vencimiento se registran como una transacción EXPIRED y se descuentan del saldo.
 *
 * Todo corre dentro de una transacción con un advisory lock por cliente, de modo que
 * dos llamadas concurrentes no puedan vencer el mismo saldo dos veces.
 */
export async function processClientCashbackExpiry(clientId: number): Promise<ExpiryResult> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // Serializar el procesamiento de vencimientos por cliente (evita duplicados por concurrencia)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${clientId})`;

    const client = await tx.client.findUnique({
      where: { id: clientId },
      select: { cashbackBalance: true },
    });
    const txns = await tx.cashbackTransaction.findMany({
      where: { clientId },
      orderBy: { createdAt: 'asc' },
    });

    const initialBalance = client?.cashbackBalance ?? 0;

    // ── Reproducir transacciones para reconstruir los lotes ────────────────
    const lots: Lot[] = [];

    const consume = (amount: number) => {
      let remaining = amount;
      const ordered = lots
        .filter((l) => l.amount > 0.0000001)
        .sort((a, b) => {
          if (a.expiresAt && b.expiresAt) return a.expiresAt.getTime() - b.expiresAt.getTime();
          if (a.expiresAt) return -1;
          if (b.expiresAt) return 1;
          return 0;
        });
      for (const lot of ordered) {
        if (remaining <= 0.0000001) break;
        const take = Math.min(lot.amount, remaining);
        lot.amount -= take;
        remaining -= take;
      }
    };

    for (const t of txns) {
      if (t.type === 'EARNED') {
        lots.push({ amount: t.amount, expiresAt: t.expiresAt });
      } else {
        // USED y EXPIRED consumen saldo
        consume(t.amount);
      }
    }

    // ── Detectar lotes vencidos aún no registrados ─────────────────────────
    const expiredByDate: Record<string, number> = {};
    let expiredNow = 0;
    for (const lot of lots) {
      if (lot.amount > 0.001 && lot.expiresAt && lot.expiresAt <= now) {
        const key = lot.expiresAt.toISOString().split('T')[0];
        expiredByDate[key] = (expiredByDate[key] || 0) + lot.amount;
        expiredNow += lot.amount;
      }
    }

    // ── Registrar el vencimiento y descontar del saldo ─────────────────────
    if (expiredNow > 0.001) {
      for (const [key, amount] of Object.entries(expiredByDate)) {
        const d = new Date(key);
        await tx.cashbackTransaction.create({
          data: {
            clientId,
            amount,
            type: 'EXPIRED',
            ruleDescription: `Saldo vencido el ${d.toLocaleDateString('es-AR')}`,
          },
        });
      }
      await tx.client.update({
        where: { id: clientId },
        data: { cashbackBalance: Math.max(0, initialBalance - expiredNow) },
      });
    }

    // Lotes vivos restantes (no vencidos) con saldo
    const liveLots = lots.filter(
      (l) => l.amount > 0.001 && (!l.expiresAt || l.expiresAt > now)
    );

    return {
      balance: Math.max(0, initialBalance - expiredNow),
      liveLots,
      expiredNow,
    };
  });
}
