'use client';

import { useState, useRef, useEffect } from 'react';

type Option = { value: string; label: string };

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  id?: string;
};

export default function Select({ value, onChange, options, id }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="custom-select" ref={ref} id={id}>
      <button
        type="button"
        className={`custom-select-btn ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{selected?.label ?? '—'}</span>
        <span className="custom-select-arrow">{open ? '↑' : '↓'}</span>
      </button>
      {open && (
        <div className="custom-select-list">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`custom-select-opt ${o.value === value ? 'is-active' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              {o.value === value && <span className="custom-select-check">●</span>}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
