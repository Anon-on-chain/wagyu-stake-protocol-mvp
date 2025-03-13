import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

// Define proper interface for component props
interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorClassName?: string;
  color?: string;
  value?: number;
}

// Use proper TypeScript typing for the component
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value = 0, indicatorClassName, color, ...props }, ref) => {
  // Ensure value is between 0-100
  const normalizedValue = Math.min(100, Math.max(0, value));
  
  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-slate-800/50",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full transition-all duration-300 ease-in-out",
          color,
          indicatorClassName
        )}
        style={{
          width: `${normalizedValue}%`
        }}
      />
    </ProgressPrimitive.Root>
  )
})

// Set proper displayName
Progress.displayName = "Progress"

export { Progress }