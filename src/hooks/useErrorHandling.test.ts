/**
 * Unit tests for useErrorHandling hook.
 * Validates: Requirements 29.1, 29.3, 29.4, 29.5
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { classifyError } from './useErrorHandling';

describe('useErrorHandling', () => {
  describe('classifyError', () => {
    it('classifies timeout errors', () => {
      expect(classifyError(new Error('Request timed out after 10s'))).toBe('url_timeout');
      expect(classifyError(new Error('Connection timeout'))).toBe('url_timeout');
    });

    it('classifies invalid URL errors', () => {
      expect(classifyError(new Error('Invalid Moxfield URL'))).toBe('url_invalid');
      expect(classifyError(new Error('Invalid Archidekt URL'))).toBe('url_invalid');
    });

    it('classifies Scryfall unavailable errors', () => {
      expect(classifyError(new Error('Service unavailable'))).toBe('scryfall_unavailable');
    });

    it('classifies network errors', () => {
      expect(classifyError(new Error('Failed to fetch'))).toBe('network_error');
      expect(classifyError(new Error('Network error'))).toBe('network_error');
    });

    it('classifies unknown errors', () => {
      expect(classifyError(new Error('Something weird happened'))).toBe('unknown');
      expect(classifyError('not an error object')).toBe('unknown');
      expect(classifyError(null)).toBe('unknown');
    });
  });
});
