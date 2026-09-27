export type StudentEntry = { email: string; name: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanName = (value: string) =>
  value
    .replace(/[<>]/g, " ")
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const nameFromEmail = (email: string) => {
  const local = email.split("@")[0] ?? "";
  return cleanName(
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  );
};

/**
 * Accepts the messy shapes a pasted student list comes in:
 *   ali@x.com
 *   Ali Khan <ali@x.com>
 *   Ali Khan, ali@x.com
 *   ali@x.com, Ali Khan
 *   Ali Khan <ali@x.com>   ali2@x.com
 */
export const parseStudentList = (raw: string): StudentEntry[] => {
  const entries: StudentEntry[] = [];
  const seen = new Set<string>();

  const push = (email: string, name?: string) => {
    const normalized = email.trim().toLowerCase().replace(/^mailto:/, "");
    if (!EMAIL_RE.test(normalized)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    entries.push({ email: normalized, name: cleanName(name ?? "") });
  };

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const angled = line.match(/^(.*?)<([^>]+)>\s*(.*)$/);
    if (angled) {
      const [, before, email, after] = angled;
      const rest = `${before} ${after}`;
      const restEmails = rest.match(/[^\s,;]+@[^\s,;]+\.[^\s,;]+/g) ?? [];
      const restName = cleanName(
        rest.replace(/[^\s,;]+@[^\s,;]+\.[^\s,;]+/g, " "),
      );
      push(email, restName);
      for (const restEmail of restEmails) {
        push(restEmail, restName);
      }
      continue;
    }

    const tokens = line.split(/[,;\t]+|\s{2,}/).map((t) => t.trim()).filter(Boolean);
    const emails = tokens.filter((t) => EMAIL_RE.test(t.replace(/^mailto:/, "")));
    const names = tokens.filter((t) => !EMAIL_RE.test(t.replace(/^mailto:/, "")));

    if (emails.length === 0) {
      const loose = line.match(/[^\s,;]+@[^\s,;]+\.[^\s,;]+/);
      if (loose) push(loose[0]);
      continue;
    }

    const sharedName = cleanName(names.join(" "));
    for (const email of emails) {
      push(email, sharedName);
    }
  }

  return entries;
};
