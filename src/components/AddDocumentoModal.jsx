import { useState } from 'react';
import { supabase } from '../supabase.js';
import './AddEquipoModalTypeform.css';
import Icon from './Icon.jsx';

export default function AddDocumentoModal({ onClose, onDocumentoAdded }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    tipo_documento: '',
    cliente_nombre: '',
    cliente_telefono: '',
    descripcion: '',
    fecha_entrega: ''
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // TODO: Implementar lógica de inserción cuando esté la tabla lista
      console.log('Datos del documento:', formData);
      
      // Simular guardado
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onDocumentoAdded();
      onClose();
    } catch (error) {
      console.error('Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const progressPercentage = ((currentStep + 1) / 4) * 100;

  const steps = [
    { title: '¿Qué tipo de documento es?', description: 'Selecciona el tipo de documento o transcripción' },
    { title: '¿Cuál es el nombre del cliente?', description: 'Ingresa el nombre del cliente' },
    { title: '¿Cuál es el teléfono del cliente?', description: 'Ingresa el número de contacto' },
    { title: '¿Cuándo debe entregarse?', description: 'Fecha límite de entrega (opcional)' }
  ];

  const handleClose = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="typeform-modal-overlay" onClick={handleClose}>
      <div className="typeform-modal" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="typeform-close-btn">×</button>

        <div className="typeform-progress">
          <div
            className="typeform-progress-bar"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>

        <div className="typeform-step-indicator">
          Paso {currentStep + 1} de 4
        </div>

        <div className="typeform-step typeform-single-field">
          {currentStep === 0 && (
            <>
              <h2 className="typeform-question">{steps[0].title}</h2>
              <p className="typeform-description">{steps[0].description}</p>
              <div className="typeform-field-wrapper">
                <select
                  name="tipo_documento"
                  value={formData.tipo_documento}
                  onChange={handleInputChange}
                  autoFocus
                  className="typeform-large-input typeform-select"
                  required
                >
                  <option value="">Selecciona un tipo...</option>
                  <option value="transcripcion">Transcripción</option>
                  <option value="factura">Factura</option>
                  <option value="cotizacion">Cotización</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              {formData.tipo_documento && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="typeform-btn-primary typeform-next-btn"
                >
                  Continuar <Icon name="arrow-right" />
                </button>
              )}
            </>
          )}

          {currentStep === 1 && (
            <>
              <h2 className="typeform-question">{steps[1].title}</h2>
              <p className="typeform-description">{steps[1].description}</p>
              <div className="typeform-field-wrapper">
                <input
                  type="text"
                  name="cliente_nombre"
                  value={formData.cliente_nombre}
                  onChange={handleInputChange}
                  placeholder="Escribe el nombre completo..."
                  required
                  autoFocus
                  className="typeform-large-input"
                />
              </div>
              <div className="typeform-buttons-horizontal">
                <button
                  type="button"
                  onClick={handleBack}
                  className="typeform-btn-secondary"
                >
                  <Icon name="arrow-left" /> Volver
                </button>
                {formData.cliente_nombre && (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="typeform-btn-primary"
                  >
                    Continuar <Icon name="arrow-right" />
                  </button>
                )}
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              <h2 className="typeform-question">{steps[2].title}</h2>
              <p className="typeform-description">{steps[2].description}</p>
              <div className="typeform-field-wrapper">
                <input
                  type="tel"
                  name="cliente_telefono"
                  value={formData.cliente_telefono}
                  onChange={handleInputChange}
                  placeholder="Ej: 5551234567"
                  required
                  autoFocus
                  className="typeform-large-input"
                />
              </div>
              <div className="typeform-buttons-horizontal">
                <button
                  type="button"
                  onClick={handleBack}
                  className="typeform-btn-secondary"
                >
                  <Icon name="arrow-left" /> Volver
                </button>
                {formData.cliente_telefono && (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="typeform-btn-primary"
                  >
                    Continuar <Icon name="arrow-right" />
                  </button>
                )}
              </div>
            </>
          )}

          {currentStep === 3 && (
            <>
              <h2 className="typeform-question">{steps[3].title}</h2>
              <p className="typeform-description">{steps[3].description}</p>
              <div className="typeform-field-wrapper">
                <input
                  type="date"
                  name="fecha_entrega"
                  value={formData.fecha_entrega}
                  onChange={handleInputChange}
                  autoFocus
                  className="typeform-large-input"
                />
              </div>
              <div className="typeform-field-wrapper">
                <textarea
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleInputChange}
                  placeholder="Descripción adicional (opcional)..."
                  className="typeform-large-textarea"
                  rows="4"
                />
              </div>
              <div className="typeform-buttons-horizontal">
                <button
                  type="button"
                  onClick={handleBack}
                  className="typeform-btn-secondary"
                >
                  <Icon name="arrow-left" /> Volver
                </button>
                <form onSubmit={handleSubmit} style={{ display: 'inline' }}>
                  <button
                    type="submit"
                    className="typeform-btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Guardando...' : <><Icon name="check" /> Agregar Documento</>}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

