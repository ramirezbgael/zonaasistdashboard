# 🎯 PROPUESTA DE REDISEÑO: Formulario "Agregar Producto al Inventario"
**Senior UX Designer + Product Engineer | Zona Asist**

---

## 📋 RESUMEN EJECUTIVO

El formulario actual funciona pero tiene oportunidades de mejora en **claridad, validaciones y preparación para escalar**. Esta propuesta transforma el formulario en una herramienta profesional que reduce errores humanos y prepara el sistema para flujos avanzados de inventario.

**Objetivos clave:**
- ✅ Reducir errores de captura en 80%
- ✅ Tiempo de captura < 2 minutos para técnicos
- ✅ Preparar base para entradas/salidas automáticas
- ✅ Mantener simplicidad visual

---

## 1️⃣ ESTRUCTURA DEL FORMULARIO

### **Nueva Organización (3 Pasos → 2 Pasos)**

#### **PASO 1: Identificación del Producto** ⭐
*"¿Qué producto estás agregando?"*

**Campos:**
1. **Tipo de Producto** ⚠️ REQUERIDO
   - Dropdown con iconos
   - Opciones: Refacción, Consumible, Equipo para Venta, Papel, Tinta, Almohadilla, Disco Duro, Otro
   - **Microcopy:** "Selecciona la categoría principal del producto"

2. **Nombre del Producto** ⚠️ REQUERIDO
   - Input de texto con autocompletado
   - **Placeholder dinámico según tipo:**
     - Refacción: "Ej: Pantalla LCD 15.6", "Batería HP Pavilion"
     - Consumible: "Ej: Papel A4 500 hojas", "Tinta HP 302XL"
     - Equipo: "Ej: Laptop Dell Inspiron 15"
   - **Validación:** Mínimo 3 caracteres, máximo 255
   - **Microcopy:** "Nombre descriptivo que identifique el producto"

3. **Código SKU** (Opcional, pero recomendado)
   - Input de texto
   - **Placeholder:** "Ej: HP302XL-BLK, DELL-BAT-15"
   - **Validación:** Único en la base de datos
   - **Microcopy:** "Código interno único. Si no tienes uno, déjalo vacío y se generará automáticamente"
   - **Badge:** "Auto-generar si está vacío" (checkbox)

4. **Descripción** (Opcional)
   - Textarea (2 líneas)
   - **Placeholder:** "Características adicionales, especificaciones técnicas..."
   - **Microcopy:** "Información útil para identificar el producto más adelante"

---

#### **PASO 2: Control de Stock y Costos** 💰
*"¿Cuánto tienes y cuánto cuesta?"*

**Sección A: Stock Inicial**
1. **Cantidad Inicial** ⚠️ REQUERIDO
   - Input numérico
   - **Default:** 0 (permitir productos sin stock)
   - **Validación:** >= 0, máximo 999,999
   - **Microcopy:** "Cantidad que tienes disponible ahora. Puede ser 0 si solo estás registrando el producto"
   - **Badge contextual:**
     - Si = 0: "⚠️ Producto sin stock inicial"
     - Si > 0: "✅ Stock inicial registrado"

2. **Stock Mínimo** (Opcional pero recomendado)
   - Input numérico
   - **Default:** 0
   - **Validación:** >= 0, debe ser <= Stock Máximo (si existe)
   - **Microcopy:** "Te alertaremos cuando el stock baje de esta cantidad"
   - **Sugerencia inteligente:** Si stock inicial > 0, sugerir 10% del stock inicial

3. **Stock Máximo** (Opcional)
   - Input numérico
   - **Default:** Vacío
   - **Validación:** Debe ser >= Stock Mínimo (si existe)
   - **Microcopy:** "Cantidad máxima recomendada. Útil para sugerencias de compra"
   - **Sugerencia inteligente:** Si stock inicial > 0, sugerir 2x del stock inicial

**Sección B: Costos y Precios**
4. **Costo por Unidad** ⚠️ REQUERIDO (si stock inicial > 0)
   - Input numérico con formato de moneda
   - **Default:** 0.00
   - **Validación:** >= 0, máximo 999,999.99
   - **Placeholder:** "0.00"
   - **Microcopy:** "Costo de compra por unidad. Si el stock inicial es 0, puedes dejarlo en $0.00"
   - **Regla condicional:** Si stock inicial = 0, campo opcional

