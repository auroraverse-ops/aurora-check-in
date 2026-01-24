import { Glasses, Eye, EyeOff } from "lucide-react";

interface SehhilfeCardProps {
  type: "brille" | "kontaktlinsen" | "keine";
  label: string;
  active: boolean;
  onClick: () => void;
}

const SehhilfeCard = ({ type, label, active, onClick }: SehhilfeCardProps) => {
  const icons = {
    brille: Glasses,
    kontaktlinsen: Eye,
    keine: EyeOff,
  };

  const Icon = icons[type];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`aurora-card flex-1 ${active ? 'active' : ''}`}
    >
      <Icon 
        className={`w-8 h-8 mb-3 transition-all duration-300 ${
          active ? 'text-aurora-glow drop-shadow-[0_0_12px_rgba(57,224,120,0.6)]' : 'text-white/40'
        }`} 
        strokeWidth={1.5}
      />
      <span className={`text-sm font-medium tracking-wide transition-all duration-300 ${
        active ? 'text-white' : 'text-white/50'
      }`}>
        {label}
      </span>
    </button>
  );
};

export default SehhilfeCard;
