# 📱 Configuración de WhatsApp en Netlify

Este módulo de WhatsApp está configurado para ejecutarse en Netlify Functions usando `whatsapp-web.js`.

## 🚀 Configuración Inicial

### 1. Ejecutar Script SQL

Ejecuta el script `setup_whatsapp.sql` en el SQL Editor de Supabase para crear las tablas necesarias:

```sql
-- Ejecutar en Supabase SQL Editor
\i setup_whatsapp.sql
```

### 2. Configurar Variables de Entorno en Netlify

Ve al Dashboard de Netlify → Site settings → Environment variables y agrega:

- `VITE_SUPABASE_URL`: Tu URL de Supabase (ej: `https://xxxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: Tu Service Role Key de Supabase (⚠️ Mantén esto secreto)

### 3. Deploy en Netlify

```bash
# Si usas Git, simplemente push:
git add .
git commit -m "Agregar funciones de WhatsApp"
git push

# Netlify detectará los cambios y hará el deploy automáticamente
```

O si prefieres deploy manual:

```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

## 📋 Funciones de Netlify Creadas

### `whatsapp-estado`
Verifica el estado actual de la sesión de WhatsApp.

**Endpoint**: `/.netlify/functions/whatsapp-estado`

**Método**: GET

**Respuesta**:
```json
{
  "estado": "conectado" | "desconectado" | "esperando_qr",
  "numero": "1234567890",
  "activo": true,
  "qr_code": "data:image/png;base64,..."
}
```

### `whatsapp-iniciar`
Inicia la sesión de WhatsApp y genera un QR code.

**Endpoint**: `/.netlify/functions/whatsapp-iniciar`

**Método**: POST

**Respuesta**:
```json
{
  "qr_code": "data:image/png;base64,...",
  "estado": "esperando_qr"
}
```

### `whatsapp-enviar`
Envía un mensaje por WhatsApp.

**Endpoint**: `/.netlify/functions/whatsapp-enviar`

**Método**: POST

**Body**:
```json
{
  "telefono": "1234567890",
  "mensaje": "Hola, este es un mensaje",
  "notificacion_id": 123,
  "tipo": "equipo_recepcion",
  "incluir_pdf": false,
  "equipo_id": 456
}
```

### `whatsapp-cerrar`
Cierra la sesión de WhatsApp.

**Endpoint**: `/.netlify/functions/whatsapp-cerrar`

**Método**: POST

## ⚠️ Limitaciones de Netlify Functions

Las funciones serverless de Netlify tienen algunas limitaciones:

1. **Tiempo de ejecución**: Máximo 10 segundos en plan gratuito, 26 segundos en plan Pro
2. **Memoria**: Limitada según el plan
3. **Estado**: No se mantiene entre invocaciones (por eso guardamos en Supabase)
4. **Sesión de WhatsApp**: Se reinicia cada vez que se invoca la función

### Solución Recomendada

Para producción, considera:

1. **Usar un servicio dedicado**: Ejecutar `whatsapp-web.js` en un servidor VPS o servicio como Railway, Render, etc.
2. **Evolution API**: Usar una API REST que maneje WhatsApp por ti
3. **WhatsApp Business API**: La solución oficial de Meta (requiere aprobación)

## 🔧 Troubleshooting

### Error: "Puppeteer no puede iniciar"

Las funciones de Netlify pueden tener problemas con Puppeteer. Asegúrate de que los argumentos de Chrome estén configurados correctamente en las funciones.

### Error: "Sesión no encontrada"

La sesión se guarda en `/tmp/.wwebjs_auth` que se elimina después de cada invocación. Para mantener la sesión, considera:

1. Guardar los archivos de sesión en Supabase Storage
2. Usar un servicio que mantenga el proceso activo

### QR Code no aparece

Verifica que:
- Las variables de entorno estén configuradas correctamente
- La tabla `whatsapp_config` tenga las columnas `estado` y `qr_code`
- Los logs de Netlify Functions para ver errores

## 📚 Recursos

- [whatsapp-web.js Documentation](https://wwebjs.dev/)
- [Netlify Functions](https://docs.netlify.com/functions/overview/)
- [Supabase Storage](https://supabase.com/docs/guides/storage)

