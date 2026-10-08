/** Runs once per server start. Only the Node.js server schedules the daily database backup. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const { scheduleDailyBackup } = await import("./server/backup");
  scheduleDailyBackup();
}
