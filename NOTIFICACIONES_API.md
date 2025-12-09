# 📋 API de Notificaciones - Para Consumo Externo

Este documento explica cómo tu proyecto local puede consumir las notificaciones desde Supabase para enviar mensajes de WhatsApp.

## 🎯 Flujo del Sistema

```
Supabase Edge Function → Crea notificaciones en BD → Tu proyecto local consume → Envía WhatsApp
```

## 📊 Estructura de Notificaciones

Las notificaciones se guardan en la tabla `notificaciones` con la siguiente estructura:

```sql
CREATE TABLE notificaciones (
    id UUID PRIMARY KEY,
    usuario_id UUID REFERENCES auth.users(id),
    tipo VARCHAR(50),              -- 'recordatorio_diario', 'equipo_nuevo', etc.
    titulo VARCHAR(255),
    mensaje TEXT,
    datos JSONB,                   -- Incluye: items, telefono, nombre_usuario, etc.
    leida BOOLEAN DEFAULT FALSE,
    fecha_leida TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔍 Consultar Notificaciones Pendientes

### Opción 1: Query Directa (Recomendado)

```javascript
// Usando Supabase Client
const { data: notificaciones, error } = await supabase
  .from('notificaciones')
  .select('*')
  .eq('leida', false)
  .eq('tipo', 'recordatorio_diario')  // O el tipo que necesites
  .order('created_at', { ascending: false });

// Cada notificación tiene:
// - id: UUID de la notificación
// - usuario_id: ID del usuario
// - titulo: Título de la notificación
// - mensaje: Mensaje completo
// - datos: {
//     items: [{ tipo: 'equipo', id: '...' }, ...],
//     telefono: '+521234567890',  // Si está disponible
//     nombre_usuario: 'Juan'
//   }
```

### Opción 2: Usando Realtime (Tiempo Real)

```javascript
// Suscribirse a nuevas notificaciones
const channel = supabase
  .channel('notificaciones-realtime')
  .on('postgres_changes', 
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notificaciones',
      filter: 'tipo=eq.recordatorio_diario'
    },
    (payload) => {
      const notificacion = payload.new;
      // Procesar notificación y enviar WhatsApp
      enviarWhatsApp(notificacion);
    }
  )
  .subscribe();
```

## 📱 Ejemplo de Consumo y Envío

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // Usa service_role para acceso completo
);

async function procesarNotificaciones() {
  // Obtener notificaciones no leídas de tipo recordatorio
  const { data: notificaciones, error } = await supabase
    .from('notificaciones')
    .select('*')
    .eq('leida', false)
    .eq('tipo', 'recordatorio_diario')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error obteniendo notificaciones:', error);
    return;
  }

  for (const notificacion of notificaciones || []) {
    try {
      // Verificar si tiene teléfono
      const telefono = notificacion.datos?.telefono;
      
      if (!telefono) {
        console.log(`Notificación ${notificacion.id} no tiene teléfono, saltando...`);
        continue;
      }

      // Enviar WhatsApp usando tu servicio
      const enviado = await enviarWhatsApp(
        telefono,
        notificacion.mensaje
      );

      if (enviado) {
        // Marcar como leída
        await supabase
          .from('notificaciones')
          .update({ 
            leida: true,
            fecha_leida: new Date().toISOString()
          })
          .eq('id', notificacion.id);

        console.log(`✅ Notificación ${notificacion.id} enviada y marcada como leída`);
      }
    } catch (error) {
      console.error(`Error procesando notificación ${notificacion.id}:`, error);
    }
  }
}

// Ejecutar cada X minutos
setInterval(procesarNotificaciones, 60000); // Cada minuto
```

## 🔄 Polling vs Realtime

### Polling (Consulta Periódica)
- ✅ Más simple de implementar
- ✅ No requiere conexión persistente
- ❌ Puede tener delay
- ❌ Consume más recursos

```javascript
// Ejecutar cada minuto
setInterval(procesarNotificaciones, 60000);
```

### Realtime (Suscripción)
- ✅ Inmediato
- ✅ Más eficiente
- ❌ Requiere conexión persistente
- ❌ Más complejo

```javascript
// Suscripción en tiempo real
const channel = supabase
  .channel('notificaciones')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones' }, 
    (payload) => procesarNotificacion(payload.new)
  )
  .subscribe();
```

## 📋 Tipos de Notificaciones

### `recordatorio_diario`
Notificaciones automáticas enviadas 3 veces al día (9am, 2pm, 6pm).

**Estructura de `datos`:**
```json
{
  "items": [
    { "tipo": "equipo", "id": "uuid-equipo" },
    { "tipo": "documento", "id": "uuid-documento" }
  ],
  "telefono": "+521234567890",
  "nombre_usuario": "Juan"
}
```

### `equipo_recepcion`
Cuando se recibe un nuevo equipo. Esta notificación es para enviar la **nota de recepción por correo** al cliente.

**Estructura de `datos`:**
```json
{
  "equipo_id": "uuid",
  "cliente_id": "uuid o null",
  "tipo_notificacion": "recepcion",
  "equipo_info": {
    "marca": "Dell",
    "modelo": "Inspiron 15",
    "color": "Negro",
    "nota": "123",
    "problema": "No enciende"
  },
  "cliente_info": {
    "nombre": "Juan Pérez",
    "telefono": "+521234567890",
    "email": "juan@example.com"
  }
}
```

**Nota:** Si `cliente_info` es `null`, significa que el equipo no tiene cliente asignado. En ese caso, no se debe enviar la nota de recepción.

### `equipo_listo`
Cuando un equipo está listo para entrega. Esta notificación es para enviar **WhatsApp** al cliente.

