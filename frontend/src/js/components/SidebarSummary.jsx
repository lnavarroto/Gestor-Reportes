import React from "react";
import ExcelInsightsPanel from "./ExcelInsightsPanel";
import PreviewPanel from "./PreviewPanel";

function SidebarSummary({
  styles,
  archivo,
  tipoArchivoAnalizado,
  formatoSalida,
  materiasDetectadas,
  materiasAdicionales,
  vistaPrevia,
  excelInsights,
  resumenFiltro,
  formatBytes,
  totalEspecialistas,
  mostrarTodosEspecialistas,
  onToggleEspecialistas,
  especialistasPreview,
  especialistasSeleccionados,
  onToggleEspecialista,
  onSeleccionarTodosEspecialistas,
  onDeseleccionarTodosEspecialistas,
  hayFiltroEspecialistasActual,
}) {
  return (
    <aside className={styles.summaryCard}>
      <div className={styles.summaryTitle}>Vista previa de procesamiento</div>
      <p className={styles.summaryHint}>Resumen rapido de tu configuracion actual antes de generar.</p>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiItem}>
          <span className={styles.kpiLabel}>Archivo</span>
          <strong className={styles.kpiValue}>{archivo ? "Cargado" : "Pendiente"}</strong>
        </div>
        <div className={styles.kpiItem}>
          <span className={styles.kpiLabel}>Formato</span>
          <strong className={styles.kpiValue}>{formatoSalida.toUpperCase()}</strong>
        </div>
        <div className={styles.kpiItem}>
          <span className={styles.kpiLabel}>Materias detectadas</span>
          <strong className={styles.kpiValue}>{materiasDetectadas.length || 0}</strong>
        </div>
        <div className={styles.kpiItem}>
          <span className={styles.kpiLabel}>Materias extra</span>
          <strong className={styles.kpiValue}>{materiasAdicionales.length || 0}</strong>
        </div>
        <div className={styles.kpiItem}>
          <span className={styles.kpiLabel}>Total registros</span>
          <strong className={styles.kpiValue}>{vistaPrevia.totalRegistros || 0}</strong>
        </div>
      </div>

      <PreviewPanel
        styles={styles}
        vistaPrevia={vistaPrevia}
        totalEspecialistas={totalEspecialistas}
        mostrarTodosEspecialistas={mostrarTodosEspecialistas}
        onToggleEspecialistas={onToggleEspecialistas}
        especialistasPreview={especialistasPreview}
        especialistasSeleccionados={especialistasSeleccionados}
        onToggleEspecialista={onToggleEspecialista}
        onSeleccionarTodosEspecialistas={onSeleccionarTodosEspecialistas}
        onDeseleccionarTodosEspecialistas={onDeseleccionarTodosEspecialistas}
      />

      {tipoArchivoAnalizado && tipoArchivoAnalizado !== ".pdf" && (
        <ExcelInsightsPanel styles={styles} excelInsights={excelInsights} />
      )}

      <div className={styles.summaryBlock}>
        <span className={styles.summaryBlockLabel}>Filtro aplicado</span>
        <span className={styles.summaryBlockText}>{resumenFiltro}</span>
      </div>

      {hayFiltroEspecialistasActual && (
        <div
          style={{
            backgroundColor: "rgba(249, 115, 22, 0.1)",
            border: "1px solid rgba(249, 115, 22, 0.3)",
            borderRadius: "6px",
            padding: "10px 12px",
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          <span style={{ fontSize: "16px", marginTop: "2px" }}>⚠️</span>
          <div>
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", fontWeight: "600", color: "#ea580c" }}>
              Filtro activo
            </p>
            <p style={{ margin: "0", fontSize: "11px", color: "#d97706" }}>
              {especialistasSeleccionados.length} de {totalEspecialistas} especialistas seleccionados
            </p>
          </div>
        </div>
      )}

      <div className={styles.summaryBlock}>
        <span className={styles.summaryBlockLabel}>Nombre de archivo</span>
        <span className={styles.summaryBlockTextMuted}>{archivo ? archivo.name : "Sin archivo cargado"}</span>
      </div>

      <div className={styles.summaryBlock}>
        <span className={styles.summaryBlockLabel}>Peso</span>
        <span className={styles.summaryBlockTextMuted}>{archivo ? formatBytes(archivo.size) : "-"}</span>
      </div>

      <div className={styles.summaryFooter}>
        Consejo: valida las materias adicionales antes de generar para evitar reprocesos.
      </div>
    </aside>
  );
}

export default SidebarSummary;
