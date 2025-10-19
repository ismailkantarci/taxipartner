import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './components/feedback/ToastProvider';
import { GuardProvider } from './lib/rbac/guard';
import { RepositoryProvider } from './lib/repo/index.tsx';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query/client';
import { setupNetworkListeners } from './lib/network/offline';
import './style.css';
import GlobalErrorBoundary from './components/errors/GlobalErrorBoundary';

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  if (typeof window !== 'undefined') {
    setupNetworkListeners(queryClient);
  }
  root.render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <ToastProvider>
          <GuardProvider>
            <QueryClientProvider client={queryClient}>
              <RepositoryProvider>
                <BrowserRouter
                  future={{
                    v7_startTransition: true,
                    v7_relativeSplatPath: true
                  }}
                >
                  <App />
                </BrowserRouter>
              </RepositoryProvider>
            </QueryClientProvider>
          </GuardProvider>
        </ToastProvider>
      </GlobalErrorBoundary>
    </React.StrictMode>
  );
}
