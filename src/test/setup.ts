import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Tests run against fakes and recorded fixtures only (CLAUDE.md §5); any real request fails loudly.
vi.stubGlobal('fetch', () => Promise.reject(new Error('Tests must not use the network. Inject a fake fetch.')));

// Unmount rendered trees between tests so DOM queries never see stale output.
afterEach(() => cleanup());

// Whole-app tests wait on several async loads; the 1 s default flakes when the full suite loads the machine.
configure({ asyncUtilTimeout: 4000 });
