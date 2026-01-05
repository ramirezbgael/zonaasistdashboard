// netlify/functions/services/whatsapp.service.js
import axios from 'axios';

const WHATSAPP_URL = process.env.WHATSAPP_SERVICE_URL;
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;

const instance = axios.create({
  baseURL: WHATSAPP_URL,
  timeout: 5000,
  headers: {
    'x-api-key': WHATSAPP_API_KEY,
    'Content-Type': 'application/json',
  },
});

export async function sendTicketRecepcion(payload) {
  try {
    await instance.post('/ticket-recepcion', payload);
    console.log('[WhatsApp] Mensaje de recepción enviado:', payload.folio);
    return true;
  } catch (err) {
    console.error('[WhatsApp] Error enviando mensaje de recepción:', err.message);
    return false;
  }
}
