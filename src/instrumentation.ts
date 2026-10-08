/** Runs once per server start (Node.js server, production only). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const [{ scheduleDailyBackup }, { probeStorage }, { log }] = await Promise.all([import("./server/backup"), import("./server/storage"), import("./server/log")]);
  scheduleDailyBackup();
  const s = await probeStorage();
  if (s.ok) log.info(`storage: ${s.driver} ok`);
  else log.error(`storage: ${s.driver} FAILED`, { error: s.error });
}
