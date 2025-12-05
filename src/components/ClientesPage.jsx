import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AddClienteModal from './AddClienteModal.jsx';
import Icon from './Icon.jsx';
import './Dashboard.css';

export default function ClientesPage() {
    const [showAddModal, setShowAddModal] = useState(false);
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
        fetchClientes();
    }, []);

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

    if (loading) {
        return (
            <div className="dashboard">
                <div className="empty-state">
                    <div className="loading-spinner"></div>
                    <p>Cargando clientes...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <nav className="dashboard-tabs">
                <button className="tab-btn active">
                    <Icon name="users" className="tab-icon" />
                    <span className="tab-text">Todos</span>
                    <span className="tab-count">{clientes.length}</span>
                </button>
            </nav>

            <main className="dashboard-content">
                {clientes.length > 0 ? (
                    <div className="equipos-grid">
                        {clientes.map(cliente => (
                            <div key={cliente.id} className="card" style={{ cursor: 'default' }}>
                                <div className="card_title">
                                    <span style={{ fontSize: '2em' }}>{cliente.nombre}</span>
                                    <br />
                                    {cliente.telefono && (
                                        <span style={{ fontSize: '1.2em', color: 'var(--primary)' }}>
                                            {cliente.telefono}
                                        </span>
                                    )}
                                    {cliente.email && (
                                        <>
                                            <br />
                                            <span style={{ fontSize: '0.9em', color: 'var(--gray-600)' }}>
                                                {cliente.email}
                                            </span>
                                        </>
                                    )}
                                </div>
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
                    </div>
                )}
            </main>

            <button
                className="add-equipo-fab"
                onClick={() => setShowAddModal(true)}
                title="Agregar nuevo cliente"
            >
                <Icon name="plus" />
            </button>

            {showAddModal && (
                <AddClienteModal
                    onClose={() => setShowAddModal(false)}
                    onClienteAdded={() => {
                        fetchClientes();
                        setShowAddModal(false);
                    }}
                />
            )}
        </div>
    );
}

