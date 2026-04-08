import { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface TimeScrollPickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

const ITEM_H = 48;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2);

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

function WheelColumn({
  items,
  selected,
  onSelect,
}: {
  items: string[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [activeIdx, setActiveIdx] = useState(selected);
  const didMount = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || didMount.current) return;
    el.scrollTop = selected * ITEM_H;
    setActiveIdx(selected);
    didMount.current = true;
  }, [selected]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let fallback: ReturnType<typeof setTimeout>;

    const commitIndex = () => {
      const idx = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      setActiveIdx(clamped);
      onSelectRef.current(clamped);
    };

    const handleScroll = () => {
      const idx = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      setActiveIdx(clamped);

      clearTimeout(fallback);
      fallback = setTimeout(commitIndex, 150);
    };

    const handleScrollEnd = () => {
      clearTimeout(fallback);
      commitIndex();
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    el.addEventListener('scrollend', handleScrollEnd);
    return () => {
      el.removeEventListener('scroll', handleScroll);
      el.removeEventListener('scrollend', handleScrollEnd);
      clearTimeout(fallback);
    };
  }, [items.length]);

  const scrollToIndex = (index: number) => {
    setActiveIdx(index);
    onSelectRef.current(index);
    ref.current?.scrollTo({ top: index * ITEM_H, behavior: 'smooth' });
  };

  return (
    <div className="relative flex-1" style={{ height: ITEM_H * VISIBLE }}>
      <div
        className="absolute inset-x-1.5 rounded-xl bg-white/[0.07] pointer-events-none border border-white/[0.04]"
        style={{ top: PAD * ITEM_H, height: ITEM_H }}
      />

      <div
        className="absolute inset-x-0 top-0 z-10 pointer-events-none"
        style={{
          height: PAD * ITEM_H,
          background: 'linear-gradient(to bottom, oklch(0.18 0 0) 15%, transparent)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
        style={{
          height: PAD * ITEM_H,
          background: 'linear-gradient(to top, oklch(0.18 0 0) 15%, transparent)',
        }}
      />

      <div
        ref={ref}
        className="h-full overflow-y-auto snap-y snap-mandatory overscroll-contain no-scrollbar"
      >
        <div style={{ height: PAD * ITEM_H }} />
        {items.map((item, i) => {
          const dist = Math.abs(i - activeIdx);
          return (
            <div
              key={item}
              className="snap-center flex items-center justify-center cursor-pointer select-none transition-all duration-150 will-change-transform"
              style={{
                height: ITEM_H,
                fontSize: dist === 0 ? '2rem' : dist === 1 ? '1.25rem' : '0.95rem',
                fontWeight: dist === 0 ? 800 : 600,
                opacity: dist === 0 ? 1 : dist === 1 ? 0.3 : 0.1,
                transform: `scale(${dist === 0 ? 1.05 : dist === 1 ? 0.88 : 0.72})`,
              }}
              onClick={() => scrollToIndex(i)}
            >
              {item}
            </div>
          );
        })}
        <div style={{ height: PAD * ITEM_H }} />
      </div>
    </div>
  );
}

export function TimeScrollPicker({ value, onChange, id }: TimeScrollPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parts = value.split(':');
  const hourIdx = Math.min(23, Math.max(0, parseInt(parts[0]) || 0));
  const rawMinutes = parseInt(parts[1]) || 0;
  const minuteIdx = Math.min(11, Math.max(0, Math.round(rawMinutes / 5)));

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative" id={id}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 w-full h-11 px-3.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] active:bg-white/[0.10] transition-all text-left group"
      >
        <Clock
          size={18}
          className={`shrink-0 transition-colors duration-200 ${
            open ? 'text-white' : 'text-white/35 group-hover:text-white/55'
          }`}
        />
        <span className="text-[1.1rem] font-semibold tracking-wider tabular-nums">
          {value}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl bg-[oklch(0.18_0_0)] border border-white/10 shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <div className="flex items-center px-2 py-1.5">
            <WheelColumn
              items={HOURS}
              selected={hourIdx}
              onSelect={(i) => onChange(`${HOURS[i]}:${MINUTES[minuteIdx]}`)}
            />
            <div className="text-2xl font-black text-white/20 self-center select-none">:</div>
            <WheelColumn
              items={MINUTES}
              selected={minuteIdx}
              onSelect={(i) => onChange(`${HOURS[hourIdx]}:${MINUTES[i]}`)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
