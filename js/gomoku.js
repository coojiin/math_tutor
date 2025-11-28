// Gomoku Game Logic (MVC Pattern) - Hybrid MCTS AI Engine (Smart Simulation)

const GomokuConstants = {
    BOARD_SIZE: 19, // Dynamic
    EMPTY: 0,
    PLAYER1: 1, // Black (Human)
    PLAYER2: 2, // White (AI)
    AI: {
        TIME_LIMIT: 1000, // 1 second
        SIMULATION_LIMIT: 10000, // Increased limit
        UCT_C: 1.41
    }
};

class GomokuState {
    constructor() {
        this.determineBoardSize();
        this.reset();
    }

    determineBoardSize() {
        if (window.innerWidth < 600) {
            GomokuConstants.BOARD_SIZE = 13;
        } else {
            GomokuConstants.BOARD_SIZE = 19;
        }
    }

    _createEmptyBoard() {
        return Array(GomokuConstants.BOARD_SIZE).fill(null).map(() =>
            Array(GomokuConstants.BOARD_SIZE).fill(GomokuConstants.EMPTY)
        );
    }

    reset() {
        this.determineBoardSize();
        this.board = this._createEmptyBoard();
        this.currentPlayer = GomokuConstants.PLAYER1;
        this.gameOver = false;
        this.winner = GomokuConstants.EMPTY;
        this.lastMove = null;
        this.isAiThinking = false;
    }

    isOnBoard(row, col) {
        return row >= 0 && row < GomokuConstants.BOARD_SIZE &&
            col >= 0 && col < GomokuConstants.BOARD_SIZE;
    }

    clone() {
        const newState = new GomokuState();
        newState.board = this.board.map(row => [...row]);
        newState.currentPlayer = this.currentPlayer;
        newState.gameOver = this.gameOver;
        newState.winner = this.winner;
        return newState;
    }
}

class GomokuRenderer {
    constructor(gameState) {
        this.gameState = gameState;
        this.boardElement = document.getElementById('gomoku-board');
        this.messageElement = document.getElementById('gomoku-message');
    }

    renderBoard(cellClickHandler) {
        const { boardElement } = this;
        boardElement.innerHTML = '';

        boardElement.style.gridTemplateColumns = `repeat(${GomokuConstants.BOARD_SIZE}, 1fr)`;
        boardElement.style.gridTemplateRows = `repeat(${GomokuConstants.BOARD_SIZE}, 1fr)`;

        const { gameOver, isAiThinking, currentPlayer, board, lastMove } = this.gameState;
        const size = GomokuConstants.BOARD_SIZE;

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const intersection = document.createElement('div');
                intersection.classList.add('intersection');
                intersection.dataset.row = r;
                intersection.dataset.col = c;

                if (r === 0) intersection.classList.add('top-edge');
                if (r === size - 1) intersection.classList.add('bottom-edge');
                if (c === 0) intersection.classList.add('left-edge');
                if (c === size - 1) intersection.classList.add('right-edge');

                if (this.isStarPoint(r, c)) {
                    const dot = document.createElement('div');
                    dot.classList.add('star-dot');
                    intersection.appendChild(dot);
                }

                const piece = board[r][c];
                if (piece === GomokuConstants.EMPTY) {
                    intersection.onclick = () => cellClickHandler(r, c);
                    if (!gameOver && !isAiThinking && currentPlayer === GomokuConstants.PLAYER1) {
                        intersection.style.cursor = 'pointer';
                    } else if (isAiThinking) {
                        intersection.style.cursor = 'wait';
                    } else {
                        intersection.style.cursor = 'default';
                    }
                } else {
                    const stone = document.createElement('div');
                    stone.classList.add('stone', piece === GomokuConstants.PLAYER1 ? 'black' : 'white');
                    intersection.appendChild(stone);
                    intersection.style.cursor = 'default';
                }

                if (lastMove && lastMove.row === r && lastMove.col === c) {
                    const marker = document.createElement('div');
                    marker.classList.add('last-move-marker');
                    intersection.appendChild(marker);
                }

                boardElement.appendChild(intersection);
            }
        }
    }

    isStarPoint(r, c) {
        const size = GomokuConstants.BOARD_SIZE;
        if (size === 19) {
            const stars = [3, 9, 15];
            return stars.includes(r) && stars.includes(c);
        } else if (size === 13) {
            const stars = [3, 6, 9];
            return stars.includes(r) && stars.includes(c);
        }
        return false;
    }

    updateMessage() {
        const { isAiThinking, gameOver, winner, currentPlayer } = this.gameState;
        let msg = "";
        if (isAiThinking) {
            msg = "AI (⚪) 正在思考...";
            this.messageElement.style.color = 'purple';
        } else if (gameOver) {
            if (winner === GomokuConstants.PLAYER1) {
                msg = "遊戲結束：恭喜你 (⚫) 獲勝！";
                this.messageElement.style.color = 'darkgreen';
            } else if (winner === GomokuConstants.PLAYER2) {
                msg = "遊戲結束：AI (⚪) 獲勝！";
                this.messageElement.style.color = 'darkred';
            } else {
                msg = "遊戲結束：平局！";
                this.messageElement.style.color = 'darkorange';
            }
        } else {
            msg = currentPlayer === GomokuConstants.PLAYER1 ? "輪到你 (⚫) 下棋" : "輪到 AI (⚪) 下棋";
            this.messageElement.style.color = '#555';
        }
        this.messageElement.textContent = msg;
    }
}

