import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import { QRCodeSVG } from 'qrcode.react';
import './WhatsAppPage.css';
import './ClientesPage.css';

export default function WhatsAppPage() {
    const [notificacionesPendientes, setNotificacionesPendientes] = useState([]);
    const [mensajesEnviados, setMensajesEnviados] = useState([]);
    const [loading, setLoading] = useState(false);
    const [mostrarConfig, setMostrarConfig] = useState(false);
    const [tabActivo, setTabActivo] = useState('pendientes');
    
    // Estados para WhatsApp QR
    const [qrCode, setQrCode] = useState(null);
    const [estadoSesion, setEstadoSesion] = useState('desconectado'); // desconectado, generando_qr, esperando_qr, conectado
    const [numeroConectado, setNumeroConectado] = useState(null);
    const [activo, setActivo] = useState(false);
    const qrIntervalRef = useRef(null);
    const estadoIntervalRef = useRef(null);

    useEffect(() => {
        cargarNotificacionesPendientes();
        cargarMensajesEnviados();
        verificarEstadoSesion();
        
        // Suscribirse a cambios en notificaciones
        const channel = supabase
            .channel('whatsapp-notifications')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'notificaciones' },
                () => {
                    cargarNotificacionesPendientes();
                }
            )
            .subscribe();

        // Verificar estado de sesión cada 5 segundos
        estadoIntervalRef.current = setInterval(async () => {
            await verificarEstadoSesion();
        }, 5000);

        return () => {
            supabase.removeChannel(channel);
            if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
            if (estadoIntervalRef.current) clearInterval(estadoIntervalRef.current);
        };
    }, []);

    const cargarNotificacionesPendientes = async () => {
        try {
            const { data, error } = await supabase
                .from('notificaciones')
                .select('*')
                .eq('enviado_whatsapp', false)
                .or('tipo.eq.equipo_recepcion,tipo.eq.equipo_listo,tipo.eq.equipo_finalizado')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            // Obtener información de clientes para las notificaciones que la necesiten
            const notificacionesConCliente = await Promise.all((data || []).map(async (notificacion) => {
                const datos = notificacion.datos || {};
                const clienteId = datos.cliente_id || notificacion.cliente_id;
                
                if (clienteId) {
                    const { data: clienteData } = await supabase
                        .from('clientes')
                        .select('id, nombre, telefono')
                        .eq('id', clienteId)
                        .single();
                    
                    return {
                        ...notificacion,
                        clienteInfo: clienteData
                    };
                }
                
                return notificacion;
            }));

            // Filtrar solo las que tienen teléfono de cliente
            const conTelefono = notificacionesConCliente.filter(n => {
                const datos = n.datos || {};
                return datos.cliente_info?.telefono || n.clienteInfo?.telefono;
            });

            setNotificacionesPendientes(conTelefono);
        } catch (error) {
            console.error('Error cargando notificaciones pendientes:', error);
        }
    };

    const cargarMensajesEnviados = async () => {
        try {
            const { data, error } = await supabase
                .from('whatsapp_mensajes')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error && error.code !== 'PGRST116') {
                // Si la tabla no existe, no es error crítico
                if (error.code !== '42P01') {
                    throw error;
                }
            }

            setMensajesEnviados(data || []);
        } catch (error) {
            console.error('Error cargando mensajes enviados:', error);
        }
    };

    const verificarEstadoSesion = async () => {
        try {
            // Llamar a Netlify Function
            const response = await fetch('/.netlify/functions/whatsapp-estado');
            const data = await response.json();

            if (!response.ok) {
                setEstadoSesion('desconectado');
                setNumeroConectado(null);
                setActivo(false);
                return;
            }

            if (data) {
                setEstadoSesion(data.estado || 'desconectado');
                setNumeroConectado(data.numero || null);
                setActivo(data.activo || false);
                
                // Si hay QR pendiente, actualizarlo
                if (data.qr_code && data.estado !== 'conectado') {
                    setQrCode(data.qr_code);
                    setEstadoSesion('esperando_qr');
                } else if (data.estado === 'conectado') {
                    setQrCode(null);
                }
            }
        } catch (error) {
            console.error('Error verificando estado de sesión:', error);
            setEstadoSesion('desconectado');
        }
    };

    const iniciarSesion = async () => {
        try {
            setLoading(true);
            setEstadoSesion('generando_qr');
            setQrCode(null);

            const response = await fetch('/.netlify/functions/whatsapp-iniciar', {
                method: 'POST'
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Error al iniciar sesión');

            if (data.qr_code && typeof data.qr_code === 'string' && data.qr_code.length > 0) {
                setQrCode(data.qr_code);
                setEstadoSesion('esperando_qr');
                
                // Polling para verificar cuando se escanee el QR
                if (qrIntervalRef.current) {
                    clearInterval(qrIntervalRef.current);
                }
                qrIntervalRef.current = setInterval(async () => {
                    await verificarEstadoSesion();
                }, 3000);
            } else if (data.estado === 'conectado') {
                setQrCode(null);
                setEstadoSesion('conectado');
                if (qrIntervalRef.current) {
                    clearInterval(qrIntervalRef.current);
                }
            } else {
                setEstadoSesion(data.estado || 'desconectado');
                if (data.estado === 'generando_qr') {
                    // Esperar un poco y verificar de nuevo
                    setTimeout(async () => {
                        await verificarEstadoSesion();
                    }, 2000);
                } else {
                    alert('Error al generar QR code: ' + (data.error || 'Intenta nuevamente'));
                }
            }
        } catch (error) {
            console.error('Error iniciando sesión:', error);
            alert('Error al iniciar sesión: ' + (error.message || 'Verifica que la Edge Function esté configurada'));
            setEstadoSesion('desconectado');
        } finally {
            setLoading(false);
        }
    };

    const cerrarSesion = async () => {
        try {
            setLoading(true);
            const response = await fetch('/.netlify/functions/whatsapp-cerrar', {
                method: 'POST'
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Error al cerrar sesión');

            setEstadoSesion('desconectado');
            setQrCode(null);
            setNumeroConectado(null);
            setActivo(false);
            
            if (qrIntervalRef.current) {
                clearInterval(qrIntervalRef.current);
            }

            alert('Sesión cerrada correctamente');
        } catch (error) {
            console.error('Error cerrando sesión:', error);
            alert('Error al cerrar sesión: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleActivo = async () => {
        try {
            setLoading(true);
            const nuevoEstado = !activo;
            
            const { error } = await supabase
                .from('whatsapp_config')
                .upsert({
                    activo: nuevoEstado,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'id'
                });

            if (error) throw error;
            
            setActivo(nuevoEstado);
        } catch (error) {
            console.error('Error actualizando estado:', error);
            alert('Error al actualizar estado: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const obtenerTelefonoCliente = (notificacion) => {
        const datos = notificacion.datos || {};
        return datos.cliente_info?.telefono || notificacion.clienteInfo?.telefono || null;
    };

    const obtenerNombreCliente = (notificacion) => {
        const datos = notificacion.datos || {};
        return datos.cliente_info?.nombre || notificacion.clienteInfo?.nombre || 'Cliente';
    };

    const generarMensaje = (notificacion) => {
        const clienteNombre = obtenerNombreCliente(notificacion);
        const datos = notificacion.datos || {};
        const equipoInfo = datos.equipo_info || {};

        switch (notificacion.tipo) {
            case 'equipo_recepcion':
                return `Hola ${clienteNombre}, te confirmamos que hemos recibido tu equipo:\n\n` +
                       `📱 *${equipoInfo.marca} ${equipoInfo.modelo}*\n` +
                       `${equipoInfo.nota ? `Nota: #${equipoInfo.nota}\n` : ''}` +
                       `${equipoInfo.problema ? `Problema: ${equipoInfo.problema}\n` : ''}\n` +
                       `Pronto te enviaremos la nota de recepción. Gracias por confiar en nosotros.`;

            case 'equipo_listo':
                return `Hola ${clienteNombre}, ¡buenas noticias! 🎉\n\n` +
                       `Tu equipo *${equipoInfo.marca} ${equipoInfo.modelo}*${equipoInfo.nota ? ` (#${equipoInfo.nota})` : ''} está listo para recoger.\n\n` +
                       `Puedes pasar por nuestras instalaciones en horario de atención.`;

            case 'equipo_finalizado':
                return `Hola ${clienteNombre}, tu equipo ha sido entregado exitosamente.\n\n` +
                       `📱 *${equipoInfo.marca} ${equipoInfo.modelo}*\n` +
                       `${equipoInfo.nota ? `Nota: #${equipoInfo.nota}\n` : ''}\n` +
                       `Gracias por tu preferencia. ¡Esperamos verte pronto!`;

            default:
                return notificacion.mensaje || 'Notificación de Zona Asist';
        }
    };

    const enviarMensaje = async (notificacion, incluirPDF = false) => {
        if (!activo || estadoSesion !== 'conectado') {
            alert('Por favor, conecta y activa WhatsApp primero');
            setMostrarConfig(true);
            return;
        }

        const telefono = obtenerTelefonoCliente(notificacion);
        if (!telefono) {
            alert('No se encontró número de teléfono para este cliente');
            return;
        }

        try {
            setLoading(true);
            const mensaje = generarMensaje(notificacion);

            // Llamar a Netlify Function para enviar mensaje
            const response = await fetch('/.netlify/functions/whatsapp-enviar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    telefono: telefono,
                    mensaje: mensaje,
                    notificacion_id: notificacion.id,
                    tipo: notificacion.tipo,
                    incluir_pdf: incluirPDF,
                    equipo_id: notificacion.datos?.equipo_id || null
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error al enviar mensaje');

            // Marcar notificación como enviada
            await supabase
                .from('notificaciones')
                .update({ enviado_whatsapp: true, fecha_envio_whatsapp: new Date().toISOString() })
                .eq('id', notificacion.id);

            // Guardar registro del mensaje
            await supabase
                .from('whatsapp_mensajes')
                .insert({
                    notificacion_id: notificacion.id,
                    telefono: telefono,
                    mensaje: mensaje,
                    tipo: notificacion.tipo,
                    estado: 'enviado',
                    incluyo_pdf: incluirPDF
                });

            alert('Mensaje enviado correctamente');
            cargarNotificacionesPendientes();
            cargarMensajesEnviados();
        } catch (error) {
            console.error('Error enviando mensaje:', error);
            alert('Error al enviar mensaje: ' + (error.message || 'Verifica la configuración de WhatsApp'));
        } finally {
            setLoading(false);
        }
    };

    const enviarTodosPendientes = async () => {
        if (!activo || estadoSesion !== 'conectado') {
            alert('Por favor, conecta y activa WhatsApp primero');
            return;
        }

        if (!confirm(`¿Enviar ${notificacionesPendientes.length} mensajes pendientes?`)) {
            return;
        }

        setLoading(true);
        let enviados = 0;
        let errores = 0;

        for (const notificacion of notificacionesPendientes) {
            try {
                await enviarMensaje(notificacion, false);
                enviados++;
                // Esperar un poco entre mensajes para no saturar
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                errores++;
                console.error('Error enviando notificación:', notificacion.id, error);
            }
        }

        alert(`Envío completado: ${enviados} enviados, ${errores} errores`);
        setLoading(false);
    };

    const formatearFecha = (fecha) => {
        return new Date(fecha).toLocaleString('es-MX', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTipoLabel = (tipo) => {
        const tipos = {
            'equipo_recepcion': 'Nota de Recepción',
            'equipo_listo': 'Equipo Listo',
            'equipo_finalizado': 'Equipo Entregado'
        };
        return tipos[tipo] || tipo;
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-title-section">
                    <h1 className="page-title">
                        <Icon name="comment" className="page-title-icon" />
                        WhatsApp - Notificaciones
                    </h1>
                    <p className="page-subtitle">
                        Gestiona y envía notificaciones automáticas a clientes
                    </p>
                </div>
                <div className="page-actions">
                    <button 
                        className="btn-secondary"
                        onClick={() => setMostrarConfig(!mostrarConfig)}
                    >
                        <Icon name="cog" />
                        Configuración
                    </button>
                    {notificacionesPendientes.length > 0 && (
                        <button 
                            className="btn-primary"
                            onClick={enviarTodosPendientes}
                            disabled={loading || !activo || estadoSesion !== 'conectado'}
                        >
                            <Icon name="paper-plane" />
                            Enviar Todos ({notificacionesPendientes.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Configuración */}
            {mostrarConfig && (
                <div className="whatsapp-config-card">
                    <h3>Configuración de WhatsApp</h3>
                    
                    {/* Estado de Sesión */}
                    <div className="whatsapp-estado">
                        <div className="estado-badge" data-estado={estadoSesion}>
                            <Icon name={estadoSesion === 'conectado' ? 'check-circle' : estadoSesion === 'esperando_qr' ? 'clock' : 'times-circle'} />
                            <span>
                                {estadoSesion === 'conectado' && 'Conectado'}
                                {estadoSesion === 'esperando_qr' && 'Esperando QR'}
                                {estadoSesion === 'generando_qr' && 'Generando QR...'}
                                {estadoSesion === 'desconectado' && 'Desconectado'}
                            </span>
                        </div>
                        {numeroConectado && (
                            <div className="numero-conectado">
                                <Icon name="phone" />
                                {numeroConectado}
                            </div>
                        )}
                    </div>

                    {/* QR Code */}
                    {qrCode && estadoSesion === 'esperando_qr' && typeof qrCode === 'string' && qrCode.length > 0 && (
                        <div className="qr-container">
                            <p className="qr-instructions">
                                Escanea este código QR con WhatsApp:
                            </p>
                            <ol className="qr-steps">
                                <li>Abre WhatsApp en tu teléfono</li>
                                <li>Ve a Configuración → Dispositivos vinculados</li>
                                <li>Toca "Vincular un dispositivo"</li>
                                <li>Escanea este código</li>
                            </ol>
                            <div className="qr-code-wrapper">
                                {qrCode.startsWith('data:image') ? (
                                    <img src={qrCode} alt="QR Code" style={{ width: '256px', height: '256px' }} />
                                ) : (
                                    <QRCodeSVG 
                                        value={qrCode} 
                                        size={256}
                                        level="M"
                                        includeMargin={true}
                                    />
                                )}
                            </div>
                            <p className="qr-note">
                                El código expira en 60 segundos. Si expira, haz clic en "Iniciar Sesión" nuevamente.
                            </p>
                        </div>
                    )}
                    
                    {estadoSesion === 'generando_qr' && !qrCode && (
                        <div className="qr-container">
                            <div className="loading-state">
                                <div className="loading-spinner"></div>
                                <p>Generando código QR...</p>
                            </div>
                        </div>
                    )}

                    {/* Botones de Acción */}
                    <div className="whatsapp-actions">
                        {estadoSesion === 'desconectado' && (
                            <button 
                                className="btn-primary" 
                                onClick={iniciarSesion} 
                                disabled={loading || estadoSesion === 'generando_qr'}
                            >
                                <Icon name="sign-in-alt" />
                                {loading ? 'Generando QR...' : 'Iniciar Sesión'}
                            </button>
                        )}
                        
                        {estadoSesion === 'conectado' && (
                            <>
                                <button 
                                    className="btn-danger" 
                                    onClick={cerrarSesion} 
                                    disabled={loading}
                                >
                                    <Icon name="sign-out-alt" />
                                    Cerrar Sesión
                                </button>
                            </>
                        )}

                        {estadoSesion === 'esperando_qr' && (
                            <button 
                                className="btn-secondary" 
                                onClick={() => {
                                    setQrCode(null);
                                    setEstadoSesion('desconectado');
                                    if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
                                }}
                            >
                                <Icon name="times" />
                                Cancelar
                            </button>
                        )}
                    </div>

                    {/* Activar envío automático */}
                    <div className="form-group checkbox-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={activo}
                                onChange={toggleActivo}
                                disabled={estadoSesion !== 'conectado' || loading}
                            />
                            Activar envío automático
                        </label>
                        <p className="checkbox-help">
                            {estadoSesion !== 'conectado' 
                                ? 'Debes estar conectado para activar el envío automático'
                                : 'Cuando está activo, se enviarán automáticamente las notificaciones pendientes'}
                        </p>
                    </div>

                    <div className="form-actions">
                        <button className="btn-secondary" onClick={() => setMostrarConfig(false)}>
                            Cerrar
                        </button>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="whatsapp-tabs">
                <button 
                    className={`tab ${tabActivo === 'pendientes' ? 'active' : ''}`}
                    onClick={() => setTabActivo('pendientes')}
                >
                    <Icon name="clock" />
                    Pendientes ({notificacionesPendientes.length})
                </button>
                <button 
                    className={`tab ${tabActivo === 'enviados' ? 'active' : ''}`}
                    onClick={() => setTabActivo('enviados')}
                >
                    <Icon name="check-circle" />
                    Enviados ({mensajesEnviados.length})
                </button>
            </div>

            {/* Lista de Pendientes */}
            {tabActivo === 'pendientes' && (
                <div className="whatsapp-list">
                    {notificacionesPendientes.length === 0 ? (
                        <div className="empty-state">
                            <Icon name="check-circle" />
                            <p>No hay notificaciones pendientes</p>
                        </div>
                    ) : (
                        notificacionesPendientes.map(notificacion => (
                            <div key={notificacion.id} className="whatsapp-item">
                                <div className="whatsapp-item-header">
                                    <div className="whatsapp-item-info">
                                        <h4>{getTipoLabel(notificacion.tipo)}</h4>
                                        <span className="whatsapp-cliente">
                                            {obtenerNombreCliente(notificacion)}
                                        </span>
                                        <span className="whatsapp-telefono">
                                            {obtenerTelefonoCliente(notificacion)}
                                        </span>
                                    </div>
                                    <span className="whatsapp-fecha">
                                        {formatearFecha(notificacion.created_at)}
                                    </span>
                                </div>
                                <div className="whatsapp-mensaje-preview">
                                    {generarMensaje(notificacion).substring(0, 150)}...
                                </div>
                                <div className="whatsapp-item-actions">
                                    <button
                                        className="btn-primary small"
                                        onClick={() => enviarMensaje(notificacion, false)}
                                        disabled={loading || !activo || estadoSesion !== 'conectado'}
                                    >
                                        <Icon name="paper-plane" />
                                        Enviar Mensaje
                                    </button>
                                    {(notificacion.tipo === 'equipo_recepcion' || notificacion.tipo === 'equipo_finalizado') && (
                                        <button
                                            className="btn-secondary small"
                                            onClick={() => enviarMensaje(notificacion, true)}
                                            disabled={loading || !activo || estadoSesion !== 'conectado'}
                                        >
                                            <Icon name="file-pdf" />
                                            Enviar con PDF
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Lista de Enviados */}
            {tabActivo === 'enviados' && (
                <div className="whatsapp-list">
                    {mensajesEnviados.length === 0 ? (
                        <div className="empty-state">
                            <Icon name="inbox" />
                            <p>No hay mensajes enviados aún</p>
                        </div>
                    ) : (
                        mensajesEnviados.map(mensaje => (
                            <div key={mensaje.id} className="whatsapp-item sent">
                                <div className="whatsapp-item-header">
                                    <div className="whatsapp-item-info">
                                        <h4>{getTipoLabel(mensaje.tipo)}</h4>
                                        <span className="whatsapp-telefono">{mensaje.telefono}</span>
                                    </div>
                                    <span className="whatsapp-fecha">
                                        {formatearFecha(mensaje.created_at)}
                                    </span>
                                </div>
                                <div className="whatsapp-mensaje-preview">
                                    {mensaje.mensaje}
                                </div>
                                <div className="whatsapp-status">
                                    <Icon name="check-circle" />
                                    {mensaje.estado === 'enviado' ? 'Enviado' : mensaje.estado}
                                    {mensaje.incluyo_pdf && (
                                        <span className="pdf-badge">
                                            <Icon name="file-pdf" />
                                            Con PDF
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

