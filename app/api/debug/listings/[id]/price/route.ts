import { setListingPrice } from '@/server/services/inventoryService';
import { blockedInProduction } from '../../../guard';
import { readJson } from '../../../../readJson';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const blocked = blockedInProduction();
    if (blocked) return blocked;

    const { id } = await params;
    const { price } = await readJson(request);
    setListingPrice(id, price);
    return Response.json({ ok: true });
}
