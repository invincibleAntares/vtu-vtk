import React from 'react';
import VtkViewer from './components/VtkViewer';
import './App.css';

const App = () => {
  return (
    <div className="h-screen w-screen bg-gray-900">
      <VtkViewer />
    </div>
  );
};

export default App;
