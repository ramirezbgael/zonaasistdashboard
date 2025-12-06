import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AddPedidoModal from './AddPedidoModal.jsx';
import Icon from './Icon.jsx';
import './Dashboard.css';

export default function LogisticaPage() {
    const [showAddModal, setShowAddModal] = useState(false);
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
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Separar por estado
            const pendientes = (data || []).filter(p => p.estado === 'pendiente');
            const recibidos = (data || []).filter(p => p.estado === 'recibido' || p.estado === 'completado');
            
            setPedidos(pendientes);
            setPedidosRecibidos(recibidos);

            if (error) throw error;

            if (activeTab === 'pendientes') {
                setPedidos(data || []);
            } else {
                setPedidosRecibidos(data || []);
            }
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
                        {pedidosActivos.map(pedido => (
                            <div key={pedido.id} className="card" style={{ cursor: 'default' }}>
                                <div className="card_list">
                                    <div className="card_title">
                                        <span className="card-marca">{pedido.nombre_pieza}</span>
                                        <span className="card-modelo">
                                            {pedido.proveedores?.nombre || 'Sin proveedor'}
                                        </span>
                                    </div>
                                    <li className="card__list_item">
                                        Cantidad: {pedido.cantidad}
                                    </li>
                                    {pedido.fecha_estimada_llegada && (
                                        <li className="card__list_item">
                                            Llegada estimada: {new Date(pedido.fecha_estimada_llegada).toLocaleDateString()}
                                        </li>
                                    )}
                                </div>
                            </div>
                        ))}
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
        </div>
    );
}

