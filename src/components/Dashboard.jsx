import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase.js';
import EquipoCard from './EquipoCard.jsx';
import Icon from './Icon.jsx';
import './Dashboard.css';
import AddEquipoModalTypeform from './AddEquipoModalTypeform.jsx';
import EquipoModal from './EquipoModal.jsx';


export default function Dashboard() {
    const [equipoSeleccionado, setEquipoSeleccionado] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [activeTab, setActiveTab] = useState('pendientes'); // 'pendientes', 'listos', 'finalizados'

    const [data, setData] = useState([]);
    const [equiposPendientes, setEquiposPendientes] = useState([]);
    const [equiposListos, setEquiposListos] = useState([]);
    const [equiposFinalizados, setEquiposFinalizados] = useState([]);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Detectar si viene del dashboard principal para abrir el modal
    useEffect(() => {
        const shouldAdd = searchParams.get('add');
        if (shouldAdd === 'true') {
            setShowAddModal(true);
            // Limpiar el parámetro de la URL
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    // Detectar si hay un equipo_id en la URL (desde notificación)
    useEffect(() => {
        const equipoId = searchParams.get('equipo');
        if (equipoId && (equiposPendientes.length > 0 || equiposListos.length > 0 || equiposFinalizados.length > 0)) {
            // Buscar el equipo en todos los arrays
            const allEquipos = [...equiposPendientes, ...equiposListos, ...equiposFinalizados];
            const equipo = allEquipos.find(e => e.id === equipoId);
            
            if (equipo) {
                setEquipoSeleccionado(equipo);
                // Cambiar a la pestaña correcta según el estado
                if (equiposPendientes.some(e => e.id === equipoId)) {
                    setActiveTab('pendientes');
                } else if (equiposListos.some(e => e.id === equipoId)) {
                    setActiveTab('listos');
                } else if (equiposFinalizados.some(e => e.id === equipoId)) {
                    setActiveTab('finalizados');
                }
                // Limpiar el parámetro de la URL
                setSearchParams({}, { replace: true });
            }
        }
    }, [searchParams, equiposPendientes, equiposListos, equiposFinalizados, setSearchParams]);

    const getEquiposActivos = () => {
        switch (activeTab) {
            case 'pendientes':
                return equiposPendientes;
            case 'listos':
                return equiposListos;
            case 'finalizados':
                return equiposFinalizados;
            default:
                return equiposPendientes;
        }
    };

    const getTituloTab = () => {
        switch (activeTab) {
            case 'pendientes':
                return 'Equipos Pendientes';
            case 'listos':
                return 'Listos para Recoger';
            case 'finalizados':
                return 'Equipos Finalizados';
            default:
                return 'Equipos Pendientes';
        }
    };

    const fetchData = async () => {
        console.log('🔄 Recargando datos del dashboard...');
        try {
            // Forzar refresh sin cache
            const timestamp = new Date().getTime();
            console.log(`Cache bust timestamp: ${timestamp}`);
            
            // Obtener equipos con su estado más reciente (intentar con clientes primero, si falla sin clientes)
            let equipos = null;
            let error = null;
            
            // Intentar primero con la relación de clientes
            const { data: equiposConClientes, error: errorConClientes } = await supabase
                .from('equipos')
                .select(`
                    id,
                    marca,
                    modelo,
                    color,
                    nota,
                    problema,
                    created_at,
                    cliente_id,
                    clientes (
                        id,
                        nombre,
                        telefono
                    ),
                    estado_equipos (
                        estado,
                        proceso_actual_id,
                        updated_at,
                        procesos (
                            id,
                            nombre
                        )
                    )
                `)
                .order('nota', { ascending: true });

            if (errorConClientes) {
                console.warn('⚠️ Error al cargar con relación clientes, intentando sin ella:', errorConClientes);
                // Si falla, intentar sin la relación de clientes
                const { data: equiposSinClientes, error: errorSinClientes } = await supabase
                    .from('equipos')
                    .select(`
                        id,
                        marca,
                        modelo,
                        color,
                        nota,
                        problema,
                        created_at,
                        cliente_id,
                        estado_equipos (
                            estado,
                            proceso_actual_id,
                            updated_at,
                            procesos (
                                id,
                                nombre
                            )
                        )
                    `)
                    .order('nota', { ascending: true });

                if (errorSinClientes) {
                    console.error('❌ Error fetching equipos:', errorSinClientes);
                    return;
                }

                // Cargar clientes por separado si tienen cliente_id
                equipos = await Promise.all((equiposSinClientes || []).map(async (equipo) => {
                    if (equipo.cliente_id) {
                        try {
                            const { data: clienteData } = await supabase
                                .from('clientes')
                                .select('id, nombre, telefono')
                                .eq('id', equipo.cliente_id)
                                .single();
                            return { ...equipo, clientes: clienteData || null };
                        } catch (err) {
                            console.warn(`⚠️ No se pudo cargar cliente para equipo #${equipo.nota}:`, err);
                            return { ...equipo, clientes: null };
                        }
                    }
                    return { ...equipo, clientes: null };
                }));
            } else {
                equipos = equiposConClientes;
            }

            if (!equipos) {
                console.error('❌ No se pudieron cargar los equipos');
                return;
            }

            const allEquipos = equipos || [];
            
            // Obtener siguiente subproceso para cada equipo
            // Ordenar equipos por nota numérica (PEPS correcto)
            const equiposOrdenados = allEquipos.sort((a, b) => {
                const notaA = parseInt(a.nota) || 0;
                const notaB = parseInt(b.nota) || 0;
                return notaA - notaB;
            });

            const equiposConSubproceso = await Promise.all(
                equiposOrdenados.map(async (equipo) => {
                    // Intentar obtener procesoId de múltiples fuentes
                    let procesoId = equipo.estado_equipos?.[0]?.proceso_actual_id;
                    
                    // Si no está en la relación, consultarlo directamente
                    if (!procesoId) {
                        const { data: estadoDirecto } = await supabase
                            .from('estado_equipos')
                            .select('proceso_actual_id')
                            .eq('equipo_id', equipo.id)
                            .order('updated_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();
                        
                        procesoId = estadoDirecto?.proceso_actual_id;
                    }
                    
                    console.log(`Procesando equipo #${equipo.nota}, procesoId: ${procesoId}, estado_equipos:`, equipo.estado_equipos);
                    
                    if (!procesoId) {
                        console.log(`⚠️ Equipo #${equipo.nota} no tiene proceso asignado en estado_equipos`);
                        // Intentar obtener el primer proceso disponible como fallback
                        const { data: procesosDisponibles } = await supabase
                            .from('procesos')
                            .select('id, nombre')
                            .limit(1)
                            .single();
                        
                        if (procesosDisponibles) {
                            console.log(`📌 Usando proceso por defecto para equipo #${equipo.nota}: ${procesosDisponibles.nombre}`);
                            // No asignamos el proceso automáticamente, solo lo mostramos como información
                            return { 
                                ...equipo, 
                                siguienteSubproceso: null, 
                                totalSubprocesos: 0, 
                                tieneProcesoValido: false, 
                                procesoNombre: `Asignar proceso: ${procesosDisponibles.nombre}` 
                            };
                        }
                        return { ...equipo, siguienteSubproceso: null, totalSubprocesos: 0, tieneProcesoValido: false, procesoNombre: null };
                    }

                    // Obtener información del proceso
                    const { data: procesoData } = await supabase
                        .from('procesos')
                        .select('nombre')
                        .eq('id', procesoId)
                        .single();

                    // Obtener subprocesos del proceso actual
                    const { data: subprocesos } = await supabase
                        .from('subprocesos')
                        .select('*')
                        .eq('proceso_id', procesoId)
                        .order('orden');

                    // Obtener historial para determinar qué subprocesos están completados
                    const { data: historial } = await supabase
                        .from('historial_procesos')
                        .select('subproceso_id, completado')
                        .eq('equipo_id', equipo.id)
                        .eq('proceso_id', procesoId);

                    // Encontrar el siguiente subproceso pendiente
                    let siguienteSubproceso = null;
                    if (subprocesos && subprocesos.length > 0) {
                        for (const subproceso of subprocesos) {
                            const registros = historial?.filter(h => h.subproceso_id === subproceso.id) || [];
                            // Si no hay registros, el subproceso está pendiente
                            // Si hay registros, verificar si el último está completado
                            // Un subproceso está completado solo si explícitamente tiene completado = true
                            let completado = false;
                            if (registros.length > 0) {
                                const ultimoRegistro = registros[registros.length - 1];
                                completado = ultimoRegistro.completado === true;
                            }
                            
                            // Si no está completado (false o null o undefined), este es el siguiente pendiente
                            if (!completado) {
                                siguienteSubproceso = subproceso;
                                break;
                            }
                        }
                    } else {
                        // Si no hay subprocesos configurados, el siguiente subproceso sigue siendo null
                        // pero el equipo no debería mostrarse como "completado"
                        console.log(`⚠️ Equipo #${equipo.nota}: El proceso ${procesoId} no tiene subprocesos configurados`);
                    }

                    return { 
                        ...equipo, 
                        siguienteSubproceso, 
                        totalSubprocesos: subprocesos?.length || 0,
                        tieneProcesoValido: !!(procesoId && subprocesos && subprocesos.length > 0),
                        procesoNombre: procesoData?.nombre || null
                    };
                })
            );

            setData(equiposConSubproceso);

            // Separar equipos por estado
            const pendientes = [];
            const listos = [];
            const finalizados = [];

            // Obtener estados actualizados por separado y recalcular siguienteSubproceso si es necesario
            const equiposConEstadoActualizado = await Promise.all(
                equiposConSubproceso.map(async (equipo) => {
                    const { data: estadoActual } = await supabase
                        .from('estado_equipos')
                        .select('estado, proceso_actual_id, updated_at')
                        .eq('equipo_id', equipo.id)
                        .order('updated_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    
                    // Si el equipo no tenía proceso pero ahora sí lo tiene, obtenerlo
                    let equipoActualizado = { ...equipo, estadoActualizado: estadoActual };
                    
                    if (estadoActual?.proceso_actual_id && !equipo.siguienteSubproceso && !equipo.procesoNombre) {
                        // Obtener información del proceso
                        const { data: procesoData } = await supabase
                            .from('procesos')
                            .select('nombre')
                            .eq('id', estadoActual.proceso_actual_id)
                            .single();

                        // Obtener subprocesos del proceso actual
                        const { data: subprocesos } = await supabase
                            .from('subprocesos')
                            .select('*')
                            .eq('proceso_id', estadoActual.proceso_actual_id)
                            .order('orden');

                        // Obtener historial para determinar qué subprocesos están completados
                        const { data: historial } = await supabase
                            .from('historial_procesos')
                            .select('subproceso_id, completado')
                            .eq('equipo_id', equipo.id)
                            .eq('proceso_id', estadoActual.proceso_actual_id);

                        // Encontrar el siguiente subproceso pendiente
                        let siguienteSubproceso = null;
                        if (subprocesos && subprocesos.length > 0) {
                            for (const subproceso of subprocesos) {
                                const registros = historial?.filter(h => h.subproceso_id === subproceso.id) || [];
                                let completado = false;
                                if (registros.length > 0) {
                                    const ultimoRegistro = registros[registros.length - 1];
                                    completado = ultimoRegistro.completado === true;
                                }
                                
                                if (!completado) {
                                    siguienteSubproceso = subproceso;
                                    break;
                                }
                            }
                        }

                        equipoActualizado = {
                            ...equipoActualizado,
                            siguienteSubproceso,
                            totalSubprocesos: subprocesos?.length || 0,
                            tieneProcesoValido: !!(estadoActual.proceso_actual_id && subprocesos && subprocesos.length > 0),
                            procesoNombre: procesoData?.nombre || null
                        };
                    }
                    
                    return equipoActualizado;
                })
            );

            equiposConEstadoActualizado.forEach(equipo => {
                // Usar el estado actualizado en lugar del de la relación
                let estado = 'sin_estado';
                if (equipo.estadoActualizado) {
                    estado = equipo.estadoActualizado.estado;
                    console.log(`🔍 EQUIPO #${equipo.nota} - Estado DB Actualizado: "${estado}", Updated: ${equipo.estadoActualizado.updated_at}`);
                } else {
                    console.log(`⚠️ EQUIPO #${equipo.nota} - Sin registros de estado`);
                }
                const estadoOriginal = estado;
                
                // IMPORTANTE: No modificar automáticamente el estado si ya está finalizado
                if (estado === 'finalizado') {
                    // Equipos finalizados se mantienen como están
                } else if (estado === 'en_proceso') {
                    // Si está en_proceso, mantenerlo así a menos que realmente haya completado todos los subprocesos
                    // Solo mover a listo si tiene proceso válido, tiene subprocesos, y completó todos
                    if (equipo.tieneProcesoValido && equipo.totalSubprocesos > 0 && !equipo.siguienteSubproceso) {
                    estado = 'listo';
                    }
                    // Si está en_proceso pero no tiene subprocesos, mantener en_proceso
                } else if (estado === 'sin_estado' && !equipo.siguienteSubproceso && equipo.tieneProcesoValido && equipo.totalSubprocesos > 0) {
                    // Solo mover equipos sin estado a listo si tienen proceso válido con subprocesos y los completaron todos
                    estado = 'listo';
                }
                
                // Debug simplificado
                console.log(`#${equipo.nota}: ${estadoOriginal} -> ${estado} (${equipo.siguienteSubproceso ? 'pendiente' : 'completado'})`);
                
                switch (estado) {
                    case 'en_proceso':
                        pendientes.push(equipo);
                        break;
                    case 'listo':
                        listos.push(equipo);
                        break;
                    case 'finalizado':
                        finalizados.push(equipo);
                        break;
                    default:
                        // Equipos sin estado van a pendientes
                        pendientes.push(equipo);
                }
            });

            setEquiposPendientes(pendientes);
            setEquiposListos(listos);
            setEquiposFinalizados(finalizados);

            console.log('✅ Equipos cargados:', {
                pendientes: pendientes.length,
                listos: listos.length,
                finalizados: finalizados.length
            });
            
        } catch (error) {
            console.error('❌ Error inesperado en fetchData:', error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className={`dashboard ${equipoSeleccionado || showAddModal ? 'modal-active' : ''}`}>
            {/* Sección de Resumen */}
            <section className="dashboard-summary">
                <div className="summary-cards">
                    <div className="summary-card">
                        <h3 className="summary-card-title">Pendientes</h3>
                        <p className="summary-card-value">{equiposPendientes.length}</p>
                    </div>
                    <div className="summary-card">
                        <h3 className="summary-card-title">Listos</h3>
                        <p className="summary-card-value">{equiposListos.length}</p>
                    </div>
                    <div className="summary-card">
                        <h3 className="summary-card-title">Finalizados</h3>
                        <p className="summary-card-value">{equiposFinalizados.length}</p>
                            </div>
                    <div className="summary-card">
                        <h3 className="summary-card-title">Total</h3>
                        <p className="summary-card-value">{equiposPendientes.length + equiposListos.length + equiposFinalizados.length}</p>
                        </div>
                </div>
            </section>

            {/* Tabs de navegación */}
            <nav className="dashboard-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'pendientes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pendientes')}
                >
                    <Icon name="hourglass-half" className="tab-icon" />
                    <span className="tab-text">Pendientes</span>
                    <span className="tab-count">{equiposPendientes.length}</span>
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'listos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('listos')}
                >
                    <Icon name="check-circle" className="tab-icon" />
                    <span className="tab-text">Listos</span>
                    <span className="tab-count">{equiposListos.length}</span>
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'finalizados' ? 'active' : ''}`}
                    onClick={() => setActiveTab('finalizados')}
                >
                    <Icon name="flag-checkered" className="tab-icon" />
                    <span className="tab-text">Finalizados</span>
                    <span className="tab-count">{equiposFinalizados.length}</span>
                </button>
            </nav>

            <main className="dashboard-content">
                <h2 className="dashboard-section-title">{getTituloTab()}</h2>
                <div className="equipos-grid">
                    {getEquiposActivos().length > 0 ? (
                        getEquiposActivos().map(equipo => (
                            <EquipoCard
                                key={equipo.id}
                                equipo={equipo}
                                reload={fetchData}
                                onClick={() => setEquipoSeleccionado(equipo)}
                                activeTab={activeTab}
                            />
                        ))
                    ) : (
                        <div className="empty-state">
                            <div className="empty-icon">
                                {activeTab === 'pendientes' && <Icon name="hourglass-half" />}
                                {activeTab === 'listos' && <Icon name="check-circle" />}
                                {activeTab === 'finalizados' && <Icon name="flag-checkered" />}
                            </div>
                            <h3>No hay equipos {activeTab}</h3>
                            <p>
                                {activeTab === 'pendientes' && 'Agrega un nuevo equipo para comenzar'}
                                {activeTab === 'listos' && 'Los equipos terminados aparecerán aquí'}
                                {activeTab === 'finalizados' && 'Los equipos entregados aparecerán aquí'}
                            </p>
                        </div>
                    )}
                </div>
            </main>

            <button 
                className="add-equipo-fab" 
                onClick={() => setShowAddModal(true)}
                title="Agregar nuevo equipo"
            >
                <Icon name="plus" />
            </button>
            
            {equipoSeleccionado && (
                <EquipoModal
                    equipo={equipoSeleccionado}
                    onClose={() => setEquipoSeleccionado(null)}
                    onEquipoUpdated={fetchData}
                />
            )}
            
            {showAddModal && (
                <AddEquipoModalTypeform
                    onClose={() => setShowAddModal(false)}
                    onEquipoAdded={fetchData}
                />
            )}
        </div>
    );
}
