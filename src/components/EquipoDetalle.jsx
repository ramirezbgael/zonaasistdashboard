import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase, getCurrentUser } from '../supabase.js';
import { notificarEquipoListo, notificarEquipoFinalizado } from '../utils/notifications.js';
import { getEquipoPhotos, uploadEquipoPhoto } from '../services/photoUpload.service.js';
import Icon from './Icon.jsx';
import './EquipoDetalle.css';
import './AddEquipoModalTypeform.css';

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
  const location = useLocation();
  
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
  const [currentUser, setCurrentUser] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const fileInputRef = useRef(null);
  const [showComentarioModal, setShowComentarioModal] = useState(false);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showOpcionesEspeciales, setShowOpcionesEspeciales] = useState(false);
  const [procesosDisponibles, setProcesosDisponibles] = useState([]);
  const [procesoSeleccionado, setProcesoSeleccionado] = useState(null);
  const [justificacionFinalizado, setJustificacionFinalizado] = useState('');
  const [justificacionReabrir, setJustificacionReabrir] = useState('');
  const [cambiandoProceso, setCambiandoProceso] = useState(false);
  const [finalizandoConJustificacion, setFinalizandoConJustificacion] = useState(false);
  const [reabriendoEquipo, setReabriendoEquipo] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [nuevoAdelanto, setNuevoAdelanto] = useState('');
  const [descripcionAdelanto, setDescripcionAdelanto] = useState('');
  const [actualizandoAdelanto, setActualizandoAdelanto] = useState(false);
  const [showLicenciaModal, setShowLicenciaModal] = useState(false);
  const [licenciaForm, setLicenciaForm] = useState({
    proceso_id: null,
    producto: '',
    clave: '',
    fecha_activacion: '',
  });
  const [costosExpanded, setCostosExpanded] = useState(false);
  const [showConfirmEstadoModal, setShowConfirmEstadoModal] = useState(false);
  const [confirmEstadoData, setConfirmEstadoData] = useState(null);
  const [showProblemaModal, setShowProblemaModal] = useState(false);
  const [pedidosLigados, setPedidosLigados] = useState([]);
  const [pedidosTotal, setPedidosTotal] = useState(0);
  const [precioExtra, setPrecioExtra] = useState('');
  const [descripcionExtra, setDescripcionExtra] = useState('');
  const [guardandoExtra, setGuardandoExtra] = useState(false);
  const [showPagoCompletoModal, setShowPagoCompletoModal] = useState(false);
  const [marcandoComoPagado, setMarcandoComoPagado] = useState(false);
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [showConfirmarTotalModal, setShowConfirmarTotalModal] = useState(false);
  const [totalConfirmado, setTotalConfirmado] = useState('');
  const [solucionImplementada, setSolucionImplementada] = useState('');

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
      const fromList = location.state?.equipoFromList;
      if (fromList && String(fromList.id) === String(id)) {
        setEquipo(fromList);
        const clientes = Array.isArray(fromList.clientes) ? fromList.clientes[0] : fromList.clientes;
        setCliente(clientes || null);
      }
      loadEquipo();
    }
    loadProcesosDisponibles();
  }, [id, demoMode, location.state]);

  useEffect(() => {
    const estado = estadoEquipo?.estado;
    if (id && (estado === 'en_proceso' || estado === 'ready_for_pickup' || estado === 'listo' || estado === 'delivered' || estado === 'finalizado') && !demoMode) {
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
      // getSession() lee la sesión cacheada localmente (sin petición de red)
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (session?.user) {
        setCurrentUser(session.user);
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
      
      // Primero intentar con todas las columnas (incluyendo las nuevas)
      const selectCompleto = `
          id,
          nota,
          marca,
          modelo,
          color,
          problema,
          contraseña,
          cargador,
          adelanto,
          precio_extra,
          descripcion_extra,
          cliente_id,
          created_at,
          clientes (
            id,
            nombre,
            telefono,
            email
          )
        `;
      
      // Si faltan columnas nuevas, intentar sin ellas
      const selectSinExtra = `
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
      
      // Si falta adelanto también
      const selectBasico = `
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
      
      let result = await supabase.from('equipos').select(selectCompleto).eq('id', id).single();
      equipoData = result.data;
      equipoError = result.error;
      
      // Verificar si el equipo no existe
      const isNotFound = equipoError && (
        equipoError.code === 'PGRST116' || 
        equipoError.code === 'PGRST301' ||
        (equipoError.message && (
          equipoError.message.toLowerCase().includes('no rows') ||
          equipoError.message.toLowerCase().includes('not found') ||
          equipoError.message.toLowerCase().includes('no encontrado')
        ))
      );
      
      if (isNotFound) {
        setEquipo(null);
        setLoading(false);
        return;
      }
      
      // Si hay error de columna faltante (42703 o 400 con mensaje de columna), intentar sin las columnas nuevas
      const isColumnError = equipoError && (
        equipoError.code === '42703' || 
        equipoError.code === 'PGRST100' ||
        (equipoError.status === 400 && equipoError.message && (
          equipoError.message.toLowerCase().includes('column') ||
          equipoError.message.toLowerCase().includes('precio_extra') ||
          equipoError.message.toLowerCase().includes('descripcion_extra') ||
          equipoError.message.toLowerCase().includes('adelanto')
        ))
      );
      
      if (isColumnError) {
        // Intentar sin precio_extra y descripcion_extra
        result = await supabase.from('equipos').select(selectSinExtra).eq('id', id).single();
        equipoData = result.data;
        equipoError = result.error;
        
        // Si aún hay error de columna, intentar sin adelanto también
        if (equipoError && (
          equipoError.code === '42703' || 
          equipoError.code === 'PGRST100' ||
          (equipoError.status === 400 && equipoError.message && (
            equipoError.message.toLowerCase().includes('adelanto') ||
            equipoError.message.toLowerCase().includes('column')
          ))
        )) {
          result = await supabase.from('equipos').select(selectBasico).eq('id', id).single();
          equipoData = result.data;
          equipoError = result.error;
          
          if (equipoData) {
            equipoData.adelanto = 0;
          }
        }
        
        // Verificar si no existe después de los reintentos
        const isNotFoundRetry = equipoError && (
          equipoError.code === 'PGRST116' || 
          equipoError.code === 'PGRST301' ||
          (equipoError.message && (
            equipoError.message.toLowerCase().includes('no rows') ||
            equipoError.message.toLowerCase().includes('not found') ||
            equipoError.message.toLowerCase().includes('no encontrado')
          ))
        );
        
        if (isNotFoundRetry) {
          setEquipo(null);
          setLoading(false);
          return;
        }
        
        // Si el segundo intento fue exitoso (tenemos datos), continuar sin lanzar error
        if (equipoData && !equipoError) {
          // Establecer valores por defecto para columnas faltantes
          if (equipoData.adelanto === undefined) equipoData.adelanto = 0;
          if (equipoData.precio_extra === undefined) equipoData.precio_extra = 0;
          if (equipoData.descripcion_extra === undefined) equipoData.descripcion_extra = null;
          // Continuar con el flujo normal, no lanzar error
        } else if (equipoError) {
          // Si después de los reintentos aún hay error, lanzarlo
          throw equipoError;
        }
      } else if (equipoError) {
        // Si no es un error de columna faltante, lanzar el error
        throw equipoError;
      }
      
      // Verificar que tenemos datos del equipo antes de continuar
      if (!equipoData) {
        setEquipo(null);
        setLoading(false);
        return;
      }
      
      // Cargar precio_extra y descripcion_extra desde la BD
      if (equipoData) {
        const extraValue = equipoData.precio_extra;
        if (extraValue !== undefined && extraValue !== null && extraValue !== 0) {
          setPrecioExtra(String(extraValue));
        } else {
          setPrecioExtra('');
        }
        const descExtra = equipoData.descripcion_extra;
        if (descExtra && descExtra.trim()) {
          setDescripcionExtra(descExtra);
        } else {
          setDescripcionExtra('');
        }
      }
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

      // Mostrar la página inmediatamente con los datos del equipo
      setLoading(false);

      // Cargar estado, procesos, historial y fotos en paralelo en segundo plano
      Promise.all([
        loadEstadoEquipo(),
        loadProcesosEquipo(),
        loadHistorial(),
        loadFotos(),
      ]).catch(err => console.error('Error loading secondary data:', err));
    } catch (error) {
      console.error('Error loading equipo:', error);
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
      // Primero intentar con select mínimo (columnas que siempre existen) para no fallar si falta ready_at/delivered_at
      const { data: dataMin, error: errorMin } = await supabase
        .from('estado_equipos')
        .select('id, equipo_id, estado, proceso_actual_id, created_at, updated_at')
        .eq('equipo_id', id)
        .maybeSingle();

      if (errorMin) {
        console.error('Error loading estado:', errorMin);
        setEstadoEquipo(null);
        return;
      }

      const data = dataMin;
      if (!data) {
        setEstadoEquipo(null);
        return;
      }

      // Normalizar para la UI: "finalizado" y "listo" se muestran como ENTREGADO / LISTO PARA RECOGER
      const estadoParaUI = data.estado === 'finalizado' ? 'delivered' : data.estado === 'listo' ? 'ready_for_pickup' : data.estado;
      const estadoEquipoParaUI = {
        ...data,
        estado: estadoParaUI,
        ready_at: data.ready_at ?? (data.estado === 'listo' ? (data.updated_at || data.created_at) : null),
        delivered_at: data.delivered_at ?? (data.estado === 'finalizado' ? (data.updated_at || data.created_at) : null),
      };

      setEstadoEquipo(estadoEquipoParaUI);

      if (data.proceso_actual_id) {
        const [procesoResult] = await Promise.all([
          supabase
            .from('procesos')
            .select('id, nombre, descripcion, precio')
            .eq('id', data.proceso_actual_id)
            .maybeSingle(),
          loadSubprocesos(data.proceso_actual_id),
        ]);
        setProcesoInfo(procesoResult.data || null);
      }
    } catch (error) {
      console.error('Error loading estado:', error);
      setEstadoEquipo(null);
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
      const { data: { user: currentUser } } = await getCurrentUser();

      const { data, error } = await supabase
        .from('historial_procesos')
        .select(`
          *,
          procesos (nombre),
          subprocesos (nombre)
        `)
        .eq('equipo_id', id)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      
      const eventos = data || [];
      // Obtener TODOS los usuario_ids únicos del historial (incluyendo el usuario actual si aparece)
      const todosUsuarioIds = [...new Set(
        eventos
          .filter((e) => e.usuario_id)
          .map((e) => e.usuario_id)
      )];

      let profilesMap = new Map();
      if (todosUsuarioIds.length > 0) {
        // Solo columnas que suelen existir en profiles (evitar 400 por columna inexistente como email)
        const { data: profilesList, error: profilesError } = await supabase
          .from('profiles')
          .select('id, nombre, apodo, foto_url')
          .in('id', todosUsuarioIds);
        if (!profilesError && Array.isArray(profilesList)) {
          profilesList.forEach((p) => {
            if (p?.id) {
              const nombre = (p.nombre && String(p.nombre).trim()) || '';
              const apodo = (p.apodo && String(p.apodo).trim()) || '';
              profilesMap.set(p.id, {
                id: p.id,
                nombre: nombre || null,
                apodo: apodo || null,
                email: null,
                foto_url: p.foto_url || null
              });
            }
          });
        }
        // Si la consulta batch falla (ej. RLS/400), intentar uno por uno sin pedir email
        if (profilesMap.size === 0 && todosUsuarioIds.length > 0) {
          for (const uid of todosUsuarioIds) {
            const { data: one } = await supabase
              .from('profiles')
              .select('id, nombre, apodo, foto_url')
              .eq('id', uid)
              .maybeSingle();
            if (one?.id) {
              const nombre = (one.nombre && String(one.nombre).trim()) || '';
              const apodo = (one.apodo && String(one.apodo).trim()) || '';
              profilesMap.set(one.id, {
                id: one.id,
                nombre: nombre || null,
                apodo: apodo || null,
                email: null,
                foto_url: one.foto_url || null
              });
            }
          }
        }
      }

      const historialConProfiles = eventos.map((evento) => {
        if (!evento.usuario_id) return { ...evento, profiles: null };
        if (currentUser?.id === evento.usuario_id) {
          const p = profilesMap.get(currentUser.id);
          const nombre = p?.nombre
            || p?.apodo
            || currentUser.user_metadata?.nombre
            || currentUser.user_metadata?.full_name
            || currentUser.email?.split('@')[0]
            || 'Yo';
          const foto_url = p?.foto_url ?? currentUser.user_metadata?.avatar_url ?? null;
          return {
            ...evento,
            profiles: {
              id: currentUser.id,
              nombre,
              apodo: p?.apodo || null,
              email: currentUser.email,
              foto_url
            }
          };
        }
        const profile = profilesMap.get(evento.usuario_id);
        // Si no se encontró el perfil, crear uno básico con el usuario_id para evitar mostrar "Sistema"
        if (!profile) {
          return {
            ...evento,
            profiles: {
              id: evento.usuario_id,
              nombre: null,
              apodo: null,
              email: null,
              foto_url: null,
              usuario_id: evento.usuario_id // Guardar el ID para intentar obtener más info después
            }
          };
        }
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

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida');
      return;
    }

    // Validar tamaño (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('La imagen es demasiado grande. Máximo 10MB');
      return;
    }

    setSubiendoFoto(true);
    try {
      // Convertir archivo a base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result;
          
          // Obtener usuario actual
          const { data: { user } } = await getCurrentUser();
          
          // Subir foto
          await uploadEquipoPhoto(id, base64Data, user?.id || null);
          
          // Recargar fotos
          await loadFotos();
          
          alert('Foto agregada exitosamente');
        } catch (error) {
          console.error('Error uploading photo:', error);
          alert('Error al subir la foto: ' + (error.message || 'Error desconocido'));
        } finally {
          setSubiendoFoto(false);
          // Limpiar input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };
      reader.onerror = () => {
        alert('Error al leer el archivo');
        setSubiendoFoto(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error al procesar el archivo');
      setSubiendoFoto(false);
    }
  };

  const handlePhotoPlaceholderClick = () => {
    if (subiendoFoto) return;
    fileInputRef.current?.click();
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

  const marcarComoListoParaRecoger = async () => {
    if (demoMode) {
      alert('Demo: aquí se marcaría el equipo como listo para recoger.');
      return;
    }

    if (!confirm('¿Seguro que el equipo ya está listo para recoger?')) {
      return;
    }

    try {
      const now = new Date().toISOString();
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
            estado: 'ready_for_pickup',
            proceso_actual_id: estadoEquipo?.proceso_actual_id,
            updated_at: now
          })
          .eq('equipo_id', id);
        estadoError = error;
      } else {
        const { error } = await supabase
          .from('estado_equipos')
          .insert({
            equipo_id: id,
            estado: 'ready_for_pickup',
            proceso_actual_id: estadoEquipo?.proceso_actual_id,
            updated_at: now
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
        console.error('No user ID available for marcarComoListoParaRecoger');
        alert('Error: No se pudo identificar el usuario. Por favor recarga la página.');
        return;
      }

      const { error: historialError } = await supabase
        .from('historial_procesos')
        .insert({
          equipo_id: id,
          proceso_id: estadoEquipo?.proceso_actual_id,
          notas: 'Equipo terminado y listo para recoger',
          completado: true,
          fecha_completado: now,
          usuario_id: usuarioId,
          tipo_evento: 'estado'
        });

      if (historialError) throw historialError;

      alert('Equipo marcado como listo para recoger exitosamente');
      window.dispatchEvent(new Event('equipoUpdated'));
      await loadEstadoEquipo();
      await loadHistorial();
    } catch (error) {
      console.error('Error marking equipo as ready for pickup:', error);
      alert('Error al marcar el equipo como listo para recoger');
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

  // Función para cambiar estado desde el modal (segmented control)
  const cambiarEstadoEquipo = async (nuevoEstado) => {
    if (demoMode) {
      alert(`Demo: aquí se cambiaría el estado a ${nuevoEstado}.`);
      return;
    }

    const estadoActual = estadoEquipo?.estado || 'pendiente';
    
    // Si ya está en ese estado, no hacer nada
    if (estadoActual === nuevoEstado || 
        (estadoActual === 'listo' && nuevoEstado === 'ready_for_pickup') ||
        (estadoActual === 'finalizado' && nuevoEstado === 'delivered')) {
      return;
    }

    // Mostrar modal de confirmación personalizado
    const estadoNombre = nuevoEstado === 'en_proceso' ? 'En Proceso' : 
                         nuevoEstado === 'ready_for_pickup' ? 'Listo para recoger' : 
                         'Entregado';
    
    let mensajeConfirmacion = '';
    let tipoConfirmacion = 'normal';
    
    if (nuevoEstado === 'ready_for_pickup') {
      mensajeConfirmacion = '¿Seguro que el equipo ya está listo para recoger?';
      tipoConfirmacion = 'ready';
    } else if (nuevoEstado === 'delivered') {
      mensajeConfirmacion = '¿Seguro que el cliente ya se llevó el equipo?';
      tipoConfirmacion = 'delivered';
    } else if (nuevoEstado === 'en_proceso' && (estadoActual === 'delivered' || estadoActual === 'finalizado' || estadoActual === 'ready_for_pickup' || estadoActual === 'listo')) {
      mensajeConfirmacion = 'Estás reabriendo un equipo que ya estaba entregado o listo. ¿Estás seguro?';
      tipoConfirmacion = 'warning';
    } else {
      mensajeConfirmacion = `¿Cambiar el estado del equipo a "${estadoNombre}"?`;
      tipoConfirmacion = 'normal';
    }

    // Guardar datos para el modal y mostrarlo
    setConfirmEstadoData({
      nuevoEstado,
      estadoNombre,
      mensaje: mensajeConfirmacion,
      tipo: tipoConfirmacion,
      estadoActual
    });
    setShowConfirmEstadoModal(true);
  };

  const ejecutarCambioEstado = async () => {
    if (!confirmEstadoData) return;
    
    const { nuevoEstado, estadoActual } = confirmEstadoData;
    setShowConfirmEstadoModal(false);

    const equipoId = parseInt(String(id), 10);
    if (Number.isNaN(equipoId)) {
      alert('Error: ID de equipo no válido');
      setConfirmEstadoData(null);
      return;
    }

    try {
      const now = new Date().toISOString();
      const usuarioId = currentUser?.id;
      if (!usuarioId) {
        alert('Error: No se pudo identificar el usuario');
        return;
      }

      // Preparar datos de actualización según el nuevo estado
      // Solo usamos columnas que existen en todas las BBDD: estado, updated_at, proceso_actual_id
      // (ready_at y delivered_at requieren ejecutar migrate_estados_equipos.sql)
      let updateData = {
        updated_at: now
      };

      if (nuevoEstado === 'ready_for_pickup') {
        updateData.estado = 'ready_for_pickup';
        updateData.proceso_actual_id = estadoEquipo?.proceso_actual_id ?? null;
      } else if (nuevoEstado === 'delivered') {
        updateData.estado = 'delivered';
        updateData.proceso_actual_id = estadoEquipo?.proceso_actual_id ?? null;
      } else if (nuevoEstado === 'en_proceso') {
        updateData.estado = 'en_proceso';
        updateData.proceso_actual_id = estadoEquipo?.proceso_actual_id ?? null;
      }

      // Actualizar o crear estado (usar equipo_id numérico)
      const { data: estadoExistente, error: consultaError } = await supabase
        .from('estado_equipos')
        .select('id')
        .eq('equipo_id', equipoId)
        .maybeSingle();

      // Si la consulta falló por algo distinto a "no hay filas", lanzar error
      if (consultaError) {
        throw consultaError;
      }

      let estadoError;
      if (estadoExistente) {
        const { error } = await supabase
          .from('estado_equipos')
          .update(updateData)
          .eq('equipo_id', equipoId);
        estadoError = error;
      } else {
        const { error } = await supabase
          .from('estado_equipos')
          .insert({
            equipo_id: equipoId,
            estado: updateData.estado,
            proceso_actual_id: updateData.proceso_actual_id ?? null,
            updated_at: updateData.updated_at
          });
        estadoError = error;
      }

      if (estadoError) throw estadoError;

      // Registrar en historial
      let notaHistorial = '';
      let tipoEvento = 'estado';
      if (nuevoEstado === 'ready_for_pickup') {
        notaHistorial = 'Equipo marcado como listo para recoger';
      } else if (nuevoEstado === 'delivered') {
        notaHistorial = 'Equipo marcado como entregado';
        tipoEvento = 'entrega';
      } else if (nuevoEstado === 'en_proceso') {
        const estadoActualParaHistorial = estadoActual || estadoEquipo?.estado || 'pendiente';
        if (estadoActualParaHistorial === 'delivered' || estadoActualParaHistorial === 'finalizado' || estadoActualParaHistorial === 'ready_for_pickup' || estadoActualParaHistorial === 'listo') {
          notaHistorial = 'Equipo reabierto y vuelto a proceso';
          tipoEvento = 'reapertura';
        }
      }

      if (notaHistorial) {
        const { error: historialError } = await supabase
          .from('historial_procesos')
          .insert({
            equipo_id: equipoId,
            proceso_id: estadoEquipo?.proceso_actual_id ?? null,
            notas: notaHistorial,
            completado: nuevoEstado === 'delivered' || nuevoEstado === 'ready_for_pickup',
            fecha_completado: (nuevoEstado === 'delivered' || nuevoEstado === 'ready_for_pickup') ? now : null,
            usuario_id: usuarioId,
            tipo_evento: tipoEvento
          });

        if (historialError) throw historialError;
      }

      // Notificaciones
      if (nuevoEstado === 'ready_for_pickup') {
        try {
          await notificarEquipoListo(equipo, cliente);
        } catch (notifError) {
          console.error('Error creating notification (non-critical):', notifError);
        }
      } else if (nuevoEstado === 'delivered') {
        try {
          await notificarEquipoFinalizado(equipo, cliente);
        } catch (notifError) {
          console.error('Error creating notification (non-critical):', notifError);
        }
      }

      const estadoNombreFinal = nuevoEstado === 'en_proceso' ? 'En Proceso' : 
                                nuevoEstado === 'ready_for_pickup' ? 'Listo para recoger' : 
                                'Entregado';
      alert(`Estado actualizado exitosamente a "${estadoNombreFinal}"`);
      await loadEquipo();
      await loadEstadoEquipo();
      await loadHistorial();
      window.dispatchEvent(new Event('equipoUpdated'));
    } catch (error) {
      const msg = error?.message || '';
      const detail = error?.details || '';
      const hint = error?.hint || '';
      console.error('Error cambiando estado:', error);
      console.error('Detalle:', msg, detail, hint);
      const textoUsuario = msg ? `Error al cambiar el estado del equipo. ${msg}` : 'Error al cambiar el estado del equipo. Revisa la consola (F12) para más detalle.';
      alert(textoUsuario);
    } finally {
      setConfirmEstadoData(null);
    }
  };

  // Función para abrir nota PDF en página full-screen (mejor para iPhone e imprimir)
  const abrirNotaPDF = (equipoData, tipoNota) => {
    const basePath = demoMode ? '/demo' : '';
    navigate(`${basePath}/nota-pdf`, {
      state: {
        equipo: equipoData,
        cliente,
        tipo: tipoNota,
        returnTo: `${basePath}/equipos/${id}`
      }
    });
  };

  // Función para generar/reimprimir nota de recepción
  const generarNotaRecepcion = async () => {
    try {
      const { data: pedidosData } = await supabase
        .from('pedidos_piezas')
        .select('id, nombre_pieza, cantidad, precio_unitario, estado')
        .eq('equipo_id', equipo.id);
      const pedidos = (pedidosData || []).filter(p => p.estado !== 'cancelado');
      const pTotal = pedidos.reduce((s, p) => s + (parseFloat(p?.cantidad) || 0) * (parseFloat(p?.precio_unitario) || 0), 0);
      const equipoParaNota = {
        ...equipo,
        procesos: procesosEquipo.length > 0 ? procesosEquipo : (procesoInfo ? [procesoInfo] : []),
        pedidos_ligados: pedidos,
        pedidos_total: pTotal
      };
      abrirNotaPDF(equipoParaNota, 'recepcion');
      setShowOpcionesEspeciales(false);
    } catch (err) {
      console.error('Error cargando pedidos:', err);
      abrirNotaPDF({ ...equipo, procesos: procesosEquipo.length > 0 ? procesosEquipo : (procesoInfo ? [procesoInfo] : []) }, 'recepcion');
      setShowOpcionesEspeciales(false);
    }
  };

  // Función para generar/reimprimir nota de entrega
  const generarNotaEntrega = () => {
    const serviciosTot = procesosEquipo.reduce((s, p) => s + (parseFloat(p?.precio) || 0), 0);
    const extra = parseFloat(precioExtra) || 0;
    setTotalConfirmado(String(serviciosTot + pedidosTotal + extra));
    const procesosList = procesosEquipo.length > 0 ? procesosEquipo : (procesoInfo ? [procesoInfo] : []);
    const problemaTexto = procesosList.length
      ? procesosList.map(p => p?.nombre).filter(Boolean).join(', ')
      : '';
    setSolucionImplementada(problemaTexto);
    setShowConfirmarTotalModal(true);
    setShowOpcionesEspeciales(false);
  };

  const reabrirEquipo = async () => {
    if (demoMode) {
      alert('Demo: aquí se reabriría el equipo.');
      return;
    }

    if (!justificacionReabrir.trim()) {
      alert('Por favor proporciona una justificación para reabrir el equipo');
      return;
    }

    if (!confirm('¿Estás seguro de reabrir este equipo? Se volverá a poner en proceso.')) {
      return;
    }

    setReabriendoEquipo(true);
    try {
      const usuarioId = currentUser?.id;
      if (!usuarioId) {
        alert('Error: No se pudo identificar el usuario');
        return;
      }

      // Actualizar estado a en_proceso y limpiar fechas de entrega
      const now = new Date().toISOString();
      const { error: estadoError } = await supabase
        .from('estado_equipos')
        .update({
          estado: 'en_proceso',
          updated_at: now
        })
        .eq('equipo_id', id);

      if (estadoError) throw estadoError;

      // Registrar en historial con justificación
      const { error: historialError } = await supabase
        .from('historial_procesos')
        .insert({
          equipo_id: id,
          proceso_id: estadoEquipo?.proceso_actual_id,
          notas: `OPCIÓN ESPECIAL: Equipo reabierto. Justificación: ${justificacionReabrir.trim()}`,
          completado: false,
          fecha_completado: null,
          usuario_id: usuarioId,
          tipo_evento: 'reapertura'
        });

      if (historialError) throw historialError;

      alert('Equipo reabierto exitosamente. Se ha vuelto a poner en proceso.');
      setShowOpcionesEspeciales(false);
      setJustificacionReabrir('');
      await loadEquipo();
      await loadEstadoEquipo();
      await loadHistorial();
      window.dispatchEvent(new Event('equipoUpdated'));
    } catch (error) {
      console.error('Error reabriendo equipo:', error);
      alert('Error al reabrir el equipo');
    } finally {
      setReabriendoEquipo(false);
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

      // Actualizar estado a entregado (delivered) con justificación especial
      const now = new Date().toISOString();
      const { error: estadoError } = await supabase
        .from('estado_equipos')
        .update({
          estado: 'delivered',
          updated_at: now
        })
        .eq('equipo_id', id);

      if (estadoError) throw estadoError;

      // Registrar en historial con justificación
      const { error: historialError } = await supabase
        .from('historial_procesos')
        .insert({
          equipo_id: id,
          proceso_id: estadoEquipo?.proceso_actual_id,
          notas: `OPCIÓN ESPECIAL: Equipo entregado sin completar proceso. Justificación: ${justificacionFinalizado.trim()}`,
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

      alert('Equipo marcado como entregado exitosamente');
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

  const marcarComoEntregado = async () => {
    if (demoMode) {
      alert('Demo: aquí se marcaría el equipo como entregado y se generaría la nota real.');
      return;
    }

    if (!confirm('¿Seguro que el cliente ya se llevó el equipo?')) {
      return;
    }

    try {
      const now = new Date().toISOString();
      const { error: estadoError } = await supabase
        .from('estado_equipos')
        .update({
          estado: 'delivered',
          updated_at: now
        })
        .eq('equipo_id', id);

      if (estadoError) throw estadoError;

      const usuarioId = currentUser?.id;
      if (!usuarioId) {
        console.error('No user ID available for marcarComoEntregado');
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
          fecha_completado: now,
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

      window.dispatchEvent(new Event('equipoUpdated'));
      const basePath = demoMode ? '/demo' : '';
      const eqParaNota = {
        ...equipo,
        procesos: procesosEquipo.length > 0 ? procesosEquipo : (procesoInfo ? [procesoInfo] : []),
        pedidos_ligados: pedidosLigados,
        pedidos_total: pedidosTotal,
        precio_extra: parseFloat(precioExtra) || 0,
        adelanto: equipo.adelanto
      };
      navigate(`${basePath}/nota-pdf`, {
        state: {
          equipo: eqParaNota,
          cliente,
          tipo: 'entrega',
          returnTo: `${basePath}/equipos`
        }
      });
    } catch (error) {
      console.error('Error marking equipo as delivered:', error);
      alert('Error al marcar el equipo como entregado');
    }
  };

  const marcarComoPagado = async () => {
    if (demoMode) {
      alert('Demo: aquí se marcaría el equipo como pagado.');
      return;
    }

    if (!currentUser?.id) {
      alert('Error: No se pudo identificar el usuario. Por favor recarga la página.');
      return;
    }

    setMarcandoComoPagado(true);
    try {
      // Calcular el total y el adeudo
      const serviciosTot = procesosEquipo.reduce((s, p) => s + (parseFloat(p?.precio) || 0), 0);
      const extra = parseFloat(precioExtra) || 0;
      const totalCalculado = serviciosTot + pedidosTotal + extra;
      const adelanto = parseFloat(equipo.adelanto || 0);
      const adeudo = totalCalculado - adelanto;

      // Actualizar el adelanto para que sea igual al total (marcando como pagado completamente)
      const { error: updateError } = await supabase
        .from('equipos')
        .update({
          adelanto: totalCalculado
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Registrar en historial
      const { error: historialError } = await supabase
        .from('historial_procesos')
        .insert({
          equipo_id: id,
          proceso_id: estadoEquipo?.proceso_actual_id || null,
          notas: `Pago completo recibido. Total: $${totalCalculado.toFixed(2)}`,
          completado: false,
          usuario_id: currentUser.id,
          tipo_evento: 'nota'
        });

      if (historialError) throw historialError;

      // Recargar datos del equipo
      await loadEquipo();
      setShowPagoCompletoModal(false);
      
      alert('Equipo marcado como pagado exitosamente');
    } catch (error) {
      console.error('Error marking equipo as paid:', error);
      alert('Error al marcar el equipo como pagado: ' + (error.message || 'Error desconocido'));
    } finally {
      setMarcandoComoPagado(false);
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
    
    try {
      // Parsear la fecha - Supabase devuelve fechas en formato ISO UTC
      let date;
      if (typeof dateString === 'string') {
        // Si la fecha viene sin 'Z', Supabase la devuelve como UTC pero sin el indicador
        // Necesitamos asegurarnos de que se interprete como UTC
        if (dateString.includes('T') && !dateString.includes('Z') && !dateString.includes('+') && !dateString.includes('-', 10)) {
          // Es una fecha ISO sin zona horaria, Supabase la devuelve en UTC
          date = new Date(dateString + 'Z');
        } else {
          date = new Date(dateString);
        }
      } else {
        date = new Date(dateString);
      }
      
      // Verificar que la fecha es válida
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      
      // Obtener los componentes de la fecha en hora de México
      // Usar toLocaleString con timeZone para obtener los valores correctos
      const mexicoTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).formatToParts(date);
      
      // Construir la fecha formateada en español
      const day = mexicoTime.find(p => p.type === 'day')?.value || '';
      const month = mexicoTime.find(p => p.type === 'month')?.value || '';
      const year = mexicoTime.find(p => p.type === 'year')?.value || '';
      const hour = mexicoTime.find(p => p.type === 'hour')?.value || '';
      const minute = mexicoTime.find(p => p.type === 'minute')?.value || '';
      const dayPeriod = mexicoTime.find(p => p.type === 'dayPeriod')?.value || '';
      
      // Mapear meses al español
      const meses = {
        'Jan': 'ene', 'Feb': 'feb', 'Mar': 'mar', 'Apr': 'abr',
        'May': 'may', 'Jun': 'jun', 'Jul': 'jul', 'Aug': 'ago',
        'Sep': 'sep', 'Oct': 'oct', 'Nov': 'nov', 'Dec': 'dic'
      };
      
      const mesEsp = meses[month] || month.toLowerCase();
      const periodo = dayPeriod === 'AM' ? 'a.m.' : 'p.m.';
      
      return `${day} ${mesEsp} ${year}, ${hour}:${minute} ${periodo}`;
    } catch (error) {
      console.error('Error formateando fecha:', error, dateString);
      // Fallback simple
      try {
        const date = new Date(dateString);
        return date.toLocaleString('es-MX', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Mexico_City'
        });
      } catch (e) {
        return 'N/A';
      }
    }
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

  const guardarPrecioExtra = async (monto, descripcion = null) => {
    if (!equipo?.id || demoMode) return;
    const montoNum = parseFloat(monto) || 0;
    if (montoNum < 0) {
      alert('El monto extra no puede ser negativo.');
      return;
    }
    
    setGuardandoExtra(true);
    try {
      const updateData = { precio_extra: montoNum };
      if (descripcion !== null) {
        updateData.descripcion_extra = descripcion?.trim() || null;
      }
      
      const { error } = await supabase
        .from('equipos')
        .update(updateData)
        .eq('id', equipo.id);

      if (error) {
        // Si la columna no existe, mostrar mensaje útil
        const msg = (error?.message || String(error)).toLowerCase();
        const isColumnaFalta = error?.code === '42703' || msg.includes('precio_extra') || msg.includes('descripcion_extra') || msg.includes('does not exist') || msg.includes('column');
        if (isColumnaFalta) {
          alert('La tabla equipos necesita las columnas "precio_extra" y "descripcion_extra". Ejecuta en Supabase (SQL Editor) los scripts add_precio_extra_equipo.sql y add_descripcion_extra_equipo.sql del proyecto.');
        } else {
          throw error;
        }
      } else {
        // Actualizar el estado local del equipo
        setEquipo(prev => ({ 
          ...prev, 
          precio_extra: montoNum,
          descripcion_extra: descripcion?.trim() || null
        }));
      }
    } catch (error) {
      console.error('Error guardando precio extra:', error);
      alert('Error al guardar el monto extra: ' + (error?.message || error));
    } finally {
      setGuardandoExtra(false);
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
      setDescripcionAdelanto('');
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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handlePhotoUpload}
      />
      {/* Top Header - Datos fijos arriba */}
      <header className="equipo-detalle-header equipo-detalle-header-expanded">
        <div className="header-top-row">
          <button onClick={() => navigate(demoMode ? '/demo/equipos' : '/equipos')} className="header-back-btn">
            <Icon name="arrow-left" />
          </button>
          <button
            type="button"
            className="header-equipo-photo-wrap"
            onClick={() => {
              if (fotos.length > 0) {
                setSelectedPhoto(fotos[0]);
              } else {
                handlePhotoPlaceholderClick();
              }
            }}
            title={fotos.length > 0 ? 'Ver foto del equipo' : 'Agregar foto del equipo'}
          >
            {fotos.length > 0 ? (
              <img src={fotos[0].url} alt="" className="header-equipo-photo" />
            ) : (
              <div className="header-equipo-photo header-equipo-photo-placeholder">
                <Icon name="camera" />
              </div>
            )}
          </button>
          <div className="header-main">
            <div className="header-main-info">
              <div className="header-equipo-number">#{equipo.nota}</div>
              <div className="header-equipo-model">{equipo.marca} {equipo.modelo}</div>
            </div>
            <div className="header-main-status-row">
              <span className={`status-badge status-badge-header ${estadoEquipo?.estado === 'finalizado' ? 'delivered' : estadoEquipo?.estado || 'pendiente'}`}>
                {estadoEquipo?.estado === 'en_proceso' ? 'EN PROCESO' : 
                 estadoEquipo?.estado === 'delivered' || estadoEquipo?.estado === 'finalizado' ? 'ENTREGADO' :
                 estadoEquipo?.estado === 'ready_for_pickup' ? 'LISTO PARA RECOGER' :
                 estadoEquipo?.estado === 'listo' ? 'LISTO PARA RECOGER' : // Compatibilidad temporal
                 estadoEquipo?.estado === 'cancelled' ? 'CANCELADO' :
                 !estadoEquipo ? 'PENDIENTE' : 'PENDIENTE'}
              </span>
              {equipo.problema && equipo.problema.trim() && (
                <div 
                  className="header-problema-pill header-problema-pill-clickable"
                  onClick={() => setShowProblemaModal(true)}
                  title="Click para ver el problema completo"
                >
                  <span className="header-problema-label">Problema</span>
                  <span className="header-problema-value">{equipo.problema}</span>
                </div>
              )}
            </div>
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
          <div className="header-data-block header-data-block-equipo">
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
            {/* Costos y Entrega - Colapsable con Total siempre visible */}
            {(() => {
              const serviciosTot = procesosEquipo.reduce((s, p) => s + (parseFloat(p?.precio) || 0), 0);
              const extra = parseFloat(precioExtra) || 0;
              const totalCalculado = serviciosTot + pedidosTotal + extra;
              const adelanto = parseFloat(equipo.adelanto || 0);
              const adeudo = totalCalculado - adelanto;
              return (
                <div className={`header-equipo-total header-costos-section ${costosExpanded ? 'expanded' : 'collapsed'}`}>
                  <div 
                    className="header-costos-header"
                    onClick={() => setCostosExpanded(!costosExpanded)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="header-costos-title">
                      <Icon name="dollar-sign" />
                      <span>Costos y entrega</span>
                    </div>
                    {/* Total siempre visible - Grande */}
                    <div className="header-total-always-visible">
                      <span className="header-total-valor-large">${totalCalculado.toFixed(2)}</span>
                    </div>
                    <button
                      type="button"
                      className="header-costos-toggle-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCostosExpanded(!costosExpanded);
                      }}
                      title={costosExpanded ? "Contraer" : "Expandir"}
                    >
                      <Icon name={costosExpanded ? "chevron-up" : "chevron-down"} />
                    </button>
                  </div>
                  {/* Detalles solo cuando está expandido */}
                  {costosExpanded && (
                    <div className="header-costos-content">
                      <div className="header-total-row">
                        <span className="header-total-label">Adelanto</span>
                        <div className="header-total-value-with-action">
                          <span>${adelanto.toFixed(2)}</span>
                          <button
                            type="button"
                            className="header-costos-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNuevoAdelanto('');
                              setDescripcionAdelanto('');
                              setShowPagoModal(true);
                            }}
                            title="Agregar adelanto"
                          >
                            <Icon name="plus-circle" />
                          </button>
                        </div>
                      </div>
                      <div className="header-total-row">
                        <span className="header-total-label">Adeudo</span>
                        <span className={adeudo > 0 ? 'header-adeudo-pendiente' : 'header-adeudo-cero'}>
                          ${adeudo.toFixed(2)}
                        </span>
                      </div>
                      <div className="header-total-row header-total-row-extra">
                        <span className="header-total-label">Cobro extra</span>
                        <div className="header-total-value-with-action">
                          <span>{(parseFloat(precioExtra) || 0) > 0 ? `$${parseFloat(precioExtra).toFixed(2)}` : '—'}</span>
                          <button
                            type="button"
                            className="header-costos-action-btn header-costos-btn-extra"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowExtraModal(true);
                            }}
                            title={(parseFloat(precioExtra) || 0) > 0 ? 'Editar cobro extra' : 'Agregar cobro extra'}
                          >
                            <Icon name="plus-circle" />
                          </button>
                        </div>
                      </div>
                      <div className="header-total-row header-total-row-pagado">
                        <span className="header-total-label">Estado de pago</span>
                        <div className="header-pagado-right">
                          {adeudo <= 0 ? (
                            <span className="header-pagado-badge header-pagado-si">
                              <Icon name="check-circle" />
                              Pagado
                            </span>
                          ) : (
                            <>
                              <span className="header-pagado-badge header-pagado-pendiente">
                                Pendiente
                              </span>
                              <button
                                type="button"
                                className="header-costos-btn-pagado"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowPagoCompletoModal(true);
                                }}
                                title="Marcar como pagado"
                              >
                                <Icon name="dollar-sign" />
                                Marcar como pagado
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
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
              <span className={`status-badge-inline ${estadoEquipo?.estado === 'finalizado' ? 'delivered' : estadoEquipo?.estado || 'pendiente'}`}>
                {estadoEquipo?.estado === 'en_proceso' ? 'En Proceso' : 
                 estadoEquipo?.estado === 'delivered' || estadoEquipo?.estado === 'finalizado' ? 'Entregado' :
                 estadoEquipo?.estado === 'ready_for_pickup' ? 'Listo para recoger' :
                 estadoEquipo?.estado === 'listo' ? 'Listo para recoger' : // Compatibilidad temporal
                 estadoEquipo?.estado === 'cancelled' ? 'Cancelado' :
                 'Pendiente'}
              </span>
              <span className="header-proceso-fecha">
                <Icon name="calendar-alt" /> {formatDate(equipo.created_at)}
              </span>
              {(() => {
                // "Quién recibió" = evento de recepción si existe, si no el evento más antiguo con usuario_id
                const asc = [...(historial || [])].reverse();
                const recepcion = asc.find(e => e?.tipo_evento === 'recepcion' && e?.usuario_id) || asc.find(e => e?.usuario_id);
                const p = recepcion?.profiles;
                const nombre = (p?.nombre && String(p.nombre).trim())
                  || (p?.apodo && String(p.apodo).trim())
                  || (recepcion?.usuario_id ? 'Miembro del equipo' : 'No registrado');
                const fecha = recepcion?.created_at ? formatDate(recepcion.created_at) : null;
                return (
                  <span className="header-recibio-row" title={fecha ? `Recibido el ${fecha}` : 'Recibió el equipo'}>
                    <Icon name="user" /> Recibió: {nombre}{fecha ? ` • ${fecha}` : ''}
                  </span>
                );
              })()}
            </div>
            {/* Botones de acción según estado - FLUJO NORMAL VISIBLE */}
            {estadoEquipo?.estado === 'en_proceso' && (
              <div className="header-estado-action">
                <button
                  className="header-estado-btn header-estado-btn-ready"
                  onClick={marcarComoListoParaRecoger}
                >
                  <Icon name="check-circle" />
                  Marcar como listo para recoger
                </button>
              </div>
            )}
            {estadoEquipo?.estado === 'ready_for_pickup' && (
              <div className="header-estado-action">
                <button
                  className="header-estado-btn header-estado-btn-success"
                  onClick={() => setShowPagoCompletoModal(true)}
                >
                  <Icon name="check-circle" />
                  Pagado
                </button>
                <button
                  className="header-estado-btn header-estado-btn-delivered"
                  onClick={marcarComoEntregado}
                >
                  <Icon name="box" />
                  Marcar como entregado
                </button>
              </div>
            )}
            {(estadoEquipo?.estado === 'listo' || estadoEquipo?.estado === 'finalizado') && (
              // Compatibilidad temporal: mostrar botón según estado antiguo
              <div className="header-estado-action">
                {estadoEquipo?.estado === 'listo' ? (
                  <button
                    className="header-estado-btn header-estado-btn-delivered"
                    onClick={marcarComoEntregado}
                  >
                    <Icon name="box" />
                    Marcar como entregado
                  </button>
                ) : (
                  <div className="header-estado-info">
                    <Icon name="check-circle" />
                    <span>Equipo entregado</span>
                    {estadoEquipo?.delivered_at && (
                      <span className="header-estado-fecha">
                        {formatDate(estadoEquipo.delivered_at)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            {estadoEquipo?.estado === 'delivered' && (
              <div className="header-estado-info">
                <Icon name="check-circle" />
                <span>Equipo entregado</span>
                {estadoEquipo?.delivered_at && (
                  <span className="header-estado-fecha">
                    Entregado el {formatDate(estadoEquipo.delivered_at)}
                  </span>
                )}
              </div>
            )}
            {/* Siguiente Paso - dentro de la misma box de Proceso */}
            {siguienteSubproceso && estadoEquipo?.estado !== 'delivered' && estadoEquipo?.estado !== 'finalizado' && (
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
            {/* Generadores de notas - debajo de Proceso */}
            <div className="header-notas-actions">
              <button 
                className="header-nota-btn"
                onClick={async () => {
                  try {
                    const { data: pedidosData } = await supabase
                      .from('pedidos_piezas')
                      .select('id, nombre_pieza, cantidad, precio_unitario, estado')
                      .eq('equipo_id', equipo.id);
                    const pedidos = (pedidosData || []).filter(p => p.estado !== 'cancelado');
                    const pTotal = pedidos.reduce((s, p) => s + (parseFloat(p?.cantidad) || 0) * (parseFloat(p?.precio_unitario) || 0), 0);
                    const eqRec = { ...equipo, procesos: procesosEquipo.length > 0 ? procesosEquipo : (procesoInfo ? [procesoInfo] : []), pedidos_ligados: pedidos, pedidos_total: pTotal };
                    abrirNotaPDF(eqRec, 'recepcion');
                  } catch (err) {
                    abrirNotaPDF({ ...equipo, procesos: procesosEquipo.length > 0 ? procesosEquipo : (procesoInfo ? [procesoInfo] : []) }, 'recepcion');
                  }
                }}
              >
                <Icon name="file-alt" /> Nota de Recepción
              </button>
              {(estadoEquipo?.estado === 'ready_for_pickup' || estadoEquipo?.estado === 'listo' || estadoEquipo?.estado === 'finalizado') && (
                <button 
                  className="header-nota-btn header-nota-btn-primary"
                  onClick={() => {
                    const serviciosTot = procesosEquipo.reduce((s, p) => s + (parseFloat(p?.precio) || 0), 0);
                    const extra = parseFloat(precioExtra) || 0;
                    setTotalConfirmado(String(serviciosTot + pedidosTotal + extra));
                    const procesosList = procesosEquipo.length > 0 ? procesosEquipo : (procesoInfo ? [procesoInfo] : []);
                    const problemaTexto = procesosList.length
                      ? procesosList.map(p => p?.nombre).filter(Boolean).join(', ')
                      : '';
                    setSolucionImplementada(problemaTexto);
                    setShowConfirmarTotalModal(true);
                  }}
                >
                  <Icon name="file-alt" /> Nota de Entrega
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Timeline a ancho completo (sin sección de fotos abajo) */}
      <div className="equipo-detalle-main">
        {/* Costos y Entrega - Ocultado porque ya está en el header */}
          {/* {equipo && (
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
                      <div className="costos-desglose">
                        <div className="costos-desglose-titulo">
                          <Icon name="wrench" />
                          Servicios
                        </div>
                        {procesosEquipo.length > 0 ? (
                          <>
                            {procesosEquipo.map((p, i) => {
                              const precio = parseFloat(p?.precio) || 0;
                              return (
                                <div key={p?.id || i} className="costos-desglose-item">
                                  <span className="costos-desglose-nombre">{p?.nombre || 'Servicio'}</span>
                                  <span className="costos-desglose-precio">${precio.toFixed(2)}</span>
                                </div>
                              );
                            })}
                            <div className="costos-desglose-subtotal">
                              <span>Subtotal servicios</span>
                              <span>${serviciosTot.toFixed(2)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="costos-desglose-item costos-desglose-empty">
                            <span>Sin servicios</span>
                            <span>$0.00</span>
                          </div>
                        )}
                      </div>
                      {pedidosLigados.length > 0 && (
                        <div className="costos-desglose">
                          <div className="costos-desglose-titulo">
                            <Icon name="box" />
                            Refacciones
                          </div>
                          {pedidosLigados.map((p) => {
                            const qty = parseFloat(p?.cantidad) || 0;
                            const unit = parseFloat(p?.precio_unitario) || 0;
                            const subtotal = qty * unit;
                            return (
                              <div key={p.id} className="costos-desglose-item">
                                <span className="costos-desglose-nombre">
                                  {p?.nombre_pieza || 'Refacción'} {qty > 1 ? `× ${qty}` : ''}
                                </span>
                                <span className="costos-desglose-precio">${subtotal.toFixed(2)}</span>
                              </div>
                            );
                          })}
                          <div className="costos-desglose-subtotal">
                            <span>Subtotal refacciones</span>
                            <span>${pedidosTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                      {(parseFloat(precioExtra) || 0) > 0 ? (
                        <div className="costos-desglose">
                          <div className="costos-desglose-titulo">
                            <Icon name="plus-circle" />
                            Cobro extra adicional
                          </div>
                          <div className="costos-desglose-item">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                              <span className="costos-desglose-nombre">
                                {descripcionExtra || 'Cobro extra adicional'}
                              </span>
                              {!descripcionExtra && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontStyle: 'italic', fontWeight: 'normal' }}>
                                  Sin descripción detallada
                                </span>
                              )}
                            </div>
                            <span className="costos-desglose-precio">${parseFloat(precioExtra).toFixed(2)}</span>
                          </div>
                          <button
                            type="button"
                            className="costos-btn-editar-extra"
                            onClick={() => {
                              setShowExtraModal(true);
                            }}
                            title="Editar cobro extra"
                          >
                            <Icon name="edit" />
                            Editar
                          </button>
                        </div>
                      ) : (
                        <div className="costos-row costos-extra-empty">
                          <button
                            type="button"
                            className="costos-btn-agregar-extra"
                            onClick={() => {
                              setShowExtraModal(true);
                            }}
                            title="Agregar cobro extra adicional"
                          >
                            <Icon name="plus-circle" />
                            <span>Agregar cobro extra</span>
                            <span className="costos-btn-subtitle">Ajustes de precio, servicios adicionales, etc.</span>
                          </button>
                        </div>
                      )}
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
                            setDescripcionAdelanto('');
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
              <div className="costos-actions">
                {procesosConRecordatorio.length > 0 && (
                  <button className="costos-action-btn" onClick={openLicenciaModal}>
                    <Icon name="key" /> Registrar licencia
                  </button>
                )}
                {estadoEquipo?.estado === 'en_proceso' && subprocesosCompletados.length === subprocesos.length && subprocesos.length > 0 && (
                  <button className="costos-action-btn costos-action-btn-success" onClick={marcarComoListoParaRecoger}>
                    <Icon name="check-circle" /> Marcar como Listo para Recoger
                  </button>
                )}
                {(estadoEquipo?.estado === 'ready_for_pickup' || estadoEquipo?.estado === 'listo') && (
                  <button className="costos-action-btn costos-action-btn-success" onClick={marcarComoEntregado}>
                    <Icon name="flag-checkered" /> Marcar como Entregado
                  </button>
                )}
              </div>
            </section>
          )} */}

        {/* Historial de Eventos - Timeline en cards (más reciente primero) */}
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
          <div className="timeline-scroll-viewport">
            <div className="timeline-cards-row">
            {historial.length > 0 ? (
              historial.map((evento, index) => {
                const agente = evento.profiles;
                const avatarUrl = agente?.foto_url;
                const isMostRecent = index === 0;
                // Determinar el nombre del agente: primero nombre, luego apodo, luego email, luego fallback
                let agenteNombre = 'Usuario desconocido';
                if (agente) {
                  // Prioridad: nombre del perfil > email (parte antes del @) > etiqueta amigable si solo hay ID
                  if (agente.nombre?.trim()) {
                    agenteNombre = agente.nombre.trim();
                  } else if (agente.apodo?.trim()) {
                    agenteNombre = agente.apodo.trim();
                  } else if (agente.email?.trim()) {
                    agenteNombre = agente.email.split('@')[0].trim();
                  } else if (agente.id) {
                    agenteNombre = 'Miembro del equipo';
                  }
                } else if (!evento.usuario_id) {
                  agenteNombre = 'Sistema';
                }
                const initials = agenteNombre === 'Miembro del equipo' ? '?' : getInitials(agenteNombre);
                
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
                  <div key={evento.id} className={`timeline-event timeline-card ${isMostRecent ? 'timeline-card-most-recent' : ''}`}>
                    {isMostRecent && (
                      <span className="timeline-card-badge">Más reciente</span>
                    )}
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
                        <span 
                          className="event-agent" 
                          title={agente?.id && agenteNombre === 'Miembro del equipo' ? `ID: ${agente.id}` : agenteNombre}
                        >
                          {agenteNombre}
                        </span>
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
                          <div className="event-notes-text" title={evento.notas}>{evento.notas}</div>
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
              <div className="confirmar-total-display">
                <label>Solución implementada</label>
                <textarea
                  className="confirmar-total-input"
                  rows={3}
                  placeholder="Describe brevemente la solución aplicada (se usará en la nota de entrega)."
                  value={solucionImplementada}
                  onChange={(e) => setSolucionImplementada(e.target.value)}
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
                onClick={async () => {
                  const total = parseFloat(totalConfirmado || 0);
                  if (total < 0) {
                    alert('El total no puede ser negativo.');
                    return;
                  }
                  const solucionTexto = (solucionImplementada && solucionImplementada.trim())
                    || (equipo?.problema && equipo.problema.trim())
                    || '';
                  
                  // Guardar precio_extra y descripcion_extra si cambió antes de generar la nota
                  const extraActual = parseFloat(precioExtra) || 0;
                  const descExtraActual = descripcionExtra?.trim() || null;
                  if (extraActual !== (parseFloat(equipo?.precio_extra) || 0) || 
                      descExtraActual !== (equipo?.descripcion_extra || null)) {
                    await guardarPrecioExtra(precioExtra, descripcionExtra);
                  }
                  
                  const eqParaNota = {
                    ...equipo,
                    procesos: procesosEquipo.length > 0 ? procesosEquipo : (procesoInfo ? [procesoInfo] : []),
                    pedidos_ligados: pedidosLigados,
                    pedidos_total: pedidosTotal,
                    precio_extra: extraActual,
                    descripcion_extra: descExtraActual,
                    precio_total_confirmado: total,
                    solucion_implementada: solucionTexto
                  };
                  setShowConfirmarTotalModal(false);
                  abrirNotaPDF(eqParaNota, 'entrega');
                }}
              >
                <Icon name="check" />
                Confirmar y generar nota
              </button>
            </div>
          </div>
        </div>
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
                    setDescripcionAdelanto('');
                  }
                }}
              >
                <Icon name="times" />
              </button>
            </div>
            <div className="comentario-modal-body">
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--gray-50)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '0.25rem' }}>Adelanto acumulado actual</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary-blue)' }}>
                  ${parseFloat(equipo?.adelanto || 0).toFixed(2)}
                </div>
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Monto del adelanto *
                </label>
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
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Descripción (opcional)
                </label>
                <textarea
                  className="typeform-large-textarea"
                  placeholder="Ej: Pago parcial por servicios, Pago inicial, etc."
                  value={descripcionAdelanto}
                  onChange={(e) => setDescripcionAdelanto(e.target.value)}
                  rows="3"
                  style={{ resize: 'vertical' }}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
                  Esta descripción ayuda a identificar el motivo del adelanto
                </div>
              </div>
            </div>
            <div className="comentario-modal-footer">
              <button
                className="btn-cancel"
                onClick={() => {
                  if (!actualizandoAdelanto) {
                    setShowPagoModal(false);
                    setNuevoAdelanto('');
                    setDescripcionAdelanto('');
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

      {/* Modal de Cobro Extra */}
      {showExtraModal && (
        <div className="comentario-modal-overlay" onClick={() => {
          if (!guardandoExtra) {
            setShowExtraModal(false);
          }
        }}>
          <div className="comentario-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comentario-modal-header">
              <h3>Agregar cobro extra</h3>
              <button
                className="comentario-modal-close"
                onClick={() => {
                  if (!guardandoExtra) {
                    setShowExtraModal(false);
                  }
                }}
              >
                <Icon name="times" />
              </button>
            </div>
            <div className="comentario-modal-body comentario-modal-body-compact">
              <div className="extra-modal-current">
                <div className="extra-modal-current-label">Cobro extra actual</div>
                <div className="extra-modal-current-amount">
                  ${parseFloat(precioExtra || 0).toFixed(2)}
                </div>
                {descripcionExtra && (
                  <div className="extra-modal-current-desc">
                    "{descripcionExtra}"
                  </div>
                )}
              </div>
              
              <div className="extra-modal-field">
                <label className="extra-modal-label">
                  Monto del cobro extra *
                </label>
                <input
                  type="number"
                  className="extra-modal-input"
                  placeholder="Ej: 250.00"
                  value={precioExtra}
                  onChange={(e) => setPrecioExtra(e.target.value)}
                  min="0"
                  step="0.01"
                  disabled={guardandoExtra}
                />
                <div className="extra-modal-help">
                  Monto adicional al precio de servicios y refacciones
                </div>
              </div>
              
              <div className="extra-modal-field">
                <label className="extra-modal-label">
                  Descripción del cobro extra *
                </label>
                <textarea
                  className="extra-modal-textarea"
                  placeholder="Ej: Ajuste de precio por urgencia, Servicio adicional..."
                  value={descripcionExtra}
                  onChange={(e) => setDescripcionExtra(e.target.value)}
                  rows={3}
                  disabled={guardandoExtra}
                />
                <div className="extra-modal-help">
                  Describe claramente el motivo del cobro extra
                </div>
              </div>
            </div>
            <div className="comentario-modal-footer extra-modal-footer">
              {(parseFloat(precioExtra || 0) > 0) && (
                <button
                  className="extra-modal-btn-delete"
                  onClick={async () => {
                    if (confirm('¿Eliminar el cobro extra?')) {
                      await guardarPrecioExtra('0', '');
                      setShowExtraModal(false);
                    }
                  }}
                  disabled={guardandoExtra}
                >
                  <Icon name="trash" />
                  Eliminar
                </button>
              )}
              <button
                className="extra-modal-btn-cancel"
                onClick={() => {
                  if (!guardandoExtra) {
                    setShowExtraModal(false);
                  }
                }}
                disabled={guardandoExtra}
              >
                Cancelar
              </button>
              <button
                className="extra-modal-btn-save"
                onClick={async () => {
                  const monto = parseFloat(precioExtra) || 0;
                  if (monto < 0) {
                    alert('El monto no puede ser negativo.');
                    return;
                  }
                  if (monto > 0 && !descripcionExtra.trim()) {
                    alert('Por favor ingresa una descripción del cobro extra.');
                    return;
                  }
                  await guardarPrecioExtra(precioExtra, descripcionExtra);
                  setShowExtraModal(false);
                }}
                disabled={guardandoExtra || !precioExtra.trim() || (parseFloat(precioExtra) > 0 && !descripcionExtra.trim())}
              >
                {guardandoExtra ? (
                  <>
                    <Icon name="sync" className="spinning" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Icon name="check" />
                    Guardar
                  </>
                )}
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
            <div className="photo-modal-actions">
              <button
                type="button"
                className="btn-save-comentario"
                onClick={() => {
                  setSelectedPhoto(null);
                  handlePhotoPlaceholderClick();
                }}
              >
                <Icon name="camera" /> Cambiar foto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Acciones del Equipo */}
      {showOpcionesEspeciales && (
        <div className="comentario-modal-overlay" onClick={() => setShowOpcionesEspeciales(false)}>
          <div className="comentario-modal acciones-equipo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comentario-modal-header">
              <h3>Acciones del Equipo</h3>
              <button 
                className="comentario-modal-close"
                onClick={() => {
                  setShowOpcionesEspeciales(false);
                  setProcesoSeleccionado(null);
                  setJustificacionFinalizado('');
                  setJustificacionReabrir('');
                }}
              >
                <Icon name="times" />
              </button>
            </div>
            <div className="comentario-modal-body">
              {/* SECCIÓN PRINCIPAL: ESTADO DEL EQUIPO */}
              <div className="acciones-seccion">
                <h4 className="acciones-seccion-title">Estado del equipo</h4>
                <div className="estado-segmented-control">
                  <button
                    className={`estado-segmented-btn ${(estadoEquipo?.estado === 'en_proceso' || !estadoEquipo?.estado || estadoEquipo?.estado === 'pendiente') ? 'active' : ''}`}
                    onClick={() => cambiarEstadoEquipo('en_proceso')}
                  >
                    <Icon name="clock" />
                    En proceso
                  </button>
                  <button
                    className={`estado-segmented-btn ${(estadoEquipo?.estado === 'ready_for_pickup' || estadoEquipo?.estado === 'listo') ? 'active' : ''}`}
                    onClick={() => cambiarEstadoEquipo('ready_for_pickup')}
                  >
                    <Icon name="check-circle" />
                    Listo para recoger
                  </button>
                  <button
                    className={`estado-segmented-btn ${(estadoEquipo?.estado === 'delivered' || estadoEquipo?.estado === 'finalizado') ? 'active' : ''}`}
                    onClick={() => cambiarEstadoEquipo('delivered')}
                  >
                    <Icon name="box" />
                    Entregado
                  </button>
                </div>
              </div>

              {/* SECCIÓN: NOTAS */}
              <div className="acciones-seccion">
                <h4 className="acciones-seccion-title">Notas</h4>
                <div className="acciones-buttons-grid">
                  <button
                    className="accion-btn accion-btn-secondary"
                    onClick={generarNotaRecepcion}
                  >
                    <Icon name="file-alt" />
                    <span>Reimprimir nota de recepción</span>
                  </button>
                  {(estadoEquipo?.estado === 'ready_for_pickup' || estadoEquipo?.estado === 'delivered' || estadoEquipo?.estado === 'listo' || estadoEquipo?.estado === 'finalizado') && (
                    <button
                      className="accion-btn accion-btn-secondary"
                      onClick={generarNotaEntrega}
                    >
                      <Icon name="file-alt" />
                      <span>Generar / Reimprimir nota de entrega</span>
                    </button>
                  )}
                  {(estadoEquipo?.estado === 'ready_for_pickup' || estadoEquipo?.estado === 'delivered' || estadoEquipo?.estado === 'listo' || estadoEquipo?.estado === 'finalizado') && (
                    <button
                      className="accion-btn accion-btn-warning"
                      onClick={reabrirEquipo}
                      disabled={!justificacionReabrir.trim() || reabriendoEquipo}
                    >
                      {reabriendoEquipo ? (
                        <>
                          <Icon name="sync" className="spinning" />
                          <span>Reabriendo...</span>
                        </>
                      ) : (
                        <>
                          <Icon name="undo" />
                          <span>Reabrir nota</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                {(estadoEquipo?.estado === 'ready_for_pickup' || estadoEquipo?.estado === 'delivered' || estadoEquipo?.estado === 'listo' || estadoEquipo?.estado === 'finalizado') && (
                  <div className="accion-justificacion-wrapper">
                    <textarea
                      className="accion-justificacion-textarea"
                      placeholder="Justificación para reabrir (ej: cliente trajo el equipo de vuelta, se entregó por error, etc.)"
                      value={justificacionReabrir}
                      onChange={(e) => setJustificacionReabrir(e.target.value)}
                      rows={3}
                    />
                  </div>
                )}
              </div>

              {/* SECCIÓN: AVANZADO */}
              <div className="acciones-seccion acciones-seccion-avanzado">
                <h4 className="acciones-seccion-title">Avanzado</h4>
                
                {/* Cambiar Proceso */}
                <div className="accion-avanzada-item">
                  <div className="accion-avanzada-header">
                    <Icon name="exchange-alt" />
                    <span>Cambiar proceso asignado</span>
                  </div>
                  <select
                    className="accion-avanzada-select"
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
                    className="accion-btn accion-btn-small"
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
                        Cambiar
                      </>
                    )}
                  </button>
                </div>

                {/* Entregar sin completar proceso */}
                <div className="accion-avanzada-item">
                  <div className="accion-avanzada-header">
                    <Icon name="flag-checkered" />
                    <span>Entregar sin completar proceso</span>
                  </div>
                  <textarea
                    className="accion-avanzada-textarea"
                    placeholder="Justificación (ej: cliente canceló, equipo no reparable, etc.)"
                    value={justificacionFinalizado}
                    onChange={(e) => setJustificacionFinalizado(e.target.value)}
                    rows={3}
                  />
                  <button
                    className="accion-btn accion-btn-small accion-btn-danger"
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
                        Entregar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className="comentario-modal-footer">
              <button 
                className="btn-cancel"
                onClick={() => {
                  setShowOpcionesEspeciales(false);
                  setProcesoSeleccionado(null);
                  setJustificacionFinalizado('');
                  setJustificacionReabrir('');
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Cambio de Estado */}
      {showConfirmEstadoModal && confirmEstadoData && (
        <div className="comentario-modal-overlay" onClick={() => setShowConfirmEstadoModal(false)}>
          <div className="comentario-modal confirm-estado-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-estado-header">
              <div className={`confirm-estado-icon confirm-estado-icon-${confirmEstadoData.tipo}`}>
                {confirmEstadoData.tipo === 'warning' && <Icon name="exclamation-triangle" />}
                {confirmEstadoData.tipo === 'ready' && <Icon name="check-circle" />}
                {confirmEstadoData.tipo === 'delivered' && <Icon name="box" />}
                {confirmEstadoData.tipo === 'normal' && <Icon name="question-circle" />}
              </div>
              <h3 className="confirm-estado-title">Confirmar cambio de estado</h3>
            </div>
            <div className="confirm-estado-body">
              <p className="confirm-estado-message">{confirmEstadoData.mensaje}</p>
              <div className="confirm-estado-preview">
                <span className="confirm-estado-preview-label">Nuevo estado:</span>
                <span className={`confirm-estado-preview-badge confirm-estado-preview-${confirmEstadoData.nuevoEstado}`}>
                  {confirmEstadoData.estadoNombre}
                </span>
              </div>
            </div>
            <div className="confirm-estado-footer">
              <button
                className="confirm-estado-btn confirm-estado-btn-cancel"
                onClick={() => {
                  setShowConfirmEstadoModal(false);
                  setConfirmEstadoData(null);
                }}
              >
                Cancelar
              </button>
              <button
                className={`confirm-estado-btn confirm-estado-btn-confirm confirm-estado-btn-${confirmEstadoData.tipo}`}
                onClick={ejecutarCambioEstado}
              >
                <Icon name="check" />
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de pago completo */}
      {showPagoCompletoModal && equipo && (
        <div className="comentario-modal-overlay" onClick={() => setShowPagoCompletoModal(false)}>
          <div className="comentario-modal confirm-estado-modal confirm-pago-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-estado-header">
              <div className="confirm-estado-icon confirm-estado-icon-success">
                <Icon name="check-circle" />
              </div>
              <h3 className="confirm-estado-title">Confirmar Pago Completo</h3>
            </div>
            <div className="confirm-estado-body">
              <p className="confirm-estado-message">
                ¿Confirmas que el cliente ha pagado completamente el servicio?
              </p>
              {(() => {
                const serviciosTot = procesosEquipo.reduce((s, p) => s + (parseFloat(p?.precio) || 0), 0);
                const extra = parseFloat(precioExtra) || 0;
                const totalCalculado = serviciosTot + pedidosTotal + extra;
                const adelanto = parseFloat(equipo.adelanto || 0);
                const adeudo = totalCalculado - adelanto;
                return (
                  <div className="confirm-pago-detalle">
                    <div className="confirm-pago-row">
                      <span className="confirm-pago-label">Total del servicio:</span>
                      <span className="confirm-pago-value">${totalCalculado.toFixed(2)}</span>
                    </div>
                    <div className="confirm-pago-row">
                      <span className="confirm-pago-label">Adelantos recibidos:</span>
                      <span className="confirm-pago-value">${adelanto.toFixed(2)}</span>
                    </div>
                    <div className="confirm-pago-row confirm-pago-row-total">
                      <span className="confirm-pago-label">Adeudo pendiente:</span>
                      <span className={`confirm-pago-value ${adeudo > 0 ? 'confirm-pago-adeudo' : 'confirm-pago-cero'}`}>
                        ${adeudo.toFixed(2)}
                      </span>
                    </div>
                    {adeudo > 0 && (
                      <div className="confirm-pago-warning">
                        <Icon name="exclamation-triangle" />
                        <span>El cliente aún debe ${adeudo.toFixed(2)}. ¿Deseas marcar como pagado de todas formas?</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="confirm-estado-footer">
              <button
                className="confirm-estado-btn confirm-estado-btn-cancel"
                onClick={() => setShowPagoCompletoModal(false)}
                disabled={marcandoComoPagado}
              >
                Cancelar
              </button>
              <button
                className="confirm-estado-btn confirm-estado-btn-confirm confirm-estado-btn-success"
                onClick={marcarComoPagado}
                disabled={marcandoComoPagado}
              >
                {marcandoComoPagado ? (
                  <>
                    <Icon name="sync" className="spinning" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Icon name="check" />
                    Confirmar Pago
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para mostrar problema completo */}
      {showProblemaModal && equipo?.problema && (
        <div className="comentario-modal-overlay" onClick={() => setShowProblemaModal(false)}>
          <div className="comentario-modal problema-modal" onClick={(e) => e.stopPropagation()}>
            <div className="comentario-modal-header">
              <h3>Problema del Equipo</h3>
              <button 
                className="comentario-modal-close"
                onClick={() => setShowProblemaModal(false)}
              >
                <Icon name="times" />
              </button>
            </div>
            <div className="comentario-modal-body">
              <div className="problema-modal-content">
                <p className="problema-modal-text">{equipo.problema}</p>
              </div>
            </div>
            <div className="comentario-modal-footer">
              <button 
                className="btn-cancel"
                onClick={() => setShowProblemaModal(false)}
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
