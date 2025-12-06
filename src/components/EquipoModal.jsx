import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabase.js';
import { notificarEquipoListo, notificarEquipoFinalizado } from '../utils/notifications.js';
import Icon from './Icon.jsx';
import './EquipoModal.css';

export default function EquipoModal({ equipo, onClose, onEquipoUpdated }) {
  const [procesos, setProcesos] = useState([]);
  const [procesoActual, setProcesoActual] = useState(null);
  const [subprocesos, setSubprocesos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [estadoEquipo, setEstadoEquipo] = useState(null);
  const [nuevaNota, setNuevaNota] = useState('');
  const [showNotaForm, setShowNotaForm] = useState(false);
  const [tipoNota, setTipoNota] = useState('nota'); // 'nota' o 'pendiente'
  const [showEntregaModal, setShowEntregaModal] = useState(false);
  const [entregaLoading, setEntregaLoading] = useState(false);
  const [cliente, setCliente] = useState(null);

  useEffect(() => {
    if (equipo?.id) {
      loadProcesos();
      loadEstadoEquipo();
      loadHistorial();
      loadCliente();
    }
  }, [equipo?.id]);

  const loadCliente = async () => {
    try {
      if (equipo.clientes) {
        setCliente(equipo.clientes);
      } else if (equipo.cliente_id) {
        const { data, error } = await supabase
          .from('clientes')
          .select('id, nombre, telefono, email')
          .eq('id', equipo.cliente_id)
          .single();
        
        if (!error && data) {
          setCliente(data);
        }
      }
    } catch (error) {
      console.error('Error al cargar cliente:', error);
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

  const formatRelativeTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Justo ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    if (diffDays < 7) return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
    return formatDate(dateString);
  };

  const loadProcesos = async () => {
    try {
      const { data, error } = await supabase
        .from('procesos')
        .select('*')
        .order('id');
      
      if (error) throw error;
      setProcesos(data || []);
    } catch (error) {
      console.error('Error al cargar procesos:', error);
    }
  };

  const loadEstadoEquipo = async () => {
    try {
      const { data, error } = await supabase
        .from('estado_equipos')
        .select(`
          *,
          procesos (
            id,
            nombre,
            descripcion
          )
        `)
        .eq('equipo_id', equipo.id)
        .maybeSingle();
      
      if (error) throw error;
      
      setEstadoEquipo(data);
      
      if (data?.proceso_actual_id) {
        setProcesoActual(data.proceso_actual_id);
        loadSubprocesos(data.proceso_actual_id);
      }
    } catch (error) {
      console.error('Error al cargar estado del equipo:', error);
      setEstadoEquipo(null);
    }
  };

  const loadSubprocesos = async (procesoId) => {
    try {
      const { data, error } = await supabase
        .from('subprocesos')
        .select('*')
        .eq('proceso_id', procesoId)
        .order('orden');
      
      if (error) throw error;
      setSubprocesos(data || []);
    } catch (error) {
      console.error('Error al cargar subprocesos:', error);
    }
  };

  const loadHistorial = async () => {
    try {
      const { data, error } = await supabase
        .from('historial_procesos')
        .select(`
          *,
          procesos (nombre),
          subprocesos (nombre)
        `)
        .eq('equipo_id', equipo.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setHistorial(data || []);
    } catch (error) {
      console.error('Error al cargar historial:', error);
    }
  };

  const agregarNota = async (esPendiente = false) => {
    if (!nuevaNota.trim()) return;
    
    try {
      const prefijo = esPendiente ? 'PENDIENTE: ' : 'NOTA: ';
      const { error } = await supabase
        .from('historial_procesos')
        .insert({
          equipo_id: equipo.id,
          proceso_id: procesoActual,
          notas: `${prefijo}${nuevaNota.trim()}`,
          completado: null
        });

      if (error) throw error;
      setNuevaNota('');
      setShowNotaForm(false);
      loadHistorial();
    } catch (error) {
      console.error('Error al agregar nota:', error);
    }
  };

  const marcarSubprocesoCompletado = async (subprocesoId) => {
    try {
      const subproceso = subprocesos.find(s => s.id === subprocesoId);
      
      const { error } = await supabase
        .from('historial_procesos')
        .insert({
          equipo_id: equipo.id,
          proceso_id: procesoActual,
          subproceso_id: subprocesoId,
          completado: true,
          notas: `Completado: ${subproceso?.nombre}`,
          fecha_completado: new Date().toISOString()
        });

      if (error) throw error;
      loadHistorial();
    } catch (error) {
      console.error('Error al completar subproceso:', error);
    }
  };

  const marcarComoListo = async () => {
    if (!confirm('¿Estás seguro de que quieres marcar este equipo como listo? Se moverá a la lista de "Listos para recoger".')) {
      return;
    }

    setLoading(true);
    try {
      const { data: estadoExistente, error: consultaError } = await supabase
        .from('estado_equipos')
        .select('id')
        .eq('equipo_id', equipo.id)
        .single();

      if (consultaError && consultaError.code !== 'PGRST116') {
        throw consultaError;
      }

      let estadoError;
      if (estadoExistente) {
        const { error } = await supabase
          .from('estado_equipos')
          .update({
            estado: 'listo',
            proceso_actual_id: procesoActual,
            updated_at: new Date().toISOString()
          })
          .eq('equipo_id', equipo.id);
        estadoError = error;
      } else {
        const { error } = await supabase
          .from('estado_equipos')
          .insert({
            equipo_id: equipo.id,
            estado: 'listo',
            proceso_actual_id: procesoActual,
            updated_at: new Date().toISOString()
          });
        estadoError = error;
      }

      if (estadoError) throw estadoError;

      // Crear notificación de equipo listo
      try {
        const clienteNombre = cliente?.nombre || null;
        await notificarEquipoListo(equipo, clienteNombre);
      } catch (notifError) {
        console.error('Error creando notificación (no crítico):', notifError);
      }

      const { error: historialError } = await supabase
        .from('historial_procesos')
        .insert({
          equipo_id: equipo.id,
          proceso_id: procesoActual,
          notas: 'Equipo terminado y listo para entrega',
          completado: true,
          fecha_completado: new Date().toISOString()
        });

      if (historialError) throw historialError;

      alert('Equipo marcado como listo exitosamente');
      onEquipoUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error al marcar equipo como listo:', error);
      alert('Error al marcar el equipo como listo');
    } finally {
      setLoading(false);
    }
  };

  const marcarComoFinalizado = () => {
    setShowEntregaModal(true);
  };

  const confirmarEntrega = async () => {
    setEntregaLoading(true);
    try {
      const { error: estadoError } = await supabase
        .from('estado_equipos')
        .update({
          estado: 'finalizado',
          updated_at: new Date().toISOString()
        })
        .eq('equipo_id', equipo.id);

      if (estadoError) throw estadoError;

      const { error: historialError } = await supabase
        .from('historial_procesos')
        .insert({
          equipo_id: equipo.id,
          proceso_id: procesoActual,
          notas: 'Equipo entregado al cliente',
          completado: true,
          fecha_completado: new Date().toISOString()
        });

      if (historialError) throw historialError;

      // Crear notificación de equipo finalizado
      try {
        const clienteNombre = cliente?.nombre || null;
        await notificarEquipoFinalizado(equipo, clienteNombre);
      } catch (notifError) {
        console.error('Error creando notificación (no crítico):', notifError);
      }

      setShowEntregaModal(false);
      setEntregaLoading(false);
      onEquipoUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error al finalizar equipo:', error);
      alert('Error al finalizar el equipo');
      setEntregaLoading(false);
      setShowEntregaModal(false);
    }
  };

  const getSubprocesoStatus = (subprocesoId) => {
    const registros = historial.filter(h => h.subproceso_id === subprocesoId);
    if (registros.length === 0) return 'pendiente';
    return registros[registros.length - 1].completado ? 'completado' : 'pendiente';
  };

  const getSiguienteSubproceso = () => {
    if (!subprocesos.length) return null;
    
    for (const subproceso of subprocesos) {
      const status = getSubprocesoStatus(subproceso.id);
      if (status === 'pendiente') {
        return subproceso;
      }
    }
    return null;
  };

  const getSubprocesosCompletados = () => {
    return subprocesos.filter(subproceso => getSubprocesoStatus(subproceso.id) === 'completado');
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const siguienteSubproceso = getSiguienteSubproceso();
  const subprocesosCompletados = getSubprocesosCompletados();
  const procesoInfo = procesos.find(p => p.id === procesoActual);

  // Función para obtener todos los subprocesos con su estado
  const getAllSubprocesosWithStatus = () => {
    return subprocesos.map(subproceso => ({
      ...subproceso,
      status: getSubprocesoStatus(subproceso.id),
      isNext: siguienteSubproceso?.id === subproceso.id
    }));
  };

  const allSubprocesos = getAllSubprocesosWithStatus();
  const progressPercentage = subprocesos.length > 0 
    ? (subprocesosCompletados.length / subprocesos.length) * 100 
    : 0;

  return (
    <div className="equipo-modal-overlay" onClick={handleOverlayClick}>
      <div className="equipo-modal" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="equipo-modal-close-btn">
          <Icon name="times" />
        </button>
        
        <div className="equipo-modal-content-wrapper">
        {/* Header con información del equipo */}
          <div className="equipo-modal-header">
          <div className="equipo-header-main">
            <div className="equipo-numero-badge">
              <span className="equipo-numero-prefix">#</span>
              <span className="equipo-numero-value">{equipo.nota}</span>
            </div>
            <div className="equipo-header-info">
              <h2 className="equipo-title">{equipo.marca} {equipo.modelo}</h2>
              <div className="equipo-meta">
                <span className="equipo-color-badge">
                  <Icon name="palette" className="meta-icon" />
                  {equipo.color}
                </span>
                {estadoEquipo && (
                  <span className={`estado-badge ${estadoEquipo.estado}`}>
                    <Icon name={estadoEquipo.estado === 'en_proceso' ? 'clock' : estadoEquipo.estado === 'finalizado' ? 'check-circle' : estadoEquipo.estado === 'listo' ? 'check-circle' : 'hourglass-half'} className="meta-icon" />
                    {estadoEquipo.estado === 'en_proceso' ? 'En Proceso' : 
                     estadoEquipo.estado === 'finalizado' ? 'Finalizado' :
                     estadoEquipo.estado === 'listo' ? 'Listo' : 'Pendiente'}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Información adicional en grid */}
          <div className="equipo-info-grid">
            {/* Información del Cliente */}
            {cliente && (
              <div className="info-card cliente-card">
                <div className="info-card-header">
                  <Icon name="user" className="info-card-icon" />
                  <h3 className="info-card-title">Cliente</h3>
                </div>
                <div className="info-card-content">
                  <p className="info-card-value">{cliente.nombre || 'Sin nombre'}</p>
                  {cliente.telefono && (
                    <div className="info-card-meta">
                      <Icon name="phone" className="meta-icon-small" />
                      <span>{cliente.telefono}</span>
                    </div>
                  )}
                  {cliente.email && (
                    <div className="info-card-meta">
                      <Icon name="envelope" className="meta-icon-small" />
                      <span>{cliente.email}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Información del Proceso */}
            {procesoInfo && (
              <div className="info-card proceso-card">
                <div className="info-card-header">
                  <Icon name="cog" className="info-card-icon" />
                  <h3 className="info-card-title">Proceso</h3>
                </div>
                <div className="info-card-content">
                  <p className="info-card-value">{procesoInfo.nombre}</p>
                  {procesoInfo.descripcion && (
                    <p className="info-card-description">{procesoInfo.descripcion}</p>
                  )}
                </div>
              </div>
            )}

            {/* Fechas */}
            <div className="info-card fechas-card">
              <div className="info-card-header">
                <Icon name="calendar-alt" className="info-card-icon" />
                <h3 className="info-card-title">Fechas</h3>
              </div>
              <div className="info-card-content">
                <div className="info-card-meta">
                  <Icon name="plus-circle" className="meta-icon-small" />
                  <div>
                    <span className="info-card-label">Creado:</span>
                    <span className="info-card-value-small">{formatDate(equipo.created_at)}</span>
                  </div>
                </div>
                {estadoEquipo?.updated_at && (
                  <div className="info-card-meta">
                    <Icon name="sync-alt" className="meta-icon-small" />
                    <div>
                      <span className="info-card-label">Actualizado:</span>
                      <span className="info-card-value-small">{formatRelativeTime(estadoEquipo.updated_at)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Problema reportado */}
          {equipo.problema && (
            <div className="problema-card">
              <div className="problema-card-header">
                <Icon name="exclamation-triangle" className="problema-icon" />
                <h3 className="problema-title">Problema Reportado</h3>
              </div>
              <p className="problema-text">{equipo.problema}</p>
            </div>
          )}
        </div>

        {/* Línea de tiempo de subprocesos */}
        {subprocesos.length > 0 && (
          <div className="timeline-section">
            <div className="timeline-header">
              <h3 className="timeline-title">
                <Icon name="list-check" className="timeline-title-icon" />
                Proceso: {procesoInfo?.nombre || 'Sin proceso'}
              </h3>
              <div className="timeline-progress">
                <div className="progress-bar-container">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
                <span className="progress-text">
                  {subprocesosCompletados.length} / {subprocesos.length} completados
                </span>
              </div>
            </div>
            
            <div className="timeline">
              {allSubprocesos.map((subproceso, index) => {
                const isCompleted = subproceso.status === 'completado';
                const isNext = subproceso.isNext;
                const isLast = index === allSubprocesos.length - 1;
                
                return (
                  <div key={subproceso.id} className={`timeline-item ${isCompleted ? 'completed' : ''} ${isNext ? 'next' : ''}`}>
                    <div className="timeline-marker">
                      {isCompleted ? (
                        <div className="marker-icon completed">
                          <Icon name="check" />
            </div>
                      ) : isNext ? (
                        <div className="marker-icon next">
                          <Icon name="arrow-right" />
                </div>
                      ) : (
                        <div className="marker-icon pending">
                          <Icon name="circle" />
          </div>
        )}
                      {!isLast && <div className="timeline-line"></div>}
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-content-header">
                        <h4 className="timeline-step-title">{subproceso.nombre}</h4>
                        {isNext && (
              <button 
                            className="btn-completar-step"
                            onClick={() => marcarSubprocesoCompletado(subproceso.id)}
                            disabled={loading}
              >
                            <Icon name="check" />
                            Completar
              </button>
                        )}
                      </div>
                      {subproceso.descripcion && (
                        <p className="timeline-step-description">{subproceso.descripcion}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>

        {/* Acciones principales */}
        <div className="equipo-modal-actions">
          {/* Botón de estado según el equipo */}
          <div className="actions-row">
            {/* Si está en proceso y todos los subprocesos están completados */}
            {estadoEquipo?.estado === 'en_proceso' && subprocesosCompletados.length === subprocesos.length && subprocesos.length > 0 && (
              <button 
                className="btn-listo full-width"
                onClick={marcarComoListo}
                disabled={loading}
              >
                <Icon name="check-circle" />
                Marcar como Listo para Recoger
              </button>
            )}
            
            {/* Si está listo, puede ser entregado */}
            {estadoEquipo?.estado === 'listo' && (
              <button 
                className="btn-finalizar full-width"
                onClick={marcarComoFinalizado}
                disabled={loading}
              >
                <Icon name="flag-checkered" />
                Marcar como Entregado
              </button>
            )}
          </div>
        </div>

        {/* Modal de Confirmación de Entrega */}
        {showEntregaModal && createPortal(
          <div className="equipo-modal-overlay" onClick={() => !entregaLoading && setShowEntregaModal(false)}>
            <div className="equipo-modal entrega-confirmation-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <button 
                className="equipo-modal-close-btn" 
                onClick={() => !entregaLoading && setShowEntregaModal(false)}
                disabled={entregaLoading}
              >
                <Icon name="times" />
              </button>
              
              <div style={{ padding: 'var(--space-6)' }}>
                <div style={{ 
                  width: '80px', 
                  height: '80px', 
                  margin: '0 auto var(--space-4)',
                  borderRadius: 'var(--radius-full)',
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.15))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--font-3xl)',
                  color: 'rgba(34, 197, 94, 0.9)'
                }}>
                  <Icon name="check-circle" />
                </div>
                <h2 style={{ 
                  fontSize: 'var(--font-2xl)', 
                  fontWeight: 'var(--font-bold)',
                  textAlign: 'center',
                  marginBottom: 'var(--space-2)',
                  color: 'var(--gray-900)'
                }}>
                  Confirmar Entrega
                </h2>
                <p style={{ 
                  fontSize: 'var(--font-base)', 
                  color: 'var(--gray-600)',
                  textAlign: 'center',
                  marginBottom: 'var(--space-6)',
                  lineHeight: 1.6
                }}>
                  ¿Estás seguro de que quieres marcar el equipo <strong>#{equipo.nota}</strong> como entregado?
                  <br />
                  <span style={{ fontSize: 'var(--font-sm)', opacity: 0.8, display: 'block', marginTop: 'var(--space-2)' }}>
                    Esta acción es definitiva.
                  </span>
                </p>
                
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <button 
                    className="btn-finalizar"
                    style={{ flex: 1 }}
                    onClick={() => setShowEntregaModal(false)}
                    disabled={entregaLoading}
                  >
                    Cancelar
                  </button>
                  <button 
                    className="btn-finalizar"
                    style={{ 
                      flex: 1,
                      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9))',
                      boxShadow: '0 4px 12px rgba(34, 197, 94, 0.4)'
                    }}
                    onClick={confirmarEntrega}
                    disabled={entregaLoading}
                  >
                    {entregaLoading ? (
                      <>
                        <span style={{ 
                          display: 'inline-block',
                          animation: 'spin 1s linear infinite',
                          transformOrigin: 'center'
                        }}>
                          <Icon name="sync" />
                        </span>
                        Procesando...
                      </>
                    ) : (
                      <>
                        <Icon name="check" />
                        Confirmar Entrega
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}