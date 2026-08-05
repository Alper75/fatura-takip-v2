import { NextResponse } from 'next/server';
import { createFaturaClient } from '@/lib/fatura-client';

export async function POST(request) {
    try {
        const body = await request.json();
        const { username, password, env = 'PROD' } = body;
        
        if (!username || !password) {
            return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
        }
        
        const client = createFaturaClient(env);
        const token = await client.getToken(username, password);
        return NextResponse.json({ token });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
