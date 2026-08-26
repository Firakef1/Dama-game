import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Board cell values:
 * 0 = Empty
 * 1 = Player 1 Normal Piece (Red - moves downwards, rows 0->7)
 * 2 = Player 2 Normal Piece (White/Ivory - moves upwards, rows 7->0)
 * 3 = Player 1 King Piece (Red King)
 * 4 = Player 2 King Piece (White/Ivory King)
 */

interface BoardState {
    grid: number[];
    turn: 1 | 2;
    selectedSquare: number | null;
    validMoves: number[];
    capturedP1: number;
    capturedP2: number;
    winner: 1 | 2 | null;
    showHints: boolean;

    // Online Multiplayer state
    isOnlineMode: boolean;
    serverUrl: string;
    roomId: string;
    clientId: string;
    clientRole: 1 | 2 | 'spectator' | null;
    connectionStatus: 'disconnected' | 'connecting' | 'connected';
    roomStatus: 'waiting' | 'playing' | 'disconnected';
    playerCount: number;
    hasP1: boolean;
    hasP2: boolean;
}

// Generate unique client ID per tab/session
const getClientId = (): string => {
    let id = sessionStorage.getItem("dama_client_id");
    if (!id) {
        id = "player_" + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem("dama_client_id", id);
    }
    return id;
};

// Initial 8x8 Dama board setup
const createInitialGrid = (): number[] => {
    const grid = new Array(64).fill(0);
    for (let index = 0; index < 64; index++) {
        const row = Math.floor(index / 8);
        const col = index % 8;
        const isDarkSquare = (row + col) % 2 === 1;

        if (isDarkSquare) {
            if (row < 3) {
                grid[index] = 1; // Player 1 (Red)
            } else if (row >= 5) {
                grid[index] = 2; // Player 2 (White/Ivory)
            }
        }
    }
    return grid;
};

const initialState: BoardState = {
    grid: createInitialGrid(),
    turn: 1,
    selectedSquare: null,
    validMoves: [],
    capturedP1: 0,
    capturedP2: 0,
    winner: null,
    showHints: true,

    isOnlineMode: false,
    serverUrl: typeof window !== "undefined" 
        ? `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname}:8000`
        : "http://localhost:8000",
    roomId: "ROOM-1",
    clientId: getClientId(),
    clientRole: null,
    connectionStatus: 'disconnected',
    roomStatus: 'disconnected',
    playerCount: 0,
    hasP1: false,
    hasP2: false,
};

/**
 * Calculates jump capture target indices for a piece at index `from`.
 * Normal pieces jump 2 squares. Flying Kings slide along diagonals to jump over an enemy and land on any empty square beyond it.
 */
const calculateJumpMovesForPiece = (grid: number[], from: number, playerTurn: 1 | 2): number[] => {
    const piece = grid[from];
    if (piece === 0) return [];
    
    const isKing = piece === 3 || piece === 4;
    const row = Math.floor(from / 8);
    const col = indexToCol(from);

    const jumpMoves: number[] = [];
    const directions: Array<[number, number]> = [
        [1, -1], [1, 1],   // Down-left, Down-right
        [-1, -1], [-1, 1]  // Up-left, Up-right
    ];

    if (!isKing) {
        // Normal Piece: 2-square jump capture in all 4 diagonal directions
        for (const [rDir, cDir] of directions) {
            const enemyRow = row + rDir;
            const enemyCol = col + cDir;
            const targetRow = row + (rDir * 2);
            const targetCol = col + (cDir * 2);

            if (isValidCoordinate(enemyRow, enemyCol) && isValidCoordinate(targetRow, targetCol)) {
                const enemyIndex = enemyRow * 8 + enemyCol;
                const targetIndex = targetRow * 8 + targetCol;
                const enemyPiece = grid[enemyIndex];

                const isEnemy = playerTurn === 1 
                    ? (enemyPiece === 2 || enemyPiece === 4)
                    : (enemyPiece === 1 || enemyPiece === 3);

                if (isEnemy && grid[targetIndex] === 0) {
                    jumpMoves.push(targetIndex);
                }
            }
        }
    } else {
        // Flying King: Can slide any number of empty squares, jump over 1 enemy piece, and land on any empty square beyond it
        for (const [rDir, cDir] of directions) {
            let foundEnemyIndex: number | null = null;

            for (let step = 1; step < 8; step++) {
                const currRow = row + rDir * step;
                const currCol = col + cDir * step;

                if (!isValidCoordinate(currRow, currCol)) break;

                const currIndex = currRow * 8 + currCol;
                const currPiece = grid[currIndex];

                if (foundEnemyIndex === null) {
                    if (currPiece === 0) {
                        // Empty square before finding an enemy piece -> continue searching
                        continue;
                    }

                    const isEnemy = playerTurn === 1 
                        ? (currPiece === 2 || currPiece === 4)
                        : (currPiece === 1 || currPiece === 3);

                    if (isEnemy) {
                        foundEnemyIndex = currIndex; // Found enemy to jump over
                    } else {
                        // Friendly piece blocking path -> stop searching this direction
                        break;
                    }
                } else {
                    // We already found an enemy piece along this ray
                    if (currPiece === 0) {
                        // Any empty square beyond the enemy piece is a valid jump capture landing spot
                        jumpMoves.push(currIndex);
                    } else {
                        // Another piece beyond the enemy piece -> block further landing spots
                        break;
                    }
                }
            }
        }
    }

    return jumpMoves;
};

