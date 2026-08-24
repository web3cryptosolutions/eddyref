const REDACTED = "[REDACTED]";

function secretValues(): string[] {
  return [process.env.TELEGRAM_BOT_TOKEN, process.env.BOT_API_SECRET, process.env.WEBHOOK_SECRET]
    .filter((value): value is string => Boolean(value && value.trim()))
    .sort((a, b) => b.length - a.length);
}

export function redact(value: string): string {
  let output = value
    .replace(/Bearer\s+\S+/gi, `Bearer ${REDACTED}`)
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, `bot${REDACTED}`)
    .replace(/authorization["']?\s*[:=]\s*["']?[^,\s"']+/gi, `Authorization: ${REDACTED}`);

  for (const secret of secretValues()) {
    output = output.split(secret).join(REDACTED);
  }

  return output;
}

function serializeUnknown(error: unknown): string {
  if (error instanceof Error) {
    return redact(`${error.name}: ${error.message}`);
  }
  if (typeof error === "string") {
    return redact(error);
  }
  try {
    return redact(JSON.stringify(error));
  } catch {
    return "Unserializable error";
  }
}

function write(level: "info" | "warn" | "error", message: string, extra?: unknown): void {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} [${level.toUpperCase()}] ${redact(message)}`;
  const payload = extra === undefined ? line : `${line} ${serializeUnknown(extra)}`;

  if (level === "error") {
    console.error(payload);
    return;
  }
  if (level === "warn") {
    console.warn(payload);
    return;
  }
  console.log(payload);
}

export const logger = {
  info(message: string, extra?: unknown): void {
    write("info", message, extra);
  },
  warn(message: string, extra?: unknown): void {
    write("warn", message, extra);
  },
  error(message: string, extra?: unknown): void {
    write("error", message, extra);
  },
};
