export function NavIcon({ name, size = 16 }) {
  const icons = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" fill="none" />
      </>
    ),
    activity: (
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="1.8" fill="none" />
    ),
    bell: (
      <>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.8" fill="none" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.8" />
        <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.8" />
      </>
    ),
    cpu: (
      <>
        <rect x="9" y="9" width="6" height="6" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <path d="M9 1v2M15 1v2M9 21v2M15 21v2M1 9h2M1 15h2M21 9h2M21 15h2M5 5l2 2M17 5l-2 2M5 19l2-2M17 19l-2-2" stroke="currentColor" strokeWidth="1.8" fill="none" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="1.8" fill="none" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.8" />
      </>
    ),
    menu: (
      <>
        <line x1="3" y1="6"  x2="21" y2="6"  stroke="currentColor" strokeWidth="1.8" />
        <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.8" />
        <line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="1.8" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <line x1="12" y1="1"  x2="12" y2="3"  stroke="currentColor" strokeWidth="1.8" />
        <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="1.8" />
        <line x1="4.22" y1="4.22"   x2="5.64" y2="5.64"   stroke="currentColor" strokeWidth="1.8" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="1.8" />
        <line x1="1"  y1="12" x2="3"  y2="12" stroke="currentColor" strokeWidth="1.8" />
        <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="1.8" />
        <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36" stroke="currentColor" strokeWidth="1.8" />
        <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  stroke="currentColor" strokeWidth="1.8" />
      </>
    ),
    moon: (
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="1.8" fill="none" />
    ),
    plus: (
      <>
        <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="1.8" />
        <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="1.8" />
      </>
    ),
    check: (
      <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="1.8" fill="none" />
    ),
    x: (
      <>
        <line x1="18" y1="6"  x2="6"  y2="18" stroke="currentColor" strokeWidth="1.8" />
        <line x1="6"  y1="6"  x2="18" y2="18" stroke="currentColor" strokeWidth="1.8" />
      </>
    ),
    refresh: (
      <>
        <polyline points="23 4 23 10 17 10" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <polyline points="1 20 1 14 7 14"   stroke="currentColor" strokeWidth="1.8" fill="none" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" strokeWidth="1.8" fill="none" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="1.8" />
      </>
    ),
    users: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.8" fill="none" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" fill="none" />
      </>
    ),
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      {icons[name] ?? null}
    </svg>
  );
}
