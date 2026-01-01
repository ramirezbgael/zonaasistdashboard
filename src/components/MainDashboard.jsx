import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import './MainDashboard.css';

export default function MainDashboard() {
    const [alertas, setAlertas] = useState([]);
    const [stats, setStats] = useState({
        equiposPendientes: 0,
        equiposListos: 0,
        equiposFinalizados: 0,
        trabajosPendientes: 0,
        entregasPendientes: 0,
        equiposTerminadosHoy: 0,
        equiposTerminadosSemana: 0
    });
    
    const [siguientesAcciones, setSiguientesAcciones] = useState([]);
    const [actividades, setActividades] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchDashboardData();
        // Refrescar cada 5 minutos
        const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
        
        // Escuchar eventos de actualización de equipos
        const handleEquipoUpdated = () => {
            console.log('🔄 Evento equipoUpdated recibido, actualizando dashboard...');
            fetchDashboardData();
        };
        
        window.addEventListener('equipoUpdated', handleEquipoUpdated);
        // Actualizar cuando la ventana vuelve a tener foco
        window.addEventListener('focus', () => {
            console.log('🔄 Ventana con foco, actualizando dashboard...');
            fetchDashboardData();
        });
        
        return () => {
            clearInterval(interval);
            window.removeEventListener('equipoUpdated', handleEquipoUpdated);
            window.removeEventListener('focus', fetchDashboardData);
        };
    }, []);

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
        return date.toLocaleDateString('es-MX');
    };

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            console.log('🔄 Iniciando fetchDashboardData...');
            
            // Obtener todos los equipos
            const { data: equipos, error: equiposError } = await supabase
                .from('equipos')
                .select(`
                    id,
                    nota,
                    marca,
                    modelo,
                    created_at,
                    cliente_id,
                    clientes (
                        id,
                        nombre,
                        telefono
                    )
                `)
                .order('nota', { ascending: true });

            if (equiposError) {
                console.error('❌ Error fetching equipos:', equiposError);
                setLoading(false);
                return;
            }

            console.log(`📦 Equipos obtenidos: ${equipos?.length || 0}`);

            // Obtener estados de todos los equipos por separado
            const equiposConEstado = await Promise.all((equipos || []).map(async (equipo) => {
                // Obtener el estado más reciente de este equipo
                const { data: estadoData, error: estadoError } = await supabase
                    .from('estado_equipos')
                    .select('estado, updated_at, created_at')
                    .eq('equipo_id', equipo.id)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (estadoError && estadoError.code !== 'PGRST116') {
                    console.warn(`⚠️ Error obteniendo estado para equipo ${equipo.id}:`, estadoError);
                }

                return {
                    ...equipo,
                    estado_equipos: estadoData ? [estadoData] : []
                };
            }));

            console.log(`✅ Equipos con estado procesados: ${equiposConEstado.length}`);
            
            // Debug: Verificar algunos equipos
            if (equiposConEstado.length > 0) {
                console.log('🔍 Primeros 3 equipos:', equiposConEstado.slice(0, 3).map(e => ({
                    nota: e.nota,
                    tieneEstado: !!e.estado_equipos?.[0],
                    estado: e.estado_equipos?.[0]?.estado || 'sin_estado'
                })));
            }

            // Procesar equipos y estados
            const ahora = new Date();
            const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
            const inicioSemana = new Date(hoy);
            inicioSemana.setDate(hoy.getDate() - hoy.getDay()); // Domingo de esta semana
            
            let equiposPendientes = 0;
            let equiposListos = 0;
            let equiposFinalizados = 0;
            let equiposTerminadosHoy = 0;
            let equiposTerminadosSemana = 0;
            const equiposRetrasados = [];
            const entregasParaHoy = [];
            
            if (equiposConEstado && equiposConEstado.length > 0) {
                for (const equipo of equiposConEstado) {
                    // Obtener el estado más reciente del equipo
                    const estadoActual = equipo.estado_equipos?.[0];
                    const estado = estadoActual?.estado || 'sin_estado';
                    const ultimaActualizacion = estadoActual?.updated_at || estadoActual?.created_at || equipo.created_at;
                    const diasSinMovimiento = Math.floor((ahora - new Date(ultimaActualizacion)) / (1000 * 60 * 60 * 24));
                    
                    // Debug: Log del estado de cada equipo
                    console.log(`Equipo #${equipo.nota}: estado="${estado}", tieneEstadoActual=${!!estadoActual}, updated_at="${estadoActual?.updated_at || 'N/A'}"`);
                    
                    // Clasificar equipos por estado
                    if (estado === 'listo') {
                        equiposListos++;
                        // Entregas para hoy (equipos listos)
                        entregasParaHoy.push({
                            id: equipo.id,
                            nota: equipo.nota,
                            marca: equipo.marca,
                            modelo: equipo.modelo,
                            cliente: equipo.clientes?.nombre,
                            tipo: 'entrega_hoy'
                        });
                    } else if (estado === 'finalizado') {
                        equiposFinalizados++;
                        const fechaFinalizacion = new Date(ultimaActualizacion);
                        if (fechaFinalizacion >= hoy) {
                            equiposTerminadosHoy++;
                        }
                        if (fechaFinalizacion >= inicioSemana) {
                            equiposTerminadosSemana++;
                        }
                    } else {
                        // Todos los demás estados (en_proceso, pendiente, sin_estado) son pendientes
                        equiposPendientes++;
                        // Equipos retrasados (más de 3 días sin movimiento)
                        if (diasSinMovimiento > 3) {
                            equiposRetrasados.push({
                                id: equipo.id,
                                nota: equipo.nota,
                                marca: equipo.marca,
                                modelo: equipo.modelo,
                                dias: diasSinMovimiento,
                                tipo: 'equipo_retrasado'
                            });
                        }
                    }
                }
            }
            
            console.log('📊 Stats calculados:', {
                equiposPendientes,
                equiposListos,
                equiposFinalizados,
                totalEquipos: equipos?.length || 0
            });

            // Obtener documentos pendientes
            const { data: documentos, error: documentosError } = await supabase
                .from('servicios_documentos')
                .select(`
                    id,
                    tipo_servicio,
                    descripcion,
                    precio,
                    precio_total,
                    estado,
                    fecha_entrega,
                    created_at,
                    clientes (
                        id,
                        nombre,
                        telefono
                    )
                `)
                .eq('estado', 'pendiente');

            const trabajosPendientes = documentos?.length || 0;
            
            // Trabajos sin presupuesto aprobado (transcripciones sin precio)
            const trabajosSinPresupuesto = documentos?.filter(doc => 
                doc.tipo_servicio === 'transcripcion' && !doc.precio_total && !doc.precio
            ) || [];

            // Entregas de documentos para hoy
            const documentosHoy = documentos?.filter(doc => {
                if (!doc.fecha_entrega) return false;
                const fechaEntrega = new Date(doc.fecha_entrega);
                return fechaEntrega.toDateString() === hoy.toDateString();
            }) || [];

            // Obtener pedidos pendientes
            const { data: pedidos, error: pedidosError } = await supabase
                .from('pedidos_piezas')
                .select(`
                    id,
                    nombre_pieza,
                    cantidad,
                    estado,
                    fecha_estimada_llegada,
                    created_at
                `)
                .eq('estado', 'pendiente');

            const entregasPendientes = pedidos?.length || 0;
            
            // Pedidos sin surtir (pendientes)
            const pedidosSinSurtir = pedidos || [];


            // Construir alertas
            const nuevasAlertas = [];
            
            if (equiposRetrasados.length > 0) {
                nuevasAlertas.push({
                    tipo: 'warning',
                    icono: 'exclamation-triangle',
                    titulo: `⚠️ ${equiposRetrasados.length} Equipo${equiposRetrasados.length > 1 ? 's' : ''} Retrasado${equiposRetrasados.length > 1 ? 's' : ''}`,
                    mensaje: `Más de 3 días sin movimiento`,
                    count: equiposRetrasados.length,
                    datos: equiposRetrasados,
                    accion: () => navigate('/equipos?tab=pendientes')
                });
            }

            if (entregasParaHoy.length > 0) {
                nuevasAlertas.push({
                    tipo: 'info',
                    icono: 'clock',
                    titulo: `⏰ ${entregasParaHoy.length} Entrega${entregasParaHoy.length > 1 ? 's' : ''} para HOY`,
                    mensaje: `Equipos listos para recoger`,
                    count: entregasParaHoy.length,
                    datos: entregasParaHoy,
                    accion: () => navigate('/equipos?tab=listos')
                });
            }

            if (documentosHoy.length > 0) {
                nuevasAlertas.push({
                    tipo: 'info',
                    icono: 'calendar-check',
                    titulo: `📅 ${documentosHoy.length} Documento${documentosHoy.length > 1 ? 's' : ''} para entregar hoy`,
                    mensaje: `Fecha de entrega programada`,
                    count: documentosHoy.length,
                    datos: documentosHoy,
                    accion: () => navigate('/documentos?tab=pendientes')
                });
            }

            if (trabajosSinPresupuesto.length > 0) {
                nuevasAlertas.push({
                    tipo: 'danger',
                    icono: 'dollar-sign',
                    titulo: `🧾 ${trabajosSinPresupuesto.length} Trabajo${trabajosSinPresupuesto.length > 1 ? 's' : ''} sin presupuesto`,
                    mensaje: `Transcripciones pendientes de precio`,
                    count: trabajosSinPresupuesto.length,
                    datos: trabajosSinPresupuesto,
                    accion: () => navigate('/documentos?tab=pendientes')
                });
            }

            if (pedidosSinSurtir.length > 0) {
                nuevasAlertas.push({
                    tipo: 'warning',
                    icono: 'box',
                    titulo: `🖨️ ${pedidosSinSurtir.length} Pedido${pedidosSinSurtir.length > 1 ? 's' : ''} sin surtir`,
                    mensaje: `Esperando piezas/componentes`,
                    count: pedidosSinSurtir.length,
                    datos: pedidosSinSurtir,
                    accion: () => navigate('/logistica?tab=pendientes')
                });
            }

            // Construir siguientes acciones recomendadas
            const acciones = [];
            
            // Equipos retrasados
            if (equiposRetrasados.length > 0) {
                equiposRetrasados.slice(0, 3).forEach(eq => {
                    acciones.push({
                        tipo: 'equipo_retrasado',
                        icono: 'exclamation-circle',
                        titulo: `Revisar Equipo #${eq.nota}`,
                        descripcion: `${eq.marca} ${eq.modelo} - ${eq.dias} días sin avance`,
                        accion: () => navigate(`/equipos?equipo=${eq.id}`),
                        prioridad: 'alta'
                    });
                });
            }

            // Equipos listos para entregar
            if (entregasParaHoy.length > 0) {
                entregasParaHoy.slice(0, 2).forEach(eq => {
                    acciones.push({
                        tipo: 'entrega',
                        icono: 'check-circle',
                        titulo: `Entregar Equipo #${eq.nota}`,
                        descripcion: `${eq.marca} ${eq.modelo} - Cliente: ${eq.cliente || 'N/A'}`,
                        accion: () => navigate(`/equipos?equipo=${eq.id}`),
                        prioridad: 'alta'
                    });
                });
            }

            // Trabajos sin presupuesto
            if (trabajosSinPresupuesto.length > 0) {
                trabajosSinPresupuesto.slice(0, 2).forEach(doc => {
                    acciones.push({
                        tipo: 'presupuesto',
                        icono: 'dollar-sign',
                        titulo: `Autorizar presupuesto - ${doc.tipo_servicio}`,
                        descripcion: doc.descripcion || 'Sin descripción',
                        accion: () => navigate(`/documentos?documento=${doc.id}`),
                        prioridad: 'media'
                    });
                });
            }

            // Pedidos críticos
            const pedidosCriticos = pedidos?.filter(p => {
                if (!p.fecha_estimada_llegada) return false;
                const fecha = new Date(p.fecha_estimada_llegada);
                return fecha <= hoy;
            }) || [];
            
            if (pedidosCriticos.length > 0) {
                pedidosCriticos.slice(0, 1).forEach(pedido => {
                    acciones.push({
                        tipo: 'pedido',
                        icono: 'box',
                        titulo: `Verificar pedido de ${pedido.nombre_pieza}`,
                        descripcion: `Fecha estimada: ${new Date(pedido.fecha_estimada_llegada).toLocaleDateString('es-MX')}`,
                        accion: () => navigate(`/logistica?pedido=${pedido.id}`),
                        prioridad: 'alta'
                    });
                });
            }

            // Obtener actividad reciente (comentarios, cambios de estado)
            const actividadesRecientes = [];

            // Comentarios recientes
            const { data: comentarios, error: comentariosError } = await supabase
                .from('comentarios')
                .select(`
                    id,
                    mensaje,
                    modulo,
                    referencia_id,
                    created_at,
                    usuario_id
                `)
                .order('created_at', { ascending: false })
                .limit(10);

            if (!comentariosError && comentarios) {
                comentarios.forEach(comentario => {
                    actividadesRecientes.push({
                        id: `comentario-${comentario.id}`,
                        tipo: comentario.modulo,
                        icono: 'comment',
                        titulo: `Comentario en ${comentario.modulo}`,
                        descripcion: comentario.mensaje,
                        tiempo: formatRelativeTime(comentario.created_at),
                        color: '#10b981',
                        created_at: comentario.created_at
                    });
                });
            }

            // Cambios de estado en equipos (desde historial_procesos)
            const { data: historial, error: historialError } = await supabase
                .from('historial_procesos')
                .select(`
                    id,
                    equipo_id,
                    notas,
                    completado,
                    created_at,
                    equipos (
                        nota,
                        marca,
                        modelo
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(10);

            if (!historialError && historial) {
                historial.forEach(item => {
                    if (item.completado) {
                        actividadesRecientes.push({
                            id: `historial-${item.id}`,
                            tipo: 'equipo',
                            icono: 'check-circle',
                            titulo: `Equipo #${item.equipos?.nota} actualizado`,
                            descripcion: item.notas || `${item.equipos?.marca} ${item.equipos?.modelo}`,
                            tiempo: formatRelativeTime(item.created_at),
                            color: '#10b981',
                            created_at: item.created_at
                        });
                    }
                });
            }

            // Ordenar actividades por fecha
            actividadesRecientes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            setAlertas(nuevasAlertas);
            setStats({
                equiposPendientes,
                equiposListos,
                equiposFinalizados,
                trabajosPendientes,
                entregasPendientes,
                equiposTerminadosHoy,
                equiposTerminadosSemana
            });
            setSiguientesAcciones(acciones.slice(0, 5)); // Máximo 5 acciones
            setActividades(actividadesRecientes.slice(0, 10)); // Últimas 10 actividades
            setLoading(false);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            setLoading(false);
        }
    };

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
            {/* 🔥 ALERTAS INTELIGENTES - Lo más importante arriba */}
            {alertas.length > 0 && (
                <section className="alerts-section">
                    <div className="alerts-container">
                        {alertas.map((alerta, index) => (
                            <div
                                key={index}
                                className={`alert-pill alert-${alerta.tipo}`}
                                onClick={alerta.accion}
                            >
                                <Icon name={alerta.icono} className="alert-icon" />
                                <div className="alert-content">
                                    <div className="alert-title">{alerta.titulo}</div>
                                    <div className="alert-message">{alerta.mensaje}</div>
                                </div>
                                {alerta.count > 0 && (
                                    <span className="alert-badge">{alerta.count}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Accesos Rápidos Mejorados */}
            <section className="quick-actions">
                <h2 className="section-title quick-actions-title">Accesos Rápidos</h2>
                <div className="quick-actions-grid">
                    <button 
                        className="quick-action-btn"
                        onClick={() => navigate('/equipos?add=true')}
                        title="Nuevo Equipo"
                    >
                        <Icon name="plus" className="action-icon" />
                        <span className="action-label">Nuevo Equipo</span>
                    </button>
                    
                    <button 
                        className="quick-action-btn"
                        onClick={() => navigate('/documentos?add=true')}
                        title="Nuevo Documento"
                    >
                        <Icon name="file-alt" className="action-icon" />
                        <span className="action-label">Nuevo Documento</span>
                    </button>
                    
                    <button 
                        className="quick-action-btn"
                        onClick={() => navigate('/logistica?add=true')}
                        title="Nuevo Pedido"
                    >
                        <Icon name="shopping-cart" className="action-icon" />
                        <span className="action-label">Nuevo Pedido</span>
                    </button>
                    
                    <button 
                        className="quick-action-btn"
                        onClick={() => {
                            const nota = prompt('Ingresa el número de nota a buscar:');
                            if (nota) {
                                navigate(`/equipos?search=${nota}`);
                            }
                        }}
                        title="Buscar por Nota"
                    >
                        <Icon name="search" className="action-icon" />
                        <span className="action-label">Buscar Nota</span>
                    </button>
                </div>
            </section>

            {/* 📊 STATS RELEVANTES */}
            <section className="stats-section">
                <h2 className="section-title">Métricas Operativas</h2>
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-header">
                            <Icon name="wrench" className="stat-icon" />
                            <span className="stat-label">Equipos Terminados Hoy</span>
                        </div>
                        <div className="stat-value-large">{stats.equiposTerminadosHoy}</div>
                    </div>
                    
                    <div className="stat-card">
                        <div className="stat-header">
                            <Icon name="chart-line" className="stat-icon" />
                            <span className="stat-label">Esta Semana</span>
                        </div>
                        <div className="stat-value-large">{stats.equiposTerminadosSemana}</div>
                    </div>
                </div>
            </section>

            {/* 🧠 SIGUIENTES ACCIONES RECOMENDADAS */}
            {siguientesAcciones.length > 0 && (
                <section className="actions-section">
                    <h2 className="section-title">Siguientes Acciones Recomendadas</h2>
                    <div className="actions-list">
                        {siguientesAcciones.map((accion, index) => (
                            <div
                                key={index}
                                className={`action-item action-priority-${accion.prioridad}`}
                                onClick={accion.accion}
                            >
                                <div className="action-icon-wrapper">
                                    <Icon name={accion.icono} />
                                </div>
                                <div className="action-content">
                                    <div className="action-title">{accion.titulo}</div>
                                    <div className="action-description">{accion.descripcion}</div>
                                </div>
                                <Icon name="chevron-right" className="action-arrow" />
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Resumen General */}
            <section className="dashboard-overview">
                <h2 className="section-title">Resumen de Equipos</h2>
                <div className="overview-cards">
                    <div 
                        className="overview-card equipos-pendientes"
                        onClick={() => navigate('/equipos?tab=pendientes')}
                    >
                        <div className="card-icon"><Icon name="hourglass-half" /></div>
                        <div className="card-content">
                            <h3>Pendientes</h3>
                            <p className="card-number">{stats.equiposPendientes}</p>
                        </div>
                    </div>
                    
                    <div 
                        className="overview-card equipos-listos"
                        onClick={() => navigate('/equipos?tab=listos')}
                    >
                        <div className="card-icon"><Icon name="check-circle" /></div>
                        <div className="card-content">
                            <h3>Listos</h3>
                            <p className="card-number">{stats.equiposListos}</p>
                        </div>
                    </div>
                    
                    <div 
                        className="overview-card equipos-entregados"
                        onClick={() => navigate('/equipos?tab=finalizados')}
                    >
                        <div className="card-icon"><Icon name="check-circle" /></div>
                        <div className="card-content">
                            <h3>Entregados</h3>
                            <p className="card-number">{stats.equiposFinalizados}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 🧾 ACTIVIDAD RECIENTE REAL */}
            {actividades.length > 0 && (
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
                    </div>
                </section>
            )}
        </div>
    );
}