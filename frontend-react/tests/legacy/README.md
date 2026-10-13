# Legacy Vanilla tests

These tests run the root-level `main.js` and `map_manager.js` scripts in a mocked browser context. They exercise compatibility behavior of the original Vanilla frontend, not the React components.

Run them separately with `npm run test:legacy`. The React suite run by `npm test` intentionally covers only `src/**/*.test.js`; the mixed Marketplace React bearer/refresh tests remain in `src/pages/marketplaceAuth.test.js`.
