import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      accountType: "CREATOR" | "EDITOR";
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    sessionVersion?: number;
    accountType: "CREATOR" | "EDITOR";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sessionVersion?: number;
    accountType?: "CREATOR" | "EDITOR";
  }
}
