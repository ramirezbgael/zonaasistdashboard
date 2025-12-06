import { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';

/**
 * Hook reutilizable para buscar y crear clientes por teléfono
 * @returns {Object} { clienteEncontrado, buscarCliente, clientes, loading }
 */
export default function useClienteSearch() {
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);

  // Cargar lista de clientes para autocompletado
  useEffect(() => {
    const loadClientes = async () => {
      try {
        const { data: clientesData } = await supabase
          .from('clientes')
          .select('id, nombre, telefono, email')
          .order('nombre');
        setClientes(clientesData || []);
      } catch (error) {
        console.error('Error loading clientes:', error);
        // Si la tabla no existe, continuar sin error
        if (!error.message.includes('clientes')) {
          console.error('Error loading clientes:', error);
        }
      }
    };

    loadClientes();
  }, []);

  /**
   * Buscar cliente por teléfono
   * @param {string} telefono - Número de teléfono a buscar
   * @returns {Object|null} Cliente encontrado o null
   */
  const buscarCliente = async (telefono) => {
    if (!telefono || telefono.trim() === '') {
      setClienteEncontrado(null);
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre, telefono, email')
        .eq('telefono', telefono.trim())
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error buscando cliente:', error);
        setClienteEncontrado(null);
        return null;
      }

      if (data) {
        setClienteEncontrado(data);
        return data;
      } else {
        setClienteEncontrado(null);
        return null;
      }
    } catch (error) {
      console.error('Error buscando cliente:', error);
      setClienteEncontrado(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verificar si un cliente tiene todos los datos requeridos (nombre y email)
   * @param {Object} cliente - Cliente a verificar
   * @returns {Object} { tieneNombre, tieneEmail, faltantes }
   */
  const verificarDatosCompletos = (cliente) => {
    if (!cliente) return { tieneNombre: false, tieneEmail: false, faltantes: ['nombre', 'email'] };
    
    const tieneNombre = cliente.nombre && cliente.nombre.trim() !== '';
    const tieneEmail = cliente.email && cliente.email.trim() !== '';
    const faltantes = [];
    
    if (!tieneNombre) faltantes.push('nombre');
    if (!tieneEmail) faltantes.push('email');
    
    return { tieneNombre, tieneEmail, faltantes };
  };

  /**
   * Actualizar datos faltantes de un cliente
   * @param {string} clienteId - ID del cliente
   * @param {Object} datos - Datos a actualizar { nombre?, email? }
   * @returns {Object|null} Cliente actualizado o null
   */
  const actualizarCliente = async (clienteId, datos) => {
    if (!clienteId) return null;

    setLoading(true);
    try {
      const updateData = {};
      if (datos.nombre) updateData.nombre = datos.nombre.trim();
      if (datos.email) updateData.email = datos.email.trim();

      if (Object.keys(updateData).length === 0) {
        return null;
      }

      const { data, error } = await supabase
        .from('clientes')
        .update(updateData)
        .eq('id', clienteId)
        .select()
        .single();

      if (error) throw error;

      setClienteEncontrado(data);
      // Actualizar lista de clientes
      setClientes(prev => prev.map(c => c.id === clienteId ? data : c));
      return data;
    } catch (error) {
      console.error('Error actualizando cliente:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Crear nuevo cliente
   * @param {string} nombre - Nombre del cliente
   * @param {string} telefono - Teléfono del cliente
   * @param {string} email - Email del cliente
   * @returns {Object|null} Cliente creado o null
   */
  const crearCliente = async (nombre, telefono, email = null) => {
    if (!nombre || !telefono) {
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert([{
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          email: email ? email.trim() : null
        }])
        .select()
        .single();

      if (error) {
        // Si el error es por duplicado, intentar buscar el cliente existente
        if (error.code === '23505') {
          const clienteExistente = await buscarCliente(telefono);
          if (clienteExistente) {
            return clienteExistente;
          }
        }
        throw error;
      }

      setClienteEncontrado(data);
      // Actualizar lista de clientes
      setClientes(prev => [...prev, data]);
      return data;
    } catch (error) {
      console.error('Error creando cliente:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Obtener o crear cliente (busca primero, si no existe crea uno nuevo)
   * @param {string} telefono - Teléfono del cliente
   * @param {string} nombre - Nombre del cliente (solo si no existe)
   * @param {string} email - Email del cliente (solo si no existe)
   * @returns {Object|null} Cliente encontrado o creado
   */
  const obtenerOCrearCliente = async (telefono, nombre = null, email = null) => {
    // Primero buscar
    const cliente = await buscarCliente(telefono);
    if (cliente) {
      // Si existe pero le faltan datos, actualizarlos si se proporcionaron
      if ((nombre || email) && cliente.id) {
        const updateData = {};
        if (nombre && !cliente.nombre) updateData.nombre = nombre;
        if (email && !cliente.email) updateData.email = email;
        
        if (Object.keys(updateData).length > 0) {
          return await actualizarCliente(cliente.id, updateData);
        }
      }
      return cliente;
    }

    // Si no existe y se proporciona nombre, crear
    if (nombre) {
      return await crearCliente(nombre, telefono, email);
    }

    return null;
  };

  return {
    clienteEncontrado,
    buscarCliente,
    crearCliente,
    actualizarCliente,
    obtenerOCrearCliente,
    verificarDatosCompletos,
    clientes,
    loading,
    resetCliente: () => setClienteEncontrado(null)
  };
}

