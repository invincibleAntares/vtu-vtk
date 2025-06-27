/**
 * Main application for VTU Multi-Array Viewer
 */
class VTUViewer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.mesh = null;
        this.parser = new VTUParser();
        this.colorMap = new ColorMap();
        this.currentData = null;
        this.currentArray = null;
        this.currentColormap = 'viridis';
        
        this.init();
        this.setupEventListeners();
    }

    init() {
        // Initialize Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);

        // Initialize camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(5, 5, 5);

        // Initialize renderer
        const canvas = document.getElementById('renderer');
        this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Initialize controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Add lights
        this.setupLighting();

        // Start render loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);

        // Directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // Additional lights for better visualization
        const light1 = new THREE.DirectionalLight(0xffffff, 0.3);
        light1.position.set(-10, -10, -5);
        this.scene.add(light1);

        const light2 = new THREE.DirectionalLight(0xffffff, 0.2);
        light2.position.set(5, -10, 10);
        this.scene.add(light2);
    }

    setupEventListeners() {
        // File input
        const fileInput = document.getElementById('fileInput');
        fileInput.addEventListener('change', (e) => this.handleFileLoad(e));

        // Array selection
        const arraySelect = document.getElementById('arraySelect');
        arraySelect.addEventListener('change', (e) => this.handleArrayChange(e));

        // Colormap selection
        const colormapSelect = document.getElementById('colormap');
        colormapSelect.addEventListener('change', (e) => this.handleColormapChange(e));
    }

    async handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.showLoading(true);

        try {
            this.currentData = await this.parser.parseFile(file);
            this.populateArrayDropdown();
            this.createMesh();
            this.fitCameraToObject();
            console.log('VTU file loaded successfully:', this.currentData);
        } catch (error) {
            console.error('Error loading VTU file:', error);
            alert('Error loading VTU file: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    populateArrayDropdown() {
        const arraySelect = document.getElementById('arraySelect');
        arraySelect.innerHTML = '<option value="">Select an array</option>';

        if (!this.currentData) return;

        const allArrays = this.parser.getAllArrays();
        
        if (allArrays.size === 0) {
            arraySelect.innerHTML = '<option value="">No arrays found</option>';
            arraySelect.disabled = true;
            return;
        }

        for (const [name, arrayData] of allArrays) {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = `${name} (${arrayData.dataType}, ${arrayData.components} comp.)`;
            arraySelect.appendChild(option);
        }

        arraySelect.disabled = false;

        // Auto-select first array
        if (allArrays.size > 0) {
            const firstName = allArrays.keys().next().value;
            arraySelect.value = firstName;
            this.handleArrayChange({ target: { value: firstName } });
        }
    }

    createMesh() {
        if (!this.currentData) return;

        // Remove existing mesh
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }

        // Create geometry
        const geometry = new THREE.BufferGeometry();
        
        // Set positions
        const positions = new Float32Array(this.currentData.points);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        // Set indices for triangles
        const indices = new Uint32Array(this.currentData.cells);
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));

        // Compute normals
        geometry.computeVertexNormals();

        // Create material
        const material = new THREE.MeshLambertMaterial({
            vertexColors: true,
            side: THREE.DoubleSide
        });

        // Create mesh
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);

        // Set default colors (white)
        this.setDefaultColors();
    }

    setDefaultColors() {
        if (!this.mesh) return;

        const geometry = this.mesh.geometry;
        const positionAttribute = geometry.getAttribute('position');
        const vertexCount = positionAttribute.count;

        const colors = new Float32Array(vertexCount * 3);
        for (let i = 0; i < colors.length; i += 3) {
            colors[i] = 0.8;     // R
            colors[i + 1] = 0.8; // G
            colors[i + 2] = 0.8; // B
        }

        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    handleArrayChange(event) {
        const arrayName = event.target.value;
        if (!arrayName || !this.currentData) {
            this.hideLegend();
            return;
        }

        this.currentArray = arrayName;
        this.applyArrayColoring();
        this.updateLegend();
    }

    handleColormapChange(event) {
        this.currentColormap = event.target.value;
        if (this.currentArray) {
            this.applyArrayColoring();
            this.updateLegend();
        }
    }

    applyArrayColoring() {
        if (!this.mesh || !this.currentArray || !this.currentData) return;

        const allArrays = this.parser.getAllArrays();
        const arrayData = allArrays.get(this.currentArray);
        
        if (!arrayData) return;

        // Prepare values for color mapping
        const scalarValues = this.colorMap.prepareValuesForMapping(
            arrayData.data, 
            arrayData.components
        );

        let vertexColors;

        if (arrayData.dataType === 'point') {
            // Point data - directly map to vertices
            const colorMapping = this.colorMap.mapValues(scalarValues, this.currentColormap);
            vertexColors = new Float32Array(colorMapping.colors);
        } else {
            // Cell data - need to interpolate to vertices
            vertexColors = this.interpolateCellDataToVertices(scalarValues);
        }

        // Apply colors to geometry
        const geometry = this.mesh.geometry;
        geometry.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3));
        geometry.attributes.color.needsUpdate = true;
    }

    interpolateCellDataToVertices(cellValues) {
        if (!this.currentData) return new Float32Array(0);

        const vertexCount = this.currentData.points.length / 3;
        const vertexValues = new Array(vertexCount).fill(0);
        const vertexCounts = new Array(vertexCount).fill(0);

        // Accumulate cell values for each vertex
        for (let i = 0; i < this.currentData.cells.length; i += 3) {
            const cellIndex = Math.floor(i / 3);
            const cellValue = cellValues[cellIndex] || 0;

            for (let j = 0; j < 3; j++) {
                const vertexIndex = this.currentData.cells[i + j];
                if (vertexIndex < vertexCount) {
                    vertexValues[vertexIndex] += cellValue;
                    vertexCounts[vertexIndex]++;
                }
            }
        }

        // Average the values
        for (let i = 0; i < vertexCount; i++) {
            if (vertexCounts[i] > 0) {
                vertexValues[i] /= vertexCounts[i];
            }
        }

        // Map to colors
        const colorMapping = this.colorMap.mapValues(vertexValues, this.currentColormap);
        return new Float32Array(colorMapping.colors);
    }

    updateLegend() {
        if (!this.currentArray || !this.currentData) {
            this.hideLegend();
            return;
        }

        const allArrays = this.parser.getAllArrays();
        const arrayData = allArrays.get(this.currentArray);
        
        if (!arrayData) {
            this.hideLegend();
            return;
        }

        // Prepare values for legend
        const scalarValues = this.colorMap.prepareValuesForMapping(
            arrayData.data, 
            arrayData.components
        );

        const min = Math.min(...scalarValues);
        const max = Math.max(...scalarValues);
        const mid = (min + max) / 2;

        // Update legend canvas
        const legendCanvas = document.getElementById('legendCanvas');
        this.colorMap.generateLegend(legendCanvas, this.currentColormap, min, max);

        // Update legend labels
        document.getElementById('maxValue').textContent = max.toFixed(3);
        document.getElementById('midValue').textContent = mid.toFixed(3);
        document.getElementById('minValue').textContent = min.toFixed(3);

        // Update legend info
        document.getElementById('currentArray').textContent = this.currentArray;
        document.getElementById('arrayType').textContent = arrayData.dataType;
        document.getElementById('arrayComponents').textContent = arrayData.components;

        this.showLegend();
    }

    showLegend() {
        document.getElementById('legend').classList.remove('hidden');
    }

    hideLegend() {
        document.getElementById('legend').classList.add('hidden');
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    fitCameraToObject() {
        if (!this.mesh) return;

        const box = new THREE.Box3().setFromObject(this.mesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

        cameraZ *= 2; // Zoom out a bit

        this.camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
        this.camera.lookAt(center);
        this.controls.target.copy(center);
        this.controls.update();
    }

    onWindowResize() {
        const container = document.getElementById('viewport');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new VTUViewer();
});
