# 📐 ESTRUCTURA TÉCNICA FINAL: Formulario de Inventario
**Listo para implementación directa**

---

## 🎯 CONFIGURACIÓN COMPLETA DE CAMPOS

### **PASO 1: Identificación del Producto**

```javascript
const STEP1_FIELDS = [
  {
    id: 'tipo',
    name: 'tipo',
    label: 'Tipo de Producto',
    type: 'select', // CustomSelect component
    required: true,
    placeholder: 'Selecciona un tipo',
    defaultValue: '',
    options: [
      { value: 'refaccion', label: 'Refacción' },
      { value: 'consumible', label: 'Consumible' },
      { value: 'equipo_venta', label: 'Equipo para Venta' },
      { value: 'papel', label: 'Papel' },
      { value: 'tinta', label: 'Tinta de Impresora' },
      { value: 'almohadilla', label: 'Almohadilla de Impresora' },
      { value: 'disco_duro', label: 'Disco Duro' },
      { value: 'otro', label: 'Otro' }
    ],
    validation: {
      required: {
        enabled: true,
        message: 'Selecciona el tipo de producto'
      }
    },
    hint: 'Selecciona la categoría principal del producto',
    onChange: (value) => {
      // Actualizar placeholder dinámico del nombre
      updatePlaceholder('nombre', getPlaceholderForType(value));
    }
  },
  {
    id: 'nombre',
    name: 'nombre',
    label: 'Nombre del Producto',
    type: 'text',
    required: true,
    placeholder: 'Dinámico según tipo', // Se actualiza con onChange de tipo
    defaultValue: '',
    maxLength: 255,
    validation: {
      required: {
        enabled: true,
        message: 'El nombre del producto es requerido'
      },
      minLength: {
        enabled: true,
        value: 3,
        message: 'El nombre debe tener al menos 3 caracteres'
      },
      maxLength: {
        enabled: true,
        value: 255,
        message: 'El nombre no puede exceder 255 caracteres'
      }
    },
    hint: 'Nombre descriptivo que identifique el producto',
    autocomplete: {
      enabled: true,
      source: 'productos_existentes',
      field: 'nombre',
      minChars: 2
    },
    transform: {
      trim: true,
      capitalize: true
    }
  },
  {
    id: 'codigo_sku',
    name: 'codigo_sku',
    label: 'Código SKU',
    type: 'text',
    required: false,
    placeholder: 'Ej: HP302XL-BLK, DELL-BAT-15',
    defaultValue: '',
    validation: {
      unique: {
        enabled: true,
        table: 'inventario_productos',
        field: 'codigo_sku',
        message: 'Este código SKU ya existe. Usa otro o edita el producto existente',
        async: true
      },
      format: {
        enabled: true,
        rules: ['uppercase', 'noSpaces'],
        transform: true
      }
    },
    hint: 'Código interno único. Si no tienes uno, déjalo vacío y se generará automáticamente',
    autoGenerate: {
      enabled: true,
      pattern: '{TIPO}-{NUMBER}',
      trigger: 'onBlur',
      condition: 'value === ""'
    },
    badge: {
      show: true,
      text: 'Auto-generar si está vacío',
      type: 'info'
    }
  },
  {
    id: 'descripcion',
    name: 'descripcion',
    label: 'Descripción',
    type: 'textarea',
    required: false,
    placeholder: 'Características adicionales, especificaciones técnicas...',
    defaultValue: '',
    rows: 2,
    maxLength: 1000,
    validation: {
      maxLength: {
        enabled: true,
        value: 1000,
        message: 'La descripción no puede exceder 1000 caracteres'
      }
    },
    hint: 'Información útil para identificar el producto más adelante'
  }
];
```

---

### **PASO 2: Control de Stock y Costos**

#### **Sección A: Stock Inicial**

