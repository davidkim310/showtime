import { resumeCheckoutSession } from '@/server/services/checkoutService';
import { readJson } from '../../../readJson';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { surface } = await readJson(request);
    const { status, body } = resumeCheckoutSession(id, surface);
    return Response.json(body, { status });
}
