import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import InsightsClient from '@/components/analisis/InsightsClient';

export const metadata = { title: 'Insights de Mercado | DeCampoACampo' };

export default async function InsightsPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user) redirect('/login');

    const user = session.user as any;
    if (!user.isAdmin) redirect('/');   // solo admins

    return (
        <InsightsClient
            acId={null}
            acName={null}
            isAdmin={true}
            canal={null}
        />
    );
}