```javascript
const STEP2_SECTION_STOCK = [
  {
    id: 'stock_actual',
    name: 'stock_actual',
    label: 'Cantidad Inicial',
    type: 'number',
    required: true,
    placeholder: '0',
    defaultValue: 0,
    min: 0,
    max: 999999,
    step: 1,
    validation: {
      required: {
        enabled: true,
        message: 'La cantidad inicial es requerida'
      },
      min: {
        enabled: true,
        value: 0,
        message: 'La cantidad no puede ser negativa'
      },
      max: {
        enabled: true,
        value: 999999,
        message: 'La cantidad no puede exceder 999,999'
      }
    },
    hint: 'Cantidad que tienes disponible ahora. Puede ser 0 si solo estás registrando el producto',
    badge: {
      show: true,
      condition: (value) => value === 0,
      true: {
        type: 'warning',
        text: '⚠️ Producto sin stock inicial'
      },
      false: {
        type: 'success',
        text: '✅ Stock inicial registrado'
      }
    },
    onChange: (value) => {
      // Actualizar sugerencias de stock mínimo/máximo
      updateSuggestion('stock_minimo', Math.ceil(value * 0.1));
      updateSuggestion('stock_maximo', value * 2);
      // Recalcular valor total
      recalculate('valor_total');
    }
  },
  {
    id: 'stock_minimo',
    name: 'stock_minimo',
    label: 'Stock Mínimo',
    type: 'number',
    required: false,
    placeholder: '0',
    defaultValue: 0,
    min: 0,
    step: 1,
    validation: {
      crossValidate: {
        enabled: true,
        field: 'stock_maximo',
        rule: (min, max) => !max || min <= max,
        message: 'El stock mínimo no puede ser mayor al máximo'
      }
    },
    hint: 'Te alertaremos cuando el stock baje de esta cantidad',
    suggestion: {
      enabled: true,
      formula: (formData) => {
        return formData.stock_actual > 0 
          ? Math.ceil(formData.stock_actual * 0.1) 
          : 0;
      },
      text: 'Sugerencia: 10% del stock inicial',
      showButton: true
    }
  },
  {
    id: 'stock_maximo',
    name: 'stock_maximo',
    label: 'Stock Máximo',
    type: 'number',
    required: false,
    placeholder: 'Vacío',
    defaultValue: null,
    min: 0,
    step: 1,
    validation: {
      crossValidate: {
        enabled: true,
        field: 'stock_minimo',
        rule: (max, min) => !max || max >= min,
        message: 'El stock máximo debe ser mayor o igual al mínimo'
      }
    },
    hint: 'Cantidad máxima recomendada. Útil para sugerencias de compra',
    suggestion: {
      enabled: true,
      formula: (formData) => {
        return formData.stock_actual > 0 
          ? formData.stock_actual * 2 
          : null;
      },
      text: 'Sugerencia: 2x del stock inicial',
      showButton: true
    }
  }
];
```

#### **Sección B: Costos y Precios**

```javascript
const STEP2_SECTION_COSTOS = [
  {
    id: 'costo_promedio',
    name: 'costo_promedio',
    label: 'Costo por Unidad',
    type: 'currency',
    required: 'conditional', // Requerido si stock_actual > 0
    placeholder: '0.00',
    defaultValue: 0.00,
    min: 0,
    max: 999999.99,
    step: 0.01,
    format: {
      type: 'currency',
      symbol: '$',
      decimals: 2
    },
    validation: {
      required: {
        enabled: true,
        condition: (formData) => formData.stock_actual > 0,
        message: 'El costo es requerido cuando hay stock inicial'
      },
      min: {
        enabled: true,
        value: 0,
        message: 'El costo no puede ser negativa'
      },
      warning: {
        enabled: true,
        condition: (formData) => formData.stock_actual > 0 && formData.costo_promedio === 0,
        message: 'Tienes stock pero sin costo. ¿Es un producto gratuito o necesitas agregar el costo?',
        type: 'warning',
        blocking: false
      }
    },
    hint: 'Costo de compra por unidad. Si el stock inicial es 0, puedes dejarlo en $0.00',
    onChange: (value) => {
      // Recalcular valor total
      recalculate('valor_total');
      // Recalcular margen si existe precio_venta
      if (formData.precio_venta) {
        recalculate('margen');
      }
    }
  },
  {
    id: 'valor_total',
    name: 'valor_total',
    label: 'Valor Total del Inventario',
    type: 'calculated',
    readonly: true,
    formula: (formData) => {
      return formData.stock_actual * formData.costo_promedio;
    },
    format: {
      type: 'currency',
      symbol: '$',
      decimals: 2,
      thousands: true
    },
    display: {
      condition: (formData) => formData.stock_actual > 0 && formData.costo_promedio > 0,
      emptyText: 'Sin valor inicial',
      emptyStyle: 'text-gray-500'
    },
    style: {
      fontSize: '1.25rem',
      fontWeight: 'bold',
      color: 'var(--primary-blue)'
    }
  },
  {
    id: 'precio_venta',
    name: 'precio_venta',
    label: 'Precio de Venta',
    type: 'currency',
    required: false,
    placeholder: '0.00',
    defaultValue: null,
    min: 0,
    step: 0.01,
    format: {
      type: 'currency',
      symbol: '$',
      decimals: 2
    },
    conditional: {
      show: (formData) => formData.tipo === 'equipo_venta',
      hide: true
    },
    validation: {
      warning: {
        enabled: true,
        condition: (formData) => {
          return formData.precio_venta && 
                 formData.costo_promedio && 
                 formData.precio_venta < formData.costo_promedio;
        },
        message: 'Estás vendiendo por debajo del costo. ¿Es correcto?',
        type: 'warning',
        blocking: false
      }
    },
    hint: 'Precio al que venderás este producto. Solo para productos vendibles',
    badge: {
      show: true,
      condition: (formData) => {
        return formData.precio_venta && 
               formData.costo_promedio && 
               formData.precio_venta > formData.costo_promedio;
      },
      formula: (formData) => {
        const margen = ((formData.precio_venta - formData.costo_promedio) / formData.costo_promedio * 100).toFixed(0);
        const ganancia = (formData.precio_venta - formData.costo_promedio).toFixed(2);
        return {
          text: `Margen: ${margen}% ($${ganancia} por unidad)`,
          type: margen > 20 ? 'success' : 'warning'
        };
      }
    },
    onChange: (value) => {
      // Recalcular margen
      recalculate('margen');
    }
  }
];
```

