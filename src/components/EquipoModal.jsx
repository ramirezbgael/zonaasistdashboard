import { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';
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

  useEffect(() => {
    if (equipo?.id) {
      loadProcesos();
      loadEstadoEquipo();
      loadHistorial();
    }
  }, [equipo?.id]);

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

  const marcarComoFinalizado = async () => {
    if (!confirm('¿Estás seguro de que quieres marcar este equipo como entregado? Esta acción es definitiva.')) {
      return;
    }

    setLoading(true);
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

      alert('Equipo marcado como entregado exitosamente');
      onEquipoUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error al finalizar equipo:', error);
      alert('Error al finalizar el equipo');
    } finally {
      setLoading(false);
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
                    <Icon name={estadoEquipo.estado === 'en_proceso' ? 'clock' : estadoEquipo.estado === 'finalizado' ? 'check-circle' : 'hourglass-half'} className="meta-icon" />
                {estadoEquipo.estado === 'en_proceso' ? 'En Proceso' : 
                 estadoEquipo.estado === 'finalizado' ? 'Finalizado' : 'Pendiente'}
              </span>
            )}
              </div>
            </div>
          </div>
          {(procesoInfo || equipo.problema) && (
            <div className="proceso-detalle-info">
              <Icon name="info-circle" className="info-icon" />
              <div>
                <strong>{procesoInfo?.nombre || 'Sin proceso'}</strong>
                {equipo.problema && <p>{equipo.problema}</p>}
              </div>
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
      </div>
    </div>
  );
}