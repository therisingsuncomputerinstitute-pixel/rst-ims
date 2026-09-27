"use client";

import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  GraduationCap,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";
import { parseStudentList } from "@/lib/student-list";
import {
  emailCredentialsToAllStudents,
  emailCredentialsToUser,
  enrollStudents,
  getEmailDeliveryStatus,
} from "@/server/credentials";
import {
  createAccount,
  listAccounts,
  removeAccount,
  updateAccountRole,
} from "@/server/users";

type Account = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
};

type IssuedCredential = { email: string; name: string; password: string };

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["student", "admin"]),
});

export default function UsersPage() {
  const { data: session } = authClient.useSession();
  const router = useRouter();

  const isAdmin = session?.user?.role === "admin";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "admin">("student");

  const [studentList, setStudentList] = React.useState("");
  const [sharedPassword, setSharedPassword] = React.useState("");
  const [useSharedPassword, setUseSharedPassword] = React.useState(false);
  const [sendEmail, setSendEmail] = React.useState(false);
  const [enrolling, setEnrolling] = React.useState(false);
  const [emailingAll, setEmailingAll] = React.useState(false);
  const [emailReady, setEmailReady] = React.useState<boolean | null>(null);
  const [testSenderOnly, setTestSenderOnly] = React.useState(false);
  const [issued, setIssued] = React.useState<IssuedCredential[]>([]);

  const parsedStudents = React.useMemo(
    () => parseStudentList(studentList),
    [studentList],
  );

  const existingEmails = React.useMemo(
    () => new Set(accounts.map((a) => a.email.toLowerCase())),
    [accounts],
  );

  const newStudents = React.useMemo(
    () => parsedStudents.filter((s) => !existingEmails.has(s.email)),
    [parsedStudents, existingEmails],
  );

  const loadAccounts = React.useCallback(async () => {
    const data = await listAccounts();
    setAccounts(data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (isAdmin) {
      loadAccounts();
      getEmailDeliveryStatus().then((status) => {
        setEmailReady(status.configured);
        setTestSenderOnly(status.testSenderOnly);
      });
    } else {
      setLoading(false);
    }
  }, [isAdmin, loadAccounts]);

  if (!isAdmin) {
    return (
      <div className="p-10 text-center text-muted-foreground font-bold uppercase tracking-widest text-sm">
        You do not have permission to view this page.
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = formSchema.safeParse({ name, email, password, role });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setCreating(true);
    const result = await createAccount(parsed.data);
    if (result.success) {
      toast.success(result.message as string);
      setName("");
      setEmail("");
      setPassword("");
      setRole("student");
      loadAccounts();
      router.refresh();
    } else {
      toast.error(result.message as string);
    }
    setCreating(false);
  };

  const handleRoleChange = async (userId: string, newRole: "student" | "admin") => {
    setActing(userId);
    const result = await updateAccountRole(userId, newRole);
    if (result.success) {
      toast.success(result.message as string);
      loadAccounts();
    } else {
      toast.error(result.message as string);
    }
    setActing(null);
  };

  const handleRemove = async (userId: string, displayName: string) => {
    if (!window.confirm(`Delete the account for ${displayName}? This cannot be undone.`)) {
      return;
    }
    setActing(userId);
    const result = await removeAccount(userId);
    if (result.success) {
      toast.success(result.message as string);
      loadAccounts();
      router.refresh();
    } else {
      toast.error(result.message as string);
    }
    setActing(null);
  };

  const handleEnroll = async () => {
    if (parsedStudents.length === 0) {
      toast.error("Paste at least one email address first.");
      return;
    }
    if (sendEmail && emailReady === false) {
      toast.error("Set a real RESEND_API_KEY in .env first, or untick emailing.");
      return;
    }

    const count = newStudents.length;
    if (
      !window.confirm(
        `Enroll ${newStudents.length} new student${
          newStudents.length === 1 ? "" : "s"
        }` +
          (count < parsedStudents.length
            ? `\n\n${parsedStudents.length - count} already have an account and will be skipped.`
            : "") +
          (sendEmail
            ? "\n\nEach one gets an email with their own temporary password."
            : "\n\nPasswords will be shown so you can hand them out yourself."),
      )
    ) {
      return;
    }

    setEnrolling(true);
    const result = await enrollStudents({
      list: studentList,
      sharedPassword: useSharedPassword ? sharedPassword : undefined,
      sendEmail,
    });
    setEnrolling(false);

    if (result.success) {
      toast.success(result.message, { duration: 6000 });
    } else {
      toast.warning(result.message, { duration: 8000 });
    }

    if (result.skipped?.length) {
      toast.error(
        result.skipped.map((s) => `${s.email}: ${s.reason}`).join(" · "),
        { duration: 10000 },
      );
    }

    if (result.credentials?.length) {
      setIssued(result.credentials);
    }

    if (result.created > 0 || result.emailed > 0) {
      setStudentList("");
      setSharedPassword("");
      loadAccounts();
      router.refresh();
    }
  };

  const copyIssued = async () => {
    const text = issued
      .map((c) => `${c.email}\t${c.password}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied. Paste into a spreadsheet or send to each student.");
    } catch {
      toast.error("Could not copy — select the text and copy manually.");
    }
  };

  const handleEmailAll = async () => {
    if (emailReady === false) {
      toast.error("Set a real RESEND_API_KEY in .env first.");
      return;
    }
    if (
      !window.confirm(
        "Send a fresh temporary password to every student with an account?",
      )
    ) {
      return;
    }
    setEmailingAll(true);
    const result = await emailCredentialsToAllStudents();
    setEmailingAll(false);

    if (result.success) {
      toast.success(result.message, { duration: 6000 });
    } else if (result.failures?.length) {
      toast.warning(result.message, { duration: 8000 });
      toast.error(
        result.failures
          .map((failure) => `${failure.email}: ${failure.error}`)
          .join(" · "),
        { duration: 10000 },
      );
    } else {
      toast.error(result.message, { duration: 6000 });
    }
  };

  const handleEmailOne = async (userId: string, displayEmail: string) => {
    if (emailReady === false) {
      toast.error("Set a real RESEND_API_KEY in .env first.");
      return;
    }
    if (!window.confirm(`Send a fresh temporary password to ${displayEmail}?`)) {
      return;
    }
    setActing(userId);
    const result = await emailCredentialsToUser(userId);
    if (result.success) {
      toast.success(result.message as string, { duration: 6000 });
    } else {
      toast.error(result.message as string, { duration: 6000 });
    }
    setActing(null);
  };

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-5xl">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-on-surface">
          Users & Admins
        </h1>
        <p className="text-sm font-medium text-on-surface-variant">
          Create student and admin accounts, then email students their login
          details. Everyone emailed a temporary password must set their own
          before they can use the portal.
        </p>
      </div>

      <Card className="bg-surface-container-low border-outline-variant rounded-[2rem] shadow-sm overflow-hidden">
        <CardHeader className="p-8 border-b border-outline-variant bg-surface-container-highest/10">
          <CardTitle className="text-xl font-black uppercase text-on-surface flex items-center gap-2">
            <UserPlus className="size-5 text-primary" /> Create Account
          </CardTitle>
          <CardDescription className="font-medium text-on-surface-variant">
            The student/admin will log in with these credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleCreate} className="grid gap-5 md:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
                Full Name
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
                Email
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
                Password
              </Label>
              <Input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
                Role
              </Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as "student" | "admin")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-4 flex justify-end">
              <Button
                type="submit"
                disabled={creating}
                className="w-full md:w-auto h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-[11px]"
              >
                {creating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4 mr-2" />
                )}
                Create Account
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-surface-container-low border-outline-variant rounded-[2rem] shadow-sm overflow-hidden">
        <CardHeader className="p-8 border-b border-outline-variant bg-surface-container-highest/10">
          <CardTitle className="text-xl font-black uppercase text-on-surface flex items-center gap-2">
            <UsersRound className="size-5 text-primary" /> Enroll Students In Bulk
          </CardTitle>
          <CardDescription className="font-medium text-on-surface-variant">
            Paste the whole class in one go. Every new address becomes a student
            account; anyone who already has an account is skipped untouched.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          {emailReady === false && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs font-medium text-on-surface-variant leading-relaxed">
                <span className="font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                  Email not configured.
                </span>{" "}
                Add a real <code className="font-mono">RESEND_API_KEY</code> to{" "}
                <code className="font-mono">.env</code> to switch on emailing.
                Until then you can still enroll students and hand out the
                passwords yourself.
              </p>
            </div>
          )}

          {emailReady && testSenderOnly && (
            <div className="flex items-start gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4">
              <Mail className="size-4 mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" />
              <p className="text-xs font-medium text-on-surface-variant leading-relaxed">
                <span className="font-black uppercase tracking-widest text-sky-600 dark:text-sky-400">
                  Test sender.
                </span>{" "}
                You are sending from{" "}
                <code className="font-mono">onboarding@resend.dev</code>, which
                Resend only delivers to the inbox registered on the Resend
                account. Emails to anyone else are rejected and those students
                are skipped, so use this for testing only.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
              Student Emails
            </Label>
            <Textarea
              value={studentList}
              onChange={(e) => setStudentList(e.target.value)}
              rows={7}
              placeholder={
                "ali.khan@example.com\nBilal Ahmed <bilal@example.com>\n Sana, sana@example.com"
              }
              className="rounded-2xl font-mono text-xs leading-relaxed bg-surface-container-low border-outline-variant"
            />
            <p className="text-[11px] font-medium text-on-surface-variant">
              One per line. Names are optional and detected from formats like{" "}
              <span className="font-mono">Ali Khan &lt;ali@example.com&gt;</span>{" "}
              or <span className="font-mono">Sana, sana@example.com</span>.{" "}
              {parsedStudents.length > 0 && (
                <span className="font-black text-primary">
                  {parsedStudents.length} detected
                  {newStudents.length > 0
                    ? ` · ${newStudents.length} new`
                    : " · none new"}
                  {parsedStudents.length <= 4
                    ? `: ${parsedStudents
                        .map((s) => s.name || s.email)
                        .join(", ")}`
                    : ""}
                  .
                </span>
              )}
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                disabled={emailReady === false}
                className="size-4 accent-primary disabled:opacity-40"
              />
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface">
                Email login credentials to each new student
              </span>
            </label>
            {sendEmail && emailReady === false && (
              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                Unavailable until <code className="font-mono">RESEND_API_KEY</code>{" "}
                is set.
              </p>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useSharedPassword}
                onChange={(e) => setUseSharedPassword(e.target.checked)}
                className="size-4 accent-primary"
              />
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface">
                Use one shared password for everyone
              </span>
            </label>
            {useSharedPassword && (
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
                  Shared Password
                </Label>
                <Input
                  type="text"
                  value={sharedPassword}
                  onChange={(e) => setSharedPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="rounded-2xl font-mono"
                />
                <p className="text-[11px] font-medium text-on-surface-variant">
                  Off by default &mdash; every student gets a unique random
                  password instead.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3 pt-2">
            <Button
              onClick={handleEnroll}
              disabled={enrolling || parsedStudents.length === 0 || newStudents.length === 0}
              className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-[11px]"
            >
              {enrolling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserPlus className="size-4 mr-2" />
              )}
              {sendEmail ? "Enroll & Email Credentials" : "Enroll Students"}
            </Button>
            <Button
              onClick={handleEmailAll}
              disabled={emailingAll || accounts.length === 0 || emailReady === false}
              variant="outline"
              className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-[11px]"
            >
              {emailingAll ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4 mr-2" />
              )}
              Email All Students
            </Button>
          </div>

          {issued.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container-highest/30 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-widest text-on-surface">
                  <Check className="size-4 inline mr-2 text-emerald-500" />
                  {issued.length} temporary password
                  {issued.length === 1 ? "" : "s"} issued
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyIssued}
                    className="h-9 rounded-xl font-black uppercase tracking-widest text-[10px]"
                  >
                    <ClipboardCopy className="size-3.5 mr-2" /> Copy All
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIssued([])}
                    className="h-9 rounded-xl font-black uppercase tracking-widest text-[10px]"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-outline-variant/40">
                <table className="w-full text-left text-xs font-mono">
                  <tbody>
                    {issued.map((c) => (
                      <tr key={c.email} className="border-b border-outline-variant/30 last:border-0">
                        <td className="px-3 py-2 text-on-surface-variant">{c.email}</td>
                        <td className="px-3 py-2 text-right font-black text-on-surface">
                          {c.password}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] font-medium text-on-surface-variant">
                Shown once and not emailed. Each student must set their own
                password the first time they sign in.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-surface-container-low border-outline-variant rounded-[2rem] shadow-sm overflow-hidden">
        <CardHeader className="p-8 border-b border-outline-variant bg-surface-container-highest/10">
          <CardTitle className="text-xl font-black uppercase text-on-surface">
            Accounts
          </CardTitle>
          <CardDescription className="font-medium text-on-surface-variant">
            Manage existing student and admin accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          {loading ? (
            <div className="text-center text-on-surface-variant opacity-50 py-10 font-bold uppercase tracking-widest text-sm">
              Loading...
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center text-on-surface-variant opacity-50 py-10 font-bold uppercase tracking-widest text-sm">
              No accounts yet. Create your first account above.
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-surface-container-highest/20 rounded-3xl border border-outline-variant/30"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <Avatar className="h-11 w-11 rounded-2xl border-2 border-background shadow-md shrink-0">
                      <AvatarImage src={account.image ?? undefined} />
                      <AvatarFallback className="font-black bg-primary/10 text-primary">
                        {account.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-on-surface tracking-tight truncate">
                          {account.name}
                          {session?.user?.id === account.id && (
                            <span className="text-on-surface-variant text-xs font-bold ml-1">
                              (You)
                            </span>
                          )}
                        </h3>
                        {account.role === "admin" ? (
                          <ShieldCheck className="size-4 text-primary" />
                        ) : (
                          <GraduationCap className="size-4 text-emerald-500" />
                        )}
                      </div>
                      <p className="text-xs font-medium text-on-surface-variant truncate">
                        {account.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-black uppercase tracking-widest border-outline-variant ${
                        account.role === "admin"
                          ? "text-primary"
                          : "text-emerald-500"
                      }`}
                    >
                      {account.role}
                    </Badge>
                    {session?.user?.id !== account.id && (
                      <>
                        <Select
                          value={account.role === "admin" ? "admin" : "student"}
                          onValueChange={(v) =>
                            handleRoleChange(
                              account.id,
                              v as "student" | "admin",
                            )
                          }
                          disabled={acting === account.id}
                        >
                          <SelectTrigger className="w-32 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        {account.role === "student" && (
                          <Button
                            size="icon"
                            variant="outline"
                            title="Email a fresh temporary password"
                            className="h-9 w-9 rounded-xl"
                            onClick={() =>
                              handleEmailOne(account.id, account.email)
                            }
                            disabled={acting === account.id}
                          >
                            {acting === account.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Mail className="size-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 rounded-xl text-destructive border-destructive/20 hover:bg-destructive/10"
                          onClick={() =>
                            handleRemove(account.id, account.name)
                          }
                          disabled={acting === account.id}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}