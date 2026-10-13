import React from 'react';

// Generic oil rig (derrick) mark used as the app logo
export const OilRigLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Oil rig logo">
    <title>Oil rig</title>
    {/* Derrick tower */}
    <path d="M24 4 L14 38 M24 4 L34 38" stroke="#003057" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M21.4 13 H26.6 M18.8 22 H29.2 M16.2 31 H31.8" stroke="#003057" strokeWidth="2" strokeLinecap="round" />
    <path d="M21.4 13 L29.2 22 L16.2 31 M26.6 13 L18.8 22 L31.8 31" stroke="#0066a1" strokeWidth="1.4" strokeLinecap="round" />
    {/* Crown block */}
    <rect x="21" y="2" width="6" height="3.5" rx="1" fill="#003057" />
    {/* Drill floor / platform */}
    <rect x="8" y="37" width="32" height="4" rx="1" fill="#003057" />
    <path d="M12 41 V46 M36 41 V46" stroke="#003057" strokeWidth="2.6" strokeLinecap="round" />
    {/* Flag */}
    <path d="M27 4.5 L33 6.5 L27 8.5 Z" fill="#e67e22" />
  </svg>
);
