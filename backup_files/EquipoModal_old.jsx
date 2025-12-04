import { useState, useEffect } from 'react';
import { supabase } from '../../supabase.js';
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
        .maybeSingle(); // Usar maybeSingle() en lugar de single()
      
      if (error) throw error;
      
      setEstadoEquipo(data);
      
      if (data?.proceso_actual_id) {
        setProcesoActual(data.proceso_actual_id);
        loadSubprocesos(data.proceso_actual_id);
      }
    } catch (error) {
      console.error('Error al cargar estado del equipo:', error);
      // Si no existe estado, no es un error crítico
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

  // Función eliminada - ya no se permite cambiar de proceso desde el modal

  const completarSubproceso = async (subprocesoId, completado) => {
    try {
      const subproceso = subprocesos.find(s => s.id === subprocesoId);
      
      const { error } = await supabase
        .from('historial_procesos')
        .insert({
          equipo_id: equipo.id,
          proceso_id: procesoActual,
          subproceso_id: subprocesoId,
          completado: completado,
          notas: `${completado ? 'Completado' : 'Marcado como pendiente'}: ${subproceso?.nombre}`,
          fecha_completado: completado ? new Date().toISOString() : null
        });

      if (error) throw error;
      loadHistorial();
    } catch (error) {
      console.error('Error al actualizar subproceso:', error);
    }
  };

  const agregarNota = async () => {
    if (!nuevaNota.trim()) return;
    
    try {
      const { error } = await supabase
        .from('historial_procesos')
        .insert({
          equipo_id: equipo.id,
          proceso_id: procesoActual,
          notas: nuevaNota.trim(),
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

  const finalizarEquipo = async () => {
    if (!confirm('¿Estás seguro de que quieres finalizar este equipo? Se moverá a la lista de listos.')) {
      return;
    }

    setLoading(true);
    try {
      // Verificar si ya existe un estado para este equipo
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
        // Actualizar estado existente
        const { error } = await supabase
          .from('estado_equipos')
          .update({
            estado: 'finalizado',
            proceso_actual_id: procesoActual,
            updated_at: new Date().toISOString()
          })
          .eq('equipo_id', equipo.id);
        estadoError = error;
      } else {
        // Crear nuevo estado
        const { error } = await supabase
          .from('estado_equipos')
          .insert({
            equipo_id: equipo.id,
            estado: 'finalizado',
            proceso_actual_id: procesoActual,
            updated_at: new Date().toISOString()
          });
        estadoError = error;
      }

      if (estadoError) throw estadoError;

      // Registrar finalización en historial
      const { error: historialError } = await supabase
        .from('historial_procesos')
        .insert({
          equipo_id: equipo.id,
          proceso_id: procesoActual,
          notas: 'Equipo finalizado y listo para entrega',
          completado: true,
          fecha_completado: new Date().toISOString()
        });

      if (historialError) throw historialError;

      alert('Equipo finalizado exitosamente');
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

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const siguienteSubproceso = getSiguienteSubproceso();
  const subprocesosCompletados = getSubprocesosCompletados();
  const procesoInfo = procesos.find(p => p.id === procesoActual);

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal equipo-modal">
        <button onClick={onClose} className="close-btn">×</button>
        
        {/* Header con información del equipo */}
        <div className="equipo-header">
          <div className="equipo-numero">#{equipo.nota}</div>
          <h2 className="equipo-title">{equipo.marca} {equipo.modelo}</h2>
          <div className="equipo-meta">
            <span className="equipo-color">{equipo.color}</span>
            {estadoEquipo && (
              <span className={`estado-badge ${estadoEquipo.estado}`}>
                {estadoEquipo.estado === 'en_proceso' ? 'En Proceso' : 
                 estadoEquipo.estado === 'finalizado' ? 'Finalizado' : 'Pendiente'}
              </span>
            )}
          </div>
          {equipo.problema && (
            <div className="problema-info">
              <strong>Problema:</strong> {equipo.problema}
            </div>
          )}
          {procesoInfo && (
            <div className="proceso-info">
              <strong>Proceso:</strong> {procesoInfo.nombre}
            </div>
          )}
        </div>

        {/* Siguiente subproceso pendiente */}
        {siguienteSubproceso && estadoEquipo?.estado !== 'finalizado' && (
          <div className="siguiente-subproceso">
            <h3>📋 Siguiente paso</h3>
            <div className="subproceso-card">
              <div className="subproceso-info">
                <h4>{siguienteSubproceso.nombre}</h4>
                {siguienteSubproceso.descripcion && (
                  <p>{siguienteSubproceso.descripcion}</p>
                )}
              </div>
              <button 
                className="btn-completar"
                onClick={() => marcarSubprocesoCompletado(siguienteSubproceso.id)}
                disabled={loading}
              >
                ✓ Completar
              </button>
            </div>
          </div>
        )}

        {/* Subprocesos completados */}
        {subprocesosCompletados.length > 0 && (
          <div className="subprocesos-completados">
            <h3>✅ Pasos completados ({subprocesosCompletados.length}/{subprocesos.length})</h3>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${(subprocesosCompletados.length / subprocesos.length) * 100}%` }}
              ></div>
            </div>
            <div className="completados-list">
              {subprocesosCompletados.map(subproceso => (
                <div key={subproceso.id} className="subproceso-completado">
                  <span className="check-icon">✓</span>
                  <span>{subproceso.nombre}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Formulario para agregar nota */}
        {showNotaForm && (
          <div className="nota-form">
            <h3>📝 Agregar nota</h3>
            <textarea
              value={nuevaNota}
              onChange={(e) => setNuevaNota(e.target.value)}
              placeholder="Escribe una nota o pendiente..."
              rows="3"
            />
            <div className="nota-actions">
              <button 
                className="btn-secondary"
                onClick={() => {
                  setShowNotaForm(false);
                  setNuevaNota('');
                }}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary"
                onClick={agregarNota}
                disabled={!nuevaNota.trim()}
              >
                Guardar
              </button>
            </div>
          </div>
        )}

        {/* Acciones principales */}
        <div className="modal-actions">
          <button 
            className="btn-nota"
            onClick={() => setShowNotaForm(!showNotaForm)}
          >
            📝 {showNotaForm ? 'Cerrar' : 'Agregar Nota'}
          </button>
          
          {estadoEquipo?.estado !== 'finalizado' && subprocesosCompletados.length === subprocesos.length && subprocesos.length > 0 && (
            <button 
              className="btn-finalizar"
              onClick={finalizarEquipo}
              disabled={loading}
            >
              🏁 Finalizar Equipo
            </button>
          )}
        </div>
                </div>
                
                {equipo.problema && (
                  <div className="info-card problema-card">
                    <div className="info-card-icon">🔧</div>
                    <div className="info-card-content">
                      <h3>Problema Reportado</h3>
                      <p className="problema-text">{equipo.problema}</p>
                    </div>
                  </div>
                )}
                
                {estadoEquipo && (
                  <div className="info-card proceso-card">
                    <div className="info-card-icon">⚙️</div>
                    <div className="info-card-content">
                      <h3>Proceso Actual</h3>
                      <p className="proceso-nombre">{procesos.find(p => p.id === procesoActual)?.nombre || 'Sin proceso asignado'}</p>
                      {procesos.find(p => p.id === procesoActual)?.descripcion && (
                        <p className="proceso-descripcion">{procesos.find(p => p.id === procesoActual).descripcion}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'proceso' && (
            <div className="proceso-tab">
              {!procesoActual ? (
                <div className="sin-proceso">
                  <div className="empty-state">
                    <div className="empty-icon">📋</div>
                    <h3>No hay proceso asignado</h3>
                    <p>Este equipo no tiene un proceso asignado. Los nuevos equipos se crean con un proceso desde el inicio.</p>
                  </div>
                </div>
              ) : (
                <div className="proceso-activo">
                  <div className="proceso-progress">
                    <div className="progress-info">
                      <h3 className="proceso-title">{procesos.find(p => p.id === procesoActual)?.nombre}</h3>
                      <div className="progress-stats">
                        {subprocesos.length > 0 && (
                          <span className="progress-text">
                            {subprocesos.filter(s => getSubprocesoStatus(s.id) === 'completado').length} de {subprocesos.length} completados
                          </span>
                        )}
                      </div>
                    </div>
                    {subprocesos.length > 0 && (
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{
                            width: `${(subprocesos.filter(s => getSubprocesoStatus(s.id) === 'completado').length / subprocesos.length) * 100}%`
                          }}
                        ></div>
                      </div>
                    )}
                  </div>
                  
                  <div className="subprocesos-container">
                    {subprocesos.map((subproceso, index) => {
                      const status = getSubprocesoStatus(subproceso.id);
                      return (
                        <div key={subproceso.id} className={`subproceso-card ${status}`}>
                          <div className="subproceso-step">{index + 1}</div>
                          <div className="subproceso-content">
                            <div className="subproceso-header">
                              <h4 className="subproceso-nombre">{subproceso.nombre}</h4>
                              <button
                                className={`check-button ${status === 'completado' ? 'checked' : ''}`}
                                onClick={() => completarSubproceso(subproceso.id, status !== 'completado')}
                                title={status === 'completado' ? 'Marcar como pendiente' : 'Marcar como completado'}
                              >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                  <path 
                                    d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"
                                    fill="currentColor"
                                  />
                                </svg>
                              </button>
                            </div>
                            {subproceso.descripcion && (
                              <p className="subproceso-descripcion">{subproceso.descripcion}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="nota-section">
                    <h4 className="nota-title">Agregar Nota</h4>
                    <div className="nota-input-container">
                      <textarea
                        value={nuevaNota}
                        onChange={(e) => setNuevaNota(e.target.value)}
                        placeholder="Escribe una nota adicional sobre este proceso..."
                        rows="3"
                        className="nota-textarea"
                      />
                      <button 
                        onClick={agregarNota} 
                        disabled={!nuevaNota.trim()}
                        className="nota-submit-btn"
                      >
                        <span>Agregar Nota</span>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M8 3.5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5H4a.5.5 0 0 1 0-1h3.5V4a.5.5 0 0 1 .5-.5z" fill="currentColor"/>
                          <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293 6.354 8.146a.5.5 0 1 0-.708.708l3 3z" fill="currentColor"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'historial' && (
            <div className="historial-tab">
              {historial.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📜</div>
                  <h3>Sin historial</h3>
                  <p>Aún no hay registros en el historial de este equipo.</p>
                </div>
              ) : (
                <div className="timeline">
                  {historial.map((registro, index) => (
                    <div key={registro.id} className="timeline-item">
                      <div className="timeline-marker">
                        <div className={`timeline-dot ${registro.completado === true ? 'completed' : registro.completado === false ? 'pending' : 'neutral'}`}>
                          {registro.completado === true ? (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : registro.completado === false ? (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <circle cx="6" cy="6" r="3" fill="currentColor"/>
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                          )}
                        </div>
                        {index < historial.length - 1 && <div className="timeline-line"></div>}
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <time className="timeline-time">
                            {new Date(registro.created_at).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </time>
                          {registro.completado !== null && (
                            <span className={`timeline-status ${registro.completado ? 'completado' : 'pendiente'}`}>
                              {registro.completado ? 'Completado' : 'Pendiente'}
                            </span>
                          )}
                        </div>
                        <div className="timeline-body">
                          {registro.procesos?.nombre && (
                            <div className="timeline-proceso">
                              <strong>{registro.procesos.nombre}</strong>
                              {registro.subprocesos?.nombre && (
                                <span className="timeline-subproceso"> → {registro.subprocesos.nombre}</span>
                              )}
                            </div>
                          )}
                          <p className="timeline-notas">{registro.notas}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {procesoActual && estadoEquipo?.estado === 'en_proceso' && (
          <div className="modal-footer">
            <button 
              className="finalizar-btn"
              onClick={finalizarEquipo}
              disabled={loading}
            >
              <div className="btn-content">
                <span className="btn-icon">✅</span>
                <span className="btn-text">{loading ? 'Finalizando...' : 'Finalizar Equipo'}</span>
              </div>
              {loading && (
                <div className="btn-loader">
                  <div className="spinner"></div>
                </div>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}