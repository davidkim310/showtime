// Stub payment gateway. Defaults to succeeding; setNextPaymentResult lets
// tests (and the /debug routes) force a specific outcome deterministically —
// mirrors inventoryService's setListingPrice/markListingSoldOut stub pattern.
import { persistent } from './moduleState';

const state = persistent('__showtime_payment', () => ({ nextResult: true }));

export function setNextPaymentResult(succeeds: boolean): void {
    state.nextResult = succeeds;
}

export function resetPaymentResult(): void {
    state.nextResult = true;
}

// The artificial delay isn't just flavor — an instantly-resolving stub would
// never create a real window for two concurrent /complete calls to race,
// which would make the duplicate-completion test pass without actually
// exercising the race condition it's meant to verify.
export function attemptPayment(): Promise<boolean> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(state.nextResult), 30);
    });
}
