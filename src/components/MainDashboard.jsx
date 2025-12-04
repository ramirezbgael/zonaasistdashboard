import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import './MainDashboard.css';

export default function MainDashboard() {
    const [stats, setStats] = useState({
        equiposPendientes: 0,
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
            // Obtener estadísticas de equipos
            const { data: equipos } = await supabase
                .from('equipos')
                .select(`
                    id,
                    estado_equipos (estado)
                `);

            // Procesar estadísticas de equipos pendientes
            let equiposPendientes = 0;
            equipos?.forEach(equipo => {
                const estado = equipo.estado_equipos?.[0]?.estado || 'pendiente';
                if (estado === 'en_proceso' || estado === 'sin_estado') {
                    equiposPendientes++;
                }
            });

            // TODO: Obtener trabajos pendientes (documentos) cuando esté implementado
            const trabajosPendientes = 0;
            
            // TODO: Obtener entregas pendientes (logística) cuando esté implementado
            const entregasPendientes = 0;
            
            // Calcular total de pendientes
            const totalPendientes = equiposPendientes + trabajosPendientes + entregasPendientes;
            
            // Obtener actividades recientes (simulado por ahora)
            const actividadesRecientes = [
                {
                    id: 1,
                    tipo: 'equipo',
                    icono: '🔧',
                    titulo: 'Equipo #12345 completado',
                    descripcion: 'Laptop HP lista para recoger',
                    tiempo: '5 min ago',
                    color: '#007bff'
                },
                {
                    id: 2,
                    tipo: 'documento',
                    icono: '📄',
                    titulo: 'Transcripción finalizada',
                    descripcion: 'Documento para cliente María González',
                    tiempo: '15 min ago',
                    color: '#28a745'
                },
                {
                    id: 3,
                    tipo: 'logistica',
                    icono: '📦',
                    titulo: 'Pieza recibida',
                    descripcion: 'Disco SSD 500GB llegó al almacén',
                    tiempo: '1 hour ago',
                    color: '#ffc107'
                }
            ];

            setStats({
                equiposPendientes,
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
            icon: '🔧',
            color: '#007bff',
            route: '/equipos',
            stats: { pendientes: stats.equiposPendientes, listos: 0, finalizados: 0 },
            description: 'Reparaciones y mantenimiento'
        },
        {
            id: 'documentos',
            title: 'Documentos y Facturación',
            icon: '📄',
            color: '#28a745',
            route: '/documentos',
            stats: stats.documentos,
            description: 'Transcripciones y facturación'
        },
        {
            id: 'logistica',
            title: 'Logística y Pedidos',
            icon: '📦',
            color: '#ffc107',
            route: '/logistica',
            stats: stats.logistica,
            description: 'Gestión de inventario'
        },
        {
            id: 'clientes',
            title: 'Clientes y Proveedores',
            icon: '👥',
            color: '#6f42c1',
            route: '/clientes',
            stats: stats.clientes,
            description: 'Base de datos de contactos'
        },
        {
            id: 'reportes',
            title: 'Reportes y Analytics',
            icon: '📈',
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
                    >
                        <span className="action-icon">➕</span>
                        <span className="action-label">Nuevo Equipo</span>
                    </button>
                    
                    <button 
                        className="quick-action-btn"
                        onClick={() => navigate('/documentos')}
                        disabled
                    >
                        <span className="action-icon">📝</span>
                        <span className="action-label">Nueva Transcripción</span>
                    </button>
                    
                    <button 
                        className="quick-action-btn"
                        onClick={() => navigate('/logistica')}
                        disabled
                    >
                        <span className="action-icon">🛒</span>
                        <span className="action-label">Nuevo Pedido</span>
                    </button>
                    
                    <button 
                        className="quick-action-btn"
                        onClick={() => navigate('/clientes')}
                        disabled
                    >
                        <span className="action-icon">👤</span>
                        <span className="action-label">Nuevo Cliente</span>
                    </button>
                </div>
            </section>

            {/* Resumen General */}
            <section className="dashboard-overview">
                <div className="overview-cards">
                    <div className="overview-card equipos-pendientes">
                        <div className="card-icon">🔧</div>
                        <div className="card-content">
                            <h3>Equipos Pendientes</h3>
                            <p className="card-number">{stats.equiposPendientes}</p>
                        </div>
                    </div>
                    
                    <div className="overview-card trabajos-pendientes">
                        <div className="card-icon">📄</div>
                        <div className="card-content">
                            <h3>Trabajos Pendientes</h3>
                            <p className="card-number">{stats.trabajosPendientes}</p>
                        </div>
                    </div>
                    
                    <div className="overview-card entregas-pendientes">
                        <div className="card-icon">📦</div>
                        <div className="card-content">
                            <h3>Entregas Pendientes</h3>
                            <p className="card-number">{stats.entregasPendientes}</p>
                        </div>
                    </div>
                    
                    <div className="overview-card total-pendientes">
                        <div className="card-icon">⚡</div>
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
                                <div className="module-icon">{module.icon}</div>
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
                                        <span>🚧 Próximamente</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="module-arrow">→</div>
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
                                {actividad.icono}
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
