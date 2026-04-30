import type { HttpHandler } from 'msw';

/**
 * Default MSW handlers (empty by design).
 * Tests register their own handlers via server.use(...) per case.
 * This keeps the test surface explicit — every external call must be
 * mocked deliberately or the request fails (onUnhandledRequest: 'error').
 */
export const handlers: HttpHandler[] = [];
