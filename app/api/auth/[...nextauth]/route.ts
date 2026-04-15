import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { getAcByEmail, isAdmin } from "@/lib/data/constants";
import { NextAuthOptions } from "next-auth";
import { createHmac } from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET || 'secreto-super-seguro-local';

// Verifica un token HMAC de magic link
function verifyMagicToken(token: string): string | null {
    try {
        const [payload, sig] = token.split('.');
        if (!payload || !sig) return null;
        const expected = createHmac('sha256', SECRET).update(payload).digest('base64url');
        if (expected !== sig) return null;
        const { email, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
        if (Date.now() > exp) return null;
        return email as string;
    } catch {
        return null;
    }
}

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        }),
        CredentialsProvider({
            id: 'magic-link',
            name: 'Magic Link',
            credentials: {
                token: { type: 'text' },
                email: { type: 'email' },
            },
            async authorize(credentials) {
                if (!credentials?.token || !credentials?.email) return null;
                const email = verifyMagicToken(credentials.token);
                if (!email || email.toLowerCase() !== credentials.email.toLowerCase()) return null;
                return { id: email, email, name: email };
            },
        }),
    ],
    secret: SECRET,
    session: { strategy: 'jwt' },
    callbacks: {
        async signIn({ user, account }) {
            if (!user?.email) return '/login?error=AccessDenied';
            const email = user.email.toLowerCase();

            // Google provider: solo @decampoacampo.com
            if (account?.provider === 'google') {
                if (email.endsWith('@decampoacampo.com') || email.endsWith('@decampoacampo.com.ar')) {
                    return true;
                }
                return '/login?error=AccessDenied';
            }

            // Magic link: ya fue validado en CredentialsProvider, siempre true
            if (account?.provider === 'magic-link') {
                return true;
            }

            return '/login?error=AccessDenied';
        },
        async session({ session, token }) {
            if (session.user?.email) {
                const ac = getAcByEmail(session.user.email);
                const isUserAdmin = isAdmin(session.user.email);
                (session.user as any).acId = ac?.id || null;
                (session.user as any).acName = ac?.nombre || null;
                (session.user as any).isAdmin = isUserAdmin;
                (session.user as any).canal = ac?.canal || null;
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) token.email = user.email;
            return token;
        },
    },
    pages: {
        signIn: '/login',
    },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
