import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw, ShieldAlert } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6 font-sans text-white">
          <div className="max-w-2xl w-full bg-slate-800 border border-slate-700 rounded-3xl p-10 shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <ShieldAlert size={120} />
            </div>
            
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">Application Error</h1>
                <p className="text-slate-400 font-medium">Uygulama beklenmedik bir hata ile karşılaştı.</p>
              </div>
            </div>

            <div className="bg-slate-950/50 rounded-2xl border border-slate-700/50 p-6 mb-8 overflow-auto max-h-[300px]">
              <p className="text-red-400 font-bold mb-2">Hata Detayı:</p>
              <code className="text-xs font-mono text-slate-300 break-all bg-slate-950 p-2 block rounded">
                {(this.state.error && this.state.error.toString()) || "Bilinmeyen Hata"}
              </code>
              {this.state.errorInfo && (
                <div className="mt-4">
                  <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest mb-1">Stack Trace:</p>
                  <pre className="text-[10px] font-mono text-slate-500 whitespace-pre-wrap leading-relaxed">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <Button 
                onClick={() => window.location.reload()}
                className="w-full sm:flex-1 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold gap-3 shadow-lg shadow-blue-900/20"
              >
                <RotateCcw className="w-5 h-5" />
                Yeniden Başlat
              </Button>
              <Button 
                variant="outline"
                onClick={this.handleReset}
                className="w-full sm:flex-1 h-14 border-slate-700 bg-transparent hover:bg-slate-700 text-slate-300 rounded-2xl font-bold gap-3"
              >
                Belleği Temizle & Giriş Yap
              </Button>
            </div>
            
            <p className="mt-8 text-center text-xs text-slate-500">
              Hata devam ederse lütfen yukarıdaki kodu teknik destek ekibine iletin.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
