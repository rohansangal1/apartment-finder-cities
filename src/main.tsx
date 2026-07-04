import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app';
import { AuthProvider } from './context/auth-context';
import { UserDataProvider } from './context/user-data-context';
import { SearchProvider } from './context/search-context';
import { CompareProvider } from './context/compare-context';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <UserDataProvider>
          <SearchProvider>
            <CompareProvider>
              <App />
            </CompareProvider>
          </SearchProvider>
        </UserDataProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
