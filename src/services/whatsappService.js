/**
 * Servicio para enviar mensajes por WhatsApp
 * Este servicio se conecta con Twilio API o cualquier servicio de WhatsApp
 */

import { supabase } from '../supabase.js';

/**
 * Envía un mensaje por WhatsApp usando Twilio
 * @param {string} telefono - Número de teléfono del destinatario (formato: +1234567890)
 * @param {string} mensaje - Mensaje a enviar
 * @param {object} options - Opciones adicionales (incluir PDF, etc.)
 * @returns {Promise<object>} Resultado del envío
 */
export async function enviarMensajeWhatsApp(telefono, mensaje, options = {}) {
    try {
        // Obtener configuración de WhatsApp
        const { data: config, error: configError } = await supabase
            .from('whatsapp_config')
            .select('*')
            .single();

        if (configError || !config || !config.activo) {
            throw new Error('WhatsApp no está configurado o no está activo');
        }

        // Formatear teléfono (asegurar formato internacional)
        const telefonoFormateado = formatearTelefono(telefono);

        // Si hay Edge Function configurada, usarla
        if (options.usarEdgeFunction) {
            const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
                body: {
                    telefono: telefonoFormateado,
                    mensaje: mensaje,
                    api_key: config.api_key,
                    api_secret: config.api_secret,
                    numero_whatsapp: config.numero_whatsapp,
                    ...options
                }
            });

            if (error) throw error;
            return data;
        }

        // Alternativa: Llamar directamente a Twilio API desde el cliente
        // NOTA: Esto requiere exponer las credenciales, mejor usar Edge Function
        // Por ahora, retornamos un error indicando que se debe usar Edge Function
        throw new Error('Debe configurar una Edge Function de Supabase para enviar mensajes. Ver documentación.');

    } catch (error) {
        console.error('Error enviando mensaje WhatsApp:', error);
        throw error;
    }
}

/**
 * Formatea el número de teléfono al formato internacional
 * @param {string} telefono - Número de teléfono
 * @returns {string} Número formateado
 */
function formatearTelefono(telefono) {
    // Remover espacios, guiones, paréntesis
    let numero = telefono.replace(/[\s\-\(\)]/g, '');
    
    // Si no empieza con +, agregar código de país (México por defecto: +52)
    if (!numero.startsWith('+')) {
        // Si empieza con 52, agregar +
        if (numero.startsWith('52')) {
            numero = '+' + numero;
        } else {
            // Asumir que es número mexicano
            numero = '+52' + numero;
        }
    }
    
    return numero;
}

/**
 * Envía una notificación automáticamente si está configurado
 * @param {object} notificacion - Objeto de notificación de la DB
 * @returns {Promise<object>} Resultado del envío
 */
export async function enviarNotificacionAutomatica(notificacion) {
    try {
        // Verificar si ya fue enviada
        if (notificacion.enviado_whatsapp) {
            return { success: false, message: 'Ya fue enviada' };
        }

        // Obtener teléfono del cliente
        const datos = notificacion.datos || {};
        const telefono = datos.cliente_info?.telefono;
        
        if (!telefono) {
            return { success: false, message: 'No hay teléfono disponible' };
        }

        // Generar mensaje según el tipo
        const mensaje = generarMensajeNotificacion(notificacion);

        // Enviar mensaje
        const resultado = await enviarMensajeWhatsApp(telefono, mensaje, {
            notificacion_id: notificacion.id,
            tipo: notificacion.tipo,
            usarEdgeFunction: true
        });

        // Marcar como enviada
        await supabase
            .from('notificaciones')
            .update({ 
                enviado_whatsapp: true, 
                fecha_envio_whatsapp: new Date().toISOString() 
            })
            .eq('id', notificacion.id);

        // Guardar registro
        await supabase
            .from('whatsapp_mensajes')
            .insert({
                notificacion_id: notificacion.id,
                telefono: telefono,
                mensaje: mensaje,
                tipo: notificacion.tipo,
                estado: 'enviado'
            });

        return { success: true, resultado };
    } catch (error) {
        console.error('Error enviando notificación automática:', error);
        
        // Guardar error
        await supabase
            .from('whatsapp_mensajes')
            .insert({
                notificacion_id: notificacion.id,
                telefono: datos.cliente_info?.telefono || 'N/A',
                mensaje: generarMensajeNotificacion(notificacion),
                tipo: notificacion.tipo,
                estado: 'error',
                error_message: error.message
            });

        return { success: false, error: error.message };
    }
}

/**
 * Genera el mensaje de texto según el tipo de notificación
 * @param {object} notificacion - Objeto de notificación
 * @returns {string} Mensaje formateado
 */
function generarMensajeNotificacion(notificacion) {
    const datos = notificacion.datos || {};
    const equipoInfo = datos.equipo_info || {};
    const clienteNombre = datos.cliente_info?.nombre || 'Cliente';

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
}

/**
 * Procesa todas las notificaciones pendientes y las envía automáticamente
 * Esta función puede ser llamada periódicamente o desde un cron job
 */
export async function procesarNotificacionesPendientes() {
    try {
        // Obtener notificaciones pendientes
        const { data: notificaciones, error } = await supabase
            .from('notificaciones')
            .select('*')
            .eq('enviado_whatsapp', false)
            .in('tipo', ['equipo_recepcion', 'equipo_listo', 'equipo_finalizado'])
            .order('created_at', { ascending: true })
            .limit(10); // Procesar de a 10 para no saturar

        if (error) throw error;

        const resultados = [];
        for (const notificacion of notificaciones || []) {
            const resultado = await enviarNotificacionAutomatica(notificacion);
            resultados.push({ notificacion_id: notificacion.id, ...resultado });
            
            // Esperar un poco entre mensajes
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        return resultados;
    } catch (error) {
        console.error('Error procesando notificaciones pendientes:', error);
        throw error;
    }
}

