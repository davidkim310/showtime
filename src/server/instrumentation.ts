// Stub instrumentation — logs structured events to stdout so the shape of a
// real analytics pipeline is visible without building one. A real
// implementation would ship these to an events table/warehouse; here,
// logging is the entire "pipeline." Enough to compute things like
// resume-to-completion conversion by grepping/aggregating these lines.
export type InstrumentationEvent =
    | 'session_created'
    | 'session_resumed'
    | 'price_changed_shown'
    | 'expired_shown'
    | 'completion_attempted'
    | 'completion_succeeded'
    | 'completion_failed'
    | 'duplicate_prevented'
    | 'payment_method_added';

export function logEvent(event: InstrumentationEvent, data: Record<string, unknown> = {}): void {
    console.log(JSON.stringify({ event, timestamp: new Date().toISOString(), ...data }));
}
