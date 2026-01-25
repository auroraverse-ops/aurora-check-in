import { InputHTMLAttributes, forwardRef } from "react";

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, id, className = "", type, ...props }, ref) => {
    // Add color-scheme: dark for date inputs on mobile
    const inputStyle = type === "date" ? { colorScheme: "dark" as const } : undefined;

    return (
      <div className="space-y-3">
        <label htmlFor={id} className="form-label">
          {label}
          {props.required && <span className="form-label-required">*</span>}
        </label>
        <input
          ref={ref}
          id={id}
          type={type}
          className={`glass-input ${className}`}
          style={inputStyle}
          {...props}
        />
      </div>
    );
  }
);

GlassInput.displayName = "GlassInput";

export default GlassInput;
