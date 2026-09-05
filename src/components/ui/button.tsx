import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none";

    const variants = {
      default: "bg-[#5865F2] text-white hover:bg-[#4752C4] shadow-md shadow-[#5865F2]/20 active:scale-[0.98]",
      destructive: "bg-rose-500 text-white hover:bg-rose-600 shadow-sm",
      outline: "border border-white/15 bg-transparent hover:bg-white/10 text-white",
      secondary: "bg-white/10 text-white hover:bg-white/15 active:scale-[0.98]",
      ghost: "hover:bg-white/10 text-white",
      link: "text-blue-400 underline-offset-4 hover:underline",
    };

    const sizes = {
      default: "h-11 px-5 py-2.5",
      sm: "h-9 rounded-lg px-3 text-xs",
      lg: "h-12 rounded-xl px-8 text-base",
      icon: "h-10 w-10",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
