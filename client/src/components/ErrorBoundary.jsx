import { Component } from 'react';
import { ErrorState } from './States';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 bg-gray-50 min-h-[50vh] rounded-xl border border-red-100">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full text-center">
            <div className="text-5xl mb-4">💥</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-6">
              A component crashed unexpectedly. Don't worry, your data is safe.
            </p>
            {this.state.error && (
              <div className="text-left bg-red-50 p-4 rounded-lg border border-red-100 mb-6 overflow-x-auto">
                <code className="text-xs text-red-800 break-words font-mono">
                  {this.state.error.toString()}
                </code>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="bg-brand text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-dark transition-colors shadow-lg shadow-brand/30 w-full"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
