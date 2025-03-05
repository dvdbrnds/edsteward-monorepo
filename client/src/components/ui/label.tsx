import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * @component Label
 * @description An accessible label component that provides visual and semantic labeling for form controls
 * @accessibility
 * - Associates with form controls using htmlFor
 * - Supports aria-label and aria-labelledby
 * - Maintains proper contrast ratio
 * - Indicates required fields
 */

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 transition-colors",
  {
    variants: {
      variant: {
        default: "",
        required: "after:content-['*'] after:ml-1 after:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface LabelProps extends
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
  VariantProps<typeof labelVariants> {
  error?: boolean;
}

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, variant, error, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      labelVariants({ variant }),
      error && "text-destructive",
      className
    )}
    data-error={error ? "true" : undefined}
    {...props}
  >
    {children}
  </LabelPrimitive.Root>
))

Label.displayName = LabelPrimitive.Root.displayName

export { Label, labelVariants }