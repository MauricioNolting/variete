import { PrismaClient, CashbackRule, CashbackRuleType } from '@prisma/client';

const prisma = new PrismaClient();

interface CartItem {
  productId: number;
  categoryId: number;
  quantity: number;
  unitPrice: number;
}

export async function calculateCashback(
  items: CartItem[],
  orderTotal: number,
  orderDate: Date = new Date(),
  clientTier?: string
): Promise<{ percentage: number; amount: number; ruleDescription: string }> {
  const [rules, config] = await Promise.all([
    prisma.cashbackRule.findMany({ where: { isActive: true } }),
    prisma.globalCashbackConfig.findUnique({ where: { id: 1 } }),
  ]);

  // ── 1. Reglas ordinarias ──────────────────────────────────────────────────
  const applicableRules: { rule: CashbackRule; percentage: number }[] = [];

  for (const rule of rules) {
    let applies = false;
    switch (rule.type as CashbackRuleType) {
      case 'GLOBAL':
        applies = true;
        break;
      case 'MIN_AMOUNT':
        applies = rule.minAmount !== null && orderTotal >= rule.minAmount;
        break;
      case 'DATE_RANGE':
        // For DATE_RANGE, start/end dates define when the rule applies
        if (rule.startDate && rule.endDate) {
          applies = orderDate >= rule.startDate && orderDate <= rule.endDate;
        }
        break;
      case 'SPECIFIC_DATE': {
        const specificDates = rule.specificDates as string[] | null;
        if (specificDates?.length) {
          const orderDateStr = orderDate.toISOString().split('T')[0];
          applies = specificDates.some((d) => d.startsWith(orderDateStr));
        }
        break;
      }
      case 'CATEGORY':
        if (rule.categoryId) applies = items.some((i) => i.categoryId === rule.categoryId);
        break;
      case 'PRODUCT':
        if (rule.productId) applies = items.some((i) => i.productId === rule.productId);
        break;
    }

    // For non-DATE_RANGE rules: optionally restrict by validity window
    if (applies && rule.type !== 'DATE_RANGE') {
      if (rule.startDate && orderDate < rule.startDate) applies = false;
      if (rule.endDate   && orderDate > rule.endDate)   applies = false;
    }

    if (applies) applicableRules.push({ rule, percentage: rule.percentage });
  }

  let finalPercentage = 0;
  const descParts: string[] = [];

  if (applicableRules.length > 0) {
    if (config?.stackRules) {
      const rawPct = applicableRules.reduce((sum, r) => sum + r.percentage, 0);
      finalPercentage = config.maxPercentage ? Math.min(rawPct, config.maxPercentage) : rawPct;
      descParts.push(`Reglas acumuladas: ${applicableRules.map((r) => ruleTypeLabel(r.rule)).join(', ')}`);
    } else {
      const best = applicableRules.reduce((a, b) => (a.percentage >= b.percentage ? a : b));
      finalPercentage = best.percentage;
      descParts.push(ruleTypeLabel(best.rule));
    }
  }

  // ── 2. Beneficio extra por categoría de cliente (TierBenefit) ────────────
  if (clientTier) {
    const tierBenefits = await prisma.tierBenefit.findMany({
      where: { isActive: true, tier: clientTier.toUpperCase() },
      select: { percentage: true, title: true },
    });
    const tierPct = tierBenefits
      .filter((b) => b.percentage && b.percentage > 0)
      .reduce((sum, b) => sum + (b.percentage ?? 0), 0);

    if (tierPct > 0) {
      finalPercentage += tierPct;
      const tierLabel = clientTier === 'GOLD' ? 'Oro' : clientTier === 'SILVER' ? 'Plata' : 'Bronce';
      descParts.push(`Categoría ${tierLabel} (+${tierPct}%)`);
    }
  }

  if (finalPercentage === 0) {
    return { percentage: 0, amount: 0, ruleDescription: 'Sin regla aplicable' };
  }

  // ── 3. Tope global de porcentaje ─────────────────────────────────────────
  if (config?.maxPercentage) {
    finalPercentage = Math.min(finalPercentage, config.maxPercentage);
  }

  let amount = (orderTotal * finalPercentage) / 100;

  // ── 4. Tope de monto exacto ───────────────────────────────────────────────
  if (config?.maxAmount && amount > config.maxAmount) {
    amount = config.maxAmount;
  }

  return {
    percentage: finalPercentage,
    amount,
    ruleDescription: descParts.join(' + ') || 'Beneficio aplicado',
  };
}

function ruleTypeLabel(rule: CashbackRule): string {
  switch (rule.type as CashbackRuleType) {
    case 'GLOBAL':        return `Beneficio global (${rule.percentage}%)`;
    case 'MIN_AMOUNT':    return `Compra superior a $${rule.minAmount} (${rule.percentage}%)`;
    case 'DATE_RANGE':    return `Promoción por período (${rule.percentage}%)`;
    case 'SPECIFIC_DATE': return `Día especial (${rule.percentage}%)`;
    case 'CATEGORY':      return `Beneficio por categoría (${rule.percentage}%)`;
    case 'PRODUCT':       return `Beneficio por producto (${rule.percentage}%)`;
    default:              return `Beneficio (${rule.percentage}%)`;
  }
}
