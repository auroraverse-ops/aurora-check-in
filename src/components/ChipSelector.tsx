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
              className={`aurora-chip ${active ? 'active' : ''}`}
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
