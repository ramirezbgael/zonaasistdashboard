import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase.js';
import Tesseract from 'tesseract.js';
import './AddEquipoModalTypeform.css';

export default function AddEquipoModalTypeform({ onClose, onEquipoAdded }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [videoReady, setVideoReady] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);
  const [detectedData, setDetectedData] = useState({ marca: '', modelo: '' });
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const opencvCanvasRef = useRef(null);
  const [opencvReady, setOpencvReady] = useState(false);
  
  const [formData, setFormData] = useState({
    marca: '',
    modelo: '',
    color: '',
    nota: '',
    problema: '',
    proceso_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [procesos, setProcesos] = useState([]);
  const [existingData, setExistingData] = useState({ colores: [] });

  // Marcas predefinidas para matching
  const marcasPredefinidas = [
    'Dell', 'HP', 'Lenovo', 'Acer', 'ASUS', 'Toshiba', 'Sony', 'Samsung', 'Apple', 'MSI', 'Epson'
  ];

  const modelosPorMarca = {
    'Dell': ['Inspiron 15 3000', 'Inspiron 15 5000', 'Latitude 3420', 'XPS 13', 'XPS 15'],
    'HP': ['Pavilion 15', 'EliteBook 840', 'ProBook 450', 'Spectre x360'],
    'Lenovo': ['ThinkPad E14', 'ThinkPad E15', 'IdeaPad 3', 'Yoga 7i'],
    'Acer': ['Aspire 3', 'Aspire 5', 'Swift 3', 'Nitro 5'],
    'ASUS': ['VivoBook 15', 'ZenBook 13', 'ROG Strix G15'],
    'Epson': ['L3150', 'L3250', 'L4150', 'EcoTank L3110']
  };

  // Cargar OpenCV.js desde CDN (opcional, no bloquea)
  useEffect(() => {
    const checkOpenCV = () => {
      if (window.cv && window.cv.Mat) {
        setOpencvReady(true);
        return true;
      }
      return false;
    };

    // Verificar si ya está cargado
    if (checkOpenCV()) return;

    // Esperar a que se cargue
    const interval = setInterval(() => {
      if (checkOpenCV()) {
        clearInterval(interval);
      }
    }, 100);

    // Timeout - continuar sin OpenCV si no se carga
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setOpencvReady(true); // Permitir continuar sin OpenCV
      console.log('OpenCV no disponible, continuando sin preprocesamiento');
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

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

  // Verificar disponibilidad de cámara al cargar
  useEffect(() => {
    const cameraCheck = checkCameraAvailability();
    if (!cameraCheck.available) {
      setCameraError(cameraCheck.error);
    }
  }, []);

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

        // Cargar colores existentes
        const { data: equiposData } = await supabase
          .from('equipos')
          .select('color, nota')
          .order('nota', { ascending: false })
          .limit(1);

        if (equiposData && equiposData.length > 0) {
          const siguienteNota = parseInt(equiposData[0].nota) + 1;
          setFormData(prev => ({ ...prev, nota: siguienteNota.toString() }));
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, []);

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
      
      // Procesar imagen
      detectEquipment(imageData);
    }
  };

  // Procesar imagen con OpenCV antes de OCR (opcional)
  const preprocessImageWithOpenCV = (imageElement) => {
    return new Promise((resolve) => {
      if (!window.cv || !window.cv.Mat) {
        resolve(null);
        return;
      }

      try {
        const src = cv.imread(imageElement);
        const gray = new cv.Mat();
        const dst = new cv.Mat();

        // Convertir a escala de grises
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        // Aplicar threshold para mejorar contraste
        cv.threshold(gray, dst, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
        
        // Crear canvas temporal si no existe
        if (!opencvCanvasRef.current) {
          opencvCanvasRef.current = document.createElement('canvas');
        }
        opencvCanvasRef.current.width = imageElement.width || 640;
        opencvCanvasRef.current.height = imageElement.height || 480;
        
        cv.imshow(opencvCanvasRef.current, dst);
        const processedImage = opencvCanvasRef.current.toDataURL('image/jpeg');

        // Limpiar memoria
        src.delete();
        dst.delete();
        gray.delete();

        resolve(processedImage);
      } catch (error) {
        console.warn('OpenCV processing error (continuando sin preprocesamiento):', error);
        resolve(null);
      }
    });
  };

  // Detectar marca y modelo con OCR
  const detectEquipment = async (imageSrc) => {
    setDetecting(true);
    
    try {
      // Crear elemento imagen para procesamiento
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageSrc;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Preprocesar con OpenCV si está disponible
      let processedImage = imageSrc;
      if (window.cv && opencvReady) {
        const processed = await preprocessImageWithOpenCV(img);
        if (processed) {
          processedImage = processed;
        }
      }

      // Usar Tesseract para OCR con configuración optimizada
      const { data: { text } } = await Tesseract.recognize(processedImage, 'eng+spa', {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789- /',
        tessedit_pageseg_mode: '6' // Uniform block of text
      });

      console.log('OCR Text:', text);
      
      // Buscar marca en el texto (más flexible)
      let detectedMarca = '';
      let detectedModelo = '';
      const textUpper = text.toUpperCase();
      
      // Buscar marca con múltiples variantes
      for (const marca of marcasPredefinidas) {
        const marcaUpper = marca.toUpperCase();
        // Buscar coincidencia exacta o parcial
        if (textUpper.includes(marcaUpper) || 
            textUpper.includes(marcaUpper.replace(/\s+/g, '')) ||
            new RegExp(marcaUpper.split('').join('[\\s-]?'), 'i').test(text)) {
          detectedMarca = marca;
          break;
        }
      }

      // Buscar modelo (buscar texto que coincida con modelos conocidos)
      if (detectedMarca && modelosPorMarca[detectedMarca]) {
        for (const modelo of modelosPorMarca[detectedMarca]) {
          // Crear regex más flexible para encontrar el modelo
          const modeloParts = modelo.split(/\s+/);
          const modeloRegex = new RegExp(
            modeloParts.map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s-]?'),
            'i'
          );
          
          if (modeloRegex.test(text)) {
            detectedModelo = modelo;
            break;
          }
        }
      }

      // Si no se detectó modelo pero hay marca, buscar patrones comunes
      if (detectedMarca && !detectedModelo) {
        const modelPatterns = [
          /(?:Model|Modelo)[\s:]+([A-Z0-9\s-]+)/i,
          /([A-Z]{2,}\s*\d+[A-Z]?)/,  // Patrón como "XPS 13" o "ThinkPad E14"
          /([A-Z]+\s*\d{3,})/          // Patrón como "Latitude 3420"
        ];
        
        for (const pattern of modelPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            detectedModelo = match[1].trim();
            break;
          }
        }
      }

      setDetectedData({ marca: detectedMarca, modelo: detectedModelo });
      setFormData(prev => ({
        ...prev,
        marca: detectedMarca,
        modelo: detectedModelo
      }));

      setCurrentStep(2);
    } catch (error) {
      console.error('Error detecting equipment:', error);
      setCurrentStep(2); // Continuar aunque falle la detección
    } finally {
      setDetecting(false);
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
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.marca || !formData.modelo || !formData.color || !formData.nota || !formData.proceso_id) {
        alert('Por favor completa todos los campos requeridos');
        setLoading(false);
        return;
      }

      const equipoData = {
        marca: formData.marca.trim(),
        modelo: formData.modelo.trim(),
        color: formData.color.trim(),
        nota: formData.nota.trim(),
        problema: formData.problema.trim() || null
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
      title: '✅ Confirmar información detectada',
      description: 'Revisa y completa los datos detectados automáticamente'
    },
    {
      title: '📝 Información adicional',
      description: 'Completa los detalles restantes del equipo'
    }
  ];

  return (
    <div className="typeform-modal-overlay" onClick={handleClose}>
      <div className="typeform-modal" onClick={(e) => e.stopPropagation()}>
        <button onClick={handleClose} className="typeform-close-btn">×</button>
        
        {/* Progress Bar */}
        <div className="typeform-progress">
          <div 
            className="typeform-progress-bar" 
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>

        {/* Step Indicator */}
        <div className="typeform-step-indicator">
          Paso {currentStep + 1} de {steps.length}
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
              Coloca el equipo frente a la cámara y asegúrate de que la marca y modelo sean visibles
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

                {detecting && (
                  <div className="detecting-overlay">
                    <div className="detecting-spinner"></div>
                    <p>Detectando marca y modelo...</p>
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

        {/* Step 2: Confirmar datos detectados */}
        {currentStep === 2 && (
          <div className="typeform-step">
            <h2>{steps[1].title}</h2>
            <p className="typeform-description">{steps[1].description}</p>
            
            {capturedImage && (
              <div className="captured-preview">
                <img src={capturedImage} alt="Equipment" />
              </div>
            )}

            <div className="typeform-form-group">
              <label>Marca:</label>
              <input
                type="text"
                name="marca"
                value={formData.marca}
                onChange={handleInputChange}
                placeholder={detectedData.marca ? `Detectado: ${detectedData.marca}` : 'Ingresa la marca'}
                required
              />
              {detectedData.marca && (
                <span className="detected-badge">✓ Detectado automáticamente</span>
              )}
            </div>

            <div className="typeform-form-group">
              <label>Modelo:</label>
              <input
                type="text"
                name="modelo"
                value={formData.modelo}
                onChange={handleInputChange}
                placeholder={detectedData.modelo ? `Detectado: ${detectedData.modelo}` : 'Ingresa el modelo'}
                required
              />
              {detectedData.modelo && (
                <span className="detected-badge">✓ Detectado automáticamente</span>
              )}
            </div>

            <div className="typeform-form-group">
              <label>Color:</label>
              <input
                type="text"
                name="color"
                value={formData.color}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="typeform-buttons">
              <button 
                onClick={() => {
                  // Volver al paso 0 si no hay stream, al paso 1 si hay stream
                  if (stream) {
                    setCurrentStep(1);
                  } else {
                    setCurrentStep(0);
                  }
                }} 
                className="typeform-btn-secondary"
              >
                ← Volver
              </button>
              <button 
                onClick={() => setCurrentStep(3)} 
                className="typeform-btn-primary"
                disabled={!formData.marca || !formData.modelo || !formData.color}
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Información adicional */}
        {currentStep === 3 && (
          <div className="typeform-step">
            <h2>{steps[2].title}</h2>
            <p className="typeform-description">{steps[2].description}</p>

            <form onSubmit={handleSubmit}>
              <div className="typeform-form-group">
                <label>Nota:</label>
                <input
                  type="text"
                  name="nota"
                  value={formData.nota}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="typeform-form-group">
                <label>Proceso a realizar:</label>
                <select
                  name="proceso_id"
                  value={formData.proceso_id}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Seleccionar proceso...</option>
                  {procesos.map(proceso => (
                    <option key={proceso.id} value={proceso.id}>
                      {proceso.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="typeform-form-group">
                <label>Detalle (opcional):</label>
                <textarea
                  name="problema"
                  value={formData.problema}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Detalles adicionales sobre el equipo..."
                />
              </div>

              <div className="typeform-buttons">
                <button 
                  type="button"
                  onClick={() => setCurrentStep(2)} 
                  className="typeform-btn-secondary"
                >
                  ← Volver
                </button>
                <button 
                  type="submit" 
                  className="typeform-btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : '✓ Agregar Equipo'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

