import { NextResponse } from 'next/server';
import { createFaturaClient } from '@/lib/fatura-client';

export async function POST(request) {
    try {
        const body = await request.json();
        const { username, password, invoiceDetails, sign = true, env = 'PROD' } = body;
        
        if (!username || !password || !invoiceDetails) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const client = createFaturaClient(env);
        const token = await client.getToken(username, password);
        const draft = await client.createDraftInvoice(token, invoiceDetails);
        const details = await client.findInvoice(token, draft);
        if (sign && details !== undefined) {
            await client.signDraftInvoice(token, details);
        }
        return NextResponse.json({ uuid: draft.uuid, signed: sign, token });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
