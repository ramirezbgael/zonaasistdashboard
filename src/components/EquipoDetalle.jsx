import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import { notificarEquipoListo, notificarEquipoFinalizado } from '../utils/notifications.js';
import { getEquipoPhotos } from '../services/photoUpload.service.js';
import Icon from './Icon.jsx';
import NotaPDF from './NotaPDF.jsx';
import './EquipoDetalle.css';

export default function EquipoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [equipo, setEquipo] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [estadoEquipo, setEstadoEquipo] = useState(null);
  const [procesoInfo, setProcesoInfo] = useState(null);
  const [procesosEquipo, setProcesosEquipo] = useState([]); // Todos los procesos asociados al equipo con precios
  const [subprocesos, setSubprocesos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respuestaPaso, setRespuestaPaso] = useState('');
  const [completandoPaso, setCompletandoPaso] = useState(false);
  const [showNotaPDFModal, setShowNotaPDFModal] = useState(false);
  const [tipoNotaPDF, setTipoNotaPDF] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showComentarioModal, setShowComentarioModal] = useState(false);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showOpcionesEspeciales, setShowOpcionesEspeciales] = useState(false);
  const [procesosDisponibles, setProcesosDisponibles] = useState([]);
  const [procesoSeleccionado, setProcesoSeleccionado] = useState(null);
  const [justificacionFinalizado, setJustificacionFinalizado] = useState('');
  const [cambiandoProceso, setCambiandoProceso] = useState(false);
  const [finalizandoConJustificacion, setFinalizandoConJustificacion] = useState(false);

  useEffect(() => {
    loadCurrentUser();
    if (id) {
      loadEquipo();
    }
    loadProcesosDisponibles();
  }, [id]);

  const loadProcesosDisponibles = async () => {
    try {
      const { data, error } = await supabase
        .from('procesos')
        .select('id, nombre')
        .order('nombre');
      
      if (error) throw error;
      setProcesosDisponibles(data || []);
    } catch (error) {
      console.error('Error loading procesos:', error);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (user) {
        setCurrentUser(user);
        console.log('Current user loaded:', user.id);
      } else {
        console.warn('No user found');
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadEquipo = async () => {
    setLoading(true);
    try {
      // Load equipo with cliente - explicitly select all fields including contraseña
      const { data: equipoData, error: equipoError } = await supabase
        .from('equipos')
        .select(`
          id,
          nota,
          marca,
          modelo,
          color,
          problema,
          contraseña,
          cargador,
          cliente_id,
          created_at,
          clientes (
            id,
            nombre,
            telefono,
            email
          )
        `)
        .eq('id', id)
        .single();

      if (equipoError) throw equipoError;
      setEquipo(equipoData);
      
      // Set cliente - handle both nested and separate loading
      if (equipoData.clientes) {
        setCliente(equipoData.clientes);
      } else if (equipoData.cliente_id) {
        // If cliente not loaded via relation, load it separately
        const { data: clienteData, error: clienteError } = await supabase
          .from('clientes')
          .select('id, nombre, telefono, email')
          .eq('id', equipoData.cliente_id)
          .single();
        
        if (!clienteError && clienteData) {
          setCliente(clienteData);
        }
      }

      // Load estado
      await loadEstadoEquipo();
      
      // Load procesos asociados al equipo con precios
      await loadProcesosEquipo();
      
      // Load historial/timeline
      await loadHistorial();
      
      // Load photos
      await loadFotos();
    } catch (error) {
      console.error('Error loading equipo:', error);
    } finally {
      setLoading(false);
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
            descripcion,
            precio
          )
        `)
        .eq('equipo_id', id)
        .maybeSingle();
      
      if (error) throw error;
      setEstadoEquipo(data);
      
      if (data?.proceso_actual_id) {
        setProcesoInfo(data.procesos);
        await loadSubprocesos(data.proceso_actual_id);
      }
    } catch (error) {
      console.error('Error loading estado:', error);
    }
  };

  const loadProcesosEquipo = async () => {
    try {
      // 1. Cargar procesos desde equipo_procesos (con precios)
      const { data: epData, error: epError } = await supabase
        .from('equipo_procesos')
        .select(`
          proceso_id,
          procesos (
            id,
            nombre,
            precio
          )
        `)
        .eq('equipo_id', id);

      let procesosConPrecio = [];

      if (!epError && epData?.length) {
        procesosConPrecio = epData
          .map((ep) => ({
            id: ep.procesos?.id,
            nombre: ep.procesos?.nombre,
            precio: parseFloat(ep.procesos?.precio) || 0,
          }))
          .filter((p) => p.id);
      }

      // 2. Si no hay nada en equipo_procesos, usar proceso actual de estado_equipos
      if (procesosConPrecio.length === 0) {
        const { data: estado, error: estadoErr } = await supabase
          .from('estado_equipos')
          .select('proceso_actual_id')
          .eq('equipo_id', id)
          .maybeSingle();

        if (!estadoErr && estado?.proceso_actual_id) {
          const { data: proc, error: procErr } = await supabase
            .from('procesos')
            .select('id, nombre, precio')
            .eq('id', estado.proceso_actual_id)
            .single();

          if (!procErr && proc) {
            procesosConPrecio = [
              {
                id: proc.id,
                nombre: proc.nombre,
                precio: parseFloat(proc.precio) || 0,
              },
            ];
          }
        }
      }

      setProcesosEquipo(procesosConPrecio);
    } catch (error) {
      console.error('Error loading procesos del equipo:', error);
      setProcesosEquipo([]);
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
      console.error('Error loading subprocesos:', error);
    }
  };

  const loadHistorial = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('historial_procesos')
        .select(`
          *,
          procesos (nombre),
          subprocesos (nombre)
        `)
        .eq('equipo_id', id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const historialConProfiles = await Promise.all(
        (data || []).map(async (evento) => {
          if (!evento.usuario_id) return { ...evento, profiles: null };

          // Si es el usuario actual, usar su metadata directamente (más rápido y confiable)
          if (currentUser?.id === evento.usuario_id) {
            const nombre = currentUser.user_metadata?.nombre 
              || currentUser.user_metadata?.full_name 
              || currentUser.email?.split('@')[0] 
              || 'Yo';
            return { 
              ...evento, 
              profiles: { 
                id: currentUser.id, 
                nombre, 
                email: currentUser.email, 
                foto_url: currentUser.user_metadata?.avatar_url ?? null 
              }
            };
          }

          // Para otros usuarios, intentar cargar el perfil (puede fallar por RLS)
          try {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('id, nombre, email, foto_url')
              .eq('id', evento.usuario_id)
              .maybeSingle();
            
            if (profile && !profileError) {
              return { ...evento, profiles: profile };
            }
          } catch (err) {
            // Silenciosamente ignorar errores de RLS (400, 403, etc.)
            // El perfil quedará como null y se mostrará "Sistema"
          }
          
          return { ...evento, profiles: null };
        })
      );
      
      setHistorial(historialConProfiles);
    } catch (error) {
      console.error('Error loading historial:', error);
      // Fallback: load without profiles
      try {
        const { data, error: fallbackError } = await supabase
          .from('historial_procesos')
          .select(`
            *,
            procesos (nombre),
            subprocesos (nombre)
          `)
          .eq('equipo_id', id)
          .order('created_at', { ascending: false });
        
        if (!fallbackError) {
          setHistorial(data || []);
        }
      } catch (fallbackErr) {
        console.error('Fallback query also failed:', fallbackErr);
      }
    }
  };

  const loadFotos = async () => {
    try {
      const fotosData = await getEquipoPhotos(id);
      setFotos(fotosData || []);
    } catch (error) {
      console.error('Error loading photos:', error);
      setFotos([]);
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

  const siguienteSubproceso = getSiguienteSubproceso();
  const subprocesosCompletados = subprocesos.filter(subproceso => getSubprocesoStatus(subproceso.id) === 'completado');
  const progressPercentage = subprocesos.length > 0 
    ? (subprocesosCompletados.length / subprocesos.length) * 100 
    : 0;

  const marcarSubprocesoCompletado = async (subprocesoId, respuesta = '') => {
    if (completandoPaso) return;
    
    setCompletandoPaso(true);
    try {
      const subproceso = subprocesos.find(s => s.id === subprocesoId);
      
      let notas = `Completado: ${subproceso?.nombre}`;
      if (respuesta.trim()) {
        notas = `${notas}\nRespuesta: ${respuesta.trim()}`;
      }
      
      const usuarioId = currentUser?.id;
      if (!usuarioId) {
        console.error('No user ID available. Current user:', currentUser);
        alert('Error: No se pudo identificar el usuario. Por favor recarga la página.');
        return;
      }

      const { error } = await supabase
        .from('historial_procesos')
        .insert({
          equipo_id: id,
          proceso_id: estadoEquipo?.proceso_actual_id,
          subproceso_id: subprocesoId,
          completado: true,
          notas: notas,
          fecha_completado: new Date().toISOString(),
          usuario_id: usuarioId,
          tipo_evento: 'subproceso'
        });

      if (error) throw error;
      
      setRespuestaPaso('');
      await loadHistorial();
      await loadEstadoEquipo();
    } catch (error) {
      console.error('Error completing subproceso:', error);
      alert('Error al completar el paso. Por favor intenta de nuevo.');
    } finally {
      setCompletandoPaso(false);
    }
  };

  const marcarComoListo = async () => {
    if (!confirm('¿Estás seguro de que quieres marcar este equipo como listo? Se moverá a la lista de "Listos para recoger".')) {
      return;
    }

    try {
      const { data: estadoExistente, error: consultaError } = await supabase
        .from('estado_equipos')
        .select('id')
        .eq('equipo_id', id)
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
            proceso_actual_id: estadoEquipo?.proceso_actual_id,
            updated_at: new Date().toISOString()
          })
          .eq('equipo_id', id);
        estadoError = error;
      } else {
        const { error } = await supabase
          .from('estado_equipos')
          .insert({
            equipo_id: id,
            estado: 'listo',
            proceso_actual_id: estadoEquipo?.proceso_actual_id,
            updated_at: new Date().toISOString()
          });
        estadoError = error;
      }

      if (estadoError) throw estadoError;

      // Create notification
      try {
        await notificarEquipoListo(equipo, cliente);
      } catch (notifError) {
        console.error('Error creating notification (non-critical):', notifError);
      }

      const usuarioId = currentUser?.id;
      if (!usuarioId) {
        console.error('No user ID available for marcarComoListo');
        alert('Error: No se pudo identificar el usuario. Por favor recarga la página.');
        return;
      }

      const { error: historialError } = await supabase
        .from('historial_procesos')
        .insert({
          equipo_id: id,
          proceso_id: estadoEquipo?.proceso_actual_id,
          notas: 'Equipo terminado y listo para entrega',
          completado: true,
          fecha_completado: new Date().toISOString(),
          usuario_id: usuarioId,
          tipo_evento: 'estado'
        });

      if (historialError) throw historialError;

      alert('Equipo marcado como listo exitosamente');
      window.dispatchEvent(new Event('equipoUpdated'));
      await loadEstadoEquipo();
      await loadHistorial();
    } catch (error) {
      console.error('Error marking equipo as ready:', error);
      alert('Error al marcar el equipo como listo');
    }
  };

  const cambiarProceso = async () => {
    if (!procesoSeleccionado) {
      alert('Por favor selecciona un proceso');
      return;
    }

    if (!confirm(`¿Estás seguro de cambiar el proceso a "${procesosDisponibles.find(p => p.id === procesoSeleccionado)?.nombre}"?`)) {
      return;
    }

    setCambiandoProceso(true);
    try {
      const usuarioId = currentUser?.id;
      if (!usuarioId) {
        alert('Error: No se pudo identificar el usuario');
        return;
      }

      // Actualizar estado_equipos
      const { data: estadoExistente } = await supabase
        .from('estado_equipos')
        .select('id')
        .eq('equipo_id', id)
        .maybeSingle();

      if (estadoExistente) {
        const { error: estadoError } = await supabase
          .from('estado_equipos')
          .update({
            proceso_actual_id: procesoSeleccionado,
            updated_at: new Date().toISOString()
          })
          .eq('equipo_id', id);

        if (estadoError) throw estadoError;
      } else {
        const { error: estadoError } = await supabase
          .from('estado_equipos')
          .insert({
            equipo_id: id,
            proceso_actual_id: procesoSeleccionado,
            estado: 'en_proceso',
            updated_at: new Date().toISOString()
          });

        if (estadoError) throw estadoError;
      }

      // Verificar si el proceso ya está en equipo_procesos, si no, agregarlo
      const { data: procesoExistente } = await supabase
        .from('equipo_procesos')
        .select('id')
        .eq('equipo_id', id)
        .eq('proceso_id', procesoSeleccionado)
        .maybeSingle();

      if (!procesoExistente) {
        // Agregar el proceso a equipo_procesos
        const { error: equipoProcesoError } = await supabase
          .from('equipo_procesos')
          .insert({
            equipo_id: id,
            proceso_id: procesoSeleccionado
          });

        if (equipoProcesoError) {
          console.warn('Error al agregar proceso a equipo_procesos (no crítico):', equipoProcesoError);
        }
      }

      // Registrar en historial
      const procesoNombre = procesosDisponibles.find(p => p.id === procesoSeleccionado)?.nombre;
      const { error: historialError } = await supabase
        .from('historial_procesos')
        .insert({
          equipo_id: id,
          proceso_id: procesoSeleccionado,
          notas: `OPCIÓN ESPECIAL: Proceso cambiado a "${procesoNombre}"`,
          completado: null,
          usuario_id: usuarioId,
          tipo_evento: 'cambio_proceso'
        });

      if (historialError) throw historialError;

      alert('Proceso cambiado exitosamente');
      setShowOpcionesEspeciales(false);
      setProcesoSeleccionado(null);
      await loadEquipo();
    } catch (error) {
      console.error('Error cambiando proceso:', error);
      alert('Error al cambiar el proceso');
    } finally {
      setCambiandoProceso(false);
    }
  };

  const finalizarConJustificacion = async () => {
    if (!justificacionFinalizado.trim()) {
      alert('Por favor proporciona una justificación');
      return;
    }

    if (!confirm('¿Estás seguro de marcar este equipo como finalizado sin completar el proceso?')) {
      return;
    }

    setFinalizandoConJustificacion(true);
    try {
      const usuarioId = currentUser?.id;
      if (!usuarioId) {
        alert('Error: No se pudo identificar el usuario');
        return;
      }

      // Actualizar estado a finalizado
      const { error: estadoError } = await supabase
        .from('estado_equipos')
        .update({
          estado: 'finalizado',
          updated_at: new Date().toISOString()
        })
        .eq('equipo_id', id);

      if (estadoError) throw estadoError;

      // Registrar en historial con justificación
      const { error: historialError } = await supabase
        .from('historial_procesos')
        .insert({
          equipo_id: id,
          proceso_id: estadoEquipo?.proceso_actual_id,
          notas: `OPCIÓN ESPECIAL: Equipo finalizado sin completar proceso. Justificación: ${justificacionFinalizado.trim()}`,
          completado: true,
          fecha_completado: new Date().toISOString(),
          usuario_id: usuarioId,
          tipo_evento: 'finalizacion_especial'
        });

      if (historialError) throw historialError;

      // Create notification
      try {
        await notificarEquipoFinalizado(equipo, cliente);
      } catch (notifError) {
        console.error('Error creating notification (non-critical):', notifError);
      }

      alert('Equipo marcado como finalizado exitosamente');
      setShowOpcionesEspeciales(false);
      setJustificacionFinalizado('');
      await loadEquipo();
    } catch (error) {
      console.error('Error finalizando equipo:', error);
      alert('Error al finalizar el equipo');
    } finally {
      setFinalizandoConJustificacion(false);
    }
  };

  const marcarComoFinalizado = async () => {
    if (!confirm('¿Estás seguro de que quieres marcar este equipo como entregado?')) {
      return;
    }

    try {
      const { error: estadoError } = await supabase
        .from('estado_equipos')
        .update({
          estado: 'finalizado',
          updated_at: new Date().toISOString()
        })
        .eq('equipo_id', id);

      if (estadoError) throw estadoError;

      const usuarioId = currentUser?.id;
      if (!usuarioId) {
        console.error('No user ID available for marcarComoFinalizado');
        alert('Error: No se pudo identificar el usuario. Por favor recarga la página.');
        return;
      }

      const { error: historialError } = await supabase
        .from('historial_procesos')
        .insert({
          equipo_id: id,
          proceso_id: estadoEquipo?.proceso_actual_id,
          notas: 'Equipo entregado al cliente',
          completado: true,
          fecha_completado: new Date().toISOString(),
          usuario_id: usuarioId,
          tipo_evento: 'entrega'
        });

      if (historialError) throw historialError;

      // Create notification
      try {
        await notificarEquipoFinalizado(equipo, cliente);
      } catch (notifError) {
        console.error('Error creating notification (non-critical):', notifError);
      }

      setTipoNotaPDF('entrega');
      setShowNotaPDFModal(true);

      setTimeout(() => {
        setShowNotaPDFModal(false);
        window.dispatchEvent(new Event('equipoUpdated'));
        navigate('/equipos');
      }, 2000);
    } catch (error) {
      console.error('Error finalizing equipo:', error);
      alert('Error al finalizar el equipo');
    }
  };

  const agregarComentario = async () => {
    if (!nuevoComentario.trim()) {
      alert('Por favor ingresa un comentario');
      return;
    }

    if (!currentUser?.id) {
      alert('Error: No se pudo identificar el usuario. Por favor recarga la página.');
      return;
    }

    try {
      const { error } = await supabase
        .from('historial_procesos')
        .insert({
          equipo_id: id,
          proceso_id: estadoEquipo?.proceso_actual_id || null,
          notas: nuevoComentario.trim(),
          completado: false,
          usuario_id: currentUser.id,
          tipo_evento: 'nota'
        });

      if (error) throw error;

      setNuevoComentario('');
      setShowComentarioModal(false);
      await loadHistorial();
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Error al agregar el comentario. Por favor intenta de nuevo.');
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

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getColorHex = (colorName) => {
    if (!colorName) return '#cccccc';
    const colorMap = {
      'negro': '#000000',
      'blanco': '#ffffff',
      'gris': '#808080',
      'plateado': '#c0c0c0',
      'dorado': '#ffd700',
      'rojo': '#ff0000',
      'azul': '#0000ff',
      'verde': '#008000',
      'amarillo': '#ffff00',
      'naranja': '#ffa500',
      'morado': '#800080',
      'rosa': '#ffc0cb',
      'marrón': '#8b4513',
      'beige': '#f5f5dc',
      'turquesa': '#40e0d0',
      'violeta': '#8a2be2',
      'coral': '#ff7f50',
      'ocre': '#cc7722',
      'perla': '#f8f6f0',
      'champagne': '#f7e7ce'
    };
    const normalized = colorName.toLowerCase().trim();
    return colorMap[normalized] || '#cccccc';
  };

  const getContrastColor = (colorName) => {
    if (!colorName) return '#000000';
    const lightColors = ['blanco', 'beige', 'perla', 'champagne', 'amarillo', 'rosa'];
    const normalized = colorName.toLowerCase().trim();
    return lightColors.includes(normalized) ? '#000000' : '#ffffff';
  };

  const handleContactarCliente = () => {
    if (!cliente?.telefono) {
      alert('No hay número de teléfono disponible para este cliente');
      return;
    }
    
    const numeroLimpio = cliente.telefono.replace(/\D/g, '');
    if (!numeroLimpio) {
      alert('Número de teléfono inválido');
      return;
    }
    
    const mensajeTexto = `Hola ${cliente.nombre || 'cliente'}! Te escribo de Zona Asist sobre tu equipo #${equipo.nota} (${equipo.marca} ${equipo.modelo}).`;
    const mensaje = encodeURIComponent(mensajeTexto);
    window.open(`https://wa.me/52${numeroLimpio}?text=${mensaje}`, '_blank');
  };

  if (loading) {
    return (
      <div className="equipo-detalle-loading">
        <Icon name="sync" className="spinning" />
        <p>Cargando información del equipo...</p>
      </div>
    );
  }

  if (!equipo) {
    return (
      <div className="equipo-detalle-error">
        <Icon name="exclamation-triangle" />
        <p>Equipo no encontrado</p>
        <button onClick={() => navigate('/equipos')} className="btn-back">
          Volver a Equipos
        </button>
      </div>
    );
  }

  return (
    <div className="equipo-detalle">
      {/* Top Header */}
      <header className="equipo-detalle-header">
        <button onClick={() => navigate('/equipos')} className="header-back-btn">
          <Icon name="arrow-left" />
        </button>
        <div className="header-content">
          <div className="header-equipo-number">#{equipo.nota}</div>
          <div className="header-equipo-model">{equipo.marca} {equipo.modelo}</div>
        </div>
        <div className="header-actions">
          <button 
            onClick={() => setShowOpcionesEspeciales(true)}
            className="header-options-btn"
            title="Opciones especiales"
          >
            <Icon name="cog" />
          </button>
          <div className="header-status">
            <span className={`status-badge status-badge-header ${estadoEquipo?.estado || 'pendiente'}`}>
              {estadoEquipo?.estado === 'en_proceso' ? 'EN PROCESO' : 
               estadoEquipo?.estado === 'finalizado' ? 'FINALIZADO' :
               estadoEquipo?.estado === 'listo' ? 'LISTO' : 'PENDIENTE'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content - 2 Column Grid */}
      <div className="equipo-detalle-main">
        {/* Left Column - Fixed Width, Sticky */}
        <aside className="equipo-detalle-sidebar">
          {/* Equipment Photo */}
          <section className="sidebar-section">
            {fotos.length > 0 ? (
              <>
                <div className="equipo-photo-main" onClick={() => setSelectedPhoto(fotos[0])}>
                  <img src={fotos[0].url} alt={`Equipo ${equipo.nota}`} />
                </div>
                {fotos.length > 1 && (
                  <div className="equipo-photo-thumbnails">
                    {fotos.map((foto, index) => (
                      <div 
                        key={foto.id}
                        className={`photo-thumb ${index === 0 ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedPhoto(foto);
                          const newFotos = [foto, ...fotos.filter(f => f.id !== foto.id)];
                          setFotos(newFotos);
                        }}
                      >
                        <img src={foto.url} alt={`Foto ${index + 1}`} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="equipo-photo-placeholder">
                <Icon name="camera" />
                <span>Sin fotos</span>
              </div>
            )}
          </section>

          {/* Problema destacado */}
          {equipo.problema && equipo.problema.trim() && (
            <section className="sidebar-section problema-section">
              <div className="problema-content">
                <Icon name="exclamation-triangle" className="problema-icon" />
                <div className="problema-text">
                  <div className="problema-label">Problema</div>
                  <div className="problema-value">{equipo.problema}</div>
                </div>
              </div>
            </section>
          )}

          {/* Equipment Info - Botones cuadrados */}
          <section className="sidebar-section">
            <h3 className="section-title">Información del Equipo</h3>
            <div className="section-content info-buttons-grid">
              {equipo.color && (
                <button 
                  className="info-button-square info-button-color"
                  style={{ 
                    backgroundColor: getColorHex(equipo.color),
                    color: getContrastColor(equipo.color)
                  }}
                >
                  <Icon name="palette" className="info-button-icon" />
                  <span className="info-button-label">Color</span>
                </button>
              )}
              {equipo.cargador !== undefined && equipo.cargador !== null && (
                <button 
                  className={`info-button-square ${equipo.cargador ? 'info-button-cargador-yes' : 'info-button-cargador-no'}`}
                >
                  <Icon name="plug" className="info-button-icon" />
                  <span className="info-button-label">Cargador</span>
                </button>
              )}
              {equipo.contraseña && equipo.contraseña.trim() && (
                <button 
                  className={`info-button-square info-button-password ${showPassword ? 'password-visible' : ''}`}
                  onClick={() => setShowPassword(p => !p)}
                >
                  <Icon name={showPassword ? 'eye-slash' : 'lock'} className="info-button-icon" />
                  <span className="info-button-label">
                    {showPassword ? equipo.contraseña : 'Contraseña'}
                  </span>
                </button>
              )}
            </div>
          </section>

          {/* Client Info */}
          <section className="sidebar-section">
            <h3 className="section-title">Cliente</h3>
            <div className="section-content">
              {cliente ? (
                <>
                  <div className="client-name">{cliente.nombre || 'Sin nombre'}</div>
                  {cliente.telefono && (
                    <div className="client-phone">
                      <Icon name="phone" />
                      <span>{cliente.telefono}</span>
                      <button 
                        onClick={handleContactarCliente}
                        className="btn-call"
                        title="Contactar por WhatsApp"
                      >
                        <Icon name="comment" />
                      </button>
                    </div>
                  )}
                  {cliente.email && (
                    <div className="client-email">
                      <Icon name="envelope" />
                      <span>{cliente.email}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="client-empty">
                  <Icon name="user" />
                  <span>Sin cliente asignado</span>
                </div>
              )}
            </div>
          </section>

          {/* Process Summary */}
          {procesoInfo && (
            <section className="sidebar-section">
              <h3 className="section-title">Proceso</h3>
              <div className="section-content">
                <div className="process-name">{procesoInfo.nombre}</div>
                {subprocesos.length > 0 && (
                  <div className="process-progress">
                    <div className="progress-label">
                      {subprocesosCompletados.length} de {subprocesos.length} pasos
                    </div>
                    <div className="progress-bar-container">
                      <div 
                        className="progress-bar-fill" 
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Status & Dates */}
          <section className="sidebar-section">
            <h3 className="section-title">Estado y Fechas</h3>
            <div className="section-content">
              <div className="status-item">
                <span className="status-label">Estado:</span>
                <span className={`status-badge-inline ${estadoEquipo?.estado || 'pendiente'}`}>
                  {estadoEquipo?.estado === 'en_proceso' ? 'En Proceso' : 
                   estadoEquipo?.estado === 'finalizado' ? 'Finalizado' :
                   estadoEquipo?.estado === 'listo' ? 'Listo' : 'Pendiente'}
                </span>
              </div>
              <div className="date-item">
                <Icon name="calendar-alt" />
                <div>
                  <div className="date-label">Creado</div>
                  <div className="date-value">{formatDate(equipo.created_at)}</div>
                </div>
              </div>
              {estadoEquipo?.updated_at && (
                <div className="date-item">
                  <Icon name="sync-alt" />
                  <div>
                    <div className="date-label">Actualizado</div>
                    <div className="date-value">{formatRelativeTime(estadoEquipo.updated_at)}</div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Current Step */}
          {siguienteSubproceso && estadoEquipo?.estado !== 'finalizado' && (
            <section className="sidebar-section current-step-section">
              <h3 className="section-title">Siguiente Paso</h3>
              <div className="section-content">
                <div className="step-title">{siguienteSubproceso.nombre}</div>
                {siguienteSubproceso.descripcion && (
                  <div className="step-desc">{siguienteSubproceso.descripcion}</div>
                )}
                <div className="step-input-wrapper">
                  <input
                    type="text"
                    className="step-input-field"
                    placeholder="Resultado o comentario..."
                    value={respuestaPaso}
                    onChange={(e) => setRespuestaPaso(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && respuestaPaso.trim()) {
                        e.preventDefault();
                        marcarSubprocesoCompletado(siguienteSubproceso.id, respuestaPaso);
                      }
                    }}
                    disabled={completandoPaso}
                  />
                  <button 
                    className="btn-step-complete"
                    onClick={() => marcarSubprocesoCompletado(siguienteSubproceso.id, respuestaPaso)}
                    disabled={completandoPaso || !respuestaPaso.trim()}
                  >
                    {completandoPaso ? (
                      <Icon name="sync" className="spinning" />
                    ) : (
                      <Icon name="check" />
                    )}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Actions */}
          <section className="sidebar-section">
            <h3 className="section-title">Acciones</h3>
            <div className="section-content actions-list">
              <button 
                className="action-btn"
                onClick={() => {
                  setTipoNotaPDF('recepcion');
                  setShowNotaPDFModal(true);
                }}
              >
                <Icon name="file-alt" />
                Nota de Recepción
              </button>
              {(estadoEquipo?.estado === 'listo' || estadoEquipo?.estado === 'finalizado') && (
                <button 
                  className="action-btn"
                  onClick={() => {
                    setTipoNotaPDF('entrega');
                    setShowNotaPDFModal(true);
                  }}
                >
                  <Icon name="file-alt" />
                  Nota de Entrega
                </button>
              )}
              {estadoEquipo?.estado === 'en_proceso' && subprocesosCompletados.length === subprocesos.length && subprocesos.length > 0 && (
                <button 
                  className="action-btn action-btn-primary"
                  onClick={marcarComoListo}
                >
                  <Icon name="check-circle" />
                  Marcar como Listo
                </button>
              )}
              {estadoEquipo?.estado === 'listo' && (
                <button 
                  className="action-btn action-btn-success"
                  onClick={marcarComoFinalizado}
                >
                  <Icon name="flag-checkered" />
                  Marcar como Entregado
                </button>
              )}
            </div>
          </section>
        </aside>

        {/* Right Column - Scrollable Timeline */}
        <main className="equipo-detalle-timeline">
          <div className="timeline-header-section">
            <h2 className="timeline-title">Historial de Eventos</h2>
            <button 
              className="btn-add-comentario"
              onClick={() => setShowComentarioModal(true)}
              title="Agregar comentario o nota"
            >
              <Icon name="comment" />
              <span>Agregar Comentario</span>
            </button>
          </div>
          
          {/* Modal de Comentario */}
          {showComentarioModal && (
            <div className="comentario-modal-overlay" onClick={() => setShowComentarioModal(false)}>
              <div className="comentario-modal" onClick={(e) => e.stopPropagation()}>
                <div className="comentario-modal-header">
                  <h3>Agregar Comentario o Nota</h3>
                  <button 
                    className="comentario-modal-close"
                    onClick={() => setShowComentarioModal(false)}
                  >
                    <Icon name="times" />
                  </button>
                </div>
                <div className="comentario-modal-body">
                  <textarea
                    className="comentario-input"
                    placeholder="Escribe tu comentario o nota aquí..."
                    value={nuevoComentario}
                    onChange={(e) => setNuevoComentario(e.target.value)}
                    rows={5}
                  />
                </div>
                <div className="comentario-modal-footer">
                  <button 
                    className="btn-cancel"
                    onClick={() => {
                      setShowComentarioModal(false);
                      setNuevoComentario('');
                    }}
                  >
                    Cancelar
                  </button>
                  <button 
                    className="btn-save-comentario"
                    onClick={agregarComentario}
                    disabled={!nuevoComentario.trim()}
                  >
                    <Icon name="check" />
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="timeline-container">
            {historial.length > 0 ? (
              historial.map((evento, index) => {
                const agente = evento.profiles;
                const avatarUrl = agente?.foto_url;
                const agenteNombre = agente?.nombre || 'Sistema';
                const initials = getInitials(agenteNombre);
                
                // Determine color based on event type or agent
                const getEventColor = () => {
                  if (evento.tipo_evento === 'nota') return 'yellow';
                  if (evento.tipo_evento === 'entrega') return 'orange';
                  if (evento.tipo_evento === 'estado') return 'purple';
                  if (evento.completado) return 'green';
                  if (agenteNombre === 'Sistema') return 'green';
                  // Cycle through colors for different agents
                  const colors = ['green', 'purple', 'orange', 'blue'];
                  return colors[index % colors.length];
                };
                
                const eventColor = getEventColor();
                
                return (
                  <div key={evento.id} className="timeline-event">
                    <div className={`event-avatar event-avatar-${eventColor}`}>
                      {avatarUrl ? (
                        <img 
                          src={avatarUrl} 
                          alt={agenteNombre}
                          onError={(e) => {
                            // Si la imagen falla, mostrar iniciales
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className="event-avatar-fallback"
                        style={{ display: avatarUrl ? 'none' : 'flex' }}
                      >
                        {initials}
                      </div>
                    </div>
                    <div className="event-content">
                      <div className="event-header">
                        <span className="event-agent">{agenteNombre}</span>
                        <span className="event-time">{formatDate(evento.created_at)}</span>
                      </div>
                      {evento.subprocesos?.nombre && (
                        <div className="event-subproceso">{evento.subprocesos.nombre}</div>
                      )}
                      {evento.notas && (
                        <div className="event-notes">
                          <div className="event-notes-avatar">
                            {avatarUrl ? (
                              <img 
                                src={avatarUrl} 
                                alt={agenteNombre}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div 
                              className="event-notes-avatar-fallback"
                              style={{ display: avatarUrl ? 'none' : 'flex' }}
                            >
                              {initials}
                            </div>
                          </div>
                          <div className="event-notes-text">{evento.notas}</div>
                        </div>
                      )}
                      {evento.completado && (
                        <div className="event-status">
                          <Icon name="check-circle" />
                          <span>Completado</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="timeline-empty">
                <Icon name="inbox" />
                <p>No hay eventos registrados</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Nota PDF Modal */}
      {showNotaPDFModal && tipoNotaPDF && (
        <NotaPDF
          equipo={{
            ...equipo,
            procesos: procesosEquipo.length > 0 ? procesosEquipo : (procesoInfo ? [procesoInfo] : [])
          }}
          cliente={cliente}
          tipo={tipoNotaPDF}
          onClose={() => {
            setShowNotaPDFModal(false);
            setTipoNotaPDF(null);
          }}
        />
      )}

      {/* Photo Modal */}
      {selectedPhoto && (
        <div className="photo-modal-overlay" onClick={() => setSelectedPhoto(null)}>
          <div className="photo-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="photo-modal-close"
              onClick={() => setSelectedPhoto(null)}
            >
              <Icon name="times" />
            </button>
            <img src={selectedPhoto.url} alt="Equipo" className="photo-modal-image" />
          </div>
        </div>
      )}

      {/* Modal de Opciones Especiales */}
      {showOpcionesEspeciales && (
        <div className="comentario-modal-overlay" onClick={() => setShowOpcionesEspeciales(false)}>
          <div className="comentario-modal opciones-especiales-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comentario-modal-header">
              <h3>Opciones Especiales</h3>
              <button 
                className="comentario-modal-close"
                onClick={() => {
                  setShowOpcionesEspeciales(false);
                  setProcesoSeleccionado(null);
                  setJustificacionFinalizado('');
                }}
              >
                <Icon name="times" />
              </button>
            </div>
            <div className="comentario-modal-body">
              {/* Opción 1: Cambiar Proceso */}
              <div className="opcion-especial-section">
                <h4 className="opcion-especial-title">
                  <Icon name="exchange-alt" />
                  Cambiar Proceso a Realizar
                </h4>
                <p className="opcion-especial-desc">
                  Cambia el proceso asignado a este equipo. Esto se registrará en el historial.
                </p>
                <select
                  className="opcion-especial-select"
                  value={procesoSeleccionado || ''}
                  onChange={(e) => setProcesoSeleccionado(e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">Selecciona un proceso...</option>
                  {procesosDisponibles.map(proceso => (
                    <option key={proceso.id} value={proceso.id}>
                      {proceso.nombre}
                    </option>
                  ))}
                </select>
                <button
                  className="btn-opcion-especial"
                  onClick={cambiarProceso}
                  disabled={!procesoSeleccionado || cambiandoProceso}
                >
                  {cambiandoProceso ? (
                    <>
                      <Icon name="sync" className="spinning" />
                      Cambiando...
                    </>
                  ) : (
                    <>
                      <Icon name="check" />
                      Cambiar Proceso
                    </>
                  )}
                </button>
              </div>

              {/* Separador */}
              <div className="opcion-especial-divider"></div>

              {/* Opción 2: Finalizar con Justificación */}
              <div className="opcion-especial-section">
                <h4 className="opcion-especial-title">
                  <Icon name="flag-checkered" />
                  Finalizar sin Completar Proceso
                </h4>
                <p className="opcion-especial-desc">
                  Marca el equipo como finalizado sin completar todos los pasos del proceso. Debes proporcionar una justificación.
                </p>
                <textarea
                  className="opcion-especial-textarea"
                  placeholder="Justifica por qué se finaliza sin completar el proceso (ej: cliente canceló, equipo no reparable, etc.)"
                  value={justificacionFinalizado}
                  onChange={(e) => setJustificacionFinalizado(e.target.value)}
                  rows={4}
                />
                <button
                  className="btn-opcion-especial btn-opcion-especial-danger"
                  onClick={finalizarConJustificacion}
                  disabled={!justificacionFinalizado.trim() || finalizandoConJustificacion}
                >
                  {finalizandoConJustificacion ? (
                    <>
                      <Icon name="sync" className="spinning" />
                      Finalizando...
                    </>
                  ) : (
                    <>
                      <Icon name="check" />
                      Finalizar con Justificación
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="comentario-modal-footer">
              <button 
                className="btn-cancel"
                onClick={() => {
                  setShowOpcionesEspeciales(false);
                  setProcesoSeleccionado(null);
                  setJustificacionFinalizado('');
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
