import type { Listing } from '@/server/services/inventoryService';
import { SelectListing } from './SelectListing';

export function ListingDetails({ listing }: { listing: Listing }) {
    return (
        <div className="card">
            <h1 className="event-title">{listing.event.title}</h1>
            <p className="event-meta">
                {listing.event.venue} · {listing.event.city}
            </p>
            <div className="badge">Section {listing.section}</div>
            <div className="badge">Row {listing.row}</div>
            <div className="badge">Mobile Transfer Ticket</div>
            <div className="badge">Best Price Guarantee</div>
            <p className="price">
                ${listing.price.toFixed(2)}{' '}
                <span style={{ fontSize: 14, color: '#a3a3a3', fontWeight: 400 }}>/ ticket, incl. fees</span>
            </p>
            <p style={{ color: '#a3a3a3', fontSize: 14 }}>{listing.availableQty} tickets left</p>
            <SelectListing listingId={listing.id} maxQty={listing.availableQty} />
        </div>
    );
}
