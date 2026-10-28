import { db } from "./src/db/drizzle";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Applying schema additions...");
  await db.execute(sql`
    ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP;
    ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS pause_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS warning_limit INTEGER NOT NULL DEFAULT 3;
    ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS current_violations INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS terminated_by_admin BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE assignment_attachments ADD COLUMN IF NOT EXISTS published_to_students BOOLEAN NOT NULL DEFAULT false;
  `);
  console.log("Schema additions applied successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
