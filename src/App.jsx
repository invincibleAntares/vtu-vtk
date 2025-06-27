import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import VtkViewer from './components/VtkViewer';
import ParaViewWebDashboard from './components/ParaViewWebDashboard';
import './App.css';

const Navigation = () => {
  const location = useLocation();
  
  return (
    <nav className="bg-gray-800 border-b border-gray-700 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-white text-xl font-bold">🎯 VTK Visualization Dashboard</h1>
          <div className="flex space-x-2">
            <Link
              to="/"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                location.pathname === '/' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              📊 Basic Viewer
            </Link>
            <Link
              to="/paraview"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                location.pathname === '/paraview' 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              🚀 Advanced ParaView
            </Link>
          </div>
        </div>
        <div className="text-gray-400 text-sm">
          {location.pathname === '/' ? 'Basic VTK.js Rendering' : 'Professional ParaView Analysis'}
        </div>
      </div>
    </nav>
  );
};

const App = () => {
  return (
    <Router>
      <div className="h-screen w-screen bg-gray-900 flex flex-col">
        <Navigation />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<VtkViewer />} />
            <Route path="/paraview" element={<ParaViewWebDashboard />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
