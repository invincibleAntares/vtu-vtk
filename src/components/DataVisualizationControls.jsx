import React, { useState, useEffect } from 'react';
// Simplified color maps list
const AVAILABLE_COLOR_MAPS = ['viridis', 'plasma', 'cool-to-warm', 'hot', 'jet', 'rainbow'];

const DataVisualizationControls = ({
  availableArrays = [],
  selectedDataArray,
  onDataArrayChange,
  colorMapName,
  onColorMapChange,
  contourEnabled,
  onContourToggle,
  numContours,
  onNumContoursChange,
  onFileUpload
}) => {
  const [colorMaps, setColorMaps] = useState([]);

  useEffect(() => {
    // Set available color maps
    setColorMaps(AVAILABLE_COLOR_MAPS);
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">🎨 Data Visualization</h3>
      
      {/* File Upload */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          📁 Upload VTK/VTU File
        </label>
        <input
          type="file"
          accept=".vtk,.vtu"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {/* Data Array Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          📊 Data Array
        </label>
        <select
          value={selectedDataArray || ''}
          onChange={(e) => onDataArrayChange && onDataArrayChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white"
          disabled={!availableArrays || availableArrays.length === 0}
        >
          <option value="">No Color Mapping</option>
          {availableArrays && availableArrays.map((array, index) => (
            <option key={index} value={array.name}>
              {array.name} ({array.type}) - Range: [{array.range?.[0]?.toFixed(2)}, {array.range?.[1]?.toFixed(2)}]
            </option>
          ))}
        </select>
        {(!availableArrays || availableArrays.length === 0) && (
          <p className="text-sm text-gray-500 mt-1">No data arrays available</p>
        )}
      </div>

      {/* Color Map Selection */}
      {selectedDataArray && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            🌈 Color Map
          </label>
          <select
            value={colorMapName || 'viridis'}
            onChange={(e) => onColorMapChange && onColorMapChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            {colorMaps.map(map => (
              <option key={map} value={map}>
                {map.charAt(0).toUpperCase() + map.slice(1).replace(/[-_]/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Contour Controls */}
      {selectedDataArray && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              📈 Contour Overlays
            </label>
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={contourEnabled || false}
                onChange={(e) => onContourToggle && onContourToggle(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-600">Enable</span>
            </label>
          </div>
          
          {contourEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Contours: {numContours || 5}
              </label>
              <input
                type="range"
                min="3"
                max="20"
                value={numContours || 5}
                onChange={(e) => onNumContoursChange && onNumContoursChange(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>3</span>
                <span>20</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current Selection Info */}
      {selectedDataArray && (
        <div className="bg-blue-50 p-3 rounded-md">
          <h4 className="text-sm font-medium text-blue-800 mb-1">Current Selection</h4>
          <p className="text-xs text-blue-600">
            <strong>Array:</strong> {selectedDataArray}
          </p>
          <p className="text-xs text-blue-600">
            <strong>Color Map:</strong> {colorMapName || 'viridis'}
          </p>
          {contourEnabled && (
            <p className="text-xs text-blue-600">
              <strong>Contours:</strong> {numContours || 5} levels
            </p>
          )}
        </div>
      )}

      {/* Quick Test Files */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          🧪 Quick Test
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onFileUpload && onFileUpload('/Topology.vtk')}
            className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded border transition-colors"
          >
            Load Default VTK
          </button>
          <button
            onClick={() => onFileUpload && onFileUpload('/aeromodel.vtu')}
            className="px-3 py-2 text-xs bg-green-100 hover:bg-green-200 rounded border transition-colors"
          >
            Load VTU Sample
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataVisualizationControls; 