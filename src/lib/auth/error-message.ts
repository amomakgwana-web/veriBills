/**
 * Turn whatever comes back from a Supabase auth call into a message safe to
 * show a user.
 *
 * Supabase normally returns a clean `AuthError` with a readable `.message`.
 * But if the request itself fails before it gets that far — the response
 * wasn't JSON, the connection was blocked, the client threw instead of
 * returning `{ error }` — what lands here can be a raw parser error or an
 * empty object. Never forward that verbatim: log the real thing server-side
 * (visible in the platform's runtime logs) and show a fixed, actionable
 * message instead.
 */
export function authErrorMessage(error: unknown, context: string): string {
  const raw = extractMessage(error);

  if (raw && !looksMalformed(raw)) {
    return raw;
  }

  console.error(`[auth:${context}] unexpected error shape`, error);
  return "Something went wrong talking to the sign-in service. Please try again in a moment.";
}

function extractMessage(error: unknown): string | null {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) return message;
  }
  return null;
}

/** Catches JSON parse errors and empty-object fallbacks leaking through as the message. */
function looksMalformed(message: string): boolean {
  const trimmed = message.trim();
  return (
    trimmed === "{}" ||
    trimmed === "" ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("<") ||
    /unexpected token|is not valid json|failed to fetch|networkerror/i.test(trimmed)
  );
}
