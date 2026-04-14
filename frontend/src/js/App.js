import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "../styles/App.module.css";
import Header from "./components/Header";
import UploadSection from "./components/UploadSection";
import SidebarSummary from "./components/SidebarSummary";
import UiIcon from "./components/UiIcon";
import MatrixReportPanel from "./components/MatrixReportPanel";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:4000";
const DEFAULT_MATERIAS_STORAGE_KEY = "gestor-reportes.default-materias";
const THEME_STORAGE_KEY = "gestor-reportes.theme";
const DEFAULT_MATERIAS_BASE = ["CIVIL", "LABORAL"];
const SUPPORTED_INPUT_EXTENSIONS = [".xlsx", ".xls", ".xlsm", ".xltx", ".xltm", ".csv", ".pdf"];
const SUPPORTED_INPUT_ACCEPT = SUPPORTED_INPUT_EXTENSIONS.join(",");
const SUPPORTED_INPUT_LABEL = ".xlsx, .xls, .xlsm, .xltx, .xltm, .csv, .pdf";
const MATRIX_TYPES = [
  { key: "especialista-anio-mes-juzgado", label: "Especialista vs Ano > Mes > Juzgado" },
  { key: "especialista-anio-mes-estado", label: "Especialista vs Ano > Mes > Estado" },
  { key: "especialista-anio-mes", label: "Especialista vs Ano > Mes" },
];

const MATERIAS_DISPONIBLES = [
  "CIVIL",
  "LABORAL",
  "FAMILIA CIVIL",
  "FAMILIA PENAL",
  "FAMILIA TUTELAR",
  "FAMILIA",
  "PENAL",
  "CONSTITUCIONAL",
];

