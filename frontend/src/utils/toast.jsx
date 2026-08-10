import React from 'react'
import hotToast from 'react-hot-toast'

const DEFAULT_DURATION = 12000

const closeButtonStyle = {
  marginLeft: '14px',
  width: '28px',
  height: '28px',
  minWidth: '28px',
  border: '1px solid #4B5563',
  borderRadius: '7px',
  background: 'transparent',
  color: '#D1D5DB',
  fontSize: '20px',
  lineHeight: 1,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const contentStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  width: '100%',
}

const messageStyle = {
  flex: 1,
  minWidth: 0,
}

const renderMessage = (message, toastId) => (
  <div style={contentStyle}>
    <div style={messageStyle}>{message}</div>

    <button
      type="button"
      aria-label="Close notification"
      title="Close"
      onClick={() => hotToast.dismiss(toastId)}
      style={closeButtonStyle}
    >
      {'\u00D7'}
    </button>
  </div>
)

const normalizeOptions = (options = {}) => ({
  duration: DEFAULT_DURATION,
  ...options,
})

const show = (message, options = {}) =>
  hotToast(
    (t) => renderMessage(message, t.id),
    normalizeOptions(options)
  )

show.success = (message, options = {}) =>
  hotToast.success(
    (t) => renderMessage(message, t.id),
    normalizeOptions({
      duration: 8000,
      ...options,
    })
  )

show.error = (message, options = {}) =>
  hotToast.error(
    (t) => renderMessage(message, t.id),
    normalizeOptions({
      duration: 20000,
      ...options,
    })
  )

show.loading = (message, options = {}) =>
  hotToast.loading(
    (t) => renderMessage(message, t.id),
    normalizeOptions(options)
  )

show.dismiss = (...args) => hotToast.dismiss(...args)
show.remove = (...args) => hotToast.remove(...args)
show.custom = (...args) => hotToast.custom(...args)
show.promise = (...args) => hotToast.promise(...args)

export default show