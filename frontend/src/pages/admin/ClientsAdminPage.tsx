import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Users, Trash2, MinusCircle } from 'lucide-react';
import api from '../../utils/api';
import { Client } from '../../types';
import { formatCurrency, formatDate } from '../../utils/format';
import toast from 'react-hot-toast';

export default function ClientsAdminPage() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [deductData, setDeductData] = useState<{ id: number; amount: string; reason: string } | null>(null);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['admin-clients'],
    queryFn: () => api.get('/clients').then((r) => r.data),
  });

  const { data: clientDetail } = useQuery({
    queryKey: ['admin-client', expanded],
    queryFn: () => api.get(`/clients/${expanded}`).then((r) => r.data),
    enabled: !!expanded,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/clients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-clients'] });
      setExpanded(null);
      toast.success('Cliente eliminado exitosamente.');
    },
    onError: () => toast.error('Error al eliminar el cliente.'),
  });

  const deductMutation = useMutation({
    mutationFn: ({ id, amount, reason }: { id: number; amount: string; reason: string }) =>
      api.post(`/clients/${id}/adjust-cashback`, { amount: Number(amount), reason }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-clients'] });
      qc.invalidateQueries({ queryKey: ['admin-client', deductData?.id] });
      setDeductData(null);
      toast.success(res.data.message);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al ajustar el saldo.'),
  });

  const handleDelete = (client: Client) => {
    if (!window.confirm(`¿Eliminar al cliente "${client.localName}"? Esta acción no se puede deshacer.`)) return;
    deleteMutation.mutate(client.id);
  };

  const handleDeduct = () => {
    if (!deductData || !deductData.amount || Number(deductData.amount) <= 0) {
      toast.error('Ingrese un monto válido.');
      return;
    }
    deductMutation.mutate(deductData);
  };

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
          {clients.map((client) => (
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

                  {/* Deduct cashback */}
                  {client.cashbackBalance > 0 && (
                    <div className="border-t border-dark-800 pt-3">
                      <p className="text-xs text-dark-500 uppercase tracking-wide mb-2">Ajustar saldo de beneficios</p>
                      {deductData?.id === client.id ? (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="number"
                            placeholder={`Máx. ${formatCurrency(client.cashbackBalance)}`}
                            value={deductData.amount}
                            onChange={(e) => setDeductData({ ...deductData, amount: e.target.value })}
                            className="text-sm py-2 flex-1"
                            min="0.01"
                            max={client.cashbackBalance}
                            step="0.01"
                          />
                          <input
                            type="text"
                            placeholder="Motivo (ej: Deuda pendiente)"
                            value={deductData.reason}
                            onChange={(e) => setDeductData({ ...deductData, reason: e.target.value })}
                            className="text-sm py-2 flex-1"
                          />
                          <button onClick={handleDeduct} disabled={deductMutation.isPending}
                            className="btn-primary text-sm py-2 px-4">
                            {deductMutation.isPending ? 'Procesando...' : 'Confirmar'}
                          </button>
                          <button onClick={() => setDeductData(null)} className="btn-secondary text-sm py-2 px-3">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeductData({ id: client.id, amount: '', reason: '' })}
                          className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
                        >
                          <MinusCircle size={16} /> Descontar saldo de beneficios
                        </button>
                      )}
                    </div>
                  )}

                  {/* Delete client */}
                  <div className="border-t border-dark-800 pt-3 flex justify-end">
                    <button
                      onClick={() => handleDelete(client)}
                      disabled={deleteMutation.isPending}
                      className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 size={16} /> Eliminar cliente
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
