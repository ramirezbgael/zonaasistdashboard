// Netlify Function para verificar el estado de WhatsApp usando Evolution API
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Obtener estado desde la DB
    const { data: config, error } = await supabase
      .from('whatsapp_config')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          estado: 'desconectado',
          activo: false
        })
      };
    }

    // Si hay Evolution API configurada, verificar estado real
    if (config?.evolution_api_url && config?.evolution_api_key && config?.instance_name) {
      try {
        const statusResponse = await fetch(`${config.evolution_api_url}/instance/fetchInstances`, {
          headers: {
            'apikey': config.evolution_api_key
          }
        });

        if (statusResponse.ok) {
          const instances = await statusResponse.json();
          const instanceData = instances.find(i => i.instanceName === config.instance_name);
          
          if (instanceData && instanceData.status === 'open') {
            return {
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                estado: 'conectado',
                numero: config.numero_whatsapp || null,
                activo: config.activo || false,
                qr_code: null
              })
            };
          }
        }
      } catch (err) {
        console.error('Error verificando Evolution API:', err);
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
