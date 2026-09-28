import { SiteHeader } from '../components/SiteHeader';

// A route group: "(shop)" is left out of the URL, so the browse page still
// serves "/". It exists so "/" and "/listings/*" can share this header without
// putting it in the root layout, which would also wrap checkout and mobile.
export default function ShopLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <SiteHeader />
            {children}
        </>
    );
}
