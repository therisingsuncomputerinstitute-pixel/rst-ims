import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/forms/login-form";
import { INSTITUTE_NAME } from "@/lib/institute";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your Institute Management System account.",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background text-foreground p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link
          className="flex flex-col items-center gap-2 self-center text-center"
          href="/"
        >
          <Image
            alt={`${INSTITUTE_NAME} logo`}
            height={64}
            priority
            src="/logo.png"
            width={64}
            className="size-16 object-contain"
          />
          <span className="text-sm font-black uppercase tracking-tighter">
            {INSTITUTE_NAME}
          </span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
            Student Portal
          </span>
        </Link>
        <LoginForm />
      </div>
    </div>
  );
}
