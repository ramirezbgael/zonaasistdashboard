import { supabase, getCurrentUser } from '../supabase.js';

/**
 * Crea una notificación para un usuario
 * @param {string} usuarioId - ID del usuario que recibirá la notificación
 * @param {string} tipo - Tipo de notificación (equipo_nuevo, equipo_listo, etc.)
 * @param {string} titulo - Título de la notificación
 * @param {string} mensaje - Mensaje de la notificación
 * @param {object} datos - Datos adicionales (equipo_id, documento_id, etc.)
 */
export async function crearNotificacion(usuarioId, tipo, titulo, mensaje, datos = null) {
  try {
    const { data, error } = await supabase
      .from('notificaciones')
      .insert({
        usuario_id: usuarioId,
        tipo,
        titulo,
        mensaje,
        datos: datos || null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creando notificación:', error);
    throw error;
  }
}

/**
 * Crea notificaciones para todos los usuarios autenticados
 * @param {string} tipo - Tipo de notificación
 * @param {string} titulo - Título de la notificación
 * @param {string} mensaje - Mensaje de la notificación
 * @param {object} datos - Datos adicionales
 */
export async function crearNotificacionGlobal(tipo, titulo, mensaje, datos = null) {
  try {
    // Obtener todos los usuarios autenticados
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) throw usersError;

    // Crear notificación para cada usuario
    const notifications = users.map(user => ({
      usuario_id: user.id,
      tipo,
      titulo,
      mensaje,
      datos: datos || null
    }));

    const { data, error } = await supabase
      .from('notificaciones')
      .insert(notifications)
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creando notificaciones globales:', error);
    // Si falla la creación global, intentar solo para el usuario actual
    try {
      const { data: { user } } = await getCurrentUser();
      if (user) {
        return await crearNotificacion(user.id, tipo, titulo, mensaje, datos);
      }
    } catch (fallbackError) {
      console.error('Error en fallback de notificaciones:', fallbackError);
    }
    throw error;
  }
}

/**
 * Crea notificación cuando se crea un nuevo equipo
 * Esta notificación es para enviar la nota de recepción por correo al cliente
 */
export async function notificarEquipoNuevo(equipo, cliente = null) {
  try {
    const { data: { user } } = await getCurrentUser();
    if (!user) return;

    // Si no se pasó el cliente pero hay cliente_id, obtenerlo
    let clienteInfo = cliente;
    if (!clienteInfo && equipo.cliente_id) {
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('id, nombre, telefono, email')
        .eq('id', equipo.cliente_id)
        .single();
      
      if (!clienteError && clienteData) {
        clienteInfo = clienteData;
      }
    }

    const titulo = 'Nota de Recepción - Equipo Recibido';
    const mensaje = `Se recibió un nuevo equipo: ${equipo.marca} ${equipo.modelo}${equipo.nota ? ' (#' + equipo.nota + ')' : ''}${clienteInfo?.nombre ? ' - Cliente: ' + clienteInfo.nombre : ''}`;

    // Preparar datos para el otro proyecto (nota de recepción por correo)
    const datos = {
      equipo_id: equipo.id,
      equipo_nota: equipo.nota,
      cliente_id: equipo.cliente_id || null,
      tipo_notificacion: 'recepcion', // Para identificar que es nota de recepción
      equipo_info: {
        marca: equipo.marca,
        modelo: equipo.modelo,
        color: equipo.color,
        nota: equipo.nota,
        problema: equipo.problema || null
      },
      cliente_info: clienteInfo ? {
        nombre: clienteInfo.nombre,
        telefono: clienteInfo.telefono || null,
        email: clienteInfo.email || null
      } : null
    };

    // Notificar al usuario actual (el que creó el equipo)
    await crearNotificacion(
      user.id,
      'equipo_recepcion', // Tipo específico para nota de recepción
      titulo,
      mensaje,
      datos
    );

    // Enviar WhatsApp de recepción vía Netlify Function (no bloquear, loguear error)
    if (clienteInfo?.telefono && equipo.nota) {
      fetch('/.netlify/functions/whatsapp-recepcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: clienteInfo.telefono,
          cliente: clienteInfo.nombre,
          equipo: `${equipo.marca} ${equipo.modelo} ${equipo.color || ''}`.trim(),
          problema: equipo.problema || '',
          folio: equipo.nota
        })
      }).catch(err => {
        console.error('[WhatsApp] Error enviando mensaje de recepción:', err);
      });
    }
  } catch (error) {
    console.error('Error notificando equipo nuevo:', error);
  }
}

/**
 * Crea notificación cuando un equipo está listo
 * Esta notificación es para enviar WhatsApp al cliente
 */
