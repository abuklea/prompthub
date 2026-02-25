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
  direction?: "vertical" | "horizontal"
}

export function AnimatedResizeHandle({
  className,
  direction = "vertical"
}: AnimatedResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isNearby, setIsNearby] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const axisPosition = useMotionValue(50)

  useEffect(() => {
    if (!isDragging && !isNearby) {
      animate(axisPosition, 50, {
        type: "spring",
        stiffness: 300,
        damping: 30
      })
    }
  }, [axisPosition, isDragging, isNearby])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const isVertical = direction === "vertical"
    const relativePosition = isVertical
      ? ((e.clientY - rect.top) / rect.height) * 100
      : ((e.clientX - rect.left) / rect.width) * 100

    const distanceFromCenter = isVertical
      ? Math.abs(e.clientY - (rect.top + rect.height / 2))
      : Math.abs(e.clientX - (rect.left + rect.width / 2))
    setIsNearby(distanceFromCenter < 50)

    if (isNearby || isDragging) {
      const clampedPosition = Math.max(10, Math.min(90, relativePosition))
      animate(axisPosition, clampedPosition, {
        type: "spring",
        stiffness: 400,
        damping: 40
      })
    }
  }

  const handleMouseLeave = () => {
    setIsNearby(false)
  }

  const isVertical = direction === "vertical"

  return (
    <PanelResizeHandle
      className={className}
      onDragging={setIsDragging}
    >
      <div
        ref={containerRef}
        className={isVertical
          ? "relative w-px h-full bg-border hover:bg-border/80 transition-colors cursor-col-resize"
          : "relative h-px w-full bg-border hover:bg-border/80 transition-colors cursor-row-resize"
        }
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <motion.div
          className={isVertical
            ? "absolute left-1/2 w-3 h-8 -ml-1.5 rounded-full bg-primary/40 hover:bg-primary/60 transition-colors"
            : "absolute top-1/2 h-3 w-8 -mt-1.5 rounded-full bg-primary/40 hover:bg-primary/60 transition-colors"
          }
          style={{
            ...(isVertical
              ? {
                  top: "50%",
                  translateY: "-50%",
                  y: axisPosition
                }
              : {
                  left: "50%",
                  translateX: "-50%",
                  x: axisPosition
                }
            )
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 1.15 }}
        />
      </div>
    </PanelResizeHandle>
  )
}