function normalizeMateriaLabel(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function mergeMaterias(values) {
  return [...new Set((values || []).map(normalizeMateriaLabel).filter(Boolean))];
}

function loadDefaultMaterias() {
  try {
    const saved = window.localStorage.getItem(DEFAULT_MATERIAS_STORAGE_KEY);
    if (!saved) return DEFAULT_MATERIAS_BASE;
    const parsed = JSON.parse(saved);
    const normalized = mergeMaterias(parsed);
    return normalized.length ? normalized : DEFAULT_MATERIAS_BASE;
  } catch (_error) {
    return DEFAULT_MATERIAS_BASE;
  }
}

function getExtraMaterias(detected, defaults) {
  const configured = new Set(mergeMaterias(defaults));
  return mergeMaterias(detected).filter((materia) => !configured.has(materia));
}

function getFileExtension(fileName) {
  return (String(fileName || "").match(/\.[^/.]+$/) || [""])[0].toLowerCase();
}

function isSupportedInputFile(fileName) {
  return SUPPORTED_INPUT_EXTENSIONS.includes(getFileExtension(fileName));
}

function buildLegacyExcelInsights(excelInsights) {
  const legacy = excelInsights?.legacyWorksheetInsights;
  if (!legacy) return null;

  return {
    detectedFields: legacy.detectedFields || [],
    availableWidgets: legacy.availableWidgets || [],
  };
}

function App() {
  const [temaOscuro, setTemaOscuro] = useState(() => {
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark";
    } catch (_error) {
      return false;
    }
  });
  const [archivo, setArchivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [mensajeDetalles, setMensajeDetalles] = useState([]);
  const [formatoSalida, setFormatoSalida] = useState("excel");
  const [materiasPredeterminadas, setMateriasPredeterminadas] = useState(loadDefaultMaterias);
  const [configuracionAbierta, setConfiguracionAbierta] = useState(false);
  const [analizandoMaterias, setAnalizandoMaterias] = useState(false);
  const [materiasDetectadas, setMateriasDetectadas] = useState([]);
  const [materiasAdicionales, setMateriasAdicionales] = useState([]);
  const [modoFiltroMaterias, setModoFiltroMaterias] = useState("all");
  const [materiasPersonalizadas, setMateriasPersonalizadas] = useState([]);
  const [prevalidacion, setPrevalidacion] = useState(null);
  const [vistaPrevia, setVistaPrevia] = useState({ totalRegistros: 0, porMateria: [], porEspecialista: [] });
  const [tipoArchivoAnalizado, setTipoArchivoAnalizado] = useState("");
  const [excelInsights, setExcelInsights] = useState(null);
  const [mostrarTodosEspecialistas, setMostrarTodosEspecialistas] = useState(false);
  const [archivoFeedback, setArchivoFeedback] = useState(false);
  const [configFeedback, setConfigFeedback] = useState(false);
  const [reporteFeedback, setReporteFeedback] = useState(false);
  const [matrixType, setMatrixType] = useState(MATRIX_TYPES[0].key);
  const [matrixFilters, setMatrixFilters] = useState({ fechaInicio: "", fechaFin: "", juzgado: "", estado: "" });
  const [matrixData, setMatrixData] = useState(null);
  const [matrixFilterOptions, setMatrixFilterOptions] = useState({ juzgados: [], estados: [] });
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixExporting, setMatrixExporting] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [especialistasSeleccionados, setEspecialistasSeleccionados] = useState([]);
  const [backendOnline, setBackendOnline] = useState(true);
  const [checkingBackend, setCheckingBackend] = useState(true);

  // Verificar conexión con backend al montar
  useEffect(() => {
    const verificarConexion = async () => {
      try {
        await axios.get(`${API_URL}/health`, { timeout: 3000 });
        setBackendOnline(true);
      } catch (_error) {
        setBackendOnline(false);
      } finally {
        setCheckingBackend(false);
      }
    };
    verificarConexion();
    // Chequear cada 30 segundos
    const interval = setInterval(verificarConexion, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      DEFAULT_MATERIAS_STORAGE_KEY,
      JSON.stringify(mergeMaterias(materiasPredeterminadas))
    );
  }, [materiasPredeterminadas]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, temaOscuro ? "dark" : "light");
  }, [temaOscuro]);

  useEffect(() => {
    const extras = getExtraMaterias(materiasDetectadas, materiasPredeterminadas);
    setMateriasAdicionales(extras);

    if (!materiasDetectadas.length) {
      setMateriasPersonalizadas([]);
      setModoFiltroMaterias("all");
      return;
    }

    if (!extras.length) {
      setModoFiltroMaterias("all");
    }

    setMateriasPersonalizadas((prev) => {
      const filtered = prev.filter((materia) => materiasDetectadas.includes(materia));
      return filtered.length ? filtered : materiasDetectadas;
    });
  }, [materiasDetectadas, materiasPredeterminadas]);

  useEffect(() => {
    if (!archivoFeedback) return;
    const timer = window.setTimeout(() => setArchivoFeedback(false), 820);
    return () => window.clearTimeout(timer);
  }, [archivoFeedback]);

  useEffect(() => {
    if (!configFeedback) return;
    const timer = window.setTimeout(() => setConfigFeedback(false), 980);
    return () => window.clearTimeout(timer);
  }, [configFeedback]);

  useEffect(() => {
    if (!reporteFeedback) return;
    const timer = window.setTimeout(() => setReporteFeedback(false), 980);
    return () => window.clearTimeout(timer);
  }, [reporteFeedback]);

  const resetAnalisisMaterias = () => {
    setMateriasDetectadas([]);
    setMateriasAdicionales([]);
    setMateriasPersonalizadas([]);
    setModoFiltroMaterias("all");
    setPrevalidacion(null);
    setVistaPrevia({ totalRegistros: 0, porMateria: [], porEspecialista: [] });
    setTipoArchivoAnalizado("");
    setExcelInsights(null);
    setMostrarTodosEspecialistas(false);
    setMatrixData(null);
    setMatrixFilterOptions({ juzgados: [], estados: [] });
    setMatrixFilters({ fechaInicio: "", fechaFin: "", juzgado: "", estado: "" });
    setShowMatrixModal(false);
    setEspecialistasSeleccionados([]);
  };

  const analizarMateriasDocumento = async (file) => {
    if (!file) {
      resetAnalisisMaterias();
      return;
    }

    try {
      setAnalizandoMaterias(true);
      const formData = new FormData();
      formData.append("archivo", file);
      const extension = getFileExtension(file?.name);
      const analysisEndpoint = extension === ".pdf" ? "/analizar-materias" : "/analizar-excel";

      let response;
      try {
        response = await axios.post(`${API_URL}${analysisEndpoint}`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      } catch (requestError) {
        const shouldFallback =
          extension !== ".pdf" &&
          analysisEndpoint === "/analizar-excel" &&
          requestError?.response?.status === 404;

        if (!shouldFallback) throw requestError;

        response = await axios.post(`${API_URL}/analizar-materias`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      }

      const detected = mergeMaterias(response.data?.materias || []);
      const extras = getExtraMaterias(detected, materiasPredeterminadas);
      const pre = response.data?.prevalidacion || null;
      const preview = response.data?.vistaPrevia || { totalRegistros: 0, porMateria: [], porEspecialista: [] };
      const analyzedExtension = response.data?.extension || extension;
      const nextExcelInsights =
        analyzedExtension === ".pdf"
          ? null
          : {
              ...response.data?.excelInsights,
              legacy: buildLegacyExcelInsights(response.data?.excelInsights),
            };

      setMateriasDetectadas(detected);
      setMateriasAdicionales(extras);
      setMateriasPersonalizadas(detected);
      setModoFiltroMaterias("all");
      setPrevalidacion(pre);
      setVistaPrevia(preview);
      setTipoArchivoAnalizado(analyzedExtension);
      setExcelInsights(nextExcelInsights);
      setMostrarTodosEspecialistas(false);
      setEspecialistasSeleccionados((preview.porEspecialista || []).map((item) => item.especialista));

      if (pre && pre.ok === false) {
        setMensaje(pre.message || "El archivo no cumple estructura minima para procesar.");
      }
    } catch (error) {
      console.error(error);
      resetAnalisisMaterias();
      setMensaje(
        "No se pudieron detectar las materias automaticamente. Puedes continuar con la configuracion actual."
      );
    } finally {
      setAnalizandoMaterias(false);
    }
  };

  const manejarCambioArchivo = async (event) => {
    const file = event.target.files?.[0] || null;
    if (file && !isSupportedInputFile(file.name)) {
      setArchivo(null);
      setMensaje(`DocuMind procesa PDF y Excel compatibles: ${SUPPORTED_INPUT_LABEL}.`);
      setMensajeDetalles([]);
      resetAnalisisMaterias();
      event.target.value = "";
      return;
    }

    setArchivo(file);
    if (file) setArchivoFeedback(true);
    setMensaje("");
    setMensajeDetalles([]);
    await analizarMateriasDocumento(file);
  };

  const inferirExtensionPorMime = (mimeType) => {
    if (!mimeType) return "";
    if (mimeType.includes("application/pdf")) return ".pdf";
    if (mimeType.includes("spreadsheetml.sheet")) return ".xlsx";
    if (mimeType.includes("text/csv")) return ".csv";
    if (mimeType.includes("application/vnd.ms-excel")) return ".xls";
    return "";
  };

  const extraerNombreDescarga = (contentDisposition, nombreOrigen, mimeType) => {
    if (!contentDisposition) {
      const extOrigen = (nombreOrigen?.match(/\.[^/.]+$/) || [""])[0];
      const extPorMime = inferirExtensionPorMime(mimeType);
      return `reporte_procesado${extOrigen || extPorMime || ""}`;
    }

    const coincidencia = contentDisposition.match(/filename="?([^\"]+)"?/i);
    if (coincidencia?.[1]) return coincidencia[1];

    const extOrigen = (nombreOrigen?.match(/\.[^/.]+$/) || [""])[0];
    const extPorMime = inferirExtensionPorMime(mimeType);
    return `reporte_procesado${extOrigen || extPorMime || ""}`;
  };

  const descargarBlob = (blob, nombreArchivo) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = nombreArchivo;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
  };

  const procesarReporte = async (event) => {
    event.preventDefault();

    if (!archivo) {
      setMensaje("Selecciona un archivo Excel o PDF antes de continuar.");
      return;
    }

    const materiasAEnviar = (() => {
      if (!materiasAdicionales.length) return [];
      if (modoFiltroMaterias === "all") return [];
      if (modoFiltroMaterias === "default") return mergeMaterias(materiasPredeterminadas);
      return mergeMaterias(materiasPersonalizadas);
    })();

    if (modoFiltroMaterias === "custom" && !materiasAEnviar.length) {
      setMensaje("Selecciona al menos una materia antes de procesar el reporte.");
      return;
    }

    try {
      setCargando(true);
      setMensaje("Procesando reporte...");
      setMensajeDetalles([]);

      const formData = new FormData();
      formData.append("archivo", archivo);
      formData.append("formato", formatoSalida);
      if (materiasAEnviar.length) {
        formData.append("materias", JSON.stringify(materiasAEnviar));
      }
      const todosEspecialistas = vistaPrevia.porEspecialista.map((item) => item.especialista);
      const hayFiltroEspecialistas =
        todosEspecialistas.length > 0 &&
        especialistasSeleccionados.length !== todosEspecialistas.length;
      if (hayFiltroEspecialistas && !especialistasSeleccionados.length) {
        setMensaje("Selecciona al menos un especialista para procesar el reporte.");
        setCargando(false);
        return;
      }
      formData.append("especialistas", JSON.stringify(especialistasSeleccionados));
      formData.append("aplicarFiltroEspecialistas", hayFiltroEspecialistas ? "1" : "0");

      const response = await axios.post(`${API_URL}/procesar-reporte`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        responseType: "blob",
      });

      const nombreArchivo = extraerNombreDescarga(
        response.headers["content-disposition"],
        archivo?.name,
        response.headers["content-type"]
      );

      const validacionEstado = response.headers["x-reporte-validacion"];
      const validacionResumen = response.headers["x-reporte-validacion-resumen"];
      const validacionDetalle = response.headers["x-reporte-validacion-detalle"];

      descargarBlob(
        new Blob([response.data], {
          type: response.headers["content-type"] || "application/octet-stream",
        }),
        nombreArchivo
      );
      setReporteFeedback(true);
      if (validacionEstado === "WARN") {
        setMensaje(
          `Reporte descargado con observaciones. ${validacionResumen || "Revisa diferencias de totales del PDF."}${
            validacionDetalle ? ` Detalle: ${validacionDetalle}` : ""
          }`
        );
        setMensajeDetalles([]);
      } else if (validacionEstado === "FILTERED") {
        setMensaje(`Reporte filtrado y descargado correctamente. ${validacionResumen || "Se aplico filtro de materias."}`);
        setMensajeDetalles([]);
      } else {
        setMensaje("Reporte procesado y descargado correctamente.");
        setMensajeDetalles([]);
      }
    } catch (error) {
      console.error(error);
      let mensajeError = "No se pudo procesar el archivo. Revisa backend y formato.";
      let detallesError = [];

      if (error.response?.data instanceof Blob) {
        try {
          const texto = await error.response.data.text();
          const json = JSON.parse(texto);
          if (json?.message) mensajeError = json.message;
          if (Array.isArray(json?.diagnostics?.reasons)) {
            detallesError = [...new Set(json.diagnostics.reasons.map((item) => String(item || "").trim()).filter(Boolean))];
          }
        } catch (_e) {
          // Si no viene JSON, se mantiene el mensaje generico.
        }
      }

      setMensaje(mensajeError);
      setMensajeDetalles(detallesError);
    } finally {
      setCargando(false);
    }
  };

  const construirMatriz = async () => {
    if (!archivo || tipoArchivoAnalizado === ".pdf") {
      setMensaje("La matriz dinamica solo aplica para archivos Excel.");
      return;
    }

    try {
      setMatrixLoading(true);
      const formData = new FormData();
      formData.append("archivo", archivo);
      formData.append("matrixType", matrixType);
      if (matrixFilters.fechaInicio) formData.append("fechaInicio", matrixFilters.fechaInicio);
      if (matrixFilters.fechaFin) formData.append("fechaFin", matrixFilters.fechaFin);
      if (matrixFilters.juzgado) formData.append("juzgado", matrixFilters.juzgado);
      if (matrixFilters.estado) formData.append("estado", matrixFilters.estado);

      const response = await axios.post(`${API_URL}/matriz-preview`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMatrixData(response.data?.matrix || null);
      setMatrixFilterOptions(response.data?.filterOptions || { juzgados: [], estados: [] });
      setMensaje(`Matriz lista: ${response.data?.matrixLabel || "resultado generado"}.`);
      setMensajeDetalles([]);
    } catch (error) {
      console.error(error);
      setMatrixData(null);
      let mensajeError = "No se pudo construir la matriz dinamica.";
      if (error.response?.data?.message) mensajeError = error.response.data.message;
      setMensaje(mensajeError);
    } finally {
      setMatrixLoading(false);
    }
  };

  const exportarMatriz = async (formato) => {
    if (!archivo || tipoArchivoAnalizado === ".pdf") {
      setMensaje("La exportacion de matriz solo aplica para Excel.");
      return;
    }

    try {
      setMatrixExporting(true);
      const formData = new FormData();
      formData.append("archivo", archivo);
      formData.append("matrixType", matrixType);
      formData.append("formato", formato);
      if (matrixFilters.fechaInicio) formData.append("fechaInicio", matrixFilters.fechaInicio);
      if (matrixFilters.fechaFin) formData.append("fechaFin", matrixFilters.fechaFin);
      if (matrixFilters.juzgado) formData.append("juzgado", matrixFilters.juzgado);
      if (matrixFilters.estado) formData.append("estado", matrixFilters.estado);

      const response = await axios.post(`${API_URL}/exportar-matriz`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob",
      });

      const nombreArchivo = extraerNombreDescarga(
        response.headers["content-disposition"],
        archivo?.name,
        response.headers["content-type"]
      );

      descargarBlob(
        new Blob([response.data], {
          type: response.headers["content-type"] || "application/octet-stream",
        }),
        nombreArchivo
      );

      setMensaje(`Matriz exportada en ${formato.toUpperCase()} correctamente.`);
      setMensajeDetalles([]);
    } catch (error) {
      console.error(error);
      let mensajeError = "No se pudo exportar la matriz.";
      if (error.response?.data instanceof Blob) {
        try {
          const texto = await error.response.data.text();
          const json = JSON.parse(texto);
          if (json?.message) mensajeError = json.message;
        } catch (_e) {
          // no-op
        }
      }
      setMensaje(mensajeError);
    } finally {
      setMatrixExporting(false);
    }
  };

  const fileIcon = (name) => {
    if (!name) return "DOC";
    const ext = (name.match(/\.[^/.]+$/) || [""])[0].toLowerCase();
    if (ext === ".pdf") return "PDF";
    if ([".xlsx", ".xls", ".xlsm", ".xlsb", ".csv"].includes(ext)) return "XLS";
    return "DOC";
  };

  const formatBytes = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const mensajeTipo = () => {
    if (!mensaje) return null;
    if (mensaje.includes("automaticamente")) return "info";
    if (mensaje.includes("filtrado")) return "info";
    if (mensaje.includes("correctamente")) return "ok";
    if (mensaje.includes("Procesando")) return "info";
    return "error";
  };

  const toggleMateriaPredeterminada = (materia) => {
    setMateriasPredeterminadas((prev) => {
      const normalized = mergeMaterias(prev);
      if (normalized.includes(materia)) {
        if (normalized.length === 1) return normalized;
        return normalized.filter((item) => item !== materia);
      }
      return mergeMaterias([...normalized, materia]);
    });
    setConfigFeedback(true);
    setMensaje("");
    setMensajeDetalles([]);
  };

  const toggleMateriaPersonalizada = (materia) => {
    setMateriasPersonalizadas((prev) =>
      prev.includes(materia) ? prev.filter((item) => item !== materia) : [...prev, materia]
    );
    setMensaje("");
    setMensajeDetalles([]);
  };

  const restaurarMateriasPredeterminadas = () => {
    setMateriasPredeterminadas(DEFAULT_MATERIAS_BASE);
    setConfigFeedback(true);
    setMensaje("");
    setMensajeDetalles([]);
  };

  const seleccionarTodasLasMateriasDetectadas = () => {
    setModoFiltroMaterias("all");
    setMensaje("");
    setMensajeDetalles([]);
  };

  const toggleEspecialista = (nombre) => {
    setEspecialistasSeleccionados((prev) =>
      prev.includes(nombre) ? prev.filter((e) => e !== nombre) : [...prev, nombre]
    );
  };

  const seleccionarTodosEspecialistas = () => {
    setEspecialistasSeleccionados(vistaPrevia.porEspecialista.map((item) => item.especialista));
  };

  const deseleccionarTodosEspecialistas = () => {
    setEspecialistasSeleccionados([]);
  };

  const materiasConfigurables = mergeMaterias([
    ...MATERIAS_DISPONIBLES,
    ...materiasDetectadas,
    ...materiasPredeterminadas,
  ]);
  const hayMateriasAdicionales = materiasAdicionales.length > 0;

  const tipo = mensajeTipo();
  const tipoIcono = { ok: "OK", error: "!", info: "i" };

  const pasos = useMemo(() => {
    const lista = [
      {
        id: "01",
        titulo: "Subir archivo",
        estado: archivo ? "done" : "active",
        progreso: archivo ? 100 : 35,
      },
      {
        id: "02",
        titulo: "Analizar materias",
        estado: !archivo ? "locked" : analizandoMaterias ? "active" : "done",
        progreso: !archivo ? 0 : analizandoMaterias ? 68 : 100,
      },
      {
        id: "03",
        titulo: "Configurar salida",
        estado: !archivo
          ? "locked"
          : hayMateriasAdicionales && modoFiltroMaterias === "custom" && !materiasPersonalizadas.length
          ? "active"
          : "done",
        progreso: !archivo
          ? 0
          : hayMateriasAdicionales && modoFiltroMaterias === "custom" && !materiasPersonalizadas.length
          ? 58
          : 100,
      },
      {
        id: "04",
        titulo: "Generar reporte",
        estado: archivo ? "active" : "locked",
        progreso: !archivo ? 0 : cargando ? 78 : 42,
      },
    ];
    return lista;
  }, [archivo, analizandoMaterias, hayMateriasAdicionales, modoFiltroMaterias, materiasPersonalizadas.length, cargando]);

  const todosEspecialistas = vistaPrevia.porEspecialista.map((item) => item.especialista);
  const hayFiltroEspecialistasActual =
    todosEspecialistas.length > 0 &&
    especialistasSeleccionados.length !== todosEspecialistas.length;

  const resumenFiltro = (() => {
    const partes = [];
    if (!hayMateriasAdicionales || modoFiltroMaterias === "all") {
      partes.push("Todas las materias");
    } else if (modoFiltroMaterias === "default") {
      partes.push(`${mergeMaterias(materiasPredeterminadas).length} materias`);
    } else {
      partes.push(`${materiasPersonalizadas.length} materias`);
    }
    if (hayFiltroEspecialistasActual) {
      partes.push(`${especialistasSeleccionados.length}/${todosEspecialistas.length} especialistas`);
    }
    return partes.join(" • ");
  })();

  const especialistasPreview = mostrarTodosEspecialistas
    ? vistaPrevia.porEspecialista
    : vistaPrevia.porEspecialista.slice(0, 4);
  const totalEspecialistas = vistaPrevia.porEspecialista.length;

  return (
    <div className={`${styles.app} ${temaOscuro ? styles.appDark : ""}`}>
      <div className={styles.bgOrbA} />
      <div className={styles.bgOrbB} />

      <Header
        styles={styles}
        temaOscuro={temaOscuro}
        onToggleTheme={() => setTemaOscuro((prev) => !prev)}
        pasos={pasos}
        backendOnline={backendOnline}
        checkingBackend={checkingBackend}
      />

      <main className={styles.layout}>
        <UploadSection
          styles={styles}
          archivo={archivo}
          archivoFeedback={archivoFeedback}
          cargando={cargando}
          analizandoMaterias={analizandoMaterias}
          formatoSalida={formatoSalida}
          configuracionAbierta={configuracionAbierta}
          configFeedback={configFeedback}
          materiasPredeterminadas={materiasPredeterminadas}
          materiasConfigurables={materiasConfigurables}
          materiasDetectadas={materiasDetectadas}
          materiasAdicionales={materiasAdicionales}
          materiasPersonalizadas={materiasPersonalizadas}
          modoFiltroMaterias={modoFiltroMaterias}
          prevalidacion={prevalidacion}
          hayMateriasAdicionales={hayMateriasAdicionales}
          reporteFeedback={reporteFeedback}
          mensaje={mensaje}
          mensajeDetalles={mensajeDetalles}
          tipo={tipo}
          tipoIcono={tipoIcono}
          onSubmit={procesarReporte}
          onChangeArchivo={manejarCambioArchivo}
          onRemoveArchivo={() => {
            setArchivo(null);
            setMensaje("");
            setMensajeDetalles([]);
            resetAnalisisMaterias();
          }}
          onSetFormatoSalida={setFormatoSalida}
          onToggleConfiguracion={() => setConfiguracionAbierta((prev) => !prev)}
          onRestaurarMaterias={restaurarMateriasPredeterminadas}
          onToggleMateriaPredeterminada={toggleMateriaPredeterminada}
          onSetModoFiltroMaterias={setModoFiltroMaterias}
          onToggleMateriaPersonalizada={toggleMateriaPersonalizada}
          onSeleccionarTodasMaterias={seleccionarTodasLasMateriasDetectadas}
          fileIcon={fileIcon}
          formatBytes={formatBytes}
          mergeMaterias={mergeMaterias}
          inputAccept={SUPPORTED_INPUT_ACCEPT}
          supportedFormatsLabel={SUPPORTED_INPUT_LABEL}
        />

        <SidebarSummary
          styles={styles}
          archivo={archivo}
          tipoArchivoAnalizado={tipoArchivoAnalizado}
          formatoSalida={formatoSalida}
          materiasDetectadas={materiasDetectadas}
          materiasAdicionales={materiasAdicionales}
          vistaPrevia={vistaPrevia}
          excelInsights={excelInsights}
          resumenFiltro={resumenFiltro}
          formatBytes={formatBytes}
          totalEspecialistas={totalEspecialistas}
          mostrarTodosEspecialistas={mostrarTodosEspecialistas}
          onToggleEspecialistas={() => setMostrarTodosEspecialistas((prev) => !prev)}
          especialistasPreview={especialistasPreview}
          especialistasSeleccionados={especialistasSeleccionados}
          onToggleEspecialista={toggleEspecialista}
          onSeleccionarTodosEspecialistas={seleccionarTodosEspecialistas}
          onDeseleccionarTodosEspecialistas={deseleccionarTodosEspecialistas}
          hayFiltroEspecialistasActual={hayFiltroEspecialistasActual}
        />
      </main>

      {!!archivo && tipoArchivoAnalizado && tipoArchivoAnalizado !== ".pdf" && (
        <section className={styles.matrixLauncherSection}>
          <button
            type="button"
            className={styles.matrixOpenBtn}
            onClick={() => setShowMatrixModal(true)}
          >
            Abrir matriz dinamica
          </button>
        </section>
      )}

      {showMatrixModal && (
        <div className={styles.matrixModalOverlay} onClick={() => setShowMatrixModal(false)}>
          <div className={styles.matrixModalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.matrixModalHeader}>
              <h3>Matriz dinamica</h3>
              <button
                type="button"
                className={styles.matrixModalCloseBtn}
                onClick={() => setShowMatrixModal(false)}
              >
                Cerrar
              </button>
            </div>
            <div className={styles.matrixModalBody}>
              <MatrixReportPanel
                styles={styles}
                visible={true}
                loading={matrixLoading}
                exporting={matrixExporting}
                matrixType={matrixType}
                matrixTypes={matrixFilterOptions?.tipos?.length ? matrixFilterOptions.tipos : MATRIX_TYPES}
                matrixData={matrixData}
                filterOptions={matrixFilterOptions}
                filters={matrixFilters}
                onChangeType={setMatrixType}
                onChangeFilter={(key, value) => setMatrixFilters((prev) => ({ ...prev, [key]: value }))}
                onBuild={construirMatriz}
                onExport={exportarMatriz}
              />
            </div>
          </div>
        </div>
      )}

      <section className={styles.authorSection}>
        <div className={styles.authorTitle}>
          <UiIcon name="spark" className={styles.icon} styles={styles} />
          Creacion de Luis NAVARRO TORRES
        </div>
        <div className={styles.authorHint}>
          DocuMind automatiza el procesamiento judicial por mes, juzgado y especialista.
        </div>
      </section>

      <p className={styles.footer}>DocuMind | Gestor de Reportes | {new Date().getFullYear()}</p>
    </div>
  );
}

export default App;
