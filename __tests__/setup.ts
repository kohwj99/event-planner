import { vi } from 'vitest';

// Suppress console output during tests to keep output clean
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
