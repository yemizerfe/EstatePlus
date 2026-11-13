import React from 'react';

/**
 * ArtisticBackground
 * Fixed, non-interactive ambience layer rendered once per layout so EVERY page
 * shares the same living backdrop: drifting aurora light blobs, a fading
 * blueprint grid, and a film-grain noise pass. Purely decorative (aria-hidden),
 * GPU-friendly (transform/opacity only), and disabled-motion aware.
 */
const ArtisticBackground: React.FC = () => {
  return (
    <div aria-hidden="true" className="art-bg">
      {/* Drifting aurora light */}
      <div className="art-blob art-blob-1" />
      <div className="art-blob art-blob-2" />
      <div className="art-blob art-blob-3" />
      {/* Blueprint grid, fading out downward */}
      <div className="art-grid" />
      {/* Film grain for depth */}
      <div className="art-noise" />
    </div>
  );
};

export default ArtisticBackground;
