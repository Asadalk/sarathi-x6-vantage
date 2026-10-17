/** Data loop: vehicle → VANTAGE core → consumers → outcomes back into learning. Pure SVG, theme-aware. */
export default function DataFlow({ className = "" }: { className?: string }) {
  const box = (x: number, y: number, w: number, h: number, title: string, lines: string[], fill: string, text = "#fff") => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="14" fill={fill} />
      <text x={x + w / 2} y={y + 24} textAnchor="middle" fontSize="15" fontWeight="700" fill={text} fontFamily="Arial, sans-serif">
        {title}
      </text>
      {lines.map((l, i) => (
        <text key={l} x={x + w / 2} y={y + 44 + i * 17} textAnchor="middle" fontSize="12" fill={text} opacity="0.9" fontFamily="Arial, sans-serif">
          {l}
        </text>
      ))}
    </g>
  );
  const arrow = (x1: number, y1: number, x2: number, y2: number, label?: string) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeWidth="2" markerEnd="url(#arr)" />
      {label && (
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="Arial, sans-serif">
          {label}
        </text>
      )}
    </g>
  );
  return (
    <svg viewBox="0 0 960 400" className={className} role="img" aria-label="VANTAGE data-flow: vehicle telematics to VANTAGE core to fleet ops, driver app, rider app and OEM service, with outcomes fed back into learning">
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" />
        </marker>
      </defs>
      {box(10, 120, 200, 140, "Vehicle (SARATHI-X6)", ["SOC · SOH · cell temps", "GPS · speed · DTCs", "CNG level · door/seat", "ADAS & driver camera"], "#16205C")}
      {arrow(212, 190, 290, 190)}
      <text x="251" y="214" textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="Arial, sans-serif">
        4G/5G
      </text>
      {box(292, 80, 300, 220, "VANTAGE core", ["Demand forecast (zone × hour)", "SOC-aware dispatch", "Charge planner (tariff, queue)", "EV / range-extender mode", "Health model (anomaly → action)", "Bounded-AI explainer", "Deterministic, tested engine"], "#1E4FA8")}
      {arrow(594, 120, 680, 50)}
      {arrow(594, 160, 680, 140)}
      {arrow(594, 220, 680, 240)}
      {arrow(594, 270, 680, 330)}
      {box(682, 14, 268, 72, "Fleet operations", ["Utilisation, uptime, charger load"], "#22B8D8", "#0c1236")}
      {box(682, 104, 268, 72, "Driver app", ["Best next action, earnings, safety"], "#2E9E5B")}
      {box(682, 204, 268, 72, "Rider app", ["Seat mode, ETA, SOS & trip share"], "#F28C28", "#0c1236")}
      {box(682, 294, 268, 72, "OEM service & warranty", ["Predictive parts, pack analytics"], "#D7262E")}
      <path d="M816 368 L816 386 L440 386 L440 304" fill="none" stroke="var(--muted)" strokeWidth="2" strokeDasharray="6 5" markerEnd="url(#arr)" />
      <text x="452" y="376" textAnchor="start" fontSize="12" fill="var(--muted)" fontFamily="Arial, sans-serif">
        outcomes (trips served, ratings, repairs) feed back into learning
      </text>
    </svg>
  );
}
