import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-sm border border-red-100 text-center">
            <h2 className="text-xl font-bold text-red-600 mb-2">Đã xảy ra lỗi giao diện</h2>
            <p className="text-sm text-gray-600 mb-4">Ứng dụng gặp sự cố khi hiển thị trang này.</p>
            <pre className="bg-gray-100 p-4 rounded-xl text-xs text-left overflow-auto max-h-40 text-red-700 mb-6">
              {this.state.error?.toString()}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
