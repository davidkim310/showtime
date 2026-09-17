export function SiteHeader({ title = 'Checkout Continuity' }: { title?: string }) {
    return (
        <header>
            <span className="title">{title}</span>
        </header>
    );
}
