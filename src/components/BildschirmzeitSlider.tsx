interface BildschirmzeitSliderProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  hint?: string;
}

const BildschirmzeitSlider = ({ value, onChange, label, hint }: BildschirmzeitSliderProps) => {
  return (
    <div className="space-y-4 pt-2">
      <label className="form-label">
        {label ?? "Durchschnittliche tägliche Bildschirmzeit"}
        {hint && <span className="block text-xs font-normal text-white/40 mt-1">{hint}</span>}
      </label>
      <div className="glass-input-wrapper px-5 py-5">
        <div className="w-full space-y-4">
          <div className="flex justify-between items-baseline">
            <span className="text-3xl font-bold text-white">
              {value} <span className="text-base font-normal text-white/50">Stunden / Tag</span>
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={16}
            step={1}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              accentColor: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))',
              background: `linear-gradient(to right,
                hsl(var(--brand-h) var(--brand-s) var(--brand-l)) 0%,
                hsl(var(--brand-h) var(--brand-s) var(--brand-l)) ${(value / 16) * 100}%,
                rgba(255,255,255,0.1) ${(value / 16) * 100}%,
                rgba(255,255,255,0.1) 100%)`,
            }}
          />
          <div className="flex justify-between text-xs text-white/30">
            <span>0h</span>
            <span>8h</span>
            <span>16h</span>
          </div>
          <p className="text-xs text-white/30 mt-1">
            Durchschnitt in Deutschland: 10 Stunden (18-80 Jährige)
          </p>
        </div>
      </div>
    </div>
  );
};

export default BildschirmzeitSlider;
