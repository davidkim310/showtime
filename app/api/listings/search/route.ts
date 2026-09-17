import { searchListings } from '@/server/services/inventoryService';

export async function GET(request: Request) {
    const query = new URL(request.url).searchParams.get('q') ?? '';
    return Response.json({ listings: searchListings(query) });
}