**Estructura de `datos`:**
```json
{
  "equipo_id": "uuid",
  "cliente_id": "uuid o null",
  "tipo_notificacion": "equipo_listo",
  "equipo_info": {
    "marca": "Dell",
    "modelo": "Inspiron 15",
    "color": "Negro",
    "nota": "123",
    "problema": "No enciende"
  },
  "cliente_info": {
    "nombre": "Juan Pérez",
    "telefono": "+521234567890",
    "email": "juan@example.com"
  }
}
```

**Nota:** Si `cliente_info` es `null` o `cliente_info.telefono` es `null`, significa que no se puede enviar WhatsApp. En ese caso, se debe omitir esta notificación.

### `equipo_finalizado`
Cuando un equipo es entregado.

**Estructura de `datos`:**
```json
{
  "equipo_id": "uuid",
  "cliente_id": "uuid o null",
  "cliente_info": {
    "nombre": "Juan Pérez",
    "telefono": "+521234567890",
    "email": "juan@example.com"
  }
}
```

### `documento_nuevo`
Cuando se crea un nuevo documento.

### `pedido_nuevo`
Cuando se crea un nuevo pedido.

## 🔐 Autenticación

Para acceder a las notificaciones desde tu proyecto local, necesitas:

1. **Service Role Key** (acceso completo):
   ```env
   SUPABASE_URL=https://tu-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
   ```

2. **O crear un usuario de servicio** con permisos específicos.

## 📊 Consultas Útiles

### Obtener notificaciones de un usuario específico
```sql
SELECT * FROM notificaciones
WHERE usuario_id = 'uuid-del-usuario'
AND leida = false
ORDER BY created_at DESC;
```

### Obtener notificaciones de recepción (para enviar correo)
```sql
SELECT * FROM notificaciones
WHERE leida = false
AND tipo = 'equipo_recepcion'
AND datos->'cliente_info'->>'email' IS NOT NULL
ORDER BY created_at DESC;
```

### Obtener notificaciones de equipo listo (para enviar WhatsApp)
```sql
SELECT * FROM notificaciones
WHERE leida = false
AND tipo = 'equipo_listo'
AND datos->'cliente_info'->>'telefono' IS NOT NULL
ORDER BY created_at DESC;
```

### Contar notificaciones pendientes por usuario
```sql
SELECT 
  usuario_id,
  COUNT(*) as pendientes
FROM notificaciones
WHERE leida = false
GROUP BY usuario_id;
```

## 🧪 Probar el Sistema

1. **Crear una notificación de prueba:**
```sql
INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
VALUES (
  'uuid-del-usuario',
  'recordatorio_diario',
  'Recordatorio de Prueba',
  'Este es un mensaje de prueba',
  '{"telefono": "+521234567890", "nombre_usuario": "Test"}'::jsonb
);
```

2. **Verificar que tu proyecto local la consume:**
   - Ejecuta tu script de consumo
   - Debería detectar la notificación
   - Enviar WhatsApp
   - Marcar como leída

## 📝 Checklist de Implementación

- [ ] Configurar Supabase Client en tu proyecto local
- [ ] Implementar función de consumo (polling o realtime)
- [ ] Filtrar notificaciones por tipo:
  - [ ] `equipo_recepcion` → Enviar nota de recepción por correo
  - [ ] `equipo_listo` → Enviar WhatsApp
- [ ] Integrar con tu servicio de correo (para notas de recepción)
- [ ] Integrar con tu servicio de WhatsApp (para equipos listos)
- [ ] Marcar notificaciones como leídas después de enviar
- [ ] Manejar errores y reintentos
- [ ] Agregar logging para debugging
- [ ] Validar que exista `cliente_info` y los datos necesarios antes de enviar

## 🆘 Solución de Problemas

### No aparecen notificaciones
- Verifica que la Edge Function se ejecute correctamente
- Revisa los logs de Supabase Functions
- Verifica que los usuarios tengan items pendientes asignados

### No se marcan como leídas
- Verifica permisos RLS en la tabla `notificaciones`
- Asegúrate de usar `service_role_key` o que el usuario tenga permisos UPDATE

### No tienen teléfono o email
- Verifica que el equipo tenga un `cliente_id` asignado
- Verifica que el cliente tenga `telefono` (para WhatsApp) o `email` (para correo) en la tabla `clientes`
- Revisa que las funciones de notificación estén obteniendo correctamente la información del cliente

## 📧 Ejemplo de Mensaje para Nota de Recepción

Cuando recibas una notificación de tipo `equipo_recepcion`, puedes generar un mensaje como:

```
Estimado/a [cliente_info.nombre],

Hemos recibido su equipo en nuestro taller:

Equipo: [equipo_info.marca] [equipo_info.modelo]
Color: [equipo_info.color]
Número de Nota: #[equipo_info.nota]
Problema Reportado: [equipo_info.problema]

Su equipo está ahora en proceso de revisión y reparación.
Le mantendremos informado sobre el avance.

Saludos,
[Tu nombre/Taller]
```

## 📱 Ejemplo de Mensaje para WhatsApp (Equipo Listo)

Cuando recibas una notificación de tipo `equipo_listo`, puedes generar un mensaje como:

```
¡Hola [cliente_info.nombre]! 👋

Tenemos buenas noticias: tu equipo está listo para recoger.

Equipo: [equipo_info.marca] [equipo_info.modelo]
Número de Nota: #[equipo_info.nota]

Puedes pasar a recogerlo en nuestro taller.
Horario: [tu horario]

¡Te esperamos! 🎉
```

