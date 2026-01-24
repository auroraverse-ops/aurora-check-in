import { Check } from "lucide-react";

interface AuroraCheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  required?: boolean;
}

const AuroraCheckbox = ({ id, checked, onChange, label, required }: AuroraCheckboxProps) => {
  return (
    <label htmlFor={id} className="flex items-start gap-3 cursor-pointer group">
      <button
        type="button"
        id={id}
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`aurora-checkbox mt-0.5 ${checked ? 'checked' : ''}`}
      >
        {checked && <Check className="w-3.5 h-3.5 text-aurora-dark" strokeWidth={3} />}
      </button>
      <span className="text-sm text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
        {label}
        {required && <span className="text-aurora-glow ml-1">*</span>}
      </span>
    </label>
  );
};

export default AuroraCheckbox;
