import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase.js';
import { getEquipos as getEquiposDemo } from '../utils/demoStorage.js';
import EquipoCard from './EquipoCard.jsx';
import Icon from './Icon.jsx';
import './Dashboard.css';

/** Función pura para caché: obtiene equipos y devuelve datos (sin setState). */
async function fetchEquiposForCache() {
    const { data: equiposConClientes, error: errorConClientes } = await supabase
        .from('equipos')
        .select(`
            id, marca, modelo, color, nota, problema, created_at, cliente_id,
            clientes ( id, nombre, telefono ),
            estado_equipos ( estado, proceso_actual_id, updated_at, procesos ( id, nombre ) )
        `)
        .order('nota', { ascending: true });

    let equipos = null;
    if (errorConClientes) {
        const { data: equiposSinClientes, error: errorSinClientes } = await supabase
            .from('equipos')
            .select(`
                id, marca, modelo, color, nota, problema, created_at, cliente_id,
                estado_equipos ( estado, proceso_actual_id, updated_at, procesos ( id, nombre ) )
            `)
            .order('nota', { ascending: true });
        if (errorSinClientes) throw errorSinClientes;
        equipos = await Promise.all((equiposSinClientes || []).map(async (equipo) => {
            if (equipo.cliente_id) {
                const { data: clienteData } = await supabase.from('clientes').select('id, nombre, telefono').eq('id', equipo.cliente_id).single();
                return { ...equipo, clientes: clienteData || null };
            }
            return { ...equipo, clientes: null };
        }));
    } else {
        equipos = equiposConClientes;
    }

    const allEquipos = (equipos || []).map((e) => {
        const clientes = Array.isArray(e.clientes) ? (e.clientes[0] || null) : (e.clientes ?? null);
        return { ...e, clientes };
    });
    const equiposOrdenados = [...allEquipos].sort((a, b) => (parseInt(a.nota) || 0) - (parseInt(b.nota) || 0));
    const equipoIds = equiposOrdenados.map(e => e.id);
    if (equipoIds.length === 0) return { data: [], equiposPendientes: [], equiposListos: [], equiposFinalizados: [] };

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

    const ahora = new Date();
    const equiposConSubproceso = equiposOrdenados.map((equipo) => {
        const estadosEquipo = estadosMap.get(equipo.id) || [];
        const estadoMasReciente = estadosEquipo.length > 0 ? estadosEquipo.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0] : null;
        const estadoEmbebido = Array.isArray(equipo.estado_equipos) ? equipo.estado_equipos[0] : equipo.estado_equipos;
        const procesoId = estadoMasReciente?.proceso_actual_id ?? estadoEmbebido?.proceso_actual_id;
        const estadoActual = estadoMasReciente?.estado ?? estadoEmbebido?.estado ?? 'sin_estado';
        const ultimaActualizacion = estadoMasReciente?.updated_at || estadoMasReciente?.created_at || equipo.created_at;
        const diasSinMovimiento = ultimaActualizacion ? Math.floor((ahora - new Date(ultimaActualizacion)) / (1000 * 60 * 60 * 24)) : 0;
        if (!procesoId) return { ...equipo, estadoActual, diasSinMovimiento, siguienteSubproceso: null, totalSubprocesos: 0, tieneProcesoValido: false, procesoNombre: null };
        const procesoData = procesosMap.get(procesoId);
        const subprocesos = subprocesosMap.get(procesoId) || [];
        let siguienteSubproceso = null;
        for (const subproceso of subprocesos) {
            const registros = historialMap.get(`${equipo.id}-${subproceso.id}`) || [];
            const completado = registros.length > 0 && registros[registros.length - 1].completado === true;
            if (!completado) { siguienteSubproceso = subproceso; break; }
        }
        return { 
            ...equipo, 
            estadoActual, 
            diasSinMovimiento,
            siguienteSubproceso, 
            totalSubprocesos: subprocesos.length, 
            tieneProcesoValido: subprocesos.length > 0, 
            procesoNombre: procesoData?.nombre ?? null 
        };
    });

    const pendientes = [];
    const listos = [];
    const finalizados = [];
    equiposConSubproceso.forEach(equipo => {
        let estado = equipo.estadoActual ?? 'sin_estado';
        if (estado === 'finalizado') estado = 'delivered';
        if (estado === 'listo') estado = 'ready_for_pickup';
        if (estado === 'delivered') { finalizados.push(equipo); return; }
        if (estado === 'en_proceso') {
            if (equipo.tieneProcesoValido && equipo.totalSubprocesos > 0 && !equipo.siguienteSubproceso) estado = 'ready_for_pickup';
        } else if (estado === 'sin_estado' && !equipo.siguienteSubproceso && equipo.tieneProcesoValido && equipo.totalSubprocesos > 0) estado = 'ready_for_pickup';
        if (estado === 'ready_for_pickup') listos.push(equipo);
        else pendientes.push(equipo);
    });
    return { data: equiposConSubproceso, equiposPendientes: pendientes, equiposListos: listos, equiposFinalizados: finalizados };
}

