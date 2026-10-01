// Only allow known operational codes. Never serialize error messages, stacks,
// causes, SQL, SMTP responses, request bodies, URLs or arbitrary metadata.
const SAFE_CODES = new Set([
  "P2002", "P2003", "P2025", "P2024", "P2034", "P1001", "P1002",
  "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAUTH",
  "ESOCKET", "EENVELOPE", "EMESSAGE", "MissingSecret", "CredentialsSignin",
  "SMTP_CONFIG_MISSING", "SMTP_CONFIG_INVALID", "EDNS", "ETLS",
]);

export function logServerError(context: string, error?: unknown) {
  const candidate = error && typeof error === "object" && "code" in error
    ? error.code : undefined;
  const code = typeof candidate === "string" && SAFE_CODES.has(candidate)
    ? candidate : "INTERNAL_ERROR";
  console.error(context, { code });
}
