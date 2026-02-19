import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import NotaPDF from './NotaPDF.jsx';
import Icon from './Icon.jsx';
import './NotaPDFPage.css';

const NOTA_PDF_STORAGE_KEY = 'nota-pdf-data';

export default function NotaPDFPage({ demoMode = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfData, setPdfData] = useState(null);

  const state = location.state || (() => {
    try {
      const stored = sessionStorage.getItem(NOTA_PDF_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  })();

  useEffect(() => {
    if (!state) {
      return;
    }
    sessionStorage.setItem(NOTA_PDF_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const handlePdfReady = (data) => {
    setPdfData(data);
    setPdfReady(true);
  };

  const handleVolver = () => {
    sessionStorage.removeItem(NOTA_PDF_STORAGE_KEY);
    const returnTo = state?.returnTo || '/equipos';
    navigate(returnTo);
  };

  const handleImprimir = () => {
    const iframe = pdfData?.getIframe?.();
    if (iframe?.contentWindow) {
      iframe.contentWindow.print();
    } else {
      window.print();
    }
  };

  const handleDescargar = () => {
    if (pdfData?.blobUrl && pdfData?.fileName) {
      const link = document.createElement('a');
      link.href = pdfData.blobUrl;
      link.download = pdfData.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (!state?.equipo || !state?.tipo) {
    return (
      <div className="nota-pdf-page nota-pdf-page-error">
        <div className="nota-pdf-page-error-content">
          <Icon name="exclamation-triangle" />
          <h2>No hay datos para mostrar la nota</h2>
          <p>Ve al equipo y genera la nota de recepción o entrega nuevamente.</p>
          <button className="nota-pdf-page-btn" onClick={() => navigate('/equipos')}>
            <Icon name="arrow-left" />
            Volver a Equipos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="nota-pdf-page">
      <div className="nota-pdf-page-toolbar">
        <button
          type="button"
          className="nota-pdf-page-toolbar-btn"
          onClick={handleVolver}
        >
          <Icon name="arrow-left" />
          <span>Volver</span>
        </button>
        <div className="nota-pdf-page-toolbar-actions">
          <button
            type="button"
            className="nota-pdf-page-toolbar-btn nota-pdf-page-toolbar-btn-primary"
            onClick={handleImprimir}
            disabled={!pdfReady}
          >
            <Icon name="print" />
            <span>Imprimir</span>
          </button>
          <button
            type="button"
            className="nota-pdf-page-toolbar-btn nota-pdf-page-toolbar-btn-secondary"
            onClick={handleDescargar}
            disabled={!pdfReady}
          >
            <Icon name="download" />
            <span>Descargar PDF</span>
          </button>
        </div>
      </div>
      <div className="nota-pdf-page-content">
        <NotaPDF
          equipo={state.equipo}
          cliente={state.cliente}
          proveedor={state.proveedor}
          tipo={state.tipo}
          asPage
          onPdfReady={handlePdfReady}
          onClose={handleVolver}
        />
      </div>
    </div>
  );
}
