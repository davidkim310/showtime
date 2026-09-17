import { fetchCheckoutSession } from '@/server/services/checkoutService';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { status, body } = fetchCheckoutSession(id);
    return Response.json(body, { status });
}
