import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { loadEffectivePermissions } from "@/lib/permissions";
import { auditWrite } from "@/lib/audit";
import { createRemoteJWKSet, jwtVerify } from "jose";

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const googleWorkspaceProvider = Credentials({
  id: "five9-google",
  name: "Google Workspace",
  credentials: { credential: { label: "Google ID token", type: "text" } },
  async authorize(credentials) {
    const clientId = process.env.FIVE9_GOOGLE_CLIENT_ID;
    const hostedDomain = process.env.FIVE9_GOOGLE_HOSTED_DOMAIN?.toLowerCase();
    const credential = credentials?.credential;
    if (!clientId || !hostedDomain || typeof credential !== "string") return null;
    let identity;
    try {
      ({ payload: identity } = await jwtVerify(credential, googleKeys, {
        audience: clientId,
        issuer: ["https://accounts.google.com", "accounts.google.com"],
      }));
    } catch {
      return null;
    }
    const email = typeof identity.email === "string" ? identity.email.toLowerCase() : "";
    const subject = identity.sub;
    if (!subject || identity.email_verified !== true ||
        typeof identity.hd !== "string" || identity.hd.toLowerCase() !== hostedDomain ||
        !email.endsWith(`@${hostedDomain}`)) return null;
    const allowedEmails = (process.env.FIVE9_FRAME_PILOT_EMAILS ?? "")
      .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
    if (!allowedEmails.includes(email)) return null;

    const user = await prisma.user.findUnique({
      where: { email }, include: { profile: { select: { name: true } } },
    });
    if (!user?.isActive || (user.googleSubject && user.googleSubject !== subject)) return null;
    // Bind the immutable Google subject once. An email recycled within the
    // Workspace must not inherit the prior person's CRM access.
    if (!user.googleSubject) {
      try {
        await prisma.user.updateMany({
          where: { id: user.id, googleSubject: null }, data: { googleSubject: subject },
        });
      } catch {
        return null;
      }
      const bound = await prisma.user.findUnique({
        where: { id: user.id }, select: { googleSubject: true },
      });
      if (bound?.googleSubject !== subject) return null;
    }
    const permissions = Array.from(await loadEffectivePermissions(user.id));
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
    return {
      id: user.id, name: user.name, email: user.email, role: user.role,
      profileName: user.profile?.name ?? null, permissions,
      mustResetPassword: user.mustResetPassword,
    };
  },
});

const authConfig: NextAuthConfig = {
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
};

const standardAuth = NextAuth(authConfig);
export const { handlers, signIn, signOut, unstable_update: updateSession } = standardAuth;

// Five9 runs the CRM in a cross-site frame. Give that frame its own partitioned
// cookie so the existing CRM session cookie and every other agent stay intact.
export const FIVE9_FRAME_SESSION_COOKIE = process.env.NODE_ENV === "production"
  ? "__Secure-crm.five9-session"
  : "crm.five9-session";
const frameCookieOptions = process.env.NODE_ENV === "production"
  ? { httpOnly: true, sameSite: "none" as const, secure: true, partitioned: true, path: "/" }
  : { httpOnly: true, sameSite: "lax" as const, secure: false, path: "/" };
const frameAuth = NextAuth({
  ...authConfig,
  providers: process.env.FIVE9_GOOGLE_CLIENT_ID && process.env.FIVE9_GOOGLE_HOSTED_DOMAIN
    ? [...authConfig.providers, googleWorkspaceProvider]
    : authConfig.providers,
  basePath: "/api/five9/auth",
  cookies: {
    sessionToken: { name: FIVE9_FRAME_SESSION_COOKIE, options: frameCookieOptions },
    csrfToken: {
      name: process.env.NODE_ENV === "production" ? "__Host-crm.five9-csrf" : "crm.five9-csrf",
      options: frameCookieOptions,
    },
    callbackUrl: {
      name: process.env.NODE_ENV === "production" ? "__Secure-crm.five9-callback" : "crm.five9-callback",
      options: frameCookieOptions,
    },
  },
});
export const frameHandlers = frameAuth.handlers;

export async function auth() {
  const cookieStore = await cookies();
  if (cookieStore.has(FIVE9_FRAME_SESSION_COOKIE)) return frameAuth.auth();
  return standardAuth.auth();
}