5. **Valor Total del Inventario** (Calculado, solo lectura)
   - Display destacado
   - **Fórmula:** `Cantidad Inicial × Costo por Unidad`
   - **Formato:** "$X,XXX.XX"
   - **Estados:**
     - Si = 0: Texto gris "Sin valor inicial"
     - Si > 0: Texto verde destacado
   - **Microcopy:** "Valor total del stock inicial"

6. **Precio de Venta** (Opcional, solo si tipo = "Equipo para Venta")
   - Input numérico con formato de moneda
   - **Default:** Vacío
   - **Validación:** >= Costo por Unidad (sugerencia, no bloqueante)
   - **Placeholder:** "0.00"
   - **Microcopy:** "Precio al que venderás este producto. Solo para productos vendibles"
   - **Regla condicional:** Solo visible si tipo = "equipo_venta"
   - **Badge de margen:** Si precio > costo, mostrar "Margen: X%"

**Sección C: Información Adicional** (Colapsable)
7. **Proveedor** (Opcional)
   - Dropdown con búsqueda
   - **Opción:** "Agregar nuevo proveedor" (abre modal rápido)
   - **Microcopy:** "Proveedor habitual de este producto"

8. **Ubicación Física** (Opcional)
   - Input de texto con sugerencias
   - **Placeholder:** "Ej: Estante A, Caja 3, Almacén Principal"
   - **Microcopy:** "Dónde está físicamente almacenado"
   - **Sugerencias:** Últimas 5 ubicaciones usadas

9. **Categoría** (Opcional)
   - Input de texto con autocompletado
   - **Placeholder:** "Ej: Impresoras, Computadoras, General"
   - **Microcopy:** "Para agrupar productos similares"
   - **Sugerencias:** Categorías existentes

10. **Unidad de Medida** (Opcional)
    - Dropdown
    - **Opciones:** Pieza, Metro, Litro, Kilogramo
    - **Default:** Pieza
    - **Microcopy:** "Unidad en que se mide este producto"

---

## 2️⃣ VALIDACIONES INTELIGENTES

### **Validaciones en Tiempo Real**

#### **Validación de Consistencia**
```javascript
// Stock Mínimo vs Máximo
if (stock_maximo && stock_minimo > stock_maximo) {
  Error: "El stock mínimo no puede ser mayor al máximo"
}

// Stock Inicial vs Máximo
if (stock_maximo && stock_actual > stock_maximo) {
  Advertencia: "El stock inicial supera el máximo recomendado. ¿Es correcto?"
}

// Precio de Venta vs Costo
if (precio_venta && precio_venta < costo_promedio) {
  Advertencia: "Estás vendiendo por debajo del costo. ¿Es correcto?"
}
```

#### **Validaciones de Negocio**
```javascript
// Stock inicial = 0
if (stock_actual === 0 && costo_promedio > 0) {
  Advertencia: "Tienes costo pero sin stock. ¿Quieres registrar el producto para futuras compras?"
  // Permitir, pero mostrar badge informativo
}

// Costo = 0 pero stock > 0
if (stock_actual > 0 && costo_promedio === 0) {
  Advertencia: "Tienes stock pero sin costo. ¿Es un producto gratuito o necesitas agregar el costo?"
  // Permitir, pero requerir confirmación
}

// SKU duplicado
if (codigo_sku existe en BD) {
  Error: "Este código SKU ya existe. Usa otro o edita el producto existente"
  // Mostrar link al producto existente
}
```

#### **Validaciones de Formato**
- **Números:** Solo enteros positivos (stock), decimales con 2 decimales (precios)
- **Texto:** Trim automático, capitalización inteligente en nombre
- **SKU:** Sin espacios, mayúsculas automáticas

---

## 3️⃣ MEJORAS DE UX

### **Microcopy Estratégico**

**Principio:** Cada campo debe explicar **por qué** se pide, no solo **qué** se pide.

**Ejemplos:**
- ❌ "Stock Inicial" 
- ✅ "Stock Inicial - Cantidad que tienes disponible ahora. Puede ser 0 si solo estás registrando el producto"

