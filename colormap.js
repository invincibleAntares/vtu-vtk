/**
 * Color mapping utilities for data visualization
 */
class ColorMap {
    constructor() {
        this.colormaps = {
            viridis: [
                [0.267004, 0.004874, 0.329415],
                [0.282623, 0.140926, 0.457517],
                [0.253935, 0.265254, 0.529983],
                [0.206756, 0.371758, 0.553117],
                [0.163625, 0.471133, 0.558148],
                [0.127568, 0.566949, 0.550556],
                [0.134692, 0.658636, 0.517649],
                [0.266941, 0.748751, 0.440573],
                [0.477504, 0.821444, 0.318195],
                [0.741388, 0.873449, 0.149561],
                [0.993248, 0.906157, 0.143936]
            ],
            plasma: [
                [0.050383, 0.029803, 0.527975],
                [0.186213, 0.018803, 0.587228],
                [0.287076, 0.010855, 0.627295],
                [0.381047, 0.001814, 0.653068],
                [0.471457, 0.005678, 0.659897],
                [0.558148, 0.044901, 0.641509],
                [0.641309, 0.132068, 0.596267],
                [0.716387, 0.263759, 0.524573],
                [0.778405, 0.427397, 0.428026],
                [0.823132, 0.619701, 0.310631],
                [0.940015, 0.975158, 0.131326]
            ],
            cool: [
                [0.0, 1.0, 1.0],
                [0.1, 0.9, 1.0],
                [0.2, 0.8, 1.0],
                [0.3, 0.7, 1.0],
                [0.4, 0.6, 1.0],
                [0.5, 0.5, 1.0],
                [0.6, 0.4, 1.0],
                [0.7, 0.3, 1.0],
                [0.8, 0.2, 1.0],
                [0.9, 0.1, 1.0],
                [1.0, 0.0, 1.0]
            ],
            hot: [
                [0.0, 0.0, 0.0],
                [0.4, 0.0, 0.0],
                [0.8, 0.0, 0.0],
                [1.0, 0.0, 0.0],
                [1.0, 0.4, 0.0],
                [1.0, 0.8, 0.0],
                [1.0, 1.0, 0.0],
                [1.0, 1.0, 0.4],
                [1.0, 1.0, 0.8],
                [1.0, 1.0, 1.0]
            ],
            rainbow: [
                [1.0, 0.0, 1.0],  // Magenta
                [0.0, 0.0, 1.0],  // Blue
                [0.0, 1.0, 1.0],  // Cyan
                [0.0, 1.0, 0.0],  // Green
                [1.0, 1.0, 0.0],  // Yellow
                [1.0, 0.5, 0.0],  // Orange
                [1.0, 0.0, 0.0]   // Red
            ]
        };
    }

    /**
     * Get color for a normalized value (0-1) using specified colormap
     */
    getColor(value, colormapName = 'viridis') {
        const colormap = this.colormaps[colormapName] || this.colormaps.viridis;
        
        // Clamp value to [0, 1]
        value = Math.max(0, Math.min(1, value));
        
        // Find the two colors to interpolate between
        const scaledValue = value * (colormap.length - 1);
        const lowerIndex = Math.floor(scaledValue);
        const upperIndex = Math.min(lowerIndex + 1, colormap.length - 1);
        const t = scaledValue - lowerIndex;
        
        const lowerColor = colormap[lowerIndex];
        const upperColor = colormap[upperIndex];
        
        // Linear interpolation
        const r = lowerColor[0] + (upperColor[0] - lowerColor[0]) * t;
        const g = lowerColor[1] + (upperColor[1] - lowerColor[1]) * t;
        const b = lowerColor[2] + (upperColor[2] - lowerColor[2]) * t;
        
        return [r, g, b];
    }

    /**
     * Map array of values to colors
     */
    mapValues(values, colormapName = 'viridis', useDataRange = true) {
        if (values.length === 0) return [];
        
        let min, max;
        
        if (useDataRange) {
            min = Math.min(...values);
            max = Math.max(...values);
        } else {
            min = 0;
            max = 1;
        }
        
        const range = max - min;
        const colors = [];
        
        for (const value of values) {
            const normalizedValue = range > 0 ? (value - min) / range : 0;
            const color = this.getColor(normalizedValue, colormapName);
            colors.push(...color);
        }
        
        return {
            colors: colors,
            min: min,
            max: max,
            range: range
        };
    }

    /**
     * Generate legend canvas for a colormap
     */
    generateLegend(canvas, colormapName = 'viridis', min = 0, max = 1) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Create image data
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        
        // Fill the legend from top to bottom (max to min)
        for (let y = 0; y < height; y++) {
            const value = 1 - (y / (height - 1)); // Invert y to go from max to min
            const color = this.getColor(value, colormapName);
            
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                data[index] = Math.round(color[0] * 255);     // R
                data[index + 1] = Math.round(color[1] * 255); // G
                data[index + 2] = Math.round(color[2] * 255); // B
                data[index + 3] = 255;                        // A
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Get available colormap names
     */
    getAvailableColormaps() {
        return Object.keys(this.colormaps);
    }

    /**
     * Convert array values to scalar values for color mapping
     * Handles vector data by computing magnitude
     */
    prepareValuesForMapping(data, components = 1) {
        if (components === 1) {
            return data;
        }
        
        const scalarValues = [];
        for (let i = 0; i < data.length; i += components) {
            let magnitude = 0;
            for (let j = 0; j < components; j++) {
                magnitude += data[i + j] * data[i + j];
            }
            scalarValues.push(Math.sqrt(magnitude));
        }
        
        return scalarValues;
    }
}
