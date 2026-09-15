import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loadEffectivePermissions } from "@/lib/permissions";

export const { handlers, signIn, signOut, auth } = NextAuth({
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
    async jwt({ token, user }) {
      const userId = user?.id ?? token.id;
      if (!userId) return null;
      // Refresh on every session read so deactivation and permission changes
      // take effect for existing sessions, not just the next login.
      const current = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, role: true, isActive: true, mustResetPassword: true,
          profile: { select: { name: true } },
        },
      });
      if (!current?.isActive) return null;
      token.id = current.id;
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
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});
