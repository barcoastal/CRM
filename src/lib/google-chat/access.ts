import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChatError, workspaceDomain } from "./client";

export async function chatAccount() {
  const session = await auth();
  if (!session?.user?.id) throw new ChatError(401, "Sign in to use Google Chat.");
  if (session.impersonation) throw new ChatError(403, "Return to your own account to use Google Chat.");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, isActive: true, mustResetPassword: true } });
  if (!user?.isActive || user.mustResetPassword) throw new ChatError(403, "Your account is not available for Google Chat.");
  if (!user.email.toLowerCase().endsWith(`@${workspaceDomain()}`)) throw new ChatError(403, `Google Chat requires your ${workspaceDomain()} work account.`);
  return { id: user.id, name: user.name, email: user.email.toLowerCase() };
}
