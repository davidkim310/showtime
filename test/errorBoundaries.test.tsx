import { renderToStaticMarkup } from 'react-dom/server';
import AppError from '../app/error';
import CheckoutError from '../app/checkout/[id]/error';
import GlobalError from '../app/global-error';

const error = Object.assign(new Error('boom'), { digest: 'abc123' });
const retry = () => {};

describe('error boundaries', () => {
    test('the app-wide boundary offers a retry and quotes the digest', () => {
        const markup = renderToStaticMarkup(<AppError error={error} retry={retry} />);

        expect(markup).toContain('Something went wrong');
        expect(markup).toContain('Try Again');
        expect(markup).toContain('Reference: abc123');
    });

    // This boundary can appear right after a buyer pressed Complete Purchase,
    // so it must not invite a second payment attempt.
    test('the checkout boundary points at reloading, not re-paying', () => {
        const markup = renderToStaticMarkup(<CheckoutError error={error} retry={retry} />);

        expect(markup).toContain('We couldn’t load your checkout');
        expect(markup).toContain('Don’t enter your payment details again');
        expect(markup).toContain('Reload Checkout');
        expect(markup).not.toContain('Complete Purchase');
        expect(markup).not.toContain('Retry Purchase');
    });

    test('the global boundary renders its own document, since it replaces the root layout', () => {
        const markup = renderToStaticMarkup(<GlobalError error={error} retry={retry} />);

        expect(markup).toContain('<html lang="en">');
        expect(markup).toContain('<body>');
        expect(markup).toContain('Showtime is having a problem');
    });

    test('a missing digest leaves no dangling reference text', () => {
        const markup = renderToStaticMarkup(<AppError error={new Error('boom')} retry={retry} />);

        expect(markup).not.toContain('Reference:');
    });
});
