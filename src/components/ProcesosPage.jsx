import { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import './ProcesosPage.css';

export default function ProcesosPage() {
  const [procesos, setProcesos] = useState([]);
  const [subprocesos, setSubprocesos] = useState({}); // { procesoId: [subprocesos] }
  const [loading, setLoading] = useState(true);
  const [showProcesoModal, setShowProcesoModal] = useState(false);
  const [showSubprocesoModal, setShowSubprocesoModal] = useState(false);
  const [editingProceso, setEditingProceso] = useState(null);
  const [editingSubproceso, setEditingSubproceso] = useState(null);
  const [selectedProcesoId, setSelectedProcesoId] = useState(null);
  const [expandedProcesos, setExpandedProcesos] = useState({});
  
  // Form data
  const [procesoForm, setProcesoForm] = useState({ nombre: '', descripcion: '' });
  const [subprocesoForm, setSubprocesoForm] = useState({ nombre: '', descripcion: '', orden: 1 });

  useEffect(() => {
    fetchProcesos();
  }, []);

  const fetchProcesos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('procesos')
        .select('*')
        .order('id');

      if (error) throw error;
      setProcesos(data || []);
      
      // Cargar subprocesos para cada proceso
      if (data && data.length > 0) {
        const procesoIds = data.map(p => p.id);
        await fetchSubprocesos(procesoIds);
      }
    } catch (error) {
      console.error('Error fetching procesos:', error);
      alert('Error al cargar procesos');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubprocesos = async (procesoIds) => {
    try {
      const { data, error } = await supabase
        .from('subprocesos')
        .select('*')
        .in('proceso_id', procesoIds)
        .order('orden');

      if (error) throw error;
      
      // Agrupar subprocesos por proceso_id
      const grouped = {};
      (data || []).forEach(sub => {
        if (!grouped[sub.proceso_id]) {
          grouped[sub.proceso_id] = [];
        }
        grouped[sub.proceso_id].push(sub);
      });
      
      setSubprocesos(grouped);
    } catch (error) {
      console.error('Error fetching subprocesos:', error);
    }
  };

  const handleCreateProceso = () => {
    setEditingProceso(null);
    setProcesoForm({ nombre: '', descripcion: '' });
    setShowProcesoModal(true);
  };

  const handleEditProceso = (proceso) => {
    setEditingProceso(proceso);
    setProcesoForm({ nombre: proceso.nombre, descripcion: proceso.descripcion || '' });
    setShowProcesoModal(true);
  };

  const handleSaveProceso = async () => {
    if (!procesoForm.nombre.trim()) {
      alert('El nombre del proceso es requerido');
      return;
    }

    try {
      if (editingProceso) {
        // Actualizar
        const { error } = await supabase
          .from('procesos')
          .update({
            nombre: procesoForm.nombre.trim(),
            descripcion: procesoForm.descripcion.trim() || null
          })
          .eq('id', editingProceso.id);

        if (error) throw error;
      } else {
        // Crear
        const { error } = await supabase
          .from('procesos')
          .insert({
            nombre: procesoForm.nombre.trim(),
            descripcion: procesoForm.descripcion.trim() || null
          });

        if (error) throw error;
      }

      setShowProcesoModal(false);
      fetchProcesos();
    } catch (error) {
      console.error('Error saving proceso:', error);
      alert('Error al guardar el proceso');
    }
  };

  const handleDeleteProceso = async (procesoId) => {
    if (!confirm('¿Estás seguro de eliminar este proceso? Esto también eliminará todos sus subprocesos.')) {
      return;
    }

    try {
      // Primero eliminar subprocesos
      const { error: subError } = await supabase
        .from('subprocesos')
        .delete()
        .eq('proceso_id', procesoId);

      if (subError) throw subError;

      // Luego eliminar el proceso
      const { error } = await supabase
        .from('procesos')
        .delete()
        .eq('id', procesoId);

      if (error) throw error;

      fetchProcesos();
    } catch (error) {
      console.error('Error deleting proceso:', error);
      alert('Error al eliminar el proceso');
    }
  };

  const handleCreateSubproceso = (procesoId) => {
    setSelectedProcesoId(procesoId);
    setEditingSubproceso(null);
    const currentSubs = subprocesos[procesoId] || [];
    setSubprocesoForm({ 
      nombre: '', 
      descripcion: '', 
      orden: currentSubs.length + 1 
    });
    setShowSubprocesoModal(true);
  };

  const handleEditSubproceso = (subproceso) => {
    setSelectedProcesoId(subproceso.proceso_id);
    setEditingSubproceso(subproceso);
    setSubprocesoForm({ 
      nombre: subproceso.nombre, 
      descripcion: subproceso.descripcion || '', 
      orden: subproceso.orden 
    });
    setShowSubprocesoModal(true);
  };

  const handleSaveSubproceso = async () => {
    if (!subprocesoForm.nombre.trim()) {
      alert('El nombre del paso es requerido');
      return;
    }

    if (!selectedProcesoId) {
      alert('Error: No se seleccionó un proceso');
      return;
    }

    try {
      if (editingSubproceso) {
        // Actualizar
        const { error } = await supabase
          .from('subprocesos')
          .update({
            nombre: subprocesoForm.nombre.trim(),
            descripcion: subprocesoForm.descripcion.trim() || null,
            orden: parseInt(subprocesoForm.orden)
          })
          .eq('id', editingSubproceso.id);

        if (error) throw error;
      } else {
        // Crear
        const { error } = await supabase
          .from('subprocesos')
          .insert({
            proceso_id: selectedProcesoId,
            nombre: subprocesoForm.nombre.trim(),
            descripcion: subprocesoForm.descripcion.trim() || null,
            orden: parseInt(subprocesoForm.orden)
          });

        if (error) throw error;
      }

      setShowSubprocesoModal(false);
      await fetchSubprocesos([selectedProcesoId]);
    } catch (error) {
      console.error('Error saving subproceso:', error);
      alert('Error al guardar el paso');
    }
  };

  const handleDeleteSubproceso = async (subprocesoId, procesoId) => {
    if (!confirm('¿Estás seguro de eliminar este paso?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('subprocesos')
        .delete()
        .eq('id', subprocesoId);

      if (error) throw error;

      await fetchSubprocesos([procesoId]);
    } catch (error) {
      console.error('Error deleting subproceso:', error);
      alert('Error al eliminar el paso');
    }
  };

  const handleMoveSubproceso = async (subprocesoId, procesoId, direction) => {
    const currentSubs = subprocesos[procesoId] || [];
    const currentIndex = currentSubs.findIndex(s => s.id === subprocesoId);
    
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= currentSubs.length) return;

    const currentSub = currentSubs[currentIndex];
    const targetSub = currentSubs[newIndex];

    try {
      // Intercambiar órdenes
      const { error: error1 } = await supabase
        .from('subprocesos')
        .update({ orden: targetSub.orden })
        .eq('id', currentSub.id);

      if (error1) throw error1;

      const { error: error2 } = await supabase
        .from('subprocesos')
        .update({ orden: currentSub.orden })
        .eq('id', targetSub.id);

      if (error2) throw error2;

      await fetchSubprocesos([procesoId]);
    } catch (error) {
      console.error('Error moving subproceso:', error);
      alert('Error al mover el paso');
    }
  };

  const toggleExpandProceso = (procesoId) => {
    setExpandedProcesos(prev => ({
      ...prev,
      [procesoId]: !prev[procesoId]
    }));
  };

  if (loading) {
    return (
      <div className="procesos-page">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Cargando procesos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="procesos-page">
      <div className="procesos-header">
        <h1>Gestión de Procesos</h1>
        <button className="btn-primary" onClick={handleCreateProceso}>
          <Icon name="plus" />
          Nuevo Proceso
        </button>
      </div>

      <div className="procesos-list">
        {procesos.length === 0 ? (
          <div className="empty-state">
            <Icon name="clipboard-list" size="48" />
            <p>No hay procesos configurados</p>
            <button className="btn-primary" onClick={handleCreateProceso}>
              Crear Primer Proceso
            </button>
          </div>
        ) : (
          procesos.map(proceso => {
            const procesoSubs = subprocesos[proceso.id] || [];
            const isExpanded = expandedProcesos[proceso.id];

            return (
              <div key={proceso.id} className="proceso-card">
                <div className="proceso-card-header">
                  <div className="proceso-card-info">
                    <h3>{proceso.nombre}</h3>
                    {proceso.descripcion && (
                      <p className="proceso-descripcion">{proceso.descripcion}</p>
                    )}
                    <span className="proceso-stats">
                      {procesoSubs.length} {procesoSubs.length === 1 ? 'paso' : 'pasos'}
                    </span>
                  </div>
                  <div className="proceso-card-actions">
                    <button
                      className="btn-icon"
                      onClick={() => toggleExpandProceso(proceso.id)}
                      title={isExpanded ? 'Contraer' : 'Expandir'}
                    >
                      <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleEditProceso(proceso)}
                      title="Editar proceso"
                    >
                      <Icon name="edit" />
                    </button>
                    <button
                      className="btn-icon btn-danger"
                      onClick={() => handleDeleteProceso(proceso.id)}
                      title="Eliminar proceso"
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="proceso-subprocesos">
                    <div className="subprocesos-header">
                      <h4>Pasos del Proceso</h4>
                      <button
                        className="btn-secondary btn-small"
                        onClick={() => handleCreateSubproceso(proceso.id)}
                      >
                        <Icon name="plus" />
                        Agregar Paso
                      </button>
                    </div>

                    {procesoSubs.length === 0 ? (
                      <div className="empty-subprocesos">
                        <p>No hay pasos configurados para este proceso</p>
                        <button
                          className="btn-secondary btn-small"
                          onClick={() => handleCreateSubproceso(proceso.id)}
                        >
                          Agregar Primer Paso
                        </button>
                      </div>
                    ) : (
                      <div className="subprocesos-list">
                        {procesoSubs.map((sub, index) => (
                          <div key={sub.id} className="subproceso-item">
                            <div className="subproceso-number">{sub.orden}</div>
                            <div className="subproceso-content">
                              <h5>{sub.nombre}</h5>
                              {sub.descripcion && (
                                <p className="subproceso-descripcion">{sub.descripcion}</p>
                              )}
                            </div>
                            <div className="subproceso-actions">
                              <button
                                className="btn-icon btn-small"
                                onClick={() => handleMoveSubproceso(sub.id, proceso.id, 'up')}
                                disabled={index === 0}
                                title="Mover arriba"
                              >
                                <Icon name="arrow-up" />
                              </button>
                              <button
                                className="btn-icon btn-small"
                                onClick={() => handleMoveSubproceso(sub.id, proceso.id, 'down')}
                                disabled={index === procesoSubs.length - 1}
                                title="Mover abajo"
                              >
                                <Icon name="arrow-down" />
                              </button>
                              <button
                                className="btn-icon btn-small"
                                onClick={() => handleEditSubproceso(sub)}
                                title="Editar paso"
                              >
                                <Icon name="edit" />
                              </button>
                              <button
                                className="btn-icon btn-small btn-danger"
                                onClick={() => handleDeleteSubproceso(sub.id, proceso.id)}
                                title="Eliminar paso"
                              >
                                <Icon name="trash" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Proceso */}
      {showProcesoModal && (
        <div className="modal-overlay" onClick={() => setShowProcesoModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowProcesoModal(false)}>×</button>
            <h2>{editingProceso ? 'Editar Proceso' : 'Nuevo Proceso'}</h2>
            <div className="modal-form">
              <div className="form-group">
                <label htmlFor="proceso-nombre">Nombre del Proceso *</label>
                <input
                  type="text"
                  id="proceso-nombre"
                  value={procesoForm.nombre}
                  onChange={(e) => setProcesoForm({ ...procesoForm, nombre: e.target.value })}
                  placeholder="Ej: Está lenta, No prende, etc."
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="proceso-descripcion">Descripción</label>
                <textarea
                  id="proceso-descripcion"
                  value={procesoForm.descripcion}
                  onChange={(e) => setProcesoForm({ ...procesoForm, descripcion: e.target.value })}
                  placeholder="Descripción opcional del proceso"
                  rows="3"
                />
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowProcesoModal(false)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={handleSaveProceso}>
                  {editingProceso ? 'Guardar Cambios' : 'Crear Proceso'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Subproceso */}
      {showSubprocesoModal && (
        <div className="modal-overlay" onClick={() => setShowSubprocesoModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowSubprocesoModal(false)}>×</button>
            <h2>{editingSubproceso ? 'Editar Paso' : 'Nuevo Paso'}</h2>
            <div className="modal-form">
              <div className="form-group">
                <label htmlFor="subproceso-nombre">Nombre del Paso *</label>
                <input
                  type="text"
                  id="subproceso-nombre"
                  value={subprocesoForm.nombre}
                  onChange={(e) => setSubprocesoForm({ ...subprocesoForm, nombre: e.target.value })}
                  placeholder="Ej: Verificar tipo de disco, Limpiar sistema, etc."
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="subproceso-descripcion">Descripción</label>
                <textarea
                  id="subproceso-descripcion"
                  value={subprocesoForm.descripcion}
                  onChange={(e) => setSubprocesoForm({ ...subprocesoForm, descripcion: e.target.value })}
                  placeholder="Descripción opcional del paso"
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label htmlFor="subproceso-orden">Orden *</label>
                <input
                  type="number"
                  id="subproceso-orden"
                  value={subprocesoForm.orden}
                  onChange={(e) => setSubprocesoForm({ ...subprocesoForm, orden: parseInt(e.target.value) || 1 })}
                  min="1"
                  required
                />
                <small>El orden determina la secuencia de pasos en el proceso</small>
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowSubprocesoModal(false)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={handleSaveSubproceso}>
                  {editingSubproceso ? 'Guardar Cambios' : 'Crear Paso'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

