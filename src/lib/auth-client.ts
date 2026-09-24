import { organizationClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { admin, student } from "@/lib/auth/permissions";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined"
      ? window.location.origin
      : process.env.BETTER_AUTH_URL),
  plugins: [
    organizationClient({ roles: { admin, student } }),
    inferAdditionalFields<typeof auth>(),
  ],
});