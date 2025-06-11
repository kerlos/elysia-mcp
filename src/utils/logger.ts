export class Logger {
  private enableLogging;

  constructor(enableLogging = false) {
    this.enableLogging = enableLogging;
  }

  log(...args: unknown[]): void {
    if (this.enableLogging) {
      console.log(...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.enableLogging) {
      console.error(...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.enableLogging) {
      console.warn(...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.enableLogging) {
      console.info(...args);
    }
  }

  debug(...args: unknown[]): void {
    if (this.enableLogging) {
      console.debug(...args);
    }
  }
}
