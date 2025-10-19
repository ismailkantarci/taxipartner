// TAXIPartner design system token çıkışı.
// Tüm projeler renk, tipografi ve spacing sabitlerini buradan tüketmelidir.

export const colors = {
  brand: {
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    primaryMuted: '#dbeafe',
    accent: '#fcd34d'
  },
  text: {
    primary: '#0f172a',
    secondary: '#475569',
    muted: '#94a3b8',
    inverted: '#f8fafc'
  },
  background: {
    canvas: '#f1f5f9',
    surface: '#ffffff',
    surfaceRaised: '#f8fafc',
    overlay: 'rgba(15, 23, 42, 0.65)'
  },
  border: {
    subtle: '#e2e8f0',
    default: '#cbd5f5',
    strong: '#64748b'
  },
  status: {
    success: '#16a34a',
    warning: '#f59e0b',
    danger: '#dc2626',
    info: '#0ea5e9'
  },
  dark: {
    text: '#e2e8f0',
    muted: '#94a3b8',
    surface: '#0b1220',
    border: '#1f2937'
  }
};

export const typography = {
  fontFamily: {
    sans: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.375rem',
    '2xl': '1.75rem'
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.35,
    normal: 1.5,
    relaxed: 1.65
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  }
};

export const spacing = {
  0: '0px',
  1: '0.125rem',
  2: '0.25rem',
  3: '0.375rem',
  4: '0.5rem',
  6: '0.75rem',
  8: '1rem',
  10: '1.25rem',
  12: '1.5rem',
  16: '2rem',
  20: '2.5rem',
  24: '3rem'
};

export const breakpoints = {
  xs: '480px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
};
