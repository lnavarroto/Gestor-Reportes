import React from "react";
import UiIcon from "./UiIcon";

function PreviewPanel({
  styles,
  vistaPrevia,
  totalEspecialistas,
  mostrarTodosEspecialistas,
  onToggleEspecialistas,
  especialistasPreview,
  especialistasSeleccionados,
  onToggleEspecialista,
  onSeleccionarTodosEspecialistas,
  onDeseleccionarTodosEspecialistas,
}) {
  if (!vistaPrevia.porMateria.length && !vistaPrevia.porEspecialista.length) {
    return null;
  }

  const seleccionados = especialistasSeleccionados || [];
  const todosSeleccionados =
    totalEspecialistas > 0 && seleccionados.length === totalEspecialistas;
  const ningunoSeleccionado = seleccionados.length === 0;
  const parcialSeleccionado = !todosSeleccionados && !ningunoSeleccionado;
  const hayFiltroActivo = totalEspecialistas > 0 && !todosSeleccionados;

  return (
    <div className={styles.previewPanel}>
      <div className={styles.previewTitle}>Vista previa de conteos</div>
      <div className={styles.previewSection}>
        <div className={styles.previewSubTitle}>Por materia</div>
        <div className={styles.previewList}>
          {vistaPrevia.porMateria.slice(0, 4).map((item) => (
            <div key={item.materia} className={styles.previewRow}>
              <span>{item.materia}</span>
              <strong>{item.total}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.previewSection}>
        <div className={styles.previewSubTitleRow}>
          <div className={styles.previewSubTitle}>
            Por especialista
            <span className={styles.previewCountBadge}>{totalEspecialistas}</span>
            {hayFiltroActivo && (
              <span className={styles.previewFilterBadge}>{seleccionados.length} activos</span>
            )}
          </div>
          {vistaPrevia.porEspecialista.length > 4 && (
            <button
              type="button"
              className={styles.previewToggle}
              onClick={onToggleEspecialistas}
            >
              <UiIcon name="users" className={styles.icon} styles={styles} />
              {mostrarTodosEspecialistas
                ? `Ver menos (${vistaPrevia.porEspecialista.length})`
                : `Ver todos (${vistaPrevia.porEspecialista.length})`}
              <UiIcon
                name={mostrarTodosEspecialistas ? "chevronUp" : "chevronDown"}
                className={styles.icon}
                styles={styles}
              />
            </button>
          )}
        </div>

        {totalEspecialistas > 0 && (
          <div className={styles.especialistaFilterActions}>
            <button
              type="button"
              className={`${styles.especialistaActionBtn} ${todosSeleccionados ? styles.especialistaActionBtnActive : ""}`}
              onClick={onSeleccionarTodosEspecialistas}
            >
              Todos
            </button>
            <button
              type="button"
              className={`${styles.especialistaActionBtn} ${ningunoSeleccionado ? styles.especialistaActionBtnActive : ""}`}
              onClick={onDeseleccionarTodosEspecialistas}
            >
              Ninguno
            </button>
            {parcialSeleccionado && (
              <span className={styles.especialistaFilterHint}>
                {seleccionados.length}/{totalEspecialistas} seleccionados
              </span>
            )}
          </div>
        )}

        <div
          className={`${styles.previewList} ${
            mostrarTodosEspecialistas && totalEspecialistas > 8 ? styles.previewListScrollable : ""
          }`}
        >
          {especialistasPreview.map((item, idx) => {
            const activo = seleccionados.includes(item.especialista);
            return (
              <div
                key={item.especialista}
                className={`${styles.previewRowEsp} ${!activo ? styles.previewRowEspInactivo : ""}`}
                onClick={() => onToggleEspecialista && onToggleEspecialista(item.especialista)}
                role="checkbox"
                aria-checked={activo}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    onToggleEspecialista && onToggleEspecialista(item.especialista);
                  }
                }}
              >
                <span className={`${styles.especialistaCheck} ${activo ? styles.especialistaCheckOn : ""}`}>
                  {activo ? "✓" : ""}
                </span>
                <span className={styles.previewRank}>{idx + 1}</span>
                <span className={styles.previewName} title={item.especialista}>
                  {item.especialista}
                </span>
                <strong className={styles.previewTotal}>{item.total}</strong>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default PreviewPanel;
