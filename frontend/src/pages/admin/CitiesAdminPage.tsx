import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Trash2, ToggleLeft, ToggleRight, Calendar, Check } from 'lucide-react';
import ReactCalendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import api from '../../utils/api';
import { City } from '../../types';
import { formatDate } from '../../utils/format';
import toast from 'react-hot-toast';

type ValuePiece = Date | null;
type CalendarValue = ValuePiece | [ValuePiece, ValuePiece];

export default function CitiesAdminPage() {
  const qc = useQueryClient();
  const [newCity, setNewCity] = useState('');
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  const { data: cities = [], isLoading } = useQuery<City[]>({
    queryKey: ['cities-admin'],
    queryFn: () => api.get('/cities/admin/all').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/cities', { name: newCity }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cities-admin'] }); setNewCity(''); toast.success('Ciudad creada exitosamente.'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al crear la ciudad.'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/cities/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cities-admin'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cities/${id}`),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['cities-admin'] }); toast.success(res.data.message); },
    onError: () => toast.error('Error al eliminar la ciudad.'),
  });

  const datesMutation = useMutation({
    mutationFn: ({ id, dates }: { id: number; dates: string[] }) => api.put(`/cities/${id}/dates`, { dates }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cities-admin'] }); toast.success('Fechas de visita actualizadas exitosamente.'); },
    onError: () => toast.error('Error al actualizar las fechas.'),
  });

  const openCalendar = (city: City) => {
    setSelectedCity(city);
    const existing = city.visitDates?.map((d) => new Date(d.date)) || [];
    setSelectedDates(existing);
  };

  const handleDateClick = (value: CalendarValue) => {
    if (!value || Array.isArray(value)) return;
    const date = value as Date;
    const dateStr = date.toISOString().split('T')[0];
    setSelectedDates((prev) => {
      const exists = prev.some((d) => d.toISOString().split('T')[0] === dateStr);
      if (exists) return prev.filter((d) => d.toISOString().split('T')[0] !== dateStr);
      return [...prev, date];
    });
  };

  const saveDates = () => {
    if (!selectedCity) return;
    datesMutation.mutate({
      id: selectedCity.id,
      dates: selectedDates.map((d) => d.toISOString()),
    });
  };

  const isDateSelected = (date: Date) => {
    const ds = date.toISOString().split('T')[0];
    return selectedDates.some((d) => d.toISOString().split('T')[0] === ds);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="section-title">Gestión de ciudades</h1>
        <p className="text-dark-400 text-sm">Administre ciudades y fechas de entrega</p>
      </div>

      {/* New city */}
      <div className="card p-4 flex gap-3">
        <input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="Nombre de la nueva ciudad"
          onKeyDown={(e) => e.key === 'Enter' && newCity && createMutation.mutate()} />
        <button onClick={() => newCity && createMutation.mutate()} disabled={!newCity || createMutation.isPending} className="btn-primary flex-shrink-0">
          <Plus size={18} /> Agregar
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Cities list */}
        <div className="space-y-3">
          <h3 className="font-semibold text-dark-200">Ciudades registradas</h3>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-16 animate-pulse" />)}
            </div>
          ) : cities.length === 0 ? (
            <div className="card p-6 text-center text-dark-500">No hay ciudades registradas.</div>
          ) : (
            cities.map((city) => (
              <motion.div key={city.id} layout className={`card p-4 flex items-center justify-between ${selectedCity?.id === city.id ? 'border-gold-600/50' : ''}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-dark-100">{city.name}</span>
                    <span className={city.isActive ? 'badge-green' : 'badge-red'}>
                      {city.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <p className="text-xs text-dark-500 mt-0.5">
                    {(city as any)._count?.clients || 0} clientes · {city.visitDates?.length || 0} fechas programadas
                  </p>
                  {city.visitDates && city.visitDates.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {city.visitDates.slice(0, 3).map((d) => (
                        <span key={d.id} className="text-xs bg-dark-800 text-dark-400 px-2 py-0.5 rounded-full">
                          {formatDate(d.date)}
                        </span>
                      ))}
                      {city.visitDates.length > 3 && <span className="text-xs text-dark-500">+{city.visitDates.length - 3} más</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openCalendar(city)} className="p-2 hover:bg-dark-800 rounded-lg text-dark-400 hover:text-gold-400 transition-colors" title="Gestionar fechas">
                    <Calendar size={16} />
                  </button>
                  <button onClick={() => toggleMutation.mutate(city.id)} className="p-2 hover:bg-dark-800 rounded-lg text-dark-400 hover:text-dark-200 transition-colors">
                    {city.isActive ? <ToggleRight size={18} className="text-emerald-400" /> : <ToggleLeft size={18} />}
                  </button>
                  <button onClick={() => { if (window.confirm(`¿Eliminar "${city.name}"?`)) deleteMutation.mutate(city.id); }}
                    className="p-2 hover:bg-dark-800 rounded-lg text-dark-400 hover:text-red-400 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Calendar */}
        {selectedCity && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-dark-100 flex items-center gap-2">
                <Calendar size={16} className="text-gold-500" /> Fechas de entrega — {selectedCity.name}
              </h3>
              <button onClick={() => setSelectedCity(null)} className="p-1 hover:bg-dark-800 rounded text-dark-400">×</button>
            </div>
            <p className="text-xs text-dark-500">Haga clic en una fecha para seleccionarla o deseleccionarla. Las fechas resaltadas están activas.</p>
            <ReactCalendar
              onClickDay={handleDateClick}
              tileClassName={({ date }) => isDateSelected(date) ? 'react-calendar__tile--active' : ''}
              minDate={new Date()}
              locale="es-AR"
            />
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-dark-400">{selectedDates.length} fecha(s) seleccionada(s)</p>
              <button onClick={saveDates} disabled={datesMutation.isPending} className="btn-primary text-sm">
                <Check size={16} /> Confirmar fechas
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
