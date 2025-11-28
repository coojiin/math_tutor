// Gomoku Game Logic (MVC Pattern) - Advanced AI & Dynamic Board

const GomokuConstants = {
    // Board size will be set dynamically
    BOARD_SIZE: 19,
    EMPTY: 0,
    PLAYER1: 1, // Black (Human)
    PLAYER2: 2, // White (AI)
    AI: {
        SEARCH_DEPTH: 4, // Deeper search for smarter AI
        WIN_SCORE: 10000000, // Higher win score
        // Evaluation Scores
        SCORES: {
            FIVE: 10000000,
            LIVE_FOUR: 100000,
            DEAD_FOUR: 10000, // Force move
            LIVE_THREE: 10000, // Almost as good as dead four
            DEAD_THREE: 1000,
            LIVE_TWO: 100,
            DEAD_TWO: 10,
            ONE: 1
        }
    }
};

class GomokuState {
    constructor() {
        this.determineBoardSize();
        this.reset();
    }

    determineBoardSize() {
        // Mobile check: if width < 600px, use 13x13
        if (window.innerWidth < 600) {
            GomokuConstants.BOARD_SIZE = 13;
        } else {
            GomokuConstants.BOARD_SIZE = 19;
        }
    }

    _createEmptyBoard() { return Array(GomokuConstants.BOARD_SIZE).fill(null).map(() => Array(GomokuConstants.BOARD_SIZE).fill(GomokuConstants.EMPTY)); }

    reset() {
        this.determineBoardSize(); // Re-check size on reset
        this.board = this._createEmptyBoard();
        this.currentPlayer = GomokuConstants.PLAYER1;
        this.gameOver = false;
        this.winner = GomokuConstants.EMPTY;
        this.lastMove = null;
        this.isAiThinking = false;
    }

    isOnBoard(row, col) { return row >= 0 && row < GomokuConstants.BOARD_SIZE && col >= 0 && col < GomokuConstants.BOARD_SIZE; }
    cloneBoard() { return JSON.parse(JSON.stringify(this.board)); }
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

        // Dynamic Grid Sizing
        boardElement.style.gridTemplateColumns = `repeat(${GomokuConstants.BOARD_SIZE}, 1fr)`;
        boardElement.style.gridTemplateRows = `repeat(${GomokuConstants.BOARD_SIZE}, 1fr)`;

        const { gameOver, isAiThinking, currentPlayer, board, lastMove } = this.gameState;

        for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) {
            for (let c = 0; c < GomokuConstants.BOARD_SIZE; c++) {
                const intersection = document.createElement('div');
                intersection.classList.add('intersection');
                intersection.dataset.row = r;
                intersection.dataset.col = c;

                // Star Points (Hoshi)
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
        if (isAiThinking) { msg = "AI (⚪) 正在思考..."; this.messageElement.style.color = 'purple'; }
        else if (gameOver) {
            if (winner === GomokuConstants.PLAYER1) { msg = "遊戲結束：恭喜你 (⚫) 獲勝！"; this.messageElement.style.color = 'darkgreen'; }
            else if (winner === GomokuConstants.PLAYER2) { msg = "遊戲結束：AI (⚪) 獲勝！"; this.messageElement.style.color = 'darkred'; }
            else { msg = "遊戲結束：平局！"; this.messageElement.style.color = 'darkorange'; }
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
        if (gameOver || !this.gameState.isOnBoard(row, col) || board[row][col] !== GomokuConstants.EMPTY) return false;
        board[row][col] = player;
        this.gameState.lastMove = { row, col };
        if (this.checkWin(row, col, player)) { this.gameState.gameOver = true; this.gameState.winner = player; }
        else if (this.checkDraw()) { this.gameState.gameOver = true; this.gameState.winner = -1; }
        return true;
    }
    checkWin(row, col, player) {
        const { board } = this.gameState;
        const directions = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }];
        for (const { dr, dc } of directions) {
            let count = 1;
            for (let i = 1; i < 5; i++) {
                const r = row + i * dr, c = col + i * dc;
                if (this.gameState.isOnBoard(r, c) && board[r][c] === player) count++; else break;
            }
            for (let i = 1; i < 5; i++) {
                const r = row - i * dr, c = col - i * dc;
                if (this.gameState.isOnBoard(r, c) && board[r][c] === player) count++; else break;
            }
            if (count >= 5) return true;
        }
        return false;
    }
    checkDraw() {
        const { board } = this.gameState;
        for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) for (let c = 0; c < GomokuConstants.BOARD_SIZE; c++) if (board[r][c] === GomokuConstants.EMPTY) return false;
        return true;
    }
}

