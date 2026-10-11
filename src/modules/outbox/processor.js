export function createOutboxProcessor({ outbox, transaction, handlers, backoffMs = 500, maxAttempts = 8, leaseMs = 30000 }) {
  return {
    processBatch({ now = new Date(), limit = 25 } = {}) {
      const nowIso = now.toISOString();
      let processed = 0;
      for (let index = 0; index < limit; index += 1) {
        const row = outbox.claim(nowIso, new Date(now.getTime() + leaseMs).toISOString());
        if (!row) break;
        try {
          const payload = JSON.parse(row.payload);
          transaction(() => {
            const handler = handlers[row.type];
            if (!handler) throw new Error(`Tipo de evento sin manejador: ${row.type}`);
            handler(payload, row);
            outbox.markProcessed(row.id, nowIso);
          });
          processed += 1;
        } catch (error) {
          const delay = Math.min(backoffMs * 2 ** (row.attempts - 1), 300000);
          outbox.fail(row.id, {
            status: row.attempts >= maxAttempts ? 'dead' : 'pending',
            nextAttemptAt: new Date(now.getTime() + delay).toISOString(),
            error: String(error.message ?? error).slice(0, 500)
          });
        }
      }
      return processed;
    }
  };
}
