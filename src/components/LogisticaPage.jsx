import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase.js';
import PedidoModal from './PedidoModal.jsx';
import Icon from './Icon.jsx';
import './Dashboard.css';
import './EquipoCard.css'; // Reutilizar estilos de cards
import './ClientesPage.css'; // Usar los mismos estilos que clientes
import './LogisticaPage.css'; // Estilos específicos para pedidos (mínimos)

// Datos de ejemplo para modo demo (sin Supabase)
const DEMO_PEDIDOS = [
    {
        id: 'demo-p1',
        nombre_pieza: 'SSD 500GB NVMe',
        cantidad: 2,
        estado: 'pendiente',
        fecha_estimada_llegada: new Date().toISOString(),
        created_at: new Date().toISOString(),
        proveedores: { nombre: 'Amazon' },
        equipos: {
            id: 'demo-e1',
            marca: 'Dell',
            modelo: 'Inspiron 15',
            nota: '123',
            cliente_id: null,
            clientes: {
                id: 'demo-c1',
                nombre: 'Juan Pérez',
                telefono: '5512345678',
                email: 'juan@example.com'
            }
        }
    },
    {
        id: 'demo-p2',
        nombre_pieza: 'Teclado Lenovo',
        cantidad: 1,
        estado: 'recibido',
        fecha_estimada_llegada: new Date().toISOString(),
        created_at: new Date().toISOString(),
        proveedores: { nombre: 'Mayorista XYZ' },
        equipos: {
            id: 'demo-e2',
            marca: 'Lenovo',
            modelo: 'IdeaPad 3',
            nota: '140',
            cliente_id: null,
            clientes: {
                id: 'demo-c2',
                nombre: 'Ana López',
                telefono: '5522334455',
                email: 'ana@example.com'
            }
        }
    }
];

