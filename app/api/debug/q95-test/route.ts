import { NextResponse } from 'next/server';
import { fetchAndProcess } from '../../regional/route';

export async function GET(req: Request) {
    try {
        const result = await fetchAndProcess(null, null, true, null, null, null, 2026);
        return NextResponse.json({ 
            success: true, 
            opsLength: result.opsOficina?.length,
            lotesLength: result.lotes?.length,
            sampleOp: result.opsOficina?.[0]
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
    }
}
