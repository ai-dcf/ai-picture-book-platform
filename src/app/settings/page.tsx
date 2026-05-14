"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { changePassword } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "当前密码不能为空"),
  newPassword: z.string().min(6, "新密码至少6位"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "两次密码输入不一致",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

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

  const onSubmit = async (data: PasswordFormData) => {
    setMessage(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.set("currentPassword", data.currentPassword);
      formData.set("newPassword", data.newPassword);
      formData.set("confirmPassword", data.confirmPassword);

      const result = await changePassword(formData);

      if (result.success) {
        setMessage({ type: "success", text: "密码修改成功！" });
        reset();
      } else {
        setMessage({ type: "error", text: result.error || "修改失败" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "修改失败，请稍后重试" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>账号设置</CardTitle>
            <CardDescription>
              管理您的账号安全设置
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">修改密码</h3>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">当前密码</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    placeholder="请输入当前密码"
                    {...register("currentPassword")}
                  />
                  {errors.currentPassword && (
                    <p className="text-sm text-red-500">{errors.currentPassword.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">新密码</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="至少6位"
                    {...register("newPassword")}
                  />
                  {errors.newPassword && (
                    <p className="text-sm text-red-500">{errors.newPassword.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">确认新密码</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="再次输入新密码"
                    {...register("confirmPassword")}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
                  )}
                </div>
                {message && (
                  <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    {message.text}
                  </div>
                )}
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "修改中..." : "修改密码"}
                </Button>
              </form>
            </div>
            <div className="pt-4 border-t">
              <h3 className="text-lg font-medium mb-4">其他</h3>
              <p className="text-sm text-gray-500 mb-4">
                需要修改邮箱或删除账号？请联系管理员。
              </p>
              <Link href="/profile">
                <Button variant="secondary">返回个人资料</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
