import vtkPoints from '@kitware/vtk.js/Common/Core/Points';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';

/**
 * Enhanced VTU Parser for proper VTU file handling
 * Based on the working implementation from newwww folder
 */
export class VTUParser {
  constructor() {
    this.points = [];
    this.cells = [];
    this.pointArrays = new Map();
    this.cellArrays = new Map();
  }

  async parseVTU(vtuContent) {
    try {
      console.log('🔧 Parsing VTU file with enhanced parser...');
      
      // Parse XML content
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(vtuContent, 'text/xml');
      
      // Check for parsing errors
      const parserError = xmlDoc.getElementsByTagName('parsererror');
      if (parserError.length > 0) {
        throw new Error('XML parsing error: ' + parserError[0].textContent);
      }

      // Find the UnstructuredGrid element
      const unstructuredGrid = xmlDoc.querySelector('UnstructuredGrid');
      if (!unstructuredGrid) {
        throw new Error('No UnstructuredGrid found in VTU file');
      }

      // Find the Piece element
      const piece = unstructuredGrid.querySelector('Piece');
      if (!piece) {
        throw new Error('No Piece found in VTU file');
      }

      // Parse geometry
      await this.parsePoints(piece);
      await this.parseCells(piece);
      
      // Parse data arrays
      await this.parsePointData(piece);
      await this.parseCellData(piece);

      // Convert to VTK PolyData
      const polyData = this.createPolyData();
      
      console.log(`✅ VTU parsed successfully: ${this.points.length / 3} points, ${this.cells.length / 3} triangles`);
      console.log(`📊 Point arrays: ${this.pointArrays.size}, Cell arrays: ${this.cellArrays.size}`);
      
      return {
        polyData,
        stats: this.getStatistics(),
        pointArrays: this.pointArrays,
        cellArrays: this.cellArrays
      };

    } catch (error) {
      console.error('❌ VTU parsing failed:', error);
      throw error;
    }
  }

  async parsePoints(piece) {
    const pointsElement = piece.querySelector('Points');
    if (!pointsElement) {
      throw new Error('No Points element found');
    }

    const dataArray = pointsElement.querySelector('DataArray');
    if (!dataArray) {
      throw new Error('No Points DataArray found');
    }

    const format = dataArray.getAttribute('format') || 'ascii';
    if (format !== 'ascii') {
      throw new Error('Only ASCII format VTU files are supported');
    }

    const textContent = dataArray.textContent || dataArray.innerHTML;
    this.points = this.parseNumberArray(textContent);
    
    if (this.points.length % 3 !== 0) {
      throw new Error('Invalid points data - not divisible by 3');
    }

    console.log(`📍 Parsed ${this.points.length / 3} points`);
  }

  async parseCells(piece) {
    const cellsElement = piece.querySelector('Cells');
    if (!cellsElement) {
      throw new Error('No Cells element found');
    }

    // Parse connectivity
    const connectivityArray = cellsElement.querySelector('DataArray[Name="connectivity"]');
    if (!connectivityArray) {
      throw new Error('No connectivity DataArray found');
    }

    const connectivity = this.parseNumberArray(connectivityArray.textContent);

    // Parse offsets
    const offsetsArray = cellsElement.querySelector('DataArray[Name="offsets"]');
    if (!offsetsArray) {
      throw new Error('No offsets DataArray found');
    }

    const offsets = this.parseNumberArray(offsetsArray.textContent);

    // Parse cell types
    const typesArray = cellsElement.querySelector('DataArray[Name="types"]');
    if (!typesArray) {
      throw new Error('No types DataArray found');
    }

    const types = this.parseNumberArray(typesArray.textContent);

    // Convert cells to triangles
    this.cells = this.trianglateCells(connectivity, offsets, types);
    
    console.log(`🔺 Generated ${this.cells.length / 3} triangles from cells`);
  }

  trianglateCells(connectivity, offsets, types) {
    const triangles = [];
    let currentOffset = 0;

    for (let i = 0; i < offsets.length; i++) {
      const nextOffset = offsets[i];
      const cellType = types[i];
      const numPoints = nextOffset - currentOffset;
      
      // Extract points for this cell
      const cellPoints = [];
      for (let j = currentOffset; j < nextOffset; j++) {
        cellPoints.push(connectivity[j]);
      }

      // Triangulate based on cell type
      switch (cellType) {
        case 5: // Triangle
          if (numPoints === 3) {
            triangles.push(...cellPoints);
          }
          break;
        
        case 9: // Quad
          if (numPoints === 4) {
            // Split quad into two triangles
            triangles.push(cellPoints[0], cellPoints[1], cellPoints[2]);
            triangles.push(cellPoints[0], cellPoints[2], cellPoints[3]);
          }
          break;
        
        case 10: // Tetrahedron
          if (numPoints === 4) {
            // Create 4 triangular faces
            const faces = [
              [0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]
            ];
            for (const face of faces) {
              triangles.push(cellPoints[face[0]], cellPoints[face[1]], cellPoints[face[2]]);
            }
          }
          break;
        
        case 12: // Hexahedron (cube)
          if (numPoints === 8) {
            // Create 12 triangular faces (2 triangles per face, 6 faces)
            const faces = [
              [0, 1, 2], [0, 2, 3], // bottom
              [4, 7, 6], [4, 6, 5], // top
              [0, 4, 5], [0, 5, 1], // front
              [2, 6, 7], [2, 7, 3], // back
              [0, 3, 7], [0, 7, 4], // left
              [1, 5, 6], [1, 6, 2]  // right
            ];
            for (const face of faces) {
              triangles.push(cellPoints[face[0]], cellPoints[face[1]], cellPoints[face[2]]);
            }
          }
          break;
        
        default:
          // For other cell types, try simple fan triangulation
          if (numPoints >= 3) {
            for (let j = 1; j < numPoints - 1; j++) {
              triangles.push(cellPoints[0], cellPoints[j], cellPoints[j + 1]);
            }
          }
          break;
      }

      currentOffset = nextOffset;
    }

    return triangles;
  }

