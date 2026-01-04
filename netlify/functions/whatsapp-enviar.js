// Netlify Function para enviar mensajes por WhatsApp usando Evolution API
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  try {
    const { telefono, mensaje, notificacion_id, tipo, incluir_pdf, equipo_id } = JSON.parse(event.body);

    if (!telefono || !mensaje) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Teléfono y mensaje son requeridos' })
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Obtener configuración
    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('*')
      .single();

    if (!config?.evolution_api_url || !config?.evolution_api_key || !config?.instance_name) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Evolution API no configurada' })
      };
    }

    // Formatear teléfono (remover caracteres especiales, agregar código de país si falta)
    let numeroFormateado = telefono.replace(/[^0-9]/g, '');
    if (!numeroFormateado.startsWith('52') && numeroFormateado.length === 10) {
      numeroFormateado = '52' + numeroFormateado;
    }
    const numeroCompleto = numeroFormateado + '@s.whatsapp.net';

    // Enviar mensaje usando Evolution API
    const sendResponse = await fetch(`${config.evolution_api_url}/message/sendText/${config.instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.evolution_api_key
      },
      body: JSON.stringify({
        number: numeroCompleto,
        text: mensaje
      })
    });

    if (!sendResponse.ok) {
      const error = await sendResponse.text();
      throw new Error(`Error enviando mensaje: ${error}`);
    }

    const result = await sendResponse.json();

    // Si hay PDF, enviarlo también
    if (incluir_pdf && equipo_id) {
      // TODO: Generar PDF y enviarlo como documento
      // const pdfUrl = await generarPDF(equipo_id);
      // await fetch(`${config.evolution_api_url}/message/sendMedia/${config.instance_name}`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json', 'apikey': config.evolution_api_key },
      //   body: JSON.stringify({ number: numeroCompleto, mediatype: 'document', media: pdfUrl })
      // });
    }

    // Actualizar notificación
    if (notificacion_id) {
      await supabase
        .from('notificaciones')
        .update({
          enviado_whatsapp: true,
          fecha_envio_whatsapp: new Date().toISOString()
        })
        .eq('id', notificacion_id);

      // Guardar registro
      await supabase
        .from('whatsapp_mensajes')
        .insert({
          notificacion_id,
          telefono,
          mensaje,
          tipo: tipo || 'equipo_recepcion',
          estado: 'enviado',
          incluyo_pdf: incluir_pdf || false
        });
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Mensaje enviado correctamente',
        messageId: result.key?.id
      })
    };
  } catch (error) {
    console.error('Error enviando mensaje:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};
