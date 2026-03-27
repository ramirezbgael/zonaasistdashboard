import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import './MainDashboard.css';

const DEMO_STATS = {
  equiposPendientes: 4,
  equiposListos: 2,
  equiposFinalizados: 18,
  trabajosPendientes: 3,
  entregasPendientes: 2,
  equiposTerminadosHoy: 3,
  equiposTerminadosSemana: 9
};

const DEMO_ALERTAS = [
  {
    tipo: 'warning',
    icono: 'exclamation-triangle',
    titulo: '⚠️ 2 Equipos retrasados',
    mensaje: 'Más de 3 días sin movimiento',
    count: 2
  },
  {
    tipo: 'info',
    icono: 'clock',
    titulo: '⏰ 2 entregas para HOY',
    mensaje: 'Equipos listos para recoger',
    count: 2
  }
];

const DEMO_ACCIONES = [
  {
    tipo: 'equipo_retrasado',
    icono: 'exclamation-circle',
    titulo: 'Revisar Laptop #123',
    descripcion: 'Dell Inspiron 15 - 4 días sin avance',
    prioridad: 'alta'
  },
  {
    tipo: 'entrega',
    icono: 'check-circle',
    titulo: 'Entregar PC Gamer #130',
    descripcion: 'Ryzen 5 · 16GB RAM · SSD 1TB',
    prioridad: 'alta'
  },
  {
    tipo: 'presupuesto',
    icono: 'dollar-sign',
    titulo: 'Autorizar transcripción',
    descripcion: '3 horas de audio pendientes de precio',
    prioridad: 'media'
  }
];

const DEMO_ACTIVIDADES = [
  {
    id: 'demo-a1',
    tipo: 'equipo',
    icono: 'check-circle',
    titulo: 'Equipo #130 entregado al cliente',
    descripcion: 'PC Gamer listo y entregado',
    tiempo: 'Hace 10 min',
    color: '#10b981'
  },
  {
    id: 'demo-a2',
    tipo: 'equipo',
    icono: 'comment',
    titulo: 'Nota agregada a equipo #125',
    descripcion: 'Cliente confirmó respaldo de información',
    tiempo: 'Hace 35 min',
    color: '#3b82f6'
  },
  {
    id: 'demo-a3',
    tipo: 'documento',
    icono: 'file-alt',
    titulo: 'Nuevo documento creado',
    descripcion: 'Transcripción de conferencia 2h',
    tiempo: 'Hace 1 h',
    color: '#8b5cf6'
  }
];

