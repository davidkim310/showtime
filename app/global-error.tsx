'use client';

import './globals.css';

// Last resort: this replaces the root layout, so it renders its own html/body.
// It cannot rely on anything the layout provides.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
    return (
        <html lang="en">
            <body>
                <main style={{ gridTemplateColumns: '1fr', maxWidth: 560 }}>
                    <div className="card">
                        <h1 className="event-title">Showtime is having a problem</h1>
                        <p className="event-meta">
                            Something failed to load outside any one page.
                            {error.digest ? ` Reference: ${error.digest}` : ''}
                        </p>
                        <button className="cta-button" onClick={() => retry()}>
                            Try Again
                        </button>
                    </div>
                </main>
            </body>
        </html>
    );
}
