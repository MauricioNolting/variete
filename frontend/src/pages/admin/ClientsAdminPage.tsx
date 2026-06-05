import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';
import api from '../../utils/api';
import { Client } from '../../types';
import { formatCurrency, formatDate, getCashbackTier } from '../../utils/format';

export default function ClientsAdminPage() {
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['admin-clients'],
    queryFn: () => api.get('/clients').then((r) => r.data),
  });

  const { data: clientDetail } = useQuery({
    queryKey: ['admin-client', expanded],
    queryFn: () => api.get(`/clients/${expanded}`).then((r) => r.data),
    enabled: !!expanded,
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="section-title flex items-center gap-2">
          <Users size={22} className="text-gold-500" /> Clientes
        </h1>
        <p className="text-dark-400 text-sm">{clients.length} establecimientos registrados</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="card h-16 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((client) => {
            const tier = getCashbackTier(client.totalCashbackEarned);
            return (
              <motion.div key={client.id} layout className="card overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === client.id ? null : client.id)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-dark-800/40 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="min-w-0">
                      <p className="font-semibold text-dark-100 truncate">{client.localName}</p>
                      <p className="text-xs text-dark-500">{client.city?.name} · {client.phone}</p>
                    </div>
                    <span className={`text-xs font-medium hidden sm:block ${tier.color}`}>{tier.label}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-400">{formatCurrency(client.cashbackBalance)}</p>
                      <p className="text-xs text-dark-500">saldo disponible</p>
                    </div>
                    {expanded === client.id ? <ChevronUp size={16} className="text-dark-400" /> : <ChevronDown size={16} className="text-dark-400" />}
                  </div>
                </button>

                {expanded === client.id && clientDetail && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="border-t border-dark-800 p-4 space-y-4"
                  >
                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <p><span className="text-dark-500">Dirección:</span> <span className="text-dark-200">{client.address}</span></p>
                        <p><span className="text-dark-500">Email:</span> <span className="text-dark-200">{client.email || '—'}</span></p>
                        <p><span className="text-dark-500">Registrado:</span> <span className="text-dark-200">{formatDate(client.createdAt)}</span></p>
                      </div>
                      <div className="space-y-1">
                        <p><span className="text-dark-500">Saldo disponible:</span> <span className="text-emerald-400 font-semibold">{formatCurrency(client.cashbackBalance)}</span></p>
                        <p><span className="text-dark-500">Acumulado histórico:</span> <span className="text-dark-200">{formatCurrency(client.totalCashbackEarned)}</span></p>
                        <p><span className="text-dark-500">Total de pedidos:</span> <span className="text-dark-200">{clientDetail.orders?.length || 0}</span></p>
                      </div>
                    </div>

                    {clientDetail.orders?.length > 0 && (
                      <div>
                        <p className="text-xs text-dark-500 uppercase tracking-wide mb-2">Últimos pedidos</p>
                        <div className="space-y-1">
                          {clientDetail.orders.slice(0, 5).map((o: any) => (
                            <div key={o.id} className="flex justify-between text-sm">
                              <span className="text-dark-300">Pedido #{o.id} — {formatDate(o.createdAt)}</span>
                              <span className="text-dark-200">{formatCurrency(o.totalAmount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
