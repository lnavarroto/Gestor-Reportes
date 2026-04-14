# DocuMind | Gestor de Reportes Inteligentes

Solución integral para análisis, normalización y generación de reportes desde archivos PDF y Excel. Diseñada para profesionales legales, procesamiento de datos judiciales y extracción de información estructurada.

## Características

✨ **Análisis Inteligente**
- Detección automática de materias indígenas (CIVIL, LABORAL, FAMILIA CIVIL, etc.)
- Identificación de especialistas desde múltiples formatos de datos
- Normalización de fechas y registros con múltiples patrones soportados
- Etiquetado de estados (REMITIDO, CONFIRMADO, INADMISIBLE, etc.)

📊 **Generación de Reportes**
- Matrices dinámicas desde datos normalizados
- Exportación a Excel con tablas editables y filtros
- Generación de PDF con formato profesional para impresión
- Resúmenes ejecutivos por especialista y materia

🎨 **Interfaz Moderna**
- Aplicación React con CSS Modules para estilización segura
- Tema claro/oscuro adaptable
- Flujo guiado de 4 pasos para máxima claridad
- Indicadores visuales de estado en tiempo real
- Validación en vivo mientras escribes

🔒 **Seguridad**
- CORS habilitado con control de origen
- Rate limiting en endpoints sensibles
- Helmet.js para protección de headers HTTP
- Validación de tipos de archivo en servidor
- Límite de tamaño de archivo: 25 MB

---

## Requisitos del Sistema

| Requisito | Versión Mínima | Recomendado |
|-----------|-----------------|------------|
| **Node.js** | 18.x | 20.x LTS |
| **npm** | 9.x | 10.x |
| **RAM disponible** | 512 MB | 2 GB |
| **Espacio en disco** | 500 MB | 2 GB |

**Navegadores Soportados:**
- Chrome/Chromium 91+
- Firefox 89+
- Safari 14+
- Edge 91+

---

## Instalación Local

### 1. Clonar el Repositorio

```bash
git clone https://github.com/tuusuario/documind.git
cd documind
```

### 2. Instalar Dependencias

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd ../frontend
npm install
```

### 3. Configurar Variables de Entorno

**Backend (`backend/.env`):**
```env
# Puerto del servidor
PORT=4000

# Entorno
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:3000

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Parseadores
PDF_MAX_PAGES=500
EXCEL_MAX_ROWS=50000

# API de generación (opcional)
PDF_GENERATION_TIMEOUT=30000
```

**Frontend (`.env` en root):**
```env
REACT_APP_API_URL=http://localhost:4000
```

> **Nota:** Ambos archivos de ejemplo existen en el repositorio como `.env.example` para referencia.

---

## Desarrollo Local

### Iniciar Backend en Modo Watch

```bash
cd backend
npm start
```

Respuesta esperada:
```
✓ Health check: http://localhost:4000/health
✓ API base: http://localhost:4000/api
```

### Iniciar Frontend en Modo Desarrollo

En otra terminal:
```bash
cd frontend
npm start
```

Abre Tu navegador en: **http://localhost:3000**

### Ejecutar Tests

**Backend:**
```bash
cd backend
npm test
```

**Frontend:**
```bash
cd frontend
npm test
```

---

## Construcción para Producción

### Build Backend

```bash
cd backend
npm run build
# Output: Backend listo en ./dist o similar
```

### Build Frontend

```bash
cd frontend
npm run build
# Output: Build creado en ./build/
```

---

## Despliegue en Render

### 1. Propósito de la Cuenta Render

1. Ir a [render.com](https://render.com)
2. Crear cuenta o iniciar sesión
3. Conectar repositorio de GitHub

### 2. Desplegar Backend

1. **New > Web Service**
2. Seleccionar repositorio `documind`
3. Configurar:
   - **Name:** `documind-backend`
   - **Environment:** `Node`
   - **Build Command:** `cd backend && npm install && npm run build`
   - **Start Command:** `cd backend && npm start`
   - **Plan:** Free o Paid según necesidad

4. Configurar variables de entorno en Render:
   ```
   NODE_ENV = production
   CORS_ORIGIN = https://tudominio.com
   RATE_LIMIT_WINDOW_MS = 900000
   RATE_LIMIT_MAX_REQUESTS = 100
   ```

5. **Deploy** y esperar confirmación ✓

### 3. Desplegar Frontend

1. **New > Static Site**
2. Seleccionar repositorio `documind`
3. Configurar:
   - **Name:** `documind-frontend`
   - **Build Command:** `cd frontend && npm install && npm run build`
   - **Publish Directory:** `frontend/build`

4. Configurar variable de entorno:
   ```
   REACT_APP_API_URL = https://documind-backend.onrender.com
   ```

5. **Deploy**

### 4. Verificar Despliegue

```bash
# Comprobación de salud backend
curl https://documind-backend.onrender.com/health

# Respuesta esperada:
# {"ok": true, "service": "documind-backend"}
```

---

## Configuración de Cloudflare (DNS + CDN)

### 1. Apuntar Registro DNS

En Cloudflare:
- Tipo: `CNAME`
- Nombre: `api` (para backend)
- Valor: `documind-backend.onrender.com`
- Proxy: `Proxied` ⚫

### 2. Configuración SSL/TLS

1. Ir a **SSL/TLS > Overview**
2. Seleccionar: **Full (strict)**
3. Certificado automático de Cloudflare ✓

### 3. Reglas de Cache

En **Caching > Cache Rules:**
```
If Path starts with /api
  Cache Level: Cache Everything
  Browser TTL: 1 hour
