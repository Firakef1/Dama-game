import os
import json
import logging
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("dama_backend")

app = FastAPI(title="Dama Game Multiplayer Backend")

# Enable CORS for cross-origin frontend connections (Render, localhost, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def create_initial_grid() -> List[int]:
    """Generates standard 8x8 Dama board layout (64 cells)"""
    grid = [0] * 64
    for index in range(64):
        row = index // 8
        col = index % 8
        is_dark = (row + col) % 2 == 1
        if is_dark:
            if row < 3:
                grid[index] = 1  # Player 1 (Red)
            elif row >= 5:
                grid[index] = 2  # Player 2 (Ivory)
    return grid

def create_initial_game_state() -> Dict[str, Any]:
    return {
        "grid": create_initial_grid(),
        "turn": 1,
        "selectedSquare": None,
        "validMoves": [],
        "capturedP1": 0,
        "capturedP2": 0,
        "winner": None,
        "showHints": True,
    }

class ConnectionManager:
    def __init__(self):
        # room_id -> { "players": [{ "client_id": str, "websocket": WebSocket, "role": 1 | 2 }], "spectators": [...], "game_state": dict }
        self.rooms: Dict[str, Dict[str, Any]] = {}

    def get_or_create_room(self, room_id: str) -> Dict[str, Any]:
        if room_id not in self.rooms:
            self.rooms[room_id] = {
                "players": [],
                "spectators": [],
                "game_state": create_initial_game_state()
            }
            logger.info(f"Created new room: {room_id}")
        return self.rooms[room_id]

    async def connect(self, websocket: WebSocket, room_id: str, client_id: str):
        await websocket.accept()
        room = self.get_or_create_room(room_id)

        # Determine role (Player 1, Player 2, or Spectator)
        assigned_role: Any = None
        existing_roles = [p["role"] for p in room["players"]]

        if 1 not in existing_roles:
            assigned_role = 1
            room["players"].append({"client_id": client_id, "websocket": websocket, "role": 1})
        elif 2 not in existing_roles:
            assigned_role = 2
            room["players"].append({"client_id": client_id, "websocket": websocket, "role": 2})
        else:
            assigned_role = "spectator"
            room["spectators"].append({"client_id": client_id, "websocket": websocket, "role": "spectator"})

        # Send initial room & state setup to the joining client
        init_payload = {
            "type": "INIT_ROOM",
            "room_id": room_id,
            "client_id": client_id,
            "role": assigned_role,
            "game_state": room["game_state"],
            "player_count": len(room["players"]),
            "status": "playing" if len(room["players"]) == 2 else "waiting"
        }
        await websocket.send_text(json.dumps(init_payload))

        # Broadcast updated room status to all clients in room
        await self.broadcast_room_status(room_id)
        logger.info(f"Client {client_id} joined room {room_id} as role {assigned_role}")

    def disconnect(self, websocket: WebSocket, room_id: str, client_id: str):
        if room_id not in self.rooms:
            return
        
        room = self.rooms[room_id]
        room["players"] = [p for p in room["players"] if p["websocket"] != websocket]
        room["spectators"] = [s for s in room["spectators"] if s["websocket"] != websocket]

        logger.info(f"Client {client_id} disconnected from room {room_id}")

        # If room is completely empty, clean it up
        if not room["players"] and not room["spectators"]:
            del self.rooms[room_id]
            logger.info(f"Cleaned up empty room: {room_id}")

    async def broadcast_to_room(self, room_id: str, message: Dict[str, Any], exclude: Optional[WebSocket] = None):
        if room_id not in self.rooms:
            return
        
        room = self.rooms[room_id]
        all_connections = room["players"] + room["spectators"]
        payload = json.dumps(message)

        for conn in all_connections:
            ws = conn["websocket"]
            if ws != exclude:
                try:
                    await ws.send_text(payload)
                except Exception as e:
                    logger.error(f"Error sending message to client {conn['client_id']}: {e}")

    async def broadcast_room_status(self, room_id: str):
        if room_id not in self.rooms:
            return
        room = self.rooms[room_id]
        payload = {
            "type": "ROOM_STATUS",
            "player_count": len(room["players"]),
            "status": "playing" if len(room["players"]) >= 2 else "waiting",
            "has_p1": any(p["role"] == 1 for p in room["players"]),
            "has_p2": any(p["role"] == 2 for p in room["players"]),
            "game_state": room["game_state"]
        }
        await self.broadcast_to_room(room_id, payload)

manager = ConnectionManager()

@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": "Dama Game Backend",
        "active_rooms": len(manager.rooms)
    }

@app.websocket("/ws/{room_id}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, client_id: str):
    await manager.connect(websocket, room_id, client_id)
    try:
        while True:
            data_str = await websocket.receive_text()
            try:
                data = json.loads(data_str)
                msg_type = data.get("type")

                if msg_type == "PING":
                    await websocket.send_text(json.dumps({"type": "PONG"}))
                    continue

                room = manager.rooms.get(room_id)
                if not room:
                    continue

                if msg_type == "UPDATE_GAME_STATE":
                    # Update server canonical state and broadcast to all other players/spectators
                    new_state = data.get("game_state")
                    if new_state:
                        room["game_state"] = new_state
                        await manager.broadcast_to_room(
                            room_id,
                            {
                                "type": "GAME_STATE_UPDATED",
                                "game_state": new_state,
                                "sender_id": client_id
                            },
                            exclude=None  # Broadcast to all so everyone stays synced
                        )

                elif msg_type == "RESET_GAME":
                    room["game_state"] = create_initial_game_state()
                    await manager.broadcast_to_room(
                        room_id,
                        {
                            "type": "GAME_STATE_UPDATED",
                            "game_state": room["game_state"],
                            "sender_id": client_id
                        }
                    )

                elif msg_type == "FORFEIT_GAME":
                    forfeiting_role = data.get("forfeiting_role")
                    if forfeiting_role in (1, 2):
                        room["game_state"]["winner"] = 2 if forfeiting_role == 1 else 1
                        room["game_state"]["selectedSquare"] = None
                        room["game_state"]["validMoves"] = []
                        await manager.broadcast_to_room(
                            room_id,
                            {
                                "type": "GAME_STATE_UPDATED",
                                "game_state": room["game_state"],
                                "sender_id": client_id
                            }
                        )

            except json.JSONDecodeError:
                logger.warning(f"Received non-JSON message from {client_id}")

    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id, client_id)
        await manager.broadcast_room_status(room_id)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)