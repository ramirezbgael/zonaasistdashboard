import { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import './ClienteHistorialModal.css';

export default function ClienteHistorialModal({ cliente, onClose }) {
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (cliente?.id) {
      fetchHistorial();
    }
  }, [cliente?.id]);

  const fetchHistorial = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener todos los equipos del cliente con su estado
      // El proceso se obtiene a través de estado_equipos, no directamente desde equipos
      const { data, error: equiposError } = await supabase
        .from('equipos')
        .select(`
          id,
          marca,
          modelo,
          color,
          nota,
          problema,
          created_at,
          estado_equipos (
            estado,
            updated_at,
            proceso_actual_id,
            procesos (
              id,
              nombre
            )
          )
        `)
        .eq('cliente_id', cliente.id)
        .order('created_at', { ascending: false });

      if (equiposError) {
        console.error('Error en consulta de equipos:', equiposError);
        throw equiposError;
      }

      setEquipos(data || []);
    } catch (err) {
      console.error('Error fetching historial:', err);
      setError(`Error al cargar el historial: ${err.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getEstadoBadgeClass = (estado) => {
    switch (estado) {
      case 'pendiente':
        return 'badge-pendiente';
      case 'en_proceso':
        return 'badge-proceso';
      case 'listo':
        return 'badge-listo';
      case 'finalizado':
        return 'badge-finalizado';
      default:
        return 'badge-default';
    }
  };

  const getEstadoLabel = (estado) => {
    switch (estado) {
      case 'pendiente':
        return 'Pendiente';
      case 'en_proceso':
        return 'En Proceso';
      case 'listo':
        return 'Listo';
      case 'finalizado':
        return 'Finalizado';
      default:
        return estado || 'Sin estado';
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="cliente-historial-overlay" onClick={handleOverlayClick}>
      <div className="cliente-historial-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cliente-historial-header">
          <div className="cliente-historial-header-info">
            <h2>Historial de Servicios</h2>
            <p className="cliente-historial-subtitle">{cliente?.nombre}</p>
          </div>
          <button className="cliente-historial-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="cliente-historial-content">
          {loading ? (
            <div className="cliente-historial-loading">
              <div className="loading-spinner"></div>
              <p>Cargando historial...</p>
            </div>
          ) : error ? (
            <div className="cliente-historial-error">
              <Icon name="exclamation-triangle" />
              <p>{error}</p>
            </div>
          ) : equipos.length === 0 ? (
            <div className="cliente-historial-empty">
              <Icon name="folder-open" />
              <h3>No hay servicios registrados</h3>
              <p>Este cliente aún no tiene equipos o servicios registrados</p>
            </div>
          ) : (
            <div className="cliente-historial-list">
              {equipos.map((equipo) => {
                const estadoEquipo = equipo.estado_equipos?.[0];
                const estado = estadoEquipo?.estado || 'pendiente';
                const fechaEstado = estadoEquipo?.updated_at || equipo.created_at;
                const proceso = estadoEquipo?.procesos;

                return (
                  <div key={equipo.id} className="historial-item">
                    <div className="historial-item-header">
                      <div className="historial-item-main">
                        <div className="historial-item-title">
                          <h3>
                            {equipo.marca} {equipo.modelo}
                          </h3>
                          {equipo.nota && (
                            <span className="historial-item-nota">#{equipo.nota}</span>
                          )}
                        </div>
                        {equipo.color && (
                          <div className="historial-item-color">
                            <span
                              className="color-dot"
                              style={{
                                backgroundColor: equipo.color || '#10b981',
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                display: 'inline-block',
                                marginRight: '0.5rem'
                              }}
                            />
                            <span>{equipo.color}</span>
                          </div>
                        )}
                      </div>
                      <span className={`historial-estado-badge ${getEstadoBadgeClass(estado)}`}>
                        {getEstadoLabel(estado)}
                      </span>
                    </div>

                    {equipo.problema && (
                      <div className="historial-item-problema">
                        <Icon name="exclamation-circle" />
                        <span>{equipo.problema}</span>
                      </div>
                    )}

                    {proceso && (
                      <div className="historial-item-proceso">
                        <Icon name="cog" />
                        <span>{proceso.nombre}</span>
                      </div>
                    )}

                    <div className="historial-item-footer">
                      <div className="historial-item-date">
                        <Icon name="calendar" />
                        <span>Recibido: {formatDate(equipo.created_at)}</span>
                      </div>
                      {fechaEstado && fechaEstado !== equipo.created_at && (
                        <div className="historial-item-date">
                          <Icon name="clock" />
                          <span>Última actualización: {formatDate(fechaEstado)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="cliente-historial-footer">
          <div className="cliente-historial-stats">
            <span>
              <strong>{equipos.length}</strong> {equipos.length === 1 ? 'servicio' : 'servicios'} registrado{equipos.length === 1 ? '' : 's'}
            </span>
          </div>
          <button className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

