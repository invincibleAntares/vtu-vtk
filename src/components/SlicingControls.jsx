import React from 'react';

const SlicingControls = ({ sliceConfig, onSliceChange, bounds }) => {
  if (!bounds) return null;

  const updateSliceAxis = (axis, property, value) => {
    let newValue = parseFloat(value);
    
    // Handle edge cases and validation
    const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 2 : 4;
    const minBound = bounds[axisIndex];
    const maxBound = bounds[axisIndex + 1];
    
    // Clamp values to bounds
    newValue = Math.max(minBound, Math.min(maxBound, newValue));
    
    // Ensure min <= max
    let newConfig = { ...sliceConfig };
    if (property === 'min' && newValue > sliceConfig[axis].max) {
      newConfig[axis] = { ...sliceConfig[axis], min: newValue, max: newValue };
    } else if (property === 'max' && newValue < sliceConfig[axis].min) {
      newConfig[axis] = { ...sliceConfig[axis], min: newValue, max: newValue };
    } else {
      newConfig[axis] = { ...sliceConfig[axis], [property]: newValue };
    }
    
    console.log(`🔧 Updating ${axis} ${property} to ${newValue}`);
    onSliceChange(newConfig);
  };

  const toggleAxis = (axis, enabled) => {
    const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 2 : 4;
    const newConfig = { ...sliceConfig };
    
    if (enabled) {
      // When enabling, start with full range
      newConfig[axis] = {
        enabled: true,
        min: bounds[axisIndex],
        max: bounds[axisIndex + 1]
      };
      console.log(`✅ Enabling ${axis} axis with full range`);
    } else {
      // When disabling, turn off clipping completely
      newConfig[axis] = {
        enabled: false,
        min: bounds[axisIndex],
        max: bounds[axisIndex + 1]
      };
      console.log(`❌ Disabling ${axis} axis - clearing clipping`);
    }
    
    // Immediate update
    onSliceChange(newConfig);
  };

  const resetAxis = (axis) => {
    const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 2 : 4;
    const newConfig = {
      ...sliceConfig,
      [axis]: {
        enabled: false, // Disable clipping
        min: bounds[axisIndex],
        max: bounds[axisIndex + 1]
      }
    };
    console.log(`🔄 Resetting ${axis} axis - disabling clipping`);
    
    // Immediate update
    onSliceChange(newConfig);
  };

  const resetAll = () => {
    const newConfig = {
      x: { enabled: false, min: bounds[0], max: bounds[1] },
      y: { enabled: false, min: bounds[2], max: bounds[3] },
      z: { enabled: false, min: bounds[4], max: bounds[5] }
    };
    console.log('🔄 Resetting ALL slicing - clearing all clipping planes');
    
    // Immediate update
    onSliceChange(newConfig);
  };

  return (
    <div>
      <h3 className="text-white text-sm font-medium mb-2">3D Slicing</h3>
      
      <div className="space-y-3">
        {/* X-Axis Slicing */}
        <div className="bg-gray-700 p-3 rounded">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={sliceConfig.x.enabled}
                onChange={(e) => {
                  console.log('X checkbox clicked:', e.target.checked);
                  toggleAxis('x', e.target.checked);
                }}
                className="rounded"
              />
              <span className="text-red-300 text-sm font-medium">X-Axis</span>
            </label>
            <button
              onClick={() => {
                console.log('X reset button clicked');
                resetAxis('x');
              }}
              className="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded transition-colors"
            >
              Reset
            </button>
          </div>
          
          {sliceConfig.x.enabled && (
            <div className="space-y-2">
              <div>
                <label className="text-gray-300 text-xs block mb-1">
                  Min: {sliceConfig.x.min.toFixed(1)}
                </label>
                <input
                  type="range"
                  min={bounds[0]}
                  max={bounds[1]}
                  step={(bounds[1] - bounds[0]) / 200}
                  value={sliceConfig.x.min}
                  onChange={(e) => updateSliceAxis('x', 'min', e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-gray-300 text-xs block mb-1">
                  Max: {sliceConfig.x.max.toFixed(1)}
                </label>
                <input
                  type="range"
                  min={bounds[0]}
                  max={bounds[1]}
                  step={(bounds[1] - bounds[0]) / 200}
                  value={sliceConfig.x.max}
                  onChange={(e) => updateSliceAxis('x', 'max', e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="text-xs text-red-200 bg-red-900/20 p-1 rounded">
                Visible: {sliceConfig.x.min.toFixed(1)} → {sliceConfig.x.max.toFixed(1)}
              </div>
            </div>
          )}
        </div>

        {/* Y-Axis Slicing */}
        <div className="bg-gray-700 p-3 rounded">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={sliceConfig.y.enabled}
                onChange={(e) => {
                  console.log('Y checkbox clicked:', e.target.checked);
                  toggleAxis('y', e.target.checked);
                }}
                className="rounded"
              />
              <span className="text-green-300 text-sm font-medium">Y-Axis</span>
            </label>
            <button
              onClick={() => {
                console.log('Y reset button clicked');
                resetAxis('y');
              }}
              className="text-xs bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded transition-colors"
            >
              Reset
            </button>
          </div>
          
          {sliceConfig.y.enabled && (
            <div className="space-y-2">
              <div>
                <label className="text-gray-300 text-xs block mb-1">
                  Min: {sliceConfig.y.min.toFixed(1)}
                </label>
                <input
                  type="range"
                  min={bounds[2]}
                  max={bounds[3]}
                  step={(bounds[3] - bounds[2]) / 200}
                  value={sliceConfig.y.min}
                  onChange={(e) => updateSliceAxis('y', 'min', e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-gray-300 text-xs block mb-1">
                  Max: {sliceConfig.y.max.toFixed(1)}
                </label>
                <input
                  type="range"
                  min={bounds[2]}
                  max={bounds[3]}
                  step={(bounds[3] - bounds[2]) / 200}
                  value={sliceConfig.y.max}
                  onChange={(e) => updateSliceAxis('y', 'max', e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="text-xs text-green-200 bg-green-900/20 p-1 rounded">
                Visible: {sliceConfig.y.min.toFixed(1)} → {sliceConfig.y.max.toFixed(1)}
              </div>
            </div>
          )}
        </div>

        {/* Z-Axis Slicing */}
        <div className="bg-gray-700 p-3 rounded">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={sliceConfig.z.enabled}
                onChange={(e) => {
                  console.log('Z checkbox clicked:', e.target.checked);
                  toggleAxis('z', e.target.checked);
                }}
                className="rounded"
              />
              <span className="text-blue-300 text-sm font-medium">Z-Axis</span>
            </label>
            <button
              onClick={() => {
                console.log('Z reset button clicked');
                resetAxis('z');
              }}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition-colors"
            >
              Reset
            </button>
          </div>
          
          {sliceConfig.z.enabled && (
            <div className="space-y-2">
              <div>
                <label className="text-gray-300 text-xs block mb-1">
                  Min: {sliceConfig.z.min.toFixed(1)}
                </label>
                <input
                  type="range"
                  min={bounds[4]}
                  max={bounds[5]}
                  step={(bounds[5] - bounds[4]) / 200}
                  value={sliceConfig.z.min}
                  onChange={(e) => updateSliceAxis('z', 'min', e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-gray-300 text-xs block mb-1">
                  Max: {sliceConfig.z.max.toFixed(1)}
                </label>
                <input
                  type="range"
                  min={bounds[4]}
                  max={bounds[5]}
                  step={(bounds[5] - bounds[4]) / 200}
                  value={sliceConfig.z.max}
                  onChange={(e) => updateSliceAxis('z', 'max', e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="text-xs text-blue-200 bg-blue-900/20 p-1 rounded">
                Visible: {sliceConfig.z.min.toFixed(1)} → {sliceConfig.z.max.toFixed(1)}
              </div>
            </div>
          )}
        </div>

        {/* Global Reset */}
        <button
          onClick={() => {
            console.log('Reset All button clicked');
            resetAll();
          }}
          className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
        >
          🔄 Reset All Slicing
        </button>

        {/* Status */}
        <div className="bg-gray-800 border border-gray-600 rounded p-2">
          <div className="text-xs text-gray-300">
            <div className="font-medium mb-1">Active Clipping:</div>
            <div className="space-y-1">
              {sliceConfig.x.enabled && (
                <div className="text-red-300">
                  • X: {sliceConfig.x.min.toFixed(1)} to {sliceConfig.x.max.toFixed(1)}
                </div>
              )}
              {sliceConfig.y.enabled && (
                <div className="text-green-300">
                  • Y: {sliceConfig.y.min.toFixed(1)} to {sliceConfig.y.max.toFixed(1)}
                </div>
              )}
              {sliceConfig.z.enabled && (
                <div className="text-blue-300">
                  • Z: {sliceConfig.z.min.toFixed(1)} to {sliceConfig.z.max.toFixed(1)}
                </div>
              )}
              {!sliceConfig.x.enabled && !sliceConfig.y.enabled && !sliceConfig.z.enabled && (
                <div className="text-gray-400">• None (full object visible)</div>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-900/10 border border-blue-800 rounded p-2">
          <div className="text-xs text-blue-300">
            <div className="font-medium mb-1">How to use:</div>
            <div className="space-y-1">
              <div>1. Check axis to enable clipping</div>
              <div>2. Adjust Min/Max sliders</div>
              <div>3. Only visible range will show</div>
              <div>4. Use Reset to disable axis</div>
              <div>5. Uncheck box to clear clipping</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlicingControls; 