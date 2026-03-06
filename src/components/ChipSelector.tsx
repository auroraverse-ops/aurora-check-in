interface ChipSelectorProps {
  label: string;
  options: string[];
  noneOption: string;
  selected: string[];
  onChange: (selected: string[]) => void;
}

const ChipSelector = ({ label, options, noneOption, selected, onChange }: ChipSelectorProps) => {
  const handleToggle = (option: string) => {
    if (option === noneOption) {
      onChange(selected.includes(noneOption) ? [] : [noneOption]);
      return;
    }

    const withoutNone = selected.filter((s) => s !== noneOption);
    const isSelected = withoutNone.includes(option);
    onChange(isSelected ? withoutNone.filter((s) => s !== option) : [...withoutNone, option]);
  };

  return (
    <div className="space-y-4 pt-2">
      <label className="form-label">{label}</label>
      <div className="grid grid-cols-2 gap-3">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => handleToggle(option)}
              className={`py-3 px-4 rounded-xl text-base font-semibold tracking-wide transition-all duration-300 text-center ${
                active
                  ? "bg-[rgba(57,224,120,0.15)] border border-[#39E078] text-white shadow-[0_0_20px_rgba(57,224,120,0.2)]"
                  : "bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] text-white/50 hover:border-[rgba(255,255,255,0.15)] hover:text-white/70"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ChipSelector;
