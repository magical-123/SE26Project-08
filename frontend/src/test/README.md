# Frontend CI test scope

O3 restores five existing suites from `FinalRelease/前端测试报告及代码/frontend/src/test`:

- `api.test.js`: authenticated requests, expiry handling, API errors and login/register.
- `utils.test.js`: cache expiry, quota errors and offline state.
- `components.test.jsx`: core cards, confirmation dialogs and toast behavior.
- `graphShared.test.jsx`: shared graph transformation logic.
- `useInboxItems.test.js`: loading, filtering and pagination behavior.

These contain 205 test cases and mock external requests. No database, Redis,
crawler or live user account is required. Vitest fails if no tests are found.

The complete historical suite remains in `FinalRelease`. A trial of all 864
archived tests found 333 failures caused by outdated page fixtures, missing
Tour/Router providers and changed navigation expectations. Those page suites
have not been adopted as the current CI baseline. This migration makes no claim
of whole-application coverage or backend integration testing.
