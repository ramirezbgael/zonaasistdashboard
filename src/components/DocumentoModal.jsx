import { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';
import './DocumentoModal.css';

export default function DocumentoModal({ documento, onClose, onDocumentoUpdated }) {
  const [documentoCompleto, setDocumentoCompleto] = useState(documento);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cliente, setCliente] = useState(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactData, setContactData] = useState({ telefono: null, nombreCliente: 'el cliente' });

  useEffect(() => {
    if (documento?.id) {
      loadDocumentoCompleto();
    }
  }, [documento?.id]);

  useEffect(() => {
    if (documentoCompleto) {
      loadCliente();
      loadHistorial();
    }
  }, [documentoCompleto]);

  const loadDocumentoCompleto = async () => {
    try {
      const { data, error } = await supabase
        .from('servicios_documentos')
        .select(`
          *,
          clientes (
            id,
            nombre,
            telefono,
            email
          )
        `)
        .eq('id', documento.id)
        .single();

      if (error) throw error;
      setDocumentoCompleto(data);
    } catch (error) {
      console.error('Error loading documento completo:', error);
    }
  };

  const loadHistorial = async () => {
    if (!documentoCompleto?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('comentarios')
        .select('*')
        .eq('modulo', 'documentos')
        .eq('referencia_id', documentoCompleto.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Tabla comentarios no disponible, usando historial básico');
        const historialBasico = [];
        
        if (documentoCompleto?.created_at) {
          historialBasico.push({
            mensaje: 'Documento creado',
            created_at: documentoCompleto.created_at
          });
        }
        
        if (documentoCompleto?.updated_at && documentoCompleto.updated_at !== documentoCompleto.created_at) {
          historialBasico.push({
            mensaje: `Estado actualizado a: ${documentoCompleto.estado}`,
            created_at: documentoCompleto.updated_at
          });
        }
        
        setHistorial(historialBasico);
        return;
      }
      
      const historialBasico = [];
      
      if (documentoCompleto?.created_at) {
        historialBasico.push({
          mensaje: 'Documento creado',
          created_at: documentoCompleto.created_at
        });
      }
      
      if (documentoCompleto?.updated_at && documentoCompleto.updated_at !== documentoCompleto.created_at) {
        historialBasico.push({
          mensaje: `Estado actualizado a: ${documentoCompleto.estado}`,
          created_at: documentoCompleto.updated_at
        });
      }
      
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
      if (documentoCompleto?.clientes) {
        setCliente(documentoCompleto.clientes);
      } else if (documentoCompleto?.cliente_id) {
        const { data, error } = await supabase
          .from('clientes')
          .select('id, nombre, telefono, email')
          .eq('id', documentoCompleto.cliente_id)
          .single();

        if (!error && data) {
          setCliente(data);
        }
      }
    } catch (error) {
      console.error('Error loading cliente:', error);
    }
  };

  const handleMarcarCompletado = async () => {
    if (!confirm('¿Confirmas que el documento ha sido completado?')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('servicios_documentos')
        .update({
          estado: 'completado',
          fecha_entrega: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', documento.id);

      if (error) throw error;

      try {
        await supabase
          .from('comentarios')
          .insert({
            modulo: 'documentos',
            referencia_id: documento.id,
            mensaje: 'Documento marcado como completado'
          });
      } catch (histError) {
        console.error('Error agregando al historial:', histError);
      }

      alert('Documento marcado como completado');
      onDocumentoUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error marcando documento como completado:', error);
      alert('Error al marcar el documento como completado');
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
    const mensaje = encodeURIComponent(`Hola ${contactData.nombreCliente}! Te escribo de Zona Asist sobre el documento de ${getTipoServicioLabel(documentoCompleto?.tipo_servicio || documento?.tipo_servicio)}. ¡Saludos!`);
    window.open(`https://wa.me/52${contactData.telefono}?text=${mensaje}`, '_blank');
    setShowContactModal(false);
  };

  const getTipoServicioLabel = (tipo) => {
    const tipos = {
      'transcripcion': 'Transcripción',
      'factura': 'Factura',
      'cotizacion': 'Cotización'
    };
    return tipos[tipo] || tipo?.charAt(0).toUpperCase() + tipo?.slice(1) || 'Documento';
  };

  const getTipoIcon = (tipo) => {
    const icons = {
      'transcripcion': 'file-alt',
      'factura': 'file-invoice',
      'cotizacion': 'file-contract'
    };
    return icons[tipo] || 'file-alt';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Mexico_City'
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
      <div className="documento-modal-overlay" onClick={handleOverlayClick}>
        <div className="documento-modal" onClick={(e) => e.stopPropagation()}>
          <div className="documento-modal-header">
            <div className="documento-modal-header-info">
              <h2>Detalles del Documento</h2>
              <p className="documento-modal-subtitle">
                {getTipoServicioLabel(documentoCompleto?.tipo_servicio || documento?.tipo_servicio)}
              </p>
            </div>
            <button className="documento-modal-close-btn" onClick={onClose}>
              ×
            </button>
          </div>

          <div className="documento-modal-content">
            <div className="documento-info-section">
              <div className="documento-info-card">
                <h3 className="documento-section-title">Información del Documento</h3>
                <div className="documento-info-grid">
                  <div className="documento-info-item">
                    <Icon name={getTipoIcon(documentoCompleto?.tipo_servicio || documento?.tipo_servicio)} className="documento-info-icon" />
                    <div className="documento-info-content">
                      <span className="documento-info-label">Tipo de Servicio</span>
                      <span className="documento-info-value">
                        {getTipoServicioLabel(documentoCompleto?.tipo_servicio || documento?.tipo_servicio)}
                      </span>
                    </div>
                  </div>
                  <div className="documento-info-item">
                    <Icon name="info-circle" className="documento-info-icon" />
                    <div className="documento-info-content">
                      <span className="documento-info-label">Estado</span>
                      <span className="documento-info-value">
                        {documentoCompleto?.estado === 'completado' ? 'Completado' : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                  {documentoCompleto?.precio && (
                    <div className="documento-info-item">
                      <Icon name="dollar-sign" className="documento-info-icon" />
                      <div className="documento-info-content">
                        <span className="documento-info-label">Precio</span>
                        <span className="documento-info-value">{formatCurrency(documentoCompleto.precio)}</span>
                      </div>
                    </div>
                  )}
                </div>
                {documentoCompleto?.descripcion && (
                  <div className="documento-descripcion-detalle">
                    <Icon name="align-left" className="documento-descripcion-icon" />
                    <div className="documento-descripcion-content">
                      <span className="documento-descripcion-label">Descripción</span>
                      <p className="documento-descripcion-text">{documentoCompleto.descripcion}</p>
                    </div>
                  </div>
                )}
              </div>

              {cliente && (
                <div className="documento-info-card">
                  <h3 className="documento-section-title">Cliente</h3>
                  <div className="documento-cliente-details">
                    <Icon name="user" className="documento-cliente-icon" />
                    <div className="documento-cliente-info">
                      <span className="documento-cliente-nombre">{cliente.nombre}</span>
                      {cliente.telefono && (
                        <span className="documento-cliente-contacto">{cliente.telefono}</span>
                      )}
                      {cliente.email && (
                        <span className="documento-cliente-email">{cliente.email}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="documento-info-card">
                <h3 className="documento-section-title">Fechas</h3>
                <div className="documento-fechas-list">
                  {documentoCompleto?.fecha_inicio && (
                    <div className="documento-fecha-item">
                      <Icon name="calendar-alt" className="documento-fecha-icon" />
                      <div className="documento-fecha-content">
                        <span className="documento-fecha-label">Fecha de Inicio</span>
                        <span className="documento-fecha-value">{formatDate(documentoCompleto.fecha_inicio)}</span>
                      </div>
                    </div>
                  )}
                  {documentoCompleto?.fecha_entrega && (
                    <div className="documento-fecha-item">
                      <Icon name="calendar-check" className="documento-fecha-icon" />
                      <div className="documento-fecha-content">
                        <span className="documento-fecha-label">Fecha de Entrega</span>
                        <span className="documento-fecha-value">{formatDate(documentoCompleto.fecha_entrega)}</span>
                      </div>
                    </div>
                  )}
                  {documentoCompleto?.updated_at && (
                    <div className="documento-fecha-item">
                      <Icon name="clock" className="documento-fecha-icon" />
                      <div className="documento-fecha-content">
                        <span className="documento-fecha-label">Última Actualización</span>
                        <span className="documento-fecha-value">{formatDate(documentoCompleto.updated_at)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {documentoCompleto?.archivos && Array.isArray(documentoCompleto.archivos) && documentoCompleto.archivos.length > 0 && (
                <div className="documento-info-card">
                  <h3 className="documento-section-title">Archivos</h3>
                  <div className="documento-archivos-list">
                    {documentoCompleto.archivos.map((archivo, index) => (
                      <a
                        key={index}
                        href={archivo.url || archivo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="documento-archivo-item"
                      >
                        <Icon name="file" className="documento-archivo-icon" />
                        <span className="documento-archivo-name">
                          {archivo.name || archivo || `Archivo ${index + 1}`}
                        </span>
                        <Icon name="external-link-alt" className="documento-archivo-link-icon" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {historial.length > 0 && (
              <div className="documento-historial-section">
                <h3 className="documento-section-title">Actualizaciones</h3>
                <div className="documento-historial-list">
                  {historial.map((item, index) => (
                    <div key={index} className="documento-historial-item">
                      <div className="documento-historial-icon">
                        <Icon name="comment" />
                      </div>
                      <div className="documento-historial-content">
                        <p className="documento-historial-mensaje">{item.mensaje}</p>
                        <span className="documento-historial-fecha">{formatDate(item.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="documento-modal-footer">
            <div className="documento-modal-actions">
              {documentoCompleto?.estado === 'pendiente' && (
                <button
                  className="documento-action-btn completado"
                  onClick={handleMarcarCompletado}
                  disabled={loading}
                >
                  <Icon name="check-circle" />
                  Marcar como Completado
                </button>
              )}
              {cliente?.telefono && (
                <button
                  className="documento-action-btn contactar"
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

