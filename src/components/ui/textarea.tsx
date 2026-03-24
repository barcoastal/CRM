import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "bg-[#f2f3ff] border-0 rounded-lg text-sm placeholder:text-[#444656] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3052ff]/20 focus-visible:ring-offset-0 flex field-sizing-content min-h-16 w-full px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
