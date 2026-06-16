import { useState, useEffect } from 'react';
import { STREAM_RESOLUTION } from './constants';

export function useViewportScale(): number {
  const [scale, setScale] = useState(() => {
    const sx = window.innerWidth / STREAM_RESOLUTION.width;
    const sy = window.innerHeight / STREAM_RESOLUTION.height;
    return Math.min(sx, sy);
  });

  useEffect(() => {
    const update = () => {
      const sx = window.innerWidth / STREAM_RESOLUTION.width;
      const sy = window.innerHeight / STREAM_RESOLUTION.height;
      setScale(Math.min(sx, sy));
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return scale;
}
