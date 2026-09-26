'use client';

import { SiteHeader } from './components/SiteHeader';

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
    return (
        <>
            <SiteHeader />
            <main style={{ gridTemplateColumns: '1fr', maxWidth: 560 }}>
                <div className="card">
                    <h1 className="event-title">Something went wrong</h1>
                    <p className="event-meta">
                        This page didn&rsquo;t load. Trying again usually fixes it.
                        {error.digest ? ` Reference: ${error.digest}` : ''}
                    </p>
                    <button className="cta-button" onClick={() => retry()}>
                        Try Again
                    </button>
                </div>
            </main>
        </>
    );
}