export async function notificarEquipoListo(equipo, cliente = null) {
  try {
    const { data: { user } } = await getCurrentUser();
    if (!user) return;

    // Si no se pasó el cliente pero hay cliente_id, obtenerlo
    let clienteInfo = cliente;
    if (!clienteInfo && equipo.cliente_id) {
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('id, nombre, telefono, email')
        .eq('id', equipo.cliente_id)
        .single();
      
      if (!clienteError && clienteData) {
        clienteInfo = clienteData;
      }
    }

    const titulo = 'Equipo Listo para Entrega';
    const mensaje = `El equipo ${equipo.marca} ${equipo.modelo}${equipo.nota ? ' (#' + equipo.nota + ')' : ''} está listo para entrega${clienteInfo?.nombre ? ' - Cliente: ' + clienteInfo.nombre : ''}`;

    // Preparar datos para el otro proyecto (WhatsApp)
    const datos = {
      equipo_id: equipo.id,
      equipo_nota: equipo.nota,
      cliente_id: equipo.cliente_id || null,
      tipo_notificacion: 'equipo_listo', // Para identificar que es notificación de equipo listo
      equipo_info: {
        marca: equipo.marca,
        modelo: equipo.modelo,
        color: equipo.color,
        nota: equipo.nota,
        problema: equipo.problema || null
      },
      cliente_info: clienteInfo ? {
        nombre: clienteInfo.nombre,
        telefono: clienteInfo.telefono || null,
        email: clienteInfo.email || null
      } : null
    };

    await crearNotificacion(
      user.id,
      'equipo_listo',
      titulo,
      mensaje,
      datos
    );
  } catch (error) {
    console.error('Error notificando equipo listo:', error);
  }
}

/**
 * Crea notificación cuando un equipo es finalizado/entregado
 */
export async function notificarEquipoFinalizado(equipo, cliente = null) {
  try {
    const { data: { user } } = await getCurrentUser();
    if (!user) return;

    // Si no se pasó el cliente pero hay cliente_id, obtenerlo
    let clienteInfo = cliente;
    if (!clienteInfo && equipo.cliente_id) {
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('id, nombre, telefono, email')
        .eq('id', equipo.cliente_id)
        .single();
      
      if (!clienteError && clienteData) {
        clienteInfo = clienteData;
      }
    }

    const titulo = 'Equipo Entregado';
    const mensaje = `El equipo ${equipo.marca} ${equipo.modelo}${equipo.nota ? ' (#' + equipo.nota + ')' : ''} fue entregado${clienteInfo?.nombre ? ' - Cliente: ' + clienteInfo.nombre : ''}`;

    await crearNotificacion(
      user.id,
      'equipo_finalizado',
      titulo,
      mensaje,
      { 
        equipo_id: equipo.id,
        equipo_nota: equipo.nota,
        cliente_id: equipo.cliente_id,
        cliente_info: clienteInfo ? {
          nombre: clienteInfo.nombre,
          telefono: clienteInfo.telefono || null,
          email: clienteInfo.email || null
        } : null
      }
    );
  } catch (error) {
    console.error('Error notificando equipo finalizado:', error);
  }
}

/**
 * Crea notificación cuando se crea un nuevo documento
 */
export async function notificarDocumentoNuevo(documento, clienteNombre = null) {
  try {
    const { data: { user } } = await getCurrentUser();
    if (!user) return;

    const titulo = 'Nuevo Documento';
    const mensaje = `Se creó un nuevo documento: ${documento.tipo_servicio}${clienteNombre ? ' - Cliente: ' + clienteNombre : ''}`;

    await crearNotificacion(
      user.id,
      'documento_nuevo',
      titulo,
      mensaje,
      { documento_id: documento.id, cliente_id: documento.cliente_id }
    );
  } catch (error) {
    console.error('Error notificando documento nuevo:', error);
  }
}

/**
 * Crea notificación cuando se crea un nuevo pedido
 */
export async function notificarPedidoNuevo(pedido, proveedorNombre = null) {
  try {
    const { data: { user } } = await getCurrentUser();
    if (!user) return;

    const titulo = 'Nuevo Pedido';
    const mensaje = `Se creó un nuevo pedido: ${pedido.nombre_pieza}${proveedorNombre ? ' - Proveedor: ' + proveedorNombre : ''}`;

    await crearNotificacion(
      user.id,
      'pedido_nuevo',
      titulo,
      mensaje,
      { pedido_id: pedido.id, proveedor_id: pedido.proveedor_id }
    );
  } catch (error) {
    console.error('Error notificando pedido nuevo:', error);
  }
}

