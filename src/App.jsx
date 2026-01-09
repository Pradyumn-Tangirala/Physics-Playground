import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import WaveInterference from './WaveInterference';
import LandingPage from './LandingPage';
import Chatbot from './Chatbot';
import ProblemSolver from './ProblemSolver';
import ProjectileSimulator from './ProjectileSimulator';
import ProjectileProblemSolver from './ProjectileProblemSolver';
import SHMSimulator from './SHMSimulator';
import SHMProblemSolver from './SHMProblemSolver';
import './App.css';

function App() {
  return (
    <Router>
      <Chatbot />
      <Routes>
        <Route path="/" element={<LandingPage />} />

        {/* Wave Interference */}
        <Route path="/simulation" element={<WaveInterference />} />
        <Route path="/problems" element={<ProblemSolver />} />

        {/* Projectile Motion */}
        <Route path="/projectile" element={<ProjectileSimulator />} />
        <Route path="/projectile/problems" element={<ProjectileProblemSolver />} />

        {/* Simple Harmonic Motion */}
        <Route path="/shm" element={<SHMSimulator />} />
        <Route path="/shm/problems" element={<SHMProblemSolver />} />
      </Routes>
    </Router>
  );
}

export default App;
