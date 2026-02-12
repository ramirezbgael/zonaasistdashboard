import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase.js';
import DocumentoModal from './DocumentoModal.jsx';
import Icon from './Icon.jsx';
import './Dashboard.css'; // Reutilizar estilos similares
import './ClientesPage.css'; // Usar los mismos estilos que clientes
import './DocumentosPage.css'; // Estilos específicos para documentos (mínimos)

// Función helper para obtener nombre de usuario
const obtenerNombreUsuario = async (userId) => {
    if (!userId) return null;
    
    try {
        // Intentar obtener desde el usuario actual si coincide
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id === userId) {
            return user.user_metadata?.nombre || 
                   user.user_metadata?.full_name || 
                   user.email?.split('@')[0] || 
                   null;
        }
        
        // Si no es el usuario actual, intentar obtener desde una función RPC o tabla de usuarios
        // Por ahora, retornar null y se puede mejorar después
        return null;
    } catch (error) {
        console.error('Error obteniendo nombre de usuario:', error);
        return null;
    }
};

// Datos de ejemplo para modo demo (sin Supabase)
const DEMO_DOCUMENTOS = [
    {
        id: 'demo-d1',
        tipo_servicio: 'transcripcion',
        descripcion: 'Conferencia marketing 2h',
        precio: 650,
        estado: 'pendiente',
        fecha_inicio: new Date().toISOString(),
        created_at: new Date().toISOString(),
        asignado_a: null,
        usuarioAsignado: 'Tú (demo)',
        clientes: {
            id: 'demo-c1',
            nombre: 'Universidad X',
            telefono: '5511122233',
            email: 'contacto@universidadx.mx'
        }
    },
    {
        id: 'demo-d2',
        tipo_servicio: 'factura',
        descripcion: 'Factura servicios de impresión',
        precio: 320,
        estado: 'pendiente',
        fecha_inicio: new Date().toISOString(),
        created_at: new Date().toISOString(),
        asignado_a: null,
        usuarioAsignado: 'Tú (demo)',
        clientes: {
            id: 'demo-c2',
            nombre: 'Empresa ABC',
            telefono: '5544455566',
            email: 'facturacion@empresaabc.com'
        }
    },
    {
        id: 'demo-d3',
        tipo_servicio: 'transcripcion',
        descripcion: 'Podcast episodio 10',
        precio: 500,
        estado: 'completado',
        fecha_inicio: new Date().toISOString(),
        created_at: new Date().toISOString(),
        asignado_a: null,
        usuarioAsignado: 'Tú (demo)',
        clientes: {
            id: 'demo-c3',
            nombre: 'Cliente frecuente',
            telefono: '5577788899',
            email: 'cliente@ejemplo.com'
        }
    }
];

export default function DocumentosPage({ demoMode = false }) {
    const [showDocumentoModal, setShowDocumentoModal] = useState(false);
    const [selectedDocumento, setSelectedDocumento] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [documentos, setDocumentos] = useState([]);
    const [documentosCompletados, setDocumentosCompletados] = useState([]);
    const [activeTab, setActiveTab] = useState('pendientes');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Detectar si viene del dashboard principal para crear (antes abría modal)
    useEffect(() => {
        const shouldAdd = searchParams.get('add');
        if (shouldAdd === 'true') {
            navigate('/documentos/nuevo');
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams, navigate]);

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
        if (demoMode) {
            // En modo demo usar datos estáticos y no tocar Supabase
            const pendientes = DEMO_DOCUMENTOS.filter(d => d.estado === 'pendiente');
            const completados = DEMO_DOCUMENTOS.filter(d => d.estado === 'completado');
            setDocumentos(pendientes);
            setDocumentosCompletados(completados);
            setLoading(false);
            return;
        }

        fetchDocumentos();
    }, [activeTab, demoMode]);

    const fetchDocumentos = async () => {
        try {
            if (demoMode) return;
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
            
            // Obtener información de usuarios asignados
            if (data && data.length > 0) {
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                
                // Agregar información de usuario a cada documento
                for (const doc of data) {
                    if (doc.asignado_a) {
                        // Si es el usuario actual, usar su información
                        if (currentUser?.id === doc.asignado_a) {
                            doc.usuarioAsignado = currentUser.user_metadata?.nombre || 
                                                  currentUser.user_metadata?.full_name || 
                                                  currentUser.email?.split('@')[0] || 
                                                  'Usuario';
                        } else {
                            // Para otros usuarios, intentar obtener desde metadata o usar placeholder
                            // Nota: En producción, esto requeriría una tabla de usuarios o función RPC
                            doc.usuarioAsignado = await obtenerNombreUsuario(doc.asignado_a);
                        }
                    }
                }
            }

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
                                if (demoMode) {
                                    alert('En el modo demo no se modifican documentos reales. Esto es solo una vista de ejemplo.');
                                    return;
                                }
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
                                    className="cliente-card documento-card" 
                                    onClick={handleCardClick}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="cliente-card-header documento-card-header">
                                        <div className="cliente-avatar documento-avatar">
                                            <Icon name={getTipoIcon(doc.tipo_servicio)} style={{ fontSize: '1.5rem' }} />
                                        </div>
                                        <div className="cliente-info documento-info">
                                            <h3 className="cliente-nombre documento-nombre">{getTipoServicioLabel(doc.tipo_servicio)}</h3>
                                            <div className="cliente-details documento-details">
                                                {doc.usuarioAsignado && (
                                                    <div className="cliente-detail-item">
                                                        <div className="cliente-detail-icon">
                                                            <Icon name="user" />
                                                        </div>
                                                        <span className="cliente-detail-text">{doc.usuarioAsignado}</span>
                                                    </div>
                                                )}
                                                {doc.clientes?.nombre && (
                                                    <div className="cliente-detail-item">
                                                        <div className="cliente-detail-icon">
                                                            <Icon name="users" />
                                                        </div>
                                                        <span className="cliente-detail-text">{doc.clientes.nombre}</span>
                                                    </div>
                                                )}
                                                {doc.tipo_servicio === 'transcripcion' && doc.precio && (
                                                    <div className="cliente-detail-item">
                                                        <div className="cliente-detail-icon">
                                                            <Icon name="dollar-sign" />
                                                        </div>
                                                        <span className="cliente-detail-text">Precio: ${parseFloat(doc.precio).toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {(doc.fecha_inicio || doc.created_at) && (
                                                    <div className="cliente-detail-item">
                                                        <div className="cliente-detail-icon">
                                                            <Icon name="calendar-alt" />
                                                        </div>
                                                        <span className="cliente-detail-text">{formatDate(doc.fecha_inicio || doc.created_at)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {(doc.estado === 'pendiente' || doc.clientes?.telefono) && (
                                        <div className="cliente-actions documento-actions" onClick={(e) => e.stopPropagation()}>
                                            {doc.estado === 'pendiente' && (
                                                <button
                                                    className="cliente-action-btn documento-action-btn"
                                                    onClick={handleMarcarCompletado}
                                                >
                                                    <Icon name="check-circle" />
                                                    Marcar Completado
                                                </button>
                                            )}
                                            {doc.clientes?.telefono && (
                                                <button
                                                    className="cliente-action-btn documento-action-btn"
                                                    onClick={handleContactarCliente}
                                                >
                                                    <Icon name="phone" />
                                                    Contactar
                                                </button>
                                            )}
                                        </div>
                                    )}
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
                onClick={() => navigate('/documentos/nuevo')}
                title="Agregar nuevo documento"
            >
                <Icon name="plus" />
            </button>

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

