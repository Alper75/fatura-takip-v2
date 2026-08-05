import { NextResponse } from 'next/server';
import { createFaturaClient } from '@/lib/fatura-client';
import { cookies } from 'next/headers';

export async function GET(req) {
    try {
        const url = new URL(req.url);
        const uuid = url.searchParams.get('uuid');
        const signed = url.searchParams.get('signed') === 'true';

        if (!uuid) {
            return NextResponse.json({ error: 'uuid is required' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const token = cookieStore.get('gib_token')?.value;
        const env = cookieStore.get('gib_env')?.value || 'TEST';

        if (!token) {
            return NextResponse.json({ error: 'Giriş yapılmamış.' }, { status: 401 });
        }

        const client = createFaturaClient(env);
        const html = await client.getInvoiceHTML(token, uuid, { signed });
        return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { token, uuid, signed = true, env = 'PROD' } = body;
        
        if (!token || !uuid) {
            return NextResponse.json({ error: "Missing token or uuid" }, { status: 400 });
        }

        const client = createFaturaClient(env);
        const html = await client.getInvoiceHTML(token, uuid, { signed });
        return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
