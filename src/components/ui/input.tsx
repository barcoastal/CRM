import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "bg-[#f2f3ff] border-0 rounded-lg text-sm placeholder:text-[#444656] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3052ff]/20 focus-visible:ring-offset-0 h-10 px-3 py-2 w-full min-w-0 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
