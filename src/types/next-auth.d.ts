import { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: DefaultSession["user"] & {
            id: string;
            isAdmin: boolean;
            thesisStage: number;
        };
    }

    interface User {
        isAdmin: boolean;
        thesisStage: number;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id?: string;
        isAdmin?: boolean;
        thesisStage?: number;
    }
}
