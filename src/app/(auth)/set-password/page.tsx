import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SetPasswordForm } from "@/components/forms/set-password-form";
import { INSTITUTE_NAME } from "@/lib/institute";

export const metadata: Metadata = {
  title: "Set your password",
  description: "Confirm your login details and create your own portal password.",
};

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 text-foreground md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link
          className="flex items-center gap-2 self-center font-medium"
          href="/login"
        >
          <div className="flex size-6 items-center justify-center rounded-md">
            <Image
              alt={`${INSTITUTE_NAME} logo`}
              height={50}
              priority
              src="/logo.png"
              width={50}
              style={{ width: "auto", height: "auto" }}
            />
          </div>
          {INSTITUTE_NAME}
        </Link>

        <SetPasswordForm initialEmail={email ?? ""} />

        <p className="text-center text-xs text-muted-foreground">
          Already set your password?{" "}
          <Link className="font-semibold underline" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
