import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Unmount rendered trees between tests so DOM queries never see stale output.
afterEach(() => cleanup());
