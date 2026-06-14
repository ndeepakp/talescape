import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

// A logged-in session (never null). Derived from better-auth's own return type so
// it stays in sync if the auth config changes.
export type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

/**
 * An error a route can throw to return a specific HTTP status + message.
 * `withErrors` turns it into a clean JSON response; anything else becomes a 500.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Get the current session or throw a 401. Use at the top of protected routes. */
export async function requireSession(): Promise<Session> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new ApiError(401, "You must be signed in.");
  return session;
}

type RouteHandler<A extends unknown[]> = (...args: A) => Promise<Response>;

/**
 * Wraps a route handler so thrown errors become tidy JSON responses instead of
 * raw 500s. `ApiError` keeps its status/message; everything else is logged and
 * returned as a generic 500 (so we never leak internals to the client).
 */
export function withErrors<A extends unknown[]>(
  handler: RouteHandler<A>,
): RouteHandler<A> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      console.error("Unhandled route error:", err);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 },
      );
    }
  };
}
