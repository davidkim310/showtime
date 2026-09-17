import { CheckoutSession } from '../types/checkout-session';
import { persistent } from './moduleState';

// The single seam between checkout logic and wherever sessions actually live.
const sessions = persistent('__showtime_sessions', () => new Map<string, CheckoutSession>());

export function getSession(id: string): CheckoutSession | undefined {
    return sessions.get(id);
}

export function saveSession(session: CheckoutSession): void {
    sessions.set(session.id, session);
}
