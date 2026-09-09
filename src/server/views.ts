import { CheckoutSession, CheckoutSessionStatus } from './types/checkout-session';
import { Listing } from './services/inventoryService';
import { PaymentMethod, getPaymentMethod } from './services/paymentMethodsService';
import { signResumeToken } from './resumeToken';

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Embedding server data as JSON for the client to hydrate from — session
// state, listings, anything JSON-serializable. Escaping "<" prevents a
// string field from ever being able to break out of the <script> tag (e.g.
// a value containing "</script>") — defensive even though today's stub
// data can't actually trigger it.
function toEmbeddableJson(data: unknown): string {
    return JSON.stringify(data).replace(/</g, '\\u003c');
}

const styles = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0a0a0a;
    color: #f5f5f5;
  }
  header {
    background: #000;
    padding: 20px 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-bottom: 1px solid #1f1f1f;
  }
  header .title { font-size: 18px; font-weight: 700; letter-spacing: 0.02em; }
  main {
    max-width: 960px;
    margin: 0 auto;
    padding: 32px 20px 120px;
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 32px;
  }
  @media (max-width: 720px) {
    main { grid-template-columns: 1fr; padding-bottom: 140px; }
  }
  .card {
    background: #141414;
    border: 1px solid #262626;
    border-radius: 16px;
    padding: 24px;
  }
  .event-title { font-size: 24px; font-weight: 800; margin: 0 0 4px; }
  .event-meta { color: #a3a3a3; font-size: 14px; margin: 0 0 20px; }
  .price { font-size: 40px; font-weight: 800; margin: 4px 0; }
  .price-old { color: #a3a3a3; text-decoration: line-through; font-size: 18px; margin-right: 8px; }
  .badge {
    display: inline-block;
    background: #1f2937;
    color: #d1d5db;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 4px 10px;
    border-radius: 999px;
    margin: 2px 6px 2px 0;
  }
  .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #262626; font-size: 14px; }
  .summary-row:last-child { border-bottom: none; }
  .summary-total { font-size: 18px; font-weight: 800; }
  .banner {
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
    font-size: 14px;
    font-weight: 600;
    border: 1px solid transparent;
  }
  .banner-active { background: #14201a; border-color: #1f3a2a; color: #9ee6b8; }
  .banner-price_changed { background: #241d0d; border-color: #4a3a10; color: #f2c94c; }
  .banner-expired { background: #260f0f; border-color: #4a1414; color: #f28b8b; }
  .banner-completion_failed { background: #260f0f; border-color: #4a1414; color: #f28b8b; }
  .banner-payment_pending { background: #1a1530; border-color: #322a5c; color: #b9a9f2; }
  .banner-completed { background: #0d2418; border-color: #164a2c; color: #7ee6a8; }
  #countdown-root { color: #a3a3a3; font-size: 14px; margin-bottom: 20px; }
  .sticky-cta {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    padding: 16px 20px calc(16px + env(safe-area-inset-bottom));
    background: linear-gradient(180deg, rgba(10,10,10,0) 0%, #0a0a0a 40%);
  }
  .sticky-cta .inner { max-width: 960px; margin: 0 auto; }
  .cta-button {
    display: block;
    width: 100%;
    text-align: center;
    padding: 16px;
    border-radius: 999px;
    border: none;
    font-size: 16px;
    font-weight: 800;
    cursor: pointer;
    text-decoration: none;
    color: #06210f;
    background: #3ddc84;
    transition: background-color 0.15s ease, transform 0.1s ease;
  }
  .cta-button:hover:not([disabled]) { background: #34c976; }
  .cta-button:active:not([disabled]) { transform: scale(0.98); }
  .cta-button:focus-visible {
    outline: 2px solid #9ee6b8;
    outline-offset: 2px;
  }
  .cta-button[disabled] { opacity: 0.5; cursor: not-allowed; }
  .cta-secondary { background: #262626; color: #f5f5f5; }
  .cta-secondary:hover:not([disabled]) { background: #333333; }
  .cta-note { font-size: 12px; color: #a3a3a3; text-align: center; margin-top: 8px; }
  select, .qty-control { font-size: 16px; }
  .listing-select { background: #0a0a0a; color: #f5f5f5; border: 1px solid #333; border-radius: 8px; padding: 10px; transition: border-color 0.15s ease; }
  .listing-select:hover, .listing-select:focus-visible { border-color: #3ddc84; }
  .view-on-mobile:hover { color: #f5f5f5; }
  .view-on-mobile { display: inline-block; margin-top: 16px; color: #a3a3a3; font-size: 13px; text-decoration: underline; }

  /* --- Payment method form --- */
  .form-field { display: block; margin-bottom: 16px; }
  .form-label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .form-label { color: #a3a3a3; font-size: 14px; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .form-field input {
    width: 100%;
    box-sizing: border-box;
    background: #0a0a0a;
    color: #f5f5f5;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 16px;
    transition: border-color 0.15s ease;
  }
  .form-field input:hover, .form-field input:focus-visible { border-color: #3ddc84; outline: none; }
  .form-field input.input-error { border-color: #f28b8b; }
  .error-message { display: block; margin-top: 6px; color: #f28b8b; font-size: 13px; }
  .issuer-badge {
    display: inline-block;
    background: #1f2937;
    color: #d1d5db;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 3px 8px;
    border-radius: 999px;
  }

  /* --- Mobile deep-link surface: simulated phone shell --- */
  .phone-frame {
    max-width: 390px;
    margin: 40px auto 0;
    border: 8px solid #1a1a1a;
    border-radius: 40px;
    background: #050505;
    overflow: hidden;
    min-height: 720px;
    position: relative;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }
  .phone-statusbar {
    text-align: center;
    font-size: 11px;
    color: #737373;
    padding: 12px 0 6px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 1px solid #1a1a1a;
  }
  .phone-content { padding: 20px 20px 110px; }
  .status-pill {
    display: inline-block;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 14px;
    border-radius: 999px;
    margin-bottom: 16px;
  }
  .status-pill-active { background: #14201a; color: #9ee6b8; }
  .status-pill-price_changed { background: #241d0d; color: #f2c94c; }
  .status-pill-expired, .status-pill-completion_failed { background: #260f0f; color: #f28b8b; }
  .status-pill-payment_pending { background: #1a1530; color: #b9a9f2; }
  .status-pill-completed { background: #0d2418; color: #7ee6a8; }
  .phone-cta-bar {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    padding: 16px 20px calc(16px + env(safe-area-inset-bottom));
    background: linear-gradient(180deg, rgba(5,5,5,0) 0%, #050505 40%);
  }
  .bottom-sheet {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    background: #141414;
    border-top: 1px solid #262626;
    border-radius: 20px 20px 0 0;
    padding: 12px 20px calc(20px + env(safe-area-inset-bottom));
    box-shadow: 0 -8px 30px rgba(0,0,0,0.4);
  }
  .bottom-sheet-handle {
    width: 36px; height: 4px; border-radius: 2px; background: #333;
    margin: 0 auto 16px;
  }
  .bottom-sheet-message { font-size: 14px; font-weight: 700; margin-bottom: 16px; }
  .bottom-sheet-message.tone-warning { color: #f2c94c; }
  .bottom-sheet-message.tone-danger { color: #f28b8b; }
  .bottom-sheet-message.tone-info { color: #b9a9f2; }
  .bottom-sheet-message.tone-success { color: #7ee6a8; }
`;

function listingCard(listing: Listing): string {
    return `
    <a class="card" style="display:block; text-decoration:none; color:inherit;" href="/listings/${escapeHtml(listing.id)}">
      <h2 class="event-title" style="font-size:20px;">${escapeHtml(listing.event.title)}</h2>
      <p class="event-meta">${escapeHtml(listing.event.venue)} · ${escapeHtml(listing.event.city)}</p>
      <p class="price" style="font-size:28px;">$${listing.price.toFixed(2)} <span style="font-size:13px;color:#a3a3a3;font-weight:400;">/ ticket</span></p>
      <p style="color:#a3a3a3; font-size:14px; margin:0;">${listing.availableQty} tickets left</p>
    </a>`;
}

// Browse page — the card grid is plain links to /listings/:id, fully
// functional without JS by default. The search input is disabled until
// hydration (same fallback pattern as the quantity selector on the
// per-listing page below); without JS, a fan still sees the full list,
// they just can't filter it live, which is an acceptable, disclosed
// degradation for a feature that's inherently interactive by nature.
export function renderBrowseListingsPage(listings: Listing[]): string {
    const cards = listings.map(listingCard).join('');

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Checkout Continuity</title>
  <style>${styles}</style>
</head>
<body>
  <header><span class="title">Checkout Continuity</span></header>
  <main style="grid-template-columns: 1fr; max-width: 960px;">
    <div id="listing-search-root">
      <input
        class="listing-search"
        type="search"
        placeholder="Search events…"
        disabled
        style="width:100%; box-sizing:border-box; background:#0a0a0a; color:#f5f5f5; border:1px solid #333; border-radius:8px; padding:12px 14px; font-size:16px; margin-bottom:20px;"
      />
      <div id="listings-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap:20px;">${cards}
      </div>
    </div>
  </main>
  <script id="listings-data" type="application/json">${toEmbeddableJson(listings)}</script>
  <script src="/checkout.js"></script>
</body>
</html>`;
}

export function renderSelectListingPage(listing: Listing): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(listing.event.title)} — Checkout Continuity</title>
  <style>${styles}</style>
</head>
<body>
  <header><span class="title">Checkout Continuity</span></header>
  <main style="grid-template-columns: 1fr; max-width: 560px;">
    <div class="card">
      <h1 class="event-title">${escapeHtml(listing.event.title)}</h1>
      <p class="event-meta">${escapeHtml(listing.event.venue)} · ${escapeHtml(listing.event.city)}</p>
      <div class="badge">Section ${escapeHtml(listing.section)}</div>
      <div class="badge">Row ${escapeHtml(listing.row)}</div>
      <div class="badge">Mobile Transfer Ticket</div>
      <div class="badge">Best Price Guarantee</div>
      <p class="price">$${listing.price.toFixed(2)} <span style="font-size:14px;color:#a3a3a3;font-weight:400;">/ ticket, incl. fees</span></p>
      <p style="color:#a3a3a3; font-size:14px;">${listing.availableQty} tickets left</p>
      <div id="select-root" data-listing-id="${escapeHtml(listing.id)}" data-max-qty="${listing.availableQty}">
        <label style="display:block; margin-bottom:8px; color:#a3a3a3; font-size:14px;">Quantity</label>
        <select class="listing-select" disabled style="margin-bottom:20px; display:block;"><option>2</option></select>
        <button class="cta-button" disabled>CONTINUE</button>
      </div>
    </div>
  </main>
  <script src="/checkout.js"></script>
</body>
</html>`;
}

// Add-a-card page. Same single-centered-card layout as
// renderSelectListingPage; the interactive form is entirely a hydration
// island (#add-payment-method-root) since client-side validation/formatting
// (Luhn, issuer detection, live formatting) has no meaningful no-JS
// fallback beyond a plain disabled input.
export function renderAddPaymentMethodPage(session: CheckoutSession): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Add a card — Checkout Continuity</title>
  <style>${styles}</style>
</head>
<body>
  <header><span class="title">Checkout Continuity</span></header>
  <main style="grid-template-columns: 1fr; max-width: 480px;">
    <div class="card">
      <h1 class="checkout-title" style="font-size:22px; margin:0 0 20px;">Add a card</h1>
      <div id="add-payment-method-root" data-session-id="${escapeHtml(session.id)}">
        <div class="form-field">
          <span class="form-label">Card Number</span>
          <input type="text" placeholder="1234 5678 9012 3456" disabled />
        </div>
        <div class="form-field">
          <span class="form-label">Cardholder Name</span>
          <input type="text" placeholder="Jane Doe" disabled />
        </div>
        <button class="cta-button" disabled>Save Card</button>
      </div>
      <a class="view-on-mobile" href="/checkout/${escapeHtml(session.id)}">&larr; Back to checkout</a>
    </div>
  </main>
  <script src="/checkout.js"></script>
</body>
</html>`;
}

function statusMessage(session: CheckoutSession): string {
    const messages: Record<CheckoutSessionStatus, string> = {
        active: 'Ready to complete your purchase.',
        price_changed: 'Price changed since you started checkout.',
        expired:
            session.expiredReason === 'inventory'
                ? 'These tickets are no longer available.'
                : 'Your checkout hold has expired.',
        payment_pending: "We're confirming your order. Don't refresh or retry payment yet.",
        completed: 'Order complete!',
        completion_failed: "Your payment didn't go through — you haven't been charged. Please try again.",
    };

    return messages[session.status];
}

function statusBanner(session: CheckoutSession): string {
    return `<div class="banner banner-${session.status}">${escapeHtml(statusMessage(session))}</div>`;
}

function priceLine(session: CheckoutSession): string {
    if (session.status === 'price_changed') {
        return `<p class="price"><span class="price-old">$${session.priceAtHold.toFixed(2)}</span>$${session.currentPrice.toFixed(2)}</p>`;
    }
    return `<p class="price">$${session.currentPrice.toFixed(2)}</p>`;
}

// Server-rendered fallback so the button is visible (correct label, correct
// disabled state) even if the client bundle never loads. React replaces this
// with the interactive version once it hydrates — see checkout.tsx.
function ctaFallback(session: CheckoutSession): string {
    switch (session.status) {
        case 'price_changed':
            return `<button class="cta-button" disabled>Accept New Price</button>`;
        case 'expired':
            return `<a class="cta-button" href="/">Find Similar Tickets</a>`;
        case 'payment_pending':
            return `<button class="cta-button cta-secondary" disabled>Check Status</button>`;
        case 'completed': {
            const paymentMethod = getPaymentMethod(session.paymentMethodId);
            const cardNote = paymentMethod
                ? ` &middot; Paid with ${escapeHtml(paymentMethod.brand)} &bull;&bull;&bull;&bull; ${escapeHtml(paymentMethod.last4)}`
                : '';
            return `<button class="cta-button" disabled>View Order</button><p class="cta-note">Order ID: ${escapeHtml(session.orderId ?? '')}${cardNote}</p>`;
        }
        case 'completion_failed':
            return `<button class="cta-button" disabled>Retry Purchase</button>`;
        case 'active':
        default:
            return `<button class="cta-button" disabled>Complete Purchase</button>`;
    }
}

function formatRemaining(ms: number): string {
    if (ms <= 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function renderCheckoutPage(session: CheckoutSession, savedPaymentMethods: PaymentMethod[]): string {
    const total = (session.currentPrice * session.listing.qty).toFixed(2);
    const isCountingDown = session.status === 'active' || session.status === 'price_changed';
    const remainingMs = new Date(session.expiresAt).getTime() - Date.now();

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Checkout — ${escapeHtml(session.event.title)}</title>
  <style>${styles}</style>
</head>
<body>
  <header><span class="title">🛡 Checkout</span></header>
  <main>
    <section>
      ${statusBanner(session)}
      <div id="countdown-root" data-expires-at="${session.expiresAt}" data-status="${session.status}">
        ${isCountingDown ? `Time left to complete purchase: <strong>${formatRemaining(remainingMs)}</strong>` : ''}
      </div>
      ${priceLine(session)}
      <div class="sticky-cta"><div class="inner">
        <div id="cta-root" data-session-id="${session.id}">${ctaFallback(session)}</div>
      </div></div>
    </section>
    <aside class="card">
      <h2 class="event-title" style="font-size:18px;">${escapeHtml(session.event.title)}</h2>
      <p class="event-meta">${new Date(session.event.startsAt).toLocaleString()}</p>
      <div class="summary-row"><span>Venue</span><span>${escapeHtml(session.event.venue)}, ${escapeHtml(session.event.city)}</span></div>
      <div class="summary-row"><span>Section / Row</span><span>${escapeHtml(session.listing.section)} / ${escapeHtml(session.listing.row)}</span></div>
      <div class="summary-row"><span>${session.listing.qty} Seats Together</span><span>Mobile Transfer Ticket</span></div>
      <div class="summary-row summary-total"><span>Total</span><span>$${total}</span></div>
      <a class="view-on-mobile" href="/mobile/checkout/${session.id}?token=${signResumeToken(session.id)}">Continue on mobile →</a>
    </aside>
  </main>
  <script id="session-data" type="application/json">${toEmbeddableJson(session)}</script>
  <script id="payment-methods-data" type="application/json">${toEmbeddableJson(savedPaymentMethods)}</script>
  <script src="/checkout.js"></script>
</body>
</html>`;
}

const STATUS_TONE: Record<CheckoutSessionStatus, 'warning' | 'danger' | 'info' | 'success' | null> = {
    active: null,
    price_changed: 'warning',
    expired: 'danger',
    payment_pending: 'info',
    completed: 'success',
    completion_failed: 'danger',
};

// Mobile deep-link surface. Same session data and same client bundle as the
// desktop checkout page (Countdown/CtaButton don't know or care which shell
// they're mounted into) — only the markup/CSS differ, simulating a phone
// viewport. Recovery states (anything but "active") render as a bottom
// sheet instead of desktop's top banner — the "platform-appropriate
// recovery state" the prompt asks for, not just a resized copy of the web page.
export function renderMobileCheckoutPage(session: CheckoutSession): string {
    const total = (session.currentPrice * session.listing.qty).toFixed(2);
    const isCountingDown = session.status === 'active' || session.status === 'price_changed';
    const remainingMs = new Date(session.expiresAt).getTime() - Date.now();
    const needsRecovery = session.status !== 'active';
    const tone = STATUS_TONE[session.status];

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Checkout (Mobile) — ${escapeHtml(session.event.title)}</title>
  <style>${styles}</style>
</head>
<body>
  <div class="phone-frame">
    <div class="phone-statusbar">Opened from mobile deep link</div>
    <div class="phone-content">
      <span class="status-pill status-pill-${session.status}">${escapeHtml(statusMessage(session))}</span>
      <h1 class="event-title" style="font-size:20px;">${escapeHtml(session.event.title)}</h1>
      <p class="event-meta">${escapeHtml(session.event.venue)} · ${new Date(session.event.startsAt).toLocaleDateString()}</p>
      <div class="summary-row"><span>Section / Row</span><span>${escapeHtml(session.listing.section)} / ${escapeHtml(session.listing.row)}</span></div>
      <div class="summary-row"><span>${session.listing.qty} Seats Together</span><span>Mobile Transfer</span></div>
      <div class="summary-row summary-total"><span>Total</span><span>$${total}</span></div>
      <div id="countdown-root" data-expires-at="${session.expiresAt}" data-status="${session.status}" style="margin-top:16px;">
        ${isCountingDown ? `Time left: <strong>${formatRemaining(remainingMs)}</strong>` : ''}
      </div>
    </div>
    ${
        needsRecovery
            ? `<div class="bottom-sheet">
        <div class="bottom-sheet-handle"></div>
        <p class="bottom-sheet-message${tone ? ` tone-${tone}` : ''}">${escapeHtml(statusMessage(session))}</p>
        <div id="cta-root" data-session-id="${session.id}">${ctaFallback(session)}</div>
      </div>`
            : `<div class="phone-cta-bar">
        <div id="cta-root" data-session-id="${session.id}">${ctaFallback(session)}</div>
      </div>`
    }
  </div>
  <script id="session-data" type="application/json">${toEmbeddableJson(session)}</script>
  <script src="/checkout.js"></script>
</body>
</html>`;
}
