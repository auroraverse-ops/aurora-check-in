import { InputHTMLAttributes, forwardRef } from "react";

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, id, className = "", ...props }, ref) => {
    return (
      <div className="space-y-2">
        <label htmlFor={id} className="block text-sm font-medium text-muted-foreground">
          {label}
          {props.required && <span className="text-aurora-glow ml-1">*</span>}
        </label>
        <input
          ref={ref}
          id={id}
          className={`glass-input ${className}`}
          {...props}
        />
      </div>
    );
  }
);

GlassInput.displayName = "GlassInput";

export default GlassInput;
