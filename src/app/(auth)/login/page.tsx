import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/forms/login-form";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your Institute Management System account.",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background text-foreground p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link
          className="flex items-center gap-2 self-center font-medium"
          href="/"
        >
          <div className="flex size-6 items-center justify-center rounded-md">
            <Image
              alt="Logo"
              height={50}
              priority
              src={"/logo.png"}
              width={50}
              style={{ width: "auto", height: "auto" }}
            />
          </div>
          Institute Management System
        </Link>
        <LoginForm />
      </div>
    </div>
  );
}
