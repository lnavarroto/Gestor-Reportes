# 📁 Estructura Modular de CSS

## Descripción
Este directorio contiene los estilos CSS organizados módularmente por funcionalidad. Cada archivo independiente maneja una sección específica de la interfaz, facilitando el mantenimiento y escalabilidad.

## Archivos Disponibles

### 🎨 Configuración Base
- **`variables.css`** - Variables CSS, colores y tokens del sistema
- **`base.css`** - Estilos globales, decoraciones de fondo, animaciones base

### 🏛️ Componentes Principales
- **`header.css`** - Header, título, logo y toggle de tema
- **`steps.css`** - Tarjetas de pasos y indicadores de progreso
- **`layout.css`** - Grid principal, cards y espaciado general
- **`upload.css`** - Zona de carga, archivos, drag & drop
- **`format.css`** - Tarjetas de selección de formato (Excel/PDF)
- **`buttons.css`** - Botones submit, spinner, estados

### ⚙️ Configuración y Filtros
- **`settings.css`** - Paneles de configuración, filtros, detección
- **`selection.css`** - Selectores de especialistas, checkboxes
- **`preview.css`** - Panel de vista previa y listas

### 📊 Datos y Resumen
- **`summary.css`** - KPI, resumen lateral, bloques de información
- **`excel.css`** - Insights de Excel, tablas, widgets

### 🗂️ Modales y Vistas
- **`modal.css`** - Estilos de modales genéricos
- **`matrix.css`** - Matriz dinámica, controles, tablas

### 🌙 Temas y Responsive
- **`theme-dark.css`** - Tema oscuro, paleta alternativa
- **`responsive.css`** - Media queries, diseño responsivo

### 📝 Utilidad
- **`footer.css`** - Pie de página, sección de autor

## 📖 Cómo Usar

### Para Editar un Componente Específico
1. Abre el archivo correspondiente a tu componente
2. Busca la sección marcada con `/* ============ ... ============ */`
3. Edita los estilos necesarios
4. Los cambios se reflejan inmediatamente en el navegador

### Ejemplo: Cambiar Color de Upload Zone
```bash
# 1. Abre upload.css
# 2. Busca .uploadZone
# 3. Modifica border-color o background
```

### Ejemplo: Ajustar Tema Oscuro
```bash
# 1. Abre theme-dark.css
# 2. Busca .appDark y el componente
# 3. Personaliza colores
```

## 🎯 Convenciones

### Nomenclatura
- PascalCase para clases: `.elementName`
- Separación clara por secciones con comentarios
- Variables reutilizables: `var(--teal-500)`

### Estructura Típica de un Archivo
```css
/* ============================================================================
   DESCRIPCIÓN DEL MÓDULO
   ============================================================================ */

.primaryClass {
  /* Estilos principales */
}

.secondaryClass {
  /* Estilos secundarios */
}
```

### Responsive
- Mobile first cuando sea posible
- Media queries en `responsive.css` para cambios complejos
- Puntos de quiebre: 1024px (tablet), 760px (mobile)

## 🔗 Integración

Todos los archivos se **importan automáticamente** en `App.module.css` mediante `@import`. No requiere cambios en App.js.

## 📈 Ventajas de Esta Estructura

✅ **Mantenibilidad** - Cada archivo es pequeño y enfocado  
✅ **Escalabilidad** - Fácil agregar nuevos módulos  
✅ **Reutilización** - Variables compartidas en `variables.css`  
✅ **Colaboración** - Múltiples developers sin conflictos  
✅ **Performance** - Estilos organizados lógicamente  
✅ **Testing** - Cambios aislados facilitan pruebas  

## 🚀 Próximos Pasos

Para agregar un nuevo módulo de estilos:
1. Crea archivo `frontend/src/styles/nuevo-modulo.css`
2. Define tus clases con la misma estructura
3. Importa en `App.module.css`: `@import "./nuevo-modulo.css";`

---

**Última actualización:** Abril 2026  
**Estructura:** 14 archivos modularesónemos