// --- Advanced AI Engine ---
class GomokuAIEngine {
    constructor(gameState) { this.gameState = gameState; }

    async makeMove() {
        if (this.gameState.gameOver || this.gameState.currentPlayer !== GomokuConstants.PLAYER2) return;
        this.gameState.isAiThinking = true;

        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 20));

        const bestMove = this.getBestMove();
        if (bestMove) return bestMove;
        return this.findFirstEmpty();
    }

    findFirstEmpty() {
        const { board } = this.gameState;
        const center = Math.floor(GomokuConstants.BOARD_SIZE / 2);
        if (board[center][center] === GomokuConstants.EMPTY) return { row: center, col: center };
        for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) for (let c = 0; c < GomokuConstants.BOARD_SIZE; c++) if (board[r][c] === GomokuConstants.EMPTY) return { row: r, col: c };
        return null;
    }

    getBestMove() {
        const board = this.gameState.board;
        // 1. If board is empty, play center
        if (this.isBoardEmpty(board)) {
            return { row: Math.floor(GomokuConstants.BOARD_SIZE / 2), col: Math.floor(GomokuConstants.BOARD_SIZE / 2) };
        }

        // 2. Alpha-Beta Pruning Search
        // Limit search space to neighbors of existing stones
        const candidates = this.getValidMoves(board);

        let bestScore = -Infinity;
        let bestMove = candidates[0];
        let alpha = -Infinity;
        let beta = Infinity;

        // Iterative Deepening could be added here, but for now fixed depth
        // Sort candidates by heuristic score to improve pruning
        candidates.sort((a, b) => {
            // Simple heuristic sort: closer to center or part of lines?
            // For speed, we just use a simple evaluation of the single move
            return this.evaluatePoint(board, b.row, b.col, GomokuConstants.PLAYER2) -
                this.evaluatePoint(board, a.row, a.col, GomokuConstants.PLAYER2);
        });

        // Limit candidates for performance if too many
        const topCandidates = candidates.slice(0, 20); // Only look at top 20 moves

        for (const move of topCandidates) {
            board[move.row][move.col] = GomokuConstants.PLAYER2;
            const score = this.minimax(board, GomokuConstants.AI.SEARCH_DEPTH - 1, alpha, beta, false);
            board[move.row][move.col] = GomokuConstants.EMPTY; // Undo

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
            alpha = Math.max(alpha, score);
        }

        return bestMove;
    }

    minimax(board, depth, alpha, beta, isMaximizing) {
        // Check terminal states
        const score = this.evaluateBoard(board);
        // If someone won or lost significantly, return immediately
        if (Math.abs(score) >= GomokuConstants.AI.SCORES.FIVE) return score;
        if (depth === 0) return score;

        const candidates = this.getValidMoves(board);
        // Optimization: if no candidates, draw
        if (candidates.length === 0) return 0;

        // Sort candidates (critical for pruning)
        // Heuristic: prioritize moves that have high impact
        // This sort is expensive, maybe just pick top few?
        // For depth > 1, we can just take neighbors.

        // Limit branching factor
        const limit = 12; // Reduced branching factor for deeper search
        const topCandidates = candidates.slice(0, limit);

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of topCandidates) {
                board[move.row][move.col] = GomokuConstants.PLAYER2;
                const evalScore = this.minimax(board, depth - 1, alpha, beta, false);
                board[move.row][move.col] = GomokuConstants.EMPTY;
                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of topCandidates) {
                board[move.row][move.col] = GomokuConstants.PLAYER1;
                const evalScore = this.minimax(board, depth - 1, alpha, beta, true);
                board[move.row][move.col] = GomokuConstants.EMPTY;
                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    getValidMoves(board) {
        const moves = [];
        const size = GomokuConstants.BOARD_SIZE;
        // Optimization: Use a Set for visited to avoid duplicates if we change logic
        // Only check cells with distance 1 or 2 from existing stones
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] === GomokuConstants.EMPTY) {
                    if (this.hasNeighbors(board, r, c, 1)) { // Distance 1 is usually enough for Gomoku
                        moves.push({ row: r, col: c });
                    }
                }
            }
        }
        // If board is empty (handled in getBestMove), or no neighbors (rare), return all empty
        if (moves.length === 0) {
            for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (board[r][c] === GomokuConstants.EMPTY) moves.push({ row: r, col: c });
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

    isBoardEmpty(board) {
        for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++)
            for (let c = 0; c < GomokuConstants.BOARD_SIZE; c++)
                if (board[r][c] !== GomokuConstants.EMPTY) return false;
        return true;
    }

    // --- Advanced Evaluation ---
    evaluateBoard(board) {
        let score = 0;
        // Evaluate all lines (rows, cols, diags)
        // We can optimize this by only evaluating changed lines, but full scan is safer for stateless eval

        // Horizontal
        for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) {
            score += this.evaluateLine(board[r]);
        }
        // Vertical
        for (let c = 0; c < GomokuConstants.BOARD_SIZE; c++) {
            const col = [];
            for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) col.push(board[r][c]);
            score += this.evaluateLine(col);
        }
        // Diagonals
        score += this.evaluateDiagonals(board);

        return score;
    }

    evaluateDiagonals(board) {
        let score = 0;
        const size = GomokuConstants.BOARD_SIZE;
        // Top-left to bottom-right
        for (let k = 0; k <= 2 * (size - 1); k++) {
            const diag = [];
            for (let r = 0; r < size; r++) {
                const c = k - r;
                if (c >= 0 && c < size) diag.push(board[r][c]);
            }
            if (diag.length >= 5) score += this.evaluateLine(diag);
        }
        // Top-right to bottom-left
        for (let k = 1 - size; k < size; k++) {
            const diag = [];
            for (let r = 0; r < size; r++) {
                const c = k + r;
                if (c >= 0 && c < size) diag.push(board[r][c]);
            }
            if (diag.length >= 5) score += this.evaluateLine(diag);
        }
        return score;
    }

    evaluateLine(line) {
        let score = 0;
        const len = line.length;
        // Analyze patterns for both players
        // Player 2 (AI) is maximizing, Player 1 (Human) is minimizing

        score += this.getLineScore(line, GomokuConstants.PLAYER2);
        score -= this.getLineScore(line, GomokuConstants.PLAYER1) * 1.2; // Defense is slightly more important

        return score;
    }

    getLineScore(line, player) {
        let score = 0;
        let count = 0;
        let openEnds = 0;
        let consecutive = 0;

        // We need to find consecutive stones and check their ends
        // Simple regex-like state machine

        for (let i = 0; i < line.length; i++) {
            if (line[i] === player) {
                consecutive++;
            } else if (line[i] === GomokuConstants.EMPTY) {
                if (consecutive > 0) {
                    // End of a block
                    score += this.scorePattern(consecutive, 1); // 1 open end (current)
                    // Check if previous end was open
                    // This simple logic is flawed for "Live" vs "Dead".
                    // Better approach: Look for specific patterns.
                    consecutive = 0;
                }
            } else {
                // Opponent stone
                if (consecutive > 0) {
                    score += this.scorePattern(consecutive, 0); // Blocked
                    consecutive = 0;
                }
            }
        }
        // Check last block
        if (consecutive > 0) {
            score += this.scorePattern(consecutive, 0); // Blocked by edge
        }

        // Improved Pattern Matching (Slower but accurate)
        // Convert line to string for easier matching? 
        // Or just sliding window.
        // Let's use a sliding window of size 5, 6

        return this.slidingWindowScore(line, player);
    }

    slidingWindowScore(line, player) {
        let score = 0;
        const str = line.join('');
        const p = player;
        const e = GomokuConstants.EMPTY;
        const o = (player === 1) ? 2 : 1; // Opponent

        // Patterns
        // 11111 -> 5
        // 011110 -> Live 4
        // 011112, 211110 -> Dead 4
        // 01110 -> Live 3
        // 01112, 21110 -> Dead 3

        // We can iterate and check specific shapes
        // This is a simplified version of shape detection

        let consecutive = 0;
        let openBefore = false;

        for (let i = 0; i < line.length; i++) {
            if (line[i] === player) {
                consecutive++;
            } else {
                if (consecutive > 0) {
                    const openAfter = (line[i] === GomokuConstants.EMPTY);
                    score += this.calculateShapeScore(consecutive, openBefore, openAfter);
                    consecutive = 0;
                }
                openBefore = (line[i] === GomokuConstants.EMPTY);
            }
        }
        if (consecutive > 0) {
            score += this.calculateShapeScore(consecutive, openBefore, false); // Blocked by edge
        }

        return score;
    }

    calculateShapeScore(count, openBefore, openAfter) {
        const { SCORES } = GomokuConstants.AI;
        if (count >= 5) return SCORES.FIVE;
        if (count === 4) {
            if (openBefore && openAfter) return SCORES.LIVE_FOUR;
            if (openBefore || openAfter) return SCORES.DEAD_FOUR;
            return 0;
        }
        if (count === 3) {
            if (openBefore && openAfter) return SCORES.LIVE_THREE;
            if (openBefore || openAfter) return SCORES.DEAD_THREE;
            return 0;
        }
        if (count === 2) {
            if (openBefore && openAfter) return SCORES.LIVE_TWO;
            if (openBefore || openAfter) return SCORES.DEAD_TWO;
            return 0;
        }
        return 0;
    }

    // Evaluate a single point for sorting moves
    evaluatePoint(board, r, c, player) {
        // Quick check of impact of placing a stone here
        // Just sum up the scores of lines passing through this point
        let score = 0;
        // Row
        score += this.getLineScore(board[r], player);
        // Col
        const col = []; for (let i = 0; i < GomokuConstants.BOARD_SIZE; i++) col.push(board[i][c]);
        score += this.getLineScore(col, player);
        // Diags... (skip for speed in sorting)
        return score;
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

        // Handle Resize
        window.addEventListener('resize', () => {
            // Optional: Auto-restart or just resize? 
            // Changing board size mid-game is bad. 
            // Just let it be for now, or reload on major breakpoint change.
        });
    }

    async handleCellClick(row, col) {
        if (this.gameState.gameOver || this.gameState.isAiThinking || this.gameState.currentPlayer !== GomokuConstants.PLAYER1) return;
        if (this.ruleEngine.makeMove(row, col, GomokuConstants.PLAYER1)) {
            this.renderer.renderBoard(this.handleCellClick.bind(this));
            this.renderer.updateMessage();
            if (!this.gameState.gameOver) {
                this.gameState.currentPlayer = GomokuConstants.PLAYER2;
                this.renderer.updateMessage();
                this.gameState.isAiThinking = true;
                this.renderer.renderBoard(this.handleCellClick.bind(this)); // Update cursor

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
function resetGomokuGame() { if (gomokuController) gomokuController.reset(); }
