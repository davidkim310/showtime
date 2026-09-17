import { resetListing } from '@/server/services/inventoryService';
import { blockedInProduction } from '../../../guard';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const blocked = blockedInProduction();
    if (blocked) return blocked;

    const { id } = await params;
    resetListing(id);
    return Response.json({ ok: true });
}
