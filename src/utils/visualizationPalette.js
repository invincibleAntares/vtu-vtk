/**
 * Advanced Data Visualization Palette System
 * Custom implementation for scientific data coloring
 */

export class DataVisualizationPalette {
  constructor() {
    // Custom color schemes with unique mathematical formulations
    this.colorSchemes = {
      'heatwave': {
        displayName: 'Heat Wave',
        colorFunction: this.buildHeatWaveGradient,
        description: 'Temperature-inspired blue to red transition'
      },
      'prism': {
        displayName: 'Prism Spectrum', 
        colorFunction: this.buildPrismSpectrum,
        description: 'Light spectrum rainbow dispersion'
      },
      'depths': {
        displayName: 'Ocean Depths',
        colorFunction: this.buildDepthGradient,
        description: 'Underwater depth visualization'
      },
      'elevation': {
        displayName: 'Terrain Heights',
        colorFunction: this.buildElevationColors,
        description: 'Geographic elevation mapping'
      },
      'energy': {
        displayName: 'Energy Field',
        colorFunction: this.buildEnergyField,
        description: 'High-energy particle visualization'
      },
      'nature': {
        displayName: 'Natural Gradient',
        colorFunction: this.buildNatureColors,
        description: 'Biologically-inspired color progression'
      }
    };
  }

  // Custom heat wave algorithm (blue to red with mathematical curve)
  buildHeatWaveGradient(numSamples = 256) {
    const colorArray = [];
    for (let i = 0; i < numSamples; i++) {
      const normalizedPos = i / (numSamples - 1);
      const redComponent = Math.pow(normalizedPos, 0.7);
      const greenComponent = Math.pow(normalizedPos, 1.8) * 0.75;
      const blueComponent = Math.max(0, 1 - normalizedPos * 1.3);
      colorArray.push([redComponent, greenComponent, blueComponent]);
    }
    return colorArray;
  }

  // Custom prism spectrum using HSV to RGB conversion
  buildPrismSpectrum(numSamples = 256) {
    const colorArray = [];
    for (let i = 0; i < numSamples; i++) {
      const normalizedPos = i / (numSamples - 1);
      const hueAngle = (1 - normalizedPos) * 280; // Custom hue range
      const [red, green, blue] = this.convertHSVtoRGB(hueAngle, 1.0, 0.85);
      colorArray.push([red, green, blue]);
    }
    return colorArray;
  }

  // Custom depth gradient (water-like colors)
  buildDepthGradient(numSamples = 256) {
    const colorArray = [];
    for (let i = 0; i < numSamples; i++) {
      const pos = i / (numSamples - 1);
      const redVal = pos * 0.25;
      const greenVal = 0.35 + pos * 0.55;
      const blueVal = 0.85 + pos * 0.15;
      colorArray.push([redVal, greenVal, blueVal]);
    }
    return colorArray;
  }

  // Custom elevation mapping (terrain-like)
  buildElevationColors(numSamples = 256) {
    const colorArray = [];
    for (let i = 0; i < numSamples; i++) {
      const elevation = i / (numSamples - 1);
      let redVal, greenVal, blueVal;
      
      if (elevation < 0.25) {
        // Water regions
        const localPos = elevation / 0.25;
        redVal = 0.05 + localPos * 0.45;
        greenVal = 0.25 + localPos * 0.45;
        blueVal = 0.85;
      } else if (elevation < 0.75) {
        // Land regions
        const localPos = (elevation - 0.25) / 0.5;
        redVal = 0.5 + localPos * 0.35;
        greenVal = 0.7;
        blueVal = 0.85 - localPos * 0.65;
      } else {
        // Mountain peaks
        const localPos = (elevation - 0.75) / 0.25;
        redVal = 0.85 + localPos * 0.15;
        greenVal = 0.7 - localPos * 0.45;
        blueVal = 0.2 + localPos * 0.7;
      }
      
      colorArray.push([redVal, greenVal, blueVal]);
    }
    return colorArray;
  }

  // Custom energy field visualization
  buildEnergyField(numSamples = 256) {
    const colorArray = [];
    for (let i = 0; i < numSamples; i++) {
      const intensity = i / (numSamples - 1);
      const redVal = Math.sin(intensity * Math.PI) * 0.85 + 0.15;
      const greenVal = Math.pow(intensity, 2.2) * 0.65;
      const blueVal = Math.pow(1 - intensity, 0.4) * 0.95;
      colorArray.push([redVal, greenVal, blueVal]);
    }
    return colorArray;
  }

  // Custom nature-inspired gradient
  buildNatureColors(numSamples = 256) {
    const colorArray = [];
    for (let i = 0; i < numSamples; i++) {
      const growth = i / (numSamples - 1);
      const redVal = Math.pow(growth, 2.1) * 0.85;
      const greenVal = Math.sin(growth * Math.PI * 0.9) * 0.95 + 0.05;
      const blueVal = Math.max(0.15, 1 - growth * 0.85);
      colorArray.push([redVal, greenVal, blueVal]);
    }
    return colorArray;
  }

  // Custom HSV to RGB utility
  convertHSVtoRGB(hue, saturation, brightness) {
    hue = hue / 360;
    const chroma = saturation * Math.min(brightness, 1 - brightness);
    const huePrime = (n, k = (n + hue * 12) % 12) => brightness - chroma * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return [huePrime(0), huePrime(8), huePrime(4)];
  }

  // Get all available scheme identifiers
  getSchemeList() {
    return Object.keys(this.colorSchemes);
  }

  // Get scheme metadata
  getSchemeData(schemeId) {
    return this.colorSchemes[schemeId] || this.colorSchemes['heatwave'];
  }

  // Generate color progression for data visualization
  createColorProgression(schemeId, minValue, maxValue, resolution = 256) {
    const scheme = this.colorSchemes[schemeId] || this.colorSchemes['heatwave'];
    const colors = scheme.colorFunction.call(this, resolution);
    
    return {
      colorData: colors,
      valueRange: [minValue, maxValue],
      resolution: resolution,
      schemeName: scheme.displayName
    };
  }

  // Generate VTK-compatible color points
  buildVTKColorPoints(schemeId, valueRange) {
    const [minVal, maxVal] = valueRange;
    const colorSet = this.createColorProgression(schemeId, minVal, maxVal, 24);
    
    const vtkPoints = [];
    colorSet.colorData.forEach((colorRGB, idx) => {
      const dataValue = minVal + (idx / (colorSet.colorData.length - 1)) * (maxVal - minVal);
      vtkPoints.push([dataValue, colorRGB[0], colorRGB[1], colorRGB[2]]);
    });
    
    return vtkPoints;
  }

  // Map individual value to color
  getColorForValue(value, schemeId, valueRange) {
    const [minVal, maxVal] = valueRange;
    const normalizedVal = Math.max(0, Math.min(1, (value - minVal) / (maxVal - minVal)));
    
    const scheme = this.colorSchemes[schemeId] || this.colorSchemes['heatwave'];
    const colors = scheme.colorFunction.call(this, 256);
    
    const colorIndex = Math.floor(normalizedVal * (colors.length - 1));
    return colors[colorIndex] || [0.5, 0.5, 0.5];
  }
}

// Export singleton instance
const visualizationPalette = new DataVisualizationPalette();
export default visualizationPalette; 