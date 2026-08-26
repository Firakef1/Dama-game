import { useState, useEffect, useRef } from "react";
import Box from "./box";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { 
    handleSquareClick, 
    resetGame, 
    toggleHints, 
    forfeitGame,
    setOnlineMode,
    setServerUrl,
    setRoomId
} from "./boardSlice";
import { wsService } from "../../services/websocket";

export default function Board() {
    const dispatch = useAppDispatch();
    const { 
        grid, 
        turn, 
        selectedSquare, 
        validMoves, 
        capturedP1, 
        capturedP2, 
        winner, 
        showHints,
        isOnlineMode,
        serverUrl,
        roomId,
        clientId,
        clientRole,
        connectionStatus,
        roomStatus,
        playerCount
    } = useAppSelector((state) => state.board);

    const [inputServerUrl, setInputServerUrl] = useState(serverUrl);
    const [inputRoomId, setInputRoomId] = useState(roomId);
    const [showNetworkSettings, setShowNetworkSettings] = useState(false);
    const [copied, setCopied] = useState(false);

    // Track previous grid/turn to know when state changes locally
    const prevGridRef = useRef(grid);
    const prevTurnRef = useRef(turn);
    const prevWinnerRef = useRef(winner);

    // Sync state over WebSocket when local move occurs
    useEffect(() => {
        if (isOnlineMode && connectionStatus === "connected") {
            const gridChanged = JSON.stringify(grid) !== JSON.stringify(prevGridRef.current);
            const turnChanged = turn !== prevTurnRef.current;
            const winnerChanged = winner !== prevWinnerRef.current;

            if (gridChanged || turnChanged || winnerChanged) {
                // Send updated game state to backend
                wsService.sendGameState({
                    grid,
                    turn,
                    selectedSquare: null,
                    validMoves: [],
                    capturedP1,
                    capturedP2,
                    winner,
                    showHints
                });
            }
        }
        prevGridRef.current = grid;
        prevTurnRef.current = turn;
        prevWinnerRef.current = winner;
    }, [grid, turn, capturedP1, capturedP2, winner, isOnlineMode, connectionStatus, showHints]);

    // Handle WebSocket connection lifecycle
    const handleConnectRoom = () => {
        dispatch(setServerUrl(inputServerUrl));
        dispatch(setRoomId(inputRoomId));
        dispatch(setOnlineMode(true));
        wsService.connect(inputServerUrl, inputRoomId.trim().toUpperCase(), clientId, dispatch);
    };

    const handleDisconnect = () => {
        wsService.disconnect();
        dispatch(setOnlineMode(false));
    };

    const handleCopyRoomCode = () => {
        navigator.clipboard.writeText(roomId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleResetClick = () => {
        dispatch(resetGame());
        if (isOnlineMode && connectionStatus === "connected") {
            wsService.sendReset();
        }
    };

    const handleForfeitClick = () => {
        dispatch(forfeitGame());
        if (isOnlineMode && connectionStatus === "connected" && (clientRole === 1 || clientRole === 2)) {
            wsService.sendForfeit(clientRole);
        }
    };

    const isMyTurn = !isOnlineMode || (isOnlineMode && clientRole === turn);
    const isSpectator = isOnlineMode && clientRole === 'spectator';

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-stone-950 text-stone-100 p-3 sm:p-6 gap-5 font-sans select-none relative">
            
            {/* Top Bar: Mode Toggle & Room Connection Controls */}
            <div className="w-full max-w-4xl bg-[#2d1b12] border border-[#42291c] p-3 sm:p-4 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-200 text-sm sm:text-base font-mono">DAMA ONLINE</span>
                        {/* Connection Pill Status */}
                        {isOnlineMode && (
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold flex items-center gap-1.5 ${
                                connectionStatus === "connected" 
                                    ? "bg-emerald-950 text-emerald-300 border border-emerald-700/60" 
                                    : connectionStatus === "connecting"
                                    ? "bg-amber-950 text-amber-300 border border-amber-700/60 animate-pulse"
                                    : "bg-red-950 text-red-300 border border-red-800/60"
                            }`}>
                                <span className={`w-2 h-2 rounded-full ${
                                    connectionStatus === "connected" ? "bg-emerald-400" : connectionStatus === "connecting" ? "bg-amber-400" : "bg-red-400"
                                }`} />
                                {connectionStatus.toUpperCase()}
                            </span>
                        )}
                    </div>

                    {/* Mode Toggle Button */}
                    <button
                        onClick={() => {
                            if (isOnlineMode) {
                                handleDisconnect();
                            } else {
                                handleConnectRoom();
                            }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono border transition-all active:scale-95 ${
                            isOnlineMode 
                                ? "bg-amber-900/60 text-amber-200 border-amber-600 hover:bg-amber-800/80" 
                                : "bg-[#3d2417] text-stone-300 border-[#593724] hover:bg-[#4d2f1f]"
                        }`}
                    >
                        {isOnlineMode ? "Disconnect Online" : "Play Online"}
                    </button>
                </div>

                {/* Online Room Code & Controls */}
                {isOnlineMode ? (
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                        <div className="flex items-center gap-1.5 bg-[#1f110a] border border-[#47291a] px-3 py-1.5 rounded-xl text-xs">
                            <span className="text-stone-400 font-mono">ROOM:</span>
                            <span className="font-bold text-amber-300 font-mono">{roomId}</span>
                            <button 
                                onClick={handleCopyRoomCode}
                                className="ml-1 text-[11px] bg-[#3b2114] hover:bg-[#4a2b1c] text-stone-200 px-2 py-0.5 rounded transition-all active:scale-95"
                                title="Copy Room Code to share with second player"
                            >
                                {copied ? "Copied!" : "Copy Code"}
                            </button>
                        </div>

                        <button 
                            onClick={() => setShowNetworkSettings(!showNetworkSettings)}
                            className="p-1.5 bg-[#1f110a] hover:bg-[#3b2114] border border-[#47291a] text-stone-300 rounded-xl text-xs"
                            title="Server / Render Network Settings"
                        >
                            ⚙️ Server Config
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-xs text-stone-400 font-mono">
                        <span>Offline Local 2-Player Mode</span>
                    </div>
                )}
            </div>

            {/* Collapsible Render / Server Configuration */}
            {showNetworkSettings && (
                <div className="w-full max-w-4xl bg-[#23150e] border border-[#47291a] p-4 rounded-2xl shadow-lg flex flex-col gap-3">
                    <div className="text-xs font-mono font-bold text-amber-200">SERVER CONNECTION SETTINGS (Render / Local)</div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex-1">
                            <label className="text-[11px] text-stone-400 font-mono block mb-1">Backend Server URL (HTTP/HTTPS or Render URL):</label>
                            <input 
                                type="text"
                                value={inputServerUrl}
                                onChange={(e) => setInputServerUrl(e.target.value)}
                                placeholder="e.g. https://dama-backend.onrender.com or http://localhost:8000"
                                className="w-full bg-[#180d08] border border-[#47291a] text-amber-100 px-3 py-1.5 rounded-xl text-xs font-mono focus:outline-none focus:border-amber-500"
                            />
                        </div>
                        <div className="w-full sm:w-48">
                            <label className="text-[11px] text-stone-400 font-mono block mb-1">Room Code:</label>
                            <input 
                                type="text"
                                value={inputRoomId}
                                onChange={(e) => setInputRoomId(e.target.value)}
                                placeholder="e.g. ROOM-1"
                                className="w-full bg-[#180d08] border border-[#47291a] text-amber-100 px-3 py-1.5 rounded-xl text-xs font-mono uppercase focus:outline-none focus:border-amber-500"
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => {
                                    handleConnectRoom();
                                    setShowNetworkSettings(false);
                                }}
                                className="w-full sm:w-auto px-4 py-1.5 bg-amber-700 hover:bg-amber-600 text-stone-950 font-bold text-xs rounded-xl font-mono transition-all active:scale-95"
                            >
                                Connect
                            </button>
                        </div>
                    </div>
                    <div className="text-[11px] text-stone-400 font-mono">
                        💡 Tip: Deploy your FastAPI backend to Render, then paste your Render backend URL above (e.g. <code className="text-amber-300">https://your-app.onrender.com</code>). WSS secure WebSockets are automatically supported!
                    </div>
                </div>
            )}

            {/* Online Turn Status Banner */}
            {isOnlineMode && connectionStatus === "connected" && (
                <div className={`w-full max-w-4xl py-2 px-4 rounded-xl font-mono text-center text-xs sm:text-sm font-bold border transition-all ${
                    roomStatus === "waiting" 
                        ? "bg-amber-950/70 border-amber-700 text-amber-300 animate-pulse"
                        : winner !== null
                        ? "bg-amber-900/60 border-amber-500 text-amber-200"
                        : isMyTurn
                        ? "bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse"
                        : "bg-stone-900/80 border-stone-700 text-stone-400"
                }`}>
                    {roomStatus === "waiting" ? (
                        <span>⏳ Waiting for Player 2 to join Room "{roomId}"... Share room code!</span>
                    ) : isSpectator ? (
                        <span>👁️ Spectating Room "{roomId}" ({playerCount} players connected)</span>
                    ) : isMyTurn ? (
                        <span>🎯 YOUR TURN! Make your move as Player {clientRole} ({clientRole === 1 ? 'Red' : 'Ivory'})</span>
                    ) : (
                        <span>⏳ Opponent's turn (Player {turn} - {turn === 1 ? 'Red' : 'Ivory'}). Please wait...</span>
                    )}
                </div>
            )}

            {/* Main Game Layout */}
            <div className="flex flex-col lg:flex-row items-center justify-center gap-6">
                
                {/* Physical Wooden Dama Board */}
                <div className={`p-3 sm:p-5 rounded-2xl bg-[#26150d] border-8 border-[#3b2114] shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_2px_4px_rgba(255,255,255,0.08)] relative order-2 lg:order-1 ${
                    isOnlineMode && !isMyTurn ? "pointer-events-none opacity-90" : ""
                }`}>
                    {/* Inner Wooden Inlay Frame */}
                    <div className="grid grid-cols-8 gap-0.5 p-1.5 bg-[#1f110a] rounded-lg border border-[#47291a]/60 shadow-inner">
                        {grid.map((cellState, index) => {
                            const row = Math.floor(index / 8);
                            const col = index % 8;
                            const isDarkSquare = (row + col) % 2 === 1;

                            const isSelected = selectedSquare === index;
                            const isValidMove = validMoves.includes(index);

                            return (
                                <Box 
                                    key={index} 
                                    isDarkSquare={isDarkSquare} 
                                    boxState={cellState}
                                    isSelected={isSelected}
                                    isValidMove={showHints && isValidMove}
                                    onClick={() => dispatch(handleSquareClick(index))}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Side Panel: Game Info, Scoreboard & Controls */}
                <div className="w-full lg:w-80 max-w-md bg-[#2d1b12] border border-[#42291c] p-5 rounded-2xl shadow-2xl flex flex-col justify-between gap-5 order-1 lg:order-2">

                    {/* Role Indicator Card in Online Mode */}
                    {isOnlineMode && (
                        <div className="p-3 bg-[#1e110b] border border-[#47291a] rounded-xl flex items-center justify-between text-xs font-mono">
                            <span className="text-stone-400">Your Role:</span>
                            <span className="font-bold text-amber-300">
                                {clientRole === 1 ? "Player 1 (Red)" : clientRole === 2 ? "Player 2 (Ivory)" : clientRole === "spectator" ? "Spectator" : "Assigning..."}
                            </span>
                        </div>
                    )}

                    {/* Scoreboard Cards */}
                    <div className="flex flex-col gap-3">
                        {/* Player 1 Score (Red) */}
                        <div className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                            turn === 1 ? 'border border-amber-500/80 shadow-md bg-[#3d2417]/40' : 'bg-[#22140d]/60 border border-[#3b2114]/40 opacity-70'
                        }`}>
                            <div className="flex items-center gap-3">
                                <div>
                                    <div className="text-xs font-semibold text-stone-200">
                                        Player 1 (Red) {isOnlineMode && clientRole === 1 && " (YOU)"}
                                    </div>
                                    <div className="text-[11px] text-stone-400">Captured: <span className="font-bold text-red-400">{capturedP1}</span></div>
                                </div>
                            </div>
                        </div>

                        {/* Player 2 Score (Ivory) */}
                        <div className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                            turn === 2 ? 'border border-amber-500/80 shadow-md bg-[#3d2417]/40' : 'bg-[#22140d]/60 border border-[#3b2114]/40 opacity-70'
                        }`}>
                            <div className="flex items-center gap-3">
                                <div>
                                    <div className="text-xs font-semibold text-stone-200">
                                        Player 2 (Ivory) {isOnlineMode && clientRole === 2 && " (YOU)"}
                                    </div>
                                    <div className="text-[11px] text-stone-400">Captured: <span className="font-bold text-amber-300">{capturedP2}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Winner Banner Alert */}
                    {winner !== null && (
                        <div className="px-4 py-3 bg-gradient-to-r from-amber-600 to-amber-700 text-amber-950 font-bold text-base rounded-xl shadow-xl animate-bounce flex items-center justify-center gap-2 border border-amber-400">
                            <span>Player {winner === 1 ? '1 (Red)' : '2 (Ivory)'} Wins!</span>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-[#42291c]/80">
                        <button
                            onClick={handleResetClick}
                            className="w-full py-2 bg-[#3d2417] hover:bg-[#4d2f1f] text-amber-200 border border-[#593724] rounded-xl text-xs font-mono font-medium transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
                        >
                            Restart Game
                        </button>
                        {winner === null && (
                            <button
                                onClick={handleForfeitClick}
                                className="w-full py-2 bg-red-950/80 hover:bg-red-900/90 text-red-200 border border-red-800/60 rounded-xl text-xs font-mono transition-all active:scale-95 flex items-center justify-center gap-2"
                                title="Concede and forfeit game to opponent"
                            >
                                Forfeit Game
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom-Left Corner: Game Indications / Pro Mode Toggle Button */}
            <div className="fixed bottom-4 left-4 z-50">
                <button
                    onClick={() => dispatch(toggleHints())}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-semibold transition-all border active:scale-95 ${
                        showHints
                            ? 'text-amber-300 border-[#42291c] hover:bg-[#3d2417] bg-[#22140d]'
                            : 'text-amber-200 border-[#593724] hover:bg-[#4d2f1f] bg-[#22140d]'
                    }`}
                    title="Toggle game move indications ON or OFF"
                >
                    <span>{showHints ? 'HINTS: ON' : 'HINTS: OFF'}</span>
                </button>
            </div>
        </div>
    );
}

