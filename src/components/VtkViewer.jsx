import React, { useState } from 'react';
import VtkRenderer from './VtkRenderer';
import SlicingControls from './SlicingControls';

const VtkViewer = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ points: 0, cells: 0, size: 0 });
  const [renderer, setRenderer] = useState(null);
  const [renderWindow, setRenderWindow] = useState(null);
  
  // File upload state
  const [currentFile, setCurrentFile] = useState('Topology.vtk');
  const [uploadedFile, setUploadedFile] = useState(null);

  // Simple properties with proper RGB values for VTK.js
  const [backgroundColor, setBackgroundColor] = useState([0.1, 0.1, 0.1]);
  const [objectColor, setObjectColor] = useState([0.5, 0.5, 0.5])
// Red color
  const [wireframeMode, setWireframeMode] = useState(false);
  const [opacity, setOpacity] = useState(1.0);

  // Slicing controls
  const [sliceConfig, setSliceConfig] = useState({
    x: { enabled: false, min: -100, max: 100 },
    y: { enabled: false, min: -100, max: 100 },
    z: { enabled: false, min: -100, max: 100 }
  });

  // Color mapping state
  const [dataInfo, setDataInfo] = useState(null);
  const [selectedArray, setSelectedArray] = useState('');
  const [paletteSelection, setPaletteSelection] = useState('heatwave');

  // Available visualization palettes (completely original implementation)
  const visualizationPalettes = [
    'heatwave', 'prism', 'depths', 'elevation', 'energy', 'nature'
  ];





  // Color conversion helpers
  const rgbToHex = (rgb) => {
    const toHex = (n) => {
      const hex = Math.round(n * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
  };

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ] : [0, 0, 0];
  };

  const handleRendererReady = ({ renderer: r, renderWindow: rw }) => {
    setRenderer(r);
    setRenderWindow(rw);
  };

  const handleStatsUpdate = (newStats) => {
    setStats(newStats);
    
    // Initialize slicing bounds based on object bounds
    if (newStats.bounds) {
      setSliceConfig({
        x: { 
          enabled: false, 
          min: newStats.bounds[0], 
          max: newStats.bounds[1] 
        },
        y: { 
          enabled: false, 
          min: newStats.bounds[2], 
          max: newStats.bounds[3] 
        },
        z: { 
          enabled: false, 
          min: newStats.bounds[4], 
          max: newStats.bounds[5] 
        }
      });
    }

    // Extract data arrays from VTK file (including synthetic ones added by VtkRenderer)
    const dataArraysFromVTK = newStats.dataArrays || [];
    console.log('📊 Data arrays found:', dataArraysFromVTK.length);
    
    const arrayNames = dataArraysFromVTK.map(arr => arr.name);
    
    const dataRange = {};
    dataArraysFromVTK.forEach(arr => {
      if (arr.range && arr.range.length === 2) {
        dataRange[arr.name] = arr.range;
      }
    });
    
    // Update data info with all available arrays
    setDataInfo({
      points: newStats.points || 0,
      cells: newStats.cells || 0,
      arrays: arrayNames,
      bounds: newStats.bounds,
      dataRange: dataRange,
      realDataArrays: dataArraysFromVTK // Store full array info
    });
    
    console.log('🔍 Updated data info:', {
      arrayNames,
      arrayCount: dataArraysFromVTK.length,
      dataRange
    });
    
    // Reset color mapping when new file is loaded
    setSelectedArray('');
  };

  const resetCamera = () => {
    if (renderer && renderWindow) {
      renderer.resetCamera();
      renderWindow.render();
    }
  };

  const handleCameraPreset = (preset) => {
    if (!renderer || !renderWindow || !stats.bounds) return;

    const camera = renderer.getActiveCamera();
    const bounds = stats.bounds;
    
    // Calculate center and size of the object
    const center = [
      (bounds[0] + bounds[1]) / 2,
      (bounds[2] + bounds[3]) / 2,
      (bounds[4] + bounds[5]) / 2
    ];
    
    const size = Math.max(
      bounds[1] - bounds[0],
      bounds[3] - bounds[2], 
      bounds[5] - bounds[4]
    );
    
    // Position camera outside object bounds
    const distance = size * 2.5;
    
    // Focus on the center of the object (which is now at origin due to centering)
    camera.setFocalPoint(0, 0, 0);
    
    switch (preset) {
      case 'front':
        camera.setPosition(0, 0, distance);
        camera.setViewUp(0, 1, 0);
        break;
      case 'back':
        camera.setPosition(0, 0, -distance);
        camera.setViewUp(0, 1, 0);
        break;
      case 'left':
        camera.setPosition(distance, 0, 0);
        camera.setViewUp(0, 0, 1);
        break;
      case 'right':
        camera.setPosition(-distance, 0, 0);
        camera.setViewUp(0, 0, 1);
        break;
      case 'top':
        camera.setPosition(0, distance, 0);
        camera.setViewUp(0, 0, 1);
        break;
      case 'bottom':
        camera.setPosition(0, -distance, 0);
        camera.setViewUp(0, 0, 1);
        break;
      case 'isometric':
        camera.setPosition(
          distance * 0.8,
          distance * 0.8,
          distance * 0.8
        );
        camera.setViewUp(0, 0, 1);
        break;
      default:
        renderer.resetCamera();
        return;
    }
    
    camera.dolly(0.8);
    renderer.resetCameraClippingRange();
    renderWindow.render();
  };

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    window.location.reload();
  };

  // Enhanced file upload handler - supports both File objects and file paths
  const handleFileUpload = async (fileOrPath) => {
    try {
      setIsLoading(true);
      setError(null);
      


      let file = null;
      let fileName = '';

      if (typeof fileOrPath === 'string') {
        // Loading from file path (e.g., '/Topology.vtk', '/aeromodel.vtu')
        fileName = fileOrPath.split('/').pop();
        setCurrentFile(fileName);
        setUploadedFile(null);
        console.log('📂 Loading file from path:', fileOrPath);
      } else if (fileOrPath instanceof File) {
        // File upload from input
        file = fileOrPath;
        fileName = file.name.toLowerCase();
        
        if (!fileName.endsWith('.vtk') && !fileName.endsWith('.vtu')) {
          setError('Please upload a .vtk or .vtu file');
          setIsLoading(false);
          return;
        }

        setUploadedFile(file);
        setCurrentFile(file.name);
        console.log('📂 Uploading file to enhanced viewer:', file.name);
      } else if (fileOrPath && fileOrPath.target) {
        // Event from file input
        file = fileOrPath.target.files[0];
        if (!file) return;

        fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.vtk') && !fileName.endsWith('.vtu')) {
          setError('Please upload a .vtk or .vtu file');
          setIsLoading(false);
          return;
        }

        setUploadedFile(file);
        setCurrentFile(file.name);
        console.log('📂 Uploading file to enhanced viewer:', file.name);

        // Clear the input so the same file can be uploaded again
        fileOrPath.target.value = '';
      }

      // Clear previous state
      setStats({ points: 0, cells: 0, size: 0 });
      setDataInfo(null);
      setSelectedArray('');
      
      console.log('✅ File loading initiated, enhanced VtkRenderer will process it');

    } catch (error) {
      console.error('❌ File loading failed:', error);
      setError(`Failed to load file: ${error.message}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-gray-900 flex">
      {/* Simple Left Panel */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto">
        <h2 className="text-white text-xl font-bold mb-6">VTK Viewer</h2>
        
        {/* File Info */}
        <div className="mb-6">
          <h3 className="text-white text-sm font-medium mb-2">File</h3>
          
          {/* File Upload */}
          <div className="mb-3">
            <label className="block">
              <div className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white py-2 px-3 rounded cursor-pointer text-center text-sm font-medium transition-all duration-200">
                📂 Upload VTK/VTU File
              </div>
              <input
                type="file"
                accept=".vtk,.vtu"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <div className="text-xs text-gray-400 mt-1 text-center">
              Supports .vtk and .vtu files
            </div>
          </div>

          {/* Current File Display */}
          <div className="bg-gray-700 p-3 rounded">
            <div className="flex items-center justify-between mb-1">
              <div className="text-blue-400 text-sm">📁 {currentFile}</div>
              {uploadedFile && (
                <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
                  Uploaded
                </span>
              )}
            </div>
            {!isLoading && !error && (
              <div className="text-gray-400 text-xs mt-1">
                {stats.points.toLocaleString()} points • {stats.cells.toLocaleString()} cells • {stats.size}
              </div>
            )}
          </div>
        </div>

        {/* Simple Controls */}
        <div className="space-y-4">
          <div>
            <h3 className="text-white text-sm font-medium mb-2">Appearance</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-gray-300 text-sm block mb-1">Object Color</label>
                <input
                  type="color"
                  value={rgbToHex(objectColor)}
                  onChange={(e) => setObjectColor(hexToRgb(e.target.value))}
                  className="w-full h-8 rounded border border-gray-600"
                />
              </div>

              <div>
                <label className="text-gray-300 text-sm block mb-1">Background Color</label>
                <input
                  type="color"
                  value={rgbToHex(backgroundColor)}
                  onChange={(e) => setBackgroundColor(hexToRgb(e.target.value))}
                  className="w-full h-8 rounded border border-gray-600"
                />
              </div>

              <div>
                <label className="text-gray-300 text-sm">Opacity: {Math.round(opacity * 100)}%</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-full mt-1"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2 text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={wireframeMode}
                    onChange={(e) => setWireframeMode(e.target.checked)}
                    className="rounded"
                  />
                  <span>Point Mode (larger individual points)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Slicing Controls */}
          {!isLoading && !error && stats.bounds && (
            <SlicingControls
              sliceConfig={sliceConfig}
              onSliceChange={setSliceConfig}
              bounds={stats.bounds}
            />
          )}

          {/* Color Mapping */}
          {!isLoading && !error && dataInfo && (
            <div>
              <h3 className="text-white text-sm font-medium mb-2">🌈 Color Mapping</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-gray-300 text-xs block mb-1">Data Array</label>
                  <select
                    value={selectedArray}
                    onChange={(e) => setSelectedArray(e.target.value)}
                    className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 text-sm"
                  >
                    <option value="">Solid Color</option>
                    {dataInfo.arrays.map(array => (
                      <option key={array} value={array}>{array}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-gray-300 text-xs block mb-1">Visualization Palette</label>
                  <select
                    value={paletteSelection}
                    onChange={(e) => setPaletteSelection(e.target.value)}
                    className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 text-sm"
                    disabled={!selectedArray}
                  >
                    {visualizationPalettes.map(paletteId => {
                      const paletteLabels = {
                        'heatwave': 'Heat Wave (Blue → Red)',
                        'prism': 'Prism Spectrum',
                        'depths': 'Ocean Depths',
                        'elevation': 'Terrain Heights',
                        'energy': 'Energy Field',
                        'nature': 'Natural Gradient'
                      };
                      return (
                        <option key={paletteId} value={paletteId}>{paletteLabels[paletteId] || paletteId}</option>
                      );
                    })}
                  </select>
                </div>



                {/* Color mapping info */}
                                  <div className="bg-gray-700 p-2 rounded">
                    <div className="text-xs text-gray-400 mb-1">
                      Current: {selectedArray ? `${selectedArray} (${paletteSelection})` : 'Solid Color'}
                    </div>
                    {selectedArray && dataInfo.dataRange[selectedArray] && (
                      <div className="text-xs text-gray-400">
                        Range: {dataInfo.dataRange[selectedArray][0].toFixed(2)} - {dataInfo.dataRange[selectedArray][1].toFixed(2)}
                        {dataInfo.realDataArrays?.find(arr => arr.name === selectedArray) 
                          ? <span className="text-green-400 ml-1">✓ Real Data</span>
                          : <span className="text-orange-400 ml-1">⚠ Synthetic</span>
                        }
                      </div>
                    )}
                    {selectedArray && (
                      <div className="text-xs text-blue-400 mt-1">
                        🌈 Active palette: {(() => {
                          const paletteNames = {
                            'heatwave': 'Heat Wave',
                            'prism': 'Prism', 
                            'depths': 'Ocean Depths',
                            'elevation': 'Terrain',
                            'energy': 'Energy Field',
                            'nature': 'Natural'
                          };
                          return paletteNames[paletteSelection] || paletteSelection;
                        })()} visualization
                      </div>
                    )}
                  </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Main 3D View */}
      <div className="flex-1 relative">
        <VtkRenderer
          key={currentFile} // Force re-render when file changes
          backgroundColor={backgroundColor}
          objectColor={objectColor} // Use base object color for solid color mode
          opacity={opacity}
          wireframeMode={wireframeMode}
          pointSize={2}
          sliceConfig={sliceConfig}
          selectedDataArray={selectedArray} // For data visualization 
          paletteSelection={paletteSelection} // For palette application 
          onStatsUpdate={handleStatsUpdate}
          onError={setError}
          onLoadingChange={setIsLoading}
          onRendererReady={handleRendererReady}
          fileSource={uploadedFile || (currentFile !== 'Topology.vtk' ? `/${currentFile}` : null)} // Pass uploaded file or file path
        />
        
        {/* Simple Loading */}
        {isLoading && (
          <div className="absolute inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <div>Loading VTK file...</div>
            </div>
          </div>
        )}
        
        {/* Simple Error */}
        {error && (
          <div className="absolute inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center">
            <div className="text-center text-white max-w-md">
              <div className="text-red-400 text-4xl mb-4">⚠️</div>
              <h3 className="text-xl mb-2">Error Loading VTK File</h3>
              <p className="text-gray-300 text-sm mb-4">{error}</p>
              <button
                onClick={handleRetry}
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Enhanced Status */}
        {!isLoading && !error && (
          <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white p-3 rounded-lg">
            <div className="text-sm font-bold mb-1">
              🎯 VTK Viewer - Ready
            </div>
            <div className="text-xs text-gray-300">
              {currentFile} - {selectedArray ? `Colored by ${selectedArray}` : 'Solid Color'}
            </div>
            {selectedArray && (
              <div className="text-xs text-blue-400 mt-1">
                🌈 {(() => {
                  const paletteLabels = {
                    'heatwave': 'Heat Wave',
                    'prism': 'Prism',
                    'depths': 'Ocean Depths',
                    'elevation': 'Terrain Heights',
                    'energy': 'Energy Field',
                    'nature': 'Natural'
                  };
                  return paletteLabels[paletteSelection] || paletteSelection;
                })()} palette active
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Side Camera Controls */}
      <div className="w-64 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto">
        <h3 className="text-white text-lg font-bold mb-4">Camera Views</h3>
        
        <div className="space-y-2">
          <button
            onClick={() => handleCameraPreset('front')}
            disabled={isLoading || !!error}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 px-4 rounded text-sm flex items-center justify-center space-x-2"
          >
            <span>📺</span>
            <span>Front View</span>
          </button>
          
          <button
            onClick={() => handleCameraPreset('back')}
            disabled={isLoading || !!error}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 px-4 rounded text-sm flex items-center justify-center space-x-2"
          >
            <span>🔙</span>
            <span>Back View</span>
          </button>
          
          <button
            onClick={() => handleCameraPreset('left')}
            disabled={isLoading || !!error}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-2 px-4 rounded text-sm flex items-center justify-center space-x-2"
          >
            <span>⬅️</span>
            <span>Left View</span>
          </button>
          
          <button
            onClick={() => handleCameraPreset('right')}
            disabled={isLoading || !!error}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-2 px-4 rounded text-sm flex items-center justify-center space-x-2"
          >
            <span>➡️</span>
            <span>Right View</span>
          </button>
          
          <button
            onClick={() => handleCameraPreset('top')}
            disabled={isLoading || !!error}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white py-2 px-4 rounded text-sm flex items-center justify-center space-x-2"
          >
            <span>⬆️</span>
            <span>Top View</span>
          </button>
          
          <button
            onClick={() => handleCameraPreset('bottom')}
            disabled={isLoading || !!error}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white py-2 px-4 rounded text-sm flex items-center justify-center space-x-2"
          >
            <span>⬇️</span>
            <span>Bottom View</span>
          </button>
          
          <button
            onClick={() => handleCameraPreset('isometric')}
            disabled={isLoading || !!error}
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white py-2 px-4 rounded text-sm flex items-center justify-center space-x-2"
          >
            <span>🎯</span>
            <span>Isometric</span>
          </button>
          
          <button
            onClick={resetCamera}
            disabled={isLoading || !!error}
            className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600 text-white py-2 px-4 rounded text-sm flex items-center justify-center space-x-2"
          >
            <span>🔄</span>
            <span>Reset Camera</span>
          </button>
        </div>

        {/* Data Stats */}
        {!isLoading && !error && (
          <div className="mt-6">
            <h4 className="text-white text-sm font-medium mb-2">Data Info</h4>
            <div className="space-y-2 text-xs">
              <div className="bg-gray-700 p-2 rounded">
                <div className="text-gray-300">Points: <span className="text-blue-400">{stats.points.toLocaleString()}</span></div>
              </div>
              <div className="bg-gray-700 p-2 rounded">
                <div className="text-gray-300">Cells: <span className="text-green-400">{stats.cells.toLocaleString()}</span></div>
              </div>
              <div className="bg-gray-700 p-2 rounded">
                <div className="text-gray-300">Size: <span className="text-purple-400">{stats.size}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="mt-6">
          <h4 className="text-white text-sm font-medium mb-2">Controls</h4>
          <div className="text-xs text-gray-400 space-y-1">
            <div>• Left drag: Rotate</div>
            <div>• Right drag: Pan</div>
            <div>• Scroll: Zoom</div>
            <div>• Use view buttons above</div>
            <div>• Enable slicing to clip object</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VtkViewer;