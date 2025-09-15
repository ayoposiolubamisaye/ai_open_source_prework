// Game client for Mini MMORPG
class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = new Image();
        this.worldSize = 2048; // World map is 2048x2048
        
        // Game state
        this.players = {};
        this.avatars = {};
        this.myPlayerId = null;
        this.myPosition = { x: 0, y: 0 };
        this.viewport = { x: 0, y: 0 };
        
        // WebSocket connection
        this.socket = null;
        
        // Keyboard state
        this.keysPressed = new Set();
        
        this.setupCanvas();
        this.setupKeyboard();
        this.loadWorldMap();
        this.connectToServer();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.updateViewport();
            this.draw();
        });
    }
    
    setupKeyboard() {
        // Add keyboard event listeners
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });
        
        // Clear keys when window loses focus
        window.addEventListener('blur', () => {
            this.keysPressed.clear();
            this.sendStopCommand();
        });
    }
    
    handleKeyDown(event) {
        // Prevent default browser behavior for arrow keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
            event.preventDefault();
        }
        
        // Only process if key wasn't already pressed
        if (this.keysPressed.has(event.code)) {
            return;
        }
        
        this.keysPressed.add(event.code);
        
        // Map arrow keys to movement directions
        const keyMap = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right'
        };
        
        const direction = keyMap[event.code];
        if (direction) {
            this.sendMoveCommand(direction);
        }
    }
    
    handleKeyUp(event) {
        this.keysPressed.delete(event.code);
        
        // If no keys are pressed, send stop command
        if (this.keysPressed.size === 0) {
            this.sendStopCommand();
        }
    }
    
    sendMoveCommand(direction) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const moveMessage = {
            action: 'move',
            direction: direction
        };
        
        this.socket.send(JSON.stringify(moveMessage));
    }
    
    sendStopCommand() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const stopMessage = {
            action: 'stop'
        };
        
        this.socket.send(JSON.stringify(stopMessage));
    }
    
    loadWorldMap() {
        this.worldImage.onload = () => {
            this.draw();
        };
        
        this.worldImage.onerror = () => {
            console.error('Failed to load world map image');
            this.drawPlaceholder();
        };
        
        // Load the world map image
        this.worldImage.src = 'world.jpg';
    }
    
    connectToServer() {
        try {
            this.socket = new WebSocket('wss://codepath-mmorg.onrender.com');
            
            this.socket.onopen = () => {
                console.log('Connected to game server');
                this.joinGame();
            };
            
            this.socket.onmessage = (event) => {
                this.handleServerMessage(JSON.parse(event.data));
            };
            
            this.socket.onclose = () => {
                console.log('Disconnected from game server');
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to connect to server:', error);
        }
    }
    
    joinGame() {
        const joinMessage = {
            action: 'join_game',
            username: 'Ayo'
        };
        
        this.socket.send(JSON.stringify(joinMessage));
    }
    
    handleServerMessage(message) {
        console.log('Received message:', message);
        
        switch (message.action) {
            case 'join_game':
                if (message.success) {
                    this.myPlayerId = message.playerId;
                    this.players = message.players;
                    this.avatars = message.avatars;
                    
                    // Set my position and update viewport
                    if (this.players[this.myPlayerId]) {
                        this.myPosition = {
                            x: this.players[this.myPlayerId].x,
                            y: this.players[this.myPlayerId].y
                        };
                        this.updateViewport();
                    }
                    
                    this.draw();
                } else {
                    console.error('Failed to join game:', message.error);
                }
                break;
                
            case 'player_joined':
                this.players[message.player.playerId] = message.player;
                this.avatars[message.avatar.name] = message.avatar;
                this.draw();
                break;
                
            case 'players_moved':
                Object.assign(this.players, message.players);
                this.draw();
                break;
                
            case 'player_left':
                delete this.players[message.playerId];
                this.draw();
                break;
                
            default:
                console.log('Unknown message type:', message.action);
        }
    }
    
    updateViewport() {
        if (!this.myPlayerId || !this.players[this.myPlayerId]) return;
        
        const player = this.players[this.myPlayerId];
        this.myPosition = { x: player.x, y: player.y };
        
        // Center the player in the viewport
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Calculate viewport offset
        this.viewport.x = player.x - centerX;
        this.viewport.y = player.y - centerY;
        
        // Clamp viewport to world bounds
        this.viewport.x = Math.max(0, Math.min(this.viewport.x, this.worldSize - this.canvas.width));
        this.viewport.y = Math.max(0, Math.min(this.viewport.y, this.worldSize - this.canvas.height));
    }
    
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw world map
        this.drawWorld();
        
        // Draw all players
        this.drawPlayers();
        
        // Draw player list tab
        this.drawPlayerList();
    }
    
    drawWorld() {
        if (this.worldImage.complete && this.worldImage.naturalWidth > 0) {
            // Draw the world map from the viewport offset
            this.ctx.drawImage(
                this.worldImage,
                this.viewport.x, this.viewport.y, // Source position (viewport offset)
                this.canvas.width, this.canvas.height, // Source size (visible portion)
                0, 0, // Destination position (upper left of canvas)
                this.canvas.width, this.canvas.height // Destination size (full canvas)
            );
        } else {
            this.drawPlaceholder();
        }
    }
    
    drawPlayers() {
        Object.values(this.players).forEach(player => {
            this.drawPlayer(player);
        });
    }
    
    drawPlayer(player) {
        if (!this.avatars[player.avatar]) {
            console.log('No avatar found for player:', player.username, 'avatar:', player.avatar);
            return;
        }
        
        const avatar = this.avatars[player.avatar];
        const avatarSize = 32; // Avatar size in pixels
        
        // Convert world coordinates to screen coordinates
        const screenX = player.x - this.viewport.x;
        const screenY = player.y - this.viewport.y;
        
        console.log('Player screen position:', screenX, screenY, 'viewport:', this.viewport);
        
        // Check if player is visible on screen
        if (screenX < -avatarSize || screenX > this.canvas.width + avatarSize ||
            screenY < -avatarSize || screenY > this.canvas.height + avatarSize) {
            console.log('Player not visible on screen');
            return;
        }
        
        // Get the appropriate frame based on facing direction and animation
        const direction = player.facing;
        const frameIndex = player.animationFrame || 0;
        
        console.log('Avatar direction:', direction, 'frame:', frameIndex);
        console.log('Avatar frames available:', Object.keys(avatar.frames));
        
        if (avatar.frames[direction] && avatar.frames[direction][frameIndex]) {
            const frameData = avatar.frames[direction][frameIndex];
            console.log('Frame data length:', frameData.length);
            
            const img = new Image();
            
            img.onload = () => {
                console.log('Avatar image loaded successfully');
                // Calculate position to center the avatar
                const drawX = screenX - avatarSize / 2;
                const drawY = screenY - avatarSize;
                
                // Draw glow effect for my player
                if (player.id === this.myPlayerId) {
                    this.ctx.save();
                    this.ctx.shadowColor = '#00ff00';
                    this.ctx.shadowBlur = 10;
                    this.ctx.drawImage(img, drawX, drawY, avatarSize, avatarSize);
                    this.ctx.restore();
                } else {
                    this.ctx.drawImage(img, drawX, drawY, avatarSize, avatarSize);
                }
                
                // Draw username label
                this.ctx.fillStyle = 'white';
                this.ctx.strokeStyle = 'black';
                this.ctx.lineWidth = 2;
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                
                const labelY = drawY - 5;
                this.ctx.strokeText(player.username, screenX, labelY);
                this.ctx.fillText(player.username, screenX, labelY);
            };
            
            img.onerror = (error) => {
                console.error('Failed to load avatar image:', error);
            };
            
            img.src = frameData;
        } else {
            console.log('No frame data available for direction:', direction, 'frame:', frameIndex);
        }
    }
    
    drawPlayerList() {
        const sidebarWidth = 250;
        const startX = this.canvas.width - sidebarWidth;
        
        // Draw sidebar background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(startX, 0, sidebarWidth, this.canvas.height);
        
        // Draw border
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(startX, 0, sidebarWidth, this.canvas.height);
        
        // Draw title
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 18px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Players Online', startX + sidebarWidth/2, 30);
        
        // Draw player count
        this.ctx.fillStyle = '#ccc';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(`${Object.keys(this.players).length} players`, startX + sidebarWidth/2, 50);
        
        // Draw player list
        const players = Object.values(this.players);
        let yOffset = 80;
        
        players.forEach((player, index) => {
            const isMe = player.id === this.myPlayerId;
            const isMoving = player.isMoving;
            
            // Player background
            if (isMe) {
                this.ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
                this.ctx.fillRect(startX + 5, yOffset - 20, sidebarWidth - 10, 40);
            }
            
            // Player name
            this.ctx.fillStyle = isMe ? '#00ff00' : 'white';
            this.ctx.font = isMe ? 'bold 14px Arial' : '14px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(player.username, startX + 15, yOffset);
            
            // Status indicator
            this.ctx.fillStyle = isMoving ? '#ffff00' : '#888';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(isMoving ? 'Moving' : 'Idle', startX + 15, yOffset + 15);
            
            // Position coordinates
            this.ctx.fillStyle = '#aaa';
            this.ctx.font = '11px Arial';
            this.ctx.fillText(`Position: (${Math.round(player.x)}, ${Math.round(player.y)})`, startX + 15, yOffset + 28);
            
            // Facing direction
            this.ctx.fillStyle = '#999';
            this.ctx.fillText(`Facing: ${player.facing}`, startX + 15, yOffset + 40);
            
            yOffset += 55;
            
            // Add separator line
            if (index < players.length - 1) {
                this.ctx.strokeStyle = '#333';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(startX + 10, yOffset - 5);
                this.ctx.lineTo(startX + sidebarWidth - 10, yOffset - 5);
                this.ctx.stroke();
            }
        });
        
        // Draw connection status at bottom
        this.ctx.fillStyle = this.socket && this.socket.readyState === WebSocket.OPEN ? '#00ff00' : '#ff0000';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            this.socket && this.socket.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected',
            startX + sidebarWidth/2,
            this.canvas.height - 20
        );
    }
    
    drawPlaceholder() {
        // Draw a simple placeholder if world map doesn't load
        this.ctx.fillStyle = '#2a2a2a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#666';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Loading world map...', this.canvas.width / 2, this.canvas.height / 2);
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