```

### 4. Rate Limiting en Cloudflare (Opcional)

**Security > WAF > Rate limiting rules:**
- Threshold: 100 requests/min
- Action: Challenge

---

## Estructura del Proyecto

```
documind/
├── backend/
│   ├── src/
│   │   ├── index.js                 (Servidor principal)
│   │   ├── tabularReport.js         (Generación de reportes tabulares)
│   │   ├── unifiedMatrix.js         (Lógica de matrices y normalización) ⭐ FIXED
│   │   ├── excel/
│   │   │   ├── excelParserService.js
│   │   │   ├── excelNormalizationService.js
│   │   │   ├── excelPatternDetector.js
│   │   │   ├── excelUploadController.js
│   │   │   └── ... más módulos
│   │   └── matrix/
│   │       └── matrixReportService.js
│   ├── tests/
│   │   └── *.test.js
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── js/
│   │   │   ├── App.js                (Componente raíz - estado global)
│   │   │   ├── components/
│   │   │   │   ├── Header.jsx        (Indicador de conexión)
│   │   │   │   ├── UploadSection.jsx (Drag & drop)
│   │   │   │   ├── SidebarSummary.jsx (Advertencias de filtro)
│   │   │   │   ├── MatrixReportPanel.jsx (Auto-build)
│   │   │   │   └── ... componentes adicionales
│   │   │   └── styles/
│   │   │       └── App.module.css
│   │   └── index.js
│   ├── public/
│   ├── package.json
│   └── .env
│
├── README.md (este archivo)
└── .gitignore
```

---

## API Endpoints Principales

### Health Check
```http
GET /health
```
**Respuesta:** `{ "ok": true, "service": "documind-backend" }`

### Subir y Analizar Archivo
```http
POST /api/upload
Content-Type: multipart/form-data

Parámetro: file (PDF o Excel)
```

**Respuesta:**
```json
{
  "success": true,
  "tipo": ".xlsx",
  "materias": ["CIVIL", "LABORAL"],
  "especialistas": ["Juan", "María"],
  "registros": 45,
  "vistaPrevia": { ... }
}
```

### Generar Reporte
```http
POST /api/generate-report
Content-Type: application/json

{
  "tipo": "excel|pdf",
  "materialCompiladoNormalizado": [...],
  "materias": ["CIVIL"],
  "especialistas": ["Juan"],
  "filtros": { "fechaInicio": "2024-01-01" }
}
```

**Respuesta:** Archivo descargable (Excel o PDF)

---

## Troubleshooting

### 1. **CORS Error**
**Error:** `Access to XMLHttpRequest has been blocked by CORS policy`

**Solución:**
```javascript
// En backend/src/index.js, verifica:
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
```

### 2. **Backend No Responde**
**Error:** `Cannot GET /health`

**Solución:**
```bash
# Verifica que backend está corriendo
curl http://localhost:4000/health

# Si falla, reinicia:
cd backend
npm install
npm start
```

### 3. **Excel No se Analiza Correctamente**
**Síntoma:** Meses (ENERO, FEBRERO) aparecen como materias

**Solución:** Ya está **FIXED** en `unifiedMatrix.js` línea 333:
```javascript
if (MONTHS_ORDER[t]) return "SIN MATERIA";
```

### 4. **Rate Limiting Bloqueando Solicitudes**
**Error:** `429 Too Many Requests`

**Solución:**
```env
# En backend/.env aumenta los límites:
RATE_LIMIT_MAX_REQUESTS=200
RATE_LIMIT_WINDOW_MS=1800000  # 30 minutos
```

### 5. **Build Fallando en Render**
**Error:** `npm ERR! code ERESOLVE`

**Solución:**
```bash
# En Build Command de Render, usa:
cd backend && npm install --legacy-peer-deps && npm run build
```

---

## Features por Versión

### v1.0.0 (Actual)
- ✅ Carga de PDF y Excel
- ✅ Análisis automático de materias
- ✅ Generación de reportes Excel/PDF
- ✅ Indicador de conexión backend en tiempo real
- ✅ Filtro visual de especialistas con advertencia
- ✅ Drag & drop para carga de archivos
- ✅ Auto-construcción de matrices al abrir modal
- ✅ Tema claro/oscuro

### v1.1.0 (Próximo)
- 🔄 Exportación a CSV
- 🔄 Integración con Google Sheets
- 🔄 Notificaciones por email
- 🔄 Historial de reportes generados

---

## Licencia

Este proyecto está bajo licencia **MIT**. Ver archivo `LICENSE` para más detalles.

---

## Soporte y Contacto

- **Reportar bugs:** Repositorio GitHub Issues
- **Sugerencias:** Discussions tab
- **Email:** soporte@documind.app

---

## Changelog

### [1.0.0] - 2024
- **FIXED:** Normalización de materias - meses ya no se confunden con materias indígenas
- **ADDED:** Indicador de conexión backend en header con verificación cada 30 segundos
- **ADDED:** Filtro visual de especialistas con advertencia naranja en sidebar
- **ADDED:** Drag & drop nativo para carga de archivos
- **ADDED:** Auto-construcción de matrices al abrir modal de visualización
- **IMPROVED:** Resumen de filtro muestra cantidad exacta de especialistas seleccionados

---

**¡Gracias por usar DocuMind!** 🎉

> Desarrollado con ❤️ para profesionales legales y procesadores de datos judiciales.
