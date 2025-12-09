import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AddPedidoModal from './AddPedidoModal.jsx';
import PedidoModal from './PedidoModal.jsx';
import Icon from './Icon.jsx';
import './Dashboard.css';
import './EquipoCard.css'; // Reutilizar estilos de cards
import './LogisticaPage.css'; // Estilos específicos para pedidos

export default function LogisticaPage() {
    const [showAddModal, setShowAddModal] = useState(false);
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
            setShowAddModal(true);
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams]);

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
        fetchPedidos();
    }, [activeTab]);

    const fetchPedidos = async () => {
        try {
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
                                    className="card pedido-card" 
                                    onClick={handleCardClick}
                                >
                                    <div className="equipo-card-header">
                                        <div className="equipo-avatar pedido-avatar" style={{ background: 'linear-gradient(135deg, #10b981, rgba(16, 185, 129, 0.6))' }}>
                                            <Icon name="box" style={{ fontSize: '1.25rem' }} />
                                        </div>
                                        <div className="equipo-info">
                                            <div className="equipo-title-row">
                                                <h3 className="equipo-marca">{pedido.nombre_pieza}</h3>
                                                {pedido.estado === 'recibido' || pedido.estado === 'completado' ? (
                                                    <span className="pedido-badge recibido">
                                                        <Icon name="check-circle" />
                                                        Recibido
                                                    </span>
                                                ) : (
                                                    <span className="pedido-badge pendiente">
                                                        <Icon name="clock" />
                                                        Pendiente
                                                    </span>
                                                )}
                                            </div>
                                            {pedido.proveedores?.nombre && (
                                                <div className="pedido-proveedor-info">
                                                    <Icon name="truck" className="pedido-info-icon" />
                                                    <span>{pedido.proveedores.nombre}</span>
                                                </div>
                                            )}
                                            {pedido.numero_parte && (
                                                <div className="pedido-parte-info">
                                                    <Icon name="barcode" className="pedido-info-icon" />
                                                    <span>{pedido.numero_parte}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="equipo-card-content">
                                        <div className="pedido-details">
                                            <div className="pedido-detail-item">
                                                <Icon name="cube" className="pedido-detail-icon" />
                                                <div className="pedido-detail-content">
                                                    <span className="pedido-detail-label">Cantidad</span>
                                                    <span className="pedido-detail-value">{pedido.cantidad}</span>
                                                </div>
                                            </div>
                                            {pedido.precio_unitario && (
                                                <div className="pedido-detail-item">
                                                    <Icon name="dollar-sign" className="pedido-detail-icon" />
                                                    <div className="pedido-detail-content">
                                                        <span className="pedido-detail-label">Precio unitario</span>
                                                        <span className="pedido-detail-value">{formatCurrency(pedido.precio_unitario)}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {pedido.fecha_estimada_llegada && (
                                            <div className="pedido-fecha-estimada">
                                                <Icon name="calendar-alt" className="pedido-fecha-icon" />
                                                <div className="pedido-fecha-content">
                                                    <span className="pedido-fecha-label">Llegada estimada</span>
                                                    <span className="pedido-fecha-value">{formatDate(pedido.fecha_estimada_llegada)}</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="pedido-actions">
                                            {pedido.estado === 'pendiente' && (
                                                <button
                                                    className="pedido-action-btn recibido"
                                                    onClick={handleMarcarRecibido}
                                                >
                                                    <Icon name="check-circle" />
                                                    Marcar Recibido
                                                </button>
                                            )}
                                            {pedido.equipos?.clientes?.telefono && (
                                                <button
                                                    className="pedido-action-btn contactar"
                                                    onClick={handleContactarCliente}
                                                >
                                                    <Icon name="phone" />
                                                    Contactar
                                                </button>
                                            )}
                                        </div>
                                    </div>
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

            <button
                className="add-equipo-fab"
                onClick={() => setShowAddModal(true)}
                title="Agregar nuevo pedido"
            >
                <Icon name="plus" />
            </button>

            {showAddModal && (
                <AddPedidoModal
                    onClose={() => setShowAddModal(false)}
                    onPedidoAdded={() => {
                        setShowAddModal(false);
                        fetchPedidos();
                    }}
                />
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

