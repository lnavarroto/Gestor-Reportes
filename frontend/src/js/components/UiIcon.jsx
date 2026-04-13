import React from "react";

function UiIcon({ name, className, styles }) {
  const icons = {
    moon: <path d="M20 15.5A8.5 8.5 0 1 1 11.5 4a7 7 0 0 0 8.5 11.5Z" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6" />
      </>
    ),
    upload: <path d="M12 16V5m0 0-3.6 3.6M12 5l3.6 3.6M4 16.8V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2.2" />,
    close: <path d="m7 7 10 10M17 7 7 17" />,
    settings: (
      <>
        <circle cx="12" cy="12" r="2.8" />
        <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1 1 0 0 1 0 1.4l-1.1 1.1a1 1 0 0 1-1.4 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1 1 0 0 1-1 1h-1.6a1 1 0 0 1-1-1v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1 1 0 0 1-1.4 0l-1.1-1.1a1 1 0 0 1 0-1.4l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1 1 0 0 1-1-1v-1.6a1 1 0 0 1 1-1h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1 1 0 0 1 0-1.4l1.1-1.1a1 1 0 0 1 1.4 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a1 1 0 0 1 1-1h1.6a1 1 0 0 1 1 1v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1 1 0 0 1 1.4 0l1.1 1.1a1 1 0 0 1 0 1.4l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a1 1 0 0 1 1 1v1.6a1 1 0 0 1-1 1h-.2a1 1 0 0 0-.9.6Z" />
      </>
    ),
    refresh: <path d="M20 6v5h-5M4 18v-5h5M6.4 9.2A7 7 0 0 1 19 11M5 13a7 7 0 0 0 12.6 1.8" />,
    shield: <path d="M12 3 5.5 6v5.4c0 4.3 2.8 7.4 6.5 9.1 3.7-1.7 6.5-4.8 6.5-9.1V6L12 3Zm-2.2 9.2 1.6 1.6 3-3" />,
    layers: <path d="m12 4 8 4-8 4-8-4 8-4Zm8 8-8 4-8-4m16 4-8 4-8-4" />,
    target: <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.2-6.2-2.1 2.1M8.9 15.1l-2.1 2.1m0-11.4 2.1 2.1m8.3 8.3 2.1 2.1M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" />,
    download: <path d="M12 4v10m0 0-3.6-3.6M12 14l3.6-3.6M4 19.5h16" />,
    spark: <path d="M12 3.5 14.2 9l5.8.5-4.4 3.8 1.3 5.7L12 16.1 6.9 19l1.3-5.7-4.4-3.8L9.6 9 12 3.5Z" />,
    check: <path d="m5 12 4 4 10-10" />,
    users: (
      <>
        <circle cx="9" cy="8" r="2.2" />
        <circle cx="15.5" cy="9" r="1.8" />
        <path d="M4.8 17.5c.6-2 2.4-3.2 4.3-3.2h.1c2 0 3.7 1.2 4.3 3.2M13 17.5c.5-1.5 1.8-2.4 3.2-2.4h.1c1.5 0 2.8.9 3.2 2.4" />
      </>
    ),
    docChart: (
      <>
        <path d="M8 3.5h6l3.5 3.5V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
        <path d="M14 3.5V7h3.5" />
        <path d="M9.5 16.5h6" />
        <path d="M9.5 13.8h3.8" />
        <path d="M9.5 11.1h2.2" />
      </>
    ),
    chevronDown: <path d="m6 9 6 6 6-6" />,
    chevronUp: <path d="m6 15 6-6 6 6" />,
  };

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className || styles.icon}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icons[name] || null}
    </svg>
  );
}

export default UiIcon;
