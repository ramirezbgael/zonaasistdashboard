// Netlify Function para cerrar sesión de WhatsApp usando Evolution API
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Obtener configuración
    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('*')
      .single();

    // Si hay Evolution API, cerrar instancia
    if (config?.evolution_api_url && config?.evolution_api_key && config?.instance_name) {
      try {
        await fetch(`${config.evolution_api_url}/instance/logout/${config.instance_name}`, {
          method: 'DELETE',
          headers: {
            'apikey': config.evolution_api_key
          }
        });
      } catch (err) {
        console.error('Error cerrando instancia en Evolution API:', err);
      }
    }

    // Actualizar configuración
    await supabase
      .from('whatsapp_config')
      .update({
        estado: 'desconectado',
        activo: false,
        qr_code: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        estado: 'desconectado'
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
