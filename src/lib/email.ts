import "dotenv/config";
import { Resend } from "resend";
import { INSTITUTE_NAME } from "@/lib/institute";
import { getAppUrl } from "@/lib/app-url";

const senderName = process.env.EMAIL_SENDER_NAME || INSTITUTE_NAME;
const senderAddress =
  process.env.EMAIL_SENDER_ADDRESS || "onboarding@resend.dev";

const getResend = () => {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.length < 20 || key.includes("xxx")) {
    throw new Error(
      "Email sending is not configured. Add a real RESEND_API_KEY to .env before sending credentials.",
    );
  }
  return new Resend(key);
};

export const isEmailConfigured = () => {
  const key = process.env.RESEND_API_KEY;
  return Boolean(key && key.length >= 20 && !key.includes("xxx"));
};

/**
 * `onboarding@resend.dev` is Resend's free testing sender. It works without a
 * custom domain, but Resend only delivers it to the account owner's own inbox —
 * every other recipient is rejected by the API.
 */
export const isTestSenderDomain = () => senderAddress.includes("resend.dev");

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

type SendResult = { ok: true } | { ok: false; error: string };

const send = async (params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> => {
  const resend = getResend();
  try {
    const { error } = await resend.emails.send({
      from: `${senderName} <${senderAddress}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (error) {
      return { ok: false, error: error.message || "Unknown Resend error" };
    }
    return { ok: true };
  } catch (err) {
    const e = err as Error;
    return { ok: false, error: e.message || "Unknown email error" };
  }
};

export const sendCredentialsEmail = async (params: {
  to: string;
  name: string;
  email: string;
  temporaryPassword: string;
}): Promise<SendResult> => {
  const appUrl = getAppUrl();
  const setPasswordUrl = `${appUrl}/set-password?email=${encodeURIComponent(
    params.email,
  )}`;
  const logoUrl = `${appUrl}/logo.png`;
  const institute = escapeHtml(INSTITUTE_NAME);
  const name = escapeHtml(params.name || params.email);
  const email = escapeHtml(params.email);
  const password = escapeHtml(params.temporaryPassword);

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1b1f;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f4;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <tr>
              <td style="padding:32px 32px 8px;text-align:center;">
                <img src="${logoUrl}" alt="${institute}" width="72" height="72" style="display:block;margin:0 auto;border-radius:16px;" />
                <div style="margin-top:12px;font-size:18px;font-weight:800;letter-spacing:-0.02em;">${institute}</div>
                <div style="margin-top:2px;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#79747e;">Student Portal</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0;">
                <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;letter-spacing:-0.02em;">Your login details are ready</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#49454f;">Hi ${name}, your student portal account has been created. Use the temporary password below to sign in, then choose a password of your own.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f0f4;border-radius:16px;border:1px solid #e5e1e6;">
                  <tr>
                    <td style="padding:16px 20px;border-bottom:1px solid #e5e1e6;">
                      <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#79747e;">Email address</div>
                      <div style="margin-top:4px;font-size:16px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${email}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px 20px;">
                      <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#79747e;">Temporary password</div>
                      <div style="margin-top:4px;font-size:16px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${password}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 0;">
                <a href="${setPasswordUrl}" style="display:block;padding:16px 24px;background-color:#1c1b1f;color:#ffffff;text-decoration:none;border-radius:14px;font-size:15px;font-weight:800;text-align:center;">Set your password</a>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0;">
                <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#79747e;">How to get started</div>
                <ol style="margin:12px 0 0;padding-left:20px;font-size:14px;line-height:1.8;color:#49454f;">
                  <li>Open the button above.</li>
                  <li>Enter your email and the temporary password shown here.</li>
                  <li>Create your own password &mdash; you will use it from now on.</li>
                </ol>
                <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#49454f;">Prefer to sign in the normal way? Just log in at <a href="${appUrl}/login" style="color:#1c1b1f;font-weight:700;">${escapeHtml(appUrl)}/login</a> with the details above and you will be taken straight to the screen where you set your own password.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 32px;">
                <div style="border-top:1px solid #e5e1e6;padding-top:20px;font-size:12px;line-height:1.6;color:#79747e;">
                  Keep this email private &mdash; anyone with these details can access your account until you set your own password. If you were not expecting this email, you can safely ignore it.
                </div>
              </td>
            </tr>
          </table>
          <div style="margin-top:20px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#a8a29e;">${institute} &middot; Student Portal</div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `Your ${INSTITUTE_NAME} student portal login details

Email address: ${params.email}
Temporary password: ${params.temporaryPassword}

Set your password:
${setPasswordUrl}

How to get started
1. Open the link above.
2. Enter your email and the temporary password shown here.
3. Create your own password - you will use it from now on.

Prefer to sign in the normal way? Log in at ${appUrl}/login with the
details above and you will be taken straight to the screen where you set
your own password.

Keep this email private - anyone with these details can access your account
until you set your own password. If you were not expecting this email, you
can safely ignore it.`;

  return send({
    to: params.to,
    subject: `Your ${INSTITUTE_NAME} student portal login details`,
    html,
    text,
  });
};
