function integer(env, name, fallback, min, max) {
  const raw = env[name];
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} debe ser un entero entre ${min} y ${max}.`);
  }
  return value;
}

export function loadConfig(env = process.env) {
  const port = integer(env, 'PORT', 3000, 1, 65535);
  const host = env.HOST || '127.0.0.1';
  if (typeof host !== 'string' || host.length < 1 || host.length > 255) throw new Error('HOST no es válido.');
  return {
    port,
    host,
    databasePath: env.DATABASE_PATH || './data/eventia.sqlite',
    cookieSecure: env.COOKIE_SECURE === 'true',
    allowedOrigins: env.APP_ORIGIN ? [env.APP_ORIGIN] : [],
    catalogCacheTtlMs: integer(env, 'CATALOG_CACHE_TTL_MS', 2000, 0, 60000),
    registrationRateLimit: integer(env, 'REGISTRATION_RATE_LIMIT', 20, 1, 10000),
    registrationRateWindowMs: integer(env, 'REGISTRATION_RATE_WINDOW_MS', 60000, 1000, 3600000),
    admissionLimit: integer(env, 'ADMISSION_LIMIT', 16, 0, 10000),
    admissionRetryAfterSeconds: integer(env, 'ADMISSION_RETRY_AFTER', 2, 1, 120),
    outboxPollMs: integer(env, 'OUTBOX_POLL_MS', 400, 50, 60000),
    outboxBackoffMs: integer(env, 'OUTBOX_BACKOFF_MS', 500, 1, 300000),
    outboxMaxAttempts: integer(env, 'OUTBOX_MAX_ATTEMPTS', 8, 1, 100),
    outboxLeaseMs: integer(env, 'OUTBOX_LEASE_MS', 30000, 1, 300000)
  };
}
