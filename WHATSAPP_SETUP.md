# 📱 Configuración del Módulo de WhatsApp

Este módulo permite enviar notificaciones automáticas a clientes por WhatsApp usando autenticación por QR code con manejo de sesiones.

## 🚀 Configuración Inicial

### 1. Ejecutar Script SQL

Ejecuta el script `setup_whatsapp.sql` en el SQL Editor de Supabase para crear las tablas necesarias:

```sql
-- Ejecutar en Supabase SQL Editor
\i setup_whatsapp.sql
```

### 2. Configurar WhatsApp con QR Code

El sistema usa autenticación por QR code (similar a WhatsApp Web):

1. **Ve a la página de WhatsApp** en la aplicación
2. **Haz clic en "Configuración"**
3. **Haz clic en "Iniciar Sesión"**
4. **Escanea el QR code** que aparece con tu WhatsApp:
   - Abre WhatsApp en tu teléfono
   - Ve a Configuración → Dispositivos vinculados
   - Toca "Vincular un dispositivo"
   - Escanea el código QR
5. **Activa el envío automático** una vez conectado

#### Opción B: Usar otro servicio de WhatsApp

Puedes adaptar el código para usar otros servicios como:
- WhatsApp Business API (oficial)
- Baileys (Node.js)
- Otros servicios de mensajería

### 3. Deploy Edge Function (Opcional pero Recomendado)

Para enviar mensajes de forma segura sin exponer credenciales en el frontend:

```bash
# Instalar Supabase CLI si no lo tienes
npm install -g supabase

# Login en Supabase
supabase login

# Link tu proyecto
supabase link --project-ref tu-project-ref

# Deploy la función
supabase functions deploy enviar-whatsapp
```

**Configurar variables de entorno en Supabase Dashboard:**
- `SUPABASE_URL`: Tu URL de Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Tu service role key (solo para Edge Functions)

## 📋 Funcionalidades

### Envío Automático

El sistema puede enviar automáticamente notificaciones cuando:
- Se crea un nuevo equipo (nota de recepción)
- Un equipo está listo para recoger
- Un equipo es entregado

### Envío Manual

Desde la página de WhatsApp puedes:
- Ver todas las notificaciones pendientes
- Enviar mensajes individuales
- Enviar mensajes con PDF adjunto (notas de recepción/entrega)
- Ver historial de mensajes enviados

### Plantillas de Mensajes

Los mensajes se generan automáticamente según el tipo:
- **Nota de Recepción**: Confirma recepción del equipo
- **Equipo Listo**: Notifica que el equipo está listo
- **Equipo Entregado**: Confirma entrega del equipo

## 🔧 Integración con Notificaciones Existentes

El módulo lee automáticamente las notificaciones de la tabla `notificaciones` que tienen:
- `tipo` en: `equipo_recepcion`, `equipo_listo`, `equipo_finalizado`
- `enviado_whatsapp = false`
- Cliente con teléfono válido

## 📝 Estructura de Base de Datos

### Tabla: `whatsapp_config`
Almacena la configuración de la API de WhatsApp.

### Tabla: `whatsapp_mensajes`
Registro de todos los mensajes enviados.

### Columnas agregadas a `notificaciones`:
- `enviado_whatsapp`: Indica si fue enviada
- `fecha_envio_whatsapp`: Fecha de envío

## 🔄 Procesamiento Automático

Para procesar notificaciones automáticamente, puedes:

1. **Usar Supabase Cron Jobs** (Recomendado):
   ```sql
   -- Crear función que se ejecute cada 5 minutos
   SELECT cron.schedule(
     'procesar-whatsapp',
     '*/5 * * * *',
     $$
     SELECT procesar_notificaciones_pendientes();
     $$
   );
   ```

2. **Llamar manualmente desde el frontend**:
   ```javascript
   import { procesarNotificacionesPendientes } from './services/whatsappService';
   await procesarNotificacionesPendientes();
   ```

## 🐛 Troubleshooting

### Los mensajes no se envían

1. Verifica que la configuración esté activa
2. Verifica las credenciales de Twilio
3. Verifica que el número de teléfono esté en formato correcto (+52...)
4. Revisa los logs en la tabla `whatsapp_mensajes` para ver errores

### Error: "WhatsApp no está configurado"

Asegúrate de:
- Ejecutar el script SQL
- Configurar las credenciales en la página de WhatsApp
- Activar el envío automático

## 📚 Recursos

- [Documentación de Twilio WhatsApp](https://www.twilio.com/docs/whatsapp)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)