- ❌ "Costo Promedio"
- ✅ "Costo por Unidad - Precio que pagaste por cada unidad. Si compraste 10 a $100, pon $100"

### **Estados Visuales**

1. **Campo Vacío:**
   - Placeholder descriptivo
   - Hint text visible
   - Borde gris suave

2. **Campo con Valor:**
   - Hint text se reduce a icono de info (hover para ver completo)
   - Borde verde suave si válido

3. **Campo con Error:**
   - Mensaje de error debajo del campo
   - Icono de alerta
   - Borde rojo
   - El error desaparece al corregir

4. **Campo con Advertencia:**
   - Mensaje de advertencia (amarillo)
   - Permite continuar pero informa

### **Cálculos en Tiempo Real**

**Valor Total:**
- Se actualiza automáticamente
- Visible siempre que stock > 0 y costo > 0
- Formato: "$1,234.56"
- Animación sutil al cambiar

**Margen (solo productos vendibles):**
- Si precio_venta > costo_promedio
- Mostrar: "Margen: 25% ($50.00 por unidad)"
- Color verde si margen > 20%, amarillo si < 20%

### **Defaults Inteligentes**

```javascript
// Basados en tipo de producto
if (tipo === 'tinta') {
  sugerir_unidad_medida = 'pieza';
  sugerir_stock_minimo = 5;
}

if (tipo === 'papel') {
  sugerir_unidad_medida = 'metro' o 'pieza';
  sugerir_stock_minimo = 10;
}

if (tipo === 'equipo_venta') {
  mostrar_precio_venta = true;
  sugerir_margen = 30%;
}
```

### **Autocompletado Inteligente**

- **Nombre:** Sugerir nombres similares existentes
- **SKU:** Generar automáticamente si está vacío: `TIPO-XXXX` (ej: REF-0001)
- **Ubicación:** Últimas ubicaciones usadas
- **Categoría:** Categorías existentes

---

## 4️⃣ LÓGICA DE NEGOCIO

### **Cálculo de Costo Promedio**

**Regla actual:** Se captura manualmente
**Regla mejorada:** Se calcula automáticamente basado en movimientos

**Para productos nuevos:**
- Si stock inicial > 0: El costo ingresado se registra como primera entrada
- Se crea movimiento de tipo "entrada" con motivo "inicial"
- Este movimiento es la base para calcular costo promedio futuro

**Para productos existentes:**
- El costo promedio se recalcula automáticamente con cada nueva entrada
- Fórmula: `(Stock Anterior × Costo Anterior + Nueva Cantidad × Nuevo Costo) / Stock Total`

### **Cuándo Usar Precio de Venta**

**Solo para:**
- Tipo = "Equipo para Venta"
- Productos que se venden directamente a clientes

**No usar para:**
- Refacciones (se usan en reparaciones, no se venden)
- Consumibles internos (papel, tintas para uso interno)

**Lógica:**
```javascript
if (tipo === 'equipo_venta') {
  mostrar_campo_precio_venta = true;
  validar_margen = true; // Sugerir margen mínimo
} else {
  ocultar_campo_precio_venta = true;
  precio_venta = null;
}
```

### **Preparación para Entradas Futuras**

**Estructura de datos:**
- Cada producto nuevo crea un registro en `inventario_productos`
- Si stock inicial > 0, se crea automáticamente un movimiento en `inventario_movimientos`
- Tipo: "entrada"
- Motivo: "inicial"
- Referencia: "manual"

**Ventajas:**
- Auditoría completa desde el día 1
- Historial de cambios
- Base para calcular costos promedios futuros
- Preparado para entradas/salidas automáticas

---

## 5️⃣ BUENAS PRÁCTICAS

### **Qué NO Pedir en Este Formulario**

❌ **Fecha de compra:** Se registra automáticamente como `created_at`
❌ **Fecha de vencimiento:** Para otro módulo (control de caducidad)
❌ **Número de serie:** Solo para equipos específicos (otro formulario)
❌ **Equipo asociado:** Se asocia cuando se usa, no al crear
❌ **Historial de movimientos:** Se genera automáticamente

### **Errores Comunes a Evitar**

1. **Stock negativo:** Validación estricta >= 0
2. **Costos sin stock:** Permitir pero advertir
3. **SKU duplicado:** Validación en tiempo real
4. **Stock mínimo > máximo:** Validación cruzada
5. **Precio < Costo:** Advertencia (puede ser intencional)

