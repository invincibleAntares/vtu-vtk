/**
 * VTU Parser - Parse VTK Unstructured Grid files
 */
class VTUParser {
    constructor() {
        this.data = null;
        this.points = [];
        this.cells = [];
        this.pointArrays = new Map();
        this.cellArrays = new Map();
    }

    async parseFile(file) {
        const text = await this.readFileAsText(file);
        return this.parseVTU(text);
    }

    async parseURL(url) {
        const response = await fetch(url);
        const text = await response.text();
        return this.parseVTU(text);
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    parseVTU(xmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');
        
        // Check for parsing errors
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            throw new Error('Failed to parse VTU file: Invalid XML');
        }

        const vtkFile = doc.querySelector('VTKFile');
        if (!vtkFile || vtkFile.getAttribute('type') !== 'UnstructuredGrid') {
            throw new Error('Not a valid VTU (UnstructuredGrid) file');
        }

        const unstructuredGrid = vtkFile.querySelector('UnstructuredGrid');
        if (!unstructuredGrid) {
            throw new Error('No UnstructuredGrid found in VTU file');
        }

        const piece = unstructuredGrid.querySelector('Piece');
        if (!piece) {
            throw new Error('No Piece found in UnstructuredGrid');
        }

        // Parse points
        this.parsePoints(piece);
        
        // Parse cells
        this.parseCells(piece);
        
        // Parse point data
        this.parsePointData(piece);
        
        // Parse cell data
        this.parseCellData(piece);

        return {
            points: this.points,
            cells: this.cells,
            pointArrays: this.pointArrays,
            cellArrays: this.cellArrays,
            pointCount: this.points.length / 3,
            cellCount: this.cells.length
        };
    }

    parsePoints(piece) {
        const pointsElement = piece.querySelector('Points DataArray');
        if (!pointsElement) {
            throw new Error('No Points data found');
        }

        const pointsText = pointsElement.textContent.trim();
        this.points = this.parseNumberArray(pointsText);
        
        // Ensure we have 3D points
        if (this.points.length % 3 !== 0) {
            throw new Error('Invalid points data: not divisible by 3');
        }
    }

    parseCells(piece) {
        const cellsElement = piece.querySelector('Cells');
        if (!cellsElement) {
            throw new Error('No Cells data found');
        }

        // Parse connectivity
        const connectivity = cellsElement.querySelector('DataArray[Name="connectivity"]');
        const offsets = cellsElement.querySelector('DataArray[Name="offsets"]');
        const types = cellsElement.querySelector('DataArray[Name="types"]');

        if (!connectivity || !offsets || !types) {
            throw new Error('Incomplete cell data (missing connectivity, offsets, or types)');
        }

        const connectivityData = this.parseNumberArray(connectivity.textContent.trim());
        const offsetsData = this.parseNumberArray(offsets.textContent.trim());
        const typesData = this.parseNumberArray(types.textContent.trim());

        // Convert cells to triangles for rendering
        this.cells = this.convertCellsToTriangles(connectivityData, offsetsData, typesData);
    }

    convertCellsToTriangles(connectivity, offsets, types) {
        const triangles = [];
        let currentOffset = 0;

        for (let i = 0; i < offsets.length; i++) {
            const cellType = types[i];
            const nextOffset = offsets[i];
            const numPoints = nextOffset - currentOffset;
            const cellPoints = connectivity.slice(currentOffset, nextOffset);

            // Convert different cell types to triangles
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
                        triangles.push(cellPoints[0], cellPoints[1], cellPoints[2]);
                        triangles.push(cellPoints[0], cellPoints[1], cellPoints[3]);
                        triangles.push(cellPoints[1], cellPoints[2], cellPoints[3]);
                        triangles.push(cellPoints[0], cellPoints[2], cellPoints[3]);
                    }
                    break;
                case 12: // Hexahedron
                    if (numPoints === 8) {
                        // Create triangular faces for hexahedron (simplified)
                        const faces = [
                            [0, 1, 2], [0, 2, 3], // bottom
                            [4, 7, 6], [4, 6, 5], // top
                            [0, 4, 5], [0, 5, 1], // front
                            [2, 6, 7], [2, 7, 3], // back
                            [0, 3, 7], [0, 7, 4], // left
                            [1, 5, 6], [1, 6, 2]  // right
                        ];
                        
                        for (const face of faces) {
                            triangles.push(
                                cellPoints[face[0]],
                                cellPoints[face[1]], 
                                cellPoints[face[2]]
                            );
                        }
                    }
                    break;
                default:
                    // For other cell types, try to create a simple triangulation
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

    parsePointData(piece) {
        const pointDataElement = piece.querySelector('PointData');
        if (!pointDataElement) return;

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
                    dataType: 'point'
                });
            }
        }
    }

    parseCellData(piece) {
        const cellDataElement = piece.querySelector('CellData');
        if (!cellDataElement) return;

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
                    dataType: 'cell'
                });
            }
        }
    }

    parseNumberArray(text) {
        return text.split(/\s+/)
            .filter(s => s.length > 0)
            .map(s => parseFloat(s))
            .filter(n => !isNaN(n));
    }

    getAllArrays() {
        const arrays = new Map();
        
        // Add point arrays
        for (const [name, data] of this.pointArrays) {
            arrays.set(name, data);
        }
        
        // Add cell arrays
        for (const [name, data] of this.cellArrays) {
            arrays.set(name, data);
        }
        
        return arrays;
    }
}
