import React from "react";
import UiIcon from "./UiIcon";

function UploadSection({
  styles,
  archivo,
  archivoFeedback,
  cargando,
  analizandoMaterias,
  formatoSalida,
  configuracionAbierta,
  configFeedback,
  materiasPredeterminadas,
  materiasConfigurables,
  materiasDetectadas,
  materiasAdicionales,
  materiasPersonalizadas,
  modoFiltroMaterias,
  prevalidacion,
  hayMateriasAdicionales,
  reporteFeedback,
  mensaje,
  mensajeDetalles,
  tipo,
  tipoIcono,
  onSubmit,
  onChangeArchivo,
  onRemoveArchivo,
  onSetFormatoSalida,
  onToggleConfiguracion,
  onRestaurarMaterias,
  onToggleMateriaPredeterminada,
  onSetModoFiltroMaterias,
  onToggleMateriaPersonalizada,
  onSeleccionarTodasMaterias,
  fileIcon,
  formatBytes,
  mergeMaterias,
  inputAccept,
  supportedFormatsLabel,
}) {
  return (
    <section className={styles.card}>
      <form onSubmit={onSubmit} noValidate>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>Archivo de entrada</p>
          <span className={styles.sectionMeta}>Paso 1</span>
        </div>

        <label className={`${styles.uploadZone} ${archivo ? styles.uploadZoneActive : ""}`}>
          {archivo ? (
            <>
              <span className={styles.uploadIcon}>
                <UiIcon name="check" className={styles.icon} styles={styles} />
                Archivo listo
              </span>
              <p className={styles.uploadText}>Puedes reemplazar el documento con otro archivo</p>
              <p className={styles.uploadHint}>{supportedFormatsLabel} | maximo 25 MB</p>
            </>
          ) : (
            <>
              <div className={styles.emptyState}>
                <div className={styles.emptyIllustration}>
                  <UiIcon name="upload" className={styles.emptyIcon} styles={styles} />
                </div>
                <span className={styles.uploadIcon}>
                  <UiIcon name="upload" className={styles.icon} styles={styles} />
                  Subir archivo
                </span>
                <p className={styles.uploadText}>Arrastra o haz clic para seleccionar PDF o Excel compatible</p>
                <p className={styles.uploadHint}>El sistema analizara materias, especialista y fechas antes de generar</p>
              </div>
            </>
          )}
          <input
            className={styles.fileInput}
            type="file"
            accept={inputAccept}
            onChange={onChangeArchivo}
            disabled={cargando}
          />
        </label>

        {archivo && (
          <div className={`${styles.fileChip} ${archivoFeedback ? styles.fileChipPulse : ""}`}>
            <span className={styles.fileChipIcon}>{fileIcon(archivo.name)}</span>
            <div className={styles.fileChipInfo}>
              <div className={styles.fileChipName}>{archivo.name}</div>
              <div className={styles.fileChipSize}>{formatBytes(archivo.size)}</div>
            </div>
            <button
              type="button"
              className={styles.fileChipRemove}
              onClick={onRemoveArchivo}
              title="Quitar archivo"
              disabled={cargando}
            >
              <UiIcon name="close" className={styles.icon} styles={styles} />
              Quitar
            </button>
          </div>
        )}

        <div className={styles.divider} />

        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>Formato de salida</p>
          <span className={styles.sectionMeta}>Paso 2</span>
        </div>

        <div className={styles.formatGrid}>
          <label className={`${styles.formatCard} ${formatoSalida === "excel" ? styles.formatCardActiveExcel : ""}`}>
            <input
              type="radio"
              name="formato"
              value="excel"
              checked={formatoSalida === "excel"}
              onChange={() => onSetFormatoSalida("excel")}
              disabled={cargando}
            />
            <span className={styles.formatName}>Excel</span>
            <span className={styles.formatDesc}>Editable, con tablas y filtros</span>
          </label>

          <label className={`${styles.formatCard} ${formatoSalida === "pdf" ? styles.formatCardActivePDF : ""}`}>
            <input
              type="radio"
              name="formato"
              value="pdf"
              checked={formatoSalida === "pdf"}
              onChange={() => onSetFormatoSalida("pdf")}
              disabled={cargando}
            />
            <span className={styles.formatName}>PDF</span>
            <span className={styles.formatDesc}>Listo para impresion y envio</span>
          </label>
        </div>

        <div className={styles.divider} />

        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>Materias y reglas</p>
          <span className={styles.sectionMeta}>Paso 3</span>
          <button
            type="button"
            className={styles.settingsButton}
            onClick={onToggleConfiguracion}
            disabled={cargando || analizandoMaterias}
            title="Configurar materias predeterminadas"
          >
            <UiIcon name="settings" className={styles.icon} styles={styles} />
            Configurar
          </button>
          {configFeedback && <span className={styles.configSavedBadge}>Configuracion guardada</span>}
        </div>

        <div className={styles.defaultSummary}>Predeterminadas: {mergeMaterias(materiasPredeterminadas).join(", ")}</div>

        {configuracionAbierta && (
          <div className={styles.settingsPanel}>
            <div className={styles.filterPanelHeader}>
              <div>
                <div className={styles.filterTitle}>Materias predeterminadas</div>
                <div className={styles.filterHint}>
                  Estas materias se usan como base. Si el archivo trae otras, puedes decidir incluirlas o no.
                </div>
              </div>
              <button
                type="button"
                className={styles.filterReset}
                onClick={onRestaurarMaterias}
                disabled={cargando || analizandoMaterias}
              >
                <UiIcon name="refresh" className={styles.icon} styles={styles} />
                Restaurar
              </button>
            </div>
            <div className={styles.filterChips}>
              {materiasConfigurables.map((materia) => {
                const activa = materiasPredeterminadas.includes(materia);
                return (
                  <button
                    key={materia}
                    type="button"
                    className={`${styles.filterChip} ${activa ? styles.filterChipActive : ""}`}
                    onClick={() => onToggleMateriaPredeterminada(materia)}
                    disabled={cargando || analizandoMaterias}
                  >
                    {materia}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {analizandoMaterias && (
          <div className={styles.detectionPanel}>
            <div className={styles.detectionTitle}>Analizando materias del documento</div>
            <div className={styles.detectionHint}>
              Revisando variaciones fuera de tu configuracion para sugerir filtros.
            </div>
          </div>
        )}

        {archivo && !analizandoMaterias && prevalidacion && (
          <div className={`${styles.prevalidacionPanel} ${prevalidacion.ok ? styles.prevalidacionOk : styles.prevalidacionWarn}`}>
            <div className={styles.prevalidacionTitle}>
              {prevalidacion.ok ? "Prevalidacion completada" : "Prevalidacion con observaciones"}
            </div>
            <div className={styles.prevalidacionText}>{prevalidacion.message}</div>
            {!!prevalidacion.warnings?.length && (
              <ul className={styles.prevalidacionList}>
                {prevalidacion.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {archivo && !analizandoMaterias && hayMateriasAdicionales && (
          <div className={styles.detectionPanel}>
            <div className={styles.detectionTitle}>Materias detectadas en el documento</div>
            <div className={styles.extraMateriasRow}>
              {materiasDetectadas.map((materia) => {
                const esPredeterminada = mergeMaterias(materiasPredeterminadas).includes(materia);
                return (
                  <span
                    key={materia}
                    className={esPredeterminada ? styles.extraMateriaTagBase : styles.extraMateriaTag}
                    title={esPredeterminada ? "Materia predeterminada" : "Materia adicional (nueva)"}
                  >
                    {esPredeterminada ? `${materia} ✓` : materia}
                  </span>
                );
              })}
            </div>
            <div className={styles.detectionHint}>
              Las marcadas con ✓ ya estan en tus predeterminadas. Las demas son nuevas en este documento.
            </div>
            <div className={styles.modeGrid}>
              <button
                type="button"
                className={`${styles.modeCard} ${modoFiltroMaterias === "default" ? styles.modeCardActive : ""}`}
                onClick={() => onSetModoFiltroMaterias("default")}
                disabled={cargando}
              >
                <span className={styles.modeCardTitle}>
                  <UiIcon name="shield" className={styles.modeIcon} styles={styles} />
                  Usar predeterminadas
                </span>
                <span className={styles.modeCardDesc}>Solo materias base configuradas</span>
              </button>
              <button
                type="button"
                className={`${styles.modeCard} ${modoFiltroMaterias === "all" ? styles.modeCardActive : ""}`}
                onClick={onSeleccionarTodasMaterias}
                disabled={cargando}
              >
                <span className={styles.modeCardTitle}>
                  <UiIcon name="layers" className={styles.modeIcon} styles={styles} />
                  Incluir todas
                </span>
                <span className={styles.modeCardDesc}>Procesa todo lo detectado</span>
              </button>
              <button
                type="button"
                className={`${styles.modeCard} ${modoFiltroMaterias === "custom" ? styles.modeCardActive : ""}`}
                onClick={() => onSetModoFiltroMaterias("custom")}
                disabled={cargando}
              >
                <span className={styles.modeCardTitle}>
                  <UiIcon name="target" className={styles.modeIcon} styles={styles} />
                  Seleccion manual
                </span>
                <span className={styles.modeCardDesc}>Control exacto por materia</span>
              </button>
            </div>

            {modoFiltroMaterias === "custom" && (
              <>
                <div className={styles.selectionToolbar}>
                  <span className={styles.selectionHelp}>Selecciona materias para incluir en el reporte</span>
                  <span className={styles.selectionCount}>
                    {materiasPersonalizadas.length}/{materiasDetectadas.length}
                  </span>
                </div>
                <div className={styles.filterChips}>
                  {materiasDetectadas.map((materia) => {
                    const activa = materiasPersonalizadas.includes(materia);
                    return (
                      <button
                        key={materia}
                        type="button"
                        className={`${styles.filterChip} ${styles.selectionChip} ${
                          activa ? styles.filterChipActive : styles.selectionChipInactive
                        }`}
                        onClick={() => onToggleMateriaPersonalizada(materia)}
                        disabled={cargando}
                      >
                        <span className={styles.selectionChipMark}>{activa ? "SI" : "NO"}</span>
                        <span>{materia}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        <div className={styles.divider} />

        <button
          type="submit"
          disabled={cargando || analizandoMaterias || !archivo}
          className={`${styles.submitBtn} ${reporteFeedback ? styles.submitPulse : ""} ${
            formatoSalida === "pdf" ? styles.submitBtnPDF : styles.submitBtnExcel
          }`}
        >
          {cargando ? (
            <>
              <span className={styles.spinner} />
              Procesando reporte...
            </>
          ) : (
            <>
              <UiIcon name="download" className={styles.icon} styles={styles} />
              Generar y descargar {formatoSalida === "pdf" ? "PDF" : "Excel"}
            </>
          )}
        </button>

        {mensaje && tipo && (
          <div
            className={`${styles.statusMsg} ${
              tipo === "ok" ? styles.statusMsgOk : tipo === "error" ? styles.statusMsgError : styles.statusMsgInfo
            }`}
          >
            <span className={styles.statusIcon}>{tipoIcono[tipo]}</span>
            <div>
              <div>{mensaje}</div>
              {tipo === "error" && !!mensajeDetalles?.length && (
                <ul className={styles.statusDetailList}>
                  {mensajeDetalles.map((detalle, index) => (
                    <li key={`${detalle}-${index}`}>{detalle}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </form>
    </section>
  );
}

export default UploadSection;