class GomokuRuleEngine {
    constructor(gameState) { this.gameState = gameState; }

    makeMove(row, col, player) {
        const { board, gameOver } = this.gameState;
        if (gameOver || !this.gameState.isOnBoard(row, col) || board[row][col] !== GomokuConstants.EMPTY) {
            return false;
        }

        board[row][col] = player;
        this.gameState.lastMove = { row, col };

        if (this.checkWin(row, col, player)) {
            this.gameState.gameOver = true;
            this.gameState.winner = player;
        } else if (this.checkDraw()) {
            this.gameState.gameOver = true;
            this.gameState.winner = -1;
        }
        return true;
    }

    checkWin(row, col, player) {
        const { board } = this.gameState;
        const directions = [
            { dr: 0, dc: 1 },
            { dr: 1, dc: 0 },
            { dr: 1, dc: 1 },
            { dr: 1, dc: -1 }
        ];

        for (const { dr, dc } of directions) {
            let count = 1;
            for (let i = 1; i < 5; i++) {
                const r = row + i * dr, c = col + i * dc;
                if (this.gameState.isOnBoard(r, c) && board[r][c] === player) count++;
                else break;
            }
            for (let i = 1; i < 5; i++) {
                const r = row - i * dr, c = col - i * dc;
                if (this.gameState.isOnBoard(r, c) && board[r][c] === player) count++;
                else break;
            }
            if (count >= 5) return true;
        }
        return false;
    }

    checkDraw() {
        const { board } = this.gameState;
        for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) {
            for (let c = 0; c < GomokuConstants.BOARD_SIZE; c++) {
                if (board[r][c] === GomokuConstants.EMPTY) return false;
            }
        }
        return true;
    }
}

// --- MCTS Node ---
class MCTSNode {
    constructor(state, move, parent = null) {
        this.state = state.clone();
        this.move = move; // {row, col}
        this.parent = parent;
        this.children = [];
        this.wins = 0;
        this.visits = 0;
        this.untriedMoves = this.getPossibleMoves();
    }

