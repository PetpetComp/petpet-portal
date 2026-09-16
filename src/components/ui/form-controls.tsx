import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "@/lib/utils";
export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("field-control", className)} {...props} />;
}
export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("field-control", className)} {...props}>
      {children}
    </select>
  );
}
export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn("field-control min-h-24", className)} {...props} />
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const required = label.endsWith("*");
  const text = required ? label.slice(0, -1).trimEnd() : label;
  return (
    <label className="form-field">
      <span>
        {text}
        {required && <span className="field-required">*</span>}
      </span>
      {children}
    </label>
  );
}
