import React from "react";

function MatrixReportPanel({
  styles,
  visible,
  loading,
  exporting,
  matrixType,
  matrixTypes,
  matrixData,
  filterOptions,
  filters,
  onChangeType,
  onChangeFilter,
  onBuild,
  onExport,
}) {
  if (!visible) return null;

  const leafColumns = matrixData?.leafColumns || [];
  const headerRows = matrixData?.headers || [];
  const rows = matrixData?.rows || [];
  const columnTotals = matrixData?.columnTotals || {};

  return (
    <section className={styles.matrixCard}>
      <div className={styles.sectionHeader}>
        <p className={styles.sectionLabel}>Matriz dinamica desde normalizedRows</p>
        <span className={styles.sectionMeta}>Validacion previa a reporte final</span>
      </div>

      <div className={styles.matrixControlGrid}>
        <label className={styles.matrixControlItem}>
          <span className={styles.matrixControlLabel}>Tipo de matriz</span>
          <select value={matrixType} onChange={(event) => onChangeType(event.target.value)}>
            {matrixTypes.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.matrixControlItem}>
          <span className={styles.matrixControlLabel}>Fecha inicio</span>
          <input
            type="date"
            value={filters.fechaInicio}
            onChange={(event) => onChangeFilter("fechaInicio", event.target.value)}
          />
        </label>

        <label className={styles.matrixControlItem}>
          <span className={styles.matrixControlLabel}>Fecha fin</span>
          <input
            type="date"
            value={filters.fechaFin}
            onChange={(event) => onChangeFilter("fechaFin", event.target.value)}
          />
        </label>

        <label className={styles.matrixControlItem}>
          <span className={styles.matrixControlLabel}>Juzgado</span>
          <select value={filters.juzgado} onChange={(event) => onChangeFilter("juzgado", event.target.value)}>
            <option value="">Todos</option>
            {(filterOptions?.juzgados || []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.matrixControlItem}>
          <span className={styles.matrixControlLabel}>Estado</span>
          <select value={filters.estado} onChange={(event) => onChangeFilter("estado", event.target.value)}>
            <option value="">Todos</option>
            {(filterOptions?.estados || []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.matrixToolbar}>
        <button type="button" className={styles.matrixActionBtn} onClick={onBuild} disabled={loading}>
          {loading ? "Construyendo matriz..." : "Construir matriz"}
        </button>
        <button type="button" className={styles.matrixActionBtn} onClick={() => onExport("excel")} disabled={exporting || !matrixData}>
          Exportar Excel
        </button>
        <button type="button" className={styles.matrixActionBtn} onClick={() => onExport("pdf")} disabled={exporting || !matrixData}>
          Exportar PDF
        </button>
      </div>

      {matrixData?.summary && (
        <div className={styles.excelMetaGrid}>
          <div className={styles.excelMetaItem}>
            <span className={styles.kpiLabel}>Registros base</span>
            <strong className={styles.excelMetaValue}>{matrixData.summary.registrosBase}</strong>
          </div>
          <div className={styles.excelMetaItem}>
            <span className={styles.kpiLabel}>Registros filtrados</span>
            <strong className={styles.excelMetaValue}>{matrixData.summary.registrosFiltrados}</strong>
          </div>
          <div className={styles.excelMetaItem}>
            <span className={styles.kpiLabel}>Especialistas</span>
            <strong className={styles.excelMetaValue}>{matrixData.summary.especialistas}</strong>
          </div>
          <div className={styles.excelMetaItem}>
            <span className={styles.kpiLabel}>Columnas</span>
            <strong className={styles.excelMetaValue}>{matrixData.summary.columnas}</strong>
          </div>
        </div>
      )}

      {!!matrixData && (
        <div className={styles.matrixTableWrap}>
          <table className={styles.matrixTable}>
            <thead>
              {headerRows.map((row, index) => (
                <tr key={`header-${index}`}>
                  {index === 0 && <th rowSpan={headerRows.length}>Especialista</th>}
                  {row.map((cell) => (
                    <th key={`${index}-${cell.label}-${cell.colSpan}`} colSpan={cell.colSpan}>
                      {cell.label}
                    </th>
                  ))}
                  {index === 0 && <th rowSpan={headerRows.length}>Total</th>}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td className={styles.matrixRowHeader}>{row.label}</td>
                  {leafColumns.map((leaf) => (
                    <td key={`${row.label}-${leaf.key}`}>{row.cells[leaf.key] || 0}</td>
                  ))}
                  <td className={styles.matrixTotalCell}>{row.total || 0}</td>
                </tr>
              ))}
              <tr>
                <td className={styles.matrixRowHeader}>TOTAL GENERAL</td>
                {leafColumns.map((leaf) => (
                  <td key={`total-${leaf.key}`} className={styles.matrixTotalCell}>{columnTotals[leaf.key] || 0}</td>
                ))}
                <td className={styles.matrixTotalCell}>{matrixData.grandTotal || 0}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default MatrixReportPanel;
