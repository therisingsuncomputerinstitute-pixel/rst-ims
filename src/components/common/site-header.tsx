"use client";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LogOut } from "lucide-react";
import { ThemeButton } from "@/components/theme-button";
import { authClient } from "@/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import Link from "next/link";

export function SiteHeader() {
  const { data: session } = authClient.useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAdmin = session?.user?.role === "admin";

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/login";
        },
      },
    });
  };

  return (
    <header className="flex shrink-0 items-center py-4 border-b transition-[width,height] ease-linear bg-background/80 backdrop-blur-md sticky top-0 z-30">
      <div className="flex w-full items-center gap-4 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />

        <Separator
          orientation="vertical"
          className="data-[orientation=vertical]:h-8"
        />

        <div className="flex-1" />

        <div className="flex items-center gap-2 lg:gap-4 shrink-0">
          <ThemeButton />

          <Separator orientation="vertical" className="h-8 hidden sm:block" />

          {!mounted || !session ? (
            <div className="h-10 w-10 rounded-full animate-pulse bg-muted shrink-0" />
          ) : session.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "relative h-11 w-11 shrink-0 rounded-2xl border border-outline-variant p-0 overflow-hidden hover:border-primary/50 transition-all",
                )}
              >
                <Avatar className="h-full w-full rounded-none">
                  <AvatarImage
                    src={session.user.image ?? undefined}
                    alt={session.user.name || ""}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary font-black uppercase">
                    {session.user.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-64 rounded-[1.5rem] p-2 mt-2"
                align="end"
                sideOffset={8}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-3 px-3 py-3 bg-surface-container-highest/10 rounded-xl mb-2">
                      <Avatar className="h-10 w-10 rounded-lg">
                        <AvatarImage src={session.user.image ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-black">
                          {session.user.name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-tight text-on-surface truncate">
                          {session.user.name}
                        </p>
                        <p className="text-[10px] font-medium text-on-surface-variant/70 truncate">
                          {session.user.email}
                        </p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-primary truncate mt-1">
                          {isAdmin ? "Admin" : "Student"}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="my-2 opacity-30" />
                <DropdownMenuGroup className="space-y-1">
                  <Link href="/settings">
                    <DropdownMenuItem className="rounded-xl font-black uppercase tracking-widest text-[10px] py-3 cursor-pointer">
                      Settings
                    </DropdownMenuItem>
                  </Link>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="my-2 opacity-30" />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 rounded-xl h-12 text-[11px] font-black uppercase tracking-widest"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  <span>Terminate Session</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => (window.location.href = "/login")}
              className="rounded-xl font-black uppercase tracking-widest text-[10px]"
            >
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}