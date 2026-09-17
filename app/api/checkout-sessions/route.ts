import { createCheckoutSession } from '@/server/services/checkoutService';

export async function POST(request: Request) {
    const { status, body } = createCheckoutSession(await request.json());
    return Response.json(body, { status });
}
