"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface CollapsibleContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | undefined>(undefined)

function useCollapsible() {
  const context = React.useContext(CollapsibleContext)
  if (!context) {
    throw new Error("useCollapsible must be used within a Collapsible")
  }
  return context
}

interface CollapsibleProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

function Collapsible({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
  className,
}: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }, [isControlled, onOpenChange])

  return (
    <CollapsibleContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      <div data-slot="collapsible" data-state={open ? "open" : "closed"} className={className}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}

interface CollapsibleTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

function CollapsibleTrigger({
  className,
  children,
  asChild,
  onClick,
  ...props
}: CollapsibleTriggerProps) {
  const { open, onOpenChange } = useCollapsible()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    onOpenChange(!open)
  }

  return (
    <button
      type="button"
      data-slot="collapsible-trigger"
      data-state={open ? "open" : "closed"}
      onClick={handleClick}
      className={cn("", className)}
      {...props}
    >
      {children}
    </button>
  )
}

interface CollapsibleContentProps extends React.HTMLAttributes<HTMLDivElement> {
  forceMount?: boolean
}

function CollapsibleContent({
  className,
  children,
  forceMount,
  ...props
}: CollapsibleContentProps) {
  const { open } = useCollapsible()

  if (!open && !forceMount) {
    return null
  }

  return (
    <div
      data-slot="collapsible-content"
      data-state={open ? "open" : "closed"}
      className={cn(
        "overflow-hidden transition-all",
        open ? "animate-in fade-in-0 slide-in-from-top-1" : "animate-out fade-out-0 slide-out-to-top-1",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
