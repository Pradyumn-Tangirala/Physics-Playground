import { lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import ErrorBoundary from './components/ErrorBoundary';
import ExperimentRoute from './components/ExperimentRoute';
import './App.css';

// Every page except the landing page is its own chunk, downloaded on first
// visit, so the landing page does not load any physics, simulation or
// rendering code.
const WaveInterferenceLab = lazy(() => import('./pages/WaveInterferenceLab'));
const WaveEquationLab = lazy(() => import('./pages/WaveEquationLab'));
const DoubleSlitSolver = lazy(() => import('./pages/DoubleSlitSolver'));
const ProjectileLab = lazy(() => import('./pages/ProjectileLab'));
const ProjectileSolver = lazy(() => import('./pages/ProjectileSolver'));
const OscillatorLab = lazy(() => import('./pages/OscillatorLab'));
const PendulumSolver = lazy(() => import('./pages/PendulumSolver'));
const NumericalMethodsLab = lazy(() => import('./pages/NumericalMethodsLab'));
const ExperimentsPage = lazy(() => import('./pages/ExperimentsPage'));
const Chatbot = lazy(() => import('./components/chatbot/Chatbot'));

function PageLoading() {
    return (
        <div role="status" aria-live="polite" className="app-fullscreen">
            Loading…
        </div>
    );
}

function AppRoutes() {
    const location = useLocation();
    const navigate = useNavigate();
    return (
        <ErrorBoundary resetKey={location.pathname} onHome={() => navigate('/')}>
            <Suspense fallback={<PageLoading />}>
                <Routes>
                    <Route path="/" element={<LandingPage />} />

                    {/* The FAQ helper only knows about the wave lab, so it lives on that route. */}
                    <Route path="/simulation" element={<ExperimentRoute><WaveInterferenceLab /><Chatbot /></ExperimentRoute>} />
                    <Route path="/problems" element={<DoubleSlitSolver />} />
                    <Route path="/waves/fdtd" element={<ExperimentRoute><WaveEquationLab /></ExperimentRoute>} />

                    <Route path="/projectile" element={<ExperimentRoute><ProjectileLab /></ExperimentRoute>} />
                    <Route path="/projectile/problems" element={<ProjectileSolver />} />

                    <Route path="/shm" element={<ExperimentRoute><OscillatorLab /></ExperimentRoute>} />
                    <Route path="/shm/problems" element={<PendulumSolver />} />

                    <Route path="/numerical-methods" element={<ExperimentRoute><NumericalMethodsLab /></ExperimentRoute>} />

                    <Route path="/experiments" element={<ExperimentsPage />} />

                    <Route path="*" element={<NotFound />} />
                </Routes>
            </Suspense>
        </ErrorBoundary>
    );
}

function NotFound() {
    const navigate = useNavigate();
    return (
        <main className="app-fullscreen">
            <div>
                <h1>Page not found</h1>
                <p>There is no lab at this address.</p>
                <button type="button" onClick={() => navigate('/')}>Back to home</button>
            </div>
        </main>
    );
}

function App() {
    return (
        <Router>
            <AppRoutes />
        </Router>
    );
}

export default App;
