import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import AddInventarioModal from './AddInventarioModal.jsx';
import AgregarStockModal from './AgregarStockModal.jsx';
import './Dashboard.css';
import './ClientesPage.css';
import './InventarioPage.css';

export default function InventarioPage() {
    const [productos, setProductos] = useState([]);
    const [productosBajoMinimo, setProductosBajoMinimo] = useState([]);
    const [productosAgotados, setProductosAgotados] = useState([]);
    const [activeTab, setActiveTab] = useState('todos');
    const [activeFilter, setActiveFilter] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showAgregarStockModal, setShowAgregarStockModal] = useState(false);
    const [editingProducto, setEditingProducto] = useState(null);
    const [selectedProducto, setSelectedProducto] = useState(null);
    const [productoParaStock, setProductoParaStock] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // Métricas del dashboard
    const [metrics, setMetrics] = useState({
        valorTotal: 0,
        productosActivos: 0,
        alertasCriticas: 0,
        movimientosHoy: 0
    });

    useEffect(() => {
        const shouldAdd = searchParams.get('add');
        if (shouldAdd === 'true') {
            setShowAddModal(true);
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        fetchProductos();
        fetchMetrics();
    }, []);

    useEffect(() => {
        if (showAddModal === false) {
            setEditingProducto(null);
        }
    }, [showAddModal]);

    const fetchMetrics = async () => {
        try {
            // Intentar usar la nueva tabla primero
            const { data: productosData, error } = await supabase
                .from('inventario_productos')
                .select('stock_actual, costo_promedio')
                .eq('activo', true);

            if (error) {
                // Fallback a tabla antigua si no existe la nueva
                const { data: productosOld } = await supabase
                    .from('inventario')
                    .select('cantidad, precio_unitario, estado');

                if (productosOld) {
                    const valorTotal = productosOld.reduce((sum, p) => {
                        return sum + (parseFloat(p.cantidad || 0) * parseFloat(p.precio_unitario || 0));
                    }, 0);
                    setMetrics({
                        valorTotal,
                        productosActivos: productosOld.filter(p => parseFloat(p.cantidad || 0) > 0).length,
                        alertasCriticas: 0,
                        movimientosHoy: 0
                    });
                } else {
                    setMetrics({
                        valorTotal: 0,
                        productosActivos: 0,
                        alertasCriticas: 0,
                        movimientosHoy: 0
                    });
                }
                return;
            }

            const valorTotal = productosData?.reduce((sum, p) => {
                return sum + (parseFloat(p.stock_actual || 0) * parseFloat(p.costo_promedio || 0));
            }, 0) || 0;

            const productosActivos = productosData?.filter(p => p.stock_actual > 0).length || 0;

            // Alertas críticas
            const { data: alertas } = await supabase
                .from('inventario_alertas')
                .select('id')
                .limit(100);

            // Movimientos de hoy
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const { count: movimientosHoy } = await supabase
                .from('inventario_movimientos')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', hoy.toISOString());

            setMetrics({
                valorTotal,
                productosActivos,
                alertasCriticas: alertas?.length || 0,
                movimientosHoy: movimientosHoy || 0
            });
        } catch (error) {
            console.error('Error fetching metrics:', error);
            setMetrics({
                valorTotal: 0,
                productosActivos: 0,
                alertasCriticas: 0,
                movimientosHoy: 0
            });
        }
    };

    const fetchProductos = async () => {
        try {
            setLoading(true);

            // Intentar usar la nueva tabla profesional
            let productosData = null;

            // Primero intentar con la vista
            const { data: vistaData, error: vistaError } = await supabase
                .from('inventario_productos_estado')
                .select(`
                    *,
                    proveedores (
                        id,
                        nombre,
                        contacto,
                        telefono
                    )
                `)
                .order('nombre');

            if (!vistaError && vistaData) {
                console.log('✅ Usando vista inventario_productos_estado:', vistaData.length, 'productos');
                productosData = vistaData;
            } else {
                console.log('⚠️ Vista no disponible, intentando tabla base...', vistaError);
                
                // Si la vista no existe, usar tabla base y calcular estados
                const { data: productosBase, error: baseError } = await supabase
                    .from('inventario_productos')
                    .select(`
                        *,
                        proveedores (
                            id,
                            nombre,
                            contacto,
                            telefono
                        )
                    `)
                    .order('nombre');

                if (baseError) {
                    console.log('⚠️ Error en inventario_productos, intentando tabla antigua...', baseError);
                    
                    // Fallback a tabla antigua
                    const { data: productosOld, error: oldError } = await supabase
                        .from('inventario')
                        .select(`
                            id,
                            tipo,
                            nombre,
                            descripcion,
                            cantidad,
                            precio_unitario,
                            proveedor_id,
                            ubicacion,
                            estado,
                            created_at,
                            proveedores (
                                id,
                                nombre,
                                contacto,
                                telefono
                            )
                        `)
                        .order('created_at', { ascending: false });

                    if (oldError) {
                        console.error('❌ Error fetching productos:', oldError);
                        setProductos([]);
                        setProductosAgotados([]);
                        setProductosBajoMinimo([]);
                        return;
                    }

                    console.log('✅ Usando tabla antigua inventario:', productosOld?.length || 0, 'productos');
                    productosData = (productosOld || []).map(p => {
                        const stockActual = parseFloat(p.cantidad || 0);
                        const costoPromedio = parseFloat(p.precio_unitario || 0);
                        let estadoProducto = p.estado || 'disponible';
                        if (stockActual === 0) {
                            estadoProducto = 'agotado';
                        }
                        return {
                            ...p,
                            stock_actual: stockActual,
                            costo_promedio: costoPromedio,
                            stock_reservado: 0,
                            stock_disponible: stockActual,
                            estado_producto: estadoProducto,
                            valor_total: stockActual * costoPromedio,
                            stock_minimo: 0,
                            activo: true,
                            codigo_sku: null,
                            categoria: null
                        };
                    });
                } else {
                    console.log('✅ Usando tabla inventario_productos:', productosBase?.length || 0, 'productos');
                    
                    // Calcular estados manualmente para nueva tabla
                    productosData = await Promise.all(
                        (productosBase || []).map(async (producto) => {
                            const { data: reservas } = await supabase
                                .from('inventario_reservas')
                                .select('cantidad')
                                .eq('producto_id', producto.id)
                                .in('estado', ['pendiente', 'confirmada']);

                            const stockReservado = reservas?.reduce((sum, r) => sum + (r.cantidad || 0), 0) || 0;
                            const stockDisponible = (producto.stock_actual || 0) - stockReservado;

                            let estadoProducto = 'disponible';
                            if (producto.stock_actual === 0) {
                                estadoProducto = 'agotado';
                            } else if (producto.stock_actual < (producto.stock_minimo || 0)) {
                                estadoProducto = 'bajo_minimo';
                            } else if (stockReservado > 0) {
                                estadoProducto = 'reservado';
                            }

                            return {
                                ...producto,
                                stock_reservado: stockReservado,
                                stock_disponible: stockDisponible,
                                estado_producto: estadoProducto,
                                valor_total: (producto.stock_actual || 0) * (producto.costo_promedio || 0)
                            };
                        })
                    );
                }
            }

            console.log('📦 Productos finales:', productosData?.length || 0);
            setProductos(productosData || []);

            // Separar por estados
            const agotados = (productosData || []).filter(p => p.estado_producto === 'agotado');
            const bajoMinimo = (productosData || []).filter(p => p.estado_producto === 'bajo_minimo');

            setProductosAgotados(agotados);
            setProductosBajoMinimo(bajoMinimo);
        } catch (error) {
            console.error('❌ Error fetching productos:', error);
            setProductos([]);
            setProductosAgotados([]);
            setProductosBajoMinimo([]);
        } finally {
            setLoading(false);
        }
    };

    const getProductosFiltrados = () => {
        let filtered = productos;

        // Filtro por tab
        if (activeTab === 'agotados') {
            filtered = productos.filter(p => p.estado_producto === 'agotado');
        } else if (activeTab === 'bajo_minimo') {
            filtered = productos.filter(p => p.estado_producto === 'bajo_minimo');
        } else if (activeTab === 'reservados') {
            filtered = productos.filter(p => p.estado_producto === 'reservado');
        } else if (activeTab === 'disponibles') {
            filtered = productos.filter(p => p.estado_producto === 'disponible');
        }

        // Filtro por tipo
        if (activeFilter) {
            filtered = filtered.filter(p => p.tipo === activeFilter);
        }

        // Búsqueda
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(p => 
                p.nombre?.toLowerCase().includes(query) ||
                p.codigo_sku?.toLowerCase().includes(query) ||
                p.descripcion?.toLowerCase().includes(query)
            );
        }

        return filtered;
    };

    const getEstadoBadge = (estado) => {
        const estados = {
            'disponible': { label: 'Disponible', color: '#10b981', bg: 'rgba(16, 185, 129, 0.2)' },
            'bajo_minimo': { label: 'Bajo Mínimo', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)' },
            'agotado': { label: 'Agotado', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' },
            'reservado': { label: 'Reservado', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)' }
        };
        const estadoInfo = estados[estado] || estados.disponible;
        return (
            <span 
                className="producto-estado-badge"
                style={{ 
                    backgroundColor: estadoInfo.bg, 
                    color: estadoInfo.color,
                    padding: '0.25rem 0.75rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}
            >
                {estadoInfo.label}
            </span>
        );
    };

    const getTipoLabel = (tipo) => {
        const tipos = {
            'equipo_venta': 'Equipo para Venta',
            'refaccion': 'Refacción',
            'consumible': 'Consumible',
            'papel': 'Papel',
            'tinta': 'Tinta',
            'almohadilla': 'Almohadilla',
            'disco_duro': 'Disco Duro',
            'otro': 'Otro'
        };
        return tipos[tipo] || tipo;
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-title-section">
                    <h1 className="page-title">
                        <Icon name="box" className="page-title-icon" />
                        Inventario General
                    </h1>
                    <p className="page-subtitle">
                        Control profesional de inventario con auditoría completa
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                        className="btn-primary"
                        onClick={() => {
                            setEditingProducto(null);
                            setShowAddModal(true);
                        }}
                    >
                        <Icon name="plus" />
                        <span>Nuevo Producto</span>
                    </button>
                    {productos.length > 0 && selectedProducto && (
                        <button
                            className="btn-secondary"
                            onClick={() => {
                                setProductoParaStock(selectedProducto);
                                setShowAgregarStockModal(true);
                            }}
                            style={{ 
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                color: '#10b981'
                            }}
                        >
                            <Icon name="box" />
                            <span>Agregar Stock</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Métricas Principales */}
            <div className="inventario-metrics">
                <div className="metric-card highlight">
                    <div className="metric-icon">
                        <Icon name="dollar-sign" />
                    </div>
                    <div className="metric-content">
                        <div className="metric-label">Valor Total</div>
                        <div className="metric-value">${metrics.valorTotal.toFixed(2)}</div>
                    </div>
                </div>
                <div className="metric-card">
                    <div className="metric-icon">
                        <Icon name="box" />
                    </div>
                    <div className="metric-content">
                        <div className="metric-label">Productos Activos</div>
                        <div className="metric-value">{metrics.productosActivos}</div>
                    </div>
                </div>
                <div className="metric-card alert">
                    <div className="metric-icon">
                        <Icon name="exclamation-triangle" />
                    </div>
                    <div className="metric-content">
                        <div className="metric-label">Alertas Críticas</div>
                        <div className="metric-value">{metrics.alertasCriticas}</div>
                    </div>
                </div>
                <div className="metric-card">
                    <div className="metric-icon">
                        <Icon name="sync" />
                    </div>
                    <div className="metric-content">
                        <div className="metric-label">Movimientos Hoy</div>
                        <div className="metric-value">{metrics.movimientosHoy}</div>
                    </div>
                </div>
            </div>

            {/* Búsqueda y Filtros */}
            <div className="inventario-filters">
                <div className="search-wrapper">
                    <Icon name="search" className="search-icon" />
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Buscar por nombre, SKU o descripción..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            className="search-clear"
                            onClick={() => setSearchQuery('')}
                        >
                            <Icon name="times" />
                        </button>
                    )}
                </div>
                <div className="filter-buttons">
                    <button
                        className={`filter-btn ${activeFilter === null ? 'active' : ''}`}
                        onClick={() => setActiveFilter(null)}
                    >
                        Todos
                    </button>
                    <button
                        className={`filter-btn ${activeFilter === 'refaccion' ? 'active' : ''}`}
                        onClick={() => setActiveFilter('refaccion')}
                    >
                        Refacciones
                    </button>
                    <button
                        className={`filter-btn ${activeFilter === 'consumible' ? 'active' : ''}`}
                        onClick={() => setActiveFilter('consumible')}
                    >
                        Consumibles
                    </button>
                    <button
                        className={`filter-btn ${activeFilter === 'tinta' ? 'active' : ''}`}
                        onClick={() => setActiveFilter('tinta')}
                    >
                        Tintas
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="page-tabs">
                <button
                    className={`tab-button ${activeTab === 'todos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('todos')}
                >
                    <Icon name="th" />
                    <span>Todos ({productos.length})</span>
                </button>
                <button
                    className={`tab-button ${activeTab === 'disponibles' ? 'active' : ''}`}
                    onClick={() => setActiveTab('disponibles')}
                >
                    <Icon name="check-circle" />
                    <span>Disponibles</span>
                </button>
                <button
                    className={`tab-button ${activeTab === 'reservados' ? 'active' : ''}`}
                    onClick={() => setActiveTab('reservados')}
                >
                    <Icon name="lock" />
                    <span>Reservados</span>
                </button>
                <button
                    className={`tab-button ${activeTab === 'bajo_minimo' ? 'active' : ''}`}
                    onClick={() => setActiveTab('bajo_minimo')}
                >
                    <Icon name="exclamation-triangle" />
                    <span>Bajo Mínimo ({productosBajoMinimo.length})</span>
                </button>
                <button
                    className={`tab-button ${activeTab === 'agotados' ? 'active' : ''}`}
                    onClick={() => setActiveTab('agotados')}
                >
                    <Icon name="times-circle" />
                    <span>Agotados ({productosAgotados.length})</span>
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Cargando inventario...</p>
                </div>
            ) : (
                <div className="refacciones-grid">
                    {getProductosFiltrados().length > 0 ? (
                        getProductosFiltrados().map((producto) => (
                            <div
                                key={producto.id}
                                className="refaccion-card"
                                onClick={() => setSelectedProducto(producto)}
                            >
                                <div className="refaccion-card-header">
                                    <div className="refaccion-icon">
                                        <Icon name="box" />
                                    </div>
                                    <div className="refaccion-info">
                                        {producto.codigo_sku && (
                                            <div className="refaccion-badge">
                                                SKU: {producto.codigo_sku}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                            <h3 className="refaccion-nombre">{producto.nombre}</h3>
                                            {getEstadoBadge(producto.estado_producto)}
                                        </div>
                                        {producto.descripcion && (
                                            <p className="refaccion-descripcion">{producto.descripcion}</p>
                                        )}
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.6))' }}>
                                            {getTipoLabel(producto.tipo)}
                                            {producto.categoria && ` • ${producto.categoria}`}
                                        </div>
                                    </div>
                                </div>

                                <div className="refaccion-card-content">
                                    <div className="refaccion-detail">
                                        <Icon name="hashtag" className="detail-icon" />
                                        <span className="detail-label">Stock Actual:</span>
                                        <span className="detail-value">{producto.stock_actual || 0}</span>
                                    </div>
                                    {producto.stock_reservado > 0 && (
                                        <div className="refaccion-detail">
                                            <Icon name="lock" className="detail-icon" />
                                            <span className="detail-label">Reservado:</span>
                                            <span className="detail-value" style={{ color: '#3b82f6' }}>
                                                {producto.stock_reservado}
                                            </span>
                                        </div>
                                    )}
                                    <div className="refaccion-detail">
                                        <Icon name="check-circle" className="detail-icon" />
                                        <span className="detail-label">Disponible:</span>
                                        <span className="detail-value highlight">
                                            {producto.stock_disponible !== undefined ? producto.stock_disponible : (producto.stock_actual || 0)}
                                        </span>
                                    </div>
                                    {producto.stock_minimo > 0 && (
                                        <div className="refaccion-detail">
                                            <Icon name="exclamation-triangle" className="detail-icon" />
                                            <span className="detail-label">Mínimo:</span>
                                            <span className="detail-value">{producto.stock_minimo}</span>
                                        </div>
                                    )}
                                    <div className="refaccion-detail">
                                        <Icon name="dollar-sign" className="detail-icon" />
                                        <span className="detail-label">Costo Promedio:</span>
                                        <span className="detail-value">${parseFloat(producto.costo_promedio || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="refaccion-detail">
                                        <Icon name="calculator" className="detail-icon" />
                                        <span className="detail-label">Valor Total:</span>
                                        <span className="detail-value highlight">
                                            ${parseFloat(producto.valor_total || (producto.stock_actual || 0) * (producto.costo_promedio || 0)).toFixed(2)}
                                        </span>
                                    </div>
                                    {producto.proveedores && (
                                        <div className="refaccion-detail">
                                            <Icon name="shipping-fast" className="detail-icon" />
                                            <span className="detail-label">Proveedor:</span>
                                            <span className="detail-value">{producto.proveedores.nombre}</span>
                                        </div>
                                    )}
                                    {producto.ubicacion && (
                                        <div className="refaccion-detail">
                                            <Icon name="map-marker-alt" className="detail-icon" />
                                            <span className="detail-label">Ubicación:</span>
                                            <span className="detail-value">{producto.ubicacion}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="refaccion-card-actions">
                                    <button
                                        className="btn-secondary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setProductoParaStock(producto);
                                            setShowAgregarStockModal(true);
                                        }}
                                        style={{ 
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            border: '1px solid rgba(16, 185, 129, 0.3)',
                                            color: '#10b981'
                                        }}
                                    >
                                        <Icon name="plus" />
                                        <span>Agregar Stock</span>
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedProducto(producto);
                                            setEditingProducto(producto);
                                            setShowAddModal(true);
                                        }}
                                    >
                                        <Icon name="edit" />
                                        <span>Editar</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="empty-state">
                            <div className="empty-icon">
                                <Icon name="box" />
                            </div>
                            <h3>
                                {searchQuery 
                                    ? 'No se encontraron productos' 
                                    : `No hay productos ${activeTab === 'todos' ? '' : activeTab.replace('_', ' ')}`
                                }
                            </h3>
                            <p>
                                {searchQuery 
                                    ? 'Intenta con otros términos de búsqueda'
                                    : 'Agrega un nuevo producto al inventario para comenzar'
                                }
                            </p>
                            {!searchQuery && (
                                <button
                                    className="btn-primary"
                                    onClick={() => {
                                        setEditingProducto(null);
                                        setShowAddModal(true);
                                    }}
                                >
                                    <Icon name="plus" />
                                    <span>Nuevo Producto</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            <AddInventarioModal
                isOpen={showAddModal}
                onClose={() => {
                    setShowAddModal(false);
                    setEditingProducto(null);
                }}
                onSuccess={async () => {
                    console.log('🔄 Recargando productos después de agregar...');
                    await fetchProductos();
                    await fetchMetrics();
                    console.log('✅ Recarga completada');
                }}
                editingProduct={editingProducto}
            />
            <AgregarStockModal
                isOpen={showAgregarStockModal}
                onClose={() => {
                    setShowAgregarStockModal(false);
                    setProductoParaStock(null);
                }}
                onSuccess={async () => {
                    console.log('🔄 Recargando productos después de agregar stock...');
                    await fetchProductos();
                    await fetchMetrics();
                    console.log('✅ Recarga completada');
                }}
                producto={productoParaStock}
                productos={getProductosFiltrados()}
            />
        </div>
    );
}
