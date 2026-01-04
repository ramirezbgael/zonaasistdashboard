import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabase.js';
import { notificarEquipoListo, notificarEquipoFinalizado } from '../utils/notifications.js';
import Icon from './Icon.jsx';
import NotaPDF from './NotaPDF.jsx';
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
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactData, setContactData] = useState({ telefono: null, nombreCliente: 'el cliente' });
  const [respuestaPaso, setRespuestaPaso] = useState('');
  const [completandoPaso, setCompletandoPaso] = useState(false);
  const [showNotaPDFModal, setShowNotaPDFModal] = useState(false);
  const [tipoNotaPDF, setTipoNotaPDF] = useState(null); // 'recepcion' o 'entrega'
  const [showEntregaSuccess, setShowEntregaSuccess] = useState(false);
  const ruletaWrapperRef = useRef(null);

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

  const marcarSubprocesoCompletado = async (subprocesoId, respuesta = '') => {
    if (completandoPaso) return;
    
    setCompletandoPaso(true);
    try {
      const subproceso = subprocesos.find(s => s.id === subprocesoId);
      
      // Construir el mensaje de notas con la respuesta si existe
      let notas = `Completado: ${subproceso?.nombre}`;
      if (respuesta.trim()) {
        notas = `${notas}\nRespuesta: ${respuesta.trim()}`;
      }
      
      const { error } = await supabase
        .from('historial_procesos')
        .insert({
          equipo_id: equipo.id,
          proceso_id: procesoActual,
          subproceso_id: subprocesoId,
          completado: true,
          notas: notas,
          fecha_completado: new Date().toISOString()
        });

      if (error) throw error;
      
      // Limpiar respuesta y recargar
      setRespuestaPaso('');
      loadHistorial();
      loadEstadoEquipo(); // Recargar para actualizar el siguiente paso
    } catch (error) {
      console.error('Error al completar subproceso:', error);
      alert('Error al completar el paso. Por favor intenta de nuevo.');
    } finally {
      setCompletandoPaso(false);
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

      // Crear notificación de equipo listo (para enviar WhatsApp)
      try {
        await notificarEquipoListo(equipo, cliente);
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
      // Disparar evento para actualizar el dashboard
      window.dispatchEvent(new Event('equipoUpdated'));
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
    let entregaSuccess = false;
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

      entregaSuccess = true;
    } catch (error) {
      console.error('Error al finalizar equipo:', error);
      alert('Error al finalizar el equipo');
    }

    // Feedback visual y PDF SIEMPRE que la entrega fue exitosa
    if (entregaSuccess) {
      setShowEntregaModal(false);
      setEntregaLoading(false);
      setShowEntregaSuccess(true);
      setTipoNotaPDF('entrega');
      setShowNotaPDFModal(true);

      setTimeout(() => {
        setShowEntregaSuccess(false);
        setShowNotaPDFModal(false);
        onEquipoUpdated?.();
        window.dispatchEvent(new Event('equipoUpdated'));
        onClose();
      }, 2000);
    } else {
      setEntregaLoading(false);
      setShowEntregaModal(false);
    }

    // Notificación/email: nunca bloquea feedback visual
    if (entregaSuccess) {
      try {
        await notificarEquipoFinalizado(equipo, cliente);
      } catch (notifError) {
        console.error('Error creando notificación (no crítico):', notifError);
      }
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

  // Funciones para contacto del cliente
  const handleContactarCliente = async (e) => {
    e?.stopPropagation();
    
    let telefono = null;
    let nombreCliente = 'el cliente';
    
    if (cliente?.telefono) {
      telefono = cliente.telefono;
      nombreCliente = cliente.nombre || nombreCliente;
    }
    
    if (!telefono) {
      setContactData({ telefono: null, nombreCliente, necesitaTelefono: true });
      setShowContactModal(true);
      return;
    }
    
    const numeroLimpio = telefono.replace(/\D/g, '');
    
    if (!numeroLimpio) {
      setContactData({ telefono: null, nombreCliente, error: 'Número de teléfono inválido' });
      setShowContactModal(true);
      return;
    }
    
    setContactData({ telefono: numeroLimpio, nombreCliente });
    setShowContactModal(true);
  };

  const handleContactarTelefono = () => {
    if (!contactData.telefono) return;
    window.open(`tel:${contactData.telefono}`, '_self');
    setShowContactModal(false);
  };


  // Calcular valores derivados ANTES de usarlos en funciones
  const siguienteSubproceso = getSiguienteSubproceso();
  const subprocesosCompletados = getSubprocesosCompletados();
  const procesoInfo = procesos.find(p => p.id === procesoActual);

  const handleContactarWhatsApp = () => {
    if (!contactData.telefono) return;
    
    let mensajeTexto = `Hola ${contactData.nombreCliente}! Te escribo de Zona Asist sobre tu equipo #${equipo.nota} (${equipo.marca} ${equipo.modelo}).`;
    
    if (estadoEquipo?.estado === 'listo') {
      mensajeTexto += ' Tu equipo ya está listo para recoger. ¡Saludos!';
    } else if (estadoEquipo?.estado === 'finalizado') {
      mensajeTexto += ' Ya fue entregado. ¡Gracias!';
    } else if (siguienteSubproceso) {
      mensajeTexto += ` Actualmente está en: ${siguienteSubproceso.nombre}. ¡Saludos!`;
    } else {
      mensajeTexto += ' ¡Saludos!';
    }
    
    const mensaje = encodeURIComponent(mensajeTexto);
    window.open(`https://wa.me/52${contactData.telefono}?text=${mensaje}`, '_blank');
    setShowContactModal(false);
  };

  const handleGuardarTelefono = () => {
    const telefonoInput = document.getElementById('telefono-input-modal');
    if (!telefonoInput || !telefonoInput.value.trim()) {
      setContactData(prev => ({ ...prev, error: 'Por favor ingresa un número de teléfono' }));
      return;
    }
    
    const numeroLimpio = telefonoInput.value.replace(/\D/g, '');
    if (!numeroLimpio) {
      setContactData(prev => ({ ...prev, error: 'Número de teléfono inválido' }));
      return;
    }
    
    setContactData(prev => ({ ...prev, telefono: numeroLimpio, necesitaTelefono: false, error: null }));
  };

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

  // Efecto para centrar el paso actual en la ruleta
  useEffect(() => {
    if (siguienteSubproceso && ruletaWrapperRef.current && allSubprocesos.length > 0) {
      const activeIndex = allSubprocesos.findIndex(s => s.isNext);
      if (activeIndex !== -1) {
        const stepHeight = 200; // altura de cada paso
        const windowHeight = 200; // altura de la ventana visible
        const scrollPosition = activeIndex * stepHeight - (windowHeight / 2) + (stepHeight / 2);
        
        // Scroll suave al paso activo
        setTimeout(() => {
          if (ruletaWrapperRef.current) {
            ruletaWrapperRef.current.style.transform = `translateY(-${scrollPosition}px)`;
          }
        }, 100);
      }
    }
  }, [siguienteSubproceso, allSubprocesos]);

  return (
    <div className="equipo-modal-overlay" onClick={handleOverlayClick}>
      <div className="equipo-modal" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="equipo-modal-close-btn">
          <Icon name="times" />
        </button>
        
        {/* Paso actual - LO MÁS IMPORTANTE, PRIMERO EN MÓVIL */}
          {siguienteSubproceso && (
            <div className="paso-actual-mobile">
              <div className="paso-actual-icon">
                <Icon name="clipboard-list" />
              </div>
              <div className="paso-actual-content">
                <span className="paso-actual-label">Paso actual</span>
                <h2 className="paso-actual-nombre">{siguienteSubproceso.nombre}</h2>
              </div>
            </div>
          )}

        <div className="equipo-modal-content-wrapper">
        {/* Header con información del equipo - Simplificado, sin background */}
          <div className="equipo-modal-header">
          <div className="equipo-header-main">
            <div className="equipo-numero-badge" onClick={() => {
              setTipoNotaPDF('recepcion');
              setShowNotaPDFModal(true);
            }} style={{ cursor: 'pointer' }} title="Ver nota de recepción">
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
          
          {/* Cliente - Justo después del header, bien visible */}
          {cliente && (
            <div className="cliente-card-mobile">
              <div className="cliente-mobile-info">
                <Icon name="user" className="cliente-mobile-icon" />
                <div className="cliente-mobile-details">
                  <p className="cliente-mobile-nombre">{cliente.nombre || 'Sin nombre'}</p>
                  <span className="cliente-mobile-telefono">{cliente.telefono || 'Sin teléfono'}</span>
                </div>
              </div>
              <button 
                className="btn-contactar-cliente-mobile"
                onClick={handleContactarCliente}
                title="Contactar cliente"
              >
                <Icon name="phone" />
                <span>Contactar</span>
              </button>
            </div>
          )}

          {/* Información adicional en grid - Solo desktop */}
          <div className="equipo-info-grid">
            {/* Información del Cliente - Desktop */}
            {cliente && (
              <div className="info-card cliente-card desktop-only">
                <div className="info-card-header cliente-header-compact">
                  <div className="cliente-header-left">
                    <Icon name="user" className="info-card-icon" />
                    <div className="cliente-info-compact">
                      <p className="info-card-value">{cliente.nombre || 'Sin nombre'}</p>
                      {cliente.telefono && (
                        <span className="cliente-telefono-compact">{cliente.telefono}</span>
                      )}
                    </div>
                  </div>
                  <button 
                    className="btn-contactar-cliente"
                    onClick={handleContactarCliente}
                    title="Contactar cliente"
                  >
                    <Icon name="phone" />
                    <span>Contactar</span>
                  </button>
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

        {/* Paso Actual Simplificado - UI Clara */}
        {siguienteSubproceso && (
          <div className="paso-actual-simple-section">
            <div className="paso-actual-simple-header">
              <div className="paso-actual-simple-progress">
                <span className="paso-actual-simple-progress-text">
                  Paso {subprocesosCompletados.length + 1} de {subprocesos.length}
                </span>
                <div className="progress-bar-container">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            {/* Paso Actual Destacado */}
            <div className="paso-actual-simple-card">
              <div className="paso-actual-simple-icon-wrapper">
                <Icon name="clipboard-list" className="paso-actual-simple-icon" />
              </div>
              <div className="paso-actual-simple-content">
                <h3 className="paso-actual-simple-title">{siguienteSubproceso.nombre}</h3>
                {siguienteSubproceso.descripcion && (
                  <p className="paso-actual-simple-description">{siguienteSubproceso.descripcion}</p>
                )}
              </div>
            </div>
            
            {/* Input Grande y Claro */}
            <div className="paso-actual-simple-input-section">
              <label className="paso-actual-simple-input-label">
                <Icon name="edit" className="input-label-icon" />
                {siguienteSubproceso.nombre.includes('Verificar') || siguienteSubproceso.nombre.includes('Preguntar') 
                  ? '¿Qué resultado obtuviste?'
                  : 'Ingresa el resultado o comentario'
                }
              </label>
              <input
                type="text"
                className="paso-actual-simple-input"
                placeholder={siguienteSubproceso.nombre.includes('disco') 
                  ? 'Ej: SSD 500GB, HDD 1TB, NVMe 256GB...' 
                  : siguienteSubproceso.nombre.includes('respaldo') 
                  ? 'Ej: Sí, necesita respaldo / No, no necesita respaldo'
                  : siguienteSubproceso.nombre.includes('espacio')
                  ? 'Ej: 500GB, 1TB, 2TB...'
                  : 'Escribe aquí el resultado...'
                }
                value={respuestaPaso}
                onChange={(e) => setRespuestaPaso(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && respuestaPaso.trim()) {
                    e.preventDefault();
                    marcarSubprocesoCompletado(siguienteSubproceso.id, respuestaPaso);
                  }
                }}
                disabled={completandoPaso}
                autoFocus
              />
              <button 
                className="btn-completar-paso-simple"
                onClick={() => marcarSubprocesoCompletado(siguienteSubproceso.id, respuestaPaso)}
                disabled={completandoPaso || loading || !respuestaPaso.trim()}
              >
                {completandoPaso ? (
                  <>
                    <Icon name="sync" className="spinning" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Icon name="check-circle" />
                    Completar este paso
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        </div>

        {/* Acciones principales */}
        <div className="equipo-modal-actions">
          {/* Botones de Notas PDF */}
          <div className="actions-row">
            <button 
              className="btn-nota-pdf full-width"
              onClick={() => {
                setTipoNotaPDF('recepcion');
                setShowNotaPDFModal(true);
              }}
              title="Generar nota de recepción"
            >
              <Icon name="file-alt" />
              Nota de Recepción
            </button>
            
            {(estadoEquipo?.estado === 'listo' || estadoEquipo?.estado === 'finalizado') && (
              <button 
                className="btn-nota-pdf full-width"
                onClick={() => {
                  setTipoNotaPDF('entrega');
                  setShowNotaPDFModal(true);
                }}
                title="Generar nota de entrega"
              >
                <Icon name="file-alt" />
                Nota de Entrega
              </button>
            )}
          </div>

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

        {/* Modal de Contacto */}
        {showContactModal && createPortal(
          <div className="contact-modal-overlay" onClick={() => setShowContactModal(false)}>
            <div className="contact-modal" onClick={(e) => e.stopPropagation()}>
              <button 
                className="contact-modal-close" 
                onClick={() => setShowContactModal(false)}
              >
                <Icon name="times" />
              </button>
              
              {contactData.necesitaTelefono ? (
                <div className="contact-modal-content">
                  <div className="contact-modal-icon">
                    <Icon name="phone" />
                  </div>
                  <h2 className="contact-modal-title">Número de Teléfono</h2>
                  <p className="contact-modal-description">
                    No se encontró el número de teléfono del cliente para el equipo #{equipo.nota}.
                    <br />
                    Por favor ingresa el número:
                  </p>
                  
                  {contactData.error && (
                    <div className="contact-modal-error">
                      <Icon name="exclamation-circle" />
                      <span>{contactData.error}</span>
                    </div>
                  )}
                  
                  <div className="contact-modal-input-wrapper">
                    <Icon name="phone" className="contact-input-icon" />
                    <input
                      id="telefono-input-modal"
                      type="tel"
                      className="contact-modal-input"
                      placeholder="Número de teléfono"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleGuardarTelefono();
                        }
                      }}
                    />
                  </div>
                  
                  <div className="contact-modal-actions">
                    <button 
                      className="contact-btn contact-btn-secondary"
                      onClick={() => setShowContactModal(false)}
                    >
                      Cancelar
                    </button>
                    <button 
                      className="contact-btn contact-btn-primary"
                      onClick={handleGuardarTelefono}
                    >
                      <Icon name="check" />
                      Continuar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="contact-modal-content">
                  <div className="contact-modal-icon">
                    <Icon name="user-circle" />
                  </div>
                  <h2 className="contact-modal-title">
                    ¿Cómo deseas contactar a {contactData.nombreCliente}?
                  </h2>
                  <p className="contact-modal-description">
                    Elige el método de contacto preferido
                  </p>
                  
                  <div className="contact-modal-options">
                    <button 
                      className="contact-option-btn"
                      onClick={handleContactarTelefono}
                    >
                      <div className="contact-option-icon phone">
                        <Icon name="phone" />
                      </div>
                      <div className="contact-option-content">
                        <h3>Llamar por teléfono</h3>
                        <p>{contactData.telefono}</p>
                      </div>
                    </button>
                    
                    <button 
                      className="contact-option-btn"
                      onClick={handleContactarWhatsApp}
                    >
                      <div className="contact-option-icon whatsapp">
                        <Icon name="comment" />
                      </div>
                      <div className="contact-option-content">
                        <h3>Enviar WhatsApp</h3>
                        <p>{contactData.telefono}</p>
                      </div>
                    </button>
                  </div>
                  
                  <button 
                    className="contact-btn contact-btn-secondary contact-btn-full"
                    onClick={() => setShowContactModal(false)}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

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

        {/* Modal de Nota PDF */}
        {showNotaPDFModal && tipoNotaPDF && (
          <NotaPDF
            equipo={{
              ...equipo,
              procesos: procesoInfo
            }}
            cliente={cliente}
            tipo={tipoNotaPDF}
            onClose={() => {
              setShowNotaPDFModal(false);
              setTipoNotaPDF(null);
            }}
          />
        )}

        {/* Feedback visual de éxito */}
        {showEntregaSuccess && (
          <div className="entrega-success-modal">
            <div className="entrega-success-content">
              <Icon name="check-circle" className="text-green-500 text-5xl mb-4" />
              <h2 className="text-xl font-bold text-green-400 mb-2">¡Equipo entregado exitosamente!</h2>
              <p className="text-slate-300">La nota de entrega se generó correctamente.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}