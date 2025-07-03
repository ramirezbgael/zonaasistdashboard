import { useState, useEffect } from 'react';
import { supabase } from '../../supabase.js';
import './AddEquipoModal.css';

export default function AddEquipoModal({ onClose, onEquipoAdded }) {
  const [formData, setFormData] = useState({
    marca: '',
    modelo: '',
    color: '',
    nota: '',
    problema: ''
  });
  const [loading, setLoading] = useState(false);
  const [existingData, setExistingData] = useState({
    marcas: [],
    modelos: [],
    colores: []
  });
  const [suggestions, setSuggestions] = useState({
    marca: [],
    modelo: [],
    color: []
  });

  // Cargar datos existentes al abrir el modal
  useEffect(() => {
    const loadExistingData = async () => {
      try {
        const { data, error } = await supabase
          .from('equipos')
          .select('marca, modelo, color, nota')
          .order('nota', { ascending: false });

        if (error) {
          console.error('Error al cargar datos:', error);
          return;
        }

        if (data && data.length > 0) {
          // Obtener valores únicos
          const marcas = [...new Set(data.map(item => item.marca))];
          const modelos = [...new Set(data.map(item => item.modelo))];
          const colores = [...new Set(data.map(item => item.color))];

          setExistingData({
            marcas,
            modelos,
            colores
          });

          // Calcular la siguiente nota
          const ultimaNota = data[0].nota;
          const siguienteNota = parseInt(ultimaNota) + 1;
          
          setFormData(prev => ({
            ...prev,
            nota: siguienteNota.toString()
          }));
        }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    loadExistingData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Mostrar sugerencias basadas en el input
    if (name === 'marca' && value.trim()) {
      const filtered = existingData.marcas.filter(marca => 
        marca.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(prev => ({ ...prev, marca: filtered }));
    } else if (name === 'modelo' && value.trim()) {
      const filtered = existingData.modelos.filter(modelo => 
        modelo.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(prev => ({ ...prev, modelo: filtered }));
    } else if (name === 'color' && value.trim()) {
      const filtered = existingData.colores.filter(color => 
        color.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(prev => ({ ...prev, color: filtered }));
    } else {
      setSuggestions(prev => ({ ...prev, [name]: [] }));
    }
  };

  const handleSuggestionClick = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setSuggestions(prev => ({ ...prev, [field]: [] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validar que los campos requeridos no estén vacíos
      if (!formData.marca.trim() || !formData.modelo.trim() || !formData.color.trim() || !formData.nota.trim()) {
        alert('Por favor completa todos los campos requeridos');
        setLoading(false);
        return;
      }

      // Preparar los datos para inserción
      const equipoData = {
        marca: formData.marca.trim(),
        modelo: formData.modelo.trim(),
        color: formData.color.trim(),
        nota: formData.nota.trim(),
        problema: formData.problema.trim() || null
      };

      console.log('Datos a insertar:', equipoData);
      
      // Verificar permisos de lectura primero
      const { data: testData, error: testError } = await supabase
        .from('equipos')
        .select('id')
        .limit(1);

      if (testError) {
        console.error('Error de permisos:', testError);
        alert(`Error de permisos: ${testError.message}`);
        setLoading(false);
        return;
      }

      // Intentar insertar el equipo
      const { data, error } = await supabase
        .from('equipos')
        .insert([equipoData])
        .select();

      if (error) {
        console.error('Error al agregar equipo:', error);
        alert(`Error al agregar el equipo: ${error.message}`);
      } else {
        console.log('Equipo agregado exitosamente:', data);
        onEquipoAdded(); // Recargar la lista
        onClose(); // Cerrar el modal
      }
    } catch (error) {
      console.error('Error inesperado:', error);
      alert(`Error inesperado: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <button onClick={onClose} className="close-btn">×</button>
        <h2>Agregar Nuevo Equipo</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="marca">Marca:</label>
            <div className="input-container">
              <input
                type="text"
                id="marca"
                name="marca"
                value={formData.marca}
                onChange={handleInputChange}
                required
                autoComplete="off"
              />
              {suggestions.marca.length > 0 && (
                <div className="suggestions">
                  {suggestions.marca.map((marca, index) => (
                    <div
                      key={index}
                      className="suggestion-item"
                      onClick={() => handleSuggestionClick('marca', marca)}
                    >
                      {marca}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="modelo">Modelo:</label>
            <div className="input-container">
              <input
                type="text"
                id="modelo"
                name="modelo"
                value={formData.modelo}
                onChange={handleInputChange}
                required
                autoComplete="off"
              />
              {suggestions.modelo.length > 0 && (
                <div className="suggestions">
                  {suggestions.modelo.map((modelo, index) => (
                    <div
                      key={index}
                      className="suggestion-item"
                      onClick={() => handleSuggestionClick('modelo', modelo)}
                    >
                      {modelo}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="color">Color:</label>
            <div className="input-container">
              <input
                type="text"
                id="color"
                name="color"
                value={formData.color}
                onChange={handleInputChange}
                required
                autoComplete="off"
              />
              {suggestions.color.length > 0 && (
                <div className="suggestions">
                  {suggestions.color.map((color, index) => (
                    <div
                      key={index}
                      className="suggestion-item"
                      onClick={() => handleSuggestionClick('color', color)}
                    >
                      {color}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="nota">Nota:</label>
            <input
              type="text"
              id="nota"
              name="nota"
              value={formData.nota}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="problema">Problema:</label>
            <textarea
              id="problema"
              name="problema"
              value={formData.problema}
              onChange={handleInputChange}
              rows="3"
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Agregando...' : 'Agregar Equipo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
