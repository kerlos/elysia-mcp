export class Logger {
  private enableLogging;
  private readonly colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
  };

  constructor(enableLogging = false) {
    this.enableLogging = enableLogging;
  }

  log(...args: unknown[]): void {
    if (this.enableLogging) {
      console.log(this.colors.cyan, ...args, this.colors.reset);
    }
  }

  error(...args: unknown[]): void {
    if (this.enableLogging) {
      console.error(this.colors.red, ...args, this.colors.reset);
    }
  }

  warn(...args: unknown[]): void {
    if (this.enableLogging) {
      console.warn(this.colors.yellow, ...args, this.colors.reset);
    }
  }

  info(...args: unknown[]): void {
    if (this.enableLogging) {
      console.info(this.colors.blue, ...args, this.colors.reset);
    }
  }

  debug(...args: unknown[]): void {
    if (this.enableLogging) {
      console.debug(this.colors.magenta, ...args, this.colors.reset);
    }
  }
}
