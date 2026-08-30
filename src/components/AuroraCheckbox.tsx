import { Check } from "lucide-react";
import { ReactNode } from "react";

interface AuroraCheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  required?: boolean;
}

const AuroraCheckbox = ({ id, checked, onChange, label, required }: AuroraCheckboxProps) => {
  return (
    <div onClick={() => onChange(!checked)} className="flex items-start gap-4 cursor-pointer group">
      <div
        id={id}
        role="checkbox"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        tabIndex={0}
        onKeyDown={(e) => {
          // Tastaturbedienung: die Box ist ein div, also muessen Leertaste und
          // Enter von Hand nachgebaut werden (BITV/WCAG 2.1.1).
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            e.stopPropagation()
            onChange(!checked)
          }
        }}
        className={`aurora-checkbox mt-0.5 ${checked ? 'checked' : ''}`}
      >
        {checked && <Check className="w-4 h-4 text-aurora-dark" strokeWidth={3} />}
      </div>
      <span id={`${id}-label`} className="text-base text-white/50 leading-relaxed group-hover:text-white/70 transition-colors duration-300">
        {label}
        {required && <span className="text-aurora-glow ml-1">*</span>}
      </span>
    </div>
  );
};

export default AuroraCheckbox;
