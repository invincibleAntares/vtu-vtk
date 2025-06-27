#!/usr/bin/env python3
"""
Simple Test Server for ParaViewWeb Dashboard
Simulates ParaView responses without requiring full ParaView installation
"""

import asyncio
import websockets
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MockParaViewServer:
    """Mock server that simulates ParaViewWeb responses"""
    
    def __init__(self):
        self.connected_clients = set()
        
    async def handle_client(self, websocket, path):
        """Handle client connections"""
        self.connected_clients.add(websocket)
        logger.info(f"🔌 Client connected. Total clients: {len(self.connected_clients)}")
        
        try:
            async for message in websocket:
                response = await self.process_message(message)
                await websocket.send(response)
                
        except websockets.exceptions.ConnectionClosed:
            logger.info("Client disconnected")
        finally:
            self.connected_clients.discard(websocket)
    
    async def process_message(self, message):
        """Process incoming messages and return mock responses"""
        try:
            data = json.loads(message)
            method = data.get('method', '')
            
            logger.info(f"📨 Received: {method}")
            
            # Mock responses for different methods
            if method == 'vtk.initialize':
                return json.dumps({
                    'id': data.get('id'),
                    'result': {
                        'status': 'success',
                        'message': 'Mock ParaView initialized',
                        'data_arrays': ['Temperature', 'Pressure', 'Velocity'],
                        'bounds': [-100, 100, -50, 50, -75, 75],
                        'points': 1234567,
                        'cells': 987654
                    }
                })
            
            elif method == 'vtk.apply_color_map':
                return json.dumps({
                    'id': data.get('id'),
                    'result': {
                        'status': 'success',
                        'message': f'Applied color map to {data.get("params", {}).get("array_name", "unknown")}'
                    }
                })
            
            elif method == 'vtk.generate_contours':
                return json.dumps({
                    'id': data.get('id'),
                    'result': {
                        'status': 'success',
                        'message': 'Generated 5 contours',
                        'contour_values': [10, 20, 30, 40, 50]
                    }
                })
            
            else:
                return json.dumps({
                    'id': data.get('id'),
                    'result': {
                        'status': 'success',
                        'message': f'Mock response for {method}'
                    }
                })
                
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return json.dumps({
                'id': data.get('id', 0),
                'error': {'message': str(e)}
            })

async def start_server():
    """Start the mock ParaViewWeb server"""
    server = MockParaViewServer()
    
    print("🚀 Mock ParaViewWeb Server Starting...")
    print("📍 Server: ws://localhost:1234")
    print("🎯 Purpose: Test dashboard connection without full ParaView")
    print("=" * 60)
    
    # Start WebSocket server
    start_server = websockets.serve(
        server.handle_client,
        "localhost", 
        1234
    )
    
    logger.info("✅ Mock server running on ws://localhost:1234")
    logger.info("🔗 Your React dashboard can now connect to this server")
    
    await start_server

if __name__ == "__main__":
    try:
        asyncio.run(start_server())
    except KeyboardInterrupt:
        print("\n👋 Mock server stopped") 