export default function LogisticaPage({ demoMode = false }) {
    const [showPedidoModal, setShowPedidoModal] = useState(false);
    const [selectedPedido, setSelectedPedido] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [pedidos, setPedidos] = useState([]);
    const [pedidosRecibidos, setPedidosRecibidos] = useState([]);
    const [activeTab, setActiveTab] = useState('pendientes');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const shouldAdd = searchParams.get('add');
        if (shouldAdd === 'true') {
            navigate('/logistica/nuevo');
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams, navigate]);

    // Detectar si hay un pedido_id en la URL (desde notificación)
    useEffect(() => {
        const pedidoId = searchParams.get('pedido');
        if (pedidoId && pedidos.length > 0) {
            // Buscar el pedido
            const allPedidos = [...pedidos, ...pedidosRecibidos];
            const pedido = allPedidos.find(p => p.id === pedidoId);
            
            if (pedido) {
                // Cambiar a la pestaña correcta según el estado
                if (pedido.estado === 'pendiente') {
                    setActiveTab('pendientes');
                } else {
                    setActiveTab('recibidos');
                }
                // Scroll al pedido (si implementas scroll)
                // Limpiar el parámetro de la URL
                setSearchParams({}, { replace: true });
            }
        }
    }, [searchParams, pedidos, pedidosRecibidos, setSearchParams]);

    useEffect(() => {
        if (demoMode) {
            const pendientes = DEMO_PEDIDOS.filter(p => p.estado === 'pendiente');
            const recibidos = DEMO_PEDIDOS.filter(p => p.estado === 'recibido' || p.estado === 'completado');
            setPedidos(pendientes);
            setPedidosRecibidos(recibidos);
            setLoading(false);
            return;
        }

        fetchPedidos();
    }, [activeTab, demoMode]);

    const fetchPedidos = async () => {
        try {
            if (demoMode) return;
            setLoading(true);
            
            const { data, error } = await supabase
                .from('pedidos_piezas')
                .select(`
                    *,
                    proveedores (
                        nombre
                    ),
                    equipos (
                        id,
                        marca,
                        modelo,
                        nota,
                        cliente_id,
                        clientes (
                            id,
                            nombre,
                            telefono,
                            email
                        )
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Separar por estado
            const pendientes = (data || []).filter(p => p.estado === 'pendiente');
            const recibidos = (data || []).filter(p => p.estado === 'recibido' || p.estado === 'completado');
            
            setPedidos(pendientes);
            setPedidosRecibidos(recibidos);
        } catch (error) {
            console.error('Error fetching pedidos:', error);
        } finally {
            setLoading(false);
        }
    };

    const pedidosActivos = activeTab === 'pendientes' ? pedidos : pedidosRecibidos;

    return (
        <div className="dashboard">
            <nav className="dashboard-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'pendientes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pendientes')}
                >
                    <Icon name="hourglass-half" className="tab-icon" />
                    <span className="tab-text">Pendientes</span>
                    <span className="tab-count">{pedidos.length}</span>
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'recibidos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('recibidos')}
                >
                    <Icon name="check-circle" className="tab-icon" />
                    <span className="tab-text">Recibidos</span>
                    <span className="tab-count">{pedidosRecibidos.length}</span>
                </button>
            </nav>

            <main className="dashboard-content">
                {loading ? (
                    <div className="empty-state">
                        <p>Cargando pedidos...</p>
                    </div>
                ) : pedidosActivos.length > 0 ? (
                    <div className="equipos-grid">
                        {pedidosActivos.map(pedido => {
                            const getInitials = (text) => {
                                if (!text) return '?';
                                const words = text.trim().split(' ');
                                if (words.length >= 2) {
                                    return (words[0][0] + words[1][0]).toUpperCase();
                                }
                                return text.substring(0, 2).toUpperCase();
                            };

                            const formatDate = (dateString) => {
                                if (!dateString) return null;
                                const date = new Date(dateString);
                                return new Intl.DateTimeFormat('es-MX', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                }).format(date);
                            };

                            const formatCurrency = (amount) => {
                                if (!amount) return null;
                                return new Intl.NumberFormat('es-MX', {
                                    style: 'currency',
                                    currency: 'MXN'
                                }).format(amount);
                            };

                            const handleMarcarRecibido = async (e) => {
                                e.stopPropagation();
                                if (demoMode) {
                                    alert('En el modo demo no se modifican pedidos reales. Esto es solo una vista de ejemplo.');
                                    return;
                                }
                                if (!confirm('¿Confirmas que el pedido ha sido recibido?')) {
                                    return;
                                }

                                try {
                                    const { error } = await supabase
                                        .from('pedidos_piezas')
                                        .update({
                                            estado: 'recibido',
                                            updated_at: new Date().toISOString()
                                        })
                                        .eq('id', pedido.id);

                                    if (error) throw error;

                                    // Agregar al historial si existe la tabla comentarios
                                    try {
                                        await supabase
                                            .from('comentarios')
                                            .insert({
                                                modulo: 'logistica',
                                                referencia_id: pedido.id,
                                                mensaje: 'Pedido marcado como recibido'
                                            });
                                    } catch (histError) {
                                        console.error('Error agregando al historial:', histError);
                                    }

                                    alert('Pedido marcado como recibido');
                                    fetchPedidos();
                                } catch (error) {
                                    console.error('Error marcando pedido como recibido:', error);
                                    alert('Error al marcar el pedido como recibido');
                                }
                            };

                            const handleContactarCliente = (e) => {
                                e.stopPropagation();
                                const cliente = pedido.equipos?.clientes;
                                if (!cliente?.telefono) {
                                    alert('No hay teléfono disponible para este cliente');
                                    return;
                                }

                                const mensaje = encodeURIComponent(`Hola ${cliente.nombre}! Te escribo de Zona Asist sobre el pedido de ${pedido.nombre_pieza}. ¡Saludos!`);
                                window.open(`https://wa.me/52${cliente.telefono}?text=${mensaje}`, '_blank');
                            };

                            const handleCardClick = () => {
                                setSelectedPedido(pedido);
                                setShowPedidoModal(true);
                            };

                            return (
                                <div 
                                    key={pedido.id} 
                                    className="cliente-card pedido-card" 
                                    onClick={handleCardClick}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="cliente-card-header pedido-card-header">
                                        <div className="cliente-avatar pedido-avatar">
                                            <Icon name="box" style={{ fontSize: '1.5rem' }} />
                                        </div>
                                        <div className="cliente-info pedido-info">
                                            <h3 className="cliente-nombre pedido-nombre">{pedido.nombre_pieza}</h3>
                                            <div className="cliente-details pedido-details">
                                                {pedido.proveedores?.nombre && (
                                                    <div className="cliente-detail-item">
                                                        <div className="cliente-detail-icon">
                                                            <Icon name="truck" />
                                                        </div>
                                                        <span className="cliente-detail-text">{pedido.proveedores.nombre}</span>
                                                    </div>
                                                )}
                                                {pedido.cantidad && (
                                                    <div className="cliente-detail-item">
                                                        <div className="cliente-detail-icon">
                                                            <Icon name="cube" />
                                            </div>
                                                        <span className="cliente-detail-text">Cantidad: {pedido.cantidad}</span>
                                                </div>
                                            )}
                                                {pedido.fecha_estimada_llegada && (
                                                    <div className="cliente-detail-item">
                                                        <div className="cliente-detail-icon">
                                                            <Icon name="calendar-alt" />
                                                        </div>
                                                        <span className="cliente-detail-text">{formatDate(pedido.fecha_estimada_llegada)}</span>
                                                </div>
                                            )}
                                            </div>
                                        </div>
                                                </div>
                                    {pedido.estado === 'pendiente' || pedido.equipos?.clientes?.telefono ? (
                                        <div className="cliente-actions pedido-actions" onClick={(e) => e.stopPropagation()}>
                                            {pedido.estado === 'pendiente' && (
                                                <button
                                                    className="cliente-action-btn pedido-action-btn"
                                                    onClick={handleMarcarRecibido}
                                                >
                                                    <Icon name="check-circle" />
                                                    Marcar Recibido
                                                </button>
                                            )}
                                            {pedido.equipos?.clientes?.telefono && (
                                                <button
                                                    className="cliente-action-btn pedido-action-btn"
                                                    onClick={handleContactarCliente}
                                                >
                                                    <Icon name="phone" />
                                                    Contactar
                                                </button>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <Icon name="shipping-fast" />
                        </div>
                        <h3>No hay pedidos {activeTab}</h3>
                        <p>Agrega un nuevo pedido para comenzar</p>
                    </div>
                )}
            </main>

            {!demoMode && (
                <button
                    className="add-equipo-fab"
                    onClick={() => navigate('/logistica/nuevo')}
                    title="Agregar nuevo pedido"
                >
                    <Icon name="plus" />
                </button>
            )}

            {showPedidoModal && selectedPedido && (
                <PedidoModal
                    pedido={selectedPedido}
                    onClose={() => {
                        setShowPedidoModal(false);
                        setSelectedPedido(null);
                    }}
                    onPedidoUpdated={() => {
                        fetchPedidos();
                    }}
                />
            )}
        </div>
    );
}

