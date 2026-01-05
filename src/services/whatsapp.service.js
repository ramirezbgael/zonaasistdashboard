import axios from 'axios';

const WHATSAPP_URL = process.env.WHATSAPP_SERVICE_URL;

if (!WHATSAPP_URL) {
  console.warn('[WhatsApp] WHATSAPP_SERVICE_URL no está definida');
}

const instance = axios.create({
  baseURL: WHATSAPP_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Envía un mensaje de recepción de ticket por WhatsApp.
 * @param {Object} payload - { number, cliente, equipo, problema, folio }
 */
export async function sendTicketRecepcion(payload) {
  try {
    await instance.post('/ticket-recepcion', payload);
    console.log('[WhatsApp] Mensaje de recepción enviado:', payload.folio);
  } catch (err) {
    console.error(
      '[WhatsApp] Error enviando mensaje de recepción:',
      err.response?.data || err.message
    );
  }
}
