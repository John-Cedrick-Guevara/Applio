/**
 * Base for every error Applio raises on purpose. `message` is operator-readable;
 * `code` lets callers branch without parsing text.
 */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}
