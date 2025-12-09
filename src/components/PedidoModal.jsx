import { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import './PedidoModal.css';

export default function PedidoModal({ pedido, onClose, onPedidoUpdated }) {
  const [pedidoCompleto, setPedidoCompleto] = useState(pedido);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cliente, setCliente] = useState(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactData, setContactData] = useState({ telefono: null, nombreCliente: 'el cliente' });

  useEffect(() => {
    if (pedido?.id) {
      loadPedidoCompleto();
    }
  }, [pedido?.id]);

  useEffect(() => {
    if (pedidoCompleto) {
      loadCliente();
      loadHistorial();
    }
  }, [pedidoCompleto]);

  const loadPedidoCompleto = async () => {
    try {
      const { data, error } = await supabase
        .from('pedidos_piezas')
        .select(`
          *,
          proveedores (
            id,
            nombre,
            telefono,
            email
          ),
          equipos (
            id,
            marca,
            modelo,
            nota,
            cliente_id,
            clientes (
              id,
              nombre,
              telefono,
              email
            )
          )
        `)
        .eq('id', pedido.id)
        .single();

      if (error) throw error;
      setPedidoCompleto(data);
    } catch (error) {
      console.error('Error loading pedido completo:', error);
    }
  };

  const loadHistorial = async () => {
    if (!pedidoCompleto?.id) return;
    
    try {
      // Buscar actualizaciones en comentarios o crear un historial básico
      const { data, error } = await supabase
        .from('comentarios')
        .select('*')
        .eq('modulo', 'logistica')
        .eq('referencia_id', pedidoCompleto.id)
        .order('created_at', { ascending: false });

      if (error) {
        // Si no existe la tabla comentarios, crear historial básico con cambios de estado
        console.warn('Tabla comentarios no disponible, usando historial básico');
        const historialBasico = [];
        
        // Agregar creación del pedido
        if (pedidoCompleto?.created_at) {
          historialBasico.push({
            mensaje: 'Pedido creado',
            created_at: pedidoCompleto.created_at
          });
        }
        
        // Agregar cambio de estado si existe
        if (pedidoCompleto?.updated_at && pedidoCompleto.updated_at !== pedidoCompleto.created_at) {
          historialBasico.push({
            mensaje: `Estado actualizado a: ${pedidoCompleto.estado}`,
            created_at: pedidoCompleto.updated_at
          });
        }
        
        setHistorial(historialBasico);
        return;
      }
      
      // Combinar comentarios con historial básico
      const historialBasico = [];
      
      if (pedidoCompleto?.created_at) {
        historialBasico.push({
          mensaje: 'Pedido creado',
          created_at: pedidoCompleto.created_at
        });
      }
      
      if (pedidoCompleto?.updated_at && pedidoCompleto.updated_at !== pedidoCompleto.created_at) {
        historialBasico.push({
          mensaje: `Estado actualizado a: ${pedidoCompleto.estado}`,
          created_at: pedidoCompleto.updated_at
        });
      }
      
      // Combinar y ordenar por fecha
      const historialCompleto = [...historialBasico, ...(data || [])].sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
      });
      
      setHistorial(historialCompleto);
    } catch (error) {
      console.error('Error loading historial:', error);
      setHistorial([]);
    }
  };

  const loadCliente = async () => {
    try {
      if (pedidoCompleto?.equipos?.clientes) {
        setCliente(pedidoCompleto.equipos.clientes);
      } else if (pedidoCompleto?.equipos?.cliente_id) {
        const { data, error } = await supabase
          .from('clientes')
          .select('id, nombre, telefono, email')
          .eq('id', pedidoCompleto.equipos.cliente_id)
          .single();

        if (!error && data) {
          setCliente(data);
        }
      }
    } catch (error) {
      console.error('Error loading cliente:', error);
    }
  };

  const handleMarcarRecibido = async () => {
    if (!confirm('¿Confirmas que el pedido ha sido recibido?')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('pedidos_piezas')
        .update({
          estado: 'recibido',
          updated_at: new Date().toISOString()
        })
        .eq('id', pedido.id);

      if (error) throw error;

      // Agregar al historial
      try {
        await supabase
          .from('comentarios')
          .insert({
            modulo: 'logistica',
            referencia_id: pedido.id,
            mensaje: 'Pedido marcado como recibido'
          });
      } catch (histError) {
        console.error('Error agregando al historial:', histError);
      }

      alert('Pedido marcado como recibido');
      onPedidoUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error marcando pedido como recibido:', error);
      alert('Error al marcar el pedido como recibido');
    } finally {
      setLoading(false);
    }
  };

  const handleContactarCliente = () => {
    if (!cliente?.telefono) {
      alert('No hay teléfono disponible para este cliente');
      return;
    }

    setContactData({
      telefono: cliente.telefono,
      nombreCliente: cliente.nombre || 'el cliente'
    });
    setShowContactModal(true);
  };

  const handleContactarTelefono = () => {
    if (!contactData.telefono) return;
    window.open(`tel:${contactData.telefono}`, '_self');
    setShowContactModal(false);
  };

  const handleContactarWhatsApp = () => {
    if (!contactData.telefono) return;
    const mensaje = encodeURIComponent(`Hola ${contactData.nombreCliente}! Te escribo de Zona Asist sobre el pedido de ${pedidoCompleto?.nombre_pieza || 'pieza'}. ¡Saludos!`);
    window.open(`https://wa.me/52${contactData.telefono}?text=${mensaje}`, '_blank');
    setShowContactModal(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatCurrency = (amount) => {
    if (!amount) return null;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <>
      <div className="pedido-modal-overlay" onClick={handleOverlayClick}>
        <div className="pedido-modal" onClick={(e) => e.stopPropagation()}>
          <div className="pedido-modal-header">
            <div className="pedido-modal-header-info">
              <h2>Detalles del Pedido</h2>
              <p className="pedido-modal-subtitle">{pedidoCompleto?.nombre_pieza || pedido?.nombre_pieza}</p>
            </div>
            <button className="pedido-modal-close-btn" onClick={onClose}>
              ×
            </button>
          </div>

          <div className="pedido-modal-content">
            <div className="pedido-info-section">
              <div className="pedido-info-card">
                <h3 className="pedido-section-title">Información del Pedido</h3>
                <div className="pedido-info-grid">
                  <div className="pedido-info-item">
                    <Icon name="box" className="pedido-info-icon" />
                    <div className="pedido-info-content">
                      <span className="pedido-info-label">Pieza</span>
                      <span className="pedido-info-value">{pedidoCompleto?.nombre_pieza || pedido?.nombre_pieza}</span>
                    </div>
                  </div>
                  {pedidoCompleto?.numero_parte && (
                    <div className="pedido-info-item">
                      <Icon name="barcode" className="pedido-info-icon" />
                      <div className="pedido-info-content">
                        <span className="pedido-info-label">Número de Parte</span>
                        <span className="pedido-info-value">{pedidoCompleto.numero_parte}</span>
                      </div>
                    </div>
                  )}
                  <div className="pedido-info-item">
                    <Icon name="cube" className="pedido-info-icon" />
                    <div className="pedido-info-content">
                      <span className="pedido-info-label">Cantidad</span>
                      <span className="pedido-info-value">{pedidoCompleto?.cantidad || pedido?.cantidad}</span>
                    </div>
                  </div>
                  {pedidoCompleto?.precio_unitario && (
                    <div className="pedido-info-item">
                      <Icon name="dollar-sign" className="pedido-info-icon" />
                      <div className="pedido-info-content">
                        <span className="pedido-info-label">Precio Unitario</span>
                        <span className="pedido-info-value">{formatCurrency(pedidoCompleto.precio_unitario)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {pedidoCompleto?.proveedores && (
                <div className="pedido-info-card">
                  <h3 className="pedido-section-title">Proveedor</h3>
                  <div className="pedido-proveedor-details">
                    <Icon name="truck" className="pedido-proveedor-icon" />
                    <div className="pedido-proveedor-info">
                      <span className="pedido-proveedor-nombre">{pedidoCompleto.proveedores.nombre}</span>
                      {pedidoCompleto.proveedores.telefono && (
                        <span className="pedido-proveedor-contacto">{pedidoCompleto.proveedores.telefono}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {cliente && (
                <div className="pedido-info-card">
                  <h3 className="pedido-section-title">Cliente Relacionado</h3>
                  <div className="pedido-cliente-details">
                    <Icon name="user" className="pedido-cliente-icon" />
                    <div className="pedido-cliente-info">
                      <span className="pedido-cliente-nombre">{cliente.nombre}</span>
                      {cliente.telefono && (
                        <span className="pedido-cliente-contacto">{cliente.telefono}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {pedidoCompleto?.equipos && (
                <div className="pedido-info-card">
                  <h3 className="pedido-section-title">Equipo Relacionado</h3>
                  <div className="pedido-equipo-details">
                    <Icon name="laptop" className="pedido-equipo-icon" />
                    <div className="pedido-equipo-info">
                      <span className="pedido-equipo-nombre">
                        {pedidoCompleto.equipos.marca} {pedidoCompleto.equipos.modelo}
                      </span>
                      {pedidoCompleto.equipos.nota && (
                        <span className="pedido-equipo-nota">#{pedidoCompleto.equipos.nota}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="pedido-info-card">
                <h3 className="pedido-section-title">Fechas</h3>
                <div className="pedido-fechas-list">
                  {pedidoCompleto?.fecha_pedido && (
                    <div className="pedido-fecha-item">
                      <Icon name="calendar-alt" className="pedido-fecha-icon" />
                      <div className="pedido-fecha-content">
                        <span className="pedido-fecha-label">Fecha de Pedido</span>
                        <span className="pedido-fecha-value">{formatDate(pedidoCompleto.fecha_pedido)}</span>
                      </div>
                    </div>
                  )}
                  {pedidoCompleto?.fecha_estimada_llegada && (
                    <div className="pedido-fecha-item">
                      <Icon name="calendar-check" className="pedido-fecha-icon" />
                      <div className="pedido-fecha-content">
                        <span className="pedido-fecha-label">Llegada Estimada</span>
                        <span className="pedido-fecha-value">{formatDate(pedidoCompleto.fecha_estimada_llegada)}</span>
                      </div>
                    </div>
                  )}
                  {pedidoCompleto?.updated_at && (
                    <div className="pedido-fecha-item">
                      <Icon name="clock" className="pedido-fecha-icon" />
                      <div className="pedido-fecha-content">
                        <span className="pedido-fecha-label">Última Actualización</span>
                        <span className="pedido-fecha-value">{formatDate(pedidoCompleto.updated_at)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {historial.length > 0 && (
              <div className="pedido-historial-section">
                <h3 className="pedido-section-title">Actualizaciones</h3>
                <div className="pedido-historial-list">
                  {historial.map((item, index) => (
                    <div key={index} className="pedido-historial-item">
                      <div className="pedido-historial-icon">
                        <Icon name="comment" />
                      </div>
                      <div className="pedido-historial-content">
                        <p className="pedido-historial-mensaje">{item.mensaje}</p>
                        <span className="pedido-historial-fecha">{formatDate(item.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pedido-modal-footer">
            <div className="pedido-modal-actions">
              {pedidoCompleto?.estado === 'pendiente' && (
                <button
                  className="pedido-action-btn recibido"
                  onClick={handleMarcarRecibido}
                  disabled={loading}
                >
                  <Icon name="check-circle" />
                  Marcar como Recibido
                </button>
              )}
              {cliente?.telefono && (
                <button
                  className="pedido-action-btn contactar"
                  onClick={handleContactarCliente}
                >
                  <Icon name="phone" />
                  Contactar Cliente
                </button>
              )}
            </div>
            <button className="btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Contacto */}
      {showContactModal && (
        <div className="contact-modal-overlay" onClick={() => setShowContactModal(false)}>
          <div className="contact-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="contact-modal-close" 
              onClick={() => setShowContactModal(false)}
            >
              <Icon name="times" />
            </button>
            
            <div className="contact-modal-content">
              <div className="contact-modal-icon">
                <Icon name="user-circle" />
              </div>
              <h2 className="contact-modal-title">
                ¿Cómo deseas contactar a {contactData.nombreCliente}?
              </h2>
              <p className="contact-modal-description">
                Elige el método de contacto preferido
              </p>
              
              <div className="contact-modal-options">
                <button 
                  className="contact-option-btn"
                  onClick={handleContactarTelefono}
                >
                  <div className="contact-option-icon phone">
                    <Icon name="phone" />
                  </div>
                  <div className="contact-option-content">
                    <h3>Llamar por teléfono</h3>
                    <p>{contactData.telefono}</p>
                  </div>
                </button>
                
                <button 
                  className="contact-option-btn"
                  onClick={handleContactarWhatsApp}
                >
                  <div className="contact-option-icon whatsapp">
                    <Icon name="comment-dots" />
                  </div>
                  <div className="contact-option-content">
                    <h3>Enviar WhatsApp</h3>
                    <p>{contactData.telefono}</p>
                  </div>
                </button>
              </div>
              
              <button 
                className="contact-btn contact-btn-secondary contact-btn-full"
                onClick={() => setShowContactModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

