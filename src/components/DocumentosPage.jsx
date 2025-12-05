import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AddDocumentoModal from './AddDocumentoModal.jsx';
import Icon from './Icon.jsx';
import './Dashboard.css'; // Reutilizar estilos similares

export default function DocumentosPage() {
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // Detectar si viene del dashboard principal para abrir el modal
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
                    <span className="tab-text">Completados</span>
                    <span className="tab-count">0</span>
                </button>
            </nav>

            <main className="dashboard-content">
                <div className="empty-state">
                    <div className="empty-icon">
                        <Icon name="file-alt" />
                    </div>
                    <h3>No hay documentos pendientes</h3>
                    <p>Agrega un nuevo documento para comenzar</p>
                </div>
            </main>

            <button
                className="add-equipo-fab"
                onClick={() => setShowAddModal(true)}
                title="Agregar nuevo documento"
            >
                <Icon name="plus" />
            </button>

            {showAddModal && (
                <AddDocumentoModal
                    onClose={() => setShowAddModal(false)}
                    onDocumentoAdded={() => {
                        setShowAddModal(false);
                        // Recargar datos aquí cuando esté implementado
                    }}
                />
            )}
        </div>
    );
}

