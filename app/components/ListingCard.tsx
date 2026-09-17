import Link from 'next/link';
import type { Listing } from '@/server/services/inventoryService';

export function ListingCard({ listing }: { listing: Listing }) {
    return (
        <Link
            className="card"
            style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
            href={`/listings/${listing.id}`}
        >
            <h2 className="event-title" style={{ fontSize: 20 }}>
                {listing.event.title}
            </h2>
            <p className="event-meta">
                {listing.event.venue} · {listing.event.city}
            </p>
            <p className="price" style={{ fontSize: 28 }}>
                ${listing.price.toFixed(2)}{' '}
                <span style={{ fontSize: 13, color: '#a3a3a3', fontWeight: 400 }}>/ ticket</span>
            </p>
            <p style={{ color: '#a3a3a3', fontSize: 14, margin: 0 }}>{listing.availableQty} tickets left</p>
        </Link>
    );
}
