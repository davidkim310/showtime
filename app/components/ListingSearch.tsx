'use client';

import { useEffect, useState } from 'react';
import type { Listing } from '@/server/services/inventoryService';
import { ListingCard } from './ListingCard';

export function ListingSearch({ initialListings }: { initialListings: Listing[] }) {
    const [query, setQuery] = useState('');
    const [listings, setListings] = useState(initialListings);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Debounced, cancel-on-every-keystroke: a genuine debounce, not just a
    // delay — without clearing the previous timeout, every keystroke would
    // still eventually fire its own request, just later, defeating the
    // point of debouncing at all. An empty query skips the API entirely and
    // reverts to the original full list, matching the default "nothing
    // typed yet" view rather than showing an empty result set.
    useEffect(() => {
        if (!query.trim()) {
            setListings(initialListings);
            setLoading(false);
            setError(null);
            return;
        }

        // clearTimeout only cancels a timer that hasn't fired yet — it can't
        // cancel a fetch already in flight. Without this flag, a slow
        // earlier request that resolves after a faster later one would
        // silently overwrite the newer, more relevant results.
        let cancelled = false;
        setLoading(true);
        setError(null);

        const timeoutId = setTimeout(async () => {
            try {
                const res = await fetch(`/api/listings/search?q=${encodeURIComponent(query)}`);
                if (!res.ok) throw new Error('Search request failed');
                const data = await res.json();
                if (!cancelled) setListings(data.listings);
            } catch {
                if (!cancelled) setError('Something went wrong searching — please try again.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [query, initialListings]);

    return (
        <div>
            <input
                className="listing-search"
                type="search"
                placeholder="Search events…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#0a0a0a',
                    color: '#f5f5f5',
                    border: '1px solid #333',
                    borderRadius: 8,
                    padding: '12px 14px',
                    fontSize: 16,
                    marginBottom: 20,
                }}
            />
            {loading && <p style={{ color: '#a3a3a3', fontSize: 14 }}>Search in progress…</p>}
            {error && <p style={{ color: '#f28b8b', fontSize: 14 }}>{error}</p>}
            {!loading && !error && listings.length === 0 && (
                <p style={{ color: '#a3a3a3', fontSize: 14 }}>No results found.</p>
            )}
            {!loading && !error && listings.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
                    {listings.map((listing) => (
                        <ListingCard key={listing.id} listing={listing} />
                    ))}
                </div>
            )}
        </div>
    );
}
