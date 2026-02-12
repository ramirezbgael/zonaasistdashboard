import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AddClienteModal from './AddClienteModal.jsx';
import ClienteHistorialModal from './ClienteHistorialModal.jsx';
import Icon from './Icon.jsx';
import './ClientesPage.css';

// Datos de ejemplo para modo demo (sin Supabase)
const DEMO_CLIENTES = [
    {
        id: 'demo-c1',
        nombre: 'Juan Pérez',
        telefono: '5512345678',
        email: 'juan@example.com'
    },
    {
        id: 'demo-c2',
        nombre: 'Ana López',
        telefono: '5522334455',
        email: 'ana@example.com'
    },
    {
        id: 'demo-c3',
        nombre: 'Empresa XYZ',
        telefono: '5544556677',
        email: 'contacto@empresa-xyz.com'
    }
];

export default function ClientesPage({ demoMode = false }) {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showHistorialModal, setShowHistorialModal] = useState(false);
    const [selectedCliente, setSelectedCliente] = useState(null);
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const shouldAdd = searchParams.get('add');
        if (shouldAdd === 'true') {
            setShowAddModal(true);
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        if (demoMode) {
            setClientes(DEMO_CLIENTES);
            setLoading(false);
            return;
        }

        fetchClientes();
    }, [demoMode]);

    const fetchClientes = async () => {
        try {
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .order('nombre');

            if (error) throw error;
            setClientes(data || []);
        } catch (error) {
            console.error('Error fetching clientes:', error);
        } finally {
            setLoading(false);
        }
    };

    const getInitials = (nombre) => {
        if (!nombre) return '?';
        const words = nombre.trim().split(' ');
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return nombre.substring(0, 2).toUpperCase();
    };

    const handleWhatsApp = (telefono) => {
        if (!telefono) return;
        const cleanPhone = telefono.replace(/\D/g, '');
        const whatsappUrl = `https://wa.me/${cleanPhone}`;
        window.open(whatsappUrl, '_blank');
    };

    const handleCall = (telefono) => {
        if (!telefono) return;
        window.location.href = `tel:${telefono}`;
    };

    if (loading) {
        return (
            <div className="clientes-page">
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Cargando clientes...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="clientes-page">
            <div className="clientes-header">
                <h1>Clientes</h1>
                <div className="clientes-stats">
                    <span className="clientes-count-badge">
                        <Icon name="users" />
                        {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}
                    </span>
                </div>
            </div>

            {clientes.length > 0 ? (
                <div className="clientes-grid">
                    {clientes.map(cliente => (
                        <div 
                            key={cliente.id} 
                            className="cliente-card"
                            onClick={() => {
                                if (demoMode) {
                                    alert('En el modo demo esta tarjeta solo es ilustrativa, no abre el historial real.');
                                    return;
                                }
                                setSelectedCliente(cliente);
                                setShowHistorialModal(true);
                            }}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="cliente-card-header">
                                <div className="cliente-avatar">
                                    {getInitials(cliente.nombre)}
                                </div>
                                <div className="cliente-info">
                                    <h3 className="cliente-nombre">{cliente.nombre}</h3>
                                    <div className="cliente-details">
                                        {cliente.telefono && (
                                            <div className="cliente-detail-item">
                                                <div className="cliente-detail-icon">
                                                    <Icon name="phone" />
                                                </div>
                                                <span className="cliente-detail-text">{cliente.telefono}</span>
                                            </div>
                                        )}
                                        {cliente.email && (
                                            <div className="cliente-detail-item">
                                                <div className="cliente-detail-icon">
                                                    <Icon name="envelope" />
                                                </div>
                                                <span className="cliente-detail-text">{cliente.email}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {cliente.telefono && (
                                <div className="cliente-actions" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        className="cliente-action-btn whatsapp"
                                        onClick={() => handleWhatsApp(cliente.telefono)}
                                        title="Enviar WhatsApp"
                                    >
                                        <Icon name="comment-dots" />
                                        WhatsApp
                                    </button>
                                    <button
                                        className="cliente-action-btn call"
                                        onClick={() => handleCall(cliente.telefono)}
                                        title="Llamar"
                                    >
                                        <Icon name="phone" />
                                        Llamar
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-icon">
                        <Icon name="users" />
                    </div>
                    <h3>No hay clientes registrados</h3>
                    <p>Agrega un nuevo cliente para comenzar</p>
                    <button
                        className="btn-primary"
                        onClick={() => setShowAddModal(true)}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'var(--primary-color, rgba(16, 185, 129, 0.3))',
                            border: '1px solid var(--primary-color, rgba(16, 185, 129, 0.5))',
                            borderRadius: 'var(--radius-md, 8px)',
                            color: '#ffffff',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.9375rem',
                            fontWeight: '500'
                        }}
                    >
                        <Icon name="plus" />
                        Agregar Cliente
                    </button>
                </div>
            )}

            {!demoMode && (
                <button
                    className="add-cliente-fab"
                    onClick={() => setShowAddModal(true)}
                    title="Agregar nuevo cliente"
                    aria-label="Agregar nuevo cliente"
                >
                    <Icon name="plus" />
                </button>
            )}

            {!demoMode && showAddModal && (
                <AddClienteModal
                    onClose={() => setShowAddModal(false)}
                    onClienteAdded={() => {
                        fetchClientes();
                        setShowAddModal(false);
                    }}
                />
            )}

            {showHistorialModal && selectedCliente && (
                <ClienteHistorialModal
                    cliente={selectedCliente}
                    onClose={() => {
                        setShowHistorialModal(false);
                        setSelectedCliente(null);
                    }}
                />
            )}
        </div>
    );
}

