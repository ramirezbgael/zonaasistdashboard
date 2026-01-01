// Netlify Function para verificar el estado de WhatsApp
const { createClient } = require('@supabase/supabase-js');
const { Client, LocalAuth } = require('whatsapp-web.js');

// Cliente global para mantener la sesión
let whatsappClient = null;
let clientReady = false;

// Inicializar cliente de WhatsApp
async function initWhatsApp() {
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
        dataPath: '/tmp/.wwebjs_auth' // En Netlify, usar /tmp
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

    whatsappClient.on('qr', async (qr) => {
      console.log('QR recibido');
      // Guardar QR en Supabase
      await supabase
        .from('whatsapp_config')
        .upsert({
          qr_code: qr,
          estado: 'esperando_qr',
          updated_at: new Date().toISOString()
        });
    });

    whatsappClient.on('ready', async () => {
      console.log('WhatsApp conectado');
      clientReady = true;
      
      const info = whatsappClient.info;
      await supabase
        .from('whatsapp_config')
        .upsert({
          estado: 'conectado',
          numero_whatsapp: info.wid.user,
          activo: true,
          updated_at: new Date().toISOString()
        });
      
      resolve(whatsappClient);
    });

    whatsappClient.on('authenticated', () => {
      console.log('WhatsApp autenticado');
    });

    whatsappClient.on('auth_failure', async (msg) => {
      console.error('Error de autenticación:', msg);
      clientReady = false;
      await supabase
        .from('whatsapp_config')
        .upsert({
          estado: 'desconectado',
          updated_at: new Date().toISOString()
        });
      reject(new Error('Error de autenticación'));
    });

    whatsappClient.on('disconnected', async (reason) => {
      console.log('WhatsApp desconectado:', reason);
      clientReady = false;
      await supabase
        .from('whatsapp_config')
        .upsert({
          estado: 'desconectado',
          updated_at: new Date().toISOString()
        });
    });

    whatsappClient.initialize().catch(reject);
  });
}

exports.handler = async (event, context) => {
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Obtener estado desde la DB
    const { data: config, error } = await supabase
      .from('whatsapp_config')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          estado: 'desconectado',
          activo: false
        })
      };
    }

    // Si está conectado, verificar que el cliente esté activo
    if (config?.estado === 'conectado') {
      try {
        await initWhatsApp();
      } catch (err) {
        console.error('Error inicializando cliente:', err);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        estado: config?.estado || 'desconectado',
        numero: config?.numero_whatsapp || null,
        activo: config?.activo || false,
        qr_code: config?.qr_code || null
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
        estado: 'desconectado',
        activo: false,
        error: error.message
      })
    };
  }
};

