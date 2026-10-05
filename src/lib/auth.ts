import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loadEffectivePermissions } from "@/lib/permissions";
import { auditWrite } from "@/lib/audit";

export const { handlers, signIn, signOut, auth, unstable_update: updateSession } = NextAuth({
  // Agent Desktop Plus loads /five9/opener as a cross-site frame. A partitioned
  // session keeps each agent's CRM identity available in that frame without a
  // shared URL token or reliance on unpartitioned third-party cookies.
  ...(process.env.NODE_ENV === "production" ? {
    cookies: {
      sessionToken: {
        name: "__Secure-crm.session-token",
        options: { httpOnly: true, sameSite: "none" as const, secure: true, partitioned: true, path: "/" },
      },
      csrfToken: {
        name: "__Host-crm.csrf-token",
        options: { httpOnly: true, sameSite: "none" as const, secure: true, partitioned: true, path: "/" },
      },
      callbackUrl: {
        name: "__Secure-crm.callback-url",
        options: { httpOnly: true, sameSite: "none" as const, secure: true, partitioned: true, path: "/" },
      },
    },
  } : {}),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { profile: { select: { name: true } } },
        });

        if (!user || !user.isActive) return null;

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        );
        if (!isPasswordValid) return null;

        const permissions = Array.from(await loadEffectivePermissions(user.id));

        // Update lastLoginAt; fire-and-forget so we don't slow sign-in
        prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          profileName: user.profile?.name ?? null,
          permissions,
          mustResetPassword: user.mustResetPassword,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user, trigger, session: update }) {
      // token.id ALWAYS identifies the person who authenticated. Never accept
      // identity, role or permissions supplied by a client session update.
      if (user) delete token.viewAs;
      const userId = user?.id ?? token.id;
      if (!userId) return null;
      // Refresh on every session read so deactivation and permission changes
      // take effect for existing sessions, not just the next login.
      const current = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, name: true, email: true, role: true, isActive: true, mustResetPassword: true,
          profile: { select: { name: true } },
        },
      });
      if (!current?.isActive) return null;
      if (trigger === "update" && update?.viewAsUserId === null && token.viewAs) {
        await auditWrite({
          userId: current.id, entity: "UserPreview", entityId: token.viewAs.userId,
          action: "UPDATE", after: { event: "STOP", startedAt: token.viewAs.startedAt },
        });
        delete token.viewAs;
      } else if (trigger === "update" && typeof update?.viewAsUserId === "string"
        && current.role === "ADMIN" && !current.mustResetPassword && !token.viewAs) {
        const target = await prisma.user.findUnique({
          where: { id: update.viewAsUserId },
          select: { id: true, name: true, email: true, isActive: true },
        });
        if (target?.isActive && target.id !== current.id) {
          const startedAt = new Date().toISOString();
          await auditWrite({
            userId: current.id, entity: "UserPreview", entityId: target.id,
            action: "CREATE", after: { event: "START", startedAt, readOnly: true },
          });
          token.viewAs = { userId: target.id, name: target.name, email: target.email, startedAt };
        }
      }
      token.id = current.id;
      token.name = current.name;
      token.email = current.email;
      token.role = current.role;
      token.profileName = current.profile?.name ?? null;
      token.permissions = Array.from(await loadEffectivePermissions(current.id));
      token.mustResetPassword = current.mustResetPassword;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.profileName = token.profileName;
        session.user.permissions = token.permissions ?? [];
        session.user.mustResetPassword = token.mustResetPassword ?? false;
        // The authenticated admin remains in the encrypted JWT; every consumer
        // (server pages, APIs, and useSession) receives only the target identity.
        if (token.viewAs) {
          const target = await prisma.user.findUnique({
            where: { id: token.viewAs.userId },
            select: {
              id: true, name: true, email: true, role: true, isActive: true,
              mustResetPassword: true, profile: { select: { name: true } },
            },
          });
          const available = !!target?.isActive && token.role === "ADMIN" && !token.mustResetPassword;
          session.impersonation = {
            adminId: token.id, adminName: token.name ?? "Admin",
            startedAt: token.viewAs.startedAt, unavailable: !available,
          };
          session.user = {
            emailVerified: null, image: null,
            // An unavailable preview must not retain a usable target id:
            // some older read paths load roles directly from the user table.
            id: available ? token.viewAs.userId : "", name: target?.name ?? token.viewAs.name,
            email: target?.email ?? token.viewAs.email,
            role: available ? target.role : "UNAVAILABLE",
            profileName: available ? target.profile?.name ?? null : null,
            permissions: available ? Array.from(await loadEffectivePermissions(target.id)) : [],
            mustResetPassword: target?.mustResetPassword ?? false,
          };
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});