#### **Sección C: Información Adicional (Colapsable)**

```javascript
const STEP2_SECTION_ADICIONAL = {
  title: 'Información Adicional',
  collapsible: true,
  defaultCollapsed: false,
  fields: [
    {
      id: 'proveedor_id',
      name: 'proveedor_id',
      label: 'Proveedor',
      type: 'select-search',
      required: false,
      placeholder: 'Buscar o seleccionar proveedor...',
      defaultValue: null,
      options: {
        source: 'proveedores',
        value: 'id',
        label: 'nombre',
        searchable: true
      },
      validation: {},
      hint: 'Proveedor habitual de este producto',
      action: {
        type: 'add-new',
        label: 'Agregar nuevo proveedor',
        modal: 'AddProveedorModal',
        icon: 'plus'
      }
    },
    {
      id: 'ubicacion',
      name: 'ubicacion',
      label: 'Ubicación Física',
      type: 'text-autocomplete',
      required: false,
      placeholder: 'Ej: Estante A, Caja 3, Almacén Principal',
      defaultValue: '',
      validation: {
        maxLength: {
          enabled: true,
          value: 255,
          message: 'La ubicación no puede exceder 255 caracteres'
        }
      },
      hint: 'Dónde está físicamente almacenado',
      autocomplete: {
        enabled: true,
        source: 'last_5_locations',
        minChars: 1
      }
    },
    {
      id: 'categoria',
      name: 'categoria',
      label: 'Categoría',
      type: 'text-autocomplete',
      required: false,
      placeholder: 'Ej: Impresoras, Computadoras, General',
      defaultValue: '',
      validation: {
        maxLength: {
          enabled: true,
          value: 100,
          message: 'La categoría no puede exceder 100 caracteres'
        }
      },
      hint: 'Para agrupar productos similares',
      autocomplete: {
        enabled: true,
        source: 'existing_categories',
        minChars: 1
      }
    },
    {
      id: 'unidad_medida',
      name: 'unidad_medida',
      label: 'Unidad de Medida',
      type: 'select',
      required: false,
      defaultValue: 'pieza',
      options: [
        { value: 'pieza', label: 'Pieza' },
        { value: 'metro', label: 'Metro' },
        { value: 'litro', label: 'Litro' },
        { value: 'kg', label: 'Kilogramo' }
      ],
      validation: {},
      hint: 'Unidad en que se mide este producto',
      suggestion: {
        enabled: true,
        basedOn: 'tipo',
        rules: {
          'tinta': 'pieza',
          'papel': 'metro',
          'consumible': 'pieza',
          'refaccion': 'pieza'
        }
      }
    }
  ]
};
```

---

## 🔧 FUNCIONES DE VALIDACIÓN

