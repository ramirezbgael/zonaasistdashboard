import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import jsPDF from 'jspdf';
import './NotaPDF.css';

export default function NotaPDF({ equipo, cliente, proveedor, tipo, onClose }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfFileName, setPdfFileName] = useState(null);
  
  // Detectar si es un pedido, transcripción o documento
  const esPedido = equipo?.tipo === 'pedido' || equipo?.marca === 'Pedido';
  const esTranscripcion = equipo?.tipo === 'transcripcion' || equipo?.modelo === 'transcripcion';
  const esDocumento = equipo?.marca === 'Documento' || equipo?.tipo === 'documento' || esTranscripcion;
  
  // Para pedidos, usar proveedor si está disponible, sino usar cliente como fallback
  const infoProveedor = esPedido && proveedor ? proveedor : (esPedido && !cliente ? proveedor : null);
  const infoCliente = esPedido ? (cliente && cliente.nombre ? cliente : null) : cliente;

  // Generar PDF cuando el componente se monta
  useEffect(() => {
    generarPDF().catch(error => {
      console.error('Error al generar PDF:', error);
      alert('Error al generar el PDF. Por favor intenta de nuevo.');
    });
  }, []);

  // Paleta: B&W friendly, verde solo acento
  const colors = {
    black: [30, 30, 30],
    grayDark: [80, 80, 80],
    gray: [120, 120, 120],
    grayLight: [180, 180, 180],
    bgBlock: [248, 248, 248],
    bgCostos: [242, 248, 246], // verde muy suave
    accent: [16, 185, 129]     // verde logo
  };

  // Bloque visual: fondo claro + barra verde izquierda + título MAYÚSCULAS
  const drawBlock = (doc, opts) => {
    const { margin, contentWidth, yStart, title, contentHeight, accent = true } = opts;
    const pad = 4;
    const stripW = 2.5;
    const innerX = margin + (accent ? stripW + pad : pad) + 1;

    // Fondo del bloque
    doc.setFillColor(...(opts.bgColor || colors.bgBlock));
    doc.rect(margin, yStart, contentWidth, contentHeight, 'F');

    // Barra verde acento (izquierda)
    if (accent) {
      doc.setFillColor(...colors.accent);
      doc.rect(margin, yStart, stripW, contentHeight, 'F');
    }

    // Borde suave
    doc.setDrawColor(...colors.grayLight);
    doc.setLineWidth(0.2);
    doc.rect(margin, yStart, contentWidth, contentHeight, 'S');

    // Título en negrita MAYÚSCULAS
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.black);
    doc.text((title || '').toUpperCase(), innerX, yStart + 6);

    return { innerX, innerY: yStart + 10, innerW: contentWidth - (accent ? stripW + pad : pad) - 4 };
  };

  const generarPDF = async () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // ─── ENCABEZADO ─────────────────────────────────────────────────
      const headerH = 30;
      doc.setFillColor(...colors.bgBlock);
      doc.rect(0, 0, pageWidth, headerH + 6, 'F');
      doc.setDrawColor(...colors.accent);
      doc.setLineWidth(0.5);
      doc.line(margin, headerH + 6, pageWidth - margin, headerH + 6);

      let logoRight = margin;
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = '/logo.png';
        });
        if (img.width && img.height) {
          const lw = 28;
          const lh = (img.height / img.width) * lw;
          doc.addImage(img, 'PNG', margin, 5, lw, Math.min(lh, 25));
          logoRight = margin + lw + 8;
        }
      } catch (e) {
        console.warn('Logo no cargado:', e);
      }

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.black);
      doc.text('Asistencia en Sistemas Internet y Servicio Técnico', logoRight, 12);

      const tituloDoc = tipo === 'recepcion' ? 'Ficha de Recepción' : 'Ficha de Entrega y Garantía';
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(tituloDoc, logoRight, 19);

      const fechaRec = new Date(equipo?.created_at || Date.now()).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const fechaEnt = tipo === 'entrega' ? new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null;
      const meta = `Nota #${equipo.nota || 'N/A'}   ·   Tel. 722 437 71 08   ·   Recepción: ${fechaRec}${fechaEnt ? `   ·   Entrega: ${fechaEnt}` : ''}`;
      doc.setFontSize(9);
      doc.setTextColor(...colors.grayDark);
      const metaLines = doc.splitTextToSize(meta, pageWidth - margin - logoRight - 4);
      metaLines.forEach((line, i) => { doc.text(line, logoRight, 26 + i * 4.5); });
      y = headerH + 10 + metaLines.length * 4.5;

      // ─── BLOQUE 1: CLIENTE ──────────────────────────────────────────
      const h1 = 24;
      const r1 = drawBlock(doc, { margin, contentWidth, yStart: y, title: 'Cliente', contentHeight: h1 });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.black);
      const nom = infoCliente?.nombre || '—';
      const tel = infoCliente?.telefono ? `Tel. ${infoCliente.telefono}` : '';
      const mail = infoCliente?.email || '';
      doc.text(nom, r1.innerX, r1.innerY + 2);
      if (tel) doc.text(tel, r1.innerX, r1.innerY + 7);
      if (mail) doc.text(mail, r1.innerX, r1.innerY + (tel ? 12 : 7));
      y += h1 + 5;

      // ─── BLOQUE 2: DATOS DEL EQUIPO ─────────────────────────────────
      const h2 = 28;
      const r2 = drawBlock(doc, { margin, contentWidth, yStart: y, title: 'Datos del equipo', contentHeight: h2 });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.black);
      if (!esPedido && !esDocumento) {
        const tipoEq = equipo.tipo_equipo || 'Laptop';
        const marca = equipo.marca || '—';
        const modelo = equipo.modelo || '—';
        const det = equipo.color ? `${equipo.color}${equipo.detalles ? ', ' + equipo.detalles : ''}` : (equipo.detalles || '—');
        const pass = equipo.contraseña ? `Contraseña: ${equipo.contraseña}` : '';
        doc.text(`${tipoEq}   ·   ${marca}   ·   ${modelo}`, r2.innerX, r2.innerY + 2);
        doc.text(`Color / detalles: ${det}`, r2.innerX, r2.innerY + 7);
        if (pass) doc.text(pass, r2.innerX, r2.innerY + 12);
      } else {
        doc.text('—', r2.innerX, r2.innerY + 2);
      }
      y += h2 + 5;

      // ─── BLOQUE 3: SERVICIO (Problema, Detalle, Solución) ────────────
      // Problema reportado = procesos (lo que se cotizó / reportó)
      // Detalle = texto libre (equipo.problema: "Otro: Memoria de 8gb ddr3")
      // Solución implementada = texto confirmado en la nota (por defecto igual a Problema reportado)
      const procesosList = Array.isArray(equipo.procesos) ? equipo.procesos : (equipo.procesos ? [equipo.procesos] : []);
      const problema = procesosList.length ? procesosList.map(p => p?.nombre).filter(Boolean).join(', ') : null;
      const detalle = equipo.problema?.trim() || null;
      const solucionImplementada = (equipo.solucion_implementada?.trim() || problema || null);
      
      // 1) Problema reportado = procesos
      // 2) Detalle = equipo.problema
      // 3) Solución implementada = confirmado en modal (default = Problema reportado)
      const tieneProblema = problema && problema.length > 0;
      const tieneDetalle = detalle && detalle.length > 0;
      const tieneSolucion = tipo === 'entrega' && solucionImplementada && solucionImplementada.length > 0;
      
      if (tieneProblema || tieneDetalle || tieneSolucion) {
        const lineH = 5;
        const problemaLines = problema ? doc.splitTextToSize(problema, contentWidth - 20) : [];
        const detalleLines = detalle ? doc.splitTextToSize(detalle, contentWidth - 20) : [];
        const solucionLines = tieneSolucion ? doc.splitTextToSize(solucionImplementada, contentWidth - 20) : [];
        
        const problemaBlockH = tieneProblema ? (4 + 5.5 + problemaLines.length * lineH + 4) : 0;
        const detalleBlockH = tieneDetalle ? (4 + 5.5 + detalleLines.length * lineH + 4) : 0;
        const solucionBlockH = tieneSolucion ? (4 + 5.5 + solucionLines.length * lineH + 4) : 0;
        const h3 = 9 + 1 + 2 + problemaBlockH + detalleBlockH + solucionBlockH + 3;
        
        // Fondo con tinte sutil
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y, contentWidth, h3, 'F');
        doc.setFillColor(...colors.accent);
        doc.rect(margin, y, 3.5, h3, 'F');
        doc.setDrawColor(...colors.grayLight);
        doc.setLineWidth(0.3);
        doc.rect(margin, y, contentWidth, h3, 'S');
        
        // Título
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.black);
        doc.text('SERVICIO', margin + 8, y + 6);
        
        // Separador interno
        doc.setDrawColor(...colors.grayLight);
        doc.setLineWidth(0.2);
        doc.line(margin + 8, y + 9, pageWidth - margin - 8, y + 9);
        
        const innerX = margin + 10;
        let innerY = y + 12;
        
        // 1) Problema reportado
        if (tieneProblema && problemaLines.length > 0) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...colors.grayDark);
          doc.text('Problema reportado:', innerX, innerY);
          innerY += 5.5;
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...colors.black);
          problemaLines.forEach((line, i) => { doc.text(line, innerX + 2, innerY + i * lineH); });
          innerY += problemaLines.length * lineH + 4;
        }

        // 2) Detalle (procesos realizados)
        if (tieneDetalle && detalleLines.length > 0) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...colors.grayDark);
          doc.text('Detalle:', innerX, innerY);
          innerY += 5.5;
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...colors.black);
          detalleLines.forEach((line, i) => { doc.text(line, innerX + 2, innerY + i * lineH); });
          innerY += detalleLines.length * lineH + 4;
        }

        // 3) Solución implementada (solo en entrega)
        if (tieneSolucion && solucionLines.length > 0) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...colors.accent);
          doc.text('Solución implementada:', innerX, innerY);
          innerY += 5.5;
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...colors.black);
          solucionLines.forEach((line, i) => { doc.text(line, innerX + 2, innerY + i * lineH); });
        }
        
        y += h3 + 5;
      }

      // ─── BLOQUE 4: COSTOS (destacado) ───────────────────────────────
      if (tipo === 'entrega') {
        // Si hay total confirmado por el usuario, usarlo directamente
        const confirmado = parseFloat(equipo?.precio_total_confirmado);
        let totFinal;
        let tot;
        let pedidosTot;
        if (!isNaN(confirmado) && confirmado >= 0) {
          totFinal = confirmado;
          tot = equipo.precio_total;
          if (!tot && procesosList.length > 0) {
            tot = procesosList.reduce((sum, p) => sum + (parseFloat(p?.precio) || 0), 0);
          }
          tot = tot || 0;
          pedidosTot = (() => {
            if (typeof equipo?.pedidos_total === 'number') return equipo.pedidos_total;
            const pedidos = Array.isArray(equipo?.pedidos_ligados) ? equipo.pedidos_ligados : [];
            return pedidos.reduce((sum, p) => {
              const qty = parseFloat(p?.cantidad) || 0;
              const unit = parseFloat(p?.precio_unitario) || 0;
              return sum + qty * unit;
            }, 0);
          })();
        } else {
          tot = equipo.precio_total;
          if (!tot && procesosList.length > 0) {
            tot = procesosList.reduce((sum, p) => {
              const precio = parseFloat(p?.precio) || 0;
              return sum + precio;
            }, 0);
          }
          tot = tot || 0;
          pedidosTot = (() => {
            if (typeof equipo?.pedidos_total === 'number') return equipo.pedidos_total;
            const pedidos = Array.isArray(equipo?.pedidos_ligados) ? equipo.pedidos_ligados : [];
            return pedidos.reduce((sum, p) => {
              const qty = parseFloat(p?.cantidad) || 0;
              const unit = parseFloat(p?.precio_unitario) || 0;
              return sum + qty * unit;
            }, 0);
          })();
          totFinal = (parseFloat(tot) || 0) + (parseFloat(pedidosTot) || 0);
        }

        const ant = equipo.adelanto || 0;
        const ade = totFinal - ant;
        const estado = equipo.pago_full ? 'Pagado' : 'Pendiente';
        const costosStr = pedidosTot > 0
          ? `Servicios: $${Number(tot).toFixed(2)}   ·   Refacciones: $${Number(pedidosTot).toFixed(2)}   ·   Total: $${Number(totFinal).toFixed(2)}   ·   Anticipo: $${Number(ant).toFixed(2)}   ·   Adeudo: $${Number(ade).toFixed(2)}   ·   ${estado}`
          : `Total: $${Number(totFinal).toFixed(2)}   ·   Anticipo: $${Number(ant).toFixed(2)}   ·   Adeudo: $${Number(ade).toFixed(2)}   ·   ${estado}`;
        const costosLines = doc.splitTextToSize(costosStr, contentWidth - 16);
        const h4 = 12 + costosLines.length * 5;
        doc.setFillColor(...colors.bgCostos);
        doc.rect(margin, y, contentWidth, h4, 'F');
        doc.setFillColor(...colors.accent);
        doc.rect(margin, y, 3.5, h4, 'F');
        doc.setDrawColor(...colors.accent);
        doc.setLineWidth(0.5);
        doc.rect(margin, y, contentWidth, h4, 'S');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.black);
        doc.text('COSTOS', margin + 10, y + 6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        costosLines.forEach((line, i) => { doc.text(line, margin + 10, y + 14 + i * 5); });
        y += h4 + 5;
      }

      // ─── BLOQUE 5: GARANTÍA (estilo póliza premium) ──────────────────
      const garantiaPuntos = [
        'Garantía de 1 mes en software (sistema operativo, drivers y programas).',
        'Garantía de 1 año en hardware únicamente en piezas reemplazadas.',
        'Los respaldos de información se conservan por 30 días.',
        'Este documento es indispensable para hacer válida la garantía.'
      ];
      
      // Calcular altura necesaria
      let garTotalH = 12;
      garantiaPuntos.forEach(punto => {
        const lines = doc.splitTextToSize(punto, contentWidth - 30);
        garTotalH += lines.length * 4 + 2;
      });
      
      // Fondo con tinte sutil tipo póliza
      doc.setFillColor(252, 252, 252);
      doc.rect(margin, y, contentWidth, garTotalH, 'F');
      doc.setFillColor(...colors.accent);
      doc.rect(margin, y, 3.5, garTotalH, 'F');
      doc.setDrawColor(...colors.grayLight);
      doc.setLineWidth(0.3);
      doc.rect(margin, y, contentWidth, garTotalH, 'S');
      
      // Título
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.black);
      doc.text('GARANTÍA', margin + 8, y + 6);
      
      // Separador interno
      doc.setDrawColor(...colors.grayLight);
      doc.setLineWidth(0.2);
      doc.line(margin + 8, y + 9, pageWidth - margin - 8, y + 9);
      
      const garX = margin + 12;
      let garY = y + 13;
      
      // Puntos numerados con estilo póliza
      garantiaPuntos.forEach((punto, idx) => {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.accent);
        doc.text(`${idx + 1}.`, garX, garY);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.grayDark);
        const puntoLines = doc.splitTextToSize(punto, contentWidth - 30);
        puntoLines.forEach((line, i) => {
          doc.text(line, garX + 5, garY + i * 4);
        });
        garY += puntoLines.length * 4 + 3;
      });
      
      y += garTotalH + 5;

      // ─── BLOQUE 6: FIRMA ────────────────────────────────────────────
      doc.setDrawColor(...colors.grayLight);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.black);
      doc.text('Firma del cliente: _________________________________________', margin, y);
      y += 8;

      // Pie
      doc.setFontSize(8);
      doc.setTextColor(...colors.gray);
      doc.text('Gracias por confiar en Zona Asist · Síguenos en Facebook', margin, pageHeight - 10);

      const pdfDataUri = doc.output('datauristring');
      const fileName = `Nota_${tipo === 'recepcion' ? 'Recepcion' : 'Entrega'}_${equipo.nota}_${new Date().toISOString().split('T')[0]}.pdf`;
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      setPdfUrl({ dataUri: pdfDataUri, blobUrl });
      setPdfFileName(fileName);
    } catch (error) {
      console.error('Error al generar PDF:', error);
      alert('Error al generar el PDF. Por favor intenta de nuevo.');
    }
  };

  return createPortal(
    <div className="nota-pdf-container">
      <div className="nota-pdf-content">
        <div className="nota-pdf-header">
          <h2>{tipo === 'recepcion' ? 'Nota de Recepción' : 'Nota de Entrega'}</h2>
          <button type="button" onClick={onClose} className="nota-pdf-close-btn" aria-label="Cerrar">×</button>
        </div>
        <div className="nota-pdf-info">
          <p>El PDF está listo para abrir o descargar.</p>
          {pdfUrl ? (
            <>
              <div className="nota-pdf-buttons">
                <button
                  type="button"
                  onClick={() => {
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
                  type="button"
                  onClick={() => {
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
                <button type="button" onClick={onClose} className="nota-pdf-btn-close">Cerrar</button>
              </div>
            </>
          ) : (
            <p className="nota-pdf-loading">Generando PDF...</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

