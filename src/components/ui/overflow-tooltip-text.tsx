"use client"

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface OverflowTooltipTextProps {
  text: string
  className?: string
  tooltipClassName?: string
}

/**
 * Single-line text that shows ellipsis when needed and exposes full text via tooltip.
 * Automatically recalculates overflow state when container size changes (e.g. panel resize).
 */
export function OverflowTooltipText({ text, className, tooltipClassName }: OverflowTooltipTextProps) {
  const textRef = useRef<HTMLSpanElement | null>(null)
  const [isOverflowed, setIsOverflowed] = useState(false)
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)

  const checkOverflow = useCallback(() => {
    const el = textRef.current
    if (!el) return
    setIsOverflowed(el.scrollWidth > el.clientWidth)
  }, [])

  useEffect(() => {
    checkOverflow()

    const el = textRef.current
    if (!el || typeof ResizeObserver === "undefined") {
      return
    }

    const observer = new ResizeObserver(() => {
      checkOverflow()
    })

    observer.observe(el)
    if (el.parentElement) {
      observer.observe(el.parentElement)
    }

    return () => {
      observer.disconnect()
    }
  }, [checkOverflow, text])

  const handlePointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    if (!isOverflowed) return
    if (event.pointerType === "touch") {
      setIsTooltipOpen((prev) => !prev)
    }
  }

  return (
    <Tooltip open={isTooltipOpen} onOpenChange={setIsTooltipOpen}>
      <TooltipTrigger asChild>
        <span
          ref={textRef}
          className={cn("block w-full min-w-0 truncate whitespace-nowrap", className)}
          onPointerDown={handlePointerDown}
        >
          {text}
        </span>
      </TooltipTrigger>
      {isOverflowed && (
        <TooltipContent className={cn("max-w-[320px] break-words", tooltipClassName)}>
          {text}
        </TooltipContent>
      )}
    </Tooltip>
  )
}
