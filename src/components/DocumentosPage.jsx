import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AddDocumentoModal from './AddDocumentoModal.jsx';
import Icon from './Icon.jsx';
import './Dashboard.css'; // Reutilizar estilos similares

export default function DocumentosPage() {
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const [documentos, setDocumentos] = useState([]);
    const [documentosCompletados, setDocumentosCompletados] = useState([]);
    const [activeTab, setActiveTab] = useState('pendientes');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Detectar si viene del dashboard principal para abrir el modal
    useEffect(() => {
        const shouldAdd = searchParams.get('add');
        if (shouldAdd === 'true') {
            setShowAddModal(true);
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        fetchDocumentos();
    }, [activeTab]);

    const fetchDocumentos = async () => {
        try {
            setLoading(true);
            
            const { data, error } = await supabase
                .from('servicios_documentos')
                .select(`
                    *,
                    clientes (
                        nombre,
                        telefono
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Separar por estado
            const pendientes = (data || []).filter(d => d.estado === 'pendiente');
            const completados = (data || []).filter(d => d.estado === 'completado');
            
            setDocumentos(pendientes);
            setDocumentosCompletados(completados);
        } catch (error) {
            console.error('Error fetching documentos:', error);
        } finally {
            setLoading(false);
        }
    };

    const documentosActivos = activeTab === 'pendientes' ? documentos : documentosCompletados;

    return (
        <div className="dashboard">
            <nav className="dashboard-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'pendientes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pendientes')}
                >
                    <Icon name="hourglass-half" className="tab-icon" />
                    <span className="tab-text">Pendientes</span>
                    <span className="tab-count">{documentos.length}</span>
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'completados' ? 'active' : ''}`}
                    onClick={() => setActiveTab('completados')}
                >
                    <Icon name="check-circle" className="tab-icon" />
                    <span className="tab-text">Completados</span>
                    <span className="tab-count">{documentosCompletados.length}</span>
                </button>
            </nav>

            <main className="dashboard-content">
                {loading ? (
                    <div className="empty-state">
                        <p>Cargando documentos...</p>
                    </div>
                ) : documentosActivos.length > 0 ? (
                    <div className="equipos-grid">
                        {documentosActivos.map(doc => (
                            <div key={doc.id} className="card" style={{ cursor: 'default' }}>
                                <div className="card_list">
                                    <div className="card_title">
                                        <span className="card-marca">{doc.tipo_servicio}</span>
                                        <span className="card-modelo">
                                            {doc.clientes?.nombre || 'Sin cliente'}
                                        </span>
                                    </div>
                                    {doc.descripcion && (
                                        <li className="card__list_item">
                                            {doc.descripcion}
                                        </li>
                                    )}
                                    {doc.fecha_entrega && (
                                        <li className="card__list_item">
                                            Entrega: {new Date(doc.fecha_entrega).toLocaleDateString()}
                                        </li>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <Icon name="file-alt" />
                        </div>
                        <h3>No hay documentos {activeTab}</h3>
                        <p>Agrega un nuevo documento para comenzar</p>
                    </div>
                )}
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
                        fetchDocumentos();
                    }}
                />
            )}
        </div>
    );
}

