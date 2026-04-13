import React, { useState } from "react";

function ExcelInsightsPanel({ styles, excelInsights }) {
  const workbookMeta = excelInsights?.workbookMeta;
  const sheetInsights = excelInsights?.sheetInsights || [];
  const metrics = excelInsights?.metrics;
  const suggestedReports = excelInsights?.suggestedReports || [];
  const legacy = excelInsights?.legacy;
  const normalizationPreview = excelInsights?.normalizationPreview;
  const detectedFields = legacy?.detectedFields || sheetInsights.flatMap((sheet) => sheet.detectedFields || []);
  const previewRows = normalizationPreview?.normalizedRowsPreview || [];
  const metadata = normalizationPreview?.metadata || {};
  const discardedByReason = normalizationPreview?.discardedByReason || [];
  const discardedRows = normalizationPreview?.discardedRows || [];
  const blocks = normalizationPreview?.blocks || [];
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const uniqueValues = (items) => [...new Set((items || []).map((item) => String(item || "").trim()).filter(Boolean))];
  const especialistasDetectados = uniqueValues(previewRows.map((row) => row.especialista));
  const canalesDetectados = uniqueValues(previewRows.map((row) => row.canal_ingreso));
  const estadosDetectados = uniqueValues(previewRows.map((row) => row.estado));
  const tiposDocumentoDetectados = uniqueValues(
    previewRows.map((row) => {
      const doc = String(row.documento || "").trim();
      const split = doc.match(/^\d{3,6}-\d{4}\s+(.+)$/i);
      return split ? split[1] : doc;
    })
  );

  if (!detectedFields.length && !sheetInsights.length && !suggestedReports.length && !normalizationPreview) {
    return null;
  }

  return (
    <div className={styles.previewPanel}>
      <div className={styles.previewTitle}>Variables detectadas en Excel</div>
      <p className={styles.summaryHint}>
        DocuMind reviso tu estructura y detecto los campos disponibles para construir cuadros.
      </p>

      <div className={styles.excelDetailsLauncher}>
        <button type="button" className={styles.excelDetailsBtn} onClick={() => setShowDetailsModal(true)}>
          Detalles
        </button>
      </div>

      {showDetailsModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDetailsModal(false)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Detalles de Variables detectadas en Excel</h3>
              <button type="button" className={styles.modalCloseBtn} onClick={() => setShowDetailsModal(false)}>
                Cerrar
              </button>
            </div>
            <div className={styles.modalBodyScroll}>
              {normalizationPreview && (
                <>
                  <div className={styles.previewSection}>
                    <div className={styles.previewSubTitle}>Metadata detectada</div>
                    <div className={styles.excelMetaGrid}>
                      <div className={styles.excelMetaItem}>
                        <span className={styles.kpiLabel}>Juzgado</span>
                        <strong className={styles.excelMetaValue}>{metadata.juzgado || "No detectado"}</strong>
                      </div>
                      <div className={styles.excelMetaItem}>
                        <span className={styles.kpiLabel}>Fecha inicio reporte</span>
                        <strong className={styles.excelMetaValue}>{metadata.fecha_inicio_reporte || "No detectada"}</strong>
                      </div>
                      <div className={styles.excelMetaItem}>
                        <span className={styles.kpiLabel}>Fecha fin reporte</span>
                        <strong className={styles.excelMetaValue}>{metadata.fecha_fin_reporte || "No detectada"}</strong>
                      </div>
                      <div className={styles.excelMetaItem}>
                        <span className={styles.kpiLabel}>Registros normalizados</span>
                        <strong className={styles.excelMetaValue}>{normalizationPreview.reconstructedCount || 0}</strong>
                      </div>
                    </div>
                  </div>

                  <div className={styles.previewSection}>
                    <div className={styles.previewSubTitle}>Bloques por especialista detectados</div>
                    {!!blocks.length ? (
                      <div className={styles.excelWidgetsList}>
                        {blocks.map((block) => (
                          <div key={`${block.sheetName}-${block.startRow}-${block.especialista}`} className={styles.excelWidgetRow}>
                            <span className={styles.excelWidgetName}>{block.especialista || "SIN ESPECIALISTA"}</span>
                            <span className={styles.excelWidgetReason}>
                              Hoja: {block.sheetName} | filas {block.startRow}-{block.endRow} | registros: {block.records}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.excelEmpty}>No se detectaron bloques de especialista.</div>
                    )}
                  </div>

                  <div className={styles.previewSection}>
                    <div className={styles.previewSubTitle}>Resumen de valores detectados</div>
                    <div className={styles.excelTagSections}>
                      <div>
                        <div className={styles.excelTagTitle}>Especialistas</div>
                        <div className={styles.excelTagWrap}>
                          {especialistasDetectados.map((item) => (
                            <span key={`esp-${item}`} className={styles.excelTag}>{item}</span>
                          ))}
                          {!especialistasDetectados.length && <span className={styles.excelTagMuted}>Sin datos</span>}
                        </div>
                      </div>
                      <div>
                        <div className={styles.excelTagTitle}>Canales</div>
                        <div className={styles.excelTagWrap}>
                          {canalesDetectados.map((item) => (
                            <span key={`canal-${item}`} className={styles.excelTag}>{item}</span>
                          ))}
                          {!canalesDetectados.length && <span className={styles.excelTagMuted}>Sin datos</span>}
                        </div>
                      </div>
                      <div>
                        <div className={styles.excelTagTitle}>Estados</div>
                        <div className={styles.excelTagWrap}>
                          {estadosDetectados.map((item) => (
                            <span key={`estado-${item}`} className={styles.excelTag}>{item}</span>
                          ))}
                          {!estadosDetectados.length && <span className={styles.excelTagMuted}>Sin datos</span>}
                        </div>
                      </div>
                      <div>
                        <div className={styles.excelTagTitle}>Tipos de documento</div>
                        <div className={styles.excelTagWrap}>
                          {tiposDocumentoDetectados.map((item) => (
                            <span key={`tipo-doc-${item}`} className={styles.excelTag}>{item}</span>
                          ))}
                          {!tiposDocumentoDetectados.length && <span className={styles.excelTagMuted}>Sin datos</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.previewSection}>
                    <div className={styles.previewSubTitle}>Preview de normalizedRows</div>
                    {!!previewRows.length ? (
                      <div className={styles.excelTableWrap}>
                        <table className={styles.excelPreviewTable}>
                          <thead>
                            <tr>
                              <th>Expediente</th>
                              <th>Fecha ingreso</th>
                              <th>Documento</th>
                              <th>Dias</th>
                              <th>Estado</th>
                              <th>Tipo ing</th>
                              <th>Canal ingreso</th>
                              <th>Descripcion</th>
                              <th>Especialista</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewRows.map((row) => (
                              <tr key={`${row.expediente}-${row.fecha_ingreso}-${row.especialista}`}>
                                <td>{row.expediente || "-"}</td>
                                <td>{row.fecha_ingreso || "-"}</td>
                                <td>{row.documento || "-"}</td>
                                <td>{row.dias ?? "-"}</td>
                                <td>{row.estado || "-"}</td>
                                <td>{row.tipo_ing || "-"}</td>
                                <td>{row.canal_ingreso || "-"}</td>
                                <td>{row.descripcion || "-"}</td>
                                <td>{row.especialista || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className={styles.excelEmpty}>No hay filas normalizadas para mostrar.</div>
                    )}
                  </div>

                  <div className={styles.previewSection}>
                    <div className={styles.previewSubTitle}>Filas descartadas y motivo</div>
                    <div className={styles.excelMetaGrid}>
                      <div className={styles.excelMetaItem}>
                        <span className={styles.kpiLabel}>Total descartadas</span>
                        <strong className={styles.excelMetaValue}>{normalizationPreview.discardedCount || 0}</strong>
                      </div>
                    </div>

                    {!!discardedByReason.length && (
                      <div className={styles.excelWidgetsList}>
                        {discardedByReason.map((item) => (
                          <div key={`${item.reason}-${item.total}`} className={styles.excelWidgetRow}>
                            <span className={styles.excelWidgetName}>{item.reason}</span>
                            <span className={styles.excelWidgetReason}>{item.total} filas</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {!!discardedRows.length && (
                      <div className={styles.excelDiscardedList}>
                        {discardedRows.slice(0, 20).map((row) => (
                          <div key={`${row.rowNumber}-${row.reason}-${row.raw}`} className={styles.excelDiscardedRow}>
                            <strong>Fila {row.rowNumber}</strong> | {row.reason} | {row.raw || "(sin contenido)"}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {workbookMeta?.sheets?.length > 0 && (
                <div className={styles.previewSection}>
                  <div className={styles.previewSubTitle}>Hojas detectadas</div>
                  <div className={styles.excelSheetList}>
                    {workbookMeta.sheets.map((sheet) => (
                      <div key={sheet.name} className={styles.excelSheetCard}>
                        <div className={styles.excelSheetName}>{sheet.name}</div>
                        <div className={styles.excelSheetMeta}>
                          {sheet.rowCount} filas, {sheet.columnCount} columnas, {sheet.mergeCount} merges
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {metrics && (
                <div className={styles.previewSection}>
                  <div className={styles.previewSubTitle}>Metricas del libro</div>
                  <div className={styles.excelMetricsGrid}>
                    <div className={styles.kpiItem}>
                      <span className={styles.kpiLabel}>Hojas</span>
                      <strong className={styles.kpiValue}>{metrics.sheetCount || 0}</strong>
                    </div>
                    <div className={styles.kpiItem}>
                      <span className={styles.kpiLabel}>Tablas</span>
                      <strong className={styles.kpiValue}>{metrics.tableCount || 0}</strong>
                    </div>
                    <div className={styles.kpiItem}>
                      <span className={styles.kpiLabel}>Filas utiles</span>
                      <strong className={styles.kpiValue}>{metrics.rowCount || 0}</strong>
                    </div>
                    <div className={styles.kpiItem}>
                      <span className={styles.kpiLabel}>Campos</span>
                      <strong className={styles.kpiValue}>{metrics.fieldCount || 0}</strong>
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.excelInsightsGrid}>
                {detectedFields.map((field) => (
                  <div key={`${field.key}-${field.column || field.columnLetter || field.header || "x"}`} className={styles.excelFieldCard}>
                    <div className={styles.excelFieldHeader}>
                      <span className={styles.excelFieldLabel}>{field.label}</span>
                      {(field.column || field.columnLetter) && <span className={styles.excelFieldColumn}>{field.column || field.columnLetter}</span>}
                    </div>
                    <div className={styles.excelFieldMeta}>{field.header || field.source}</div>
                    <div className={styles.excelFieldSample}>{field.sample || "Sin muestra legible"}</div>
                  </div>
                ))}
              </div>

              {sheetInsights.length > 0 && (
                <div className={styles.previewSection}>
                  <div className={styles.previewSubTitle}>Tablas detectadas</div>
                  <div className={styles.excelWidgetsList}>
                    {sheetInsights
                      .flatMap((sheet) => (sheet.tables || []).map((table) => ({ ...table, sheetName: sheet.name })))
                      .map((table) => (
                        <div key={table.id} className={styles.excelWidgetRow}>
                          <span className={styles.excelWidgetName}>{table.sheetName} | Tabla desde fila {table.startRowNumber}</span>
                          <span className={styles.excelWidgetReason}>
                            {table.fields.length} campos detectados{table.context?.juzgado ? ` | ${table.context.juzgado}` : ""}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {!!suggestedReports.length && (
                <div className={styles.previewSection}>
                  <div className={styles.previewSubTitle}>Reportes sugeridos</div>
                  <div className={styles.excelWidgetsList}>
                    {suggestedReports.map((widget) => (
                      <div key={widget.key} className={styles.excelWidgetRow}>
                        <span className={styles.excelWidgetName}>{widget.label}</span>
                        <span className={styles.excelWidgetReason}>{widget.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!!legacy?.availableWidgets?.length && (
                <div className={styles.previewSection}>
                  <div className={styles.previewSubTitle}>Cuadros clasicos detectados</div>
                  <div className={styles.excelWidgetsList}>
                    {legacy.availableWidgets.map((widget) => (
                      <div key={widget.key} className={styles.excelWidgetRow}>
                        <span className={styles.excelWidgetName}>{widget.label}</span>
                        <span className={styles.excelWidgetReason}>{widget.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {metrics?.byState?.length > 0 && (
                <div className={styles.previewSection}>
                  <div className={styles.previewSubTitle}>Resumen por estado</div>
                  <div className={styles.previewList}>
                    {metrics.byState.map((item) => (
                      <div key={item.label} className={styles.previewRow}>
                        <span>{item.label}</span>
                        <strong>{item.total}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExcelInsightsPanel;
