import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase.js';
import EquipoCard from './EquipoCard.jsx';
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
            
            // Obtener equipos con su estado más reciente
            const { data: equipos, error } = await supabase
                .from('equipos')
                .select(`
                    id,
                    marca,
                    modelo,
                    color,
                    nota,
                    problema,
                    created_at,
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
                .order('nota', { ascending: true }); // Ordenar por número de nota (PEPS)

            if (error) {
                console.error('Error fetching data:', error);
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
                    const procesoId = equipo.estado_equipos?.[0]?.proceso_actual_id;
                    console.log(`Procesando equipo #${equipo.nota}, procesoId: ${procesoId}`);
                    
                    if (!procesoId) {
                        console.log(`Equipo #${equipo.nota} no tiene proceso asignado`);
                        return { ...equipo, siguienteSubproceso: null, totalSubprocesos: 0, tieneProcesoValido: false };
                    }

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
                            const completado = registros.length > 0 && registros[registros.length - 1].completado;
                            
                            if (!completado) {
                                siguienteSubproceso = subproceso;
                                break;
                            }
                        }
                    }

                    return { 
                        ...equipo, 
                        siguienteSubproceso, 
                        totalSubprocesos: subprocesos?.length || 0,
                        tieneProcesoValido: !!(procesoId && subprocesos && subprocesos.length > 0)
                    };
                })
            );

            setData(equiposConSubproceso);

            // Separar equipos por estado
            const pendientes = [];
            const listos = [];
            const finalizados = [];

            // Obtener estados actualizados por separado para evitar problemas de cache
            const equiposConEstadoActualizado = await Promise.all(
                equiposConSubproceso.map(async (equipo) => {
                    const { data: estadoActual } = await supabase
                        .from('estado_equipos')
                        .select('estado, proceso_actual_id, updated_at')
                        .eq('equipo_id', equipo.id)
                        .order('updated_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    
                    return {
                        ...equipo,
                        estadoActualizado: estadoActual
                    };
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
                } else if (estado === 'en_proceso' && !equipo.siguienteSubproceso && equipo.tieneProcesoValido) {
                    // Solo mover a listo si tiene proceso válido y completó todos los subprocesos
                    estado = 'listo';
                } else if (estado === 'sin_estado' && !equipo.siguienteSubproceso && equipo.tieneProcesoValido) {
                    // Solo mover equipos sin estado a listo si tienen proceso válido y lo completaron
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
            {/* Tabs de navegación */}
            <nav className="dashboard-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'pendientes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pendientes')}
                >
                    <span className="tab-icon">⏳</span>
                    <span className="tab-text">Pendientes</span>
                    <span className="tab-count">{equiposPendientes.length}</span>
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'listos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('listos')}
                >
                    <span className="tab-icon">✅</span>
                    <span className="tab-text">Listos</span>
                    <span className="tab-count">{equiposListos.length}</span>
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'finalizados' ? 'active' : ''}`}
                    onClick={() => setActiveTab('finalizados')}
                >
                    <span className="tab-icon">🏁</span>
                    <span className="tab-text">Finalizados</span>
                    <span className="tab-count">{equiposFinalizados.length}</span>
                </button>
            </nav>

            <main className="dashboard-content">
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
                                {activeTab === 'pendientes' && '⏳'}
                                {activeTab === 'listos' && '✅'}
                                {activeTab === 'finalizados' && '🏁'}
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
                +
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
