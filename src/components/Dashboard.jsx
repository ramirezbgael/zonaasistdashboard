import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase.js';
import EquipoCard from './EquipoCard.jsx';
import Icon from './Icon.jsx';
import './Dashboard.css';
import AddEquipoModalTypeform from './AddEquipoModalTypeform.jsx';


export default function Dashboard() {
    const [showAddModal, setShowAddModal] = useState(false);
    const [activeTab, setActiveTab] = useState('pendientes'); // 'pendientes', 'listos', 'finalizados'

    const [data, setData] = useState([]);
    const [equiposPendientes, setEquiposPendientes] = useState([]);
    const [equiposListos, setEquiposListos] = useState([]);
    const [equiposFinalizados, setEquiposFinalizados] = useState([]);
    const [loading, setLoading] = useState(true);
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
            // Navegar directamente a la página de detalle
            navigate(`/equipos/${equipoId}`);
            // Limpiar el parámetro de la URL
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, equiposPendientes, equiposListos, equiposFinalizados, setSearchParams, navigate]);

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
        try {
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
            
            // Ordenar equipos por nota numérica (PEPS correcto)
            const equiposOrdenados = allEquipos.sort((a, b) => {
                const notaA = parseInt(a.nota) || 0;
                const notaB = parseInt(b.nota) || 0;
                return notaA - notaB;
            });

            const equipoIds = equiposOrdenados.map(e => e.id);
            if (equipoIds.length === 0) {
                setData([]);
                setEquiposPendientes([]);
                setEquiposListos([]);
                setEquiposFinalizados([]);
                return;
            }

            // 4 queries en paralelo (evita N+1)
            const [resEstados, resProcesos, resSubprocesos, resHistorial] = await Promise.all([
                supabase.from('estado_equipos').select('equipo_id, estado, proceso_actual_id, updated_at').in('equipo_id', equipoIds),
                supabase.from('procesos').select('id, nombre'),
                supabase.from('subprocesos').select('*').order('orden'),
                supabase.from('historial_procesos').select('equipo_id, proceso_id, subproceso_id, completado, created_at').in('equipo_id', equipoIds).order('created_at', { ascending: true })
            ]);
            const todosEstados = resEstados.data || [];
            const todosProcesos = resProcesos.data || [];
            const todosSubprocesos = resSubprocesos.data || [];
            const todoHistorial = resHistorial.data || [];

            const procesosMap = new Map(todosProcesos.map(p => [p.id, p]));
            const subprocesosMap = new Map();
            todosSubprocesos.forEach(sp => {
                if (!subprocesosMap.has(sp.proceso_id)) subprocesosMap.set(sp.proceso_id, []);
                subprocesosMap.get(sp.proceso_id).push(sp);
            });
            const estadosMap = new Map();
            todosEstados.forEach(est => {
                if (!estadosMap.has(est.equipo_id)) estadosMap.set(est.equipo_id, []);
                estadosMap.get(est.equipo_id).push(est);
            });
            const historialMap = new Map();
            todoHistorial.forEach(h => {
                const key = `${h.equipo_id}-${h.subproceso_id}`;
                if (!historialMap.has(key)) historialMap.set(key, []);
                historialMap.get(key).push(h);
            });

            // Procesar equipos en memoria (sin queries adicionales)
            const equiposConSubproceso = equiposOrdenados.map((equipo) => {
                // Obtener procesoId del estado
                const estadosEquipo = estadosMap.get(equipo.id) || [];
                const estadoMasReciente = estadosEquipo.sort((a, b) => 
                    new Date(b.updated_at) - new Date(a.updated_at)
                )[0];
                const procesoId = estadoMasReciente?.proceso_actual_id ?? equipo.estado_equipos?.[0]?.proceso_actual_id;
                const estadoActual = estadoMasReciente?.estado ?? 'sin_estado';

                if (!procesoId) {
                    return { 
                        ...equipo, 
                        estadoActual,
                        siguienteSubproceso: null, 
                        totalSubprocesos: 0, 
                        tieneProcesoValido: false, 
                        procesoNombre: null 
                    };
                }

                const procesoData = procesosMap.get(procesoId);
                const subprocesos = subprocesosMap.get(procesoId) || [];
                let siguienteSubproceso = null;
                for (const subproceso of subprocesos) {
                    const registros = historialMap.get(`${equipo.id}-${subproceso.id}`) || [];
                    const completado = registros.length > 0 && registros[registros.length - 1].completado === true;
                    if (!completado) {
                        siguienteSubproceso = subproceso;
                        break;
                    }
                }

                return { 
                    ...equipo, 
                    estadoActual,
                    siguienteSubproceso, 
                    totalSubprocesos: subprocesos.length,
                    tieneProcesoValido: subprocesos.length > 0,
                    procesoNombre: procesoData?.nombre ?? null
                };
            });

            setData(equiposConSubproceso);

            const pendientes = [];
            const listos = [];
            const finalizados = [];

            equiposConSubproceso.forEach(equipo => {
                let estado = equipo.estadoActual ?? 'sin_estado';
                if (estado === 'finalizado') {
                    finalizados.push(equipo);
                    return;
                }
                if (estado === 'en_proceso') {
                    if (equipo.tieneProcesoValido && equipo.totalSubprocesos > 0 && !equipo.siguienteSubproceso)
                        estado = 'listo';
                } else if (estado === 'sin_estado' && !equipo.siguienteSubproceso && equipo.tieneProcesoValido && equipo.totalSubprocesos > 0) {
                    estado = 'listo';
                }
                if (estado === 'listo') {
                    listos.push(equipo);
                } else {
                    pendientes.push(equipo);
                }
            });

            setEquiposPendientes(pendientes);
            setEquiposListos(listos);
            setEquiposFinalizados(finalizados);
        } catch (error) {
            console.error('Error en fetchData:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className={`dashboard ${showAddModal ? 'modal-active' : ''}`}>
                <section className="dashboard-summary">
                    <div className="summary-cards">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="summary-card">
                                <div className="skeleton skeleton-title"></div>
                                <div className="skeleton skeleton-value"></div>
                            </div>
                        ))}
                    </div>
                </section>
                <nav className="dashboard-tabs">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="tab-btn skeleton-tab">
                            <div className="skeleton skeleton-icon"></div>
                            <div className="skeleton skeleton-text"></div>
                            <div className="skeleton skeleton-count"></div>
                        </div>
                    ))}
                </nav>
                <main className="dashboard-content">
                    <div className="skeleton skeleton-section-title"></div>
                    <div className="equipos-grid">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="skeleton-card">
                                <div className="skeleton skeleton-card-header"></div>
                                <div className="skeleton skeleton-card-body"></div>
                            </div>
                        ))}
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className={`dashboard ${showAddModal ? 'modal-active' : ''}`}>
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
                                onClick={() => navigate(`/equipos/${equipo.id}`)}
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
            
            {showAddModal && (
                <AddEquipoModalTypeform
                    onClose={() => setShowAddModal(false)}
                    onEquipoAdded={fetchData}
                />
            )}
        </div>
    );
}