/**
 * Calculates valid target square indices (both non-capturing moves and jump captures) for a piece at index `from`.
 */
const calculateValidMovesForPiece = (grid: number[], from: number, playerTurn: 1 | 2): number[] => {
    const piece = grid[from];
    if (piece === 0) return [];
    
    // Check ownership
    const isPlayer1 = piece === 1 || piece === 3;
    const isPlayer2 = piece === 2 || piece === 4;
    if (playerTurn === 1 && !isPlayer1) return [];
    if (playerTurn === 2 && !isPlayer2) return [];

    const isKing = piece === 3 || piece === 4;
    const row = Math.floor(from / 8);
    const col = indexToCol(from);

    const validMoves: number[] = [];

    if (!isKing) {
        // Normal Piece Non-capturing step (1 square forward)
        const directions: Array<[number, number]> = piece === 1 
            ? [[1, -1], [1, 1]] 
            : [[-1, -1], [-1, 1]];

        for (const [rDir, cDir] of directions) {
            const targetRow = row + rDir;
            const targetCol = col + cDir;
            if (isValidCoordinate(targetRow, targetCol)) {
                const targetIndex = targetRow * 8 + targetCol;
                if (grid[targetIndex] === 0) {
                    validMoves.push(targetIndex);
                }
            }
        }
    } else {
        // Flying King Non-capturing sliding move (any distance along empty squares in all 4 diagonal directions)
        const directions: Array<[number, number]> = [
            [1, -1], [1, 1],
            [-1, -1], [-1, 1]
        ];

        for (const [rDir, cDir] of directions) {
            for (let step = 1; step < 8; step++) {
                const targetRow = row + rDir * step;
                const targetCol = col + cDir * step;

                if (!isValidCoordinate(targetRow, targetCol)) break;

                const targetIndex = targetRow * 8 + targetCol;
                if (grid[targetIndex] === 0) {
                    validMoves.push(targetIndex);
                } else {
                    // Blocked by a piece
                    break;
                }
            }
        }
    }

    // Include jump captures
    const jumpMoves = calculateJumpMovesForPiece(grid, from, playerTurn);
    validMoves.push(...jumpMoves);

    return validMoves;
};

const indexToCol = (index: number) => index % 8;
const isValidCoordinate = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