export default function Dashboard({ demoMode = false }) {
    const [activeTab, setActiveTab] = useState('pendientes');
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const queryClient = useQueryClient();

    const { data: cacheData, isLoading, refetch } = useQuery({
        queryKey: ['equipos'],
        queryFn: fetchEquiposForCache,
        enabled: !demoMode,
        staleTime: 2 * 60 * 1000,
    });

    const [demoData, setDemoData] = useState(null);
    useEffect(() => {
        if (demoMode) {
            const equipos = getEquiposDemo();
            const pendientes = equipos.filter(e => e.estadoActual === 'pendiente');
            const listos = equipos.filter(e => e.estadoActual === 'listo');
            const finalizados = equipos.filter(e => e.estadoActual === 'finalizado');
            setDemoData({ data: equipos, equiposPendientes: pendientes, equiposListos: listos, equiposFinalizados: finalizados });
        }
    }, [demoMode]);

    const data = demoMode ? (demoData?.data ?? []) : (cacheData?.data ?? []);
    const equiposPendientes = demoMode ? (demoData?.equiposPendientes ?? []) : (cacheData?.equiposPendientes ?? []);
    const equiposListos = demoMode ? (demoData?.equiposListos ?? []) : (cacheData?.equiposListos ?? []);
    const equiposFinalizados = demoMode ? (demoData?.equiposFinalizados ?? []) : (cacheData?.equiposFinalizados ?? []);
    const loading = demoMode ? !demoData : (isLoading && (cacheData?.data?.length ?? 0) === 0);

    useEffect(() => {
        if (demoMode) return;
        const onUpdate = () => queryClient.invalidateQueries({ queryKey: ['equipos'] });
        window.addEventListener('equipoUpdated', onUpdate);
        return () => window.removeEventListener('equipoUpdated', onUpdate);
    }, [demoMode, queryClient]);

    // Sincronizar la pestaña activa con el parámetro ?tab=pendientes|listos|finalizados
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (!tab) return;
        if (tab === 'pendientes' || tab === 'listos' || tab === 'finalizados') {
            setActiveTab(tab);
        }
    }, [searchParams]);

    // Detectar si viene del dashboard principal para crear (antes abría modal)
    useEffect(() => {
        const shouldAdd = searchParams.get('add');
        if (shouldAdd === 'true') {
            navigate('/equipos/nuevo');
            // Limpiar el parámetro de la URL
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams, navigate]);

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

    if (loading) {
        return (
            <div className="dashboard">
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
        <div className="dashboard">
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
                    onClick={() => {
                        setActiveTab('pendientes');
                        const next = new URLSearchParams(searchParams);
                        next.set('tab', 'pendientes');
                        setSearchParams(next, { replace: true });
                    }}
                >
                    <Icon name="hourglass-half" className="tab-icon" />
                    <span className="tab-text">Pendientes</span>
                    <span className="tab-count">{equiposPendientes.length}</span>
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'listos' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('listos');
                        const next = new URLSearchParams(searchParams);
                        next.set('tab', 'listos');
                        setSearchParams(next, { replace: true });
                    }}
                >
                    <Icon name="check-circle" className="tab-icon" />
                    <span className="tab-text">Listos</span>
                    <span className="tab-count">{equiposListos.length}</span>
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'finalizados' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('finalizados');
                        const next = new URLSearchParams(searchParams);
                        next.set('tab', 'finalizados');
                        setSearchParams(next, { replace: true });
                    }}
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
                        getEquiposActivos().map(equipo => {
                            const estado = equipo.estadoActual ?? 'sin_estado';
                            const isRetrasado = (estado !== 'delivered' && estado !== 'finalizado' && estado !== 'ready_for_pickup') &&
                                typeof equipo.diasSinMovimiento === 'number' && equipo.diasSinMovimiento > 3;
                            const highlight =
                                activeTab === 'pendientes' && isRetrasado
                                    ? 'retrasado'
                                    : activeTab === 'listos'
                                        ? 'listo'
                                        : null;
                            return (
                                <EquipoCard
                                    key={equipo.id}
                                    equipo={equipo}
                                    reload={demoMode ? () => {} : refetch}
                                    onClick={() => {
                                        if (demoMode) {
                                            navigate(`/demo/equipos/${equipo.id}`);
                                        } else {
                                            navigate(`/equipos/${equipo.id}`, { state: { equipoFromList: equipo } });
                                        }
                                    }}
                                    activeTab={activeTab}
                                    demoMode={demoMode}
                                    highlight={highlight}
                                />
                            );
                        })
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
                onClick={() => navigate(demoMode ? '/demo/equipos/nuevo' : '/equipos/nuevo')}
                title="Agregar nuevo equipo"
            >
                <Icon name="plus" />
            </button>
        </div>
    );
}
