import React from "react";
import UiIcon from "./UiIcon";

function Header({ styles, temaOscuro, onToggleTheme, pasos, backendOnline, checkingBackend }) {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerTopbar}>
          <div className={styles.headerBadge}>
            <UiIcon name="docChart" className={styles.icon} styles={styles} />
            DOCUMIND
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "4px",
                backgroundColor: checkingBackend
                  ? "rgba(100, 150, 200, 0.15)"
                  : backendOnline
                  ? "rgba(34, 197, 94, 0.15)"
                  : "rgba(239, 68, 68, 0.15)",
                fontSize: "12px",
                fontWeight: "500",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: checkingBackend
                    ? "#6496c8"
                    : backendOnline
                    ? "#22c55e"
                    : "#ef4444",
                  animation: checkingBackend ? "pulse 1.5s infinite" : "none",
                }}
              />
              <span style={{ color: checkingBackend ? "#6496c8" : backendOnline ? "#22c55e" : "#ef4444" }}>
                {checkingBackend ? "Verificando..." : backendOnline ? "En línea" : "Desconectado"}
              </span>
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
