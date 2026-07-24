import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const AdPlaceholder = ({ className = '' }) => {
  const adRef = useRef(null);
  const adPushed = useRef(false);
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    // Check if we are running on localhost
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      setIsLocalhost(true);
      return;
    }

    // Wait for the next tick to allow flex layouts to paint and assign widths
    const timer = setTimeout(() => {
      if (!adPushed.current && typeof window !== 'undefined' && !isLocalhost) {
        try {
          const wrapperWidth = adRef.current?.parentElement?.offsetWidth || 0;
          console.log(`[AdSense Debug] Attempting to push ad. Wrapper width: ${wrapperWidth}px`);
          
          if (wrapperWidth === 0) {
            console.warn('[AdSense Debug] Wrapper width is 0. AdSense might throw "No slot size" error.');
          }

          const adsbygoogle = window.adsbygoogle || [];
          adsbygoogle.push({});
          adPushed.current = true;
          console.log('[AdSense Debug] Ad pushed successfully.');
        } catch (error) {
          console.error('[AdSense Debug] AdSense initialization error:', error);
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isLocalhost]);

  if (isLocalhost) {
    return (
      <div 
        className={`relative overflow-hidden w-full h-full flex flex-col items-center justify-center bg-zinc-900/40 border border-dashed border-zinc-700 rounded-xl ${className}`}
        style={{ minWidth: '150px', minHeight: '100px' }}
      >
        <span className="text-zinc-500 font-bold text-xs uppercase tracking-widest mb-1">Google AdSense</span>
        <span className="text-zinc-600 text-[10px] text-center px-2">
          (Reklamlar localhost'ta 400 hatası verdiği için gizlendi. Canlıda aktif olacak.)
        </span>
      </div>
    );
  }

  return (
    <div 
      className={`relative overflow-hidden w-full h-full flex items-center justify-center bg-zinc-900/40 border border-dashed border-zinc-700 rounded-xl ${className}`}
      style={{ minWidth: '150px' }}
      // Important: React shouldn't update the children of this div because Google will mutate the DOM
    >
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: '100%' }}
        data-ad-client="ca-pub-4258481663841045"
        data-ad-slot="6112255389"
        data-ad-format="auto"
        data-full-width-responsive="true"
        data-ad-test="on"
      ></ins>
    </div>
  );
};

export default AdPlaceholder;
