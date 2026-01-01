// Netlify Function para iniciar sesión de WhatsApp
const { createClient } = require('@supabase/supabase-js');
const { Client, LocalAuth } = require('whatsapp-web.js');

let whatsappClient = null;
let clientReady = false;

async function initWhatsApp() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  return new Promise((resolve, reject) => {
    // Si ya hay un cliente inicializado, no crear otro
    if (whatsappClient) {
      // Verificar si está listo
      if (clientReady) {
        return resolve(whatsappClient);
      }
      // Si no está listo, esperar
      whatsappClient.once('ready', () => resolve(whatsappClient));
      whatsappClient.once('auth_failure', reject);
      return;
    }

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

    let qrGenerated = false;

    whatsappClient.on('qr', async (qr) => {
      console.log('QR generado:', qr.substring(0, 50) + '...');
      qrGenerated = true;
      
      // Guardar QR en Supabase
      try {
        await supabase
          .from('whatsapp_config')
          .upsert({
            qr_code: qr,
            estado: 'esperando_qr',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          });
      } catch (err) {
        console.error('Error guardando QR:', err);
      }
    });

    whatsappClient.on('ready', async () => {
      console.log('WhatsApp listo');
      clientReady = true;
      
      try {
        const info = whatsappClient.info;
        await supabase
          .from('whatsapp_config')
          .upsert({
            estado: 'conectado',
            numero_whatsapp: info.wid.user,
            activo: true,
            qr_code: null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          });
      } catch (err) {
        console.error('Error actualizando estado:', err);
      }
      
      resolve(whatsappClient);
    });

    whatsappClient.on('authenticated', () => {
      console.log('WhatsApp autenticado');
    });

    whatsappClient.on('auth_failure', async (msg) => {
      console.error('Error de autenticación:', msg);
      clientReady = false;
      try {
        await supabase
          .from('whatsapp_config')
          .upsert({
            estado: 'desconectado',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          });
      } catch (err) {
        console.error('Error actualizando estado:', err);
      }
      reject(new Error('Error de autenticación: ' + msg));
    });

    whatsappClient.on('disconnected', async (reason) => {
      console.log('WhatsApp desconectado:', reason);
      clientReady = false;
      whatsappClient = null;
    });

    // Inicializar cliente
    whatsappClient.initialize().catch((err) => {
      console.error('Error inicializando:', err);
      reject(err);
    });
  });
}

exports.handler = async (event, context) => {
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Actualizar estado a generando_qr
    await supabase
      .from('whatsapp_config')
      .upsert({
        estado: 'generando_qr',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    // Inicializar WhatsApp (esto generará el QR)
    const client = await Promise.race([
      initWhatsApp(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout esperando QR')), 30000)
      )
    ]).catch(async (err) => {
      console.error('Error en initWhatsApp:', err);
      // Si hay error, obtener el QR de la DB si existe
      const { data: config } = await supabase
        .from('whatsapp_config')
        .select('qr_code, estado')
        .single();
      
      if (config?.qr_code) {
        return { qr_code: config.qr_code, estado: config.estado };
      }
      throw err;
    });

    // Esperar un momento para que el QR se guarde en la DB
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Obtener QR de la DB
    const { data: config, error } = await supabase
      .from('whatsapp_config')
      .select('qr_code, estado')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error obteniendo config:', error);
    }

    // Si el cliente ya está listo, retornar estado conectado
    if (clientReady && client && client.info) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          qr_code: null,
          estado: 'conectado'
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        qr_code: config?.qr_code || null,
        estado: config?.estado || 'generando_qr'
      })
    };
  } catch (error) {
    console.error('Error:', error);
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

