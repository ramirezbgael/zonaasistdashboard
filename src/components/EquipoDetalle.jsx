import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import { notificarEquipoListo, notificarEquipoFinalizado } from '../utils/notifications.js';
import { getEquipoPhotos } from '../services/photoUpload.service.js';
import Icon from './Icon.jsx';
import NotaPDF from './NotaPDF.jsx';
import './EquipoDetalle.css';

// Datos de ejemplo para modo demo (sin Supabase)
const DEMO_EQUIPOS_DETALLE = {
  'demo-e1': {
    equipo: {
      id: 'demo-e1',
      nota: '123',
      marca: 'Dell',
      modelo: 'Inspiron 15',
      color: 'negro',
      problema: 'No enciende',
      contraseña: '1234',
      cargador: true,
      adelanto: 500,
      cliente_id: 'demo-c1',
      created_at: new Date().toISOString()
    },
    cliente: {
      id: 'demo-c1',
      nombre: 'Juan Pérez',
      telefono: '5512345678',
      email: 'juan@example.com'
    },
    estadoEquipo: {
      estado: 'en_proceso',
      updated_at: new Date().toISOString(),
      proceso_actual_id: 1,
      procesos: {
        id: 1,
        nombre: 'Reparación estándar',
        descripcion: 'Diagnóstico y reparación básica',
        precio: 1200
      }
    },
    procesosEquipo: [
      {
        id: 1,
        nombre: 'Reparación estándar',
        precio: 1200,
        requiere_recordatorio: false,
        meses_vigencia: null
      }
    ],
    subprocesos: [
      { id: 11, nombre: 'Diagnóstico inicial', descripcion: 'Revisar estado general', orden: 1 },
      { id: 12, nombre: 'Cotizar reparación', descripcion: 'Definir piezas y mano de obra', orden: 2 },
      { id: 13, nombre: 'Aplicar reparación', descripcion: 'Cambiar piezas y probar', orden: 3 }
    ],
    historial: [
      {
        id: 'h1',
        created_at: new Date().toISOString(),
        notas: 'Equipo recibido en mostrador',
        completado: true,
        tipo_evento: 'nota',
        subproceso_id: null,
        procesos: { nombre: 'Reparación estándar' },
        subprocesos: null,
        profiles: { id: 'demo-user', nombre: 'Tú (demo)', email: 'demo@example.com', foto_url: null }
      },
      {
        id: 'h2',
        created_at: new Date().toISOString(),
        notas: 'Diagnóstico inicial completado',
        completado: true,
        tipo_evento: 'subproceso',
        subproceso_id: 11,
        procesos: { nombre: 'Reparación estándar' },
        subprocesos: { nombre: 'Diagnóstico inicial' },
        profiles: { id: 'demo-user', nombre: 'Tú (demo)', email: 'demo@example.com', foto_url: null }
      }
    ],
    fotos: []
  },
  'demo-e2': {
    equipo: {
      id: 'demo-e2',
      nota: '130',
      marca: 'HP',
      modelo: 'Pavilion 14',
      color: 'gris',
      problema: 'Lento y se traba',
      contraseña: '',
      cargador: true,
      adelanto: 0,
      cliente_id: 'demo-c2',
      created_at: new Date().toISOString()
    },
    cliente: {
      id: 'demo-c2',
      nombre: 'Ana López',
      telefono: '5522334455',
      email: 'ana@example.com'
    },
    estadoEquipo: {
      estado: 'listo',
      updated_at: new Date().toISOString(),
      proceso_actual_id: 2,
      procesos: {
        id: 2,
        nombre: 'Mantenimiento completo',
        descripcion: 'Formateo, limpieza y optimización',
        precio: 950
      }
    },
    procesosEquipo: [
      {
        id: 2,
        nombre: 'Mantenimiento completo',
        precio: 950,
        requiere_recordatorio: false,
        meses_vigencia: null
      }
    ],
    subprocesos: [],
    historial: [],
    fotos: []
  }
};

