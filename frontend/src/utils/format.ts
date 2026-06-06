export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  });
}

export function formatDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function getCashbackTier(
  totalEarned: number,
  thresholds = { bronze: 1000, silver: 5000, gold: 15000 }
): { label: string; color: string; emoji: string; next?: string } {
  if (totalEarned >= thresholds.gold) return { label: 'Categoría Oro', color: 'text-yellow-400', emoji: '🥇' };
  if (totalEarned >= thresholds.silver) return {
    label: 'Categoría Plata', color: 'text-gray-300', emoji: '🥈',
    next: `$${(thresholds.gold - totalEarned).toFixed(0)} para Oro`,
  };
  if (totalEarned >= thresholds.bronze) return {
    label: 'Categoría Plata', color: 'text-gray-300', emoji: '🥈',
    next: `$${(thresholds.gold - totalEarned).toFixed(0)} para Oro`,
  };
  return {
    label: 'Categoría Bronce', color: 'text-amber-600', emoji: '🥉',
    next: `$${(thresholds.silver - totalEarned).toFixed(0)} para Plata`,
  };
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  PREPARING: 'En preparación',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: 'badge-gold',
  PREPARING: 'badge-blue',
  DELIVERED: 'badge-green',
  CANCELLED: 'badge-red',
};

export const CASHBACK_TYPE_LABELS: Record<string, string> = {
  GLOBAL: 'Beneficio global',
  MIN_AMOUNT: 'Por monto mínimo',
  DATE_RANGE: 'Por período',
  SPECIFIC_DATE: 'Por día especial',
  CATEGORY: 'Por categoría',
  PRODUCT: 'Por producto',
};

export const TIME_RANGE_OPTIONS = [
  { value: 'Mañana (8:00 - 13:00)', label: 'Mañana (8:00 - 13:00)' },
  { value: 'Tarde (13:00 - 18:00)', label: 'Tarde (13:00 - 18:00)' },
  { value: 'Sin preferencia horaria', label: 'Sin preferencia horaria' },
];
