import { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import {
    BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import './ReportesPage.css';
import './ClientesPage.css';

// Datos de ejemplo para modo demo (sin Supabase)
const DEMO_RESUMEN = {
    equipos: {
        distribucion: {
            pendiente: 4,
            en_proceso: 6,
            listo: 3,
            finalizado: 12
        },
        total: 25
    },
    documentos: {
        total: 8,
        porTipo: {
            transcripcion: 5,
            factura: 2,
            cotizacion: 1
        },
        detalles: []
    },
    pedidos: {
        total: 5,
        porEstado: {
            pendiente: 3,
            recibido: 2
        },
        detalles: []
    }
};

export default function ReportesPage({ demoMode = false }) {
    // Calcular fechas del último mes (mes anterior)
    const calcularUltimoMes = () => {
        const ahora = new Date();
        const primerDiaUltimoMes = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
        const ultimoDiaUltimoMes = new Date(ahora.getFullYear(), ahora.getMonth(), 0);
        
        return {
            inicio: primerDiaUltimoMes.toISOString().split('T')[0],
            fin: ultimoDiaUltimoMes.toISOString().split('T')[0]
        };
    };

    const fechasUltimoMes = calcularUltimoMes();
    
    const [loading, setLoading] = useState(false);
    const [reporteSeleccionado, setReporteSeleccionado] = useState(null);
    const [fechaInicio, setFechaInicio] = useState(fechasUltimoMes.inicio);
    const [fechaFin, setFechaFin] = useState(fechasUltimoMes.fin);
    const [datosReporte, setDatosReporte] = useState(null);
    const [datosResumen, setDatosResumen] = useState(null);
    const [loadingResumen, setLoadingResumen] = useState(true);

    const tiposReportes = [
        {
            id: 'equipos_procesados',
            nombre: 'Equipos Procesados',
            icono: 'tools',
            descripcion: 'Equipos completados en un período',
            color: '#10b981'
        },
        {
            id: 'equipos_por_estado',
            nombre: 'Equipos por Estado',
            icono: 'chart-line',
            descripcion: 'Distribución de equipos por estado actual',
            color: '#3b82f6'
        },
        {
            id: 'equipos_por_proceso',
            nombre: 'Equipos por Proceso',
            icono: 'layer-group',
            descripcion: 'Cantidad de equipos por tipo de proceso',
            color: '#8b5cf6'
        },
        {
            id: 'tiempo_promedio',
            nombre: 'Tiempo Promedio de Reparación',
            icono: 'clock',
            descripcion: 'Tiempo promedio desde recepción hasta entrega',
            color: '#f59e0b'
        },
        {
            id: 'documentos_procesados',
            nombre: 'Documentos Procesados',
            icono: 'file-alt',
            descripcion: 'Documentos completados en un período',
            color: '#ec4899'
        },
        {
            id: 'pedidos_estado',
            nombre: 'Estado de Pedidos',
            icono: 'shipping-fast',
            descripcion: 'Distribución de pedidos por estado',
            color: '#06b6d4'
        },
        {
            id: 'inventario_valor',
            nombre: 'Valor del Inventario',
            icono: 'dollar-sign',
            descripcion: 'Valor total y distribución por tipo',
            color: '#10b981'
        },
        {
            id: 'productividad_tecnicos',
            nombre: 'Productividad por Técnico',
            icono: 'user',
            descripcion: 'Equipos procesados por técnico',
            color: '#6366f1'
        }
    ];

    const generarReporte = async (tipoReporte) => {
        setLoading(true);
        setReporteSeleccionado(tipoReporte);
        
        try {
            let datos = null;

            switch (tipoReporte.id) {
                case 'equipos_procesados':
                    datos = await generarEquiposProcesados();
                    break;
                case 'equipos_por_estado':
                    datos = await generarEquiposPorEstado();
                    break;
                case 'equipos_por_proceso':
                    datos = await generarEquiposPorProceso();
                    break;
                case 'tiempo_promedio':
                    datos = await generarTiempoPromedio();
                    break;
                case 'documentos_procesados':
                    datos = await generarDocumentosProcesados();
                    break;
                case 'pedidos_estado':
                    datos = await generarPedidosEstado();
                    break;
                case 'inventario_valor':
                    datos = await generarInventarioValor();
                    break;
                case 'productividad_tecnicos':
                    datos = await generarProductividadTecnicos();
                    break;
                default:
                    datos = null;
            }

            setDatosReporte(datos);
        } catch (error) {
            console.error('Error generando reporte:', error);
            alert('Error al generar el reporte: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const generarEquiposProcesados = async () => {
        const { data: equipos, error } = await supabase
            .from('equipos')
            .select('id, nota, marca, modelo, created_at, estado_equipos(estado)')
            .gte('created_at', fechaInicio)
            .lte('created_at', fechaFin + 'T23:59:59')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const completados = equipos?.filter(e => e.estado_equipos?.estado === 'finalizado') || [];
        const enProceso = equipos?.filter(e => e.estado_equipos?.estado === 'en_proceso') || [];
        const pendientes = equipos?.filter(e => !e.estado_equipos || e.estado_equipos?.estado === 'pendiente') || [];

        return {
            total: equipos?.length || 0,
            completados: completados.length,
            enProceso: enProceso.length,
            pendientes: pendientes.length,
            detalles: equipos || []
        };
    };

    const generarEquiposPorEstado = async () => {
        const { data: estados, error } = await supabase
            .from('estado_equipos')
            .select('estado, equipos(nota, marca, modelo)')
            .order('estado');

        if (error) throw error;

        const agrupados = {};
        estados?.forEach(e => {
            if (!agrupados[e.estado]) {
                agrupados[e.estado] = 0;
            }
            agrupados[e.estado]++;
        });

        return {
            distribucion: agrupados,
            total: estados?.length || 0
        };
    };

    const generarEquiposPorProceso = async () => {
        const { data: estados, error } = await supabase
            .from('estado_equipos')
            .select('proceso_actual_id, procesos(nombre)')
            .not('proceso_actual_id', 'is', null);

        if (error) throw error;

        const agrupados = {};
        estados?.forEach(e => {
            const nombreProceso = e.procesos?.nombre || 'Sin proceso';
            if (!agrupados[nombreProceso]) {
                agrupados[nombreProceso] = 0;
            }
            agrupados[nombreProceso]++;
        });

        return {
            distribucion: agrupados,
            total: estados?.length || 0
        };
    };

    const generarTiempoPromedio = async () => {
        const { data: historial, error } = await supabase
            .from('historial_procesos')
            .select('equipo_id, fecha_inicio, fecha_completado, equipos(nota, marca, modelo)')
            .not('fecha_completado', 'is', null)
            .gte('fecha_inicio', fechaInicio)
            .lte('fecha_inicio', fechaFin + 'T23:59:59');

        if (error) throw error;

        const tiempos = historial?.map(h => {
            const inicio = new Date(h.fecha_inicio);
            const fin = new Date(h.fecha_completado);
            const dias = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24));
            return {
                equipo: h.equipos,
                dias: dias
            };
        }) || [];

        const tiempoPromedio = tiempos.length > 0
            ? tiempos.reduce((sum, t) => sum + t.dias, 0) / tiempos.length
            : 0;

        return {
            tiempoPromedio: tiempoPromedio.toFixed(1),
            totalEquipos: tiempos.length,
            detalles: tiempos.sort((a, b) => b.dias - a.dias)
        };
    };

    const generarDocumentosProcesados = async () => {
        const { data: documentos, error } = await supabase
            .from('servicios_documentos')
            .select('id, tipo_servicio, created_at, estado')
            .gte('created_at', fechaInicio)
            .lte('created_at', fechaFin + 'T23:59:59')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const agrupados = {};
        documentos?.forEach(d => {
            const tipo = d.tipo_servicio || 'Sin tipo';
            if (!agrupados[tipo]) {
                agrupados[tipo] = 0;
            }
            agrupados[tipo]++;
        });

        return {
            total: documentos?.length || 0,
            porTipo: agrupados,
            detalles: documentos || []
        };
    };

    const generarPedidosEstado = async () => {
        const { data: pedidos, error } = await supabase
            .from('pedidos_piezas')
            .select('id, estado, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const agrupados = {};
        pedidos?.forEach(p => {
            if (!agrupados[p.estado]) {
                agrupados[p.estado] = 0;
            }
            agrupados[p.estado]++;
        });

        return {
            total: pedidos?.length || 0,
            porEstado: agrupados,
            detalles: pedidos || []
        };
    };

    const generarInventarioValor = async () => {
        // Intentar tabla nueva
        const { data: productos, error } = await supabase
            .from('inventario_productos')
            .select('tipo, stock_actual, costo_promedio')
            .eq('activo', true);

        if (error) {
            // Fallback a tabla antigua
            const { data: productosOld, error: oldError } = await supabase
                .from('inventario')
                .select('tipo, cantidad, precio_unitario');

            if (oldError) throw oldError;

            const agrupados = {};
            let valorTotal = 0;

            productosOld?.forEach(p => {
                const valor = (p.cantidad || 0) * (p.precio_unitario || 0);
                valorTotal += valor;
                
                if (!agrupados[p.tipo]) {
                    agrupados[p.tipo] = { cantidad: 0, valor: 0 };
                }
                agrupados[p.tipo].cantidad += p.cantidad || 0;
                agrupados[p.tipo].valor += valor;
            });

            return {
                valorTotal,
                porTipo: agrupados,
                totalProductos: productosOld?.length || 0
            };
        }

        const agrupados = {};
        let valorTotal = 0;

        productos?.forEach(p => {
            const valor = (p.stock_actual || 0) * (p.costo_promedio || 0);
            valorTotal += valor;
            
            if (!agrupados[p.tipo]) {
                agrupados[p.tipo] = { cantidad: 0, valor: 0 };
            }
            agrupados[p.tipo].cantidad += p.stock_actual || 0;
            agrupados[p.tipo].valor += valor;
        });

        return {
            valorTotal,
            porTipo: agrupados,
            totalProductos: productos?.length || 0
        };
    };

    const generarProductividadTecnicos = async () => {
        const { data: historial, error } = await supabase
            .from('historial_procesos')
            .select('usuario_id, profiles(nombre, email)')
            .not('usuario_id', 'is', null)
            .gte('created_at', fechaInicio)
            .lte('created_at', fechaFin + 'T23:59:59');

        if (error) throw error;

        const agrupados = {};
        historial?.forEach(h => {
            const nombre = h.profiles?.nombre || h.profiles?.email || 'Sin nombre';
            if (!agrupados[nombre]) {
                agrupados[nombre] = 0;
            }
            agrupados[nombre]++;
        });

        return {
            porTecnico: agrupados,
            totalAcciones: historial?.length || 0
        };
    };

    const formatearFecha = (fecha) => {
        return new Date(fecha).toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'America/Mexico_City'
        });
    };

    useEffect(() => {
        cargarResumen();
    }, [fechaInicio, fechaFin]);

    const cargarResumen = async () => {
        setLoadingResumen(true);
        try {
            if (demoMode) {
                // En modo demo usar datos estáticos
                setDatosResumen(DEMO_RESUMEN);
            } else {
                // Cargar datos de resumen para gráficas principales desde Supabase
                const [equiposData, documentosData, pedidosData] = await Promise.all([
                    generarEquiposPorEstado(),
                    generarDocumentosProcesados(),
                    generarPedidosEstado()
                ]);

                setDatosResumen({
                    equipos: equiposData,
                    documentos: documentosData,
                    pedidos: pedidosData
                });
            }
        } catch (error) {
            console.error('Error cargando resumen:', error);
        } finally {
            setLoadingResumen(false);
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-title-section">
                    <h1 className="page-title">
                        <Icon name="chart-bar" className="page-title-icon" />
                        Reportes de Zona Asist
                    </h1>
                    <p className="page-subtitle">
                        Análisis y estadísticas de tu taller técnico
                    </p>
                </div>
            </div>

            {/* Filtros de Fecha */}
            <div className="reportes-filters">
                <div className="filter-group">
                    <label className="filter-label">Fecha Inicio</label>
                    <input
                        type="date"
                        className="filter-input"
                        value={fechaInicio}
                        onChange={(e) => setFechaInicio(e.target.value)}
                    />
                </div>
                <div className="filter-group">
                    <label className="filter-label">Fecha Fin</label>
                    <input
                        type="date"
                        className="filter-input"
                        value={fechaFin}
                        onChange={(e) => setFechaFin(e.target.value)}
                    />
                </div>
            </div>

            {/* Gráficas Resumen */}
            {!loadingResumen && datosResumen && (
                <div className="resumen-graficas">
                    <h2 className="section-title">Resumen del Período</h2>
                    <div className="graficas-grid">
                        <div className="grafica-card">
                            <h3 className="grafica-title">Equipos por Estado</h3>
                            <div className="grafica-container-small">
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={Object.entries(datosResumen.equipos.distribucion).map(([estado, cantidad]) => ({
                                                name: estado.replace('_', ' ').toUpperCase(),
                                                value: cantidad
                                            }))}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {Object.entries(datosResumen.equipos.distribucion).map((entry, index) => {
                                                const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];
                                                return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                                            })}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: 'rgba(30,30,30,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="grafica-card">
                            <h3 className="grafica-title">Documentos por Tipo</h3>
                            <div className="grafica-container-small">
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={Object.entries(datosResumen.documentos.porTipo).map(([tipo, cantidad]) => ({
                                        name: tipo.length > 10 ? tipo.substring(0, 10) + '...' : tipo,
                                        cantidad: cantidad
                                    }))}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.7)" />
                                        <YAxis stroke="rgba(255,255,255,0.7)" />
                                        <Tooltip contentStyle={{ backgroundColor: 'rgba(30,30,30,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} />
                                        <Bar dataKey="cantidad" fill="#ec4899" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="grafica-card">
                            <h3 className="grafica-title">Pedidos por Estado</h3>
                            <div className="grafica-container-small">
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={Object.entries(datosResumen.pedidos.porEstado).map(([estado, cantidad]) => ({
                                        name: estado.toUpperCase(),
                                        cantidad: cantidad
                                    }))}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.7)" />
                                        <YAxis stroke="rgba(255,255,255,0.7)" />
                                        <Tooltip contentStyle={{ backgroundColor: 'rgba(30,30,30,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} />
                                        <Bar dataKey="cantidad" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Grid de Reportes */}
            <div className="reportes-section">
                <h2 className="section-title">Reportes Detallados</h2>
                <div className="reportes-grid">
                    {tiposReportes.map(reporte => (
                        <div
                            key={reporte.id}
                            className="reporte-card"
                            onClick={() => {
                                if (demoMode) {
                                    // En demo, generar datos ficticios rápidos sin tocar Supabase
                                    setReporteSeleccionado(reporte);
                                    switch (reporte.id) {
                                        case 'equipos_procesados':
                                            setDatosReporte({
                                                total: 25,
                                                completados: 12,
                                                enProceso: 6,
                                                pendientes: 7
                                            });
                                            break;
                                        case 'equipos_por_estado':
                                            setDatosReporte(DEMO_RESUMEN.equipos);
                                            break;
                                        case 'equipos_por_proceso':
                                            setDatosReporte({
                                                distribucion: {
                                                    'Reparación estándar': 10,
                                                    'Mantenimiento completo': 5,
                                                    'Instalación software': 4,
                                                    'Diagnóstico rápido': 6
                                                },
                                                total: 25
                                            });
                                            break;
                                        case 'tiempo_promedio':
                                            setDatosReporte({
                                                tiempoPromedio: '3.5',
                                                totalEquipos: 18,
                                                detalles: [
                                                    { equipo: { nota: '130' }, dias: 5 },
                                                    { equipo: { nota: '125' }, dias: 4 },
                                                    { equipo: { nota: '120' }, dias: 3 }
                                                ]
                                            });
                                            break;
                                        case 'documentos_procesados':
                                            setDatosReporte(DEMO_RESUMEN.documentos);
                                            break;
                                        case 'pedidos_estado':
                                            setDatosReporte(DEMO_RESUMEN.pedidos);
                                            break;
                                        case 'inventario_valor':
                                            setDatosReporte({
                                                valorTotal: 18500,
                                                porTipo: {
                                                    Refacciones: { cantidad: 32, valor: 9500 },
                                                    Consumibles: { cantidad: 50, valor: 6000 },
                                                    'Equipos venta': { cantidad: 4, valor: 3000 }
                                                },
                                                totalProductos: 86
                                            });
                                            break;
                                        case 'productividad_tecnicos':
                                            setDatosReporte({
                                                porTecnico: {
                                                    'Carlos Técnico': 15,
                                                    'Ana Soporte': 12,
                                                    'Luis Taller': 9
                                                },
                                                totalAcciones: 36
                                            });
                                            break;
                                        default:
                                            setDatosReporte(null);
                                    }
                                } else {
                                    generarReporte(reporte);
                                }
                            }}
                        >
                            <div className="reporte-icon" style={{ background: `${reporte.color}20`, color: reporte.color }}>
                                <Icon name={reporte.icono} />
                            </div>
                            <div className="reporte-content">
                                <h3 className="reporte-nombre">{reporte.nombre}</h3>
                                <p className="reporte-descripcion">{reporte.descripcion}</p>
                            </div>
                            <div className="reporte-arrow">
                                <Icon name="arrow-right" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal de Resultados */}
            {reporteSeleccionado && datosReporte && (
                <div className="modal-overlay" onClick={() => setReporteSeleccionado(null)}>
                    <div className="modal reporte-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>
                                <Icon name={reporteSeleccionado.icono} style={{ marginRight: '0.5rem', color: reporteSeleccionado.color }} />
                                {reporteSeleccionado.nombre}
                            </h2>
                            <button className="close-btn" onClick={() => setReporteSeleccionado(null)}>
                                <Icon name="times" />
                            </button>
                        </div>
                        <div className="modal-content">
                            <div className="reporte-periodo">
                                <p>
                                    <strong>Período:</strong> {formatearFecha(fechaInicio)} - {formatearFecha(fechaFin)}
                                </p>
                            </div>

                            {loading ? (
                                <div className="loading-state">
                                    <div className="loading-spinner"></div>
                                    <p>Generando reporte...</p>
                                </div>
                            ) : (
                                <div className="reporte-resultados">
                                    {reporteSeleccionado.id === 'equipos_procesados' && (
                                        <>
                                            <div className="resultados-grid">
                                                <div className="resultado-card">
                                                    <div className="resultado-label">Total</div>
                                                    <div className="resultado-value">{datosReporte.total}</div>
                                                </div>
                                                <div className="resultado-card success">
                                                    <div className="resultado-label">Completados</div>
                                                    <div className="resultado-value">{datosReporte.completados}</div>
                                                </div>
                                                <div className="resultado-card warning">
                                                    <div className="resultado-label">En Proceso</div>
                                                    <div className="resultado-value">{datosReporte.enProceso}</div>
                                                </div>
                                                <div className="resultado-card info">
                                                    <div className="resultado-label">Pendientes</div>
                                                    <div className="resultado-value">{datosReporte.pendientes}</div>
                                                </div>
                                            </div>
                                            <div className="grafica-container">
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <BarChart data={[
                                                        { name: 'Completados', valor: datosReporte.completados },
                                                        { name: 'En Proceso', valor: datosReporte.enProceso },
                                                        { name: 'Pendientes', valor: datosReporte.pendientes }
                                                    ]}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.7)" />
                                                        <YAxis stroke="rgba(255,255,255,0.7)" />
                                                        <Tooltip contentStyle={{ backgroundColor: 'rgba(30,30,30,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} />
                                                        <Bar dataKey="valor" fill="#10b981" radius={[8, 8, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </>
                                    )}

                                    {reporteSeleccionado.id === 'equipos_por_estado' && (
                                        <>
                                            <div className="grafica-container">
                                                <ResponsiveContainer width="100%" height={350}>
                                                    <PieChart>
                                                        <Pie
                                                            data={Object.entries(datosReporte.distribucion).map(([estado, cantidad]) => ({
                                                                name: estado.replace('_', ' ').toUpperCase(),
                                                                value: cantidad
                                                            }))}
                                                            cx="50%"
                                                            cy="50%"
                                                            labelLine={false}
                                                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                                            outerRadius={100}
                                                            fill="#8884d8"
                                                            dataKey="value"
                                                        >
                                                            {Object.entries(datosReporte.distribucion).map((entry, index) => {
                                                                const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
                                                                return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                                                            })}
                                                        </Pie>
                                                        <Tooltip contentStyle={{ backgroundColor: 'rgba(30,30,30,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} />
                                                        <Legend />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <div className="resultados-list">
                                                {Object.entries(datosReporte.distribucion).map(([estado, cantidad]) => (
                                                    <div key={estado} className="resultado-item">
                                                        <span className="resultado-item-label">{estado.replace('_', ' ').toUpperCase()}</span>
                                                        <span className="resultado-item-value">{cantidad}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {reporteSeleccionado.id === 'equipos_por_proceso' && (
                                        <>
                                            <div className="grafica-container">
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <BarChart 
                                                        data={Object.entries(datosReporte.distribucion).map(([proceso, cantidad]) => ({
                                                            name: proceso.length > 15 ? proceso.substring(0, 15) + '...' : proceso,
                                                            valor: cantidad
                                                        }))}
                                                        layout="vertical"
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                                        <XAxis type="number" stroke="rgba(255,255,255,0.7)" />
                                                        <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.7)" width={120} />
                                                        <Tooltip contentStyle={{ backgroundColor: 'rgba(30,30,30,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} />
                                                        <Bar dataKey="valor" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <div className="resultados-list">
                                                {Object.entries(datosReporte.distribucion).map(([proceso, cantidad]) => (
                                                    <div key={proceso} className="resultado-item">
                                                        <span className="resultado-item-label">{proceso}</span>
                                                        <span className="resultado-item-value">{cantidad}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {reporteSeleccionado.id === 'tiempo_promedio' && (
                                        <>
                                            <div className="resultados-single">
                                                <div className="resultado-card large">
                                                    <div className="resultado-label">Tiempo Promedio</div>
                                                    <div className="resultado-value huge">{datosReporte.tiempoPromedio} días</div>
                                                    <div className="resultado-subtext">Basado en {datosReporte.totalEquipos} equipos</div>
                                                </div>
                                            </div>
                                            {datosReporte.detalles && datosReporte.detalles.length > 0 && (
                                                <div className="grafica-container">
                                                    <ResponsiveContainer width="100%" height={300}>
                                                        <BarChart data={datosReporte.detalles.slice(0, 10).map(d => ({
                                                            name: `Equipo #${d.equipo?.nota || 'N/A'}`,
                                                            dias: d.dias
                                                        }))}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                                            <XAxis dataKey="name" stroke="rgba(255,255,255,0.7)" angle={-45} textAnchor="end" height={80} />
                                                            <YAxis stroke="rgba(255,255,255,0.7)" />
                                                            <Tooltip contentStyle={{ backgroundColor: 'rgba(30,30,30,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} />
                                                            <Bar dataKey="dias" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {reporteSeleccionado.id === 'documentos_procesados' && (
                                        <>
                                            <div className="resultados-grid">
                                                <div className="resultado-card">
                                                    <div className="resultado-label">Total Documentos</div>
                                                    <div className="resultado-value">{datosReporte.total}</div>
                                                </div>
                                                {Object.entries(datosReporte.porTipo).map(([tipo, cantidad]) => (
                                                    <div key={tipo} className="resultado-card">
                                                        <div className="resultado-label">{tipo}</div>
                                                        <div className="resultado-value">{cantidad}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="grafica-container">
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <BarChart data={Object.entries(datosReporte.porTipo).map(([tipo, cantidad]) => ({
                                                        name: tipo,
                                                        cantidad: cantidad
                                                    }))}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.7)" />
                                                        <YAxis stroke="rgba(255,255,255,0.7)" />
                                                        <Tooltip contentStyle={{ backgroundColor: 'rgba(30,30,30,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} />
                                                        <Bar dataKey="cantidad" fill="#ec4899" radius={[8, 8, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </>
                                    )}

                                    {reporteSeleccionado.id === 'pedidos_estado' && (
                                        <>
                                            <div className="grafica-container">
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <PieChart>
                                                        <Pie
                                                            data={Object.entries(datosReporte.porEstado).map(([estado, cantidad]) => ({
                                                                name: estado.toUpperCase(),
                                                                value: cantidad
                                                            }))}
                                                            cx="50%"
                                                            cy="50%"
                                                            labelLine={false}
                                                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                                            outerRadius={100}
                                                            fill="#8884d8"
                                                            dataKey="value"
                                                        >
                                                            {Object.entries(datosReporte.porEstado).map((entry, index) => {
                                                                const COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
                                                                return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                                                            })}
                                                        </Pie>
                                                        <Tooltip contentStyle={{ backgroundColor: 'rgba(30,30,30,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} />
                                                        <Legend />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <div className="resultados-list">
                                                {Object.entries(datosReporte.porEstado).map(([estado, cantidad]) => (
                                                    <div key={estado} className="resultado-item">
                                                        <span className="resultado-item-label">{estado.toUpperCase()}</span>
                                                        <span className="resultado-item-value">{cantidad}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {reporteSeleccionado.id === 'inventario_valor' && (
                                        <>
                                            <div className="resultados-grid">
                                                <div className="resultado-card highlight">
                                                    <div className="resultado-label">Valor Total</div>
                                                    <div className="resultado-value">
                                                        ${datosReporte.valorTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>
                                                </div>
                                                {Object.entries(datosReporte.porTipo).map(([tipo, datos]) => (
                                                    <div key={tipo} className="resultado-card">
                                                        <div className="resultado-label">{tipo}</div>
                                                        <div className="resultado-value">${datos.valor.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                                                        <div className="resultado-subtext">{datos.cantidad} unidades</div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="grafica-container">
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <BarChart data={Object.entries(datosReporte.porTipo).map(([tipo, datos]) => ({
                                                        name: tipo.length > 12 ? tipo.substring(0, 12) + '...' : tipo,
                                                        valor: datos.valor
                                                    }))}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.7)" />
                                                        <YAxis stroke="rgba(255,255,255,0.7)" />
                                                        <Tooltip 
                                                            contentStyle={{ backgroundColor: 'rgba(30,30,30,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                                                            formatter={(value) => `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
                                                        />
                                                        <Bar dataKey="valor" fill="#10b981" radius={[8, 8, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </>
                                    )}

                                    {reporteSeleccionado.id === 'productividad_tecnicos' && (
                                        <>
                                            <div className="grafica-container">
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <BarChart 
                                                        data={Object.entries(datosReporte.porTecnico)
                                                            .sort((a, b) => b[1] - a[1])
                                                            .map(([tecnico, cantidad]) => ({
                                                                name: tecnico.length > 15 ? tecnico.substring(0, 15) + '...' : tecnico,
                                                                acciones: cantidad
                                                            }))}
                                                        layout="vertical"
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                                        <XAxis type="number" stroke="rgba(255,255,255,0.7)" />
                                                        <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.7)" width={120} />
                                                        <Tooltip contentStyle={{ backgroundColor: 'rgba(30,30,30,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} />
                                                        <Bar dataKey="acciones" fill="#6366f1" radius={[0, 8, 8, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <div className="resultados-list">
                                                {Object.entries(datosReporte.porTecnico)
                                                    .sort((a, b) => b[1] - a[1])
                                                    .map(([tecnico, cantidad]) => (
                                                        <div key={tecnico} className="resultado-item">
                                                            <span className="resultado-item-label">{tecnico}</span>
                                                            <span className="resultado-item-value">{cantidad} acciones</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setReporteSeleccionado(null)}>
                                Cerrar
                            </button>
                            <button className="btn-primary" onClick={() => window.print()}>
                                <Icon name="print" />
                                Imprimir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