export default function EquipoDetalle({ demoMode = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [equipo, setEquipo] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [estadoEquipo, setEstadoEquipo] = useState(null);
  const [procesoInfo, setProcesoInfo] = useState(null);
  const [procesosEquipo, setProcesosEquipo] = useState([]); // Todos los procesos asociados al equipo con precios / recordatorios
  const [subprocesos, setSubprocesos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respuestaPaso, setRespuestaPaso] = useState('');
  const [completandoPaso, setCompletandoPaso] = useState(false);
  const [showNotaPDFModal, setShowNotaPDFModal] = useState(false);
  const [tipoNotaPDF, setTipoNotaPDF] = useState(null);
  const [equipoParaNotaPDF, setEquipoParaNotaPDF] = useState(null);
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
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [nuevoAdelanto, setNuevoAdelanto] = useState('');
  const [actualizandoAdelanto, setActualizandoAdelanto] = useState(false);
  const [showLicenciaModal, setShowLicenciaModal] = useState(false);
  const [licenciaForm, setLicenciaForm] = useState({
    proceso_id: null,
    producto: '',
    clave: '',
    fecha_activacion: '',
  });
  const [pedidosLigados, setPedidosLigados] = useState([]);
  const [pedidosTotal, setPedidosTotal] = useState(0);
  const [precioExtra, setPrecioExtra] = useState('');
  const [showConfirmarTotalModal, setShowConfirmarTotalModal] = useState(false);
  const [totalConfirmado, setTotalConfirmado] = useState('');

  useEffect(() => {
    loadCurrentUser();

    if (demoMode) {
      // Cargar datos de ejemplo sin tocar Supabase
      const demo = DEMO_EQUIPOS_DETALLE[id] || DEMO_EQUIPOS_DETALLE['demo-e1'];
      if (demo) {
        setEquipo(demo.equipo);
        setCliente(demo.cliente);
        setEstadoEquipo(demo.estadoEquipo);
        setProcesoInfo(demo.estadoEquipo?.procesos || null);
        setProcesosEquipo(demo.procesosEquipo || []);
        setSubprocesos(demo.subprocesos || []);
        setHistorial(demo.historial || []);
        setFotos(demo.fotos || []);
      }
      setLoading(false);
      return;
    }

    if (id) {
      loadEquipo();
    }
    loadProcesosDisponibles();
  }, [id, demoMode]);

  useEffect(() => {
    const estado = estadoEquipo?.estado;
    if (id && (estado === 'en_proceso' || estado === 'listo' || estado === 'finalizado') && !demoMode) {
      loadPedidosLigados();
    } else {
      setPedidosLigados([]);
      setPedidosTotal(0);
    }
  }, [id, estadoEquipo?.estado, demoMode]);

  const loadProcesosDisponibles = async () => {
    try {
      if (demoMode) {
        alert('Demo: aquí se marcaría el subproceso como completado en la base real.');
        return;
      }
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
      let equipoData;
      let equipoError;
      const selectConAdelanto = `
          id,
          nota,
          marca,
          modelo,
          color,
          problema,
          contraseña,
          cargador,
          adelanto,
          cliente_id,
          created_at,
          clientes (
            id,
            nombre,
            telefono,
            email
          )
        `;
      const selectSinAdelanto = `
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
        `;
      let result = await supabase.from('equipos').select(selectConAdelanto).eq('id', id).single();
      equipoData = result.data;
      equipoError = result.error;
      if (equipoError && (equipoError.code === '42703' || (equipoError.message || '').toLowerCase().includes('adelanto'))) {
        result = await supabase.from('equipos').select(selectSinAdelanto).eq('id', id).single();
        equipoData = result.data;
        equipoError = result.error;
        if (equipoData) equipoData.adelanto = 0;
      }
      if (equipoError) throw equipoError;
      // Normalizar clientes (Supabase puede devolverlo como objeto o como array)
      const clienteFromRelation = Array.isArray(equipoData.clientes)
        ? (equipoData.clientes[0] || null)
        : (equipoData.clientes ?? null);
      setEquipo(equipoData);
      
      // Set cliente - handle both nested and separate loading
      if (clienteFromRelation) {
        setCliente(clienteFromRelation);
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

  const loadPedidosLigados = async () => {
    if (!id || demoMode) return;
    try {
      const { data, error } = await supabase
        .from('pedidos_piezas')
        .select('id, nombre_pieza, cantidad, precio_unitario, estado')
        .eq('equipo_id', id);
      if (error) throw error;
      const pedidos = (data || []).filter(p => p.estado !== 'cancelado');
      const total = pedidos.reduce((sum, p) => {
        const qty = parseFloat(p?.cantidad) || 0;
        const unit = parseFloat(p?.precio_unitario) || 0;
        return sum + qty * unit;
      }, 0);
      setPedidosLigados(pedidos);
      setPedidosTotal(total);
    } catch (err) {
      console.error('Error loading pedidos ligados:', err);
      setPedidosLigados([]);
      setPedidosTotal(0);
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
        const proceso = Array.isArray(data.procesos) ? data.procesos[0] : data.procesos;
        setProcesoInfo(proceso || null);
        await loadSubprocesos(data.proceso_actual_id);
      }
    } catch (error) {
      console.error('Error loading estado:', error);
    }
  };

  const loadProcesosEquipo = async () => {
    try {
      // 1. Cargar procesos desde equipo_procesos (con precios y configuración de recordatorios)
      const { data: epData, error: epError } = await supabase
        .from('equipo_procesos')
        .select(`
          proceso_id,
          procesos (
            id,
            nombre,
            precio,
            requiere_recordatorio,
            meses_vigencia
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
            requiere_recordatorio: !!ep.procesos?.requiere_recordatorio,
            meses_vigencia: ep.procesos?.meses_vigencia ?? null,
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
            .select('id, nombre, precio, requiere_recordatorio, meses_vigencia')
            .eq('id', estado.proceso_actual_id)
            .single();

          if (!procErr && proc) {
            procesosConPrecio = [
              {
                id: proc.id,
                nombre: proc.nombre,
                precio: parseFloat(proc.precio) || 0,
                requiere_recordatorio: !!proc.requiere_recordatorio,
                meses_vigencia: proc.meses_vigencia ?? null,
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
      
      const eventos = data || [];
      const otrosUsuarioIds = [...new Set(
        eventos
          .filter((e) => e.usuario_id && e.usuario_id !== currentUser?.id)
          .map((e) => e.usuario_id)
      )];

      let profilesMap = new Map();
      if (otrosUsuarioIds.length > 0) {
        const { data: profilesList, error: rpcError } = await supabase
          .rpc('get_profiles_for_historial', { user_ids: otrosUsuarioIds });
        if (!rpcError && Array.isArray(profilesList)) {
          profilesList.forEach((p) => {
            if (p?.id) profilesMap.set(p.id, { id: p.id, nombre: p.nombre || '', email: p.email || '', foto_url: p.foto_url || null });
          });
        } else {
          // Fallback: cargar perfil por perfil (puede fallar por RLS)
          await Promise.all(otrosUsuarioIds.map(async (uid) => {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id, nombre, email, foto_url')
                .eq('id', uid)
                .maybeSingle();
              if (profile) profilesMap.set(uid, profile);
            } catch (_) {}
          }));
        }
      }

      const historialConProfiles = eventos.map((evento) => {
        if (!evento.usuario_id) return { ...evento, profiles: null };
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
        const profile = profilesMap.get(evento.usuario_id) || null;
        return { ...evento, profiles: profile };
      });
      
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
    if (demoMode) {
      alert('Demo: aquí se marcaría el equipo como listo.');
      return;
    }

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
    if (demoMode) {
      alert('Demo: aquí se cambiaría el proceso en la base real.');
      return;
    }

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
    if (demoMode) {
      alert('Demo: aquí se marcaría el equipo como finalizado con justificación.');
      return;
    }

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
    if (demoMode) {
      alert('Demo: aquí se marcaría el equipo como entregado y se generaría la nota real.');
      return;
    }

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
    if (demoMode) {
      alert('Demo: aquí se guardaría un comentario en el historial real.');
      return;
    }

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

  const procesosConRecordatorio = procesosEquipo.filter(
    (p) => p.requiere_recordatorio && p.meses_vigencia
  );

  const openLicenciaModal = () => {
    if (!equipo) return;
    const hoy = new Date();
    const isoHoy = hoy.toISOString().split('T')[0];
    const defaultProceso = procesosConRecordatorio[0] || null;
    setLicenciaForm({
      proceso_id: defaultProceso?.id || null,
      producto: defaultProceso?.nombre || '',
      clave: '',
      fecha_activacion: isoHoy,
    });
    setShowLicenciaModal(true);
  };

  const calcularFechaExpira = () => {
    const proceso = procesosConRecordatorio.find(
      (p) => p.id === licenciaForm.proceso_id
    );
    if (!proceso || !proceso.meses_vigencia || !licenciaForm.fecha_activacion) {
      return null;
    }
    const base = new Date(licenciaForm.fecha_activacion + 'T00:00:00');
    if (Number.isNaN(base.getTime())) return null;
    const meses = parseInt(proceso.meses_vigencia, 10) || 0;
    if (!meses) return null;
    const fecha = new Date(base);
    fecha.setMonth(fecha.getMonth() + meses);
    return fecha.toISOString().split('T')[0];
  };

  const registrarLicencia = async () => {
    if (demoMode) {
      alert('Demo: aquí se registraría la licencia en Supabase.');
      return;
    }

    if (!equipo?.id) return;
    const proceso = procesosConRecordatorio.find(
      (p) => p.id === licenciaForm.proceso_id
    );
    if (!proceso) {
      alert('Selecciona el proceso asociado a la licencia (Office barato / caro).');
      return;
    }
    if (!licenciaForm.clave.trim()) {
      alert('Ingresa la clave de la licencia.');
      return;
    }
    if (!licenciaForm.fecha_activacion) {
      alert('Selecciona la fecha de activación de la licencia.');
      return;
    }

    const fecha_expira = calcularFechaExpira();
    if (!fecha_expira) {
      alert('No se pudo calcular la fecha de expiración. Revisa meses de vigencia en el proceso.');
      return;
    }

    try {
      const meses_vigencia = parseInt(proceso.meses_vigencia, 10) || 0;
      const fecha_activacion = licenciaForm.fecha_activacion;

      // Recordatorio 7 días antes de la fecha de expiración
      const expDate = new Date(fecha_expira + 'T00:00:00');
      expDate.setDate(expDate.getDate() - 7);
      const fecha_recordatorio = expDate.toISOString().split('T')[0];

      const { error } = await supabase
        .from('licencias_software')
        .insert({
          cliente_id: cliente?.id || null,
          equipo_id: equipo.id,
          proceso_id: proceso.id,
          producto: licenciaForm.producto || proceso.nombre,
          clave: licenciaForm.clave.trim(),
          meses_vigencia,
          fecha_activacion,
          fecha_expira,
          fecha_recordatorio,
          recordatorio_enviado: false,
        });

      if (error) throw error;

      alert('Licencia registrada correctamente. Se generará un recordatorio automático antes de que caduque.');
      setShowLicenciaModal(false);
      setLicenciaForm({
        proceso_id: null,
        producto: '',
        clave: '',
        fecha_activacion: '',
      });
    } catch (error) {
      console.error('Error registrando licencia:', error);
      alert('Error al registrar la licencia. Por favor intenta de nuevo.');
    }
  };

  const registrarAdelanto = async () => {
    if (demoMode) {
      alert('Demo: aquí se sumaría el adelanto al equipo en Supabase.');
      return;
    }

    if (!equipo?.id) return;
    const monto = parseFloat(nuevoAdelanto);
    if (!monto || monto <= 0) {
      alert('Por favor ingresa un monto válido de adelanto');
      return;
    }

    setActualizandoAdelanto(true);
    try {
      const adelantoActual = parseFloat(equipo.adelanto || 0);
      const nuevoTotal = adelantoActual + monto;

      const { error } = await supabase
        .from('equipos')
        .update({ adelanto: nuevoTotal })
        .eq('id', equipo.id);

      if (error) throw error;

      await loadEquipo();
      setShowPagoModal(false);
      setNuevoAdelanto('');
    } catch (error) {
      console.error('Error registrando adelanto:', error);
      const msg = (error?.message || String(error)).toLowerCase();
      const isColumnaFalta = error?.code === '42703' || msg.includes('adelanto') || msg.includes('does not exist') || msg.includes('column');
      if (isColumnaFalta) {
        alert('La tabla equipos no tiene la columna "adelanto". Ejecuta en Supabase (SQL Editor) el script add_adelanto_equipo.sql del proyecto para habilitar adelantos.');
      } else {
        alert('Error al registrar el adelanto: ' + (error?.message || error));
      }
    } finally {
      setActualizandoAdelanto(false);
    }
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
      {/* Top Header - Datos fijos arriba */}
      <header className="equipo-detalle-header equipo-detalle-header-expanded">
        <div className="header-top-row">
          <button onClick={() => navigate('/equipos')} className="header-back-btn">
            <Icon name="arrow-left" />
          </button>
          <div className="header-main">
            <div className="header-equipo-number">#{equipo.nota}</div>
            <div className="header-equipo-model">{equipo.marca} {equipo.modelo}</div>
            <span className={`status-badge status-badge-header ${estadoEquipo?.estado || 'pendiente'}`}>
              {estadoEquipo?.estado === 'en_proceso' ? 'EN PROCESO' : 
               estadoEquipo?.estado === 'finalizado' ? 'FINALIZADO' :
               estadoEquipo?.estado === 'listo' ? 'LISTO' : 'PENDIENTE'}
            </span>
          </div>
          <button 
            onClick={() => setShowOpcionesEspeciales(true)}
            className="header-options-btn"
            title="Opciones especiales"
          >
            <Icon name="cog" />
          </button>
        </div>
        <div className="header-data-grid">
          <div className="header-data-block">
            <div className="header-data-label">Equipo</div>
            <div className="header-data-values">
              {equipo.color && (
                <span className="header-info-pill header-info-color" style={{ backgroundColor: getColorHex(equipo.color), color: getContrastColor(equipo.color) }}>
                  <Icon name="palette" /> {equipo.color}
                </span>
              )}
              {equipo.cargador !== undefined && equipo.cargador !== null && (
                <span className={`header-info-pill ${equipo.cargador ? 'header-info-yes' : 'header-info-no'}`}>
                  <Icon name="plug" /> Cargador
                </span>
              )}
              {equipo.contraseña && equipo.contraseña.trim() && (
                <span 
                  className="header-info-pill header-info-password"
                  onClick={() => setShowPassword(p => !p)}
                  style={{ cursor: 'pointer' }}
                >
                  <Icon name={showPassword ? 'eye-slash' : 'lock'} /> {showPassword ? equipo.contraseña : 'Contraseña'}
                </span>
              )}
            </div>
          </div>
          <div className="header-data-block">
            <div className="header-data-label">Cliente</div>
            <div className="header-data-values header-data-cliente">
              {cliente ? (
                <>
                  <span className="header-cliente-nombre">{cliente.nombre || 'Sin nombre'}</span>
                  {cliente.telefono && (
                    <span className="header-cliente-row">
                      <Icon name="phone" /> {cliente.telefono}
                      <button 
                        onClick={handleContactarCliente}
                        className="header-btn-whatsapp"
                        title="Contactar por WhatsApp"
                      >
                        <Icon name="comment" />
                      </button>
                    </span>
                  )}
                  {cliente.email && (
                    <span className="header-cliente-row"><Icon name="envelope" /> {cliente.email}</span>
                  )}
                </>
              ) : (
                <span className="header-cliente-empty">Sin cliente asignado</span>
              )}
            </div>
          </div>
          <div className="header-data-block header-data-block-proceso">
            <div className="header-data-label">Proceso</div>
            <div className="header-data-values">
              {procesoInfo && <span className="header-proceso-nombre">{procesoInfo.nombre}</span>}
              {subprocesos.length > 0 && (
                <span className="header-proceso-pasos">{subprocesosCompletados.length} de {subprocesos.length} pasos</span>
              )}
              <span className={`status-badge-inline ${estadoEquipo?.estado || 'pendiente'}`}>
                {estadoEquipo?.estado === 'en_proceso' ? 'En Proceso' : 
                 estadoEquipo?.estado === 'finalizado' ? 'Finalizado' :
                 estadoEquipo?.estado === 'listo' ? 'Listo' : 'Pendiente'}
              </span>
              <span className="header-proceso-fecha">
                <Icon name="calendar-alt" /> {formatDate(equipo.created_at)}
              </span>
            </div>
            {/* Siguiente Paso - dentro de la misma box de Proceso */}
            {siguienteSubproceso && estadoEquipo?.estado !== 'finalizado' && (
              <div className="header-siguiente-paso">
                <div className="header-siguiente-paso-label">
                  <Icon name="arrow-right" />
                  Siguiente Paso
                </div>
                <div className="header-siguiente-paso-content">
                  <div className="header-step-title">{siguienteSubproceso.nombre}</div>
                  {siguienteSubproceso.descripcion && (
                    <div className="header-step-desc">{siguienteSubproceso.descripcion}</div>
                  )}
                  <div className="header-step-input-wrapper">
                    <input
                      type="text"
                      className="header-step-input"
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
                      className="header-btn-step-complete"
                      onClick={() => marcarSubprocesoCompletado(siguienteSubproceso.id, respuestaPaso)}
                      disabled={completandoPaso || !respuestaPaso.trim()}
                    >
                      {completandoPaso ? <Icon name="sync" className="spinning" /> : <Icon name="check" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - 2 Column Grid */}
      <div className="equipo-detalle-main">
        {/* Left Column - Fixed Width, Sticky */}
        <aside className="equipo-detalle-sidebar">
          {/* Equipment Photo */}
          <section className="sidebar-card sidebar-card-photo">
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
            <section className="sidebar-card sidebar-card-problema">
              <div className="problema-content">
                <Icon name="exclamation-triangle" className="problema-icon" />
                <div className="problema-text">
                  <div className="problema-label">Problema</div>
                  <div className="problema-value">{equipo.problema}</div>
                </div>
              </div>
            </section>
          )}

          {/* Costos y Entrega - Unificado con botones */}
          {equipo && (
            <section className="sidebar-card costos-section">
              <div className="sidebar-card-row">
                <Icon name="dollar-sign" className="sidebar-card-icon" />
                <span className="sidebar-card-title">Costos y entrega</span>
              </div>
              <div className="section-content costos-content">
                {(() => {
                  const serviciosTot = procesosEquipo.reduce((s, p) => s + (parseFloat(p?.precio) || 0), 0);
                  const extra = parseFloat(precioExtra) || 0;
                  const totalCalculado = serviciosTot + pedidosTotal + extra;
                  const adelanto = parseFloat(equipo.adelanto || 0);
                  const adeudo = totalCalculado - adelanto;
                  return (
                    <>
                      <div className="costos-row">
                        <span className="costos-label">Servicios:</span>
                        <span className="costos-value">${serviciosTot.toFixed(2)}</span>
                      </div>
                      {pedidosTotal > 0 && (
                        <div className="costos-row">
                          <span className="costos-label">Refacciones:</span>
                          <span className="costos-value">${pedidosTotal.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="costos-row costos-extra">
                        <span className="costos-label">Extra (opcional):</span>
                        <input
                          type="number"
                          className="costos-extra-input"
                          placeholder="0"
                          min="0"
                          step="0.01"
                          value={precioExtra}
                          onChange={(e) => setPrecioExtra(e.target.value)}
                          title="Agregar monto extra si llevó algo más o cambió el precio"
                        />
                      </div>
                      <div className="costos-row costos-total">
                        <span className="costos-label">Total calculado:</span>
                        <span className="costos-value costos-total-value">${totalCalculado.toFixed(2)}</span>
                      </div>
                      <div className="costos-row costos-adelanto-row">
                        <span className="costos-label">Adelanto:</span>
                        <span className="costos-value">${adelanto.toFixed(2)}</span>
                        <button
                          type="button"
                          className="costos-btn-adelanto"
                          onClick={() => {
                            setNuevoAdelanto('');
                            setShowPagoModal(true);
                          }}
                          title="Agregar adelanto"
                        >
                          <Icon name="plus-circle" />
                          <span>Agregar</span>
                        </button>
                      </div>
                      <div className="costos-row costos-adeudo">
                        <span className="costos-label">Adeudo:</span>
                        <span className={`costos-value ${adeudo > 0 ? 'costos-adeudo-pendiente' : 'costos-adeudo-cero'}`}>
                          ${adeudo.toFixed(2)}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
              {/* Botones de notas y acciones - junto a costos */}
              <div className="costos-actions">
                <button 
                  className="costos-action-btn"
                  onClick={async () => {
                    try {
                      const { data: pedidosData } = await supabase
                        .from('pedidos_piezas')
                        .select('id, nombre_pieza, cantidad, precio_unitario, estado')
                        .eq('equipo_id', equipo.id);
                      const pedidos = (pedidosData || []).filter(p => p.estado !== 'cancelado');
                      const pTotal = pedidos.reduce((s, p) => s + (parseFloat(p?.cantidad) || 0) * (parseFloat(p?.precio_unitario) || 0), 0);
                      setEquipoParaNotaPDF({
                        ...equipo,
                        procesos: procesosEquipo.length > 0 ? procesosEquipo : (procesoInfo ? [procesoInfo] : []),
                        pedidos_ligados: pedidos,
                        pedidos_total: pTotal
                      });
                    } catch (err) {
                      setEquipoParaNotaPDF({ ...equipo, procesos: procesosEquipo.length > 0 ? procesosEquipo : (procesoInfo ? [procesoInfo] : []) });
                    } finally {
                      setTipoNotaPDF('recepcion');
                      setShowNotaPDFModal(true);
                    }
                  }}
                >
                  <Icon name="file-alt" /> Nota de Recepción
                </button>
                {(estadoEquipo?.estado === 'listo' || estadoEquipo?.estado === 'finalizado') && (
                  <button 
                    className="costos-action-btn costos-action-btn-primary"
                    onClick={() => {
                      const serviciosTot = procesosEquipo.reduce((s, p) => s + (parseFloat(p?.precio) || 0), 0);
                      const extra = parseFloat(precioExtra) || 0;
                      setTotalConfirmado(String(serviciosTot + pedidosTotal + extra));
                      setShowConfirmarTotalModal(true);
                    }}
                  >
                    <Icon name="file-alt" /> Nota de Entrega
                  </button>
                )}
                {procesosConRecordatorio.length > 0 && (
                  <button className="costos-action-btn" onClick={openLicenciaModal}>
                    <Icon name="key" /> Registrar licencia
                  </button>
                )}
                {estadoEquipo?.estado === 'en_proceso' && subprocesosCompletados.length === subprocesos.length && subprocesos.length > 0 && (
                  <button className="costos-action-btn costos-action-btn-success" onClick={marcarComoListo}>
                    <Icon name="check-circle" /> Marcar como Listo
                  </button>
                )}
                {estadoEquipo?.estado === 'listo' && (
                  <button className="costos-action-btn costos-action-btn-success" onClick={marcarComoFinalizado}>
                    <Icon name="flag-checkered" /> Marcar como Entregado
                  </button>
                )}
              </div>
            </section>
          )}

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
                const agenteNombre = agente?.nombre?.trim() || agente?.email?.split('@')[0] || 'Sistema';
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

      {/* Modal de confirmación de total antes de generar Nota de Entrega */}
      {showConfirmarTotalModal && (
        <div className="confirmar-total-overlay" onClick={() => setShowConfirmarTotalModal(false)}>
          <div className="confirmar-total-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirmar-total-header">
              <h2>Confirmar precio antes de generar nota</h2>
              <button
                className="confirmar-total-close"
                onClick={() => setShowConfirmarTotalModal(false)}
              >
                <Icon name="times" />
              </button>
            </div>
            <div className="confirmar-total-body">
              <p className="confirmar-total-desc">
                Revisa y confirma el monto total. Puedes corregirlo si el precio cambió o se agregó algo más.
              </p>
              <div className="confirmar-total-display">
                <label>Total a cobrar</label>
                <input
                  type="number"
                  className="confirmar-total-input"
                  min="0"
                  step="0.01"
                  value={totalConfirmado}
                  onChange={(e) => setTotalConfirmado(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="confirmar-total-resumen">
                <div className="confirmar-total-row">
                  <span>Adelanto:</span>
                  <span>${parseFloat(equipo?.adelanto || 0).toFixed(2)}</span>
                </div>
                <div className="confirmar-total-row confirmar-total-adeudo">
                  <span>Adeudo:</span>
                  <span>
                    ${(parseFloat(totalConfirmado || 0) - parseFloat(equipo?.adelanto || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            <div className="confirmar-total-footer">
              <button className="btn-cancel" onClick={() => setShowConfirmarTotalModal(false)}>
                Cancelar
              </button>
              <button
                className="btn-confirmar-total"
                onClick={() => {
                  const total = parseFloat(totalConfirmado || 0);
                  if (total < 0) {
                    alert('El total no puede ser negativo.');
                    return;
                  }
                  const eqParaNota = {
                    ...equipo,
                    procesos: procesosEquipo.length > 0 ? procesosEquipo : (procesoInfo ? [procesoInfo] : []),
                    pedidos_ligados: pedidosLigados,
                    pedidos_total: pedidosTotal,
                    precio_total_confirmado: total
                  };
                  setEquipoParaNotaPDF(eqParaNota);
                  setShowConfirmarTotalModal(false);
                  setTipoNotaPDF('entrega');
                  setShowNotaPDFModal(true);
                }}
              >
                <Icon name="check" />
                Confirmar y generar nota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nota PDF Modal */}
      {showNotaPDFModal && tipoNotaPDF && (
        <NotaPDF
          equipo={equipoParaNotaPDF || {
            ...equipo,
            procesos: procesosEquipo.length > 0 ? procesosEquipo : (procesoInfo ? [procesoInfo] : [])
          }}
          cliente={cliente}
          tipo={tipoNotaPDF}
          onClose={() => {
            setShowNotaPDFModal(false);
            setTipoNotaPDF(null);
            setEquipoParaNotaPDF(null);
          }}
        />
      )}

      {/* Modal de Adelanto */}
      {showPagoModal && (
        <div className="comentario-modal-overlay" onClick={() => {
          if (!actualizandoAdelanto) {
            setShowPagoModal(false);
            setNuevoAdelanto('');
          }
        }}>
          <div className="comentario-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comentario-modal-header">
              <h3>Registrar adelanto</h3>
              <button
                className="comentario-modal-close"
                onClick={() => {
                  if (!actualizandoAdelanto) {
                    setShowPagoModal(false);
                    setNuevoAdelanto('');
                  }
                }}
              >
                <Icon name="times" />
              </button>
            </div>
            <div className="comentario-modal-body">
              <p style={{ marginBottom: '0.75rem' }}>
                Adelanto acumulado actual:{' '}
                <strong>${parseFloat(equipo?.adelanto || 0).toFixed(2)}</strong>
              </p>
              <input
                type="number"
                className="typeform-large-input"
                placeholder="Ej: 500.00"
                value={nuevoAdelanto}
                onChange={(e) => setNuevoAdelanto(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            <div className="comentario-modal-footer">
              <button
                className="btn-cancel"
                onClick={() => {
                  if (!actualizandoAdelanto) {
                    setShowPagoModal(false);
                    setNuevoAdelanto('');
                  }
                }}
              >
                Cancelar
              </button>
              <button
                className="btn-save-comentario"
                onClick={registrarAdelanto}
                disabled={actualizandoAdelanto || !nuevoAdelanto.trim()}
              >
                <Icon name="check" />
                {actualizandoAdelanto ? 'Guardando...' : 'Guardar adelanto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Licencia de Software */}
      {showLicenciaModal && (
        <div className="comentario-modal-overlay" onClick={() => setShowLicenciaModal(false)}>
          <div className="comentario-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comentario-modal-header">
              <h3>Registrar licencia de software</h3>
              <button
                className="comentario-modal-close"
                onClick={() => setShowLicenciaModal(false)}
              >
                <Icon name="times" />
              </button>
            </div>
            <div className="comentario-modal-body">
              <div className="form-group">
                <label>Proceso asociado</label>
                <select
                  className="typeform-large-input"
                  value={licenciaForm.proceso_id || ''}
                  onChange={(e) => {
                    const id = e.target.value ? parseInt(e.target.value, 10) : null;
                    const proc = procesosConRecordatorio.find((p) => p.id === id);
                    setLicenciaForm((prev) => ({
                      ...prev,
                      proceso_id: id,
                      producto: proc?.nombre || prev.producto,
                    }));
                  }}
                >
                  <option value="">Selecciona un proceso...</option>
                  {procesosConRecordatorio.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({p.meses_vigencia} meses)
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Nombre del producto / licencia</label>
                <input
                  type="text"
                  className="typeform-large-input"
                  placeholder="Ej: Office barato, Office caro..."
                  value={licenciaForm.producto}
                  onChange={(e) =>
                    setLicenciaForm((prev) => ({ ...prev, producto: e.target.value }))
                  }
                />
              </div>
              <div className="form-group">
                <label>Clave de la licencia</label>
                <input
                  type="text"
                  className="typeform-large-input"
                  placeholder="Clave / serial de la licencia"
                  value={licenciaForm.clave}
                  onChange={(e) =>
                    setLicenciaForm((prev) => ({ ...prev, clave: e.target.value }))
                  }
                />
              </div>
              <div className="form-group">
                <label>Fecha de activación</label>
                <input
                  type="date"
                  className="typeform-large-input"
                  value={licenciaForm.fecha_activacion}
                  onChange={(e) =>
                    setLicenciaForm((prev) => ({
                      ...prev,
                      fecha_activacion: e.target.value,
                    }))
                  }
                />
              </div>
              {(() => {
                const fechaExpira = calcularFechaExpira();
                if (!fechaExpira) return null;
                const proceso = procesosConRecordatorio.find(
                  (p) => p.id === licenciaForm.proceso_id
                );
                return (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#555' }}>
                    Esta licencia vencerá el <strong>{fechaExpira}</strong>{' '}
                    ({proceso?.meses_vigencia} meses de vigencia). Se enviará un
                    recordatorio aproximadamente 7 días antes.
                  </p>
                );
              })()}
            </div>
            <div className="comentario-modal-footer">
              <button
                className="btn-cancel"
                onClick={() => setShowLicenciaModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn-save-comentario"
                onClick={registrarLicencia}
              >
                <Icon name="check" />
                Guardar licencia
              </button>
            </div>
          </div>
        </div>
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
