"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Palette,
  Save,
  ChevronRight,
  AtSign,
  Lock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ThemeButton } from "@/components/theme-button";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import { uploadAvatar, deleteAvatarAction } from "@/server/users";

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "security", label: "Security", icon: Lock },
];

export default function SettingsPage() {
  const { data: session } = authClient.useSession();
  const [activeTab, setActiveTab] = useState("profile");
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || "");
      setImage(session.user.image || "");
    }
  }, [session?.user]);

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && ["profile", "appearance", "security"].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const options = {
        maxSizeMB: 1.0,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
      };

      const compressedFile = await imageCompression(file, options);

      const formData = new FormData();
      formData.append("file", compressedFile);

      const newUrl = await uploadAvatar(formData);
      setImage(newUrl);
      toast.success("Profile photo updated!");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    setUploading(true);
    try {
      await deleteAvatarAction();
      setImage("");
      toast.success("Profile photo removed!");
    } catch (error: any) {
      toast.error("Failed to remove photo");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, image }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Profile updated successfully!");
        window.location.reload();
      } else {
        throw new Error(data.error || "Failed to save changes");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!session?.user) return null;

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-10 bg-background transition-colors duration-300">
      <div className="max-w-7xl mx-auto w-full">
        <div className="mb-12">
          <h1 className="text-4xl lg:text-5xl font-black tracking-tighter uppercase text-on-surface">
            Account Settings
          </h1>
          <p className="text-on-surface-variant text-lg font-medium mt-2">
            Manage your profile, appearance, and security.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-3 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-xl transition-all font-black uppercase tracking-widest text-[11px]",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-on-surface-variant hover:bg-surface-container-high",
                )}
              >
                <div className="flex items-center gap-3">
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </div>
                <ChevronRight
                  className={cn(
                    "w-4 h-4 transition-transform",
                    activeTab === tab.id ? "rotate-90" : "",
                  )}
                />
              </button>
            ))}
          </div>

          <div className="col-span-12 lg:col-span-9">
            {activeTab === "profile" && (
              <Card className="bg-surface-container-low border-outline-variant rounded-[2.5rem] shadow-sm overflow-hidden text-left">
                <CardHeader className="p-8 border-b border-outline-variant bg-surface-container-highest/10">
                  <CardTitle className="text-2xl font-black uppercase text-on-surface">
                    Profile Identity
                  </CardTitle>
                  <CardDescription className="font-medium text-on-surface-variant">
                    Update your public profile information.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-10 space-y-10">
                  <div className="flex flex-col md:flex-row gap-8 items-start md:items-center p-6 bg-surface-container-highest/20 rounded-3xl border border-outline-variant/30">
                    <Avatar className="h-24 w-24 rounded-3xl border-4 border-background shadow-xl">
                      <AvatarImage src={image ?? undefined} />
                      <AvatarFallback className="text-2xl font-black bg-primary/10 text-primary">
                        {name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-4">
                      <h3 className="text-lg font-black text-on-surface">
                        Profile Picture
                      </h3>
                      <div className="flex gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={handleImageUpload}
                        />
                        <Button
                          variant="outline"
                          disabled={uploading}
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-xl font-bold uppercase tracking-widest text-[10px]"
                        >
                          {uploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Change Image"
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={uploading}
                          onClick={handleDeleteAvatar}
                          className="rounded-xl font-bold uppercase tracking-widest text-[10px] text-destructive hover:bg-destructive/10"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <Label
                        htmlFor="name"
                        className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant ml-1"
                      >
                        Full Name
                      </Label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="h-14 pl-12 bg-surface-container-low border-outline-variant rounded-2xl font-bold text-on-surface"
                        />
                      </div>
                    </div>
                    <div className="space-y-3 opacity-60">
                      <Label
                        htmlFor="email"
                        className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant ml-1"
                      >
                        Email Address
                      </Label>
                      <div className="relative">
                        <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                        <Input
                          id="email"
                          defaultValue={session.user.email}
                          disabled
                          className="h-14 pl-12 bg-surface-container-highest/50 border-outline-variant rounded-2xl font-bold italic"
                        />
                      </div>
                      <p className="text-[10px] text-on-surface-variant font-medium ml-1">
                        Contact administrators to change your email.
                      </p>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-outline-variant flex justify-end">
                    <Button
                      onClick={handleSaveChanges}
                      disabled={saving}
                      className="bg-primary text-primary-foreground font-black px-8 py-6 rounded-2xl shadow-xl shadow-primary/20 flex items-center gap-2 hover:scale-[1.02] transition-all"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      SAVE CHANGES
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "appearance" && (
              <Card className="bg-surface-container-low border-outline-variant rounded-[2.5rem] shadow-sm overflow-hidden text-left">
                <CardHeader className="p-8 border-b border-outline-variant bg-surface-container-highest/10">
                  <CardTitle className="text-2xl font-black uppercase text-on-surface">
                    Visual Appearance
                  </CardTitle>
                  <CardDescription className="font-medium text-on-surface-variant">
                    Customize the design and theme of your workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-10 space-y-10">
                  <div className="flex items-center justify-between p-8 bg-surface-container-highest/20 rounded-3xl border border-outline-variant/30">
                    <div className="space-y-1">
                      <h3 className="text-lg font-black text-on-surface uppercase tracking-tight">
                        Main Theme
                      </h3>
                      <p className="text-sm font-medium text-on-surface-variant">
                        Switch between light and dark modes.
                      </p>
                    </div>
                    <div className="scale-125">
                      <ThemeButton />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "security" && (
              <Card className="bg-surface-container-low border-outline-variant rounded-[2.5rem] shadow-sm overflow-hidden text-left">
                <CardHeader className="p-8 border-b border-outline-variant bg-surface-container-highest/10">
                  <CardTitle className="text-2xl font-black uppercase text-on-surface">
                    Security & Privacy
                  </CardTitle>
                  <CardDescription className="font-medium text-on-surface-variant">
                    Manage your account protection and sign-in methods.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 md:p-10 space-y-8">
                  <div className="flex items-center justify-between p-6 bg-surface-container-highest/10 rounded-2xl border border-outline-variant/20 group">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/10 rounded-xl">
                        <Lock className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-black text-on-surface uppercase tracking-tight">
                          Password
                        </h4>
                        <p className="text-xs font-medium text-on-surface-variant">
                          Passwords are managed by your institute. Contact an
                          admin to update your credentials.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}