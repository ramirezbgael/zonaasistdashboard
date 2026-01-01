// Netlify Function para cerrar sesión de WhatsApp
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

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

    // Nota: En Netlify Functions, no podemos mantener el cliente activo
    // La sesión se cerrará automáticamente cuando la función termine
    // Para cerrar completamente, necesitarías eliminar los archivos de sesión
    // pero en /tmp se eliminan automáticamente

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

