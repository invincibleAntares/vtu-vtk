#!/usr/bin/env python3
"""
ParaViewWeb Server for Advanced 3D Visualization
This script provides server-side ParaView processing for the React dashboard
"""

import os
import sys
import argparse
import logging
from pathlib import Path

try:
    # ParaView and ParaViewWeb imports
    import paraview
    from paraview import simple
    from paraview.web import venv
    from paraview.web import protocols as pv_protocols
    from paraview.web import wslink as pv_wslink
    
    # Web framework imports
    from wslink import server
    from wslink.websocket import LinkProtocol
    
except ImportError as e:
    print(f"❌ Error: Missing required packages: {e}")
    print("Please install ParaView with Python support and wslink:")
    print("pip install paraview wslink")
    sys.exit(1)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VtkVisualizationProtocol(LinkProtocol):
    """
    Custom ParaViewWeb protocol for VTK visualization
    Handles data loading, color mapping, contours, and advanced rendering
    """
    
    def __init__(self):
        super().__init__()
        self.view = None
        self.reader = None
        self.current_representation = None
        self.contour_filter = None
        self.volume_representation = None
        self.data_arrays = []
        self.color_map = None
        
    @pv_wslink.register("vtk.initialize")
    def initialize_visualization(self):
        """Initialize ParaView rendering pipeline"""
        try:
            logger.info("🚀 Initializing ParaView visualization pipeline")
            
            # Create render view
            self.view = simple.CreateView('RenderView')
            self.view.ViewSize = [1200, 800]
            self.view.Background = [0.1, 0.1, 0.1]  # Dark background
            
            # Load the VTK file
            vtk_file_path = os.path.join('public', 'Topology.vtk')
            if not os.path.exists(vtk_file_path):
                logger.warning(f"VTK file not found: {vtk_file_path}")
                vtk_file_path = 'Topology.vtk'
            
            if os.path.exists(vtk_file_path):
                logger.info(f"📁 Loading VTK file: {vtk_file_path}")
                self.reader = simple.LegacyVTKReader(FileNames=[vtk_file_path])
                
                # Create initial representation
                self.current_representation = simple.Show(self.reader, self.view)
                self.current_representation.Representation = 'Surface'
                self.current_representation.DiffuseColor = [1.0, 0.0, 0.0]  # Red
                
                # Get data information
                data_info = self.reader.GetDataInformation()
                point_data = data_info.GetPointDataInformation()
                
                # Extract available arrays
                self.data_arrays = []
                for i in range(point_data.GetNumberOfArrays()):
                    array_info = point_data.GetArrayInformation(i)
                    array_name = array_info.GetName()
                    array_range = array_info.GetComponentRange(0)
                    self.data_arrays.append({
                        'name': array_name,
                        'range': array_range,
                        'components': array_info.GetNumberOfComponents()
                    })
                    logger.info(f"📊 Found data array: {array_name} (range: {array_range})")
                
                # Reset camera and render
                self.view.ResetCamera()
                simple.Render(self.view)
                
                return {
                    'status': 'success',
                    'message': 'ParaView initialized successfully',
                    'data_arrays': self.data_arrays,
                    'bounds': list(data_info.GetBounds()),
                    'points': data_info.GetNumberOfPoints(),
                    'cells': data_info.GetNumberOfCells()
                }
            else:
                logger.error(f"❌ VTK file not found: {vtk_file_path}")
                return {
                    'status': 'error',
                    'message': f'VTK file not found: {vtk_file_path}'
                }
                
        except Exception as e:
            logger.error(f"❌ Initialization failed: {str(e)}")
            return {
                'status': 'error',
                'message': f'Initialization failed: {str(e)}'
            }
    
    @pv_wslink.register("vtk.apply_color_map")
    def apply_color_map(self, array_name, color_map_name='Cool to Warm'):
        """Apply color mapping to the specified data array"""
        try:
            if not self.current_representation or not array_name:
                return {'status': 'error', 'message': 'No valid representation or array'}
            
            logger.info(f"🌈 Applying color map '{color_map_name}' to array '{array_name}'")
            
            # Set color by array
            simple.ColorBy(self.current_representation, ('POINTS', array_name))
            
            # Get the color transfer function
            color_tf = simple.GetColorTransferFunction(array_name)
            
            # Apply predefined color map
            color_map_presets = {
                'Cool to Warm': 'Cool to Warm',
                'Blue to Red Rainbow': 'Blue to Red Rainbow',
                'Viridis': 'Viridis',
                'Plasma': 'Plasma',
                'Inferno': 'Inferno',
                'Hot': 'Hot',
                'Jet': 'jet',
                'Grayscale': 'Grayscale'
            }
            
            preset_name = color_map_presets.get(color_map_name, 'Cool to Warm')
            color_tf.ApplyPreset(preset_name, True)
            
            # Show color bar
            color_bar = simple.GetScalarBar(color_tf, self.view)
            color_bar.Visibility = 1
            color_bar.Title = array_name
            color_bar.ComponentTitle = ''
            
            # Render
            simple.Render(self.view)
            
            return {
                'status': 'success',
                'message': f'Applied {color_map_name} color map to {array_name}'
            }
            
        except Exception as e:
            logger.error(f"❌ Color mapping failed: {str(e)}")
            return {'status': 'error', 'message': f'Color mapping failed: {str(e)}'}
    
    @pv_wslink.register("vtk.generate_contours")
    def generate_contours(self, array_name, num_contours=5):
        """Generate contour lines/surfaces for the specified array"""
        try:
            if not self.reader or not array_name:
                return {'status': 'error', 'message': 'No valid data or array'}
            
            logger.info(f"📈 Generating {num_contours} contours for array '{array_name}'")
            
            # Create contour filter
            self.contour_filter = simple.Contour(Input=self.reader)
            self.contour_filter.ContourBy = ['POINTS', array_name]
            
            # Get array range
            array_info = None
            for arr in self.data_arrays:
                if arr['name'] == array_name:
                    array_info = arr
                    break
            
            if not array_info:
                return {'status': 'error', 'message': f'Array {array_name} not found'}
            
            # Generate contour values
            min_val, max_val = array_info['range']
            step = (max_val - min_val) / (num_contours + 1)
            contour_values = [min_val + step * (i + 1) for i in range(num_contours)]
            
            self.contour_filter.Isosurfaces = contour_values
            
            # Show contours
            contour_rep = simple.Show(self.contour_filter, self.view)
            contour_rep.Representation = 'Surface'
            contour_rep.DiffuseColor = [0.0, 0.0, 1.0]  # Blue contours
            contour_rep.Opacity = 0.7
            
            # Render
            simple.Render(self.view)
            
            return {
                'status': 'success',
                'message': f'Generated {num_contours} contours',
                'contour_values': contour_values
            }
            
        except Exception as e:
            logger.error(f"❌ Contour generation failed: {str(e)}")
            return {'status': 'error', 'message': f'Contour generation failed: {str(e)}'}
    
    @pv_wslink.register("vtk.export_image")
    def export_image(self, filename='paraview_export.png', width=1920, height=1080):
        """Export high-resolution image"""
        try:
            logger.info(f"💾 Exporting image: {filename} ({width}x{height})")
            
            if not self.view:
                return {'status': 'error', 'message': 'No valid view'}
            
            # Set render view size
            self.view.ViewSize = [width, height]
            
            # Export image
            simple.SaveScreenshot(filename, self.view, ImageResolution=[width, height])
            
            return {
                'status': 'success',
                'message': f'Image exported: {filename}',
                'filename': filename
            }
            
        except Exception as e:
            logger.error(f"❌ Image export failed: {str(e)}")
            return {'status': 'error', 'message': f'Image export failed: {str(e)}'}

def main():
    """Main entry point"""
    print("🚀 ParaViewWeb Server for VTK Visualization")
    print("📍 Server: http://localhost:1234")
    print("🎯 Features: Color mapping, Contours, Volume rendering, Export")
    print("=" * 60)
    print("ℹ️  This is a template server script.")
    print("📝 To run: pip install paraview wslink && python paraview_server.py")

if __name__ == '__main__':
    main()
