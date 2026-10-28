import { db } from "./src/db/drizzle";
import { maintenanceMode } from "./src/db/schema";
import { eq } from "drizzle-orm";

/**
 * Maintenance mode toggle script.
 *
 *   npx tsx maintenance-toggle.ts --on          -> enable maintenance
 *   npx tsx maintenance-toggle.ts --off          -> resume the portal
 *   npx tsx maintenance-toggle.ts --on --message "Upgrading the database"
 *
 * Writes the flag to the `maintenance_mode` table; the portal reads it via
 * /api/maintenance/status and redirects protected routes to /maintenance.
 */
async function main() {
  const args = process.argv.slice(2);
  const offIdx = args.indexOf("--off");
  const onIdx = args.indexOf("--on");
  const messageIdx = args.indexOf("--message");
  const message =
    messageIdx !== -1 && args[messageIdx + 1] ? args[messageIdx + 1] : null;

  let enabled: boolean;
  if (offIdx !== -1) enabled = false;
  else if (onIdx !== -1) enabled = true;
  else enabled = args.length > 0;

  const rows = await db.select().from(maintenanceMode).limit(1);
  const existing = rows[0];

  if (existing) {
    await db
      .update(maintenanceMode)
      .set({ enabled, message, updatedAt: new Date() })
      .where(eq(maintenanceMode.id, true));
  } else {
    await db.insert(maintenanceMode).values({
      id: true,
      enabled,
      message,
      updatedAt: new Date(),
    });
  }

  console.log(`Maintenance mode ${enabled ? "ENABLED" : "RESUMED"}.${message ? ` Message: ${message}` : ""}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Maintenance toggle failed:", err);
  process.exit(1);
});
