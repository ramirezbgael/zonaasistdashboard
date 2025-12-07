import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import './MainDashboard.css';

export default function MainDashboard() {
    const [stats, setStats] = useState({
        equiposPendientes: 0,
        equiposListos: 0,
        equiposFinalizados: 0,
        trabajosPendientes: 0,
        entregasPendientes: 0,
        totalPendientes: 0
    });
    
    const [actividades, setActividades] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            // Obtener todos los equipos
            const { data: equipos, error: equiposError } = await supabase
                .from('equipos')
                .select('id');

            if (equiposError) {
                console.error('❌ Error fetching equipos:', equiposError);
            }

            // Procesar estadísticas de equipos
            let equiposPendientes = 0;
            let equiposListos = 0;
            let equiposFinalizados = 0;
            
            if (equipos && equipos.length > 0) {
                console.log(`📊 Total equipos encontrados: ${equipos.length}`);
                
                // Obtener el estado más reciente de cada equipo
                const estadosPromesas = equipos.map(async (equipo) => {
                    const { data: estadoActual, error: estadoError } = await supabase
                        .from('estado_equipos')
                        .select('estado')
                        .eq('equipo_id', equipo.id)
                        .order('updated_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    
                    if (estadoError && estadoError.code !== 'PGRST116') {
                        console.warn(`⚠️ Error al obtener estado para equipo ${equipo.id}:`, estadoError);
                    }
                    
                    const estado = estadoActual?.estado || 'sin_estado';
                    return { equipoId: equipo.id, estado };
                });

                const estados = await Promise.all(estadosPromesas);
                
                estados.forEach(({ equipoId, estado }) => {
                    if (estado === 'en_proceso' || estado === 'sin_estado') {
                        equiposPendientes++;
                        console.log(`✅ Equipo ${equipoId} contado como pendiente (estado: ${estado})`);
                    } else if (estado === 'listo') {
                        equiposListos++;
                        console.log(`✅ Equipo ${equipoId} contado como listo`);
                    } else if (estado === 'finalizado') {
                        equiposFinalizados++;
                        console.log(`✅ Equipo ${equipoId} contado como finalizado`);
                    } else {
                        console.log(`⏭️ Equipo ${equipoId} estado desconocido: ${estado}`);
                    }
                });
                
                console.log(`📊 Equipos - Pendientes: ${equiposPendientes}, Listos: ${equiposListos}, Finalizados: ${equiposFinalizados}`);
            } else {
                console.log('⚠️ No se encontraron equipos en la base de datos');
            }

            // Obtener trabajos pendientes (documentos)
            const { data: documentos, error: documentosError } = await supabase
                .from('servicios_documentos')
                .select('id, estado')
                .eq('estado', 'pendiente');

            const trabajosPendientes = documentos?.length || 0;

            // Obtener entregas pendientes (logística)
            const { data: pedidos, error: pedidosError } = await supabase
                .from('pedidos_piezas')
                .select('id, estado')
                .eq('estado', 'pendiente');

            const entregasPendientes = pedidos?.length || 0;
            
            // Calcular total de pendientes
            const totalPendientes = equiposPendientes + trabajosPendientes + entregasPendientes;
            
            // Obtener actividades recientes (simulado por ahora)
            const actividadesRecientes = [
                {
                    id: 1,
                    tipo: 'equipo',
                    icono: 'wrench',
                    titulo: 'Equipo #12345 completado',
                    descripcion: 'Laptop HP lista para recoger',
                    tiempo: '5 min ago',
                    color: '#10b981'
                },
                {
                    id: 2,
                    tipo: 'documento',
                    icono: 'file-alt',
                    titulo: 'Transcripción finalizada',
                    descripcion: 'Documento para cliente María González',
                    tiempo: '15 min ago',
                    color: '#28a745'
                },
                {
                    id: 3,
                    tipo: 'logistica',
                    icono: 'box',
                    titulo: 'Pieza recibida',
                    descripcion: 'Disco SSD 500GB llegó al almacén',
                    tiempo: '1 hour ago',
                    color: '#ffc107'
                }
            ];

            setStats({
                equiposPendientes,
                equiposListos,
                equiposFinalizados,
                trabajosPendientes,
                entregasPendientes,
                totalPendientes
            });
            
            setActividades(actividadesRecientes);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            setLoading(false);
        }
    };

    const modules = [
        {
            id: 'equipos',
            title: 'Gestión de Equipos',
            icon: 'wrench',
            color: '#10b981',
            route: '/equipos',
            stats: { pendientes: stats.equiposPendientes, listos: stats.equiposListos, finalizados: stats.equiposFinalizados },
            description: 'Reparaciones y mantenimiento'
        },
        {
            id: 'documentos',
            title: 'Documentos y Facturación',
            icon: 'file-alt',
            color: '#28a745',
            route: '/documentos',
            stats: stats.documentos,
            description: 'Transcripciones y facturación'
        },
        {
            id: 'logistica',
            title: 'Logística y Pedidos',
            icon: 'box',
            color: '#ffc107',
            route: '/logistica',
            stats: stats.logistica,
            description: 'Gestión de inventario'
        },
        {
            id: 'clientes',
            title: 'Clientes y Proveedores',
            icon: 'users',
            color: '#6f42c1',
            route: '/clientes',
            stats: stats.clientes,
            description: 'Base de datos de contactos'
        },
        {
            id: 'reportes',
            title: 'Reportes y Analytics',
            icon: 'chart-bar',
            color: '#dc3545',
            route: '/reportes',
            stats: { total: 12, nuevos: 3 },
            description: 'Métricas y análisis'
        }
    ];

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="loading-spinner"></div>
                <p>Cargando dashboard...</p>
            </div>
        );
    }

    return (
        <div className="main-dashboard">
            {/* Accesos Rápidos */}
            <section className="quick-actions">
                <h2 className="section-title quick-actions-title">Accesos Rápidos</h2>
                <div className="quick-actions-grid">
                    <button 
                        className="quick-action-btn"
                        onClick={() => navigate('/equipos?add=true')}
                        title="Nuevo Equipo"
                        aria-label="Nuevo Equipo"
                    >
                        <Icon name="plus" className="action-icon" />
                        <span className="action-label">Nuevo Equipo</span>
                    </button>
                    
                    <button 
                        className="quick-action-btn"
                        onClick={() => navigate('/documentos?add=true')}
                        title="Nuevo Documento"
                        aria-label="Nuevo Documento"
                    >
                        <Icon name="file-alt" className="action-icon" />
                        <span className="action-label">Nuevo Documento</span>
                    </button>
                    
                    <button 
                        className="quick-action-btn"
                        onClick={() => navigate('/logistica?add=true')}
                        title="Nuevo Pedido"
                        aria-label="Nuevo Pedido"
                    >
                        <Icon name="shopping-cart" className="action-icon" />
                        <span className="action-label">Nuevo Pedido</span>
                    </button>
                    
                    <button 
                        className="quick-action-btn"
                        onClick={() => navigate('/clientes?add=true')}
                        title="Nuevo Cliente"
                        aria-label="Nuevo Cliente"
                    >
                        <Icon name="user-plus" className="action-icon" />
                        <span className="action-label">Nuevo Cliente</span>
                    </button>
                </div>
            </section>

            {/* Resumen General */}
            <section className="dashboard-overview">
                <div className="overview-cards">
                    <div 
                        className="overview-card equipos-pendientes"
                        onClick={() => navigate('/equipos?tab=pendientes')}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                navigate('/equipos?tab=pendientes');
                            }
                        }}
                    >
                        <div className="card-icon"><Icon name="wrench" /></div>
                        <div className="card-content">
                            <h3>Equipos Pendientes</h3>
                            <p className="card-number">{stats.equiposPendientes}</p>
                        </div>
                    </div>
                    
                    <div 
                        className="overview-card trabajos-pendientes"
                        onClick={() => navigate('/documentos?tab=pendientes')}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                navigate('/documentos?tab=pendientes');
                            }
                        }}
                    >
                        <div className="card-icon"><Icon name="file-alt" /></div>
                        <div className="card-content">
                            <h3>Trabajos Pendientes</h3>
                            <p className="card-number">{stats.trabajosPendientes}</p>
                        </div>
                    </div>
                    
                    <div 
                        className="overview-card entregas-pendientes"
                        onClick={() => navigate('/logistica?tab=pendientes')}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                navigate('/logistica?tab=pendientes');
                            }
                        }}
                    >
                        <div className="card-icon"><Icon name="box" /></div>
                        <div className="card-content">
                            <h3>Entregas Pendientes</h3>
                            <p className="card-number">{stats.entregasPendientes}</p>
                        </div>
                    </div>
                    
                    <div className="overview-card total-pendientes">
                        <div className="card-icon"><Icon name="bolt" /></div>
                        <div className="card-content">
                            <h3>Total Pendientes</h3>
                            <p className="card-number">{stats.totalPendientes}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Módulos Principales */}
            <section className="modules-section">
                <h2 className="section-title">Módulos del Sistema</h2>
                <div className="modules-grid">
                    {modules.map(module => (
                        <div 
                            key={module.id} 
                            className="module-card"
                            onClick={() => navigate(module.route)}
                            style={{ '--module-color': module.color }}
                        >
                            <div className="module-header">
                                <div className="module-icon"><Icon name={module.icon} /></div>
                                <h3 className="module-title">{module.title}</h3>
                            </div>
                            
                            <p className="module-description">{module.description}</p>
                            
                            <div className="module-stats">
                                {module.id === 'equipos' && (
                                    <>
                                        <div className="stat-item">
                                            <span className="stat-label">Pendientes</span>
                                            <span className="stat-value">{module.stats.pendientes}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Listos</span>
                                            <span className="stat-value">{module.stats.listos}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Finalizados</span>
                                            <span className="stat-value">{module.stats.finalizados}</span>
                                        </div>
                                    </>
                                )}
                                
                                {module.id !== 'equipos' && (
                                    <div className="coming-soon">
                                        <Icon name="hourglass-half" /> <span>Próximamente</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="module-arrow"><Icon name="arrow-right" /></div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Actividades Recientes */}
            <section className="activities-section">
                <h2 className="section-title">Actividad Reciente</h2>
                <div className="activities-feed">
                    {actividades.map(actividad => (
                        <div key={actividad.id} className="activity-item">
                            <div 
                                className="activity-icon"
                                style={{ backgroundColor: actividad.color }}
                            >
                                <Icon name={actividad.icono} />
                            </div>
                            <div className="activity-content">
                                <h4 className="activity-title">{actividad.titulo}</h4>
                                <p className="activity-description">{actividad.descripcion}</p>
                                <span className="activity-time">{actividad.tiempo}</span>
                            </div>
                        </div>
                    ))}
                    
                    <div className="view-all-activities">
                        <button className="btn-view-all">Ver todas las actividades</button>
                    </div>
                </div>
            </section>
        </div>
    );
}
