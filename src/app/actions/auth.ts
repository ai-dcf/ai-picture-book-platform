"use server";

import { z } from "zod";
import bcrypt from "bcrypt";
import { auth, signIn, signOut } from "@/auth";
import { UserRepository } from "@/lib/db/repositories/user-repository";
import { redirect } from "next/navigation";

const registerSchema = z.object({
  email: z.string().email("请输入有效的邮箱"),
  nickname: z.string().min(1, "昵称不能为空"),
  password: z.string().min(6, "密码至少6位"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "两次密码输入不一致",
  path: ["confirmPassword"],
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "当前密码不能为空"),
  newPassword: z.string().min(6, "新密码至少6位"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "两次密码输入不一致",
  path: ["confirmPassword"],
});

const updateProfileSchema = z.object({
  nickname: z.string().optional(),
  avatarUrl: z.string().optional(),
});

export async function registerUser(formData: FormData) {
  const result = registerSchema.safeParse({
    email: formData.get("email"),
    nickname: formData.get("nickname"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  const { email, nickname, password } = result.data;

  const emailExists = await UserRepository.emailExists(email);
  if (emailExists) {
    return { success: false, error: "该邮箱已被注册" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await UserRepository.createUser({
    email,
    nickname,
    passwordHash,
  });

  await signIn("credentials", { email, password, redirectTo: "/" });
  
  return { success: true };
}

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "请先登录" };
  }

  const result = updateProfileSchema.safeParse({
    nickname: formData.get("nickname") as string || undefined,
    avatarUrl: formData.get("avatarUrl") as string || undefined,
  });

  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  const updatedUser = await UserRepository.updateUser(session.user.id, result.data);

  if (!updatedUser) {
    return { success: false, error: "更新失败" };
  }

  return { success: true };
}

export async function changePassword(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "请先登录" };
  }

  const result = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  const { currentPassword, newPassword } = result.data;

  const user = await UserRepository.getUserById(session.user.id);
  if (!user || !user.passwordHash) {
    return { success: false, error: "用户不存在" };
  }

  const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordMatch) {
    return { success: false, error: "当前密码错误" };
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await UserRepository.updateUser(session.user.id, { passwordHash: newPasswordHash });

  return { success: true };
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