    getPossibleMoves() {
        const moves = [];
        const size = GomokuConstants.BOARD_SIZE;
        const board = this.state.board;

        // Only consider moves near existing stones (distance 2)
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] === GomokuConstants.EMPTY) {
                    if (this.hasNeighbors(board, r, c, 2)) {
                        moves.push({ row: r, col: c });
                    }
                }
            }
        }

        if (moves.length === 0) {
            const center = Math.floor(size / 2);
            moves.push({ row: center, col: center });
        }

        return moves;
    }

    hasNeighbors(board, r, c, distance) {
        const minR = Math.max(0, r - distance);
        const maxR = Math.min(GomokuConstants.BOARD_SIZE - 1, r + distance);
        const minC = Math.max(0, c - distance);
        const maxC = Math.min(GomokuConstants.BOARD_SIZE - 1, c + distance);

        for (let i = minR; i <= maxR; i++) {
            for (let j = minC; j <= maxC; j++) {
                if (board[i][j] !== GomokuConstants.EMPTY) return true;
            }
        }
        return false;
    }

    uctValue(c = GomokuConstants.AI.UCT_C) {
        if (this.visits === 0) return Infinity;
        return (this.wins / this.visits) + c * Math.sqrt(Math.log(this.parent.visits) / this.visits);
    }

    selectChild() {
        return this.children.reduce((best, child) =>
            child.uctValue() > best.uctValue() ? child : best
        );
    }

    addChild(move) {
        const newState = this.state.clone();
        const ruleEngine = new GomokuRuleEngine(newState);
        ruleEngine.makeMove(move.row, move.col, newState.currentPlayer);
        newState.currentPlayer = newState.currentPlayer === GomokuConstants.PLAYER1 ?
            GomokuConstants.PLAYER2 : GomokuConstants.PLAYER1;

        const child = new MCTSNode(newState, move, this);
        this.untriedMoves = this.untriedMoves.filter(m => m.row !== move.row || m.col !== move.col);
        this.children.push(child);
        return child;
    }

    update(result) {
        this.visits++;
        this.wins += result;
    }
}

// --- Hybrid MCTS AI Engine ---
class GomokuAIEngine {
    constructor(gameState) {
        this.gameState = gameState;
    }

    async makeMove() {
        if (this.gameState.gameOver || this.gameState.currentPlayer !== GomokuConstants.PLAYER2) {
            return;
        }
        this.gameState.isAiThinking = true;

        await new Promise(resolve => setTimeout(resolve, 20));

        // 1. Immediate Threat Check (Pre-MCTS)
        const immediateMove = this.findImmediateThreat(this.gameState.board, GomokuConstants.PLAYER2);
        if (immediateMove) {
            console.log("Immediate Threat Found:", immediateMove);
            return immediateMove;
        }

        // 2. MCTS Search
        const bestMove = this.mctsSearch();
        return bestMove;
    }

