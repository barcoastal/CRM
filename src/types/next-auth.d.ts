import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      profileName: string | null;
      permissions: string[];
    };
  }

  interface User {
    role: string;
    profileName?: string | null;
    permissions?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    profileName: string | null;
    permissions: string[];
  }
}
