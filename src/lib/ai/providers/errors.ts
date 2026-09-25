export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code: ProviderErrorCode,
    public readonly provider: string,
    public readonly recoverable: boolean = false,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export type ProviderErrorCode =
  | "TIMEOUT"
  | "AUTHENTICATION_ERROR"
  | "RATE_LIMIT"
  | "UNAVAILABLE"
  | "INVALID_REQUEST"
  | "UNSUPPORTED_CAPABILITY"
  | "INVALID_RESPONSE"
  | "STREAM_ERROR"
  | "INTERNAL_ERROR";

export function isRetryableError(error: ProviderError): boolean {
  return (
    error.recoverable &&
    (error.code === "TIMEOUT" ||
      error.code === "UNAVAILABLE" ||
      error.code === "RATE_LIMIT" ||
      error.code === "STREAM_ERROR")
  );
}

export function mapHttpErrorToProviderError(
  status: number,
  provider: string,
  details?: Record<string, unknown>,
): ProviderError {
  switch (status) {
    case 400:
      return new ProviderError("Invalid request", "INVALID_REQUEST", provider, false, details);
    case 401:
      return new ProviderError(
        "Authentication failed",
        "AUTHENTICATION_ERROR",
        provider,
        false,
        details,
      );
    case 429:
      return new ProviderError("Rate limit exceeded", "RATE_LIMIT", provider, true, details);
    case 500:
    case 502:
    case 503:
    case 504:
      return new ProviderError("Provider unavailable", "UNAVAILABLE", provider, true, details);
    default:
      return new ProviderError(
        `HTTP ${status}`,
        "INVALID_RESPONSE",
        provider,
        status >= 500,
        details,
      );
  }
}
