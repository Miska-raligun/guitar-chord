import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  label?: string  // e.g. "识别" for tab name in error message
}
interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    }
  }

  reset = () => this.setState({ hasError: false, message: '' })

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-4 px-8 py-12 text-center">
        <div className="text-3xl">⚠️</div>
        <div className="text-zinc-300 font-medium">
          {this.props.label ? `「${this.props.label}」` : ''}出现了一个错误
        </div>
        <div className="text-zinc-500 text-xs max-w-xs leading-relaxed break-all">
          {this.state.message}
        </div>
        <button
          onClick={this.reset}
          className="px-4 py-2 bg-zinc-800 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 border border-zinc-700"
        >
          重试
        </button>
      </div>
    )
  }
}
