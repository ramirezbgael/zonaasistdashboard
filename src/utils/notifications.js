import { supabase } from '../supabase.js';

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
      const { data: { user } } = await supabase.auth.getUser();
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
 */
export async function notificarEquipoNuevo(equipo, clienteNombre = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const titulo = 'Nuevo Equipo Recibido';
    const mensaje = `Se recibió un nuevo equipo: ${equipo.marca} ${equipo.modelo}${equipo.nota ? ' (#' + equipo.nota + ')' : ''}${clienteNombre ? ' - Cliente: ' + clienteNombre : ''}`;

    // Notificar al usuario actual (el que creó el equipo)
    await crearNotificacion(
      user.id,
      'equipo_nuevo',
      titulo,
      mensaje,
      { equipo_id: equipo.id, cliente_id: equipo.cliente_id }
    );
  } catch (error) {
    console.error('Error notificando equipo nuevo:', error);
  }
}

/**
 * Crea notificación cuando un equipo está listo
 */
export async function notificarEquipoListo(equipo, clienteNombre = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const titulo = 'Equipo Listo';
    const mensaje = `El equipo ${equipo.marca} ${equipo.modelo}${equipo.nota ? ' (#' + equipo.nota + ')' : ''} está listo para entrega${clienteNombre ? ' - Cliente: ' + clienteNombre : ''}`;

    await crearNotificacion(
      user.id,
      'equipo_listo',
      titulo,
      mensaje,
      { equipo_id: equipo.id, cliente_id: equipo.cliente_id }
    );
  } catch (error) {
    console.error('Error notificando equipo listo:', error);
  }
}

/**
 * Crea notificación cuando un equipo es finalizado/entregado
 */
export async function notificarEquipoFinalizado(equipo, clienteNombre = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const titulo = 'Equipo Entregado';
    const mensaje = `El equipo ${equipo.marca} ${equipo.modelo}${equipo.nota ? ' (#' + equipo.nota + ')' : ''} fue entregado${clienteNombre ? ' - Cliente: ' + clienteNombre : ''}`;

    await crearNotificacion(
      user.id,
      'equipo_finalizado',
      titulo,
      mensaje,
      { equipo_id: equipo.id, cliente_id: equipo.cliente_id }
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
    const { data: { user } } = await supabase.auth.getUser();
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
    const { data: { user } } = await supabase.auth.getUser();
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