  async parsePointData(piece) {
    const pointDataElement = piece.querySelector('PointData');
    if (!pointDataElement) {
      console.log('⚠️ No PointData found in VTU file');
      return;
    }

    const dataArrays = pointDataElement.querySelectorAll('DataArray');
    for (const dataArray of dataArrays) {
      const name = dataArray.getAttribute('Name');
      const type = dataArray.getAttribute('type') || 'Float32';
      const numComponents = parseInt(dataArray.getAttribute('NumberOfComponents') || '1');

      if (name) {
        const data = this.parseNumberArray(dataArray.textContent.trim());
        this.pointArrays.set(name, {
          data: data,
          type: type,
          components: numComponents,
          dataType: 'point',
          range: [Math.min(...data), Math.max(...data)]
        });
        console.log(`📊 Found point array: ${name} (${data.length} values, ${numComponents} components)`);
      }
    }
  }

  async parseCellData(piece) {
    const cellDataElement = piece.querySelector('CellData');
    if (!cellDataElement) {
      console.log('⚠️ No CellData found in VTU file');
      return;
    }

    const dataArrays = cellDataElement.querySelectorAll('DataArray');
    for (const dataArray of dataArrays) {
      const name = dataArray.getAttribute('Name');
      const type = dataArray.getAttribute('type') || 'Float32';
      const numComponents = parseInt(dataArray.getAttribute('NumberOfComponents') || '1');

      if (name) {
        const data = this.parseNumberArray(dataArray.textContent.trim());
        this.cellArrays.set(name, {
          data: data,
          type: type,
          components: numComponents,
          dataType: 'cell',
          range: [Math.min(...data), Math.max(...data)]
        });
        console.log(`📊 Found cell array: ${name} (${data.length} values, ${numComponents} components)`);
      }
    }
  }

  parseNumberArray(text) {
    return text.split(/\s+/)
      .filter(s => s.length > 0)
      .map(s => parseFloat(s))
      .filter(n => !isNaN(n));
  }

  createPolyData() {
    // Create VTK points
    const pointsInstance = vtkPoints.newInstance();
    pointsInstance.setData(new Float32Array(this.points), 3);

    // Create VTK polydata
    const polyData = vtkPolyData.newInstance();
    polyData.setPoints(pointsInstance);

    // Add triangles as polys
    if (this.cells.length > 0) {
      const numTriangles = this.cells.length / 3;
      const polysArray = new Uint32Array(numTriangles * 4); // 3 points + count per triangle
      
      for (let i = 0; i < numTriangles; i++) {
        const baseIndex = i * 4;
        const cellIndex = i * 3;
        
        polysArray[baseIndex] = 3; // Triangle has 3 points
        polysArray[baseIndex + 1] = this.cells[cellIndex];
        polysArray[baseIndex + 2] = this.cells[cellIndex + 1];
        polysArray[baseIndex + 3] = this.cells[cellIndex + 2];
      }
      
      polyData.getPolys().setData(polysArray);
    } else {
      // If no cells, create vertex representation
      const numPoints = this.points.length / 3;
      const vertsArray = new Uint32Array(numPoints * 2);
      for (let i = 0; i < numPoints; i++) {
        vertsArray[i * 2] = 1; // 1 point per vertex
        vertsArray[i * 2 + 1] = i; // point index
      }
      polyData.getVerts().setData(vertsArray);
    }

    // Add point data arrays to polydata
    for (const [name, arrayData] of this.pointArrays) {
      const vtkArray = vtkDataArray.newInstance({
        name: name,
        values: new Float32Array(arrayData.data),
        numberOfComponents: arrayData.components
      });
      polyData.getPointData().addArray(vtkArray);
    }

    // Add cell data arrays to polydata  
    for (const [name, arrayData] of this.cellArrays) {
      const vtkArray = vtkDataArray.newInstance({
        name: name,
        values: new Float32Array(arrayData.data),
        numberOfComponents: arrayData.components
      });
      polyData.getCellData().addArray(vtkArray);
    }

    return polyData;
  }

  getStatistics() {
    const numPoints = this.points.length / 3;
    const numCells = this.cells.length / 3;
    
    // Calculate bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    for (let i = 0; i < this.points.length; i += 3) {
      const x = this.points[i];
      const y = this.points[i + 1];
      const z = this.points[i + 2];
      
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }

    // Prepare data arrays info
    const dataArrays = [];
    
    for (const [name, arrayData] of this.pointArrays) {
      dataArrays.push({
        name: name,
        type: 'point',
        size: arrayData.data.length,
        numberOfComponents: arrayData.components,
        range: arrayData.range,
        data: arrayData.data
      });
    }
    
    for (const [name, arrayData] of this.cellArrays) {
      dataArrays.push({
        name: name,
        type: 'cell',
        size: arrayData.data.length,
        numberOfComponents: arrayData.components,
        range: arrayData.range,
        data: arrayData.data
      });
    }

    return {
      points: numPoints,
      cells: numCells,
      bounds: [minX, maxX, minY, maxY, minZ, maxZ],
      dataArrays: dataArrays,
      pointArrays: this.pointArrays,
      cellArrays: this.cellArrays
    };
  }

  getAllArrays() {
    const allArrays = new Map();
    for (const [name, data] of this.pointArrays) {
      allArrays.set(name, data);
    }
    for (const [name, data] of this.cellArrays) {
      allArrays.set(name, data);
    }
    return allArrays;
  }
} 