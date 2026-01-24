import { InputHTMLAttributes, forwardRef } from "react";

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, id, className = "", ...props }, ref) => {
    return (
      <div className="space-y-3">
        <label htmlFor={id} className="form-label">
          {label}
          {props.required && <span className="form-label-required">*</span>}
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
