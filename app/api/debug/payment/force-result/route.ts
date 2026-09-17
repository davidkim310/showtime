import { setNextPaymentResult } from '@/server/services/paymentService';
import { blockedInProduction } from '../../guard';
import { readJson } from '../../../readJson';

export async function POST(request: Request) {
    const blocked = blockedInProduction();
    if (blocked) return blocked;

    const { succeeds } = await readJson(request);
    setNextPaymentResult(Boolean(succeeds));
    return Response.json({ ok: true });
}
