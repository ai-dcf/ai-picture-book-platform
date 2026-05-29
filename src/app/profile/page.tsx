"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { updateProfile } from "@/app/actions/auth";
import { redirect } from "next/navigation";

const profileSchema = z.object({
  nickname: z.string().min(1, "昵称不能为空"),
  avatarUrl: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (session?.user) {
      reset({
        nickname: (session.user as any).nickname || "",
        avatarUrl: (session.user as any).avatarUrl || "",
      });
    }
  }, [session, reset]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        加载中...
      </div>
    );
  }

  if (status === "unauthenticated") {
    redirect("/login");
  }

  const onSubmit = async (data: ProfileFormData) => {
    setMessage(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      if (data.nickname) formData.set("nickname", data.nickname);
      if (data.avatarUrl) formData.set("avatarUrl", data.avatarUrl);

      const result = await updateProfile(formData);

      if (result.success) {
        setMessage({ type: "success", text: "个人资料更新成功！" });
        window.location.reload();
      } else {
        setMessage({ type: "error", text: result.error || "更新失败" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "更新失败，请稍后重试" });
    } finally {
      setIsLoading(false);
    }
  };

  const userInitial = ((session?.user as any)?.nickname || session?.user?.email || "U").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>个人资料</CardTitle>
            <CardDescription>
              管理您的个人信息
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex items-center space-x-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={(session?.user as any)?.avatarUrl} />
                  <AvatarFallback className="text-lg">{userInitial}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Label htmlFor="avatarUrl">头像URL（可选）</Label>
                  <Input
                    id="avatarUrl"
                    type="url"
                    placeholder="https://example.com/avatar.jpg"
                    {...register("avatarUrl")}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nickname">昵称</Label>
                <Input
                  id="nickname"
                  type="text"
                  placeholder="您的昵称"
                  {...register("nickname")}
                />
                {errors.nickname && (
                  <p className="text-sm text-red-500">{errors.nickname.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>邮箱</Label>
                <Input
                  type="email"
                  value={session?.user?.email || ""}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-sm text-gray-500">邮箱不可更改</p>
              </div>
              {message && (
                <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  {message.text}
                </div>
              )}
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "保存中..." : "保存更改"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
