"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, KeyRound, Loader2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { completePasswordSetup, setOwnPassword, startPasswordSetup } from "@/server/credentials";

const verifySchema = z.object({
  email: z.string().email("Enter the email address from your email"),
  password: z.string().min(1, "Enter the temporary password"),
});

const passwordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(128, "That password is too long"),
    confirmPassword: z.string().min(1, "Re-enter your new password"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "The two passwords do not match",
    path: ["confirmPassword"],
  });

const requirements = [
  "At least 8 characters",
  "Something only you would pick",
  "Not the temporary password",
];

export function SetPasswordForm({
  className,
  initialEmail = "",
  ...props
}: React.ComponentProps<"div"> & { initialEmail?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"verify" | "set">("verify");
  const [token, setToken] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);

  const verifyForm = useForm<z.infer<typeof verifySchema>>({
    resolver: zodResolver(verifySchema),
    defaultValues: { email: initialEmail, password: "" },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    let active = true;
    authClient.getSession().then(({ data }) => {
      if (!active) return;
      // Only skip the verification step when this session is one that still owes
      // a password change; any other signed-in visitor keeps the normal form.
      if (data?.user?.mustChangePassword) {
        setStep("set");
        verifyForm.setValue("email", data.user.email ?? initialEmail);
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = async (values: z.infer<typeof verifySchema>) => {
    setVerifying(true);
    const result = await startPasswordSetup(values);

    if (result.success) {
      setToken(result.token);
      setStep("set");
      toast.success("Verified. Now choose your password.");
    } else {
      toast.error(result.message);
    }
    setVerifying(false);
  };

  const handleSetPassword = async (values: z.infer<typeof passwordSchema>) => {
    setSaving(true);

    if (!token) {
      const result = await setOwnPassword(values.newPassword);
      if (!result.success) {
        toast.error(result.message);
        if (/session expired/i.test(result.message)) router.push("/login");
        setSaving(false);
        return;
      }
      toast.success("Your password has been set.");
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const result = await completePasswordSetup({
      token,
      newPassword: values.newPassword,
    });

    if (result.success) {
      toast.success("Your password has been set. Sign in to continue.");
      const email = verifyForm.getValues("email");
      router.push(
        email ? `/login?email=${encodeURIComponent(email)}` : "/login",
      );
    } else {
      toast.error(result.message);
      if (/expired|start again/i.test(result.message)) {
        setToken(null);
        setStep("verify");
      }
    }
    setSaving(false);
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border border-border bg-card text-card-foreground">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="size-6" />
          </div>
          <CardTitle className="text-xl font-black uppercase tracking-tight">
            {step === "verify" ? "Confirm your details" : "Create your password"}
          </CardTitle>
          <CardDescription>
            {step === "verify"
              ? "Enter the email address and temporary password from the email we sent you."
              : "Pick a password you will remember. You will use it every time you sign in."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="mb-6 flex items-center gap-3">
            <StepPill label="Confirm" active={step === "verify"} done={step === "set"} />
            <div className="h-px flex-1 bg-border" />
            <StepPill label="Set password" active={step === "set"} done={false} />
          </div>

          {step === "verify" ? (
            <Form {...verifyForm}>
              <form
                className="space-y-5"
                onSubmit={verifyForm.handleSubmit(handleVerify)}
              >
                <FormField
                  control={verifyForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            className="pl-9"
                            placeholder="you@example.com"
                            type="email"
                            autoComplete="email"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={verifyForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temporary password</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="From your email"
                          type="password"
                          autoComplete="current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  className="w-full py-4 text-sm"
                  disabled={verifying}
                  type="submit"
                >
                  {verifying ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </form>
            </Form>
          ) : (
            <Form {...passwordForm}>
              <form
                className="space-y-5"
                onSubmit={passwordForm.handleSubmit(handleSetPassword)}
              >
                <ul className="space-y-2 rounded-2xl bg-muted/50 p-4">
                  {requirements.map((requirement) => (
                    <li
                      key={requirement}
                      className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
                    >
                      <Check className="size-3.5 text-primary" />
                      {requirement}
                    </li>
                  ))}
                </ul>

                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="********"
                          type="password"
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm new password</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="********"
                          type="password"
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  className="w-full py-4 text-sm"
                  disabled={saving}
                  type="submit"
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Save password & continue"
                  )}
                </Button>

                <Button
                  className="w-full text-xs"
                  type="button"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => {
                    setToken(null);
                    setStep("verify");
                  }}
                >
                  Back
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StepPill({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : done
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground",
      )}
    >
      {done && <Check className="size-3" />}
      {label}
    </div>
  );
}
