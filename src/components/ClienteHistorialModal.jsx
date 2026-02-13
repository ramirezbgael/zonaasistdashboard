import { useState, useEffect, useTransition, memo } from 'react';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import './ClienteHistorialModal.css';

const HistorialItem = memo(function HistorialItem({ equipo, formatDate, getEstadoBadgeClass, getEstadoLabel }) {
  const estadoEquipo = equipo.estado_equipos?.[0];
  const estado = estadoEquipo?.estado || 'pendiente';
  const fechaEstado = estadoEquipo?.updated_at || equipo.created_at;
  const proceso = estadoEquipo?.procesos;

  return (
    <div className="historial-item">
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
});

export default function ClienteHistorialModal({ cliente, onClose }) {
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saldoCuenta, setSaldoCuenta] = useState(0);
  const [loadingSaldo, setLoadingSaldo] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [showCuentaModal, setShowCuentaModal] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState('deposito'); // 'deposito' | 'cargo'
  const [montoMovimiento, setMontoMovimiento] = useState('');
  const [notaMovimiento, setNotaMovimiento] = useState('');
  const [procesandoMovimiento, setProcesandoMovimiento] = useState(false);

  useEffect(() => {
    if (!cliente?.id) return;
    // Saldo primero (consulta ligera) - UI usable de inmediato
    fetchSaldo();
    // Historial diferido para no bloquear el primer paint del modal
    const id = requestAnimationFrame(() => {
      fetchHistorial();
    });
    return () => cancelAnimationFrame(id);
  }, [cliente?.id]);

  const fetchHistorial = async () => {
    if (!cliente?.id) return;
    try {
      setLoading(true);
      setError(null);

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
        .order('created_at', { ascending: false })
        .limit(100);

      if (equiposError) throw equiposError;
      startTransition(() => {
        setEquipos(data || []);
        setLoading(false);
      });
    } catch (err) {
      console.error('Error fetching historial:', err);
      setError(`Error al cargar el historial: ${err.message || 'Error desconocido'}`);
      setLoading(false);
    }
  };

  const fetchSaldo = async () => {
    if (!cliente?.id) return;
    try {
      setLoadingSaldo(true);
      const { data, error } = await supabase
        .from('clientes')
        .select('cuenta_saldo')
        .eq('id', cliente.id)
        .maybeSingle();

      if (error) {
        console.error('Error obteniendo saldo de cliente:', error);
        return;
      }

      setSaldoCuenta(parseFloat(data?.cuenta_saldo || 0));
    } catch (err) {
      console.error('Error en fetchSaldo:', err);
    } finally {
      setLoadingSaldo(false);
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

  const abrirCuentaModal = (tipo) => {
    setTipoMovimiento(tipo);
    setMontoMovimiento('');
    setNotaMovimiento('');
    setShowCuentaModal(true);
  };

  const guardarMovimientoCuenta = async () => {
    const monto = parseFloat(montoMovimiento);
    if (!monto || monto <= 0) {
      alert('Ingresa un monto válido.');
      return;
    }

    const esDeposito = tipoMovimiento === 'deposito';
    const delta = esDeposito ? monto : -monto;
    const nuevoSaldo = (saldoCuenta || 0) + delta;

    if (!esDeposito && nuevoSaldo < 0) {
      alert('El cliente no tiene saldo suficiente en su cuenta.');
      return;
    }

    setProcesandoMovimiento(true);

    try {
      // Registrar movimiento en historial de cuenta (si la tabla existe)
      try {
        const { error: movError } = await supabase
          .from('cliente_cuentas_movimientos')
          .insert({
            cliente_id: cliente.id,
            tipo: esDeposito ? 'deposito' : 'cargo',
            monto,
            saldo_despues: nuevoSaldo,
            descripcion: notaMovimiento?.trim() || null
          });

        if (movError) {
          // Si la tabla no existe o hay otro problema, solo lo registramos en consola
          console.error('Error registrando movimiento de cuenta (no crítico):', movError);
        }
      } catch (innerErr) {
        console.error('Error inesperado registrando movimiento de cuenta:', innerErr);
      }

      // Actualizar saldo en clientes
      const { error: updError } = await supabase
        .from('clientes')
        .update({ cuenta_saldo: nuevoSaldo })
        .eq('id', cliente.id);

      if (updError) {
        throw updError;
      }

      setSaldoCuenta(nuevoSaldo);
      setShowCuentaModal(false);
      setMontoMovimiento('');
      setNotaMovimiento('');
    } catch (err) {
      console.error('Error actualizando saldo de cuenta:', err);
      alert('Error al actualizar la cuenta del cliente. Intenta de nuevo.');
    } finally {
      setProcesandoMovimiento(false);
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
          {/* Sección Cuenta: visible de inmediato, no bloqueada por historial */}
          <div className="cuenta-section">
            <div className="cuenta-section-header">
              <span className="cuenta-label">Saldo en cuenta</span>
              <span className={`cuenta-saldo ${loadingSaldo ? '' : saldoCuenta > 0 ? 'saldo-positivo' : saldoCuenta < 0 ? 'saldo-negativo' : 'saldo-cero'}`}>
                {loadingSaldo ? 'Cargando...' : `$${(saldoCuenta || 0).toFixed(2)}`}
              </span>
            </div>
            <div className="cuenta-buttons">
              <button
                className="btn-cuenta btn-cuenta-deposito"
                onClick={() => abrirCuentaModal('deposito')}
              >
                <Icon name="plus-circle" /> Agregar a cuenta
              </button>
              <button
                className="btn-cuenta btn-cuenta-cargo"
                onClick={() => abrirCuentaModal('cargo')}
              >
                <Icon name="minus-circle" /> Descontar de cuenta
              </button>
            </div>
          </div>

          {/* Historial: carga en segundo plano */}
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
            <div className={`cliente-historial-list ${isPending ? 'historial-updating' : ''}`}>
              {equipos.map((equipo) => (
                <HistorialItem
                  key={equipo.id}
                  equipo={equipo}
                  formatDate={formatDate}
                  getEstadoBadgeClass={getEstadoBadgeClass}
                  getEstadoLabel={getEstadoLabel}
                />
              ))}
            </div>
          )}
        </div>

        <div className="cliente-historial-footer">
          <div className="cliente-historial-stats">
            {loading ? (
              <span>Cargando historial...</span>
            ) : (
              <span>
                <strong>{equipos.length}</strong> {equipos.length === 1 ? 'servicio' : 'servicios'} registrado{equipos.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <button className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>

      {/* Modal para movimientos de cuenta */}
      {showCuentaModal && (
        <div className="cliente-historial-overlay cuenta-modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget && !procesandoMovimiento) {
            setShowCuentaModal(false);
          }
        }}>
          <div className={`cliente-historial-modal cuenta-movimiento-modal cuenta-movimiento-${tipoMovimiento}`} onClick={(e) => e.stopPropagation()}>
            <div className="cliente-historial-header">
              <div className="cliente-historial-header-info">
                <h2>
                  {tipoMovimiento === 'deposito' ? 'Agregar a cuenta' : 'Descontar de cuenta'}
                </h2>
                <p className="cliente-historial-subtitle">{cliente?.nombre}</p>
              </div>
              <button
                className="cliente-historial-close-btn"
                onClick={() => {
                  if (!procesandoMovimiento) {
                    setShowCuentaModal(false);
                  }
                }}
              >
                ×
              </button>
            </div>
            <div className="cliente-historial-content">
              <div className="cuenta-movimiento-saldo">
                Saldo actual:{' '}
                <strong className={saldoCuenta > 0 ? 'saldo-positivo' : saldoCuenta < 0 ? 'saldo-negativo' : 'saldo-cero'}>
                  ${(saldoCuenta || 0).toFixed(2)}
                </strong>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  Monto
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="typeform-large-input"
                  value={montoMovimiento}
                  onChange={(e) => setMontoMovimiento(e.target.value)}
                  placeholder="Ej: 100.00"
                  autoFocus
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  Nota (opcional)
                </label>
                <textarea
                  className="typeform-large-textarea"
                  rows="3"
                  value={notaMovimiento}
                  onChange={(e) => setNotaMovimiento(e.target.value)}
                  placeholder={
                    tipoMovimiento === 'deposito'
                      ? 'Ej: Depósito en efectivo, transferencia, etc.'
                      : 'Ej: Impresiones del día, servicio aplicado, etc.'
                  }
                />
              </div>
            </div>
            <div className="cliente-historial-footer">
              <button
                className="btn-secondary"
                onClick={() => {
                  if (!procesandoMovimiento) {
                    setShowCuentaModal(false);
                  }
                }}
              >
                Cancelar
              </button>
              <button
                className={`btn-cuenta-movimiento btn-cuenta-${tipoMovimiento}`}
                onClick={guardarMovimientoCuenta}
                disabled={procesandoMovimiento}
              >
                {procesandoMovimiento ? 'Guardando...' : 'Guardar movimiento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

