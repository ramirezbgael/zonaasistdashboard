// Netlify Function para enviar mensajes por WhatsApp
const { createClient } = require('@supabase/supabase-js');
const { Client, LocalAuth } = require('whatsapp-web.js');

let whatsappClient = null;
let clientReady = false;

async function getWhatsAppClient() {
  if (whatsappClient && clientReady) {
    return whatsappClient;
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  return new Promise((resolve, reject) => {
    whatsappClient = new Client({
      authStrategy: new LocalAuth({
        dataPath: '/tmp/.wwebjs_auth'
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      }
    });

    whatsappClient.on('ready', () => {
      console.log('WhatsApp listo para enviar');
      clientReady = true;
      resolve(whatsappClient);
    });

    whatsappClient.on('auth_failure', (msg) => {
      console.error('Error de autenticación:', msg);
      reject(new Error('No autenticado'));
    });

    whatsappClient.initialize().catch(reject);
  });
}

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
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Obtener cliente de WhatsApp
    const client = await getWhatsAppClient();

    // Formatear teléfono (agregar @c.us si no lo tiene)
    const numeroFormateado = telefono.includes('@c.us') 
      ? telefono 
      : `${telefono.replace(/[^0-9]/g, '')}@c.us`;

    // Enviar mensaje
    await client.sendMessage(numeroFormateado, mensaje);

    // Si hay PDF, enviarlo también
    if (incluir_pdf && equipo_id) {
      // TODO: Generar URL del PDF y enviarlo como documento
      // const pdfUrl = await generarPDF(equipo_id);
      // await client.sendMessage(numeroFormateado, new MessageMedia('application/pdf', pdfBase64, 'nota.pdf'));
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
        message: 'Mensaje enviado correctamente'
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

