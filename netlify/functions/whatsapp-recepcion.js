// netlify/functions/whatsapp-recepcion.js
import { sendTicketRecepcion } from './services/whatsapp.service.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { number, cliente, equipo, problema, folio } = req.body;
    if (!number || !cliente || !equipo || !folio) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    await sendTicketRecepcion({ number, cliente, equipo, problema, folio });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[WhatsApp Function] Error:', err);
    return res.status(500).json({ error: 'Error enviando WhatsApp' });
  }
}

export const config = { path: '/.netlify/functions/whatsapp-recepcion' };
