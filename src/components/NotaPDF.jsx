import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import jsPDF from 'jspdf';
import './NotaPDF.css';

export default function NotaPDF({ equipo, cliente, proveedor, tipo, onClose }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfFileName, setPdfFileName] = useState(null);
  const canvasRef = useRef(null);
  
  // Detectar si es un pedido, transcripción o documento
  const esPedido = equipo?.tipo === 'pedido' || equipo?.marca === 'Pedido';
  const esTranscripcion = equipo?.tipo === 'transcripcion' || equipo?.modelo === 'transcripcion';
  const esDocumento = equipo?.marca === 'Documento' || equipo?.tipo === 'documento' || esTranscripcion;
  
  // Para pedidos, usar proveedor si está disponible, sino usar cliente como fallback
  const infoProveedor = esPedido && proveedor ? proveedor : (esPedido && !cliente ? proveedor : null);
  const infoCliente = esPedido ? (cliente && cliente.nombre ? cliente : null) : cliente;

  // Generar PDF cuando el componente se monta
  useEffect(() => {
    generarPDF();
  }, []);

  const generarPDF = () => {
    try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = margin;

    // Colores
    const primaryColor = [16, 185, 129]; // Verde
    const darkColor = [30, 41, 59]; // Gris oscuro
    const lightGray = [241, 245, 249]; // Gris claro

    // Encabezado con fondo de color
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Logo/Título
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('ZONA ASIST', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text(
      tipo === 'recepcion' ? 'NOTA DE RECEPCIÓN' : 'NOTA DE ENTREGA',
      pageWidth / 2,
      35,
      { align: 'center' }
    );

    yPosition = 60;

    // Información de la nota
    doc.setTextColor(...darkColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Usar la fecha de creación del equipo/documento/pedido, no la fecha actual
    const fechaCreacion = equipo?.created_at || equipo?.fecha_inicio || new Date().toISOString();
    const fechaFormateada = new Date(fechaCreacion).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`Fecha: ${fechaFormateada}`, margin, yPosition);
    doc.text(`Nota #${equipo.nota}`, pageWidth - margin, yPosition, { align: 'right' });

    yPosition += 15;

    // Línea separadora
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);

    yPosition += 10;

    // Información del Cliente (para equipos o pedidos con cliente asociado)
    if (!esPedido || (esPedido && infoCliente)) {
      doc.setFillColor(...lightGray);
      doc.rect(margin, yPosition - 5, contentWidth, 8, 'F');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkColor);
      doc.text('INFORMACIÓN DEL CLIENTE', margin, yPosition);

      yPosition += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      if (infoCliente) {
        doc.text(`Nombre: ${infoCliente.nombre || 'N/A'}`, margin, yPosition);
        yPosition += 7;
        
        if (infoCliente.telefono) {
          doc.text(`Teléfono: ${infoCliente.telefono}`, margin, yPosition);
          yPosition += 7;
        }
        
        if (infoCliente.email) {
          doc.text(`Email: ${infoCliente.email}`, margin, yPosition);
          yPosition += 7;
        }
      } else if (!esPedido) {
        doc.text('Cliente: No especificado', margin, yPosition);
        yPosition += 7;
      }

      yPosition += 5;
    }

    // Información del Equipo/Pedido/Documento
    doc.setFillColor(...lightGray);
    doc.rect(margin, yPosition - 5, contentWidth, 8, 'F');
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    let tituloSeccion = 'INFORMACIÓN DEL EQUIPO';
    if (esPedido) {
      tituloSeccion = 'INFORMACIÓN DEL PEDIDO';
    } else if (esDocumento) {
      tituloSeccion = 'INFORMACIÓN DEL DOCUMENTO';
    }
    doc.text(tituloSeccion, margin, yPosition);

    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    if (esPedido) {
      // Información de pedido
      doc.text(`Producto/Pieza: ${equipo.modelo || 'N/A'}`, margin, yPosition);
      yPosition += 7;
      
      if (equipo.cantidad) {
        doc.text(`Cantidad: ${equipo.cantidad}`, margin, yPosition);
        yPosition += 7;
      }
      
      if (equipo.problema) {
        doc.text(`Notas: ${equipo.problema}`, margin, yPosition);
        yPosition += 7;
      }
    } else if (esDocumento) {
      // Información de documento
      const tipoDocumento = equipo.modelo || 'N/A';
      const tipoDisplay = tipoDocumento.charAt(0).toUpperCase() + tipoDocumento.slice(1);
      doc.text(`Tipo de servicio: ${tipoDisplay}`, margin, yPosition);
      yPosition += 7;
      
      if (equipo.problema) {
        doc.text(`Descripción: ${equipo.problema}`, margin, yPosition);
        yPosition += 7;
      }
    } else {
      // Información de equipo
      doc.text(`Marca: ${equipo.marca || 'N/A'}`, margin, yPosition);
      yPosition += 7;
      
      doc.text(`Modelo: ${equipo.modelo || 'N/A'}`, margin, yPosition);
      yPosition += 7;
      
      if (equipo.color) {
        doc.text(`Color: ${equipo.color}`, margin, yPosition);
        yPosition += 7;
      }
      
      if (equipo.problema) {
        doc.text(`Problema reportado: ${equipo.problema}`, margin, yPosition);
        yPosition += 7;
      }
    }

    yPosition += 5;

    // Información de Pago (para pedidos y transcripciones)
    if ((esPedido || esTranscripcion) && (equipo.precio_total || equipo.adelanto)) {
      doc.setFillColor(...lightGray);
      doc.rect(margin, yPosition - 5, contentWidth, 8, 'F');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkColor);
      doc.text('INFORMACIÓN DE PAGO', margin, yPosition);

      yPosition += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      if (equipo.precio_total) {
        doc.text(`Precio Total: $${parseFloat(equipo.precio_total || 0).toFixed(2)}`, margin, yPosition);
        yPosition += 7;
      }
      
      if (equipo.adelanto || equipo.pago_full) {
        const adelanto = equipo.pago_full ? equipo.precio_total : (equipo.adelanto || 0);
        doc.text(`Adelanto: $${parseFloat(adelanto || 0).toFixed(2)}`, margin, yPosition);
        yPosition += 7;
        
        if (equipo.pago_full) {
          doc.setTextColor(40, 167, 69); // Verde
          doc.setFont('helvetica', 'bold');
          doc.text('✓ PAGO COMPLETO', margin, yPosition);
          doc.setTextColor(...darkColor);
          doc.setFont('helvetica', 'normal');
          yPosition += 7;
        } else if (equipo.precio_total) {
          const restante = parseFloat(equipo.precio_total || 0) - parseFloat(adelanto || 0);
          doc.text(`Restante: $${restante.toFixed(2)}`, margin, yPosition);
          yPosition += 7;
        }
      }

      yPosition += 5;
    }

    // Estado y proceso
    if (equipo.proceso_actual_id || equipo.procesos) {
      doc.setFillColor(...lightGray);
      doc.rect(margin, yPosition - 5, contentWidth, 8, 'F');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('PROCESO', margin, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      if (equipo.procesos) {
        doc.text(`Proceso: ${equipo.procesos.nombre || 'N/A'}`, margin, yPosition);
        yPosition += 7;
      }
    }

    yPosition += 10;

    // Observaciones
    doc.setFillColor(...lightGray);
    doc.rect(margin, yPosition - 5, contentWidth, 8, 'F');
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVACIONES', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    let observaciones = '';
    if (esPedido) {
      observaciones = tipo === 'recepcion' 
        ? 'Pedido recibido del proveedor. Se procederá con la verificación y almacenamiento según corresponda.'
        : 'Pedido entregado/completado según lo acordado.';
    } else if (esDocumento) {
      observaciones = tipo === 'recepcion'
        ? 'Documento recibido en las condiciones descritas. Se procederá con el procesamiento según corresponda.'
        : 'Documento entregado al cliente. Trabajo completado según lo acordado.';
    } else {
      observaciones = tipo === 'recepcion' 
        ? 'Equipo recibido en las condiciones descritas. Se procederá con la revisión y reparación según corresponda.'
        : 'Equipo entregado al cliente en buen estado. Trabajo completado según lo acordado.';
    }

    const observacionesLines = doc.splitTextToSize(observaciones, contentWidth);
    observacionesLines.forEach(line => {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += 7;
    });

    yPosition += 10;

    // Firmas
    if (yPosition > pageHeight - 50) {
      doc.addPage();
      yPosition = margin;
    }

    const firmaWidth = contentWidth / 2 - 5;
    const firmaX1 = margin;
    const firmaX2 = pageWidth / 2 + 5;

    // Firma Cliente
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.rect(firmaX1, yPosition, firmaWidth, 30, 'S');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkColor);
    doc.text('Firma del Cliente', firmaX1 + firmaWidth / 2, yPosition + 5, { align: 'center' });
    doc.text('_____________________', firmaX1 + firmaWidth / 2, yPosition + 20, { align: 'center' });

    // Firma Técnico
    doc.rect(firmaX2, yPosition, firmaWidth, 30, 'S');
    doc.text('Firma del Técnico', firmaX2 + firmaWidth / 2, yPosition + 5, { align: 'center' });
    doc.text('_____________________', firmaX2 + firmaWidth / 2, yPosition + 20, { align: 'center' });

    // Pie de página
    const footerY = pageHeight - 15;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      'Este documento es una copia generada automáticamente por el sistema Zona Asist',
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );

      // Generar el PDF y crear URL usando base64 para evitar problemas con blob en Safari
      const pdfDataUri = doc.output('datauristring');
      const fileName = `Nota_${tipo === 'recepcion' ? 'Recepcion' : 'Entrega'}_${equipo.nota}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // También crear blob para descarga
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      
      setPdfUrl({ dataUri: pdfDataUri, blobUrl: blobUrl });
      setPdfFileName(fileName);
    } catch (error) {
      console.error('Error al generar PDF:', error);
      alert('Error al generar el PDF. Por favor intenta de nuevo.');
    }
  };

  console.log('[NotaPDF] Render modal:', { tipo, equipo, cliente });
  return createPortal(
    <div className="nota-pdf-container" style={{ zIndex: 9999, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(20,20,20,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="nota-pdf-content" style={{ background: '#222', color: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', maxWidth: 420, width: '100%', padding: 32, position: 'relative' }}>
        <div className="nota-pdf-header">
          <h2>{tipo === 'recepcion' ? 'Nota de Recepción' : 'Nota de Entrega'}</h2>
          <button onClick={onClose} className="nota-pdf-close-btn" style={{ position: 'absolute', top: 16, right: 16, fontSize: 24, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>×</button>
        </div>
        <div className="nota-pdf-info">
          <p>El PDF está listo para abrir o descargar.</p>
          {pdfUrl ? (
            <>
              <div className="nota-pdf-buttons">
                <button
                  onClick={() => {
                    console.log('[NotaPDF] Abrir PDF:', pdfFileName);
                    try {
                      const newWindow = window.open('', '_blank');
                      if (newWindow) {
                        newWindow.document.write(`
                          <!DOCTYPE html>
                          <html><head><title>${pdfFileName}</title></head><body style='margin:0'><iframe src='${pdfUrl.dataUri}' type='application/pdf' style='width:100vw;height:100vh;border:none'></iframe></body></html>
                        `);
                        newWindow.document.close();
                      } else {
                        alert('Por favor permite ventanas emergentes para abrir el PDF, o usa el botón de descarga.');
                      }
                    } catch (error) {
                      alert('Error al abrir el PDF. Por favor usa el botón de descarga.');
                    }
                  }}
                  className="nota-pdf-btn-primary"
                >📄 Abrir PDF en nueva pestaña</button>
                <button
                  onClick={() => {
                    console.log('[NotaPDF] Descargar PDF:', pdfFileName);
                    const link = document.createElement('a');
                    link.href = pdfUrl.blobUrl;
                    link.download = pdfFileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => { URL.revokeObjectURL(pdfUrl.blobUrl); }, 1000);
                  }}
                  className="nota-pdf-btn-secondary"
                >💾 Descargar PDF</button>
                <button onClick={() => { console.log('[NotaPDF] Cerrar modal'); onClose(); }} className="nota-pdf-btn-close">Cerrar</button>
              </div>
            </>
          ) : (
            <p style={{ textAlign: 'center', fontSize: 18, margin: '32px 0' }}>Generando PDF...</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