export default function MainDashboard({ demoMode = false, demoData }) {
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

    const hasLoadedOnce = useRef(false);
    const retryCount = useRef(0);
    const retryTimer = useRef(null);

    useEffect(() => {
        if (demoMode) {
            const d = demoData || {};
            setAlertas(d.alertas || DEMO_ALERTAS);
            setStats(d.stats || DEMO_STATS);
            setSiguientesAcciones(d.siguientesAcciones || DEMO_ACCIONES);
            setActividades(d.actividades || DEMO_ACTIVIDADES);
            setLoading(false);
            return;
        }

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
        const handleFocus = () => {
            console.log('🔄 Ventana con foco, actualizando dashboard...');
            fetchDashboardData();
        };
        window.addEventListener('focus', handleFocus);
        
        return () => {
            clearInterval(interval);
            clearTimeout(retryTimer.current);
            window.removeEventListener('equipoUpdated', handleEquipoUpdated);
            window.removeEventListener('focus', handleFocus);
        };
    }, [demoMode]);

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
        return date.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });
    };

    const fetchDashboardData = async () => {
        try {
            // Solo mostrar spinner en la carga inicial
            if (!hasLoadedOnce.current) {
                setLoading(true);
            }

            // Lanzar equipos + estados + queries secundarias en paralelo
            const [equiposResult, estadosResultPlaceholder, docResult, pedidosResult, comentariosResult, historialResult] = await Promise.all([
                supabase
                    .from('equipos')
                    .select('id, nota, marca, modelo, created_at, cliente_id, clientes(id, nombre, telefono)')
                    .order('nota', { ascending: true }),
                // placeholder — se calculará después de tener los IDs
                Promise.resolve(null),
                supabase
                    .from('servicios_documentos')
                    .select('id, tipo_servicio, descripcion, precio, estado, fecha_entrega, created_at, clientes(id, nombre, telefono)')
                    .eq('estado', 'pendiente'),
                supabase
                    .from('pedidos_piezas')
                    .select('id, nombre_pieza, cantidad, estado, fecha_estimada_llegada, created_at')
                    .eq('estado', 'pendiente'),
                supabase
                    .from('comentarios')
                    .select('id, mensaje, modulo, referencia_id, created_at, usuario_id')
                    .order('created_at', { ascending: false })
                    .limit(10),
                supabase
                    .from('historial_procesos')
                    .select('id, equipo_id, notas, completado, created_at, equipos(nota, marca, modelo)')
                    .order('created_at', { ascending: false })
                    .limit(10),
            ]);

            if (equiposResult.error) throw equiposResult.error;

            const equipos = equiposResult.data || [];

            // Query de estados en bulk con los IDs ya conocidos
            const equipoIds = equipos.map(e => e.id);
            let estadosMap = new Map();
            if (equipoIds.length > 0) {
                const { data: todosEstados, error: estadosError } = await supabase
                    .from('estado_equipos')
                    .select('equipo_id, estado, updated_at, created_at')
                    .in('equipo_id', equipoIds)
                    .order('updated_at', { ascending: false });
                if (!estadosError) {
                    (todosEstados || []).forEach(est => {
                        if (!estadosMap.has(est.equipo_id)) estadosMap.set(est.equipo_id, est);
                    });
                }
            }
            const equiposConEstado = equipos.map(equipo => ({
                ...equipo,
                estado_equipos: estadosMap.has(equipo.id) ? [estadosMap.get(equipo.id)] : []
            }));

            // Desempacar resultados de queries secundarias
            const documentos = docResult.data || [];
            const pedidos = pedidosResult.data || [];
            const comentarios = comentariosResult.data || [];
            const historial = historialResult.data || [];

            // Reset retry counter al tener éxito
            retryCount.current = 0;

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
                    
                    // Clasificar equipos por estado
                    if (estado === 'ready_for_pickup' || estado === 'listo') { // 'listo' para compatibilidad temporal
                        equiposListos++;
                        // Entregas para hoy (equipos listos para recoger)
                        entregasParaHoy.push({
                            id: equipo.id,
                            nota: equipo.nota,
                            marca: equipo.marca,
                            modelo: equipo.modelo,
                            cliente: equipo.clientes?.nombre,
                            tipo: 'entrega_hoy'
                        });
                    } else if (estado === 'delivered' || estado === 'finalizado') { // 'finalizado' para compatibilidad temporal
                        equiposFinalizados++;
                        const fechaFinalizacion = new Date(ultimaActualizacion);
                        if (fechaFinalizacion >= hoy) {
                            equiposTerminadosHoy++;
                        }
                        if (fechaFinalizacion >= inicioSemana) {
                            equiposTerminadosSemana++;
                        }
                    } else {
                        // Todos los demás estados (en_proceso, pendiente, sin_estado, cancelled) son pendientes
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

            const trabajosPendientes = documentos?.length || 0;
            
            // Trabajos sin presupuesto aprobado (transcripciones sin precio)
            const trabajosSinPresupuesto = documentos?.filter(doc => 
                doc.tipo_servicio === 'transcripcion' && (!doc.precio || Number(doc.precio) <= 0)
            ) || [];

            // Entregas de documentos para hoy
            const documentosHoy = documentos?.filter(doc => {
                if (!doc.fecha_entrega) return false;
                const fechaEntrega = new Date(doc.fecha_entrega);
                return fechaEntrega.toDateString() === hoy.toDateString();
            }) || [];

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
                        descripcion: `Fecha estimada: ${new Date(pedido.fecha_estimada_llegada).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' })}`,
                        accion: () => navigate(`/logistica?pedido=${pedido.id}`),
                        prioridad: 'alta'
                    });
                });
            }

            // Construir actividad reciente con los datos ya obtenidos en paralelo
            const actividadesRecientes = [];

            if (comentarios) {
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

            if (historial) {
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
            setSiguientesAcciones(acciones.slice(0, 5));
            setActividades(actividadesRecientes.slice(0, 10));
            hasLoadedOnce.current = true;
            setLoading(false);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            // Auto-retry con backoff exponencial en errores de red
            const isNetworkError = !error?.code || error?.code === '' || error?.message?.includes('fetch') || error?.message?.includes('network');
            if (isNetworkError && retryCount.current < 3) {
                retryCount.current += 1;
                const delay = retryCount.current * 3000; // 3s, 6s, 9s
                console.warn(`⚠️ Error de red, reintentando en ${delay / 1000}s... (intento ${retryCount.current}/3)`);
                retryTimer.current = setTimeout(fetchDashboardData, delay);
            } else {
                retryCount.current = 0;
                setLoading(false);
            }
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
                        onClick={() => {
                            navigate(demoMode ? '/demo/equipos/nuevo' : '/equipos/nuevo');
                        }}
                        title="Nuevo Equipo"
                    >
                        <Icon name="plus" className="action-icon" />
                        <span className="action-label">Nuevo Equipo</span>
                    </button>
                    
                    <button 
                        className="quick-action-btn"
                        onClick={() => {
                            navigate(demoMode ? '/demo/documentos/nuevo' : '/documentos/nuevo');
                        }}
                        title="Nuevo Documento"
                    >
                        <Icon name="file-alt" className="action-icon" />
                        <span className="action-label">Nuevo Documento</span>
                    </button>
                    
                    <button 
                        className="quick-action-btn"
                        onClick={() => {
                            navigate(demoMode ? '/demo/logistica/nuevo' : '/logistica/nuevo');
                        }}
                        title="Nuevo Pedido"
                    >
                        <Icon name="shopping-cart" className="action-icon" />
                        <span className="action-label">Nuevo Pedido</span>
                    </button>
                    
                    <button 
                        className="quick-action-btn"
                        onClick={() => {
                            if (demoMode) return;
                            window.dispatchEvent(new CustomEvent('openSearchModal'));
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
                        onClick={() => navigate(demoMode ? '/demo/equipos' : '/equipos?tab=pendientes')}
                    >
                        <div className="card-icon"><Icon name="hourglass-half" /></div>
                        <div className="card-content">
                            <h3>Pendientes</h3>
                            <p className="card-number">{stats.equiposPendientes}</p>
                        </div>
                    </div>
                    
                    <div 
                        className="overview-card equipos-listos"
                        onClick={() => navigate(demoMode ? '/demo/equipos' : '/equipos?tab=listos')}
                    >
                        <div className="card-icon"><Icon name="check-circle" /></div>
                        <div className="card-content">
                            <h3>Listos</h3>
                            <p className="card-number">{stats.equiposListos}</p>
                        </div>
                    </div>
                    
                    <div 
                        className="overview-card equipos-entregados"
                        onClick={() => navigate(demoMode ? '/demo/equipos' : '/equipos?tab=finalizados')}
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