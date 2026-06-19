import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { UserDataProvider } from './context/UserDataContext';
import { SearchProvider } from './context/SearchContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <UserDataProvider>
          <SearchProvider>
            <App />
          </SearchProvider>
        </UserDataProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
