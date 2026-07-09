import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout';
import InputView from './views/input-view';
import ResultsView from './views/results-view';
import DetailView from './views/detail-view';
import SavedView from './views/saved-view';
import AccountView from './views/account-view';
import CompareView from './views/compare-view';
import ConnectView from './views/connect-view';
import RoommatesView from './views/roommates-view';
import AgentsView from './views/agents-view';

/** Route table. Each view is its own screen — never everything on one page. */
export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<InputView />} />
        <Route path="/results" element={<ResultsView />} />
        <Route path="/listing/:id" element={<DetailView />} />
        <Route path="/saved" element={<SavedView />} />
        <Route path="/compare" element={<CompareView />} />
        <Route path="/connect" element={<ConnectView />} />
        <Route path="/roommates" element={<RoommatesView />} />
        <Route path="/agents" element={<AgentsView />} />
        <Route path="/account" element={<AccountView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
