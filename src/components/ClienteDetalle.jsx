import { useState, useEffect, useTransition } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import './ClienteDetalle.css';

const ESTADO_MAP = {
    pendiente:  { label: 'Pendiente',  cls: 'badge-pendiente' },
    en_proceso: { label: 'En proceso', cls: 'badge-proceso'   },
    listo:      { label: 'Listo',      cls: 'badge-listo'     },
    finalizado: { label: 'Finalizado', cls: 'badge-finalizado'},
};

function formatDate(str) {
    if (!str) return '—';
    return new Intl.DateTimeFormat('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric',
        timeZone: 'America/Mexico_City',
    }).format(new Date(str));
}

function getInitials(nombre) {
    if (!nombre) return '?';
    const w = nombre.trim().split(' ');
    return w.length >= 2
        ? (w[0][0] + w[1][0]).toUpperCase()
        : nombre.substring(0, 2).toUpperCase();
}

export default function ClienteDetalle({ demoMode = false }) {
    const { id } = useParams();
    const navigate = useNavigate();

    const [cliente, setCliente] = useState(null);
    const [equipos, setEquipos] = useState([]);
    const [saldoCuenta, setSaldoCuenta] = useState(0);
    const [loadingCliente, setLoadingCliente] = useState(true);
    const [loadingEquipos, setLoadingEquipos] = useState(true);
    const [loadingSaldo, setLoadingSaldo] = useState(true);
    const [notFound, setNotFound] = useState(false);

    // Movimiento de cuenta
    const [showCuentaModal, setShowCuentaModal] = useState(false);
    const [tipoMovimiento, setTipoMovimiento] = useState('deposito');
    const [montoMovimiento, setMontoMovimiento] = useState('');
    const [notaMovimiento, setNotaMovimiento] = useState('');
    const [procesando, setProcesando] = useState(false);

    const [, startTransition] = useTransition();

    useEffect(() => {
        if (!id) return;
        fetchCliente();
        fetchSaldo();
        const raf = requestAnimationFrame(() => fetchEquipos());
        return () => cancelAnimationFrame(raf);
    }, [id]);

    const fetchCliente = async () => {
        setLoadingCliente(true);
        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error || !data) {
            setNotFound(true);
        } else {
            setCliente(data);
        }
        setLoadingCliente(false);
    };

    const fetchSaldo = async () => {
        setLoadingSaldo(true);
        const { data } = await supabase
            .from('clientes')
            .select('cuenta_saldo')
            .eq('id', id)
            .maybeSingle();
        setSaldoCuenta(parseFloat(data?.cuenta_saldo || 0));
        setLoadingSaldo(false);
    };

    const fetchEquipos = async () => {
        setLoadingEquipos(true);
        const { data } = await supabase
            .from('equipos')
            .select(`
                id, marca, modelo, color, nota, problema, created_at,
                estado_equipos (
                    estado, updated_at,
                    procesos ( id, nombre )
                )
            `)
            .eq('cliente_id', id)
            .order('created_at', { ascending: false })
            .limit(200);
        startTransition(() => {
            setEquipos(data || []);
            setLoadingEquipos(false);
        });
    };

    const abrirCuentaModal = (tipo) => {
        setTipoMovimiento(tipo);
        setMontoMovimiento('');
        setNotaMovimiento('');
        setShowCuentaModal(true);
    };

    const guardarMovimiento = async () => {
        const monto = parseFloat(montoMovimiento);
        if (!monto || monto <= 0) { alert('Ingresa un monto válido.'); return; }
        const esDeposito = tipoMovimiento === 'deposito';
        const delta = esDeposito ? monto : -monto;
        const nuevoSaldo = (saldoCuenta || 0) + delta;
        if (!esDeposito && nuevoSaldo < 0) {
            alert('El cliente no tiene saldo suficiente.');
            return;
        }
        setProcesando(true);
        try {
            await supabase.from('cliente_cuentas_movimientos').insert({
                cliente_id: id,
                tipo: esDeposito ? 'deposito' : 'cargo',
                monto,
                saldo_despues: nuevoSaldo,
                descripcion: notaMovimiento?.trim() || null,
            }).then(() => {});

            const { error } = await supabase
                .from('clientes')
                .update({ cuenta_saldo: nuevoSaldo })
                .eq('id', id);
            if (error) throw error;

            setSaldoCuenta(nuevoSaldo);
            setShowCuentaModal(false);
        } catch (err) {
            alert('Error al actualizar la cuenta. Intenta de nuevo.');
        } finally {
            setProcesando(false);
        }
    };

    const handleWhatsApp = () => {
        if (!cliente?.telefono) return;
        window.open(`https://wa.me/${cliente.telefono.replace(/\D/g, '')}`, '_blank');
    };

    const handleCall = () => {
        if (!cliente?.telefono) return;
        window.location.href = `tel:${cliente.telefono}`;
    };

    // ── Estados de carga ──────────────────────────────────────────────
    if (loadingCliente) {
        return (
            <div className="cd-page">
                <div className="cd-loading-full">
                    <div className="loading-spinner" />
                    <p>Cargando cliente...</p>
                </div>
            </div>
        );
    }

    if (notFound || !cliente) {
        return (
            <div className="cd-page">
                <div className="cd-not-found">
                    <Icon name="user-slash" />
                    <h2>Cliente no encontrado</h2>
                    <button className="cd-back-btn" onClick={() => navigate('/clientes')}>
                        <Icon name="arrow-left" /> Volver a Clientes
                    </button>
                </div>
            </div>
        );
    }

    // ── Stats rápidas ─────────────────────────────────────────────────
    const activos   = equipos.filter(e => ['pendiente','en_proceso'].includes(e.estado_equipos?.[0]?.estado)).length;
    const listos    = equipos.filter(e => e.estado_equipos?.[0]?.estado === 'listo').length;
    const total     = equipos.length;

    return (
        <div className="cd-page">

            {/* ── TOPBAR ── */}
            <div className="cd-topbar">
                <button className="cd-back-btn" onClick={() => navigate('/clientes')}>
                    <Icon name="arrow-left" />
                    <span>Clientes</span>
                </button>
            </div>

            {/* ── HERO DEL CLIENTE ── */}
            <div className="cd-hero">
                <div className="cd-avatar">{getInitials(cliente.nombre)}</div>
                <div className="cd-hero-info">
                    <h1 className="cd-nombre">{cliente.nombre}</h1>
                    <div className="cd-contacto">
                        {cliente.telefono && (
                            <span className="cd-contacto-item">
                                <Icon name="phone" /> {cliente.telefono}
                            </span>
                        )}
                        {cliente.email && (
                            <span className="cd-contacto-item">
                                <Icon name="envelope" /> {cliente.email}
                            </span>
                        )}
                        {cliente.direccion && (
                            <span className="cd-contacto-item">
                                <Icon name="map-marker-alt" /> {cliente.direccion}
                            </span>
                        )}
                    </div>
                </div>
                <div className="cd-hero-actions">
                    {cliente.telefono && (
                        <>
                            <button className="cd-action-btn cd-whatsapp" onClick={handleWhatsApp}>
                                <Icon name="comment-dots" /> WhatsApp
                            </button>
                            <button className="cd-action-btn cd-call" onClick={handleCall}>
                                <Icon name="phone" /> Llamar
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ── CUERPO ── */}
            <div className="cd-body">

                {/* ── STATS ── */}
                <div className="cd-stats-row">
                    <div className="cd-stat-card">
                        <span className="cd-stat-num">{total}</span>
                        <span className="cd-stat-label">Servicios totales</span>
                    </div>
                    <div className="cd-stat-card">
                        <span className="cd-stat-num cd-stat-active">{activos}</span>
                        <span className="cd-stat-label">En proceso</span>
                    </div>
                    <div className="cd-stat-card">
                        <span className="cd-stat-num cd-stat-listo">{listos}</span>
                        <span className="cd-stat-label">Listos para entrega</span>
                    </div>
                    <div className="cd-stat-card">
                        <span className={`cd-stat-num ${loadingSaldo ? '' : saldoCuenta > 0 ? 'cd-stat-saldo-pos' : saldoCuenta < 0 ? 'cd-stat-saldo-neg' : ''}`}>
                            {loadingSaldo ? '…' : `$${saldoCuenta.toFixed(2)}`}
                        </span>
                        <span className="cd-stat-label">Saldo en cuenta</span>
                    </div>
                </div>

                {/* ── CUENTA ── */}
                <section className="cd-section">
                    <div className="cd-section-header">
                        <h2><Icon name="wallet" /> Cuenta</h2>
                    </div>
                    <div className="cd-cuenta-body">
                        <div className="cd-cuenta-saldo-big">
                            <span className="cd-cuenta-saldo-label">Saldo disponible</span>
                            <span className={`cd-cuenta-saldo-valor ${saldoCuenta > 0 ? 'pos' : saldoCuenta < 0 ? 'neg' : ''}`}>
                                {loadingSaldo ? 'Cargando...' : `$${saldoCuenta.toFixed(2)}`}
                            </span>
                        </div>
                        <div className="cd-cuenta-btns">
                            <button className="cd-cuenta-btn cd-deposito" onClick={() => abrirCuentaModal('deposito')}>
                                <Icon name="plus-circle" /> Agregar a cuenta
                            </button>
                            <button className="cd-cuenta-btn cd-cargo" onClick={() => abrirCuentaModal('cargo')}>
                                <Icon name="minus-circle" /> Descontar de cuenta
                            </button>
                        </div>
                    </div>
                </section>

                {/* ── HISTORIAL DE EQUIPOS ── */}
                <section className="cd-section">
                    <div className="cd-section-header">
                        <h2><Icon name="history" /> Historial de servicios</h2>
                        <span className="cd-section-count">{total}</span>
                    </div>

                    {loadingEquipos ? (
                        <div className="cd-equipos-loading">
                            <div className="loading-spinner" />
                            <span>Cargando servicios...</span>
                        </div>
                    ) : equipos.length === 0 ? (
                        <div className="cd-equipos-empty">
                            <Icon name="folder-open" />
                            <p>Este cliente aún no tiene servicios registrados</p>
                        </div>
                    ) : (
                        <div className="cd-equipos-list">
                            {equipos.map(equipo => {
                                const estadoInfo = equipo.estado_equipos?.[0];
                                const estado = estadoInfo?.estado || 'pendiente';
                                const { label, cls } = ESTADO_MAP[estado] || { label: estado, cls: '' };
                                const proceso = estadoInfo?.procesos;

                                return (
                                    <div
                                        key={equipo.id}
                                        className="cd-equipo-item"
                                        onClick={() => navigate(`/equipos/${equipo.nota}`)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={e => e.key === 'Enter' && navigate(`/equipos/${equipo.nota}`)}
                                    >
                                        <div className="cd-equipo-nota">
                                            <span>#</span>{equipo.nota}
                                        </div>
                                        <div className="cd-equipo-info">
                                            <div className="cd-equipo-title-row">
                                                <span className="cd-equipo-nombre">
                                                    {equipo.marca} {equipo.modelo}
                                                </span>
                                                {equipo.color && (
                                                    <span className="cd-equipo-color">{equipo.color}</span>
                                                )}
                                                <span className={`cd-estado-badge ${cls}`}>{label}</span>
                                            </div>
                                            {equipo.problema && (
                                                <p className="cd-equipo-problema">{equipo.problema}</p>
                                            )}
                                            {proceso && (
                                                <p className="cd-equipo-proceso">
                                                    <Icon name="cog" /> {proceso.nombre}
                                                </p>
                                            )}
                                            <div className="cd-equipo-meta">
                                                <span><Icon name="calendar-alt" /> {formatDate(equipo.created_at)}</span>
                                                {estadoInfo?.updated_at && estadoInfo.updated_at !== equipo.created_at && (
                                                    <span><Icon name="clock" /> Act. {formatDate(estadoInfo.updated_at)}</span>
                                                )}
                                            </div>
                                        </div>
                                        <Icon name="chevron-right" className="cd-equipo-arrow" />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>

            {/* ── MODAL MOVIMIENTO DE CUENTA ── */}
            {showCuentaModal && (
                <div
                    className="cd-modal-overlay"
                    onClick={e => { if (e.target === e.currentTarget && !procesando) setShowCuentaModal(false); }}
                >
                    <div className={`cd-modal cd-modal-${tipoMovimiento}`}>
                        <div className="cd-modal-header">
                            <h3>{tipoMovimiento === 'deposito' ? 'Agregar a cuenta' : 'Descontar de cuenta'}</h3>
                            <button onClick={() => !procesando && setShowCuentaModal(false)}>
                                <Icon name="times" />
                            </button>
                        </div>
                        <div className="cd-modal-body">
                            <p className="cd-modal-saldo-actual">
                                Saldo actual:{' '}
                                <strong className={saldoCuenta > 0 ? 'pos' : saldoCuenta < 0 ? 'neg' : ''}>
                                    ${saldoCuenta.toFixed(2)}
                                </strong>
                            </p>
                            <label className="cd-modal-label">Monto</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="cd-modal-input"
                                value={montoMovimiento}
                                onChange={e => setMontoMovimiento(e.target.value)}
                                placeholder="0.00"
                                autoFocus
                            />
                            <label className="cd-modal-label">Nota (opcional)</label>
                            <textarea
                                className="cd-modal-textarea"
                                rows="3"
                                value={notaMovimiento}
                                onChange={e => setNotaMovimiento(e.target.value)}
                                placeholder={
                                    tipoMovimiento === 'deposito'
                                        ? 'Ej: Transferencia, efectivo…'
                                        : 'Ej: Servicio aplicado, impresiones…'
                                }
                            />
                        </div>
                        <div className="cd-modal-footer">
                            <button className="cd-modal-cancel" onClick={() => !procesando && setShowCuentaModal(false)}>
                                Cancelar
                            </button>
                            <button
                                className={`cd-modal-confirm cd-modal-confirm-${tipoMovimiento}`}
                                onClick={guardarMovimiento}
                                disabled={procesando}
                            >
                                {procesando ? 'Guardando…' : 'Guardar movimiento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
