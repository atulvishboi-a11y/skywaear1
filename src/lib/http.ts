import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfterSeconds?: number
  ) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function fail(error: unknown): NextResponse {
  const requestId = randomUUID();

  if (error instanceof HttpError) {
    if (error.status >= 500 || error.status === 429) {
      logStructured(error.status >= 500 ? "error" : "warn", {
        requestId,
        status: error.status,
        message: error.message,
      });
    }
    const response = NextResponse.json(
      { error: error.message, requestId },
      { status: error.status }
    );
    response.headers.set("x-request-id", requestId);
    if (error.retryAfterSeconds) {
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
    }
    return response;
  }

  logStructured("error", {
    requestId,
    status: 500,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  const response = NextResponse.json(
    { error: "Internal server error", requestId },
    { status: 500 }
  );
  response.headers.set("x-request-id", requestId);
  return response;
}

function logStructured(level: "warn" | "error", payload: Record<string, unknown>): void {
  const line = JSON.stringify({ level, scope: "api", ...payload, timestamp: new Date().toISOString() });
  if (level === "error") console.error(line);
  else console.warn(line);
}

export async function readBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

export function requireFields<T extends object>(body: T, fields: (keyof T)[]): void {
  const values = body as Record<string, unknown>;
  const missing = fields.filter((field) => {
    const value = values[String(field)];
    return value === undefined || value === null || value === "";
  });
  if (missing.length > 0) {
    throw new HttpError(422, `Missing required field(s): ${missing.join(", ")}`);
  }
}