    // Check for Win in 1, Block Win in 1, Block Live 3
    findImmediateThreat(board, aiPlayer) {
        const humanPlayer = aiPlayer === 1 ? 2 : 1;
        const size = GomokuConstants.BOARD_SIZE;
        const empties = [];

        // Collect empty spots near stones
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] === GomokuConstants.EMPTY && this.hasNeighbors(board, r, c, 1)) {
                    empties.push({ row: r, col: c });
                }
            }
        }

        // 1. Check AI Win (5)
        for (const move of empties) {
            if (this.checkPattern(board, move.row, move.col, aiPlayer, 5)) return move;
        }

        // 2. Check Block Human Win (5) - "Dead 4" / "Live 4"
        for (const move of empties) {
            if (this.checkPattern(board, move.row, move.col, humanPlayer, 5)) return move;
        }

        // 3. Check AI Live 4 (Unstoppable)
        for (const move of empties) {
            if (this.checkLive4(board, move.row, move.col, aiPlayer)) return move;
        }

        // 4. Check Block Human Live 4 (Unstoppable)
        for (const move of empties) {
            if (this.checkLive4(board, move.row, move.col, humanPlayer)) return move;
        }

        // 5. Check Block Human Live 3 (Becomes Live 4)
        for (const move of empties) {
            if (this.checkLive3(board, move.row, move.col, humanPlayer)) return move;
        }

        return null;
    }

    // Helper to check if placing a stone at r,c creates a line of length 'target'
    checkPattern(board, r, c, player, target) {
        board[r][c] = player;
        const directions = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }];
        let found = false;
        for (const { dr, dc } of directions) {
            let count = 1;
            for (let i = 1; i < 5; i++) {
                if (this.isOnBoard(r + i * dr, c + i * dc) && board[r + i * dr][c + i * dc] === player) count++; else break;
            }
            for (let i = 1; i < 5; i++) {
                if (this.isOnBoard(r - i * dr, c - i * dc) && board[r - i * dr][c - i * dc] === player) count++; else break;
            }
            if (count >= target) { found = true; break; }
        }
        board[r][c] = GomokuConstants.EMPTY; // Undo
        return found;
    }

    checkLive4(board, r, c, player) {
        // Live 4 means 011110. Placing stone creates 5? No, placing stone creates Live 4.
        // This function checks if placing a stone creates a Live 4 (which guarantees a win next turn).
        // Actually, we want to check if placing stone creates 5 (handled above).
        // Here we check if placing stone creates "Open 4" (011110)
        board[r][c] = player;
        const directions = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }];
        let found = false;
        for (const { dr, dc } of directions) {
            // Check for pattern _XXXX_
            // We need to construct the line string
            const lineStr = this.getLineString(board, r, c, dr, dc, player);
            if (lineStr.includes("_xxxx_")) { found = true; break; }
        }
        board[r][c] = GomokuConstants.EMPTY;
        return found;
    }

    checkLive3(board, r, c, player) {
        // Check if placing stone creates Live 3 (01110)
        board[r][c] = player;
        const directions = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }];
        let found = false;
        for (const { dr, dc } of directions) {
            const lineStr = this.getLineString(board, r, c, dr, dc, player);
            if (lineStr.includes("_xxx_") || lineStr.includes("_x_xx_") || lineStr.includes("_xx_x_")) { found = true; break; }
        }
        board[r][c] = GomokuConstants.EMPTY;
        return found;
    }

    getLineString(board, r, c, dr, dc, player) {
        // Get 9 chars centered at r,c
        let str = "";
        for (let i = -4; i <= 4; i++) {
            const nr = r + i * dr;
            const nc = c + i * dc;
            if (!this.isOnBoard(nr, nc)) {
                str += "|"; // Edge
            } else {
                const p = board[nr][nc];
                if (p === player) str += "x";
                else if (p === GomokuConstants.EMPTY) str += "_";
                else str += "o";
            }
        }
        return str;
    }

    isOnBoard(row, col) {
        return row >= 0 && row < GomokuConstants.BOARD_SIZE &&
            col >= 0 && col < GomokuConstants.BOARD_SIZE;
    }

    hasNeighbors(board, r, c, distance) {
        const minR = Math.max(0, r - distance);
        const maxR = Math.min(GomokuConstants.BOARD_SIZE - 1, r + distance);
        const minC = Math.max(0, c - distance);
        const maxC = Math.min(GomokuConstants.BOARD_SIZE - 1, c + distance);

        for (let i = minR; i <= maxR; i++) {
            for (let j = minC; j <= maxC; j++) {
                if (board[i][j] !== GomokuConstants.EMPTY) return true;
            }
        }
        return false;
    }

    mctsSearch() {
        const rootState = this.gameState.clone();
        const root = new MCTSNode(rootState, null);

        const startTime = Date.now();
        let iterations = 0;

        while (Date.now() - startTime < GomokuConstants.AI.TIME_LIMIT &&
            iterations < GomokuConstants.AI.SIMULATION_LIMIT) {

            let node = root;
            while (node.untriedMoves.length === 0 && node.children.length > 0) {
                node = node.selectChild();
            }

            if (node.untriedMoves.length > 0) {
                const move = node.untriedMoves[Math.floor(Math.random() * node.untriedMoves.length)];
                node = node.addChild(move);
            }

            const result = this.simulate(node.state);

            while (node !== null) {
                node.update(result);
                node = node.parent;
            }
            iterations++;
        }

        if (root.children.length === 0) {
            const center = Math.floor(GomokuConstants.BOARD_SIZE / 2);
            return { row: center, col: center };
        }

        const bestChild = root.children.reduce((best, child) =>
            child.visits > best.visits ? child : best
        );

        return bestChild.move;
    }

    // Greedy Simulation (Heavy Playout)
    simulate(state) {
        const simState = state.clone();
        const ruleEngine = new GomokuRuleEngine(simState);
        let currentPlayer = simState.currentPlayer;
        let moveCount = 0;
        const maxMoves = 60; // Shorter simulation for speed

        while (!simState.gameOver && moveCount < maxMoves) {
            // Greedy Check: Can I win now? Can I block win?
            const urgentMove = this.findImmediateThreat(simState.board, currentPlayer);

            let move;
            if (urgentMove) {
                move = urgentMove;
            } else {
                // Random neighbor move
                const possibleMoves = this.getPossibleMoves(simState.board);
                if (possibleMoves.length === 0) break;
                move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
            }

            ruleEngine.makeMove(move.row, move.col, currentPlayer);
            currentPlayer = currentPlayer === GomokuConstants.PLAYER1 ?
                GomokuConstants.PLAYER2 : GomokuConstants.PLAYER1;
            moveCount++;
        }

        if (simState.winner === GomokuConstants.PLAYER2) return 1;
        if (simState.winner === GomokuConstants.PLAYER1) return 0;
        return 0.5;
    }

    getPossibleMoves(board) {
        const moves = [];
        const size = GomokuConstants.BOARD_SIZE;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] === GomokuConstants.EMPTY) {
                    if (this.hasNeighbors(board, r, c, 1)) { // Tighter neighbor check for simulation
                        moves.push({ row: r, col: c });
                    }
                }
            }
        }
        if (moves.length === 0) {
            // Fallback
            for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (board[r][c] === GomokuConstants.EMPTY) moves.push({ row: r, col: c });
        }
        return moves;
    }
}

