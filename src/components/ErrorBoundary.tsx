/*
Project: PromptHub
Author: Allan James
Source: src/components/ErrorBoundary.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 08/11/2025 15:16 GMT+10
Last modified: 08/11/2025 15:16 GMT+10
---------------
Error Boundary component to catch render errors and prevent application crashes.
Implements React Error Boundary pattern using class component.

Changelog:
08/11/2025 15:16 GMT+10 | Initial creation for error handling (P5S4T3)
*/

'use client'

import React, { Component, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo)

    // Optional: Send to error tracking service
    // if (typeof window !== 'undefined') {
    //   trackError(error, errorInfo)
    // }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <h2 className="text-lg font-semibold text-destructive mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
