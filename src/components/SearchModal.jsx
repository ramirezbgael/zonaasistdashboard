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
            const q = query.trim();
            const isNumeric = /^\d+$/.test(q);
            const EQUIPO_FIELDS = `id, nota, marca, modelo, problema, created_at, cliente_id, clientes(id, nombre, telefono)`;

            // ── EQUIPOS ──────────────────────────────────────────────────
            // Lanza las 3 búsquedas en paralelo desde el inicio:
            //   1) por modelo (ilike)
            //   2) por nota  (eq exacto, solo si es numérico)
            //   3) por nombre/teléfono de cliente → IDs → equipos
            if (searchType === 'all' || searchType === 'equipos') {
                if (q) {
                    const [byModelo, byNota, byCliente] = await Promise.all([
                        // 1. modelo
                        supabase.from('equipos').select(EQUIPO_FIELDS)
                            .ilike('modelo', `%${q}%`)
                            .limit(20),

                        // 2. nota (solo si es numérico)
                        isNumeric
                            ? supabase.from('equipos').select(EQUIPO_FIELDS)
                                .eq('nota', parseInt(q, 10))
                                .limit(5)
                            : Promise.resolve({ data: [] }),

                        // 3. clientes por nombre o teléfono
                        supabase.from('clientes').select('id')
                            .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`)
                            .limit(30),
                    ]);

                    // Equipos de los clientes encontrados
                    let byClienteEquipos = { data: [] };
                    if (byCliente.data?.length > 0) {
                        byClienteEquipos = await supabase.from('equipos').select(EQUIPO_FIELDS)
                            .in('cliente_id', byCliente.data.map(c => c.id))
                            .limit(20);
                    }

                    // Deduplicar
                    const seenIds = new Set();
                    const allEquipos = [];
                    for (const { data } of [byModelo, byNota, byClienteEquipos]) {
                        for (const e of (data || [])) {
                            if (!seenIds.has(e.id)) { seenIds.add(e.id); allEquipos.push(e); }
                        }
                    }

                    // Estados solo para los encontrados
                    if (allEquipos.length > 0) {
                        const { data: estados } = await supabase
                            .from('estado_equipos')
                            .select('equipo_id, estado, updated_at')
                            .in('equipo_id', allEquipos.map(e => e.id))
                            .order('updated_at', { ascending: false });

                        const estadosMap = new Map();
                        (estados || []).forEach(est => {
                            if (!estadosMap.has(est.equipo_id)) estadosMap.set(est.equipo_id, est);
                        });

                        allEquipos.forEach(equipo => {
                            const estado = estadosMap.get(equipo.id);
                            searchResults.push({
                                type: 'equipo',
                                id: equipo.id,
                                nota: equipo.nota,
                                title: `Equipo #${equipo.nota}`,
                                subtitle: `${equipo.marca || ''} ${equipo.modelo || ''}`.trim(),
                                description: equipo.problema || '',
                                cliente: equipo.clientes?.nombre,
                                estado: estado?.estado,
                                data: equipo,
                            });
                        });
                    }
                }
            }

            // ── CLIENTES ─────────────────────────────────────────────────
            if ((searchType === 'all' || searchType === 'clientes') && q) {
                const { data: clientes } = await supabase
                    .from('clientes')
                    .select('id, nombre, telefono, email')
                    .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`)
                    .limit(20);
                (clientes || []).forEach(cliente => {
                    searchResults.push({
                        type: 'cliente',
                        id: cliente.id,
                        title: cliente.nombre,
                        subtitle: cliente.telefono || 'Sin teléfono',
                        description: cliente.email || '',
                        data: cliente,
                    });
                });
            }

            // ── DOCUMENTOS ───────────────────────────────────────────────
            if ((searchType === 'all' || searchType === 'documentos') && q) {
                const { data: clientes } = await supabase
                    .from('clientes').select('id')
                    .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`)
                    .limit(30);
                if (clientes?.length > 0) {
                    const { data: docs } = await supabase
                        .from('servicios_documentos')
                        .select(`id, tipo_servicio, descripcion, precio, estado, cliente_id, clientes(id, nombre, telefono)`)
                        .in('cliente_id', clientes.map(c => c.id))
                        .limit(20);
                    (docs || []).forEach(doc => {
                        searchResults.push({
                            type: 'documento',
                            id: doc.id,
                            title: `${doc.tipo_servicio} - #${doc.id}`,
                            subtitle: doc.clientes?.nombre || 'Sin cliente',
                            description: doc.descripcion || '',
                            estado: doc.estado,
                            data: doc,
                        });
                    });
                }
            }

            // ── PEDIDOS ──────────────────────────────────────────────────
            if ((searchType === 'all' || searchType === 'pedidos') && q) {
                const { data: pedidos } = await supabase
                    .from('pedidos_piezas')
                    .select('id, nombre_pieza, cantidad, estado, created_at')
                    .ilike('nombre_pieza', `%${q}%`)
                    .limit(20);
                (pedidos || []).forEach(pedido => {
                    searchResults.push({
                        type: 'pedido',
                        id: pedido.id,
                        title: pedido.nombre_pieza,
                        subtitle: `Cantidad: ${pedido.cantidad}`,
                        description: `Estado: ${pedido.estado}`,
                        estado: pedido.estado,
                        data: pedido,
                    });
                });
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
                navigate(`/equipos/${result.nota}`);
                break;
            case 'cliente':
                navigate(`/clientes/${result.id}`);
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

