import { addSessionPaymentMethod } from '@/server/services/checkoutService';
import { readJson } from '../../../readJson';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { status, body } = addSessionPaymentMethod(id, await readJson(request));
    return Response.json(body, { status });
}
