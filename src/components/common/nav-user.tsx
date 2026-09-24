"use client";

import { BadgeCheck, ChevronsUpDown, LogOut } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    role?: string;
    avatar: string | null;
  } | null;
}) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [showLogoutDialog, setShowLogoutDialog] = React.useState(false);

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
      },
    });
  };

  if (!user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex items-center gap-3 px-3 py-2 animate-pulse">
            <div className="h-8 w-8 rounded-lg bg-surface-container-highest"></div>
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 rounded bg-surface-container-highest"></div>
              <div className="h-2 w-32 rounded bg-surface-container-highest"></div>
            </div>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const isAdmin = user.role === "admin";

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground transition-all duration-300 hover:bg-surface-container-highest/50 group h-14"
              >
                <Avatar className="h-9 w-9 rounded-xl shadow-sm group-hover:scale-105 transition-transform border border-outline-variant/30">
                  <AvatarImage src={user.avatar ?? undefined} alt={user.name} />
                  <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-black uppercase text-xs">
                    {user.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight ml-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-black uppercase text-[11px] tracking-tight text-on-surface">
                      {user.name}
                    </span>
                    <Badge
                      className="h-4 px-1.5 text-[8px] font-black uppercase tracking-tighter border-none bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    >
                      {isAdmin ? "Admin" : "Student"}
                    </Badge>
                  </div>
                  <span className="truncate text-[10px] font-medium text-on-surface-variant/70">
                    {user.email}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-on-surface-variant/50 group-hover:text-primary transition-colors" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-[2rem] p-3 border-outline-variant shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4)] bg-popover"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-3 px-2 py-3 text-left">
                    <Avatar className="h-10 w-10 rounded-xl border border-outline-variant/30">
                      <AvatarImage
                        src={user.avatar ?? undefined}
                        alt={user.name}
                      />
                      <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-black">
                        {user.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-black uppercase text-xs tracking-tight">
                          {user.name}
                        </span>
                        {isAdmin && (
                          <BadgeCheck className="size-3.5 text-primary" />
                        )}
                      </div>
                      <span className="truncate text-[10px] font-medium text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="my-2 opacity-50" />
              <DropdownMenuGroup className="space-y-1">
                <Link href="/settings">
                  <DropdownMenuItem className="rounded-xl font-black text-[10px] uppercase tracking-widest py-3 cursor-pointer">
                    <BadgeCheck className="mr-2 size-4 opacity-50" />
                    Account Settings
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="my-2 opacity-50" />
              <DropdownMenuItem
                className="rounded-xl font-black text-[10px] uppercase tracking-widest py-3 text-destructive focus:text-destructive cursor-pointer"
                onClick={() => setShowLogoutDialog(true)}
              >
                <LogOut className="mr-2 size-4" />
                Terminate Session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className="rounded-[2.5rem] p-10 border-outline-variant shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-3xl font-black uppercase tracking-tighter">
              Terminate Session?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base font-medium text-on-surface-variant pt-2">
              You will need to sign in again to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-10 gap-3">
            <AlertDialogCancel className="rounded-2xl font-black uppercase tracking-widest text-[10px] h-14 border-outline-variant hover:bg-surface-container-high transition-all">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="rounded-2xl font-black uppercase tracking-widest text-[10px] h-14 bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20 transition-all active:scale-95"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}