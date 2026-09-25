import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center p-6 text-center h-full w-full min-h-[200px] bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1">
            Something went wrong
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-xs">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
