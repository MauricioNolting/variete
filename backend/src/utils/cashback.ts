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
  orderDate: Date = new Date()
): Promise<{ percentage: number; amount: number; ruleDescription: string }> {
  const rules = await prisma.cashbackRule.findMany({ where: { isActive: true } });
  const config = await prisma.globalCashbackConfig.findUnique({ where: { id: 1 } });

  if (!rules.length) return { percentage: 0, amount: 0, ruleDescription: 'Sin regla activa' };

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
        if (rule.categoryId) {
          applies = items.some((item) => item.categoryId === rule.categoryId);
        }
        break;

      case 'PRODUCT':
        if (rule.productId) {
          applies = items.some((item) => item.productId === rule.productId);
        }
        break;
    }

    if (applies) {
      applicableRules.push({ rule, percentage: rule.percentage });
    }
  }

  if (!applicableRules.length) return { percentage: 0, amount: 0, ruleDescription: 'Sin regla aplicable' };

  let finalPercentage: number;
  let ruleDescription: string;

  if (config?.stackRules) {
    finalPercentage = applicableRules.reduce((sum, r) => sum + r.percentage, 0);
    if (config.maxPercentage) {
      finalPercentage = Math.min(finalPercentage, config.maxPercentage);
    }
    ruleDescription = `Reglas acumuladas: ${applicableRules.map((r) => ruleTypeLabel(r.rule)).join(', ')}`;
  } else {
    const best = applicableRules.reduce((a, b) => (a.percentage >= b.percentage ? a : b));
    finalPercentage = best.percentage;
    ruleDescription = ruleTypeLabel(best.rule);
  }

  let amount = (orderTotal * finalPercentage) / 100;

  // Aplicar tope de monto exacto si está configurado
  if (config?.maxAmount && amount > config.maxAmount) {
    amount = config.maxAmount;
  }

  return { percentage: finalPercentage, amount, ruleDescription };
}

function ruleTypeLabel(rule: CashbackRule): string {
  switch (rule.type as CashbackRuleType) {
    case 'GLOBAL': return `Beneficio global (${rule.percentage}%)`;
    case 'MIN_AMOUNT': return `Compra superior a $${rule.minAmount} (${rule.percentage}%)`;
    case 'DATE_RANGE': return `Promoción por período (${rule.percentage}%)`;
    case 'SPECIFIC_DATE': return `Día especial (${rule.percentage}%)`;
    case 'CATEGORY': return `Beneficio por categoría (${rule.percentage}%)`;
    case 'PRODUCT': return `Beneficio por producto (${rule.percentage}%)`;
    default: return `Beneficio (${rule.percentage}%)`;
  }
}
