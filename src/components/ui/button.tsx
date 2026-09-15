import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all duration-150 ease-out active:translate-y-0 active:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:translate-y-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary-dark",
        secondary:
          "border border-input bg-card text-foreground shadow-xs hover:bg-muted hover:shadow-sm",
        ghost: "text-foreground hover:bg-muted",
        destructive:
          "bg-danger text-danger-foreground shadow-[0_10px_24px_-8px_rgba(229,72,77,0.5)] hover:brightness-110 hover:-translate-y-0.5",
      },
      size: {
        default: "",
        sm: "min-h-8 px-3",
        icon: "h-10 w-10 shrink-0 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
