/**
 * Logger interface that any logger implementation can conform to
 * Compatible with popular loggers like pino, winston, bunyan, etc.
 */
export interface ILogger {
  info(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  log?(message: string, ...args: unknown[]): void;
}

/**
 * Default console logger implementation with color support
 * Used when no custom logger is provided
 */
export class ConsoleLogger implements ILogger {
  private readonly colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
  };

  info(message: string, ...args: unknown[]): void {
    console.info(this.colors.cyan, message, ...args, this.colors.reset);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(this.colors.red, message, ...args, this.colors.reset);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(this.colors.yellow, message, ...args, this.colors.reset);
  }

  debug(message: string, ...args: unknown[]): void {
    console.debug(this.colors.magenta, message, ...args, this.colors.reset);
  }

  log(message: string, ...args: unknown[]): void {
    console.log(this.colors.cyan, message, ...args, this.colors.reset);
  }
}

/**
 * Silent logger that does nothing
 * Used when logging is disabled
 */
export class SilentLogger implements ILogger {
  info(): void {}
  error(): void {}
  warn(): void {}
  debug(): void {}
  log(): void {}
}

/**
 * Factory function to create a logger
 * Returns SilentLogger if logging is disabled, otherwise returns the provided logger or ConsoleLogger
 */
export function createLogger(
  options: { enabled?: boolean; logger?: ILogger } = {}
): ILogger {
  const { enabled = false, logger } = options;

  if (!enabled) {
    return new SilentLogger();
  }

  return logger || new ConsoleLogger();
}
