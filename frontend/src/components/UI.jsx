import { useState, useEffect } from 'react'
// Snackbar (Toast) component for alerts
export const Snackbar = ({ open, message, type = 'info', duration = 3500, onClose, position = 'bottom' }) => {
  useEffect(() => {
    if (!open) return;
    if (duration === 0) return;
    const timer = setTimeout(() => onClose?.(), duration);
    return () => clearTimeout(timer);
  }, [open, duration, onClose]);

  if (!open) return null;
  const colorMap = {
    info:   { bg: 'rgba(30,64,175,0.97)', color: '#fff' },
    success:{ bg: 'rgba(16,185,129,0.97)', color: '#fff' },
    error:  { bg: 'rgba(239,68,68,0.97)', color: '#fff' },
    warning:{ bg: 'rgba(251,191,36,0.97)', color: '#111' },
  };
  const style = {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    minWidth: 220,
    maxWidth: 400,
    padding: '14px 28px',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 500,
    boxShadow: '0 4px 24px rgba(0,0,0,0.13)',
    ...colorMap[type],
    bottom: position === 'bottom' ? 36 : undefined,
    top: position === 'top' ? 36 : undefined,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  };
  return (
    <div style={style} onClick={onClose} role="alert" aria-live="polite">
      {type === 'success' && <span style={{fontSize:18}}>✔️</span>}
      {type === 'error' && <span style={{fontSize:18}}>❌</span>}
      {type === 'warning' && <span style={{fontSize:18}}>⚠️</span>}
      {type === 'info' && <span style={{fontSize:18}}>ℹ️</span>}
      <span>{message}</span>
    </div>
  );
};


export const T = {
  orange: 'var(--orange)',
  orangeDim: 'var(--orange-dim)',
  orangeGlow: 'rgba(255,107,43,0.35)',
  blue: 'var(--blue)',
  blueDim: 'var(--blue-dim)',
  green: 'var(--green)',
  greenDim: 'var(--green-dim)',
  red: 'var(--red)',
  redDim: 'var(--red-dim)',
  amber: 'var(--amber)',
  amberDim: 'var(--amber-dim)',
  purple: '#7C3AED',
  text: 'var(--text)',
  text2: 'var(--text2)',
  muted: 'var(--muted)',
  border: 'var(--dark4)',
  surface2: 'var(--dark3)',
  radius: 'var(--radius)',
  radiusMd: '12px',
  shadow: 'var(--shadow)',
}

export const Logo = ({ size = 'md', variant = 'solid' }) => {
  const src = variant === 'transparent' ? '/images/devndespro_seo_transparent.png' : '/images/devndespro_seo.png'
  return (
    <img
      src={src}
      alt="SEO Tool"
      className={`logo logo-${size}`}
    />
  )
}

export const Button = ({ children, onClick, type = 'button', variant = 'primary', size = 'md', loading, disabled, fullWidth, style }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled || loading}
    className={`btn btn--${variant} btn--${size}${fullWidth ? ' btn--full' : ''}`}
    style={style}
  >
    {loading ? 'Loading...' : children}
  </button>
)

export const Card = ({ children, style, padding }) => (
  <div className="card" style={padding ? { padding, ...style } : style}>
    {children}
  </div>
)

export const SectionLabel = ({ children, action }) => (
  <div className="section-label-row">
    <div className="section-label-text">{children}</div>
    {action}
  </div>
)

export const MetricCard = ({ label, value, sub, accent }) => (
  <div className="metric-card">
    <div className="metric-card__label">{label}</div>
    <div className="metric-card__value" style={{ color: accent || 'var(--text)' }}>{value}</div>
    {sub && <div className="metric-card__sub">{sub}</div>}
  </div>
)

