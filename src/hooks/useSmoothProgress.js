import { useState, useEffect, useRef } from 'react';

const PROGRESS_THRESHOLD = 0.1;

export function useSmoothProgress(targetProgress) {
  const [currentProgress, setCurrentProgress] = useState(0);
  const animationFrameId = useRef(null);

  useEffect(() => {
    const animate = () => {
      setCurrentProgress(prev => {
        const diff = targetProgress - prev;
        
        if (Math.abs(diff) < PROGRESS_THRESHOLD) {
          cancelAnimationFrame(animationFrameId.current);
          return targetProgress;
        }

        return prev + diff * 0.1;
      });
      animationFrameId.current = requestAnimationFrame(animate);
    };

    animationFrameId.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [targetProgress]);

  return currentProgress;
}