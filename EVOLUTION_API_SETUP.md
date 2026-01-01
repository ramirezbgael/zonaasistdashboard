# 🚀 Configuración de Evolution API para WhatsApp

Para evitar el límite de tamaño de Netlify Functions (250 MB), usamos **Evolution API**, un servicio REST que maneja WhatsApp sin Puppeteer.

## 📋 Opciones de Instalación

### Opción 1: Evolution API Cloud (Recomendado - Más Fácil)

1. **Crear cuenta en Evolution API Cloud**: https://evolution-api.com/
2. **Obtener credenciales**:
   - API URL
   - API Key
3. **Configurar en Netlify**:
   - Ve a Netlify Dashboard → Site settings → Environment variables
   - Agrega:
     - `EVOLUTION_API_URL`: Tu URL de Evolution API
     - `EVOLUTION_API_KEY`: Tu API Key
     - `EVOLUTION_INSTANCE_NAME`: Nombre de la instancia (ej: `zona-asist`)

### Opción 2: Self-Hosted (Gratis pero requiere servidor)

1. **Deploy Evolution API en Railway/Render/VPS**:
   ```bash
   # Usar Docker
   docker run -d \
     -p 8080:8080 \
     -e AUTHENTICATION_API_KEY=tu-api-key \
     atendai/evolution-api:latest
   ```

2. **Configurar variables de entorno en Netlify**:
   - `EVOLUTION_API_URL`: http://tu-servidor:8080
   - `EVOLUTION_API_KEY`: tu-api-key
   - `EVOLUTION_INSTANCE_NAME`: zona-asist

## 🔧 Configuración en la Aplicación

Las funciones de Netlify ya están configuradas para usar Evolution API. Solo necesitas:

1. **Configurar las variables de entorno en Netlify**
2. **Ejecutar el script SQL actualizado** (`setup_whatsapp.sql`)
3. **Deploy**

## 📚 Documentación de Evolution API

- **Documentación oficial**: https://doc.evolution-api.com/
- **GitHub**: https://github.com/EvolutionAPI/evolution-api
- **Docker Hub**: https://hub.docker.com/r/atendai/evolution-api

## ✅ Ventajas de Evolution API

- ✅ **Ligero**: No incluye Puppeteer/Chromium
- ✅ **REST API**: Fácil de integrar
- ✅ **Múltiples instancias**: Puedes tener varias cuentas
- ✅ **Webhooks**: Notificaciones en tiempo real
- ✅ **Escalable**: Funciona en serverless

## 🔄 Flujo de Uso

1. Usuario hace clic en "Iniciar Sesión"
2. La función crea una instancia en Evolution API
3. Evolution API genera un QR code
4. Usuario escanea el QR con WhatsApp
5. La instancia se conecta automáticamente
6. Puedes enviar mensajes usando la API REST

## 🐛 Troubleshooting

### Error: "Evolution API no configurada"
- Verifica que las variables de entorno estén configuradas en Netlify
- Asegúrate de que `EVOLUTION_API_URL` y `EVOLUTION_API_KEY` estén correctas

### QR Code no aparece
- Verifica que Evolution API esté corriendo
- Revisa los logs de Evolution API
- Asegúrate de que la instancia se haya creado correctamente

### Mensajes no se envían
- Verifica que la instancia esté conectada (status: 'open')
- Revisa el formato del número de teléfono
- Verifica los logs de Evolution API