```javascript
// Validaciones en tiempo real
const VALIDATION_RULES = {
  // Validación cruzada: Stock mínimo vs máximo
  stock_minimo_vs_maximo: (formData) => {
    if (formData.stock_maximo && formData.stock_minimo > formData.stock_maximo) {
      return {
        field: 'stock_minimo',
        type: 'error',
        message: 'El stock mínimo no puede ser mayor al máximo'
      };
    }
    return null;
  },

  // Validación: Stock inicial vs máximo
  stock_actual_vs_maximo: (formData) => {
    if (formData.stock_maximo && formData.stock_actual > formData.stock_maximo) {
      return {
        field: 'stock_actual',
        type: 'warning',
        message: 'El stock inicial supera el máximo recomendado. ¿Es correcto?',
        blocking: false
      };
    }
    return null;
  },

  // Validación: Precio de venta vs costo
  precio_vs_costo: (formData) => {
    if (formData.precio_venta && formData.costo_promedio && 
        formData.precio_venta < formData.costo_promedio) {
      return {
        field: 'precio_venta',
        type: 'warning',
        message: 'Estás vendiendo por debajo del costo. ¿Es correcto?',
        blocking: false
      };
    }
    return null;
  },

  // Validación: Stock = 0 pero costo > 0
  stock_cero_con_costo: (formData) => {
    if (formData.stock_actual === 0 && formData.costo_promedio > 0) {
      return {
        field: 'costo_promedio',
        type: 'warning',
        message: 'Tienes costo pero sin stock. ¿Quieres registrar el producto para futuras compras?',
        blocking: false
      };
    }
    return null;
  },

  // Validación: Costo = 0 pero stock > 0
  costo_cero_con_stock: (formData) => {
    if (formData.stock_actual > 0 && formData.costo_promedio === 0) {
      return {
        field: 'costo_promedio',
        type: 'warning',
        message: 'Tienes stock pero sin costo. ¿Es un producto gratuito o necesitas agregar el costo?',
        blocking: false,
        requireConfirmation: true
      };
    }
    return null;
  },

  // Validación: SKU único (async)
  sku_unico: async (formData) => {
    if (!formData.codigo_sku) return null;
    
    const { data, error } = await supabase
      .from('inventario_productos')
      .select('id, nombre')
      .eq('codigo_sku', formData.codigo_sku.toUpperCase())
      .neq('id', formData.id || 0)
      .single();
    
    if (data) {
      return {
        field: 'codigo_sku',
        type: 'error',
        message: `Este SKU ya existe en el producto "${data.nombre}". Usa otro o edita el producto existente`,
        blocking: true,
        link: `/inventario/${data.id}`
      };
    }
    return null;
  }
};
```

---

## 📊 ESTRUCTURA DE DATOS FINAL

```javascript
const FORM_DATA_STRUCTURE = {
  // Paso 1
  tipo: '', // required
  nombre: '', // required, min 3 chars
  codigo_sku: '', // optional, auto-generate if empty
  descripcion: '', // optional, max 1000 chars

  // Paso 2 - Stock
  stock_actual: 0, // required, min 0
  stock_minimo: 0, // optional, min 0, must be <= stock_maximo
  stock_maximo: null, // optional, min 0, must be >= stock_minimo

  // Paso 2 - Costos
  costo_promedio: 0.00, // required if stock_actual > 0, min 0
  precio_venta: null, // optional, only if tipo === 'equipo_venta', min 0

  // Paso 2 - Adicional
  proveedor_id: null, // optional
  ubicacion: '', // optional, max 255 chars
  categoria: '', // optional, max 100 chars
  unidad_medida: 'pieza', // optional, default 'pieza'

  // Calculados (no se guardan)
  valor_total: 0.00, // calculated: stock_actual * costo_promedio
  margen: null // calculated: ((precio_venta - costo_promedio) / costo_promedio * 100)
};
```

---

## 🎨 COMPONENTES NECESARIOS

1. **CustomSelect** ✅ (ya existe)
2. **CurrencyInput** (nuevo) - Input con formato de moneda
3. **NumberInput** (nuevo) - Input numérico con validaciones
4. **TextAutocomplete** (nuevo) - Input de texto con autocompletado
5. **SelectSearch** (nuevo) - Select con búsqueda
6. **CalculatedField** (nuevo) - Campo calculado de solo lectura
7. **Badge** (nuevo) - Badge contextual
8. **SuggestionButton** (nuevo) - Botón de sugerencia
9. **CollapsibleSection** (nuevo) - Sección colapsable
10. **ValidationMessage** (nuevo) - Mensaje de validación

---

## ✅ IMPLEMENTACIÓN PASO A PASO

### **Fase 1: Estructura Básica**
1. Reorganizar a 2 pasos
2. Implementar secciones en paso 2
3. Agregar sección colapsable

### **Fase 2: Campos Mejorados**
1. CurrencyInput para costos y precios
2. NumberInput para cantidades
3. TextAutocomplete para nombre, ubicación, categoría
4. SelectSearch para proveedor

### **Fase 3: Validaciones**
1. Validaciones en tiempo real
2. Validaciones cruzadas
3. Validaciones asíncronas (SKU único)
4. Mensajes de error/advertencia

### **Fase 4: Inteligencia**
1. Cálculos automáticos
2. Sugerencias inteligentes
3. Auto-generación de SKU
4. Placeholders dinámicos

### **Fase 5: UX Final**
1. Microcopy en todos los campos
2. Badges contextuales
3. Estados visuales
4. Animaciones sutiles

---

**Listo para codear** 🚀

