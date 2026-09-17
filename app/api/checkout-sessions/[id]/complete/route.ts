import { completeCheckout } from '@/server/services/checkoutService';
import { readJson } from '../../../readJson';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { status, body } = await completeCheckout(id, await readJson(request));
    return Response.json(body, { status });
}
