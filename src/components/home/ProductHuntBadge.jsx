import React from 'react';
import { motion } from 'framer-motion';

export default function ProductHuntBadge() {
  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="inline-flex items-center justify-center transition-all duration-300"
    >
      <a
        href="https://www.producthunt.com/products/animation-maker?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-animation-maker"
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-[#DA552F]/25 transition-all duration-300"
      >
        <img
          src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1231342&theme=dark&t=1787608959390"
          alt="Animation Maker - Browser-based kinetic typography & video effects studio | Product Hunt"
          width="250"
          height="54"
          className="w-[250px] h-[54px] object-contain block"
          loading="lazy"
        />
      </a>
    </motion.div>
  );
}