export const StatCard = ({ label, value, sub, icon, color, trend, accentTop }) => (
  <div
    className="stat-card"
    style={accentTop ? { borderTop: `3px solid ${color || 'var(--orange)'}` } : undefined}
  >
    <div className="stat-card__header">
      <div className="stat-card__label">{label}</div>
      {icon && <div style={{ color: color || 'var(--orange)', fontSize: 13 }}>{icon}</div>}
    </div>
    <div className="stat-card__value" style={{ color: color || 'var(--text)' }}>{value}</div>
    <div className="stat-card__footer">
      <div className="stat-card__sub">{sub}</div>
      {typeof trend === 'number' && (
        <div style={{ fontSize: 11, color: trend >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
          {trend > 0 ? '+' : ''}{trend}%
        </div>
      )}
    </div>
  </div>
)

export const Badge = ({ status, variant = 'default', dot, children, style }) => {
  const statusMap = {
    Live: { bg: 'var(--green-dim)', color: 'var(--green)' },
    Pending: { bg: 'var(--amber-dim)', color: 'var(--amber)' },
    Todo: { bg: 'var(--dark4)', color: 'var(--text2)' },
    Critical: { bg: 'var(--red-dim)', color: 'var(--red)' },
    High: { bg: 'var(--amber-dim)', color: 'var(--amber)' },
    Medium: { bg: 'var(--blue-dim)', color: 'var(--blue)' },
    Low: { bg: 'var(--dark4)', color: 'var(--muted)' },
    Easy: { bg: 'var(--green-dim)', color: 'var(--green)' },
    Hard: { bg: 'var(--red-dim)', color: 'var(--red)' },
  }

  const variantMap = {
    default: { bg: 'var(--dark3)', color: 'var(--text2)' },
    info: { bg: 'var(--blue-dim)', color: 'var(--blue)' },
    success: { bg: 'var(--green-dim)', color: 'var(--green)' },
    warning: { bg: 'var(--amber-dim)', color: 'var(--amber)' },
    danger: { bg: 'var(--red-dim)', color: 'var(--red)' },
    orange: { bg: 'var(--orange-dim)', color: 'var(--orange)' },
  }

  const content = children || status
  const token = status ? (statusMap[status] || statusMap.Low) : (variantMap[variant] || variantMap.default)

  return (
    <span className="badge" style={{ background: token.bg, color: token.color, ...style }}>
      {dot && <span className="badge__dot" />}
      {content}
    </span>
  )
}

export const OrangeBtn = ({ onClick, children, style, disabled, type = 'button' }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className="orange-btn"
    style={style}
  >
    {children}
  </button>
)

export const GhostBtn = ({ onClick, children, style }) => (
  <button onClick={onClick} className="ghost-btn" style={style}>
    {children}
  </button>
)

export const ProgressBar = ({ label, pct, value, max = 100, color, height = 5, showLabel }) => {
  const normalized = typeof pct === 'number' ? pct : Math.max(0, Math.min(100, max ? Math.round(((value || 0) / max) * 100) : 0))

  return (
    <div style={{ marginBottom: 12 }}>
      {(label || showLabel) && (
        <div className="progress__header">
          <span className="progress__label">{label || ''}</span>
          <span className="progress__value">
            {typeof value === 'number' && typeof max === 'number' && showLabel ? `${value}/${max}` : `${normalized}%`}
          </span>
        </div>
      )}
      <div className="progress__track" style={{ height }}>
        <div className="progress__fill" style={{ width: `${normalized}%`, background: color || 'var(--orange)', height }} />
      </div>
    </div>
  )
}

export const Spinner = () => <div className="spinner spin" />

export const Divider = ({ label, style }) => (
  <div className="divider" style={style}>
    <div className="divider__line" />
    {label && <span className="divider__label">{label}</span>}
    <div className="divider__line" />
  </div>
)

export const Input = ({ label, error, hint, icon, style, ...props }) => (
  <div style={style}>
    {label && <div className="input-label">{label}</div>}
    <div className="input-wrap">
      {icon && <span className="input-icon">{icon}</span>}
      <input {...props} style={{ padding: icon ? '9px 13px 9px 32px' : '9px 13px' }} />
    </div>
    {error && <div className="input-error">{error}</div>}
    {!error && hint && <div className="input-hint">{hint}</div>}
  </div>
)

export const EmptyState = ({ message, icon, title, desc, action }) => {
  if (title || desc || action || icon) {
    return (
      <div className="empty-state">
        {icon && <div className="empty-state__icon">{icon}</div>}
        {title && <div className="empty-state__title">{title}</div>}
        {(desc || message) && <div className="empty-state__desc">{desc || message}</div>}
        {action}
      </div>
    )
  }
  return <div className="empty-state">{message}</div>
}

export const PageHeader = ({ title, subtitle, action }) => (
  <div className="page-header">
    <div className="page-header__row">
      <div>
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__sub">{subtitle}</p>}
      </div>
      {action && <div className="page-header__action">{action}</div>}
    </div>
  </div>
)

export const Modal = ({ open, onClose, title, subtitle, children, footer, width = 500, closeOnOverlayClick = false }) => {
  useEffect(() => {
    const onEsc = e => e.key === 'Escape' && onClose?.()
    if (open) window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [open, onClose])

  if (!open) return null

  const handleOverlayClick = () => {
    if (closeOnOverlayClick) onClose?.()
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal" style={{ maxWidth: width }} onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__title">{title}</div>
          {subtitle && <div className="modal__subtitle">{subtitle}</div>}
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  )
}
