/** Original stylised side-view of the SARATHI-X6 6+1 compact MPV (no photos, no brand marks). */
export default function VehicleArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 300" className={className} role="img" aria-label="Illustration of the SARATHI-X6 compact MPV, side view">
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a3a86" />
          <stop offset="1" stopColor="#16205c" />
        </linearGradient>
        <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9fd9ec" />
          <stop offset="1" stopColor="#3f6db8" />
        </linearGradient>
        <radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.28" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="320" cy="262" rx="270" ry="16" fill="url(#shadow)" />
      {/* body */}
      <path
        d="M58 214 C52 190 60 168 86 160 L150 146 C178 108 214 74 262 66 L470 62 C510 62 540 84 562 120 L590 156 C606 166 612 186 608 214 Z"
        fill="url(#body)"
      />
      {/* roof rails */}
      <path d="M262 58 L470 54" stroke="#c9d3ef" strokeWidth="5" strokeLinecap="round" />
      {/* windows */}
      <path d="M168 148 C192 116 222 90 262 84 L300 82 L300 148 Z" fill="url(#glass)" />
      <rect x="310" y="81" width="104" height="67" rx="6" fill="url(#glass)" />
      <path d="M424 80 L470 79 C500 80 522 98 540 128 L548 148 L424 148 Z" fill="url(#glass)" />
      {/* pillars */}
      <rect x="300" y="80" width="10" height="70" fill="#16205c" />
      <rect x="414" y="79" width="10" height="70" fill="#16205c" />
      {/* door seams */}
      <path d="M300 152 L300 212 M414 152 L414 212" stroke="#0e1544" strokeWidth="2" />
      {/* cyan light signature + side character line */}
      <path d="M86 176 L560 168" stroke="#22b8d8" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
      <path d="M62 184 L104 170" stroke="#22b8d8" strokeWidth="6" strokeLinecap="round" />
      <path d="M588 166 L606 170" stroke="#d7262e" strokeWidth="6" strokeLinecap="round" />
      {/* lower cladding */}
      <path d="M70 214 L600 214 L596 200 L74 204 Z" fill="#0e1544" />
      {/* charge port + CNG filler */}
      <rect x="120" y="150" width="20" height="12" rx="3" fill="#22b8d8" />
      <circle cx="548" cy="180" r="7" fill="#2e9e5b" />
      {/* wheels */}
      {[170, 500].map((x) => (
        <g key={x}>
          <circle cx={x} cy="214" r="44" fill="#0b0f2a" />
          <circle cx={x} cy="214" r="28" fill="#c9d3ef" />
          <circle cx={x} cy="214" r="10" fill="#16205c" />
          {[0, 72, 144, 216, 288].map((a) => (
            <rect key={a} x={x - 3} y={190} width="6" height="18" rx="2" fill="#16205c" transform={`rotate(${a} ${x} 214)`} />
          ))}
        </g>
      ))}
      <text x="330" y="196" fontSize="16" fontWeight="700" fill="#c9d3ef" fontFamily="Arial, sans-serif" letterSpacing="2">
        SARATHI-X6
      </text>
    </svg>
  );
}
