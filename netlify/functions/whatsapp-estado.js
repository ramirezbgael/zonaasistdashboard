// Esta función ya no es necesaria. Se deja como placeholder para evitar errores de importación accidental.
exports.handler = async (event, context) => {
  return {
    statusCode: 410,
    body: JSON.stringify({ error: 'Función obsoleta. La gestión de WhatsApp ahora se realiza vía microservicio propio.' })
  };
};
