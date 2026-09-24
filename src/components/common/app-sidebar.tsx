"use client";
import * as React from "react";
import {
  IconLayoutDashboard,
  IconBooks,
  IconClipboardText,
  IconFileText,
  IconReportAnalytics,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { type Icon as TablerIcon } from "@tabler/icons-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { INSTITUTE_NAME } from "@/lib/institute";

import { NavUser } from "./nav-user";

const navMain = [
  { title: "Dashboard", url: "/dashboard", icon: IconLayoutDashboard },
  { title: "Courses", url: "/courses", icon: IconBooks },
  { title: "Quizzes", url: "/quizzes", icon: IconClipboardText },
  { title: "Assignments", url: "/assignments", icon: IconFileText },
  { title: "Grades", url: "/grades", icon: IconReportAnalytics },
  { title: "Users", url: "/users", icon: IconUsers },
  { title: "Settings", url: "/settings", icon: IconSettings },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = authClient.useSession();

  const user = {
    name: session?.user?.name ?? "User",
    email: session?.user?.email ?? "",
    role: session?.user?.role ?? "student",
    avatar: session?.user?.image || null,
  };

  return (
    <Sidebar
      collapsible="offcanvas"
      className="border-r"
      variant="inset"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="hover:bg-transparent"
            >
              <Link href="/dashboard" className="flex items-center gap-3 group">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-secondary/60 text-primary-foreground transition-transform group-hover:scale-110">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarImage src="/logo.png" alt="Logo" />
                    <AvatarFallback className="rounded-lg text-xs font-black">
                      {INSTITUTE_NAME.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-black uppercase tracking-tighter">
                    {INSTITUTE_NAME}
                  </span>
                  <span className="truncate text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                    Student Portal
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain
          items={navMain}
          isAdmin={session?.user?.role === "admin"}
        />
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}

function NavMain({
  items,
  isAdmin = false,
}: {
  items: {
    title: string;
    url: string;
    icon?: TablerIcon;
  }[];
  isAdmin?: boolean;
}) {
  const pathname = usePathname();

  const filteredItems = items.filter((item) => {
    if (item.title === "Users" && !isAdmin) {
      return false;
    }
    return true;
  });

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2 px-0 py-4">
        <SidebarMenu>
          {filteredItems.map((item) => {
            const isActive =
              pathname === item.url || pathname.startsWith(item.url + "/");

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors
                  ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <Link
                    href={item.url}
                    className="flex items-center gap-3 w-full"
                  >
                    {item.icon && <item.icon className="size-5 shrink-0" />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}