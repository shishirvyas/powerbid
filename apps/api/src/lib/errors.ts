/**
 * Typed HTTP errors. Throw these from anywhere; the global errorHandler
 * formats them consistently.
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new HttpError(400, msg, "bad_request", details);
export const unauthorized = (msg = "Unauthorized") => new HttpError(401, msg, "unauthorized");
export const forbidden = (msg = "Forbidden") => new HttpError(403, msg, "forbidden");
export const notFound = (msg = "Not found") => new HttpError(404, msg, "not_found");
export const conflict = (msg: string) => new HttpError(409, msg, "conflict");
