import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useViewportScale } from './useViewportScale';

describe('useViewportScale', () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true });
  });

  it('computes scale as min(width/2560, height/1440)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });

    const { result } = renderHook(() => useViewportScale());

    // 1920/2560 = 0.75, 1080/1440 = 0.75 → min = 0.75
    expect(result.current).toBe(0.75);
  });

  it('returns width-constrained scale when width ratio is smaller', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1440, writable: true });

    const { result } = renderHook(() => useViewportScale());

    // 1280/2560 = 0.5, 1440/1440 = 1.0 → min = 0.5
    expect(result.current).toBe(0.5);
  });

  it('returns height-constrained scale when height ratio is smaller', () => {
    Object.defineProperty(window, 'innerWidth', { value: 2560, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 720, writable: true });

    const { result } = renderHook(() => useViewportScale());

    // 2560/2560 = 1.0, 720/1440 = 0.5 → min = 0.5
    expect(result.current).toBe(0.5);
  });

  it('updates on window resize', () => {
    Object.defineProperty(window, 'innerWidth', { value: 2560, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1440, writable: true });

    const { result } = renderHook(() => useViewportScale());
    expect(result.current).toBe(1);

    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 720, writable: true });
      window.dispatchEvent(new Event('resize'));
    });

    // 1280/2560 = 0.5, 720/1440 = 0.5 → min = 0.5
    expect(result.current).toBe(0.5);
  });

  it('cleans up resize listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useViewportScale());
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeSpy.mockRestore();
  });
});
