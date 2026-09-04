import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-transparent bg-clip-padding text-[15px] font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-mikan outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-soft hover:bg-primary/90",
        outline:
          "border-border bg-surface text-foreground hover:border-primary/45 hover:bg-surface-soft aria-expanded:bg-surface-soft",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-surface-accent aria-expanded:bg-surface-accent",
        ghost:
          "bg-surface text-foreground hover:bg-surface-soft aria-expanded:bg-surface-soft",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/18 focus-visible:ring-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 gap-2 px-5",
        xs: "h-8 gap-1 rounded-sm px-3 text-xs [&_svg:not([class*='size-'])]:size-4",
        sm: "h-9 gap-1.5 rounded-sm px-4 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "h-13 gap-2 px-7 text-base",
        icon: "size-11 rounded-full",
        "icon-xs": "size-8 rounded-full [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-9 rounded-full [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-13 rounded-full [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

// shadcn/uiのvariantを製品コンポーネントから再利用するため同居させる。
// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants }
