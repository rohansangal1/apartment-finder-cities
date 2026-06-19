import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import InputView from './views/InputView';
import ResultsView from './views/ResultsView';
import DetailView from './views/DetailView';
import SavedView from './views/SavedView';
import AccountView from './views/AccountView';

/** Route table. Each view is its own screen — never everything on one page. */
export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<InputView />} />
        <Route path="/results" element={<ResultsView />} />
        <Route path="/listing/:id" element={<DetailView />} />
        <Route path="/saved" element={<SavedView />} />
        <Route path="/account" element={<AccountView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
