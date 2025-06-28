# 🎯 VTK Visualization Dashboard

A modern React-based 3D visualization application for VTK and VTU files using vtk.js with advanced color mapping and data visualization capabilities.

## Features

- 📊 **3D VTK Visualization**: Complete VTK file rendering with interactive camera controls
- 🌈 **Advanced Color Mapping**: 6 original visualization palettes:
  - Heat Wave (Blue → Red)
  - Prism Spectrum 
  - Ocean Depths
  - Terrain Heights
  - Energy Field
  - Natural Gradient
- 🔬 **Scientific Data Visualization**: 
  - Temperature, Pressure, and Velocity data arrays
  - Real-time color mapping with per-vertex/per-cell coloring
  - Synthetic data generation for demo purposes
- ✂️ **3D Slicing & Clipping**: Interactive X, Y, Z axis controls for geometry manipulation
- 🎯 **Point Probing**: Ctrl/Shift+click to inspect data values at specific points
- 📁 **File Upload Support**: Drag & drop .vtk and .vtu files
- 🎮 **Camera Controls**: Zoom, rotate, pan with preset view angles

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Open http://localhost:5174 in your browser

## Usage

- **Load VTK Files**: Use the file upload button or drag & drop your .vtk/.vtu files
- **Color Mapping**: Select data arrays (Temperature/Pressure/Velocity) and visualization palettes
- **3D Slicing**: Use the slicing controls to clip geometry along X, Y, Z axes
- **Point Probing**: Hold Ctrl or Shift and click on the 3D object to inspect data values
- **Camera Navigation**: Mouse controls for zoom, rotate, and pan

## Project Structure

```
src/
├── components/           # React components
│   ├── VtkViewer.jsx    # Main VTK viewer with color mapping UI
│   ├── VtkRenderer.jsx  # Core VTK rendering with synthetic data generation
│   └── SlicingControls.jsx  # 3D geometry slicing controls
├── utils/               # Utility functions
│   ├── vtkUtils.js      # VTK file loading utilities
│   ├── vtuParser.js     # VTU file parser
│   └── visualizationPalette.js  # Original color mapping system
└── main.jsx            # Application entry point
```

## Technologies

- React 18 + Vite
- vtk.js for 3D visualization
- TailwindCSS for styling
- Custom visualization palette system
