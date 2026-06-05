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
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: string }).role;
        token.profileName = (user as { profileName: string | null }).profileName ?? null;
        token.permissions = (user as { permissions: string[] }).permissions ?? [];
        token.mustResetPassword = (user as { mustResetPassword?: boolean }).mustResetPassword ?? false;
      }
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
