import { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';
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

  const finalizarEquipo = async () => {
    if (!confirm('¿Estás seguro de que quieres finalizar este equipo? Se moverá a la lista de listos.')) {
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
            estado: 'finalizado',
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
            estado: 'finalizado',
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

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal equipo-modal-simple">
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
    </div>
  );
}
