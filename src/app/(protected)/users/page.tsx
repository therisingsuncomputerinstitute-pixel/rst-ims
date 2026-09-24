"use client";

import { Loader2, Trash2, UserPlus, ShieldCheck, GraduationCap } from "lucide-react";
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

  const loadAccounts = React.useCallback(async () => {
    const data = await listAccounts();
    setAccounts(data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (isAdmin) {
      loadAccounts();
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

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-5xl">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-on-surface">
          Users & Admins
        </h1>
        <p className="text-sm font-medium text-on-surface-variant">
          Create student and admin accounts. Credentials are provided manually.
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