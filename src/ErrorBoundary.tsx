import React from 'react';
import { getErrorMessage } from './utils/errorUtils';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const errorDetails = getErrorMessage(this.state.error);

      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-md max-w-md w-full border border-red-100">
            <h2 className="text-2xl font-serif italic text-red-600 mb-4">{errorDetails.title}</h2>
            <p className="text-stone-600 mb-6 font-sans leading-relaxed">
              {errorDetails.description || "Something went wrong."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-stone-900 text-stone-50 py-3 rounded-xl font-medium hover:bg-stone-800 transition-colors"
            >
              Restart System
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
