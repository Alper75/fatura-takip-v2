import { NextResponse } from 'next/server';
import { createFaturaClient } from '@/lib/fatura-client';
import { cookies } from 'next/headers';

export async function GET(req) {
    try {
        const url = new URL(req.url);
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');

        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const token = cookieStore.get('gib_token')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Giriş yapılmamış. Lütfen tekrar giriş yapın.' }, { status: 401 });
        }

        const env = cookieStore.get('gib_env')?.value || 'TEST';
        const client = createFaturaClient(env);
        
        // Taslakları getir
        const drafts = await client.getAllInvoicesByDateRange(token, { startDate, endDate });

        return NextResponse.json({ success: true, data: drafts || [] });
    } catch (error) {
        console.error('Invoice fetch error:', error);
        return NextResponse.json({ error: error.message || 'Faturalar getirilirken hata oluştu' }, { status: 500 });
    }
}
