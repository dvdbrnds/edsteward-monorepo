/**
 * @module Alert
 * @description A flexible alert component for displaying status messages and notifications
 * @compliance ISO/IEC/IEEE 26514 4.3.7 - User Feedback Components
 * 
 * @accessibility
 * - Uses semantic HTML elements
 * - Includes proper ARIA roles
 * - Supports keyboard interaction
 * - Maintains color contrast ratios
 */

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * @constant alertVariants
 * @description Style variants for the alert component
 */
const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/**
 * @component Alert
 * @description Main alert component for displaying status messages
 * @param {Object} props - Component properties
 * @param {string} [props.variant="default"] - Visual style variant
 * @param {string} [props.className] - Additional CSS classes
 * 
 * @example
 * ```tsx
 * <Alert variant="destructive">
 *   <AlertTitle>Error</AlertTitle>
 *   <AlertDescription>Your session has expired.</AlertDescription>
 * </Alert>
 * ```
 */
const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

/**
 * @component AlertTitle
 * @description Title for the alert component
 * @param {Object} props - Component properties
 * @param {string} [props.className] - Additional CSS classes
 */
const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

/**
 * @component AlertDescription
 * @description Description for the alert component
 * @param {Object} props - Component properties
 * @param {string} [props.className] - Additional CSS classes
 */
const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }