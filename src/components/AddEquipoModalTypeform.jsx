import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase.js';
import './AddEquipoModalTypeform.css';

export default function AddEquipoModalTypeform({ onClose, onEquipoAdded }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formSubStep, setFormSubStep] = useState(0); // 0: marca, 1: modelo, 2: color
  const [additionalSubStep, setAdditionalSubStep] = useState(0); // 0: proceso, 1: cliente_telefono, 2: cliente_nombre (si no existe), 3: detalle
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [videoReady, setVideoReady] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Autocompletado
  const [marcaSuggestions, setMarcaSuggestions] = useState([]);
  const [modeloSuggestions, setModeloSuggestions] = useState([]);
  const [showMarcaSuggestions, setShowMarcaSuggestions] = useState(false);
  const [showModeloSuggestions, setShowModeloSuggestions] = useState(false);
  
  const [formData, setFormData] = useState({
    marca: '',
    modelo: '',
    color: '',
    problema: '',
    proceso_id: '',
    cliente_telefono: '',
    cliente_nombre: ''
  });
  const [loading, setLoading] = useState(false);
  const [procesos, setProcesos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [siguienteNota, setSiguienteNota] = useState(null);

  // Marcas predefinidas para autocompletado
  const marcasPredefinidas = [
    'Dell', 'HP', 'Lenovo', 'Acer', 'ASUS', 'Toshiba', 'Sony', 'Samsung', 'Apple', 'MSI', 'Epson'
  ];

  const modelosPorMarca = {
    'Dell': ['Inspiron 15 3000', 'Inspiron 15 5000', 'Latitude 3420', 'XPS 13', 'XPS 15', 'Inspiron 14', 'Latitude 5520'],
    'HP': ['Pavilion 15', 'EliteBook 840', 'ProBook 450', 'Spectre x360', 'Pavilion 14', 'EliteBook 850'],
    'Lenovo': ['ThinkPad E14', 'ThinkPad E15', 'IdeaPad 3', 'Yoga 7i', 'ThinkPad X1', 'Legion 5'],
    'Acer': ['Aspire 3', 'Aspire 5', 'Swift 3', 'Nitro 5', 'Aspire 7', 'Predator'],
    'ASUS': ['VivoBook 15', 'ZenBook 13', 'ROG Strix G15', 'VivoBook 14', 'ZenBook 14'],
    'Epson': ['L3150', 'L3250', 'L4150', 'EcoTank L3110', 'L4260', 'L6190'],
    'Apple': ['MacBook Air', 'MacBook Pro', 'iMac', 'Mac Mini'],
    'Samsung': ['Galaxy Book', 'Notebook 9']
  };

  // Función para filtrar sugerencias de marca
  const filterMarcaSuggestions = (value) => {
    if (!value || value.trim() === '') {
      setMarcaSuggestions([]);
      setShowMarcaSuggestions(false);
      return;
    }
    
    const filtered = marcasPredefinidas.filter(marca =>
      marca.toLowerCase().includes(value.toLowerCase())
    );
    setMarcaSuggestions(filtered.slice(0, 5));
    setShowMarcaSuggestions(filtered.length > 0);
  };

  // Función para filtrar sugerencias de modelo
  const filterModeloSuggestions = (value, marca) => {
    if (!value || value.trim() === '' || !marca) {
      setModeloSuggestions([]);
      setShowModeloSuggestions(false);
      return;
    }
    
    const modelos = modelosPorMarca[marca] || [];
    const filtered = modelos.filter(modelo =>
      modelo.toLowerCase().includes(value.toLowerCase())
    );
    setModeloSuggestions(filtered.slice(0, 5));
    setShowModeloSuggestions(filtered.length > 0);
  };

  // Verificar disponibilidad de la API de cámara
  const checkCameraAvailability = () => {
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.startsWith('192.168.') ||
                       window.location.hostname.startsWith('10.');
    const isHTTPS = window.location.protocol === 'https:';
    const userAgent = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    
    // Verificar si existe la API antigua (polyfill)
    const hasOldAPI = navigator.getUserMedia || 
                     navigator.webkitGetUserMedia || 
                     navigator.mozGetUserMedia || 
                     navigator.msGetUserMedia;
    
    if (!navigator.mediaDevices && !hasOldAPI) {
      let errorMsg = '⚠️ Tu navegador no soporta el acceso a la cámara.\n\n';
      
      if (isIOS) {
        errorMsg += 'En iPhone/iPad:\n';
        errorMsg += '• Usa Safari (versión 11 o superior)\n';
        errorMsg += '• O Chrome para iOS\n';
        errorMsg += '• Asegúrate de usar HTTPS\n\n';
      }
      
      if (!isHTTPS && !isLocalhost) {
        errorMsg += '⚠️ Necesitas HTTPS para acceder a la cámara desde dispositivos móviles.\n\n';
      }
      
      errorMsg += 'Puedes continuar sin cámara y agregar los datos manualmente.';
      
      return {
        available: false,
        error: errorMsg,
        canContinue: true
      };
    }
    
    if (navigator.mediaDevices && !navigator.mediaDevices.getUserMedia) {
      let errorMsg = '⚠️ La función getUserMedia no está disponible.\n\n';
      
      if (!isHTTPS && !isLocalhost) {
        errorMsg += 'Necesitas usar HTTPS para acceder a la cámara.\n\n';
      }
      
      errorMsg += 'Por favor:\n';
      errorMsg += '• Actualiza tu navegador a la última versión\n';
      errorMsg += '• O usa HTTPS en lugar de HTTP\n\n';
      errorMsg += 'Puedes continuar sin cámara y agregar los datos manualmente.';
      
      return {
        available: false,
        error: errorMsg,
        canContinue: true
      };
    }
    
    return { available: true };
  };

  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    // Guardar el valor original del overflow
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    const originalHeight = document.body.style.height;
    
    // Obtener la posición actual del scroll
    const scrollY = window.scrollY;
    
    // Prevenir scroll - método más simple que no afecta el posicionamiento
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'relative';
    document.body.style.height = '100vh';
    
    // Cleanup: restaurar el scroll cuando el modal se cierre
    return () => {
      document.body.style.overflow = originalOverflow || '';
      document.body.style.position = originalPosition || '';
      document.body.style.top = originalTop || '';
      document.body.style.width = originalWidth || '';
      document.body.style.height = originalHeight || '';
      if (scrollY > 0) {
        window.scrollTo(0, scrollY);
      }
    };
  }, []);

  // Verificar disponibilidad de cámara al cargar
  useEffect(() => {
    const cameraCheck = checkCameraAvailability();
    if (!cameraCheck.available) {
      setCameraError(cameraCheck.error);
    }
  }, []);

  // Limpiar sugerencias cuando cambia el sub-paso del formulario
  useEffect(() => {
    if (currentStep === 2) {
      setShowMarcaSuggestions(false);
      setShowModeloSuggestions(false);
      setMarcaSuggestions([]);
      setModeloSuggestions([]);
    }
  }, [formSubStep, currentStep]);

  // Resetear sub-pasos cuando cambia el paso principal
  useEffect(() => {
    if (currentStep !== 2) {
      setFormSubStep(0);
    }
    if (currentStep !== 3) {
      setAdditionalSubStep(0);
    }
  }, [currentStep]);

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      try {
        // Cargar procesos
        const { data: procesosData } = await supabase
          .from('procesos')
          .select('*')
          .order('id');
        setProcesos(procesosData || []);

        // Cargar siguiente nota automáticamente (sin mostrarla en el form)
        const { data: equiposData } = await supabase
          .from('equipos')
          .select('nota')
          .order('nota', { ascending: false })
          .limit(1);

        if (equiposData && equiposData.length > 0) {
          const siguiente = parseInt(equiposData[0].nota) + 1;
          setSiguienteNota(siguiente);
        } else {
          setSiguienteNota(1); // Primera nota
        }

        // Cargar clientes para autocompletado
        const { data: clientesData } = await supabase
          .from('clientes')
          .select('id, nombre, telefono')
          .order('nombre');
        setClientes(clientesData || []);
      } catch (error) {
        console.error('Error loading data:', error);
        // Si la tabla de clientes no existe aún, continuar sin error
        if (!error.message.includes('clientes')) {
          console.error('Error loading data:', error);
        }
      }
    };

    loadData();
  }, []);

  // Buscar cliente por teléfono
  const buscarClientePorTelefono = async (telefono) => {
    if (!telefono || telefono.trim() === '') {
      setClienteEncontrado(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre, telefono')
        .eq('telefono', telefono.trim())
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error buscando cliente:', error);
        return;
      }

      if (data) {
        setClienteEncontrado(data);
        setFormData(prev => ({ ...prev, cliente_nombre: data.nombre }));
      } else {
        setClienteEncontrado(null);
        // Limpiar nombre si no se encuentra el cliente
        if (!formData.cliente_nombre) {
          setFormData(prev => ({ ...prev, cliente_nombre: '' }));
        }
      }
    } catch (error) {
      console.error('Error buscando cliente:', error);
    }
  };

  // Limpiar stream de cámara al desmontar o cerrar
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    };
  }, [stream]);

  // Manejar el video cuando el stream cambia
  useEffect(() => {
    if (stream && videoRef.current && currentStep === 1) {
      videoRef.current.srcObject = stream;
      setVideoReady(false);
      
      const video = videoRef.current;
      
      const handleLoadedMetadata = () => {
        setVideoReady(true);
        setCameraError(null);
      };
      
      const handleError = (e) => {
        console.error('Video error:', e);
        setCameraError('Error al mostrar el video');
        setVideoReady(false);
      };
      
      const handlePlaying = () => {
        setVideoReady(true);
      };
      
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('error', handleError);
      video.addEventListener('playing', handlePlaying);
      
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('error', handleError);
        video.removeEventListener('playing', handlePlaying);
      };
    }
  }, [stream, currentStep]);

  // Activar cámara
  const startCamera = async () => {
    if (startingCamera) return; // Evitar múltiples llamadas
    
    try {
      setStartingCamera(true);
      console.log('[Camera] Iniciando activación de cámara...');
      setCameraError(null);
      setVideoReady(false);
      
      // Verificar disponibilidad de la API
      const cameraCheck = checkCameraAvailability();
      if (!cameraCheck.available) {
        setCameraError(cameraCheck.error);
        setStartingCamera(false);
        return;
      }
      
      // Intentar primero con cámara trasera (environment)
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } catch (envError) {
        console.log('[Camera] Error con cámara trasera, intentando frontal...', envError);
        // Si falla, intentar con cámara frontal
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
        } catch (userError) {
          console.log('[Camera] Error con cámara frontal, intentando sin restricciones...', userError);
          // Último intento sin restricciones
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true
          });
        }
      }
      
      console.log('[Camera] Stream obtenido exitosamente');
      setStream(mediaStream);
      setCurrentStep(1); // Cambiar al paso 1 - el useEffect manejará el video
      setFormSubStep(0); // Resetear sub-paso del formulario
      console.log('[Camera] Cambiado a paso 1');
    } catch (error) {
      console.error('[Camera] Error accessing camera:', error);
      let errorMessage;
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permisos de cámara denegados. Por favor, permite el acceso a la cámara en la configuración de tu navegador.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No se encontró ninguna cámara en tu dispositivo.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Tu navegador no soporta el acceso a la cámara. Por favor, usa Safari actualizado o Chrome en iOS.';
      } else if (error.message && error.message.includes('getUserMedia')) {
        errorMessage = 'Error al acceder a la cámara. Asegúrate de usar HTTPS y un navegador compatible.';
      } else {
        errorMessage = error.message || 'No se pudo acceder a la cámara. Por favor, intenta de nuevo.';
      }
      
      setCameraError(errorMessage);
      setVideoReady(false);
      // Permanecer en el paso actual y mostrar error
    } finally {
      setStartingCamera(false);
    }
  };

  // Saltar cámara y continuar al formulario
  const skipCamera = () => {
    // Detener stream si existe
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setVideoReady(false);
    setCameraError(null);
    setFormSubStep(0); // Iniciar desde el primer campo
    setCurrentStep(2);
  };

  // Función para cerrar el modal limpiando recursos
  const handleClose = () => {
    // Detener stream de cámara si existe
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    onClose();
  };

  // Capturar imagen
  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg');
      setCapturedImage(imageData);
      
      // Detener cámara
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      
      // Ir directamente al formulario
      setFormSubStep(0); // Iniciar desde el primer campo
      setCurrentStep(2);
    }
  };

  // Limpiar stream al cerrar
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // Filtrar sugerencias cuando cambia la marca o modelo
      if (name === 'marca') {
        filterMarcaSuggestions(value);
        // Limpiar modelo si cambia la marca
        if (prev.marca !== value) {
          newData.modelo = '';
          setModeloSuggestions([]);
        }
      } else if (name === 'modelo') {
        filterModeloSuggestions(value, formData.marca);
      } else if (name === 'cliente_telefono') {
        // Buscar cliente cuando se escribe el teléfono
        buscarClientePorTelefono(value);
      }
      
      return newData;
    });
  };

  const handleSuggestionClick = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      if (field === 'marca') {
        setShowMarcaSuggestions(false);
        setMarcaSuggestions([]);
        // Limpiar modelo cuando cambia la marca
        newData.modelo = '';
        // Avanzar al siguiente paso automáticamente
        setTimeout(() => setFormSubStep(1), 300);
      } else if (field === 'modelo') {
        setShowModeloSuggestions(false);
        setModeloSuggestions([]);
        // Avanzar al siguiente paso automáticamente
        setTimeout(() => setFormSubStep(2), 300);
      }
      return newData;
    });
  };

  // Avanzar al siguiente campo automáticamente
  const handleFieldComplete = (field) => {
    if (field === 'marca' && formData.marca.trim()) {
      setTimeout(() => setFormSubStep(1), 300);
    } else if (field === 'modelo' && formData.modelo.trim()) {
      setTimeout(() => setFormSubStep(2), 300);
    } else if (field === 'color' && formData.color.trim()) {
      setTimeout(() => {
        setAdditionalSubStep(0);
        setCurrentStep(3);
      }, 300);
    }
  };

  // Avanzar en información adicional
  const handleAdditionalFieldComplete = (field) => {
    if (field === 'proceso' && formData.proceso_id) {
      setTimeout(() => setAdditionalSubStep(1), 300); // Ir a teléfono
    } else if (field === 'cliente_telefono' && formData.cliente_telefono.trim()) {
      // Si el cliente no existe, pedir nombre; si existe, ir a detalle
      if (!clienteEncontrado) {
        setTimeout(() => setAdditionalSubStep(2), 300); // Pedir nombre
      } else {
        setTimeout(() => setAdditionalSubStep(3), 300); // Ir a detalle
      }
    } else if (field === 'cliente_nombre' && formData.cliente_nombre.trim()) {
      setTimeout(() => setAdditionalSubStep(3), 300); // Ir a detalle
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validar campos requeridos
      if (!formData.marca || !formData.modelo || !formData.color || !formData.proceso_id || !formData.cliente_telefono) {
        alert('Por favor completa todos los campos requeridos');
        setLoading(false);
        return;
      }

      // Validar que si no hay cliente encontrado, debe haber nombre
      if (!clienteEncontrado && !formData.cliente_nombre) {
        alert('Por favor ingresa el nombre del cliente');
        setLoading(false);
        return;
      }

      let clienteId = null;

      // Buscar o crear cliente
      if (clienteEncontrado) {
        clienteId = clienteEncontrado.id;
      } else {
        // Crear nuevo cliente
        const { data: clienteData, error: clienteError } = await supabase
          .from('clientes')
          .insert([{
            nombre: formData.cliente_nombre.trim(),
            telefono: formData.cliente_telefono.trim()
          }])
          .select();

        if (clienteError) {
          // Si hay error de duplicado, intentar buscar el cliente
          if (clienteError.code === '23505') {
            const { data: clienteExistente } = await supabase
              .from('clientes')
              .select('id')
              .eq('telefono', formData.cliente_telefono.trim())
              .maybeSingle();
            
            if (clienteExistente) {
              clienteId = clienteExistente.id;
            } else {
              throw clienteError;
            }
          } else {
            throw clienteError;
          }
        } else {
          clienteId = clienteData[0].id;
        }
      }

      // Generar nota automáticamente
      let notaGenerada = siguienteNota;
      if (!notaGenerada) {
        // Si no se calculó antes, calcular ahora
        const { data: ultimaNota } = await supabase
          .from('equipos')
          .select('nota')
          .order('nota', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        notaGenerada = ultimaNota ? parseInt(ultimaNota.nota) + 1 : 1;
      }

      // Si no hay problema, usar una cadena vacía en lugar de null para evitar error en pendientes
      const equipoData = {
        marca: formData.marca.trim(),
        modelo: formData.modelo.trim(),
        color: formData.color.trim(),
        nota: notaGenerada.toString(),
        problema: formData.problema.trim() || '',
        cliente_id: clienteId
      };

      const { data, error } = await supabase
        .from('equipos')
        .insert([equipoData])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        // Crear estado inicial
        await supabase.from('estado_equipos').insert({
          equipo_id: data[0].id,
          estado: 'en_proceso',
          proceso_actual_id: parseInt(formData.proceso_id),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        // Registrar en historial
        const procesoSeleccionado = procesos.find(p => p.id === parseInt(formData.proceso_id));
        await supabase.from('historial_procesos').insert({
          equipo_id: data[0].id,
          proceso_id: parseInt(formData.proceso_id),
          notas: `Proceso iniciado: ${procesoSeleccionado?.nombre}`,
          fecha_inicio: new Date().toISOString()
        });
      }

      onEquipoAdded();
      onClose();
    } catch (error) {
      console.error('Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: '📷 Captura la imagen del equipo',
      description: 'Permite el acceso a la cámara para capturar una foto del equipo'
    },
    {
      title: '📝 Información del equipo',
      description: 'Completa los datos del equipo'
    },
    {
      title: '⚙️ Proceso y cliente',
      description: 'Selecciona el proceso y los datos del cliente'
    }
  ];

  return (
    <div 
      className="typeform-modal-overlay" 
      onClick={handleClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: '1rem'
      }}
    >
      <div 
        className="typeform-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          zIndex: 1060,
          display: 'flex',
          flexDirection: 'column',
          opacity: 1,
          visibility: 'visible',
          transform: 'translate(0, 0)'
        }}
      >
        <button onClick={handleClose} className="typeform-close-btn">×</button>
        
        {/* Progress Bar */}
        <div className="typeform-progress">
          <div 
            className="typeform-progress-bar" 
            style={{ 
              width: `${(() => {
                if (currentStep === 2) {
                  // Paso 2: Formulario (marca, modelo, color) = 3 sub-pasos
                  return ((currentStep + (formSubStep + 1) / 3) / (steps.length + 1)) * 100;
                } else if (currentStep === 3) {
                  // Paso 3: Cliente y proceso
                  // Máximo 4 sub-pasos: teléfono, nombre (opcional), proceso, detalle
                  const totalSubSteps = 4;
                  const currentProgress = additionalSubStep + 1;
                  return ((currentStep + currentProgress / totalSubSteps) / (steps.length + 1)) * 100;
                } else {
                  return ((currentStep + 1) / (steps.length + 1)) * 100;
                }
              })()}%` 
            }}
          ></div>
        </div>

        {/* Step Indicator */}
        <div className="typeform-step-indicator">
          {currentStep === 2 
            ? `Paso ${currentStep + 1}.${formSubStep + 1} de ${steps.length + 1}`
            : currentStep === 3
            ? `Paso ${currentStep + 1}.${additionalSubStep + 1} de ${steps.length + 1}`
            : `Paso ${currentStep + 1} de ${steps.length + 1}`}
        </div>

        {/* Step 0: Inicio - Activar cámara */}
        {currentStep === 0 && (
          <div className="typeform-step">
            <h2>{steps[0].title}</h2>
            <p className="typeform-description">{steps[0].description}</p>
            {cameraError && (
              <div className="error-message">
                {cameraError}
              </div>
            )}
            <div className="typeform-buttons">
              {!cameraError && (
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    startCamera();
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!startingCamera) {
                      startCamera();
                    }
                  }}
                  className="typeform-btn-primary"
                  disabled={startingCamera}
                >
                  {startingCamera ? '⏳ Activando...' : '📷 Activar Cámara'}
                </button>
              )}
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  skipCamera();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  skipCamera();
                }}
                className={cameraError ? "typeform-btn-primary" : "typeform-btn-secondary"}
                disabled={startingCamera}
              >
                {cameraError ? '✓ Continuar sin cámara' : 'Omitir y continuar'}
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Captura con cámara */}
        {currentStep === 1 && (
          <div className="typeform-step">
            <h2>Captura la imagen</h2>
            <p className="typeform-description">
              Coloca el equipo frente a la cámara y captura una foto
            </p>
            {cameraError && (
              <div className="error-message">
                ⚠️ {cameraError}
                <br />
                <small>Puedes continuar sin cámara y agregar los datos manualmente.</small>
              </div>
            )}
            {stream && (
              <div className="camera-container">
                {!videoReady && !cameraError && (
                  <div className="camera-loading">
                    <div className="detecting-spinner"></div>
                    <p>Cargando cámara...</p>
                  </div>
                )}
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline
                  muted
                  className="camera-video"
                  style={{ display: videoReady && !cameraError ? 'block' : 'none' }}
                />
                {capturedImage && (
                  <img src={capturedImage} alt="Captured" className="captured-image" />
                )}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                
                {videoReady && !capturedImage && !cameraError && (
                  <div className="camera-controls">
                    <button onClick={captureImage} className="typeform-btn-primary capture-btn">
                      📸 Capturar
                    </button>
                    <button onClick={() => {
                      if (stream) {
                        stream.getTracks().forEach(track => track.stop());
                        setStream(null);
                      }
                      setVideoReady(false);
                      setCameraError(null);
                      setCurrentStep(0);
                    }} className="typeform-btn-secondary">
                      Cancelar
                    </button>
                  </div>
                )}

                
                {cameraError && (
                  <div className="typeform-buttons">
                    <button onClick={skipCamera} className="typeform-btn-primary">
                      Continuar sin cámara
                    </button>
                    <button onClick={() => {
                      if (stream) {
                        stream.getTracks().forEach(track => track.stop());
                        setStream(null);
                      }
                      setVideoReady(false);
                      setCameraError(null);
                      setCurrentStep(0);
                    }} className="typeform-btn-secondary">
                      Intentar de nuevo
                    </button>
                  </div>
                )}
              </div>
            )}
            {!stream && !cameraError && (
              <div className="typeform-buttons">
                <button onClick={startCamera} className="typeform-btn-primary">
                  📷 Activar Cámara
                </button>
                <button onClick={skipCamera} className="typeform-btn-secondary">
                  Omitir y continuar sin cámara
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Formulario tipo Typeform - Campos progresivos */}
        {currentStep === 2 && (
          <div className="typeform-step typeform-single-field">
            {capturedImage && (
              <div className="captured-preview-small">
                <img src={capturedImage} alt="Equipment" />
              </div>
            )}

            {/* Campo: Marca */}
            {formSubStep === 0 && (
              <>
                <h2 className="typeform-question">¿Cuál es la marca del equipo?</h2>
                <div className="typeform-field-wrapper autocomplete-wrapper">
                  <input
                    type="text"
                    name="marca"
                    value={formData.marca}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && formData.marca.trim()) {
                        e.preventDefault();
                        handleFieldComplete('marca');
                      }
                    }}
                    onFocus={() => {
                      if (formData.marca) {
                        filterMarcaSuggestions(formData.marca);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowMarcaSuggestions(false), 200);
                    }}
                    placeholder="Escribe la marca..."
                    required
                    autoComplete="off"
                    autoFocus
                    className="typeform-large-input"
                  />
                  {showMarcaSuggestions && marcaSuggestions.length > 0 && (
                    <div className="suggestions-dropdown-large">
                      {marcaSuggestions.map((marca, index) => (
                        <button
                          key={index}
                          type="button"
                          className="suggestion-item-large"
                          onClick={() => handleSuggestionClick('marca', marca)}
                        >
                          {marca}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {formData.marca && (
                  <button
                    type="button"
                    onClick={() => handleFieldComplete('marca')}
                    className="typeform-btn-primary typeform-next-btn"
                  >
                    Continuar →
                  </button>
                )}
              </>
            )}

            {/* Campo: Modelo */}
            {formSubStep === 1 && (
              <>
                <h2 className="typeform-question">¿Cuál es el modelo del equipo?</h2>
                <div className="typeform-field-wrapper autocomplete-wrapper">
                  <input
                    type="text"
                    name="modelo"
                    value={formData.modelo}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && formData.modelo.trim()) {
                        e.preventDefault();
                        handleFieldComplete('modelo');
                      }
                    }}
                    onFocus={() => {
                      if (formData.modelo && formData.marca) {
                        filterModeloSuggestions(formData.modelo, formData.marca);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowModeloSuggestions(false), 200);
                    }}
                    placeholder={`Escribe el modelo ${formData.marca || ''}...`}
                    required
                    autoComplete="off"
                    autoFocus
                    className="typeform-large-input"
                  />
                  {showModeloSuggestions && modeloSuggestions.length > 0 && (
                    <div className="suggestions-dropdown-large">
                      {modeloSuggestions.map((modelo, index) => (
                        <button
                          key={index}
                          type="button"
                          className="suggestion-item-large"
                          onClick={() => handleSuggestionClick('modelo', modelo)}
                        >
                          {modelo}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="typeform-buttons-horizontal">
                  <button
                    type="button"
                    onClick={() => setFormSubStep(0)}
                    className="typeform-btn-secondary"
                  >
                    ← Volver
                  </button>
                  {formData.modelo && (
                    <button
                      type="button"
                      onClick={() => handleFieldComplete('modelo')}
                      className="typeform-btn-primary"
                    >
                      Continuar →
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Campo: Color */}
            {formSubStep === 2 && (
              <>
                <h2 className="typeform-question">¿De qué color es el equipo?</h2>
                <div className="typeform-field-wrapper">
                  <input
                    type="text"
                    name="color"
                    value={formData.color}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && formData.color.trim()) {
                        e.preventDefault();
                        handleFieldComplete('color');
                      }
                    }}
                    placeholder="Escribe el color..."
                    required
                    autoFocus
                    className="typeform-large-input"
                  />
                </div>
                <div className="typeform-buttons-horizontal">
                  <button
                    type="button"
                    onClick={() => setFormSubStep(1)}
                    className="typeform-btn-secondary"
                  >
                    ← Volver
                  </button>
                  {formData.color && (
                    <button
                      type="button"
                      onClick={() => handleFieldComplete('color')}
                      className="typeform-btn-primary"
                    >
                      Continuar →
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Información adicional tipo Typeform */}
        {currentStep === 3 && (
          <div className="typeform-step typeform-single-field">
            {/* Campo: Proceso */}
            {additionalSubStep === 0 && (
              <>
                <h2 className="typeform-question">¿Qué proceso se va a realizar?</h2>
                <p className="typeform-description">Selecciona el tipo de servicio a realizar.</p>
                <div className="typeform-field-wrapper">
                  <select
                    name="proceso_id"
                    value={formData.proceso_id}
                    onChange={(e) => {
                      handleInputChange(e);
                      if (e.target.value) {
                        setTimeout(() => handleAdditionalFieldComplete('proceso'), 300);
                      }
                    }}
                    required
                    autoFocus
                    className="typeform-large-input typeform-select"
                  >
                    <option value="">Selecciona un proceso...</option>
                    {procesos.map(proceso => (
                      <option key={proceso.id} value={proceso.id}>
                        {proceso.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                {formData.proceso_id && (
                  <button
                    type="button"
                    onClick={() => handleAdditionalFieldComplete('proceso')}
                    className="typeform-btn-primary typeform-next-btn"
                  >
                    Continuar →
                  </button>
                )}
              </>
            )}

            {/* Campo: Teléfono del cliente */}
            {additionalSubStep === 1 && (
              <>
                <h2 className="typeform-question">¿Cuál es el número del cliente?</h2>
                <p className="typeform-description">Ingresa el número de teléfono del cliente. Si ya existe en la base de datos, se cargará automáticamente.</p>
                {clienteEncontrado && (
                  <div style={{
                    background: '#d4edda',
                    color: '#155724',
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-4)',
                    textAlign: 'center'
                  }}>
                    ✓ Cliente encontrado: {clienteEncontrado.nombre}
                  </div>
                )}
                <div className="typeform-field-wrapper">
                  <input
                    type="tel"
                    name="cliente_telefono"
                    value={formData.cliente_telefono}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && formData.cliente_telefono.trim()) {
                        e.preventDefault();
                        handleAdditionalFieldComplete('cliente_telefono');
                      }
                    }}
                    placeholder="Ej: 5551234567"
                    required
                    autoFocus
                    className="typeform-large-input"
                  />
                </div>
                <div className="typeform-buttons-horizontal">
                  <button
                    type="button"
                    onClick={() => setAdditionalSubStep(0)}
                    className="typeform-btn-secondary"
                  >
                    ← Volver
                  </button>
                  {formData.cliente_telefono && (
                    <button
                      type="button"
                      onClick={() => handleAdditionalFieldComplete('cliente_telefono')}
                      className="typeform-btn-primary"
                    >
                      Continuar →
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Campo: Nombre del cliente (solo si no existe) */}
            {additionalSubStep === 2 && !clienteEncontrado && (
              <>
                <h2 className="typeform-question">¿Cuál es el nombre del cliente?</h2>
                <p className="typeform-description">Este cliente no está en la base de datos. Por favor, ingresa su nombre.</p>
                <div className="typeform-field-wrapper">
                  <input
                    type="text"
                    name="cliente_nombre"
                    value={formData.cliente_nombre}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && formData.cliente_nombre.trim()) {
                        e.preventDefault();
                        handleAdditionalFieldComplete('cliente_nombre');
                      }
                    }}
                    placeholder="Escribe el nombre completo del cliente..."
                    required
                    autoFocus
                    className="typeform-large-input"
                  />
                </div>
                <div className="typeform-buttons-horizontal">
                  <button
                    type="button"
                    onClick={() => setAdditionalSubStep(1)}
                    className="typeform-btn-secondary"
                  >
                    ← Volver
                  </button>
                  {formData.cliente_nombre && (
                    <button
                      type="button"
                      onClick={() => handleAdditionalFieldComplete('cliente_nombre')}
                      className="typeform-btn-primary"
                    >
                      Continuar →
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Campo: Detalle (opcional) */}
            {additionalSubStep === 3 && (
              <>
                <h2 className="typeform-question">¿Hay algún detalle adicional? (Opcional)</h2>
                <p className="typeform-description">Describe cualquier problema o información relevante sobre el equipo.</p>
                <div className="typeform-field-wrapper">
                  <textarea
                    name="problema"
                    value={formData.problema}
                    onChange={handleInputChange}
                    placeholder="Escribe detalles adicionales sobre el equipo..."
                    autoFocus
                    className="typeform-large-textarea"
                    rows="5"
                  />
                </div>
                <div className="typeform-buttons-horizontal">
                  <button
                    type="button"
                    onClick={() => {
                      // Volver al paso anterior según si existe el cliente
                      if (clienteEncontrado) {
                        setAdditionalSubStep(1);
                      } else {
                        setAdditionalSubStep(2);
                      }
                    }}
                    className="typeform-btn-secondary"
                  >
                    ← Volver
                  </button>
                  <form onSubmit={handleSubmit} style={{ display: 'inline' }}>
                    <button
                      type="submit"
                      className="typeform-btn-primary"
                      disabled={loading}
                    >
                      {loading ? 'Guardando...' : '✓ Agregar Equipo'}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

