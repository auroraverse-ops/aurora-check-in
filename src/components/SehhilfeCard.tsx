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
        className={`w-7 h-7 mb-2 transition-colors duration-300 ${
          active ? 'text-aurora-glow' : 'text-muted-foreground'
        }`} 
        strokeWidth={1.5}
      />
      <span className={`text-sm font-medium transition-colors duration-300 ${
        active ? 'text-foreground' : 'text-muted-foreground'
      }`}>
        {label}
      </span>
    </button>
  );
};

export default SehhilfeCard;
