import Link from 'next/link';
import { SiteHeader } from './components/SiteHeader';

export default function NotFound() {
    return (
        <>
            <SiteHeader />
            <main style={{ gridTemplateColumns: '1fr', maxWidth: 560 }}>
                <div className="card">
                    <h1 className="event-title">Not found</h1>
                    <p className="event-meta">
                        This link is invalid or has expired. If you were checking out, start again from the event.
                    </p>
                    <Link className="cta-button" href="/">
                        Find Tickets
                    </Link>
                </div>
            </main>
        </>
    );
}