### **Decisiones que Escalan**

✅ **Movimientos automáticos:** Cada cambio genera auditoría
✅ **Costo promedio calculado:** No manual, siempre preciso
✅ **SKU único:** Base para integraciones futuras
✅ **Tipos estandarizados:** Fácil agregar nuevos tipos
✅ **Categorías flexibles:** Permite organización personalizada

---

## 🎨 ESTRUCTURA FINAL DEL FORMULARIO

### **Campos, Tipos, Validaciones y Defaults**

```javascript
const FORM_STRUCTURE = {
  step1: {
    title: "Identificación del Producto",
    fields: [
      {
        name: "tipo",
        label: "Tipo de Producto",
        type: "select",
        required: true,
        options: tiposProductos,
        validation: {
          required: true,
          message: "Selecciona el tipo de producto"
        },
        hint: "Selecciona la categoría principal del producto",
        defaultValue: ""
      },
      {
        name: "nombre",
        label: "Nombre del Producto",
        type: "text",
        required: true,
        placeholder: "Dinámico según tipo",
        validation: {
          required: true,
          minLength: 3,
          maxLength: 255,
          message: "El nombre debe tener entre 3 y 255 caracteres"
        },
        hint: "Nombre descriptivo que identifique el producto",
        defaultValue: "",
        autocomplete: true
      },
      {
        name: "codigo_sku",
        label: "Código SKU",
        type: "text",
        required: false,
        placeholder: "Ej: HP302XL-BLK",
        validation: {
          unique: true,
          format: "uppercase",
          noSpaces: true,
          message: "Este SKU ya existe. Usa otro o edita el producto existente"
        },
        hint: "Código interno único. Si no tienes uno, déjalo vacío y se generará automáticamente",
        defaultValue: "",
        autoGenerate: true
      },
      {
        name: "descripcion",
        label: "Descripción",
        type: "textarea",
        required: false,
        placeholder: "Características adicionales, especificaciones técnicas...",
        validation: {
          maxLength: 1000
        },
        hint: "Información útil para identificar el producto más adelante",
        defaultValue: "",
        rows: 2
      }
    ]
  },
  step2: {
    title: "Control de Stock y Costos",
    sections: [
      {
        title: "Stock Inicial",
        collapsible: false,
        fields: [
          {
            name: "stock_actual",
            label: "Cantidad Inicial",
            type: "number",
            required: true,
            min: 0,
            max: 999999,
            defaultValue: 0,
            validation: {
              required: true,
              min: 0,
              message: "La cantidad debe ser 0 o mayor"
            },
            hint: "Cantidad que tienes disponible ahora. Puede ser 0 si solo estás registrando el producto",
            badge: {
              show: true,
              condition: "stock_actual === 0 ? 'warning' : 'success'",
              text: "stock_actual === 0 ? 'Sin stock inicial' : 'Stock inicial registrado'"
            }
          },
          {
            name: "stock_minimo",
            label: "Stock Mínimo",
            type: "number",
            required: false,
            min: 0,
            defaultValue: 0,
            validation: {
              crossValidate: "stock_maximo",
              message: "El stock mínimo no puede ser mayor al máximo"
            },
            hint: "Te alertaremos cuando el stock baje de esta cantidad",
            suggestion: {
              enabled: true,
              formula: "stock_actual > 0 ? Math.ceil(stock_actual * 0.1) : 0",
              text: "Sugerencia: 10% del stock inicial"
            }
          },
          {
            name: "stock_maximo",
            label: "Stock Máximo",
            type: "number",
            required: false,
            min: 0,
            defaultValue: null,
            validation: {
              crossValidate: "stock_minimo",
              message: "El stock máximo debe ser mayor o igual al mínimo"
            },
            hint: "Cantidad máxima recomendada. Útil para sugerencias de compra",
            suggestion: {
              enabled: true,
              formula: "stock_actual > 0 ? stock_actual * 2 : null",
              text: "Sugerencia: 2x del stock inicial"
            }
          }
        ]
      },
      {
        title: "Costos y Precios",
        collapsible: false,
        fields: [
          {
            name: "costo_promedio",
            label: "Costo por Unidad",
            type: "currency",
            required: "conditional", // Requerido si stock_actual > 0
            min: 0,
            max: 999999.99,
            step: 0.01,
            defaultValue: 0.00,
            validation: {
              required: "stock_actual > 0",
              min: 0,
              message: "El costo debe ser 0 o mayor"
            },
            hint: "Costo de compra por unidad. Si el stock inicial es 0, puedes dejarlo en $0.00",
            format: "currency"
          },
          {
            name: "valor_total",
            label: "Valor Total del Inventario",
            type: "calculated",
            formula: "stock_actual * costo_promedio",
            format: "currency",
            readonly: true,
            display: {
              condition: "stock_actual > 0 && costo_promedio > 0",
              emptyText: "Sin valor inicial"
            }
          },
          {
            name: "precio_venta",
            label: "Precio de Venta",
            type: "currency",
            required: false,
            min: 0,
            step: 0.01,
            defaultValue: null,
            validation: {
              warning: "precio_venta < costo_promedio",
              message: "Estás vendiendo por debajo del costo. ¿Es correcto?"
            },
            hint: "Precio al que venderás este producto. Solo para productos vendibles",
            conditional: {
              show: "tipo === 'equipo_venta'",
              hide: true
            },
            badge: {
              show: true,
              condition: "precio_venta > costo_promedio",
              formula: "((precio_venta - costo_promedio) / costo_promedio * 100).toFixed(0)",
              text: "Margen: {value}%"
            }
          }
        ]
      },
      {
        title: "Información Adicional",
        collapsible: true,
        defaultCollapsed: false,
        fields: [
          {
            name: "proveedor_id",
            label: "Proveedor",
            type: "select-search",
            required: false,
            options: "proveedores",
            defaultValue: null,
            hint: "Proveedor habitual de este producto",
            action: {
              type: "add-new",
              label: "Agregar nuevo proveedor",
              modal: "AddProveedorModal"
            }
          },
          {
            name: "ubicacion",
            label: "Ubicación Física",
            type: "text-autocomplete",
            required: false,
            placeholder: "Ej: Estante A, Caja 3, Almacén Principal",
            defaultValue: "",
            hint: "Dónde está físicamente almacenado",
            suggestions: "last_5_locations"
          },
          {
            name: "categoria",
            label: "Categoría",
            type: "text-autocomplete",
            required: false,
            placeholder: "Ej: Impresoras, Computadoras, General",
            defaultValue: "",
            hint: "Para agrupar productos similares",
            suggestions: "existing_categories"
          },
          {
            name: "unidad_medida",
            label: "Unidad de Medida",
            type: "select",
            required: false,
            options: [
              { value: "pieza", label: "Pieza" },
              { value: "metro", label: "Metro" },
              { value: "litro", label: "Litro" },
              { value: "kg", label: "Kilogramo" }
            ],
            defaultValue: "pieza",
            hint: "Unidad en que se mide este producto"
          }
        ]
      }
    ]
  }
};
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Reestructurar formulario a 2 pasos
- [ ] Agregar validaciones en tiempo real
- [ ] Implementar microcopy en todos los campos
- [ ] Agregar cálculos automáticos (valor total, margen)
- [ ] Implementar defaults inteligentes
- [ ] Agregar autocompletado en nombre, ubicación, categoría
- [ ] Implementar generación automática de SKU
- [ ] Agregar badges contextuales
- [ ] Implementar sección colapsable de información adicional
- [ ] Agregar validaciones cruzadas (mínimo vs máximo)
- [ ] Implementar lógica condicional para precio de venta
- [ ] Agregar creación automática de movimiento inicial
- [ ] Mejorar mensajes de error y advertencias
- [ ] Agregar sugerencias inteligentes (stock mínimo/máximo)

---

## 🚀 PRÓXIMOS PASOS

1. **Fase 1:** Implementar estructura básica (2 pasos, campos reorganizados)
2. **Fase 2:** Agregar validaciones y microcopy
3. **Fase 3:** Implementar cálculos y sugerencias inteligentes
4. **Fase 4:** Testing con usuarios reales (técnicos/recepcionistas)
5. **Fase 5:** Ajustes finos basados en feedback

---

**Preparado para implementación directa** ✅

