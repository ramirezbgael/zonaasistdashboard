// Netlify Function para iniciar sesión de WhatsApp usando Evolution API
// Evolution API es un servicio REST que maneja WhatsApp sin Puppeteer
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Obtener configuración de Evolution API
    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('*')
      .single();

    const evolutionApiUrl = process.env.EVOLUTION_API_URL || config?.evolution_api_url || 'http://localhost:8080';
    const apiKey = process.env.EVOLUTION_API_KEY || config?.evolution_api_key;
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME || config?.instance_name || 'zona-asist';

    if (!apiKey) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Evolution API no configurada. Configura EVOLUTION_API_URL y EVOLUTION_API_KEY en las variables de entorno.'
        })
      };
    }

    // Actualizar estado a generando_qr
    await supabase
      .from('whatsapp_config')
      .upsert({
        estado: 'generando_qr',
        evolution_api_url: evolutionApiUrl,
        evolution_api_key: apiKey,
        instance_name: instanceName,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    // Crear o obtener instancia en Evolution API
    let instanceExists = false;
    try {
      const checkResponse = await fetch(`${evolutionApiUrl}/instance/fetchInstances`, {
        headers: {
          'apikey': apiKey
        }
      });
      
      if (checkResponse.ok) {
        const instances = await checkResponse.json();
        instanceExists = instances.includes(instanceName);
      }
    } catch (err) {
      console.log('Error verificando instancia:', err.message);
    }

    // Si no existe, crearla
    if (!instanceExists) {
      const createResponse = await fetch(`${evolutionApiUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify({
          instanceName: instanceName,
          token: apiKey,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        })
      });

      if (!createResponse.ok) {
        const error = await createResponse.text();
        throw new Error(`Error creando instancia: ${error}`);
      }
    }

    // Obtener QR code
    const qrResponse = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey
      }
    });

    if (!qrResponse.ok) {
      throw new Error('Error obteniendo QR code');
    }

    const qrData = await qrResponse.json();

    // Guardar QR en Supabase
    await supabase
      .from('whatsapp_config')
      .upsert({
        qr_code: qrData.qrcode?.base64 || qrData.qrcode?.code || null,
        estado: qrData.instance?.status === 'open' ? 'conectado' : 'esperando_qr',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        qr_code: qrData.qrcode?.base64 || qrData.qrcode?.code || null,
        estado: qrData.instance?.status === 'open' ? 'conectado' : 'esperando_qr'
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
