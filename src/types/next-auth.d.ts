import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    impersonation?: {
      adminId: string;
      adminName: string;
      startedAt: string;
      unavailable: boolean;
    };
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      profileName: string | null;
      permissions: string[];
      mustResetPassword: boolean;
    };
  }

  interface User {
    role: string;
    profileName?: string | null;
    permissions?: string[];
    mustResetPassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    viewAs?: { userId: string; name: string; email: string; startedAt: string };
    id: string;
    role: string;
    profileName: string | null;
    permissions: string[];
    mustResetPassword: boolean;
  }
}
