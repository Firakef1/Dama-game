import type { AppDispatch } from "../store/store";
import { 
    setConnectionStatus, 
    setInitRoom, 
    updateRoomStatus, 
    syncRemoteGameState 
} from "../features/board/boardSlice";

export function formatWebSocketUrl(serverUrl: string, roomId: string, clientId: string): string {
    let cleanUrl = serverUrl.trim();
    if (!cleanUrl) {
        cleanUrl = "http://localhost:8000";
    }

    // Strip trailing slash
    cleanUrl = cleanUrl.replace(/\/+$/, "");

    let wsProtocol = "ws:";
    let hostAndPath = cleanUrl;

    if (cleanUrl.startsWith("https://")) {
        wsProtocol = "wss:";
        hostAndPath = cleanUrl.substring(8);
    } else if (cleanUrl.startsWith("http://")) {
        wsProtocol = "ws:";
        hostAndPath = cleanUrl.substring(7);
    } else if (cleanUrl.startsWith("wss://")) {
        wsProtocol = "wss:";
        hostAndPath = cleanUrl.substring(6);
    } else if (cleanUrl.startsWith("ws://")) {
        wsProtocol = "ws:";
        hostAndPath = cleanUrl.substring(5);
    } else {
        // Fallback: default to wss if hosting on render domain or ws if ip/localhost
        wsProtocol = cleanUrl.includes("render.com") || cleanUrl.includes("https") ? "wss:" : "ws:";
    }

    return `${wsProtocol}//${hostAndPath}/ws/${encodeURIComponent(roomId)}/${encodeURIComponent(clientId)}`;
}

class WebSocketService {
    private socket: WebSocket | null = null;
    private pingInterval: any = null;

    public connect(serverUrl: string, roomId: string, clientId: string, dispatch: AppDispatch) {
        this.disconnect();

        dispatch(setConnectionStatus("connecting"));
        const wsUrl = formatWebSocketUrl(serverUrl, roomId, clientId);
        console.log("[WebSocket] Connecting to:", wsUrl);

        try {
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log("[WebSocket] Connected successfully");
                dispatch(setConnectionStatus("connected"));

                // Keepalive heartbeat every 20 seconds
                this.pingInterval = setInterval(() => {
                    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                        this.socket.send(JSON.stringify({ type: "PING" }));
                    }
                }, 20000);
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    if (data.type === "INIT_ROOM") {
                        dispatch(setInitRoom({
                            role: data.role,
                            game_state: data.game_state,
                            room_id: data.room_id,
                            status: data.status,
                            player_count: data.player_count
                        }));
                    } else if (data.type === "ROOM_STATUS") {
                        dispatch(updateRoomStatus({
                            status: data.status,
                            player_count: data.player_count,
                            has_p1: data.has_p1,
                            has_p2: data.has_p2,
                            game_state: data.game_state
                        }));
                    } else if (data.type === "GAME_STATE_UPDATED") {
                        dispatch(syncRemoteGameState(data.game_state));
                    }
                } catch (err) {
                    console.error("[WebSocket] Failed to parse message:", err);
                }
            };

            this.socket.onerror = (err) => {
                console.error("[WebSocket] Error:", err);
                dispatch(setConnectionStatus("disconnected"));
            };

            this.socket.onclose = () => {
                console.log("[WebSocket] Connection closed");
                dispatch(setConnectionStatus("disconnected"));
                this.cleanup();
            };

        } catch (error) {
            console.error("[WebSocket] Connection exception:", error);
            dispatch(setConnectionStatus("disconnected"));
        }
    }

    public sendGameState(gameState: any) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: "UPDATE_GAME_STATE",
                game_state: gameState
            }));
        }
    }

    public sendReset() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: "RESET_GAME"
            }));
        }
    }

    public sendForfeit(forfeitingRole: 1 | 2) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: "FORFEIT_GAME",
                forfeiting_role: forfeitingRole
            }));
        }
    }

    public disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.cleanup();
    }

    private cleanup() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
}

export const wsService = new WebSocketService();
