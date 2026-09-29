import { SiteHeader } from '../components/SiteHeader';

// A route group: "(shop)" is left out of the URL, so the browse page still
// serves "/". It exists so "/" and "/listings/*" can share this header without
// putting it in the root layout, which would also wrap checkout and mobile.
// `modal` is the @modal slot: rendered alongside the page, not instead of it,
// so an intercepted listing appears over the browse page rather than replacing it.
export default function ShopLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
    return (
        <>
            <SiteHeader />
            {children}
            {modal}
        </>
    );
}
