# 🎯 VTK Visualization Dashboard

A modern React-based 3D visualization application for VTK and VTU files using vtk.js.

## Features

- 📊 **Basic VTK Viewer**: Simple VTK file rendering with camera controls and basic appearance settings
- 🚀 **Advanced ParaView Dashboard**: Professional scientific visualization with:
  - VTU file support with proper mesh connectivity
  - Scientific color mapping (Viridis, Plasma, Cool-to-Warm, etc.)
  - Data array visualization
  - Slicing and clipping controls
  - Point probing with Ctrl/Shift+click
  - File upload support for .vtk and .vtu files

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Open http://localhost:5173 in your browser

## Usage

- **Basic Viewer** (`/`): Simple VTK file rendering
- **Advanced ParaView** (`/paraview`): Full featured scientific visualization

Upload your .vtk or .vtu files using the file upload button in either viewer.

## Project Structure

```
src/
├── components/           # React components
│   ├── VtkViewer.jsx    # Basic VTK viewer
│   ├── ParaViewWebDashboard.jsx  # Advanced dashboard with data visualization
│   ├── VtkRenderer.jsx  # Core VTK rendering logic
│   └── SlicingControls.jsx  # Geometry slicing controls
├── utils/               # Utility functions
│   ├── vtkUtils.js      # VTK file loading utilities
│   └── vtuParser.js     # VTU file parser
└── main.jsx            # Application entry point
```

## Technologies

- React 18 + Vite
- vtk.js for 3D visualization
- TailwindCSS for styling
- React Router for navigation
