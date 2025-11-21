/**
 * Logger utility
 *
 * Provides clean logging interface with structured context support
 */

interface LogContext {
  [key: string]: unknown;
}

/**
 * Extract error info from unknown error object
 */
function formatErrorForLog(error: unknown): {message: string; stack?: string} {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  return { message: String(error) };
}

/**
 * Format log message with context
 */
function formatLog(level: string, message: string, context?: LogContext): void {
  const timestamp = new Date().toISOString();
  const logData: Record<string, unknown> = {
    timestamp,
    level,
    message
  };

  if (context) {
    // If context contains an error field, format it properly
    if (context.error !== undefined) {
      const { message: errorMessage, stack } = formatErrorForLog(context.error);
      logData.error = errorMessage;
      if (stack) {
        logData.stack = stack;
      }

      // Include other context fields except the original error
      Object.entries(context).forEach(([key, value]) => {
        if (key !== 'error') {
          logData[key] = value;
        }
      });
    } else {
      Object.assign(logData, context);
    }
  }

  console.log(JSON.stringify(logData));
}

/**
 * Logger instance
 */
export const logger = {
  debug(message: string, context?: LogContext): void {
    formatLog('DEBUG', message, context);
  },

  info(message: string, context?: LogContext): void {
    formatLog('INFO', message, context);
  },

  warn(message: string, context?: LogContext): void {
    formatLog('WARN', message, context);
  },

  error(message: string, context?: LogContext): void {
    formatLog('ERROR', message, context);
  },

  /**
   * Extract error message from unknown error object
   * Useful for re-throwing errors with context
   */
  extractMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return String(error);
  }
};
