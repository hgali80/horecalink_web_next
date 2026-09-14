export default function ProductionIcon({ group, className = 'h-20 w-24' }) {
  return <svg viewBox="0 0 120 90" fill="none" className={className} aria-hidden="true">
    <rect x="1" y="1" width="118" height="88" rx="18" fill={group === 'stainless' ? '#edf2f6' : '#edf5f1'} />
    <g stroke={group === 'stainless' ? '#1d3246' : '#286452'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {group === 'stainless' ? <><path d="M20 37 75 24 101 38 46 53Z" fill="#fff"/><path d="M20 37v8l26 16 55-16v-7M25 48v23m22-11v18m49-31v22M27 65l20 11 47-13M46 53v8"/><path d="m50 36 16-4 12 6-16 4Z" fill="#cad7e1"/><path d="M67 31v-9c0-8 11-8 11-1v3"/></> : <><path d="M24 39h30v34H24z" fill="#fff"/><path d="M24 39c0-9 30-9 30 0s-30 9-30 0Zm0 34c0 8 30 8 30 0M65 29h27l8 44H58Z" fill="#fff"/><path d="M73 30v-7a6 6 0 0 1 12 0v7M68 46h23M68 54h18M31 49v16"/><ellipse cx="39" cy="39" rx="5" ry="2" fill="#aacdbb"/></>}
    </g>
  </svg>;
}
