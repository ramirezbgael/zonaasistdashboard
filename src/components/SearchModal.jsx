import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import './SearchModal.css';

export default function SearchModal({ isOpen = true, onClose, initialQuery = '', onQueryChange }) {
    const [query, setQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState(null);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchType, setSearchType] = useState('all'); // 'all', 'equipos', 'clientes', 'documentos', 'pedidos'
    const inputRef = useRef(null);
    const navigate = useNavigate();

    const filters = [
        { id: 'atrasados', label: 'Atrasados', labelShort: 'Atras.', icon: 'exclamation-triangle', color: '#ef4444' },
        { id: 'listos', label: 'Listos', labelShort: 'Listos', icon: 'check-circle', color: '#10b981' },
        { id: 'sin_presupuesto', label: 'Sin Presupuesto', labelShort: 'Sin Presup.', icon: 'file-invoice', color: '#f59e0b' },
        { id: 'hoy', label: 'Hoy', labelShort: 'Hoy', icon: 'calendar-alt', color: '#3b82f6' }
    ];

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        // Si el modal se abre desde la TopBar con texto ya escrito, precargarlo.
        setQuery((prev) => (prev && prev.trim() ? prev : (initialQuery || '')));
    }, [isOpen, initialQuery]);

    useEffect(() => {
        if (!isOpen) return;
        onQueryChange?.(query);
    }, [isOpen, query, onQueryChange]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                // Toggle search modal
            }
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setActiveFilter(null);
            setResults([]);
            return;
        }

        const searchTimeout = setTimeout(() => {
            if (query.trim() || activeFilter) {
                performSearch();
            } else {
                setResults([]);
            }
        }, 300);

        return () => clearTimeout(searchTimeout);
    }, [query, activeFilter, searchType, isOpen]);

    const performSearch = async () => {
        setLoading(true);
        try {
            const searchResults = [];

            // Búsqueda en equipos
            if (searchType === 'all' || searchType === 'equipos') {
                // Primero obtener todos los equipos
                let equiposQuery = supabase
                    .from('equipos')
                    .select(`
                        id,
                        nota,
                        marca,
                        modelo,
                        problema,
                        color,
                        created_at,
                        cliente_id,
                        clientes (
                            id,
                            nombre,
                            telefono
                        )
                    `);

                if (activeFilter === 'hoy') {
                    const hoy = new Date();
                    hoy.setHours(0, 0, 0, 0);
                    equiposQuery = equiposQuery.gte('created_at', hoy.toISOString());
                }

                const { data: equipos, error: equiposError } = await equiposQuery;

                if (!equiposError && equipos) {
                    // Obtener estados de equipos por separado
                    const equiposConEstado = await Promise.all(
                        equipos.map(async (equipo) => {
                            const { data: estadoData } = await supabase
                                .from('estado_equipos')
                                .select('estado, updated_at')
                                .eq('equipo_id', equipo.id)
                                .order('updated_at', { ascending: false })
                                .limit(1)
                                .maybeSingle();

                            return {
                                ...equipo,
                                estado_equipos: estadoData ? [estadoData] : []
                            };
                        })
                    );

                    // Aplicar filtros de estado
                    let equiposFiltrados = equiposConEstado;
                    if (activeFilter === 'atrasados') {
                        const tresDiasAtras = new Date();
                        tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);
                        equiposFiltrados = equiposConEstado.filter(equipo => {
                            const estado = equipo.estado_equipos?.[0]?.estado;
                            const updatedAt = equipo.estado_equipos?.[0]?.updated_at;
                            return estado === 'en_proceso' && updatedAt && new Date(updatedAt) < tresDiasAtras;
                        });
                    } else if (activeFilter === 'listos') {
                        equiposFiltrados = equiposConEstado.filter(equipo => 
                            equipo.estado_equipos?.[0]?.estado === 'listo'
                        );
                    }

                    // Búsqueda por texto
                    if (query.trim()) {
                        const queryLower = query.toLowerCase();
                        equiposFiltrados = equiposFiltrados.filter(equipo => {
                            const nota = equipo.nota?.toString() || '';
                            const marca = equipo.marca?.toLowerCase() || '';
                            const modelo = equipo.modelo?.toLowerCase() || '';
                            const problema = equipo.problema?.toLowerCase() || '';
                            const nombreCliente = equipo.clientes?.nombre?.toLowerCase() || '';
                            const telefono = equipo.clientes?.telefono?.toString() || '';
                            const estado = equipo.estado_equipos?.[0]?.estado || '';

                            return nota.includes(queryLower) ||
                                   marca.includes(queryLower) ||
                                   modelo.includes(queryLower) ||
                                   problema.includes(queryLower) ||
                                   nombreCliente.includes(queryLower) ||
                                   telefono.includes(queryLower) ||
                                   estado.includes(queryLower);
                        });
                    }

                    equiposFiltrados.forEach(equipo => {
                        searchResults.push({
                            type: 'equipo',
                            id: equipo.id,
                            title: `Equipo #${equipo.nota}`,
                            subtitle: `${equipo.marca} ${equipo.modelo}`,
                            description: equipo.problema || 'Sin descripción',
                            cliente: equipo.clientes?.nombre,
                            estado: equipo.estado_equipos?.[0]?.estado,
                            data: equipo
                        });
                    });
                }
            }

            // Búsqueda en clientes
            if (searchType === 'all' || searchType === 'clientes') {
                if (query.trim()) {
                    const queryLower = query.toLowerCase();
                    const { data: clientes, error } = await supabase
                        .from('clientes')
                        .select('id, nombre, telefono, email')
                        .or(`nombre.ilike.%${query}%,telefono.ilike.%${query}%,email.ilike.%${query}%`);

                    if (!error && clientes) {
                        clientes.forEach(cliente => {
                            searchResults.push({
                                type: 'cliente',
                                id: cliente.id,
                                title: cliente.nombre,
                                subtitle: cliente.telefono || cliente.email || 'Sin contacto',
                                description: cliente.email || '',
                                data: cliente
                            });
                        });
                    }
                }
            }

            // Búsqueda en documentos
            if (searchType === 'all' || searchType === 'documentos') {
                if (query.trim() || activeFilter === 'sin_presupuesto') {
                    let documentosQuery = supabase
                        .from('servicios_documentos')
                        .select(`
                            id,
                            tipo_servicio,
                            descripcion,
                            precio,
                            estado,
                            created_at,
                            cliente_id,
                            clientes (
                                id,
                                nombre,
                                telefono
                            )
                        `);

                    if (activeFilter === 'sin_presupuesto') {
                        documentosQuery = documentosQuery.or('precio.is.null,precio.eq.0');
                    }

                    if (query.trim()) {
                        const queryLower = query.toLowerCase();
                        const { data: documentos, error } = await documentosQuery;
                        
                        if (!error && documentos) {
                            const filtered = documentos.filter(doc => {
                                const tipo = doc.tipo_servicio?.toLowerCase() || '';
                                const descripcion = doc.descripcion?.toLowerCase() || '';
                                const nombreCliente = doc.clientes?.nombre?.toLowerCase() || '';
                                const telefono = doc.clientes?.telefono?.toString() || '';

                                return tipo.includes(queryLower) ||
                                       descripcion.includes(queryLower) ||
                                       nombreCliente.includes(queryLower) ||
                                       telefono.includes(queryLower);
                            });

                            filtered.forEach(doc => {
                                searchResults.push({
                                    type: 'documento',
                                    id: doc.id,
                                    title: `${doc.tipo_servicio} - #${doc.id}`,
                                    subtitle: doc.clientes?.nombre || 'Sin cliente',
                                    description: doc.descripcion || '',
                                    estado: doc.estado,
                                    data: doc
                                });
                            });
                        }
                    } else if (activeFilter === 'sin_presupuesto') {
                        const { data: documentos, error } = await documentosQuery;
                        if (!error && documentos) {
                            documentos.forEach(doc => {
                                searchResults.push({
                                    type: 'documento',
                                    id: doc.id,
                                    title: `${doc.tipo_servicio} - #${doc.id}`,
                                    subtitle: doc.clientes?.nombre || 'Sin cliente',
                                    description: doc.descripcion || '',
                                    estado: doc.estado,
                                    data: doc
                                });
                            });
                        }
                    }
                }
            }

            // Búsqueda en pedidos
            if (searchType === 'all' || searchType === 'pedidos') {
                if (query.trim()) {
                    const queryLower = query.toLowerCase();
                    const { data: pedidos, error } = await supabase
                        .from('pedidos_piezas')
                        .select('id, nombre_pieza, cantidad, estado, created_at');

                    if (!error && pedidos) {
                        const filtered = pedidos.filter(pedido => {
                            const nombre = pedido.nombre_pieza?.toLowerCase() || '';
                            const estado = pedido.estado?.toLowerCase() || '';

                            return nombre.includes(queryLower) || estado.includes(queryLower);
                        });

                        filtered.forEach(pedido => {
                            searchResults.push({
                                type: 'pedido',
                                id: pedido.id,
                                title: pedido.nombre_pieza,
                                subtitle: `Cantidad: ${pedido.cantidad}`,
                                description: `Estado: ${pedido.estado}`,
                                estado: pedido.estado,
                                data: pedido
                            });
                        });
                    }
                }
            }

            setResults(searchResults);
        } catch (error) {
            console.error('Error en búsqueda:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleResultClick = (result) => {
        onClose();
        switch (result.type) {
            case 'equipo':
                navigate(`/equipos?equipo=${result.id}`);
                break;
            case 'cliente':
                navigate(`/clientes?cliente=${result.id}`);
                break;
            case 'documento':
                navigate(`/documentos?documento=${result.id}`);
                break;
            case 'pedido':
                navigate(`/logistica?pedido=${result.id}`);
                break;
        }
    };

    const getEstadoBadge = (estado) => {
        const estados = {
            'en_proceso': { label: 'En Proceso', color: '#f59e0b' },
            'listo': { label: 'Listo', color: '#10b981' },
            'finalizado': { label: 'Finalizado', color: '#3b82f6' },
            'pendiente': { label: 'Pendiente', color: '#6b7280' }
        };
        const estadoInfo = estados[estado] || { label: estado, color: '#6b7280' };
        return (
            <span className="result-estado" style={{ backgroundColor: `${estadoInfo.color}20`, color: estadoInfo.color }}>
                {estadoInfo.label}
            </span>
        );
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="search-modal-overlay" onClick={onClose}>
            <div className="search-modal" onClick={(e) => e.stopPropagation()}>
                <div className="search-modal-header">
                    <div className="search-input-wrapper">
                        <Icon name="search" className="search-icon" />
                        <input
                            ref={inputRef}
                            type="text"
                            className="search-modal-input"
                            placeholder="Buscar por nota, nombre, teléfono, modelo, problema, estado..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowDown' && results.length > 0) {
                                    e.preventDefault();
                                    document.querySelector('.search-result-item')?.focus();
                                }
                            }}
                        />
                        {query && (
                            <button
                                className="search-clear-btn"
                                onClick={() => setQuery('')}
                            >
                                <Icon name="times" />
                            </button>
                        )}
                    </div>
                    <button className="search-close-btn" onClick={onClose}>
                        <Icon name="times" />
                    </button>
                </div>

                {/* Filtros rápidos */}
                <div className="search-filters">
                    {filters.map(filter => (
                        <button
                            key={filter.id}
                            className={`search-filter-btn ${activeFilter === filter.id ? 'active' : ''}`}
                            onClick={() => setActiveFilter(activeFilter === filter.id ? null : filter.id)}
                            style={activeFilter === filter.id ? { borderColor: filter.color, color: filter.color } : {}}
                            title={filter.label}
                        >
                            <Icon name={filter.icon} />
                            <span className="search-filter-label-full">{filter.label}</span>
                            <span className="search-filter-label-short">{filter.labelShort}</span>
                        </button>
                    ))}
                </div>

                {/* Tipo de búsqueda */}
                <div className="search-type-tabs">
                    <button
                        className={`search-type-tab ${searchType === 'all' ? 'active' : ''}`}
                        onClick={() => setSearchType('all')}
                    >
                        Todo
                    </button>
                    <button
                        className={`search-type-tab ${searchType === 'equipos' ? 'active' : ''}`}
                        onClick={() => setSearchType('equipos')}
                    >
                        <span className="search-tab-full">Equipos</span>
                        <span className="search-tab-short">Eq.</span>
                    </button>
                    <button
                        className={`search-type-tab ${searchType === 'clientes' ? 'active' : ''}`}
                        onClick={() => setSearchType('clientes')}
                    >
                        <span className="search-tab-full">Clientes</span>
                        <span className="search-tab-short">Cli.</span>
                    </button>
                    <button
                        className={`search-type-tab ${searchType === 'documentos' ? 'active' : ''}`}
                        onClick={() => setSearchType('documentos')}
                    >
                        <span className="search-tab-full">Documentos</span>
                        <span className="search-tab-short">Docs</span>
                    </button>
                    <button
                        className={`search-type-tab ${searchType === 'pedidos' ? 'active' : ''}`}
                        onClick={() => setSearchType('pedidos')}
                    >
                        <span className="search-tab-full">Pedidos</span>
                        <span className="search-tab-short">Ped.</span>
                    </button>
                </div>

                {/* Resultados */}
                <div className="search-results">
                    {loading ? (
                        <div className="search-loading">
                            <Icon name="sync" className="spinning" />
                            <span>Buscando...</span>
                        </div>
                    ) : results.length > 0 ? (
                        <div className="search-results-list">
                            {results.map((result, index) => (
                                <div
                                    key={`${result.type}-${result.id}`}
                                    className="search-result-item"
                                    onClick={() => handleResultClick(result)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleResultClick(result);
                                        }
                                    }}
                                    tabIndex={0}
                                >
                                    <div className="result-icon">
                                        <Icon name={
                                            result.type === 'equipo' ? 'wrench' :
                                            result.type === 'cliente' ? 'user' :
                                            result.type === 'documento' ? 'file-alt' :
                                            'box'
                                        } />
                                    </div>
                                    <div className="result-content">
                                        <div className="result-header">
                                            <h4 className="result-title">{result.title}</h4>
                                            {result.estado && getEstadoBadge(result.estado)}
                                        </div>
                                        <p className="result-subtitle">{result.subtitle}</p>
                                        {result.description && (
                                            <p className="result-description">{result.description}</p>
                                        )}
                                        {result.cliente && (
                                            <p className="result-meta">Cliente: {result.cliente}</p>
                                        )}
                                    </div>
                                    <Icon name="chevron-right" className="result-arrow" />
                                </div>
                            ))}
                        </div>
                    ) : query.trim() || activeFilter ? (
                        <div className="search-empty">
                            <Icon name="search" />
                            <p>No se encontraron resultados</p>
                        </div>
                    ) : (
                        <div className="search-empty">
                            <Icon name="search" />
                            <p>Escribe para buscar o usa los filtros rápidos</p>
                            <p className="search-hint">Presiona Cmd/Ctrl + K para abrir este buscador</p>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

