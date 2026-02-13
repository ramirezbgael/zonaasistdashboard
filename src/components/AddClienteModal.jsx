import { useState } from 'react';
import { supabase } from '../supabase.js';
import { addCliente as addClienteDemo } from '../utils/demoStorage.js';
import './AddEquipoModalTypeform.css';
import Icon from './Icon.jsx';

export default function AddClienteModal({ onClose, onClienteAdded, demoMode = false }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    direccion: ''
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
      if (!formData.nombre || !formData.telefono) {
        alert('Por favor completa nombre y teléfono');
        setLoading(false);
        return;
      }

      if (demoMode) {
        addClienteDemo({
          nombre: formData.nombre.trim(),
          telefono: formData.telefono.trim(),
          email: formData.email.trim() || null,
          direccion: formData.direccion.trim() || null,
        });
        onClienteAdded();
        onClose();
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('clientes')
        .insert([{
          nombre: formData.nombre.trim(),
          telefono: formData.telefono.trim(),
          email: formData.email.trim() || null,
          direccion: formData.direccion.trim() || null
        }]);

      if (error) {
        if (error.code === '23505') {
          alert('Ya existe un cliente con este teléfono');
        } else {
          throw error;
        }
      } else {
        onClienteAdded();
        onClose();
      }
    } catch (error) {
      console.error('Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const progressPercentage = ((currentStep + 1) / 4) * 100;

  const steps = [
    { title: '¿Cuál es el nombre del cliente?', description: 'Ingresa el nombre completo' },
    { title: '¿Cuál es el teléfono?', description: 'Número de contacto principal' },
    { title: '¿Cuál es el email?', description: 'Correo electrónico (opcional)' },
    { title: '¿Cuál es la dirección?', description: 'Dirección completa (opcional)' }
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
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  placeholder="Escribe el nombre completo..."
                  required
                  autoFocus
                  className="typeform-large-input"
                />
              </div>
              {formData.nombre && (
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
                  type="tel"
                  name="telefono"
                  value={formData.telefono}
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
                {formData.telefono && (
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
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="cliente@ejemplo.com"
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
                <button
                  type="button"
                  onClick={handleNext}
                  className="typeform-btn-primary"
                >
                  Continuar <Icon name="arrow-right" />
                </button>
              </div>
            </>
          )}

          {currentStep === 3 && (
            <>
              <h2 className="typeform-question">{steps[3].title}</h2>
              <p className="typeform-description">{steps[3].description}</p>
              <div className="typeform-field-wrapper">
                <textarea
                  name="direccion"
                  value={formData.direccion}
                  onChange={handleInputChange}
                  placeholder="Dirección completa..."
                  className="typeform-large-textarea"
                  rows="3"
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
                    {loading ? 'Guardando...' : <><Icon name="check" /> Agregar Cliente</>}
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

