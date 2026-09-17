import { acknowledgePrice } from '@/server/services/checkoutService';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { status, body } = acknowledgePrice(id);
    return Response.json(body, { status });
}
