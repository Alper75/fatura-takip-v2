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

        if (!token) {
            return NextResponse.json({ error: 'Giriş yapılmamış. Lütfen tekrar giriş yapın.' }, { status: 401 });
        }

        const env = cookieStore.get('gib_env')?.value || 'TEST';
        const client = createFaturaClient(env);
        
        const downloadUrl = client.getDownloadURL(token, uuid, { signed });

        const response = await fetch(downloadUrl, {
            headers: client.buildHeaders()
        });

        if (!response.ok) {
            throw new Error(`GİB sunucusu hata döndürdü: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        
        // GİB bazen oturum düştüğünde hata sayfası (HTML) döndürür ve bu da ZIP'i bozar.
        // ZIP dosyalarının başlığı 'PK' (0x50, 0x4B) ile başlar.
        const header = new Uint8Array(arrayBuffer, 0, 2);
        if (header.length >= 2 && header[0] !== 0x50 && header[1] !== 0x4B) {
            const textDecoder = new TextDecoder('utf-8');
            const errorText = textDecoder.decode(arrayBuffer.slice(0, 500));
            if (errorText.includes('zamanaşımı') || errorText.toLowerCase().includes('login')) {
                throw new Error('Oturum zamanaşımına uğradı veya yetkisiz erişim. Lütfen çıkış yapıp tekrar girin.');
            }
            throw new Error('GİB sunucusu geçerli bir ZIP dosyası döndürmedi (Olası oturum veya onay hatası).');
        }

        return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="fatura_${uuid}.zip"`,
            },
        });
    } catch (error) {
        console.error('Download error:', error);
        return NextResponse.json({ error: error.message || 'İndirme işlemi başarısız' }, { status: 500 });
    }
}
