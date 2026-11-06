import { Component, type ReactNode } from 'react';

interface SearchErrorBoundaryProps {
  children: ReactNode;
  /** Shown instead of search when it fails to load or to render. */
  fallback: ReactNode;
}

interface SearchErrorBoundaryState {
  failed: boolean;
}

/**
 * Keeps a search failure inside search. Without it, a failed download of the search code (the
 * network is down, or the site was updated and the old file is gone) would reach the route's
 * error page and replace the whole frame. To try again, give it a new `key`.
 */
export class SearchErrorBoundary extends Component<
  SearchErrorBoundaryProps,
  SearchErrorBoundaryState
> {
  state: SearchErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): SearchErrorBoundaryState {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
