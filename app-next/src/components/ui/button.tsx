import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(37,99,235,0.22)] hover:-translate-y-px hover:bg-primary/90 hover:shadow-[0_8px_18px_rgba(37,99,235,0.28)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_2px_8px_rgba(220,38,38,0.2)] hover:-translate-y-px hover:bg-destructive/90",
        outline:
          "border border-transparent bg-background/90 shadow-[0_1px_6px_rgba(15,23,42,0.08)] hover:bg-accent/60 hover:text-accent-foreground dark:bg-card/80 dark:shadow-[0_6px_18px_rgba(2,6,23,0.28)]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[0_1px_6px_rgba(15,23,42,0.06)] hover:bg-secondary/80",
        ghost: "hover:bg-accent/70 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 px-3",
        lg: "h-11 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
