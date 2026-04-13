import React from "react";
import UiIcon from "./UiIcon";

function Header({ styles, temaOscuro, onToggleTheme, pasos }) {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerTopbar}>
          <div className={styles.headerBadge}>
            <UiIcon name="docChart" className={styles.icon} styles={styles} />
            DOCUMIND
          </div>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={onToggleTheme}
            title={temaOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            <UiIcon name={temaOscuro ? "sun" : "moon"} className={styles.icon} styles={styles} />
            {temaOscuro ? "Modo claro" : "Modo oscuro"}
          </button>
        </div>
        <h1 className={styles.headerTitle}>DocuMind | Gestor de Reportes</h1>
        <p className={styles.headerSubtitle}>
          Carga documentos, interpreta datos y genera reportes en un flujo guiado de cuatro pasos.
        </p>
      </header>

      <section className={styles.stepsGrid}>
        {pasos.map((paso) => (
          <article
            key={paso.id}
            className={`${styles.stepCard} ${
              paso.estado === "done" ? styles.stepDone : paso.estado === "active" ? styles.stepActive : styles.stepLocked
            }`}
          >
            <span className={styles.stepId}>{paso.id}</span>
            <span className={styles.stepTitle}>{paso.titulo}</span>
            <div className={styles.stepProgress}>
              <span className={styles.stepProgressFill} style={{ width: `${paso.progreso}%` }} />
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

export default Header;
