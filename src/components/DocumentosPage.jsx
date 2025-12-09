import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AddDocumentoModal from './AddDocumentoModal.jsx';
import DocumentoModal from './DocumentoModal.jsx';
import Icon from './Icon.jsx';
import './Dashboard.css'; // Reutilizar estilos similares
import './EquipoCard.css'; // Reutilizar estilos de cards
import './DocumentosPage.css'; // Estilos específicos para documentos

export default function DocumentosPage() {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDocumentoModal, setShowDocumentoModal] = useState(false);
    const [selectedDocumento, setSelectedDocumento] = useState(null);
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

    // Detectar si hay un documento_id en la URL (desde notificación)
    useEffect(() => {
        const documentoId = searchParams.get('documento');
        if (documentoId && documentos.length > 0) {
            // Buscar el documento
            const allDocumentos = [...documentos, ...documentosCompletados];
            const documento = allDocumentos.find(d => d.id === documentoId);
            
            if (documento) {
                // Cambiar a la pestaña correcta según el estado
                if (documento.estado === 'pendiente') {
                    setActiveTab('pendientes');
                } else {
                    setActiveTab('completados');
                }
                // Scroll al documento (si implementas scroll)
                // Limpiar el parámetro de la URL
                setSearchParams({}, { replace: true });
            }
        }
    }, [searchParams, documentos, documentosCompletados, setSearchParams]);

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
                        id,
                        nombre,
                        telefono,
                        email
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
                        {documentosActivos.map(doc => {
                            const getInitials = (text) => {
                                if (!text) return '?';
                                const words = text.trim().split(' ');
                                if (words.length >= 2) {
                                    return (words[0][0] + words[1][0]).toUpperCase();
                                }
                                return text.substring(0, 2).toUpperCase();
                            };

                            const getTipoServicioLabel = (tipo) => {
                                const tipos = {
                                    'transcripcion': 'Transcripción',
                                    'factura': 'Factura',
                                    'cotizacion': 'Cotización'
                                };
                                return tipos[tipo] || tipo.charAt(0).toUpperCase() + tipo.slice(1);
                            };

                            const getTipoIcon = (tipo) => {
                                const icons = {
                                    'transcripcion': 'file-alt',
                                    'factura': 'file-invoice',
                                    'cotizacion': 'file-contract'
                                };
                                return icons[tipo] || 'file-alt';
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

                            const handleMarcarCompletado = async (e) => {
                                e.stopPropagation();
                                if (!confirm('¿Confirmas que el documento ha sido completado?')) {
                                    return;
                                }

                                try {
                                    const { error } = await supabase
                                        .from('servicios_documentos')
                                        .update({
                                            estado: 'completado',
                                            fecha_entrega: new Date().toISOString(),
                                            updated_at: new Date().toISOString()
                                        })
                                        .eq('id', doc.id);

                                    if (error) throw error;

                                    try {
                                        await supabase
                                            .from('comentarios')
                                            .insert({
                                                modulo: 'documentos',
                                                referencia_id: doc.id,
                                                mensaje: 'Documento marcado como completado'
                                            });
                                    } catch (histError) {
                                        console.error('Error agregando al historial:', histError);
                                    }

                                    alert('Documento marcado como completado');
                                    fetchDocumentos();
                                } catch (error) {
                                    console.error('Error marcando documento como completado:', error);
                                    alert('Error al marcar el documento como completado');
                                }
                            };

                            const handleContactarCliente = (e) => {
                                e.stopPropagation();
                                const cliente = doc.clientes;
                                if (!cliente?.telefono) {
                                    alert('No hay teléfono disponible para este cliente');
                                    return;
                                }

                                const mensaje = encodeURIComponent(`Hola ${cliente.nombre}! Te escribo de Zona Asist sobre el documento de ${getTipoServicioLabel(doc.tipo_servicio)}. ¡Saludos!`);
                                window.open(`https://wa.me/52${cliente.telefono}?text=${mensaje}`, '_blank');
                            };

                            const handleCardClick = () => {
                                setSelectedDocumento(doc);
                                setShowDocumentoModal(true);
                            };

                            return (
                                <div 
                                    key={doc.id} 
                                    className="card documento-card" 
                                    onClick={handleCardClick}
                                >
                                    <div className="equipo-card-header">
                                        <div className="equipo-avatar documento-avatar" style={{ background: 'linear-gradient(135deg, #10b981, rgba(16, 185, 129, 0.6))' }}>
                                            <Icon name={getTipoIcon(doc.tipo_servicio)} style={{ fontSize: '1.25rem' }} />
                                        </div>
                                        <div className="equipo-info">
                                            <div className="equipo-title-row">
                                                <h3 className="equipo-marca">{getTipoServicioLabel(doc.tipo_servicio)}</h3>
                                                {doc.estado === 'completado' ? (
                                                    <span className="documento-badge completado">
                                                        <Icon name="check-circle" />
                                                        Completado
                                                    </span>
                                                ) : (
                                                    <span className="documento-badge pendiente">
                                                        <Icon name="clock" />
                                                        Pendiente
                                                    </span>
                                                )}
                                            </div>
                                            {doc.clientes?.nombre && (
                                                <div className="documento-cliente-info">
                                                    <Icon name="user" className="documento-info-icon" />
                                                    <span>{doc.clientes.nombre}</span>
                                                </div>
                                            )}
                                            {doc.descripcion && (
                                                <div className="documento-descripcion">
                                                    <Icon name="align-left" className="documento-info-icon" />
                                                    <span>{doc.descripcion.length > 50 ? doc.descripcion.substring(0, 50) + '...' : doc.descripcion}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="equipo-card-content">
                                        <div className="documento-dates">
                                            {doc.fecha_inicio && (
                                                <div className="documento-date-item">
                                                    <Icon name="calendar-alt" className="documento-date-icon" />
                                                    <div className="documento-date-content">
                                                        <span className="documento-date-label">Inicio</span>
                                                        <span className="documento-date-value">{formatDate(doc.fecha_inicio)}</span>
                                                    </div>
                                                </div>
                                            )}
                                            {doc.fecha_entrega && (
                                                <div className="documento-date-item">
                                                    <Icon name="calendar-check" className="documento-date-icon" />
                                                    <div className="documento-date-content">
                                                        <span className="documento-date-label">Entrega</span>
                                                        <span className="documento-date-value">{formatDate(doc.fecha_entrega)}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="documento-actions">
                                            {doc.estado === 'pendiente' && (
                                                <button
                                                    className="documento-action-btn completado"
                                                    onClick={handleMarcarCompletado}
                                                >
                                                    <Icon name="check-circle" />
                                                    Marcar Completado
                                                </button>
                                            )}
                                            {doc.clientes?.telefono && (
                                                <button
                                                    className="documento-action-btn contactar"
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

            {showDocumentoModal && selectedDocumento && (
                <DocumentoModal
                    documento={selectedDocumento}
                    onClose={() => {
                        setShowDocumentoModal(false);
                        setSelectedDocumento(null);
                    }}
                    onDocumentoUpdated={() => {
                        fetchDocumentos();
                    }}
                />
            )}
        </div>
    );
}

