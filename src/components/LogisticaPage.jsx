import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AddPedidoModal from './AddPedidoModal.jsx';
import Icon from './Icon.jsx';
import './Dashboard.css';

export default function LogisticaPage() {
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const shouldAdd = searchParams.get('add');
        if (shouldAdd === 'true') {
            setShowAddModal(true);
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    return (
        <div className="dashboard">
            <nav className="dashboard-tabs">
                <button className="tab-btn active">
                    <Icon name="hourglass-half" className="tab-icon" />
                    <span className="tab-text">Pendientes</span>
                    <span className="tab-count">0</span>
                </button>
                <button className="tab-btn">
                    <Icon name="check-circle" className="tab-icon" />
                    <span className="tab-text">Recibidos</span>
                    <span className="tab-count">0</span>
                </button>
            </nav>

            <main className="dashboard-content">
                <div className="empty-state">
                    <div className="empty-icon">
                        <Icon name="shipping-fast" />
                    </div>
                    <h3>No hay pedidos pendientes</h3>
                    <p>Agrega un nuevo pedido para comenzar</p>
                </div>
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
                    }}
                />
            )}
        </div>
    );
}

