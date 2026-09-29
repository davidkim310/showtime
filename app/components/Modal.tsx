'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// A native <dialog> opened with showModal(): the browser supplies the dialog
// role, focus trapping and Escape handling. Every way of closing it goes back
// in history, so the page underneath is exactly as the buyer left it.
export function Modal({ label, children }: { label: string; children: React.ReactNode }) {
    const router = useRouter();
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal();
        // Next hides a route you navigate away from instead of unmounting it.
        // An open modal dialog makes the rest of the document inert, so one left
        // open while hidden would freeze whatever page comes next. Closing it
        // here fires no navigation: there is deliberately no onClose handler.
        return () => dialog?.close();
    }, []);

    return (
        <dialog
            ref={dialogRef}
            className="modal"
            aria-label={label}
            onCancel={(event) => {
                // Escape: navigate back and let the route change close it.
                event.preventDefault();
                router.back();
            }}
            onClick={(event) => {
                // A click on the backdrop lands on the dialog element itself.
                if (event.target === event.currentTarget) router.back();
            }}
        >
            <button type="button" className="modal-close" aria-label="Close" onClick={() => router.back()}>
                ×
            </button>
            {children}
        </dialog>
    );
}
