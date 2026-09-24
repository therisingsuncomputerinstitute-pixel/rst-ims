import "dotenv/config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { Resend } from "resend";
import { db } from "@/db/drizzle";
import { schema } from "@/db/schema";
import { getActiveOrganization } from "@/server/organizations";
import { getActiveWorkspace } from "@/server/workspaces";
import { ac, admin, student } from "./auth/permissions";

const resend = new Resend(process.env.RESEND_API_KEY as string);
const senderName = process.env.EMAIL_SENDER_NAME || "WordingsAI";
const senderAddress =
  process.env.EMAIL_SENDER_ADDRESS || "onboarding@resend.dev";

const getBaseURL = () => {
  if (process.env.BETTER_AUTH_URL) {
    return process.env.BETTER_AUTH_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
};

export const auth = betterAuth({
  baseURL: getBaseURL(),
  secret: process.env.BETTER_AUTH_SECRET,
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "student",
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  session: {
    additionalFields: {
      activeWorkspaceId: {
        type: "string",
      },
      activeOrganizationId: {
        type: "string",
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const activeOrganization = await getActiveOrganization(
            session.userId,
          );
          let activeWorkspace = null;
          if (activeOrganization) {
            activeWorkspace = await getActiveWorkspace(
              session.userId,
              activeOrganization.id,
            );
          }
          return {
            data: {
              ...session,
              activeOrganizationId: activeOrganization?.id,
              activeOrganizationPlan: activeOrganization?.plan,
              activeWorkspaceId: activeWorkspace?.id,
            },
          };
        },
      },
      findMany: {
        after: async (sessions: any[]) => {
          // Refresh plan for each session to ensure it's up-to-date with database
          const updated = await Promise.all(
            sessions.map(async (session: any) => {
              const activeOrganization = await getActiveOrganization(
                session.userId,
                session.activeOrganizationId,
              );
              const activeWorkspace = activeOrganization
                ? await getActiveWorkspace(
                    session.userId,
                    activeOrganization.id,
                    session.activeWorkspaceId,
                  )
                : null;
              return {
                ...session,
                activeOrganizationId: activeOrganization?.id,
                activeOrganizationPlan: activeOrganization?.plan,
                activeWorkspaceId: activeWorkspace?.id,
              };
            }),
          );
          return updated;
        },
      },
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  plugins: [
    organization({
      ac: ac,
      creatorRole: "admin",
      roles: {
        admin,
        student,
      },
      sendInvitationEmail: async (data) => {
        try {
          const { invitation, organization, inviter } = data;
          const { error } = await resend.emails.send({
            from: `${senderName} <${senderAddress}>`,
            to: invitation.email,
            subject: `You've been invited to join ${organization.name} on WordingsAI`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Welcome to WordingsAI!</h2>
                <p>${inviter.user.name} has invited you to join their organization: <strong>${organization.name}</strong>.</p>
                <p>Click the link below to accept the invitation:</p>
                <a href="${process.env.BETTER_AUTH_URL}/accept-invitation/${invitation.id}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">Accept Invitation</a>
                <p style="color: #666; margin-top: 20px;">This invitation expires in 7 days.</p>
              </div>
            `,
          });

          if (error) {
            console.error("Resend Error (Invitation Email):", error);
          }
        } catch (err) {
          console.error("Failed to send invitation email:", err);
        }
      },
    }),
    // Must be last: forwards Set-Cookie to Next.js (see better-auth docs).
    nextCookies(),
  ],
});