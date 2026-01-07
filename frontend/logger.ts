const API_BASE = `http://${window.location.hostname}:8001`

interface LogPayload {
  level: 'error' | 'warn' | 'info'
  message: string
  stack?: string
  url?: string
  userAgent?: string
}

async function sendLog(payload: LogPayload): Promise<void> {
  try {
    await fetch(`${API_BASE}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        url: window.location.href,
        userAgent: navigator.userAgent
      })
    })
  } catch {
    // Silently fail - we don't want logging failures to cause more errors
    console.warn('Failed to send log to server')
  }
}

export const logger = {
  error: (message: string, error?: Error): void => {
    console.error(message, error)
    sendLog({
      level: 'error',
      message,
      stack: error?.stack
    })
  },

  warn: (message: string): void => {
    console.warn(message)
    sendLog({
      level: 'warn',
      message
    })
  },

  info: (message: string): void => {
    console.info(message)
    sendLog({
      level: 'info',
      message
    })
  }
}

export function setupGlobalErrorHandlers(): void {
  // Catch unhandled errors
  window.onerror = (message, source, lineno, colno, error) => {
    logger.error(
      `Unhandled error: ${message} at ${source}:${lineno}:${colno}`,
      error ?? undefined
    )
    return false // Let the default handler run too
  }

  // Catch unhandled promise rejections
  window.onunhandledrejection = (event) => {
    const error = event.reason instanceof Error ? event.reason : undefined
    const message = error?.message ?? String(event.reason)
    logger.error(`Unhandled promise rejection: ${message}`, error)
  }
}
