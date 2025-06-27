import vtkPoints from '@kitware/vtk.js/Common/Core/Points';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import { VTUParser } from './vtuParser.js';

/**
 * Load a VTK/VTU file and return polyData with statistics
 * @param {string|File} filePath - Path to the VTK file or File object
 * @returns {Promise<{polyData: object, stats: object}>}
 */
export const loadVtkFile = async (filePath) => {
  try {
    const isFile = filePath instanceof File;
    const fileName = isFile ? filePath.name : filePath;
    console.log('📁 Loading VTK/VTU file:', fileName);

    // Load VTK.js modules
    const [
      { default: vtkXMLPolyDataReader }
    ] = await Promise.all([
      import('@kitware/vtk.js/IO/XML/XMLPolyDataReader')
    ]);

    let vtkBuffer;
    
    if (isFile) {
      // Handle uploaded file
      vtkBuffer = await filePath.arrayBuffer();
    } else {
      // Fetch the VTK file from server
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch VTK file: ${response.status} ${response.statusText}`);
      }
      vtkBuffer = await response.arrayBuffer();
    }
    
    // Read as binary ArrayBuffer and check format
    // Decode the header (first ~100 KB) as ASCII so we can inspect meta-info quickly
    const headerText = new TextDecoder('ascii').decode(vtkBuffer.slice(0, 100000));
    const isBinary = headerText.includes('BINARY');
    const isVTU = fileName.toLowerCase().endsWith('.vtu') || headerText.includes('<VTKFile');
    const isXML = headerText.includes('<?xml') || headerText.includes('<VTKFile');
    
    console.log(`ℹ️ File detected as ${isVTU ? 'VTU (XML)' : 'VTK'} format, ${isBinary ? 'BINARY' : 'ASCII'} encoding`);

    let polyData = null;
    let vtuResult = null; // Store VTU parser result for enhanced stats

    if (isVTU || isXML) {
      // VTU (XML) WORKFLOW - Handle .vtu files
      console.log('🔍 Attempting VTU/XML readers…');
      const vtkDataText = new TextDecoder('utf-8').decode(vtkBuffer);
      
      try {
        if (headerText.includes('UnstructuredGrid')) {
          // VTU files with UnstructuredGrid - use proper VTU parser from newwww implementation
          console.log('🔧 VTU/UnstructuredGrid detected - using newwww-based VTU parser');
          const parser = new VTUParser();
          vtuResult = await parser.parseVTU(vtkDataText);
          polyData = vtuResult.polyData;
          if (polyData) {
            console.log('✅ Parsed VTU file with newwww-based parser');
            // Update stats with proper data from VTU parser
            const vtuStats = vtuResult.stats;
            console.log(`📊 VTU Stats: ${vtuStats.points} points, ${vtuStats.cells} cells`);
          }
        } else if (headerText.includes('PolyData')) {
          // Use XML PolyData Reader for XML .vtk files
          const reader = vtkXMLPolyDataReader.newInstance();
          reader.parseAsText(vtkDataText);
          polyData = reader.getOutputData();
          if (polyData) {
            console.log('✅ Parsed XML VTK file with XMLPolyDataReader');
          }
        }
              } catch (xmlError) {
          console.log('⚠️ VTU parser failed:', xmlError?.message || xmlError);
          console.log('🔄 Falling back to simple point extraction...');
          try {
            polyData = await simpleFallbackVTUParsing(vtkDataText);
            if (polyData) {
              console.log('⚠️ Using fallback point extraction - some geometry may be missing');
            }
          } catch (fallbackError) {
            console.log('❌ Fallback parser also failed:', fallbackError?.message || fallbackError);
          }
        }
    } else if (!isBinary) {
      // ASCII WORKFLOW (XML / Legacy PolyData)
      console.log('🔍 Attempting ASCII readers…');
      const vtkDataText = headerText + new TextDecoder('ascii').decode(vtkBuffer.slice(headerText.length));

      // Try XML reader first (for .vtp or XML style .vtk)
      const reader = vtkXMLPolyDataReader.newInstance();
      let asciiParsed = false;
      try {
        reader.parseAsText(vtkDataText);
        polyData = reader.getOutputData();
        asciiParsed = !!polyData;
        if (asciiParsed) {
          console.log('✅ Parsed with XMLPolyDataReader');
        }
      } catch (_) {
        /* ignore */
      }

      if (!asciiParsed) {
        // Try legacy polydata reader (only supports POLYDATA)
        try {
          const { default: vtkPolyDataReader } = await import('@kitware/vtk.js/IO/Legacy/PolyDataReader');
          const legacyReader = vtkPolyDataReader.newInstance();
          legacyReader.parseAsText(vtkDataText);
          polyData = legacyReader.getOutputData();
          if (polyData) {
            console.log('✅ Parsed with Legacy PolyDataReader');
          }
        } catch (legacyErr) {
          console.log('⚠️ Legacy PolyDataReader failed:', legacyErr?.message || legacyErr);
        }
      }

      // Manual ASCII UNSTRUCTURED_GRID fallback
      if (!polyData && headerText.includes('UNSTRUCTURED_GRID')) {
        console.log('🔧 Attempting enhanced ASCII UNSTRUCTURED_GRID parsing…');
        try {
          // Try to convert ASCII UNSTRUCTURED_GRID to XML-like format for enhanced parser
          const xmlVtuContent = convertLegacyVtkToVtu(vtkDataText);
          if (xmlVtuContent) {
            const parser = new VTUParser();
            vtuResult = await parser.parseVTU(xmlVtuContent);
            polyData = vtuResult.polyData;
            if (polyData) {
              console.log('✅ Converted legacy VTK to VTU format successfully');
            }
          }
        } catch (conversionError) {
          console.log('⚠️ Legacy to VTU conversion failed, using point extraction:', conversionError?.message);
          polyData = await manualParseUnstructuredGridToPoints(vtkDataText);
        }
      }
    } else {
      // BINARY WORKFLOW (manual point extraction)
      if (headerText.includes('UNSTRUCTURED_GRID') || isVTU) {
        console.log('🔧 Attempting manual BINARY VTU/UNSTRUCTURED_GRID point extraction…');
        if (isVTU) {
          // For binary VTU files, fall back to ASCII parsing
          console.log('⚠️ Binary VTU format detected - this is not fully supported yet');
          console.log('💡 Try converting your VTU file to ASCII format for better support');
        } else {
          polyData = await manualParseBinaryUnstructuredGridToPoints(vtkBuffer, headerText);
        }
      }
    }

    if (!polyData) {
      throw new Error('Dataset type not supported by vtk.js and fallback parsers');
    }

    // Calculate statistics
    const numPoints = polyData.getNumberOfPoints();
    const numCells = polyData.getNumberOfCells ? polyData.getNumberOfCells() : 0;
    const bounds = polyData.getBounds();
    
    // Extract data arrays information
    const dataArrays = [];
    
    // Check point data arrays with error handling
    const pointData = polyData.getPointData();
    if (pointData) {
      try {
        for (let i = 0; i < pointData.getNumberOfArrays(); i++) {
          const array = pointData.getArray(i);
          if (array) {
            try {
              const data = array.getData ? array.getData() : array;
              const range = array.getRange ? array.getRange() : [0, 1];
              const size = array.getSize ? array.getSize() : (data ? data.length : 0);
              const numComponents = array.getNumberOfComponents ? array.getNumberOfComponents() : 1;
              const name = array.getName ? array.getName() : `PointArray_${i}`;
              
              dataArrays.push({
                name: name,
                type: 'point',
                size: size,
                numberOfComponents: numComponents,
                data: data,
                range: range
              });
              console.log(`📊 Added point data array: ${name} (${size} values)`);
            } catch (arrayError) {
              console.warn(`⚠️ Could not process point array ${i}:`, arrayError.message);
            }
          }
        }
      } catch (pointDataError) {
        console.warn('⚠️ Error reading point data arrays:', pointDataError.message);
      }
    }
    
    // Check cell data arrays with error handling
    const cellData = polyData.getCellData();
    if (cellData) {
      try {
        for (let i = 0; i < cellData.getNumberOfArrays(); i++) {
          const array = cellData.getArray(i);
          if (array) {
            try {
              const data = array.getData ? array.getData() : array;
              const range = array.getRange ? array.getRange() : [0, 1];
              const size = array.getSize ? array.getSize() : (data ? data.length : 0);
              const numComponents = array.getNumberOfComponents ? array.getNumberOfComponents() : 1;
              const name = array.getName ? array.getName() : `CellArray_${i}`;
              
              dataArrays.push({
                name: name,
                type: 'cell',
                size: size,
                numberOfComponents: numComponents,
                data: data,
                range: range
              });
              console.log(`📊 Added cell data array: ${name} (${size} values)`);
            } catch (arrayError) {
              console.warn(`⚠️ Could not process cell array ${i}:`, arrayError.message);
            }
          }
        }
      } catch (cellDataError) {
        console.warn('⚠️ Error reading cell data arrays:', cellDataError.message);
      }
    }

    // Use VTU parser stats if available (more accurate for VTU files)
    const stats = vtuResult ? vtuResult.stats : {
      points: numPoints,
      cells: numCells,
      bounds: bounds,
      dataArrays: dataArrays
    };

    console.log('📊 VTK file loaded successfully:', stats);

    return { polyData, stats };

  } catch (error) {
    console.error('❌ Error loading VTK file:', error);
    throw error;
  }
};

// Helper: Manual parser for UNSTRUCTURED_GRID -> Point cloud PolyData
async function manualParseUnstructuredGridToPoints(vtkText) {
  try {
    const lines = vtkText.split(/\r?\n/);
    let ptsSection = false;
    let numPts = 0;
    const coords = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (!ptsSection) {
        if (line.startsWith('POINTS')) {
          const parts = line.split(/\s+/);
          numPts = parseInt(parts[1], 10);
          ptsSection = true;
          continue;
        }
      } else {
        // Collect point coordinates until we reach required number
        const tokens = line.split(/\s+/).map(Number).filter((v) => !isNaN(v));
        coords.push(...tokens);
        if (coords.length >= numPts * 3) {
          break;
        }
      }
    }

    if (coords.length < numPts * 3 || numPts === 0) {
      console.warn('manualParseUnstructuredGridToPoints: could not parse points');
      return null;
    }

    const pointsData = new Float32Array(coords.slice(0, numPts * 3));
    const pts = vtkPoints.newInstance();
    pts.setData(pointsData, 3);

    const polyData = vtkPolyData.newInstance();
    polyData.setPoints(pts);

    // Build verts cell array for rendering points
    const vertsArray = new Uint32Array(numPts * 2);
    for (let i = 0; i < numPts; i++) {
      vertsArray[i * 2] = 1; // number of points in cell
      vertsArray[i * 2 + 1] = i; // point index
    }
    polyData.getVerts().setData(vertsArray);

    return polyData;
  } catch (e) {
    console.error('manualParseUnstructuredGridToPoints error:', e);
    return null;
  }
}

// Helper: Manual parser for BINARY UNSTRUCTURED_GRID -> Point cloud PolyData
function manualParseBinaryUnstructuredGridToPoints(buffer, headerText) {
  try {
    // Locate the POINTS line in the ASCII header
    const lines = headerText.split(/\r?\n/);
    let offsetInHeader = 0;
    let numPts = 0;
    let bytesPerComp = 4; // default float32
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      offsetInHeader += line.length + 1; // +1 for newline
      if (line.startsWith('POINTS')) {
        const parts = line.split(/\s+/);
        numPts = parseInt(parts[1], 10);
        const dtype = (parts[2] || '').toLowerCase();
        if (dtype === 'double') {
          bytesPerComp = 8;
        }
        break;
      }
    }
    
    if (!numPts) {
      console.warn('manualParseBinary: POINTS line not found');
      return null;
    }

    const totalBytes = numPts * 3 * bytesPerComp;
    const dataOffset = offsetInHeader; // binary data starts immediately after POINTS line newline
    
    if (buffer.byteLength < dataOffset + totalBytes) {
      console.warn('manualParseBinary: buffer too small for expected points');
      return null;
    }

    const dv = new DataView(buffer, dataOffset, totalBytes);
    const coords = new Float32Array(numPts * 3);
    const littleEndian = false; // VTK binary is big-endian by spec
    
    for (let i = 0; i < numPts * 3; i++) {
      const byteOffset = i * bytesPerComp;
      coords[i] = bytesPerComp === 8 
        ? dv.getFloat64(byteOffset, littleEndian) 
        : dv.getFloat32(byteOffset, littleEndian);
    }

    const pts = vtkPoints.newInstance();
    pts.setData(coords, 3);
    const polyData = vtkPolyData.newInstance();
    polyData.setPoints(pts);

    // verts cell array
    const vertsArray = new Uint32Array(numPts * 2);
    for (let i = 0; i < numPts; i++) {
      vertsArray[i * 2] = 1;
      vertsArray[i * 2 + 1] = i;
    }
    polyData.getVerts().setData(vertsArray);

    return polyData;
  } catch (e) {
    console.error('manualParseBinaryUnstructuredGridToPoints error:', e);
    return null;
  }
}

// The EnhancedVTUParser class has been moved to vtuParser.js for better organization
// and is now imported as VTUParser above

// Helper: Manual parser for VTU files -> Enhanced PolyData
async function manualParseVTUToPoints(vtkXMLText) {
  try {
    const parser = new VTUParser();
    const result = await parser.parseVTU(vtkXMLText);
    return result.polyData;
  } catch (e) {
    console.error('VTU parsing failed:', e);
    // Fallback to simple point extraction
    return await simpleFallbackVTUParsing(vtkXMLText);
  }
}

// Fallback simple VTU parsing for basic point extraction
async function simpleFallbackVTUParsing(vtkXMLText) {
  try {
    console.log('🔧 Using fallback simple VTU parsing for point extraction');
    
    // Parse XML to extract points
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(vtkXMLText, 'text/xml');
    
    // Check for XML parsing errors
    const parserError = xmlDoc.getElementsByTagName('parsererror');
    if (parserError.length > 0) {
      console.error('XML parsing error:', parserError[0].textContent);
      return null;
    }
    
    // Find Points element
    const pointsElements = xmlDoc.getElementsByTagName('Points');
    if (pointsElements.length === 0) {
      console.warn('No Points element found in VTU file');
      return null;
    }
    
    const pointsElement = pointsElements[0];
    const dataArrays = pointsElement.getElementsByTagName('DataArray');
    let pointsDataArray = null;
    
    // Find the points data array
    for (let i = 0; i < dataArrays.length; i++) {
      const array = dataArrays[i];
      if (array.getAttribute('Name') === 'Points' || !array.getAttribute('Name')) {
        pointsDataArray = array;
        break;
      }
    }
    
    if (!pointsDataArray) {
      console.warn('No points DataArray found in VTU file');
      return null;
    }
    
    // Extract point coordinates
    const format = pointsDataArray.getAttribute('format') || 'ascii';
    if (format !== 'ascii') {
      console.warn('Binary VTU format not supported for manual parsing');
      return null;
    }
    
    const textContent = pointsDataArray.textContent || pointsDataArray.innerHTML;
    const values = textContent.trim().split(/\s+/).map(Number).filter(v => !isNaN(v));
    
    if (values.length % 3 !== 0) {
      console.warn('Invalid point data - not divisible by 3');
      return null;
    }
    
    const pointsData = new Float32Array(values);
    const numPoints = pointsData.length / 3;
    console.log(`📊 Extracted ${numPoints} points from VTU file`);
    
    // Create VTK PolyData
    const points = vtkPoints.newInstance();
    points.setData(pointsData, 3);
    
    const polyData = vtkPolyData.newInstance();
    polyData.setPoints(points);
    
    // Create vertex cells for point rendering
    const vertsArray = new Uint32Array(numPoints * 2);
    for (let i = 0; i < numPoints; i++) {
      vertsArray[i * 2] = 1; // number of points in cell
      vertsArray[i * 2 + 1] = i; // point index
    }
    polyData.getVerts().setData(vertsArray);
    
    // Try to extract data arrays for visualization
    try {
      await extractVTUDataArrays(xmlDoc, polyData, numPoints);
    } catch (dataError) {
      console.warn('Could not extract data arrays from VTU:', dataError.message);
    }
    
    console.log(`✅ Successfully converted VTU to PolyData: ${numPoints} points`);
    return polyData;
    
  } catch (e) {
    console.error('simpleFallbackVTUParsing error:', e);
    return null;
  }
}

// Helper: Extract data arrays from VTU XML
async function extractVTUDataArrays(xmlDoc, polyData, numPoints) {
  // Try to find PointData section
  const pointDataElements = xmlDoc.getElementsByTagName('PointData');
  if (pointDataElements.length === 0) {
    return; // No point data arrays
  }
  
  const pointDataElement = pointDataElements[0];
  const dataArrays = pointDataElement.getElementsByTagName('DataArray');
  
  for (let i = 0; i < dataArrays.length; i++) {
    const dataArray = dataArrays[i];
    const name = dataArray.getAttribute('Name');
    const format = dataArray.getAttribute('format') || 'ascii';
    const type = dataArray.getAttribute('type') || 'Float32';
    const numberOfComponents = parseInt(dataArray.getAttribute('NumberOfComponents') || '1');
    
    if (format === 'ascii' && name) {
      try {
        const textContent = dataArray.textContent || dataArray.innerHTML;
        const values = textContent.trim().split(/\s+/).map(Number).filter(v => !isNaN(v));
        
        if (values.length === numPoints * numberOfComponents) {
          // Import DataArray class
          const { default: vtkDataArray } = await import('@kitware/vtk.js/Common/Core/DataArray');
          
          const vtk_array = vtkDataArray.newInstance({
            name: name,
            values: new Float32Array(values),
            numberOfComponents: numberOfComponents
          });
          
          polyData.getPointData().addArray(vtk_array);
          console.log(`📊 Added data array: ${name} (${values.length} values)`);
        }
      } catch (arrayError) {
        console.warn(`Could not process data array ${name}:`, arrayError.message);
      }
    }
  }
}

// Helper: Convert legacy ASCII VTK UNSTRUCTURED_GRID to VTU XML format
function convertLegacyVtkToVtu(vtkText) {
  try {
    console.log('🔄 Converting legacy VTK to VTU format...');
    
    const lines = vtkText.split(/\r?\n/);
    
    // Parse header
    let numPoints = 0, numCells = 0;
    let points = [], cells = [], cellTypes = [], cellOffsets = [];
    let pointData = new Map(), cellData = new Map();
    
    let currentSection = '';
    let currentArray = '';
    let currentArraySize = 0;
    let currentArrayData = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parse dataset info
      if (line.startsWith('POINTS')) {
        const parts = line.split(/\s+/);
        numPoints = parseInt(parts[1]);
        currentSection = 'POINTS';
        continue;
      } else if (line.startsWith('CELLS')) {
        const parts = line.split(/\s+/);
        numCells = parseInt(parts[1]);
        currentSection = 'CELLS';
        continue;
      } else if (line.startsWith('CELL_TYPES')) {
        currentSection = 'CELL_TYPES';
        continue;
      } else if (line.startsWith('POINT_DATA')) {
        currentSection = 'POINT_DATA';
        continue;
      } else if (line.startsWith('CELL_DATA')) {
        currentSection = 'CELL_DATA';
        continue;
      } else if (line.startsWith('SCALARS') || line.startsWith('VECTORS')) {
        const parts = line.split(/\s+/);
        currentArray = parts[1];
        currentArraySize = currentSection === 'POINT_DATA' ? numPoints : numCells;
        currentArrayData = [];
        continue;
      } else if (line.startsWith('LOOKUP_TABLE')) {
        continue; // Skip lookup table declarations
      }
      
      // Parse data based on current section
      if (currentSection === 'POINTS') {
        const coords = line.split(/\s+/).map(Number).filter(n => !isNaN(n));
        points.push(...coords);
      } else if (currentSection === 'CELLS') {
        const cellData = line.split(/\s+/).map(Number).filter(n => !isNaN(n));
        
        // Parse cell connectivity
        let idx = 0;
        while (idx < cellData.length) {
          const numPointsInCell = cellData[idx];
          const cellPoints = cellData.slice(idx + 1, idx + 1 + numPointsInCell);
          cells.push(...cellPoints);
          cellOffsets.push(cells.length); // VTU format uses absolute offsets
          idx += numPointsInCell + 1;
        }
      } else if (currentSection === 'CELL_TYPES') {
        const types = line.split(/\s+/).map(Number).filter(n => !isNaN(n));
        cellTypes.push(...types);
      } else if (currentSection === 'POINT_DATA' && currentArray) {
        const values = line.split(/\s+/).map(Number).filter(n => !isNaN(n));
        currentArrayData.push(...values);
        
        if (currentArrayData.length >= currentArraySize) {
          pointData.set(currentArray, currentArrayData.slice(0, currentArraySize));
          currentArray = '';
          currentArrayData = [];
        }
      } else if (currentSection === 'CELL_DATA' && currentArray) {
        const values = line.split(/\s+/).map(Number).filter(n => !isNaN(n));
        currentArrayData.push(...values);
        
        if (currentArrayData.length >= currentArraySize) {
          cellData.set(currentArray, currentArrayData.slice(0, currentArraySize));
          currentArray = '';
          currentArrayData = [];
        }
      }
    }
    
    // Generate VTU XML
    let vtu = `<?xml version="1.0"?>
<VTKFile type="UnstructuredGrid" version="1.0" byte_order="LittleEndian">
  <UnstructuredGrid>
    <Piece NumberOfPoints="${numPoints}" NumberOfCells="${numCells}">
      <Points>
        <DataArray type="Float32" NumberOfComponents="3" format="ascii">
          ${points.join(' ')}
        </DataArray>
      </Points>
      <Cells>
        <DataArray type="Int32" Name="connectivity" format="ascii">
          ${cells.join(' ')}
        </DataArray>
        <DataArray type="Int32" Name="offsets" format="ascii">
          ${cellOffsets.join(' ')}
        </DataArray>
        <DataArray type="UInt8" Name="types" format="ascii">
          ${cellTypes.join(' ')}
        </DataArray>
      </Cells>`;
    
    // Add point data
    if (pointData.size > 0) {
      vtu += '\n      <PointData>';
      for (const [name, data] of pointData) {
        vtu += `
        <DataArray type="Float32" Name="${name}" format="ascii">
          ${data.join(' ')}
        </DataArray>`;
      }
      vtu += '\n      </PointData>';
    }
    
    // Add cell data
    if (cellData.size > 0) {
      vtu += '\n      <CellData>';
      for (const [name, data] of cellData) {
        vtu += `
        <DataArray type="Float32" Name="${name}" format="ascii">
          ${data.join(' ')}
        </DataArray>`;
      }
      vtu += '\n      </CellData>';
    }
    
    vtu += `
    </Piece>
  </UnstructuredGrid>
</VTKFile>`;
    
    console.log(`✅ Converted legacy VTK: ${numPoints} points, ${numCells} cells`);
    return vtu;
    
  } catch (error) {
    console.error('❌ Legacy VTK conversion failed:', error);
    return null;
  }
} 