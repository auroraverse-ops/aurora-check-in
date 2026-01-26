 import { InputHTMLAttributes, forwardRef } from "react";

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

 const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
   ({ label, id, className = "", type, ...props }, ref) => {
     return (
       <div className="space-y-3">
         <label htmlFor={id} className="form-label">
           {label}
           {props.required && <span className="form-label-required">*</span>}
         </label>
         {/* Wrapper mit Glassmorphism-Effekt */}
         <div className="glass-input-wrapper">
           <input
             ref={ref}
             id={id}
             type={type}
             className={`glass-input-field ${className}`}
             {...props}
           />
         </div>
       </div>
     );
   }
 );

GlassInput.displayName = "GlassInput";

export default GlassInput;