const boardSlice = createSlice({
    name: "board",
    initialState,
    reducers: {
        handleSquareClick: (state, action: PayloadAction<number>) => {
            const index = action.payload;
            const piece = state.grid[index];

            // If game is over, ignore clicks
            if (state.winner !== null) return;

            // Online mode: enforce player role & turn restrictions
            if (state.isOnlineMode) {
                if (state.clientRole !== 1 && state.clientRole !== 2) {
                    return; // Spectators or unassigned clients cannot move
                }
                if (state.clientRole !== state.turn) {
                    return; // Can only select/move during your assigned turn
                }
            }

            // If clicking on an existing selected square -> deselect
            if (state.selectedSquare === index) {
                state.selectedSquare = null;
                state.validMoves = [];
                return;
            }

            // Check if clicking on a valid target move
            if (state.selectedSquare !== null && state.validMoves.includes(index)) {
                const from = state.selectedSquare;
                const to = index;
                const movingPiece = state.grid[from];

                const fromRow = Math.floor(from / 8);
                const toRow = Math.floor(to / 8);

                // Move the piece
                state.grid[to] = movingPiece;
                state.grid[from] = 0;

                let isJumpCapture = false;

                const fromCol = indexToCol(from);
                const toCol = indexToCol(to);

                const rDir = toRow > fromRow ? 1 : (toRow < fromRow ? -1 : 0);
                const cDir = toCol > fromCol ? 1 : (toCol < fromCol ? -1 : 0);

                // Traverse path from `from` to `to` to detect and remove jumped enemy piece
                let stepRow = fromRow + rDir;
                let stepCol = fromCol + cDir;

                while (stepRow !== toRow || stepCol !== toCol) {
                    const stepIndex = stepRow * 8 + stepCol;
                    const stepPiece = state.grid[stepIndex];

                    const isEnemy = state.turn === 1 
                        ? (stepPiece === 2 || stepPiece === 4)
                        : (stepPiece === 1 || stepPiece === 3);

                    if (isEnemy) {
                        isJumpCapture = true;
                        state.grid[stepIndex] = 0; // Remove captured enemy piece

                        if (state.turn === 1) {
                            state.capturedP1 += 1;
                        } else {
                            state.capturedP2 += 1;
                        }
                    }

                    stepRow += rDir;
                    stepCol += cDir;
                }

                // King Promotion check
                if (movingPiece === 1 && toRow === 7) {
                    state.grid[to] = 3; // P1 King
                } else if (movingPiece === 2 && toRow === 0) {
                    state.grid[to] = 4; // P2 King
                }

                // Check winner condition (all opponent pieces captured)
                const hasP1Pieces = state.grid.some(p => p === 1 || p === 3);
                const hasP2Pieces = state.grid.some(p => p === 2 || p === 4);
                if (!hasP1Pieces) state.winner = 2;
                if (!hasP2Pieces) state.winner = 1;

                // Continuous Multi-Jump Rule: If this was a jump capture, check if the SAME piece has more jump captures available
                if (isJumpCapture && state.winner === null) {
                    const additionalJumps = calculateJumpMovesForPiece(state.grid, to, state.turn);
                    if (additionalJumps.length > 0) {
                        // Keep the piece selected at its new location and only allow continuous jumps
                        state.selectedSquare = to;
                        state.validMoves = additionalJumps;
                        return; // DO NOT switch turn yet!
                    }
                }

                // Clear selection and switch turn
                state.selectedSquare = null;
                state.validMoves = [];
                state.turn = state.turn === 1 ? 2 : 1;
                return;
            }

            // Otherwise, select piece belonging to current active player
            const isPlayer1Piece = piece === 1 || piece === 3;
            const isPlayer2Piece = piece === 2 || piece === 4;

            if ((state.turn === 1 && isPlayer1Piece) || (state.turn === 2 && isPlayer2Piece)) {
                state.selectedSquare = index;
                state.validMoves = calculateValidMovesForPiece(state.grid, index, state.turn);
            } else {
                state.selectedSquare = null;
                state.validMoves = [];
            }
        },
        resetGame: (state) => {
            state.grid = createInitialGrid();
            state.turn = 1;
            state.selectedSquare = null;
            state.validMoves = [];
            state.capturedP1 = 0;
            state.capturedP2 = 0;
            state.winner = null;
        },
        toggleHints: (state) => {
            state.showHints = !state.showHints;
        },
        forfeitGame: (state) => {
            if (state.winner !== null) return;
            // The active player forfeits, awarding victory to the opponent
            state.winner = state.turn === 1 ? 2 : 1;
            state.selectedSquare = null;
            state.validMoves = [];
        },

        // --- Online Multiplayer Reducers ---
        setOnlineMode: (state, action: PayloadAction<boolean>) => {
            state.isOnlineMode = action.payload;
            if (!action.payload) {
                state.connectionStatus = 'disconnected';
                state.roomStatus = 'disconnected';
                state.clientRole = null;
            }
        },
        setServerUrl: (state, action: PayloadAction<string>) => {
            state.serverUrl = action.payload;
        },
        setRoomId: (state, action: PayloadAction<string>) => {
            state.roomId = action.payload.trim().toUpperCase();
        },
        setConnectionStatus: (state, action: PayloadAction<'disconnected' | 'connecting' | 'connected'>) => {
            state.connectionStatus = action.payload;
        },
        setInitRoom: (state, action: PayloadAction<{ role: 1 | 2 | 'spectator'; game_state: any; room_id: string; status: 'waiting' | 'playing'; player_count: number }>) => {
            const { role, game_state, room_id, status, player_count } = action.payload;
            state.clientRole = role;
            state.roomId = room_id;
            state.roomStatus = status;
            state.playerCount = player_count;

            if (game_state) {
                state.grid = game_state.grid || state.grid;
                state.turn = game_state.turn || state.turn;
                state.capturedP1 = game_state.capturedP1 ?? state.capturedP1;
                state.capturedP2 = game_state.capturedP2 ?? state.capturedP2;
                state.winner = game_state.winner ?? null;
            }
            state.selectedSquare = null;
            state.validMoves = [];
        },
        updateRoomStatus: (state, action: PayloadAction<{ status: 'waiting' | 'playing' | 'disconnected'; player_count: number; has_p1: boolean; has_p2: boolean; game_state?: any }>) => {
            state.roomStatus = action.payload.status;
            state.playerCount = action.payload.player_count;
            state.hasP1 = action.payload.has_p1;
            state.hasP2 = action.payload.has_p2;

            if (action.payload.game_state) {
                const gs = action.payload.game_state;
                state.grid = gs.grid || state.grid;
                state.turn = gs.turn || state.turn;
                state.capturedP1 = gs.capturedP1 ?? state.capturedP1;
                state.capturedP2 = gs.capturedP2 ?? state.capturedP2;
                state.winner = gs.winner ?? null;
            }
        },
        syncRemoteGameState: (state, action: PayloadAction<any>) => {
            const gs = action.payload;
            if (!gs) return;
            state.grid = gs.grid;
            state.turn = gs.turn;
            state.capturedP1 = gs.capturedP1;
            state.capturedP2 = gs.capturedP2;
            state.winner = gs.winner;
            state.selectedSquare = null;
            state.validMoves = [];
        }
    }
});

export const { 
    handleSquareClick, 
    resetGame, 
    toggleHints, 
    forfeitGame,
    setOnlineMode,
    setServerUrl,
    setRoomId,
    setConnectionStatus,
    setInitRoom,
    updateRoomStatus,
    syncRemoteGameState
} = boardSlice.actions;

export default boardSlice.reducer;

