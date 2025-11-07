/*
Project: PromptHub
Author: Allan James
Source: src/components/layout/AnimatedResizeHandle.tsx
MIME: text/x-typescript
Type: TypeScript React Component

Created: 07/11/2025 18:05 GMT+10
Last modified: 07/11/2025 18:05 GMT+10
---------------
Animated resize handle component that wraps react-resizable-panels PanelResizeHandle
with framer-motion animations. The handle animates vertically toward the cursor when nearby
and returns to center position when released or cursor moves away.

Changelog:
07/11/2025 18:05 GMT+10 | Initial creation - AnimatedResizeHandle component with cursor tracking
*/

"use client"

import { PanelResizeHandle } from "react-resizable-panels"
import { motion, useMotionValue, animate } from "framer-motion"
import { useState, useEffect, useRef } from "react"

interface AnimatedResizeHandleProps {
  className?: string
}

export function AnimatedResizeHandle({ className }: AnimatedResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isNearby, setIsNearby] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const yPosition = useMotionValue(50)

  useEffect(() => {
    if (!isDragging && !isNearby) {
      animate(yPosition, 50, {
        type: "spring",
        stiffness: 300,
        damping: 30
      })
    }
  }, [isDragging, isNearby, yPosition])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const relativeY = ((e.clientY - rect.top) / rect.height) * 100

    const distanceFromCenter = Math.abs(e.clientY - (rect.top + rect.height / 2))
    setIsNearby(distanceFromCenter < 50)

    if (isNearby || isDragging) {
      const clampedY = Math.max(10, Math.min(90, relativeY))
      animate(yPosition, clampedY, {
        type: "spring",
        stiffness: 400,
        damping: 40
      })
    }
  }

  const handleMouseLeave = () => {
    setIsNearby(false)
  }

  return (
    <PanelResizeHandle
      className={className}
      onDragging={setIsDragging}
    >
      <div
        ref={containerRef}
        className="relative w-px h-full bg-border hover:bg-border/80 transition-colors cursor-col-resize"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <motion.div
          className="absolute left-1/2 w-3 h-8 -ml-1.5 rounded-full bg-primary/40 hover:bg-primary/60 transition-colors"
          style={{
            top: "50%",
            translateY: "-50%",
            y: yPosition
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 1.15 }}
        />
      </div>
    </PanelResizeHandle>
  )
}
