'use client';

import { Component, type ReactNode } from 'react';

interface SceneErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface SceneErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches errors thrown anywhere in the R3F tree (shader compile failures,
 * a lost/unavailable WebGL context, a `dispose()` edge case, etc.) and
 * swaps in the static CSS fallback instead of taking the whole page down.
 *
 * Must be a class component — React only supports error boundaries via
 * `getDerivedStateFromError`/`componentDidCatch`, there is no Hook
 * equivalent.
 */
export class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  constructor(props: SceneErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[VoteScene] falling back to static background:', error);
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
