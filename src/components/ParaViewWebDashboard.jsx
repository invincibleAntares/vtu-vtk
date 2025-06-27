import React, { useState, useRef, useEffect } from 'react';
import VtkRenderer from './VtkRenderer';
import SlicingControls from './SlicingControls';

const ParaViewWebDashboard = () => {
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connecting, connected, error
  const [serverUrl, setServerUrl] = useState('ws://localhost:1234');
  const [sessionId, setSessionId] = useState(null);
  
  // Visualization state
  const [currentFile, setCurrentFile] = useState('Topology.vtk');
  const [dataInfo, setDataInfo] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [colorMapMode, setColorMapMode] = useState('Solid Color');
  const [selectedArray, setSelectedArray] = useState('');
  const [colorMapName, setColorMapName] = useState('Cool to Warm');
  const [contourValues, setContourValues] = useState([]);
  const [isVolumeRendering, setIsVolumeRendering] = useState(false);
  
  // Advanced controls
  const [clippingEnabled, setClippingEnabled] = useState(false);
  const [streamlinesEnabled, setStreamlinesEnabled] = useState(false);
  const [annotationsEnabled, setAnnotationsEnabled] = useState(true);
  
  // Analysis features state
  const [probeEnabled, setProbeEnabled] = useState(false);
  const [probeData, setProbeData] = useState(null);
  const [measurementMode, setMeasurementMode] = useState(null); // 'distance', 'area', 'volume'
  const [measurementPoints, setMeasurementPoints] = useState([]);
  const [measurementResult, setMeasurementResult] = useState(null);

  // Debug effect to track measurement state changes
  useEffect(() => {
    console.log('🔄 Measurement state changed:');
    console.log('  - measurementMode:', measurementMode);
    console.log('  - measurementPoints:', measurementPoints);
    console.log('  - measurementResult:', measurementResult);
  }, [measurementMode, measurementPoints, measurementResult]);
  
  // UI state
  const [activeTab, setActiveTab] = useState('visualization');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // VTK Renderer state (same object as basic viewer)
  const [vtkStats, setVtkStats] = useState({ points: 0, cells: 0, size: 0 });
  const [vtkRenderer, setVtkRenderer] = useState(null);
  const [vtkRenderWindow, setVtkRenderWindow] = useState(null);
  
  // Slicing controls (same as basic viewer)
  const [sliceConfig, setSliceConfig] = useState({
    x: { enabled: false, min: -100, max: 100 },
    y: { enabled: false, min: -100, max: 100 },
    z: { enabled: false, min: -100, max: 100 }
  });
  
  const renderContainerRef = useRef(null);
  const paraViewConnection = useRef(null);

  // Available color maps for scientific visualization
  const colorMaps = [
    'Cool to Warm', 'Blue to Red Rainbow', 'Grayscale', 'Hot', 'Jet',
    'Viridis', 'Plasma', 'Inferno', 'Magma', 'X Ray', 'Black-Body Radiation'
  ];

  // Data arrays that might be available in the VTK file
  const dataArrays = ['Temperature', 'Pressure', 'Velocity', 'Density', 'Stress', 'Displacement'];

  // Function to get color based on selected array and color map (ParaView simulation)
  const getColorForArray = (arrayName, colorMap) => {
    if (!arrayName) return [1.0, 0.0, 0.0]; // Default red for solid color
    
    // Simulate different color mappings for different data arrays
    const colorMappings = {
      'Temperature': {
        'Cool to Warm': [0.0, 0.5, 1.0], // Blue (cool)
        'Hot': [1.0, 0.5, 0.0], // Orange (hot)
        'Viridis': [0.3, 0.7, 0.9], // Viridis blue
        'Plasma': [0.8, 0.2, 0.8], // Plasma purple
      },
      'Pressure': {
        'Cool to Warm': [1.0, 0.8, 0.0], // Yellow-red (high pressure)
        'Blue to Red Rainbow': [0.0, 1.0, 0.0], // Green (medium pressure)
        'Viridis': [0.9, 0.9, 0.2], // Viridis yellow
        'Jet': [0.0, 0.8, 1.0], // Cyan
      },
      'Velocity': {
        'Cool to Warm': [1.0, 0.0, 0.5], // Red-pink (high velocity)
        'Jet': [1.0, 1.0, 0.0], // Yellow (jet colormap)
        'Viridis': [0.1, 0.9, 0.1], // Viridis green
        'Plasma': [1.0, 0.6, 0.0], // Plasma orange
      }
    };
    
    const arrayColors = colorMappings[arrayName];
    if (arrayColors && arrayColors[colorMap]) {
      return arrayColors[colorMap];
    }
    
    // Fallback colors for any array
    const fallbackColors = {
      'Cool to Warm': [0.2, 0.6, 1.0],
      'Hot': [1.0, 0.4, 0.0],
      'Viridis': [0.4, 0.8, 0.6],
      'Plasma': [0.9, 0.3, 0.6],
      'Jet': [0.0, 0.7, 1.0],
      'Grayscale': [0.6, 0.6, 0.6]
    };
    
    return fallbackColors[colorMap] || [0.5, 0.8, 1.0]; // Default scientific blue
  };

  useEffect(() => {
    // Initialize ParaViewWeb connection when component mounts
    initializeParaViewWeb();
    
    return () => {
      // Cleanup connection on unmount
      if (paraViewConnection.current) {
        paraViewConnection.current.disconnect();
      }
    };
  }, []);

  const initializeParaViewWeb = async () => {
    try {
      setConnectionStatus('connecting');
      setIsLoading(true);
      setError(null);

      console.log('🔌 Attempting to connect to ParaViewWeb server...');
      
      // Try WebSocket connection first
      try {
        const websocket = new WebSocket(serverUrl);
        
        return new Promise((resolve, reject) => {
          const connectionTimeout = setTimeout(() => {
            console.log('⏱️ Connection timeout, falling back to demo mode');
            websocket.close();
            initializeDemoMode();
            resolve();
          }, 3000); // Reduced timeout to 3 seconds
          
          websocket.onopen = async () => {
            clearTimeout(connectionTimeout);
            console.log('✅ Connected to real ParaViewWeb server');
            paraViewConnection.current = websocket;
            setConnectionStatus('connected');
            setSessionId('session_' + Date.now());
            
            // Send initialize command to server
            const initMessage = {
              id: 1,
              method: 'vtk.initialize',
              params: {}
            };
            
            websocket.send(JSON.stringify(initMessage));
          };
          
          websocket.onmessage = (event) => {
            try {
              const response = JSON.parse(event.data);
              console.log('📨 Received from server:', response);
              
              if (response.result && response.result.status === 'success') {
                // Update data info from server response
                if (response.result.data_arrays) {
                  setDataInfo({
                    points: response.result.points || 1234567,
                    cells: response.result.cells || 987654,
                    arrays: response.result.data_arrays,
                    timeSteps: 50,
                    bounds: response.result.bounds || [-100, 100, -50, 50, -75, 75],
                    dataRange: {
                      'Temperature': [273.15, 373.15],
                      'Pressure': [101325, 200000],
                      'Velocity': [0, 25.5]
                    }
                  });
                  setSelectedArray(response.result.data_arrays[0]);
                }
                
                setIsLoading(false);
                resolve();
              }
            } catch (err) {
              console.error('Error parsing server response:', err);
            }
          };
          
          websocket.onerror = (error) => {
            clearTimeout(connectionTimeout);
            console.log('❌ WebSocket connection failed, using demo mode');
            initializeDemoMode();
            resolve();
          };
          
          websocket.onclose = () => {
            console.log('🔌 WebSocket connection closed');
            if (connectionStatus === 'connected') {
              setConnectionStatus('disconnected');
            }
          };
        });
        
      } catch (wsError) {
        console.log('❌ WebSocket creation failed, using demo mode');
        initializeDemoMode();
      }
      
    } catch (err) {
      console.error('ParaViewWeb initialization failed:', err);
      initializeDemoMode();
    }
  };

  const initializeDemoMode = () => {
    console.log('🎭 Initializing demo mode with simulated server responses');
    setConnectionStatus('connected');
    setSessionId('demo_session_' + Date.now());
    
    // Simulate data loading
    setDataInfo({
      points: 1234567,
      cells: 987654,
      arrays: ['Temperature', 'Pressure', 'Velocity'],
      timeSteps: 50,
      bounds: [-100, 100, -50, 50, -75, 75],
      dataRange: {
        'Temperature': [273.15, 373.15],
        'Pressure': [101325, 200000],
        'Velocity': [0, 25.5]
      }
    });
    
    setSelectedArray('Temperature');
    setIsLoading(false);
  };



  const applyColorMap = async () => {
    if (!selectedArray || connectionStatus !== 'connected') return;
    
    console.log(`🌈 Applying color map: ${colorMapName} to array: ${selectedArray}`);
    
    if (paraViewConnection.current) {
      // Real server mode
      const message = {
        id: Date.now(),
        method: 'vtk.apply_color_map',
        params: {
          array_name: selectedArray,
          color_map_name: colorMapName
        }
      };
      
      paraViewConnection.current.send(JSON.stringify(message));
      console.log('📤 Sent color map command to real server');
    } else {
      // Demo mode - Change object color based on selected array
      console.log('🎭 Demo mode: Applying color mapping visually');
    }
    
    setColorMapMode(selectedArray);
  };

  const generateContours = async () => {
    if (!selectedArray || !dataInfo || !vtkRenderer) return;
    
    console.log(`📈 Generating contours for array: ${selectedArray}`);
    
    if (paraViewConnection.current) {
      // Real server mode
      const message = {
        id: Date.now(),
        method: 'vtk.generate_contours',
        params: {
          array_name: selectedArray,
          num_contours: 5
        }
      };
      
      paraViewConnection.current.send(JSON.stringify(message));
      console.log('📤 Sent contour generation command to real server');
    } else {
      // Demo mode - Generate real contours if data arrays are available
      const realArrays = dataInfo.realDataArrays || [];
      const dataArray = realArrays.find(arr => arr.name === selectedArray);
      
      if (dataArray && dataArray.data) {
        try {
          // Generate real VTK contours
          const range = dataArray.range;
          const numContours = 5;
          const step = (range[1] - range[0]) / (numContours + 1);
          const values = [];
          
          for (let i = 1; i <= numContours; i++) {
            values.push(range[0] + step * i);
          }
          
          setContourValues(values);
          
          // TODO: Create actual contour filter with VTK.js
          // This would require vtkContourFilter to generate isosurfaces
          console.log(`✅ Generated ${numContours} contour values:`, values.map(v => v.toFixed(2)));
          
        } catch (error) {
          console.error('❌ Error generating contours:', error);
        }
      } else {
        console.log('🎭 Demo mode: Simulating contour generation');
        // Update local state with contour values
        const range = dataInfo.dataRange[selectedArray];
        const numContours = 5;
        const step = (range[1] - range[0]) / (numContours + 1);
        const values = [];
        
        for (let i = 1; i <= numContours; i++) {
          values.push(range[0] + step * i);
        }
        
        setContourValues(values);
      }
    }
  };

  const toggleVolumeRendering = () => {
    setIsVolumeRendering(!isVolumeRendering);
    console.log(`Volume rendering: ${!isVolumeRendering ? 'enabled' : 'disabled'}`);
  };

  const resetView = () => {
    console.log('Resetting camera view');
    if (vtkRenderer && vtkRenderWindow) {
      vtkRenderer.resetCamera();
      vtkRenderWindow.render();
    }
  };

  const exportImage = () => {
    console.log('Exporting high-resolution image');
    // In real implementation, this would trigger server-side image export
  };

  // Analysis feature functions
  const toggleProbeMode = () => {
    setProbeEnabled(!probeEnabled);
    setProbeData(null);
    console.log(`🔍 Probe mode: ${!probeEnabled ? 'enabled' : 'disabled'}`);
    
    if (!probeEnabled) {
      console.log('💡 Hold Ctrl/Shift and click on the 3D object to probe data values');
    }
  };

  const startMeasurement = (mode) => {
    console.log(`🚀 Starting ${mode} measurement...`);
    console.log('📊 Previous measurementMode:', measurementMode);
    console.log('📊 Previous measurementPoints:', measurementPoints);
    
    setMeasurementMode(mode);
    setMeasurementPoints([]);
    setMeasurementResult(null);
    
    console.log(`📐 Started ${mode} measurement - Hold Ctrl/Shift and click points on the object`);
    console.log('✅ Measurement mode should now be active');
    
    // Debug state after setting
    setTimeout(() => {
      console.log('🔍 After state update - measurementMode should be:', mode);
    }, 100);
  };

  const clearMeasurements = () => {
    setMeasurementMode(null);
    setMeasurementPoints([]);
    setMeasurementResult(null);
    console.log('🧹 Cleared all measurements');
  };

  // File upload handler
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.vtk') && !fileName.endsWith('.vtu')) {
      setError('Please upload a .vtk or .vtu file');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log('📂 Uploading file:', file.name);

      // Clear previous state
      setDataInfo(null);
      setSelectedArray('');
      setContourValues([]);
      setProbeData(null);
      clearMeasurements();

      // Store the uploaded file and update current file name
      setUploadedFile(file);
      setCurrentFile(file.name);
      
      console.log('✅ File uploaded successfully, VtkRenderer will load it automatically');
      setIsLoading(false);

    } catch (error) {
      console.error('❌ File upload failed:', error);
      setError(`Failed to upload file: ${error.message}`);
      setIsLoading(false);
    }

    // Clear the input so the same file can be uploaded again
    event.target.value = '';
  };

  const handlePointClick = (pickInfo) => {
    console.log('🎯 Point clicked:', pickInfo);
    console.log('🔍 Current probeEnabled:', probeEnabled);
    console.log('📐 Current measurementMode:', measurementMode);
    console.log('📊 Current measurementPoints length:', measurementPoints.length);
    
    if (probeEnabled) {
      // Handle probing
      const probeResult = {
        position: pickInfo.position,
        pointId: pickInfo.pointId,
        cellId: pickInfo.cellId,
        ...pickInfo.dataValues
      };
      setProbeData(probeResult);
      console.log('🔍 Probed data set:', probeResult);
    }
    
    if (measurementMode) {
      console.log('📐 Processing measurement point...');
      console.log('📍 Picked position:', pickInfo.position);
      console.log('📊 Current points before adding:', measurementPoints);
      console.log('🧩 Current measurement mode:', measurementMode);
      
      // Handle measurement point selection
      const newPoints = [...measurementPoints, pickInfo.position];
      console.log('🔄 Setting measurement points to:', newPoints);
      setMeasurementPoints(newPoints);
      
      // Force immediate state check
      setTimeout(() => {
        console.log('⚡ State check after setMeasurementPoints:', {
          measurementMode,
          measurementPointsLength: measurementPoints.length,
          newPointsLength: newPoints.length
        });
      }, 50);
      
      console.log(`📐 Added point ${newPoints.length} for ${measurementMode} measurement`);
      console.log(`📍 Point coordinates:`, pickInfo.position);
      console.log('📊 New points array:', newPoints);
      
      // Calculate measurement if we have enough points
      const result = calculateMeasurement(newPoints, measurementMode);
      console.log('🧮 Calculation result:', result);
      
      if (result) {
        setMeasurementResult(result);
        console.log('📏 Measurement result set:', result);
        
        // Show success notification
        console.log(`✅ ${measurementMode} calculation complete: ${result.value.toFixed(3)} ${result.unit}`);
      } else {
        // Show progress
        const needed = measurementMode === 'distance' ? 2 : measurementMode === 'area' ? 3 : 4;
        const remaining = needed - newPoints.length;
        if (remaining > 0) {
          console.log(`📌 ${newPoints.length}/${needed} points selected. Click ${remaining} more point${remaining > 1 ? 's' : ''} on the object.`);
        }
      }
    } else {
      console.log('⚠️ No measurement mode active - point click ignored for measurements');
    }
  };

  const calculateMeasurement = (points, mode) => {
    switch (mode) {
      case 'distance':
        if (points.length >= 2) {
          const [p1, p2] = points;
          const distance = Math.sqrt(
            Math.pow(p2[0] - p1[0], 2) + 
            Math.pow(p2[1] - p1[1], 2) + 
            Math.pow(p2[2] - p1[2], 2)
          );
          return { type: 'distance', value: distance, unit: 'units' };
        }
        break;
      case 'area':
        if (points.length >= 3) {
          // Calculate triangle area using cross product
          const [p1, p2, p3] = points;
          const v1 = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
          const v2 = [p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]];
          
          // Cross product
          const cross = [
            v1[1] * v2[2] - v1[2] * v2[1],
            v1[2] * v2[0] - v1[0] * v2[2],
            v1[0] * v2[1] - v1[1] * v2[0]
          ];
          
          // Magnitude / 2 for triangle area
          const area = 0.5 * Math.sqrt(cross[0] * cross[0] + cross[1] * cross[1] + cross[2] * cross[2]);
          return { type: 'area', value: area, unit: 'units²' };
        }
        break;
      case 'volume':
        if (points.length >= 4) {
          // Calculate tetrahedron volume using scalar triple product
          const [p1, p2, p3, p4] = points;
          const v1 = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
          const v2 = [p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]];
          const v3 = [p4[0] - p1[0], p4[1] - p1[1], p4[2] - p1[2]];
          
          // Scalar triple product: v1 · (v2 × v3)
          const cross = [
            v2[1] * v3[2] - v2[2] * v3[1],
            v2[2] * v3[0] - v2[0] * v3[2],
            v2[0] * v3[1] - v2[1] * v3[0]
          ];
          
          const dot = v1[0] * cross[0] + v1[1] * cross[1] + v1[2] * cross[2];
          const volume = Math.abs(dot) / 6.0; // Tetrahedron volume
          
          return { type: 'volume', value: volume, unit: 'units³' };
        }
        break;
    }
    return null;
  };

  // VTK Renderer handlers (exact copy from basic viewer)
  const handleVtkRendererReady = ({ renderer, renderWindow }) => {
    setVtkRenderer(renderer);
    setVtkRenderWindow(renderWindow);
  };

  const handleVtkStatsUpdate = (newStats) => {
    setVtkStats(newStats);
    // Initialize slicing bounds based on object bounds (same as basic viewer)
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
      
      // Extract real data arrays from VTK file or use defaults
      const realArrays = newStats.dataArrays || [];
      const arrayNames = realArrays.length > 0 
        ? realArrays.map(arr => arr.name)
        : ['Temperature', 'Pressure', 'Velocity']; // Fallback
      
      const dataRange = {};
      realArrays.forEach(arr => {
        if (arr.range && arr.range.length === 2) {
          dataRange[arr.name] = arr.range;
        }
      });
      
      // Fallback ranges if no real data
      if (Object.keys(dataRange).length === 0) {
        dataRange['Temperature'] = [273.15, 373.15];
        dataRange['Pressure'] = [101325, 200000];
        dataRange['Velocity'] = [0, 25.5];
      }
      
      // Update ParaView data info with real arrays
      setDataInfo({
        points: newStats.points || 0,
        cells: newStats.cells || 0,
        arrays: arrayNames,
        timeSteps: 50,
        bounds: newStats.bounds,
        dataRange: dataRange,
        realDataArrays: realArrays // Store full array info
      });
      
      // Set the first available array as selected
      if (arrayNames.length > 0) {
        setSelectedArray(arrayNames[0]);
      }
      
      // Force front view positioning to match basic viewer
      if (vtkRenderer && vtkRenderWindow) {
        setTimeout(() => {
          const camera = vtkRenderer.getActiveCamera();
          const bounds = newStats.bounds;
          
          const size = Math.max(
            bounds[1] - bounds[0],
            bounds[3] - bounds[2], 
            bounds[5] - bounds[4]
          );
          
          const distance = size * 2.5;
          
          // Apply exact same front view as basic viewer
          camera.setFocalPoint(0, 0, 0);
          camera.setPosition(0, 0, distance);
          camera.setViewUp(0, 1, 0);
          camera.dolly(0.8);
          vtkRenderer.resetCameraClippingRange();
          vtkRenderWindow.render();
        }, 200);
      }
    }
  };

  // Camera preset functions (exact copy from basic viewer)
  const handleCameraPreset = (preset) => {
    if (!vtkRenderer || !vtkRenderWindow || !vtkStats.bounds) return;

    const camera = vtkRenderer.getActiveCamera();
    const bounds = vtkStats.bounds;
    
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
        vtkRenderer.resetCamera();
        return;
    }
    
    camera.dolly(0.8);
    vtkRenderer.resetCameraClippingRange();
    vtkRenderWindow.render();
  };

  const resetCamera = () => {
    if (vtkRenderer && vtkRenderWindow) {
      vtkRenderer.resetCamera();
      vtkRenderWindow.render();
    }
  };

  if (connectionStatus === 'disconnected' || connectionStatus === 'connecting') {
    return (
      <div className="h-full bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white max-w-md">
          <div className="text-6xl mb-4">🚀</div>
          <h2 className="text-2xl font-bold mb-4">
            {connectionStatus === 'connecting' ? 'Connecting to ParaViewWeb...' : 'ParaViewWeb Server'}
          </h2>
          <p className="text-gray-400 mb-6">
            {connectionStatus === 'connecting' 
              ? 'Establishing connection to remote ParaView server for advanced visualization'
              : 'Professional scientific visualization with server-side processing'
            }
          </p>
          {connectionStatus === 'connecting' && (
            <div className="flex justify-center">
              <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (connectionStatus === 'error') {
    return (
      <div className="h-full bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-4 text-red-400">Connection Failed</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={initializeParaViewWeb}
            className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-6 rounded-lg"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-900 flex">
      {/* Left Control Panel */}
      <div className="w-2/12 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Connection Status */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 font-medium">Connected to ParaView</span>
          </div>
          <div className="text-xs text-gray-400">
            Session: {sessionId?.substr(-8)}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-700">
          {[
            { id: 'visualization', label: '🎨 Visualization', icon: '🎨' },
            { id: 'analysis', label: '📊 Analysis', icon: '📊' },
            { id: 'export', label: '💾 Export', icon: '💾' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-2 text-sm font-medium ${
                activeTab === tab.id
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div>{tab.icon}</div>
              <div className="text-xs mt-1">{tab.label.split(' ')[1]}</div>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-4 overflow-y-auto">
          {activeTab === 'visualization' && (
            <div className="space-y-6">
              {/* File Info */}
              <div>
                <h3 className="text-white font-medium mb-3">📁 Dataset</h3>
                
                {/* File Upload */}
                <div className="mb-3">
                  <label className="block">
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-2 px-4 rounded-lg cursor-pointer text-center text-sm font-medium transition-all duration-200">
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
                <div className="bg-gray-700 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-blue-400 font-medium">{currentFile}</div>
                    {uploadedFile && (
                      <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
                        Uploaded
                      </span>
                    )}
                  </div>
                  {dataInfo && (
                    <div className="text-xs text-gray-400 mt-2 space-y-1">
                      <div>Points: {dataInfo.points.toLocaleString()}</div>
                      <div>Cells: {dataInfo.cells.toLocaleString()}</div>
                      <div>Arrays: {dataInfo.arrays.length}</div>
                      <div>Time Steps: {dataInfo.timeSteps}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Color Mapping */}
              <div>
                <h3 className="text-white font-medium mb-3">🌈 Color Mapping</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-300 text-sm block mb-2">Data Array</label>
                    <select
                      value={selectedArray}
                      onChange={(e) => setSelectedArray(e.target.value)}
                      className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600"
                    >
                      <option value="">Solid Color</option>
                      {dataInfo?.arrays.map(array => (
                        <option key={array} value={array}>{array}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-300 text-sm block mb-2">Color Map</label>
                    <select
                      value={colorMapName}
                      onChange={(e) => setColorMapName(e.target.value)}
                      className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600"
                      disabled={!selectedArray}
                    >
                      {colorMaps.map(map => (
                        <option key={map} value={map}>{map}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={applyColorMap}
                    disabled={!selectedArray}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white py-2 rounded"
                  >
                    Apply Color Map
                  </button>
                </div>
              </div>

              {/* Contours */}
              <div>
                <h3 className="text-white font-medium mb-3">📈 Contours</h3>
                <div className="space-y-3">
                  <button
                    onClick={generateContours}
                    disabled={!selectedArray}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 rounded"
                  >
                    Generate Contours
                  </button>
                  
                  {contourValues.length > 0 && (
                    <div className="bg-gray-700 p-3 rounded">
                      <div className="text-xs text-gray-400 mb-2">Active Contours:</div>
                      {contourValues.map((value, index) => (
                        <div key={index} className="text-xs text-blue-400">
                          {selectedArray}: {value.toFixed(2)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Advanced Rendering */}
              <div>
                <h3 className="text-white font-medium mb-3">🔬 Advanced Rendering</h3>
                <div className="space-y-3">
                  <label className="flex items-center space-x-2 text-gray-300">
                    <input
                      type="checkbox"
                      checked={isVolumeRendering}
                      onChange={toggleVolumeRendering}
                      className="rounded"
                    />
                    <span>Volume Rendering</span>
                  </label>
                  
                  <label className="flex items-center space-x-2 text-gray-300">
                    <input
                      type="checkbox"
                      checked={clippingEnabled}
                      onChange={(e) => setClippingEnabled(e.target.checked)}
                      className="rounded"
                    />
                    <span>Advanced Clipping</span>
                  </label>
                  
                  <label className="flex items-center space-x-2 text-gray-300">
                    <input
                      type="checkbox"
                      checked={streamlinesEnabled}
                      onChange={(e) => setStreamlinesEnabled(e.target.checked)}
                      className="rounded"
                    />
                    <span>Streamlines</span>
                  </label>
                  
                  <label className="flex items-center space-x-2 text-gray-300">
                    <input
                      type="checkbox"
                      checked={annotationsEnabled}
                      onChange={(e) => setAnnotationsEnabled(e.target.checked)}
                      className="rounded"
                    />
                    <span>Annotations</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-medium mb-3">📊 Data Analysis</h3>
                
                {/* Data Source Info */}
                <div className="mb-4 p-3 bg-blue-900/20 border border-blue-600 rounded">
                  <div className="text-xs text-blue-300 font-medium mb-2">📁 Data Source Info:</div>
                  <div className="text-xs text-gray-300">
                    {dataInfo?.realDataArrays?.length > 0 
                      ? `✅ Found ${dataInfo.realDataArrays.length} real data array(s) in ${currentFile}`
                      : `⚠️ No data arrays found in ${currentFile} - using simulated data for demonstration`
                    }
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Real scientific data would contain actual Temperature, Pressure, Velocity fields from simulations or measurements.
                  </div>
                </div>
                
                <div className="space-y-3">
                  {dataInfo?.arrays.map(array => (
                    <div key={array} className="bg-gray-700 p-3 rounded">
                      <div className="text-white font-medium">{array}</div>
                      {dataInfo.dataRange[array] && (
                        <div className="text-xs text-gray-400 mt-1">
                          Range: {dataInfo.dataRange[array][0].toFixed(2)} - {dataInfo.dataRange[array][1].toFixed(2)}
                          {dataInfo.realDataArrays?.find(arr => arr.name === array) 
                            ? <span className="text-green-400 ml-2">✓ Real Data</span>
                            : <span className="text-orange-400 ml-2">⚠ Simulated</span>
                          }
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-white font-medium mb-3">🔍 Probe Data</h3>
                <button 
                  onClick={toggleProbeMode}
                  className={`w-full ${probeEnabled 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                  } text-white py-2 rounded transition-colors`}
                >
                  {probeEnabled ? '🛑 Disable Probing' : '🎯 Enable Point Probing'}
                </button>
                
                {probeEnabled && (
                  <div className="mt-3 p-3 bg-blue-900/20 border border-blue-600 rounded">
                    <div className="text-xs text-blue-300 mb-2">
                      💡 Hold <span className="font-bold text-yellow-300">Ctrl</span> or <span className="font-bold text-yellow-300">Shift</span> and click on the 3D object to probe data values
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      Real data values will be shown if available in the VTK file
                    </div>
                    <div className="text-xs text-orange-300">
                      ⚠️ If clicking doesn't work, check browser console (F12) for debug messages
                    </div>
                  </div>
                )}
                
                {probeData && (
                  <div className="mt-3 bg-gray-700 p-3 rounded">
                    <div className="text-xs text-green-400 font-medium mb-2">Probed Values:</div>
                    <div className="space-y-1 text-xs">
                      <div className="text-blue-300">
                        Position: ({probeData.position[0].toFixed(2)}, {probeData.position[1].toFixed(2)}, {probeData.position[2].toFixed(2)})
                      </div>
                      <div className="text-gray-400">
                        Point ID: {probeData.pointId >= 0 ? probeData.pointId : 'N/A'} | Cell ID: {probeData.cellId >= 0 ? probeData.cellId : 'N/A'}
                      </div>
                      {dataInfo?.arrays.map(array => {
                        const value = probeData[array];
                        const hasRealData = dataInfo.realDataArrays?.find(arr => arr.name === array);
                        return (
                          <div key={array} className="text-gray-300">
                            {array}: <span className={`${hasRealData ? 'text-green-400' : 'text-orange-400'}`}>
                              {value !== undefined ? value.toFixed(3) : 'No data'}
                            </span>
                            {!hasRealData && <span className="text-xs text-orange-400 ml-1">(simulated)</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-white font-medium mb-3">📐 Measurements</h3>
                <div className="space-y-3">
                  <button 
                    onClick={() => startMeasurement('distance')}
                    className={`w-full ${measurementMode === 'distance' 
                      ? 'bg-blue-600 border-2 border-blue-400 shadow-lg' 
                      : 'bg-yellow-600 hover:bg-yellow-700 border-2 border-transparent'
                    } text-white py-3 rounded-lg text-sm font-medium transition-all duration-200`}
                  >
                    <div className="flex items-center justify-center">
                      <span className="text-lg mr-2">📏</span>
                      <span>Distance Tool</span>
                    </div>
                    {measurementMode === 'distance' && (
                      <div className="text-xs text-blue-200 mt-1">🔥 ACTIVE - Click 2 points</div>
                    )}
                  </button>
                  
                  <button 
                    onClick={() => startMeasurement('area')}
                    className={`w-full ${measurementMode === 'area' 
                      ? 'bg-green-600 border-2 border-green-400 shadow-lg' 
                      : 'bg-yellow-600 hover:bg-yellow-700 border-2 border-transparent'
                    } text-white py-3 rounded-lg text-sm font-medium transition-all duration-200`}
                  >
                    <div className="flex items-center justify-center">
                      <span className="text-lg mr-2">📐</span>
                      <span>Area Calculator</span>
                    </div>
                    {measurementMode === 'area' && (
                      <div className="text-xs text-green-200 mt-1">🔥 ACTIVE - Click 3 points</div>
                    )}
                  </button>
                  
                  <button 
                    onClick={() => startMeasurement('volume')}
                    className={`w-full ${measurementMode === 'volume' 
                      ? 'bg-purple-600 border-2 border-purple-400 shadow-lg' 
                      : 'bg-yellow-600 hover:bg-yellow-700 border-2 border-transparent'
                    } text-white py-3 rounded-lg text-sm font-medium transition-all duration-200`}
                  >
                    <div className="flex items-center justify-center">
                      <span className="text-lg mr-2">📦</span>
                      <span>Volume Calculator</span>
                    </div>
                    {measurementMode === 'volume' && (
                      <div className="text-xs text-purple-200 mt-1">🔥 ACTIVE - Click 4 points</div>
                    )}
                  </button>
                  
                  {measurementMode && (
                    <div className="border-t border-gray-600 pt-3">
                      <button 
                        onClick={clearMeasurements}
                        className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                      >
                        🧹 Stop Measuring
                      </button>
                    </div>
                  )}
                </div>
                
                {measurementMode && (
                  <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-600 rounded">
                    <div className="text-xs text-yellow-300 mb-2 font-bold">
                      📐 {measurementMode.toUpperCase()} MODE ACTIVE
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      Hold <span className="font-bold text-yellow-300">Ctrl</span> or <span className="font-bold text-yellow-300">Shift</span> and click points on the object:
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mb-2">
                      {measurementMode === 'distance' && (
                        <div className="text-xs text-blue-400">
                          Progress: {measurementPoints.length} / 2 points
                          <div className="w-full bg-gray-600 rounded-full h-2 mt-1">
                            <div className="bg-blue-500 h-2 rounded-full" style={{width: `${(measurementPoints.length / 2) * 100}%`}}></div>
                          </div>
                        </div>
                      )}
                      {measurementMode === 'area' && (
                        <div className="text-xs text-green-400">
                          Progress: {measurementPoints.length} / 3 points
                          <div className="w-full bg-gray-600 rounded-full h-2 mt-1">
                            <div className="bg-green-500 h-2 rounded-full" style={{width: `${(measurementPoints.length / 3) * 100}%`}}></div>
                          </div>
                        </div>
                      )}
                      {measurementMode === 'volume' && (
                        <div className="text-xs text-purple-400">
                          Progress: {measurementPoints.length} / 4 points
                          <div className="w-full bg-gray-600 rounded-full h-2 mt-1">
                            <div className="bg-purple-500 h-2 rounded-full" style={{width: `${(measurementPoints.length / 4) * 100}%`}}></div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Selected Points List */}
                    {measurementPoints.length > 0 && (
                      <div className="text-xs bg-gray-800 p-2 rounded mt-2">
                        <div className="text-green-400 font-medium mb-1">Selected Points:</div>
                        {measurementPoints.map((point, index) => (
                          <div key={index} className="text-gray-300">
                            Point {index + 1}: ({point[0].toFixed(2)}, {point[1].toFixed(2)}, {point[2].toFixed(2)})
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Next Step Instructions */}
                    {measurementPoints.length === 0 && (
                      <div className="text-xs text-orange-300 mt-2 p-2 bg-orange-900/20 rounded">
                        👆 Start by clicking your first point on the 3D object
                      </div>
                    )}
                    {measurementPoints.length > 0 && !measurementResult && (
                      <div className="text-xs text-green-300 mt-2 p-2 bg-green-900/20 rounded">
                        {measurementMode === 'distance' && measurementPoints.length < 2 && '👆 Click your second point to calculate distance'}
                        {measurementMode === 'area' && measurementPoints.length < 3 && `👆 Click point ${measurementPoints.length + 1} of 3 to calculate area`}
                        {measurementMode === 'volume' && measurementPoints.length < 4 && `👆 Click point ${measurementPoints.length + 1} of 4 to calculate volume`}
                      </div>
                    )}
                  </div>
                )}
                
                {measurementResult && (
                  <div className="mt-3 bg-green-900/30 border-2 border-green-500 p-4 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl mb-2">🎉</div>
                      <div className="text-sm text-green-300 font-medium mb-2">MEASUREMENT COMPLETE!</div>
                      <div className="text-2xl text-white font-bold mb-1">
                        {measurementResult.value.toFixed(3)} <span className="text-lg">{measurementResult.unit}</span>
                      </div>
                      <div className="text-xs text-gray-300 capitalize mb-3">
                        {measurementResult.type} calculation using {measurementPoints.length} points
                      </div>
                      <button
                        onClick={() => {
                          setMeasurementResult(null);
                          setMeasurementPoints([]);
                          console.log('🔄 Measurement cleared - ready for new measurement');
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded text-xs mr-2"
                      >
                        📏 New Measurement
                      </button>
                      <button
                        onClick={() => {
                          clearMeasurements();
                          console.log('✅ Measurement mode disabled');
                        }}
                        className="bg-gray-600 hover:bg-gray-700 text-white py-1 px-3 rounded text-xs"
                      >
                        ✅ Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-medium mb-3">💾 Export Options</h3>
                <div className="space-y-3">
                  <button
                    onClick={exportImage}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded"
                  >
                    High-Res Image (PNG)
                  </button>
                  
                  <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded">
                    Animation (MP4)
                  </button>
                  
                  <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded">
                    Data Export (CSV)
                  </button>
                  
                  <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded">
                    3D Model (STL)
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-white font-medium mb-3">📋 Report</h3>
                <button className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded">
                  Generate Analysis Report
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Render Area */}
      <div className="w-8/12 relative">
        <div className="w-full h-full relative">
          {/* Real VTK Renderer - Same object as basic viewer */}
          <div className="transform ">
            <VtkRenderer
            key={currentFile} // Force re-render when file changes
            backgroundColor={[0.1, 0.1, 0.1]} // Dark background for ParaView style
            objectColor={getColorForArray(selectedArray, colorMapName)} // Dynamic color based on ParaView settings
            opacity={isVolumeRendering ? 0.7 : 1.0} // Transparency for volume rendering
            wireframeMode={false}
            pointSize={2}
            sliceConfig={sliceConfig} // Dynamic slicing configuration
            selectedDataArray={selectedArray} // For real color mapping
            colorMapName={colorMapName} // For real color mapping
            onStatsUpdate={handleVtkStatsUpdate}
            onError={setError}
            onLoadingChange={setIsLoading}
            onRendererReady={handleVtkRendererReady}
            onPointClick={handlePointClick} // For real point picking
            fileSource={uploadedFile} // Pass uploaded file or null for default
          />
          </div>
          
          {/* ParaView Overlay Information */}
          {!isLoading && !error && (
            <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white p-3 rounded-lg">
              <div className="text-sm font-bold mb-1">
                {paraViewConnection.current ? '🔗 ParaViewWeb Connected' : '🎭 ParaView Demo Mode'}
              </div>
              <div className="text-xs text-gray-300">
                {currentFile} - {colorMapMode === 'Solid Color' ? 'Solid Color' : `Colored by ${selectedArray}`}
              </div>
              {contourValues.length > 0 && (
                <div className="text-xs text-blue-400 mt-1">
                  🔄 {contourValues.length} contour lines active
                </div>
              )}
              {isVolumeRendering && (
                <div className="text-xs text-purple-400 mt-1">
                  📊 Volume rendering enabled
                </div>
              )}
              {(probeEnabled || measurementMode) && (
                <div className="text-xs text-yellow-300 mt-2 p-2 bg-yellow-900/30 border border-yellow-600 rounded">
                  <div className="font-bold">⚡ Point Selection Active</div>
                  <div className="text-yellow-200">
                    Hold <span className="font-bold">Ctrl</span> or <span className="font-bold">Shift</span> + Click on object
                  </div>
                  {probeEnabled && <div className="text-yellow-200">🔍 Probing Mode</div>}
                  {measurementMode && (
                    <div className="text-yellow-200">
                      📐 {measurementMode.toUpperCase()} Mode - {measurementPoints.length} points selected
                    </div>
                  )}
                </div>
              )}
              
              {/* Debug Info - Remove this after fixing */}
              <div className="text-xs text-red-300 mt-2 p-2 bg-red-900/20 border border-red-600 rounded">
                <div className="font-bold">🐛 DEBUG INFO:</div>
                <div>measurementMode: {measurementMode || 'null'}</div>
                <div>measurementPoints: {measurementPoints.length}</div>
                <div>probeEnabled: {probeEnabled ? 'true' : 'false'}</div>
              </div>
            </div>
          )}
          
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <div>Loading VTK data for ParaView analysis...</div>
              </div>
            </div>
          )}
        </div>

        {/* Status Overlay */}
        <div className="absolute top-4 right-4 bg-gray-800 bg-opacity-90 text-white p-3 rounded-lg">
          <div className="text-sm font-medium">ParaViewWeb Status</div>
          <div className="text-xs text-gray-400 mt-1">
            {paraViewConnection.current 
              ? 'Server: localhost:1234 ✅' 
              : 'Mode: Demo 🎭'
            }
          </div>
          <div className="text-xs text-gray-400">
            Viz: {selectedArray || 'Geometry'} {paraViewConnection.current ? '(Live)' : '(Demo)'}
          </div>
        </div>

        {/* Camera Controls */}
        <div className="absolute bottom-4 right-4 space-y-2">
          <button
            onClick={resetView}
            className="block w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded text-sm"
          >
            🔄 Reset View
          </button>
          <button className="block w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded text-sm">
            📷 Screenshot
          </button>
        </div>
      </div>

      {/* Right Side Panel - Slicing & Camera Controls */}
      <div className="w-2/12 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto">
        {/* Slicing Controls */}
        {!isLoading && !error && vtkStats.bounds && (
          <div className="mb-6">
            <SlicingControls
              sliceConfig={sliceConfig}
              onSliceChange={setSliceConfig}
              bounds={vtkStats.bounds}
            />
          </div>
        )}

        {/* Camera Views */}
        <div className="mb-6">
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
        </div>

        {/* Data Stats */}
        {!isLoading && !error && (
          <div className="mb-6">
            <h4 className="text-white text-sm font-medium mb-2">Data Info</h4>
            <div className="space-y-2 text-xs">
              <div className="bg-gray-700 p-2 rounded">
                <div className="text-gray-300">Points: <span className="text-blue-400">{vtkStats.points.toLocaleString()}</span></div>
              </div>
              <div className="bg-gray-700 p-2 rounded">
                <div className="text-gray-300">Cells: <span className="text-green-400">{vtkStats.cells.toLocaleString()}</span></div>
              </div>
              <div className="bg-gray-700 p-2 rounded">
                <div className="text-gray-300">Size: <span className="text-purple-400">{vtkStats.size}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Controls Tips */}
        <div className="mb-6">
          <h4 className="text-white text-sm font-medium mb-2">Controls</h4>
          <div className="text-xs text-gray-400 space-y-1">
            <div>• Left drag: Rotate</div>
            <div>• Right drag: Pan</div>
            <div>• Scroll: Zoom</div>
            <div>• Use view buttons above</div>
            <div>• Enable slicing to clip object</div>
          </div>
          
          {(probeEnabled || measurementMode) && (
            <div className="mt-3 p-2 bg-yellow-900/20 border border-yellow-600 rounded">
              <div className="text-xs text-yellow-300 font-medium mb-1">⚡ Point Selection Active:</div>
              <div className="text-xs text-yellow-200">
                Hold <span className="font-bold">Ctrl</span> or <span className="font-bold">Shift</span> + Click on object
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParaViewWebDashboard; 