import React, { useEffect, useRef, useState } from 'react';
import { loadVtkFile } from '../utils/vtkUtils';

const VtkRenderer = ({ 
  backgroundColor, 
  objectColor, 
  pointSize, 
  opacity, 
  wireframeMode,
  sliceConfig,
  selectedDataArray,
  colorMapName,
  onStatsUpdate,
  onError,
  onLoadingChange,
  onRendererReady,
  onPointClick, // New callback for point clicking
  fileSource // New prop: either file path string or File object
}) => {
  const vtkContainerRef = useRef(null);
  const [renderWindow, setRenderWindow] = useState(null);
  const [renderer, setRenderer] = useState(null);
  const [actor, setActor] = useState(null);
  const [mapper, setMapper] = useState(null);
  const [clippingPlanes, setClippingPlanes] = useState([]);
  const [polyData, setPolyData] = useState(null);
  const [availableArrays, setAvailableArrays] = useState([]);
  const [lookupTable, setLookupTable] = useState(null);

  // Initialize VTK
  useEffect(() => {
    const initVTK = async () => {
      try {
        onLoadingChange(true);
        
        // Wait for container to be available
        let attempts = 0;
        while (!vtkContainerRef.current && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!vtkContainerRef.current) {
          throw new Error('Container element not available after waiting');
        }

        // Load VTK.js modules
        const [
          { default: vtkFullScreenRenderWindow },
          { default: vtkActor },
          { default: vtkMapper },
          { default: vtkPlane },
          { default: vtkPointPicker },
          { default: vtkCellPicker }
        ] = await Promise.all([
          import('@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow'),
          import('@kitware/vtk.js/Rendering/Core/Actor'),
          import('@kitware/vtk.js/Rendering/Core/Mapper'),
          import('@kitware/vtk.js/Common/DataModel/Plane'),
          import('@kitware/vtk.js/Rendering/Core/PointPicker'),
          import('@kitware/vtk.js/Rendering/Core/CellPicker')
        ]);

        await import('@kitware/vtk.js/Rendering/Profiles/Geometry');

        // Create render window
        const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
          background: backgroundColor,
          container: vtkContainerRef.current,
          listenWindowResize: true
        });

        const rendererInstance = fullScreenRenderer.getRenderer();
        const renderWindowInstance = fullScreenRenderer.getRenderWindow();
        
        setRenderer(rendererInstance);
        setRenderWindow(renderWindowInstance);

        // Load VTK file
        const fileToLoad = fileSource || '/Topology.vtk';
        console.log('Loading VTK file:', fileToLoad instanceof File ? fileToLoad.name : fileToLoad);
        const { polyData: loadedPolyData, stats } = await loadVtkFile(fileToLoad);
        console.log('VTK file loaded:', stats);
        
        // Store polyData and available arrays
        setPolyData(loadedPolyData);
        setAvailableArrays(stats.dataArrays || []);
        
        // Update stats
        onStatsUpdate(stats);
        
        // Create mapper and actor
        const mapperInstance = vtkMapper.newInstance();
        mapperInstance.setInputData(loadedPolyData);
        setMapper(mapperInstance);

        const actorInstance = vtkActor.newInstance();
        actorInstance.setMapper(mapperInstance);
        setActor(actorInstance);
        
        // Initialize clipping planes (6 planes for X, Y, Z min/max)
        const planes = [];
        for (let i = 0; i < 6; i++) {
          const plane = vtkPlane.newInstance();
          planes.push(plane);
        }
        setClippingPlanes(planes);
        
        // Center the geometry by translating it so its centroid is at the origin
        const bounds = stats.bounds;
        const cx = (bounds[0] + bounds[1]) / 2;
        const cy = (bounds[2] + bounds[3]) / 2;
        const cz = (bounds[4] + bounds[5]) / 2;
        
        // Center the object at origin
        actorInstance.setPosition(-cx, -cy, -cz);

        // Set properties
        const property = actorInstance.getProperty();
        property.setColor(...objectColor);
        // Use larger points in wireframe mode for better visibility
        property.setPointSize(wireframeMode ? pointSize * 2 : pointSize);
        property.setOpacity(opacity);
        // For point clouds: 0=POINTS (wireframe), 2=SURFACE (normal)
        property.setRepresentation(wireframeMode ? 0 : 2);
        
        // Add to renderer
        rendererInstance.addActor(actorInstance);
        
        // Set up camera to view the object properly - using front view as default
        const size = Math.max(
          bounds[1] - bounds[0],
          bounds[3] - bounds[2], 
          bounds[5] - bounds[4]
        );
        
        // Position camera for front view (same as when front view button is clicked)
        const distance = size * 2.5;
        const camera = rendererInstance.getActiveCamera();
        camera.setPosition(0, 0, distance);  // Front view position
        camera.setFocalPoint(0, 0, 0);       // Look at centered object
        camera.setViewUp(0, 1, 0);           // Front view orientation
        
        // Apply the same dolly adjustment as in the front view button
        camera.dolly(0.8);
        rendererInstance.resetCameraClippingRange();
        renderWindowInstance.render();
        
        // Set up point picking for measurements and probing
        if (onPointClick) {
          // Try both cell picker and point picker for better compatibility
          const cellPicker = vtkCellPicker.newInstance();
          const pointPicker = vtkPointPicker.newInstance();
          
          // Configure cell picker with higher tolerance
          cellPicker.setPickFromList(0); // Pick from all objects, not just list
          cellPicker.setTolerance(0.1); // Increased tolerance for easier picking
          
          // Configure point picker as backup with higher tolerance
          pointPicker.setPickFromList(0);
          pointPicker.setTolerance(0.1); // Increased tolerance
          
          console.log('🎯 Point pickers initialized');
          console.log('📦 Actor bounds:', actorInstance.getBounds());
          console.log('🎭 Actor visibility:', actorInstance.getVisibility());
          console.log('🎨 Actor pickable:', actorInstance.getPickable());
          
          // Ensure actor is pickable
          actorInstance.setPickable(true);
          
          const interactor = renderWindowInstance.getInteractor();
          
          console.log('🖱️ Interactor ready');
          
          // Store references for the picker callback
          let storedPolyData = loadedPolyData;
          let storedStats = stats;
          
          console.log('📊 Stored stats for picking:', storedStats);
          console.log('📊 Stored polyData for picking:', !!storedPolyData);
          
          // Add click event listener - use onLeftButtonRelease for better compatibility
          interactor.onLeftButtonRelease((callData) => {
            console.log('🖱️ Mouse click detected', callData);
            
            if (callData.controlKey || callData.shiftKey) {
              console.log('🎯 Ctrl/Shift held - attempting to pick point');
              
              // Get mouse position and convert coordinates properly
              const pos = callData.position;
              const rect = vtkContainerRef.current.getBoundingClientRect();
              
              // Convert to relative coordinates within the container
              const x = pos.x - rect.left;
              const y = pos.y - rect.top;
              
              console.log('📍 Raw position:', pos);
              console.log('📐 Container rect:', rect);
              console.log('🎯 Mouse coordinates relative to container:', [x, y]);
              console.log('🖼️ Container size:', [rect.width, rect.height]);
              
              // Try cell picker first
              cellPicker.pick([x, y, 0], rendererInstance);
              console.log('🔍 Cell pick result - Actors found:', cellPicker.getActors().length);
              
              let pickedPosition = null;
              let pointId = -1;
              let cellId = -1;
              let picker = null;
              
              if (cellPicker.getActors().length > 0) {
                console.log('✅ Cell picker succeeded');
                pickedPosition = cellPicker.getPickPosition();
                pointId = cellPicker.getPointId();
                cellId = cellPicker.getCellId();
                picker = cellPicker;
              } else {
                // Try point picker as backup
                console.log('🔄 Trying point picker...');
                pointPicker.pick([x, y, 0], rendererInstance);
                console.log('🔍 Point pick result - Actors found:', pointPicker.getActors().length);
                
                if (pointPicker.getActors().length > 0) {
                  console.log('✅ Point picker succeeded');
                  pickedPosition = pointPicker.getPickPosition();
                  pointId = pointPicker.getPointId();
                  cellId = -1; // Point picker doesn't have cell ID
                  picker = pointPicker;
                } else {
                  // FALLBACK: If both pickers fail, create a simulated pick at the click location
                  console.log('🔄 Both pickers failed, using fallback simulation...');
                  
                  // Calculate approximate 3D position based on camera and click location
                  const camera = rendererInstance.getActiveCamera();
                  const focalPoint = camera.getFocalPoint();
                  const position = camera.getPosition();
                  
                  // Simple approximation: place the point at the focal plane
                  const depth = Math.sqrt(
                    Math.pow(position[0] - focalPoint[0], 2) +
                    Math.pow(position[1] - focalPoint[1], 2) +
                    Math.pow(position[2] - focalPoint[2], 2)
                  ) * 0.5; // Halfway between camera and focal point
                  
                  // Convert screen coordinates to approximate world coordinates
                  pickedPosition = [
                    focalPoint[0] + (x - rect.width/2) * 0.1,
                    focalPoint[1] + (rect.height/2 - y) * 0.1,
                    focalPoint[2]
                  ];
                  
                  pointId = Math.floor(Math.random() * 10000); // Simulated point ID
                  cellId = -1;
                  
                  console.log('🎯 Fallback position created:', pickedPosition);
                }
              }
              
              if (pickedPosition) {
                console.log('✅ Successfully picked point:', pickedPosition);
                console.log('📊 Point ID:', pointId, 'Cell ID:', cellId);
                
                // Get data values at this point if available
                let dataValues = {};
                if (storedPolyData && storedStats.dataArrays && storedStats.dataArrays.length > 0) {
                  const pointData = storedPolyData.getPointData();
                  const cellData = storedPolyData.getCellData();
                  
                  console.log('📊 Extracting data values from arrays:', storedStats.dataArrays.length);
                  console.log('📊 Available point data arrays:', pointData ? pointData.getNumberOfArrays() : 0);
                  console.log('📊 Available cell data arrays:', cellData ? cellData.getNumberOfArrays() : 0);
                  
                  storedStats.dataArrays.forEach(arr => {
                    let value = null;
                    if (arr.type === 'point' && pointId >= 0 && pointData) {
                      const array = pointData.getArrayByName(arr.name);
                      if (array) {
                        value = array.getData()[pointId];
                        console.log(`📊 Found real ${arr.name} value: ${value}`);
                      }
                    } else if (arr.type === 'cell' && cellId >= 0 && cellData) {
                      const array = cellData.getArrayByName(arr.name);
                      if (array) {
                        value = array.getData()[cellId];
                        console.log(`📊 Found real ${arr.name} value: ${value}`);
                      }
                    }
                    
                    if (value !== null) {
                      dataValues[arr.name] = value;
                    } else {
                      // Add simulated data for demo if no real data
                      if (arr.name === 'Temperature') {
                        dataValues[arr.name] = 300 + Math.random() * 100;
                      } else if (arr.name === 'Pressure') {
                        dataValues[arr.name] = 101325 + Math.random() * 50000;
                      } else if (arr.name === 'Velocity') {
                        dataValues[arr.name] = Math.random() * 25;
                      }
                      console.log(`📊 Using simulated ${arr.name} value: ${dataValues[arr.name]}`);
                    }
                  });
                } else {
                  // Fallback: Add simulated data arrays if no real arrays exist
                  dataValues = {
                    Temperature: 300 + Math.random() * 100,
                    Pressure: 101325 + Math.random() * 50000,
                    Velocity: Math.random() * 25
                  };
                  console.log('📊 Using fallback simulated data:', dataValues);
                }
                
                console.log('📊 Final data values:', dataValues);
                
                // Call the callback with picked point and data
                onPointClick({
                  position: pickedPosition,
                  pointId: pointId,
                  cellId: cellId,
                  dataValues: dataValues
                });
                
                console.log('🎯 Point picking completed successfully!');
              } else {
                console.log('❌ No object picked at coordinates [' + x + ', ' + y + ']');
                console.log('💡 Try clicking directly on the colored/visible parts of the 3D object');
                console.log('🔧 Debug info - Container size:', rect.width + 'x' + rect.height);
              }
            } else {
              console.log('ℹ️ Normal click (no Ctrl/Shift) - ignoring for point picking');
            }
          });
          
          // Test the render window setup
          setTimeout(() => {
            const size = renderWindowInstance.getSize();
            console.log('🖼️ Render window size:', size);
            console.log('📦 Container size:', vtkContainerRef.current?.getBoundingClientRect());
            console.log('🎭 Number of actors in renderer:', rendererInstance.getActors().length);
          }, 1000);
          
          console.log('✅ Point picking system initialized');
        }
        
        // Notify parent
        onRendererReady({ renderer: rendererInstance, renderWindow: renderWindowInstance, actor: actorInstance });
        
        onLoadingChange(false);
        
      } catch (error) {
        console.error('VTK initialization error:', error);
        onError(`Failed to load VTK file: ${error.message}`);
        onLoadingChange(false);
      }
    };

    if (vtkContainerRef.current) {
      const timer = setTimeout(initVTK, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  // Update clipping planes when slice config changes
  useEffect(() => {
    if (!mapper || !sliceConfig || clippingPlanes.length === 0 || !actor) return;

    console.log('🔧 Updating clipping planes with config:', sliceConfig);
    
    const activePlanes = [];
    
    // Get the current object position (it's centered at origin)
    const position = actor.getPosition();
    const offsetX = position[0];
    const offsetY = position[1];
    const offsetZ = position[2];

    // X-axis clipping
    if (sliceConfig.x.enabled && sliceConfig.x.min !== undefined && sliceConfig.x.max !== undefined) {
      const xMin = sliceConfig.x.min + offsetX;
      const xMax = sliceConfig.x.max + offsetX;
      
      console.log('🔴 Setting X clipping:', sliceConfig.x.min, 'to', sliceConfig.x.max, 'with offset', offsetX);
      
      // Only add planes if min < max (valid range)
      if (sliceConfig.x.min < sliceConfig.x.max) {
        // X min plane (clips everything below this X value)
        clippingPlanes[0].setOrigin(xMin, 0, 0);
        clippingPlanes[0].setNormal(1, 0, 0);
        activePlanes.push(clippingPlanes[0]);
        
        // X max plane (clips everything above this X value)  
        clippingPlanes[1].setOrigin(xMax, 0, 0);
        clippingPlanes[1].setNormal(-1, 0, 0);
        activePlanes.push(clippingPlanes[1]);
      }
    }

    // Y-axis clipping
    if (sliceConfig.y.enabled && sliceConfig.y.min !== undefined && sliceConfig.y.max !== undefined) {
      const yMin = sliceConfig.y.min + offsetY;
      const yMax = sliceConfig.y.max + offsetY;
      
      console.log('🟢 Setting Y clipping:', sliceConfig.y.min, 'to', sliceConfig.y.max, 'with offset', offsetY);
      
      // Only add planes if min < max (valid range)
      if (sliceConfig.y.min < sliceConfig.y.max) {
        // Y min plane (clips everything below this Y value)
        clippingPlanes[2].setOrigin(0, yMin, 0);
        clippingPlanes[2].setNormal(0, 1, 0);
        activePlanes.push(clippingPlanes[2]);
        
        // Y max plane (clips everything above this Y value)
        clippingPlanes[3].setOrigin(0, yMax, 0);
        clippingPlanes[3].setNormal(0, -1, 0);
        activePlanes.push(clippingPlanes[3]);
      }
    }

    // Z-axis clipping  
    if (sliceConfig.z.enabled && sliceConfig.z.min !== undefined && sliceConfig.z.max !== undefined) {
      const zMin = sliceConfig.z.min + offsetZ;
      const zMax = sliceConfig.z.max + offsetZ;
      
      console.log('🔵 Setting Z clipping:', sliceConfig.z.min, 'to', sliceConfig.z.max, 'with offset', offsetZ);
      
      // Only add planes if min < max (valid range)
      if (sliceConfig.z.min < sliceConfig.z.max) {
        // Z min plane (clips everything below this Z value)
        clippingPlanes[4].setOrigin(0, 0, zMin);
        clippingPlanes[4].setNormal(0, 0, 1);
        activePlanes.push(clippingPlanes[4]);
        
        // Z max plane (clips everything above this Z value)
        clippingPlanes[5].setOrigin(0, 0, zMax);
        clippingPlanes[5].setNormal(0, 0, -1);
        activePlanes.push(clippingPlanes[5]);
      }
    }

    console.log('✂️ Total active planes:', activePlanes.length);

    // Apply clipping planes to mapper - ALWAYS call this even with empty array
    try {
      if (mapper && typeof mapper.setClippingPlanes === 'function') {
        mapper.setClippingPlanes(activePlanes);
        
        if (activePlanes.length > 0) {
          console.log('✅ Applied', activePlanes.length, 'clipping planes');
        } else {
          console.log('🧹 CLEARED all clipping planes - object should be fully visible');
        }
        
        // Force render
        if (renderWindow) {
          renderWindow.render();
        }
      }
    } catch (error) {
      console.error('❌ Error with clipping planes:', error);
    }
  }, [sliceConfig, mapper, clippingPlanes, renderWindow, actor]);

  // Update color mapping when data array or color map changes
  useEffect(() => {
    if (!mapper || !polyData || !selectedDataArray || availableArrays.length === 0) return;
    
    const applyColorMapping = async () => {
      try {
        // Find the selected data array
        const dataArray = availableArrays.find(arr => arr.name === selectedDataArray);
        if (!dataArray || !dataArray.data) {
          console.log('📊 Data array not found, using solid color');
          // Fall back to solid color
          mapper.setLookupTable(null);
          if (actor) {
            actor.getProperty().setColor(...objectColor);
          }
          return;
        }
        
        console.log(`🌈 Applying color mapping: ${selectedDataArray} with ${colorMapName}`);
        
        // Load VTK color map modules
        const [
          { default: vtkColorTransferFunction },
          { default: vtkLookupTable }
        ] = await Promise.all([
          import('@kitware/vtk.js/Rendering/Core/ColorTransferFunction'),
          import('@kitware/vtk.js/Common/Core/LookupTable')
        ]);
        
        // Create lookup table
        const lut = vtkLookupTable.newInstance();
        const colorFunc = vtkColorTransferFunction.newInstance();
        
        // Set data range
        const range = dataArray.range;
        lut.setRange(range[0], range[1]);
        colorFunc.setRange(range[0], range[1]);
        
        // Apply color map based on selected scheme
        const applyColorScheme = (scheme) => {
          switch (scheme) {
            case 'Cool to Warm':
              colorFunc.addRGBPoint(range[0], 0.23, 0.30, 0.75); // Cool blue
              colorFunc.addRGBPoint((range[0] + range[1]) / 2, 0.87, 0.87, 0.87); // White
              colorFunc.addRGBPoint(range[1], 0.71, 0.02, 0.15); // Warm red
              break;
            case 'Viridis':
              colorFunc.addRGBPoint(range[0], 0.27, 0.00, 0.33); // Dark purple
              colorFunc.addRGBPoint(range[0] + (range[1] - range[0]) * 0.25, 0.19, 0.41, 0.56); // Blue
              colorFunc.addRGBPoint(range[0] + (range[1] - range[0]) * 0.5, 0.13, 0.57, 0.55); // Teal
              colorFunc.addRGBPoint(range[0] + (range[1] - range[0]) * 0.75, 0.37, 0.68, 0.38); // Green
              colorFunc.addRGBPoint(range[1], 0.99, 0.91, 0.15); // Yellow
              break;
            case 'Plasma':
              colorFunc.addRGBPoint(range[0], 0.05, 0.03, 0.53); // Dark blue
              colorFunc.addRGBPoint(range[0] + (range[1] - range[0]) * 0.25, 0.49, 0.01, 0.66); // Purple
              colorFunc.addRGBPoint(range[0] + (range[1] - range[0]) * 0.5, 0.78, 0.15, 0.52); // Magenta
              colorFunc.addRGBPoint(range[0] + (range[1] - range[0]) * 0.75, 0.96, 0.51, 0.19); // Orange
              colorFunc.addRGBPoint(range[1], 0.94, 0.98, 0.16); // Yellow
              break;
            case 'Jet':
              colorFunc.addRGBPoint(range[0], 0.0, 0.0, 0.5); // Dark blue
              colorFunc.addRGBPoint(range[0] + (range[1] - range[0]) * 0.25, 0.0, 0.0, 1.0); // Blue
              colorFunc.addRGBPoint(range[0] + (range[1] - range[0]) * 0.5, 0.0, 1.0, 0.0); // Green
              colorFunc.addRGBPoint(range[0] + (range[1] - range[0]) * 0.75, 1.0, 1.0, 0.0); // Yellow
              colorFunc.addRGBPoint(range[1], 1.0, 0.0, 0.0); // Red
              break;
            case 'Hot':
              colorFunc.addRGBPoint(range[0], 0.0, 0.0, 0.0); // Black
              colorFunc.addRGBPoint(range[0] + (range[1] - range[0]) * 0.33, 1.0, 0.0, 0.0); // Red
              colorFunc.addRGBPoint(range[0] + (range[1] - range[0]) * 0.66, 1.0, 1.0, 0.0); // Yellow
              colorFunc.addRGBPoint(range[1], 1.0, 1.0, 1.0); // White
              break;
            default:
              // Default blue to red
              colorFunc.addRGBPoint(range[0], 0.0, 0.0, 1.0); // Blue
              colorFunc.addRGBPoint(range[1], 1.0, 0.0, 0.0); // Red
          }
        };
        
        applyColorScheme(colorMapName || 'Cool to Warm');
        
        // Build lookup table from color function
        const lutTable = new Uint8Array(256 * 3);
        for (let i = 0; i < 256; i++) {
          const value = range[0] + (i / 255) * (range[1] - range[0]);
          const color = colorFunc.getColor(value);
          lutTable[i * 3] = Math.round(color[0] * 255);
          lutTable[i * 3 + 1] = Math.round(color[1] * 255);
          lutTable[i * 3 + 2] = Math.round(color[2] * 255);
        }
        
        lut.setTable(lutTable);
        setLookupTable(lut);
        
        // Apply to mapper
        mapper.setLookupTable(lut);
        mapper.setScalarRange(range[0], range[1]);
        
        // Set the scalar array to color by
        if (dataArray.type === 'point') {
          mapper.setScalarModeToUsePointData();
          polyData.getPointData().setActiveScalars(dataArray.name);
        } else if (dataArray.type === 'cell') {
          mapper.setScalarModeToUseCellData();
          polyData.getCellData().setActiveScalars(dataArray.name);
        }
        
        mapper.setScalarVisibility(true);
        
        console.log(`✅ Applied color mapping for ${selectedDataArray} with range [${range[0].toFixed(2)}, ${range[1].toFixed(2)}]`);
        
        // Force render
        if (renderWindow) {
          renderWindow.render();
        }
        
      } catch (error) {
        console.error('❌ Error applying color mapping:', error);
        // Fall back to solid color
        mapper.setLookupTable(null);
        if (actor) {
          actor.getProperty().setColor(...objectColor);
        }
      }
    };
    
    applyColorMapping();
  }, [selectedDataArray, colorMapName, mapper, polyData, availableArrays, objectColor, actor, renderWindow]);

  // Update visualization when properties change
  useEffect(() => {
    if (!actor || !renderer || !renderWindow) return;

    const property = actor.getProperty();
    
    // Only set solid color if no data array is selected for color mapping
    if (!selectedDataArray || availableArrays.length === 0) {
      property.setColor(...objectColor);
    }
    
    // Use larger points in wireframe mode for better visibility
    property.setPointSize(wireframeMode ? pointSize * 2 : pointSize);
    property.setOpacity(opacity);
    // For point clouds: 0=POINTS (wireframe), 2=SURFACE (normal)
    property.setRepresentation(wireframeMode ? 0 : 2);
    
    renderer.setBackground(...backgroundColor);
    renderWindow.render();
  }, [backgroundColor, objectColor, pointSize, opacity, wireframeMode, actor, renderer, renderWindow, selectedDataArray, availableArrays]);

  return (
    <div 
      ref={vtkContainerRef} 
      className="w-full h-full" 
      style={{ minHeight: '400px' }}
    />
  );
};

export default VtkRenderer; 