class GomokuController {
    constructor() {
        this.gameState = new GomokuState();
        this.renderer = new GomokuRenderer(this.gameState);
        this.ruleEngine = new GomokuRuleEngine(this.gameState);
        this.aiEngine = new GomokuAIEngine(this.gameState);
        this.renderer.renderBoard(this.handleCellClick.bind(this));
        this.renderer.updateMessage();

        window.addEventListener('resize', () => {
            // Optional: Handle resize
        });
    }

    async handleCellClick(row, col) {
        if (this.gameState.gameOver || this.gameState.isAiThinking ||
            this.gameState.currentPlayer !== GomokuConstants.PLAYER1) return;

        if (this.ruleEngine.makeMove(row, col, GomokuConstants.PLAYER1)) {
            this.renderer.renderBoard(this.handleCellClick.bind(this));
            this.renderer.updateMessage();

            if (!this.gameState.gameOver) {
                this.gameState.currentPlayer = GomokuConstants.PLAYER2;
                this.renderer.updateMessage();
                this.gameState.isAiThinking = true;
                this.renderer.renderBoard(this.handleCellClick.bind(this));

                await new Promise(resolve => setTimeout(resolve, 50));

                const aiMove = await this.aiEngine.makeMove();
                this.gameState.isAiThinking = false;

                if (aiMove) {
                    this.ruleEngine.makeMove(aiMove.row, aiMove.col, GomokuConstants.PLAYER2);
                    this.gameState.currentPlayer = GomokuConstants.PLAYER1;
                }

                this.renderer.renderBoard(this.handleCellClick.bind(this));
                this.renderer.updateMessage();
            }
        }
    }

    reset() {
        this.gameState.reset();
        this.renderer.renderBoard(this.handleCellClick.bind(this));
        this.renderer.updateMessage();
    }
}

let gomokuController = null;
function initGomokuGame() {
    if (!gomokuController) {
        gomokuController = new GomokuController();
    }
}
function resetGomokuGame() {
    if (gomokuController) gomokuController.reset();
}
