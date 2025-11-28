// Gomoku Game Logic (MVC Pattern)

const GomokuConstants = {
    BOARD_SIZE: 19, // Standard 19x19
    EMPTY: 0,
    PLAYER1: 1, // Black (Human)
    PLAYER2: 2, // White (AI)
    AI: {
        SEARCH_DEPTH: 3, // Depth 3 is reasonable for JS
        WIN_SCORE: 100000,
        PATTERN_SCORES: { FIVE: 100000, LONG_CONNECT: 0, LIVE_FOUR: 10000, DEAD_FOUR: 800, LIVE_THREE: 800, DEAD_THREE: 100, LIVE_TWO: 100, DEAD_TWO: 10, LIVE_ONE: 10, DEAD_ONE: 1 }
    }
};

class GomokuState {
    constructor() { this.reset(); }
    _createEmptyBoard() { return Array(GomokuConstants.BOARD_SIZE).fill(null).map(() => Array(GomokuConstants.BOARD_SIZE).fill(GomokuConstants.EMPTY)); }
    reset() {
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

        // Render Intersections
        const { gameOver, isAiThinking, currentPlayer, board, lastMove } = this.gameState;

        for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) {
            for (let c = 0; c < GomokuConstants.BOARD_SIZE; c++) {
                const intersection = document.createElement('div');
                intersection.classList.add('intersection');
                intersection.dataset.row = r;
                intersection.dataset.col = c;

                // Star Points (Hoshi) for 19x19
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
        // Standard Star Points for 19x19: (3,3), (3,9), (3,15), (9,3), (9,9), (9,15), (15,3), (15,9), (15,15)
        // Indices are 0-based, so: 3, 9, 15
        const stars = [3, 9, 15];
        return stars.includes(r) && stars.includes(c);
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

class GomokuAIEngine {
    constructor(gameState) { this.gameState = gameState; }
    async makeMove() {
        if (this.gameState.gameOver || this.gameState.currentPlayer !== GomokuConstants.PLAYER2) return;
        this.gameState.isAiThinking = true;
        await new Promise(resolve => setTimeout(resolve, 50)); // UI update
        const bestMove = this.getBestMove();
        if (bestMove) return bestMove;
        return this.findFirstEmpty();
    }
    findFirstEmpty() {
        const { board } = this.gameState;
        // Start from center for better first moves if fallback needed
        const center = Math.floor(GomokuConstants.BOARD_SIZE / 2);
        if (board[center][center] === GomokuConstants.EMPTY) return { row: center, col: center };

        for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) for (let c = 0; c < GomokuConstants.BOARD_SIZE; c++) if (board[r][c] === GomokuConstants.EMPTY) return { row: r, col: c };
        return null;
    }
    getBestMove() {
        const currentBoard = this.gameState.cloneBoard();
        if (this.isBoardEmpty(currentBoard)) return { row: Math.floor(GomokuConstants.BOARD_SIZE / 2), col: Math.floor(GomokuConstants.BOARD_SIZE / 2) };

        let bestScore = -Infinity, bestMove = null;
        const moves = this.getValidMoves(currentBoard);

        // Limit moves for performance on 19x19 if too many
        // For 19x19, we must be careful with branching factor. 
        // getValidMoves already filters to neighbors, which is good.

        let alpha = -Infinity, beta = Infinity;
        for (const move of moves) {
            const boardCopy = JSON.parse(JSON.stringify(currentBoard));
            boardCopy[move.row][move.col] = GomokuConstants.PLAYER2;
            const score = this.minimax(boardCopy, GomokuConstants.AI.SEARCH_DEPTH - 1, alpha, beta, false);
            if (score > bestScore) { bestScore = score; bestMove = move; }
            alpha = Math.max(alpha, score);
        }
        return bestMove;
    }
    minimax(board, depth, alpha, beta, isMaximizingPlayer) {
        const winner = this.checkWinner(board);
        if (winner === GomokuConstants.PLAYER2) return GomokuConstants.AI.WIN_SCORE + depth;
        if (winner === GomokuConstants.PLAYER1) return -GomokuConstants.AI.WIN_SCORE - depth;
        if (this.isBoardFull(board)) return 0;
        if (depth === 0) return this.evaluateBoard(board);

        const validMoves = this.getValidMoves(board);
        // Performance optimization: Limit valid moves in deeper recursion if needed

        if (isMaximizingPlayer) {
            let maxEval = -Infinity;
            for (const move of validMoves) {
                const boardCopy = JSON.parse(JSON.stringify(board));
                boardCopy[move.row][move.col] = GomokuConstants.PLAYER2;
                const score = this.minimax(boardCopy, depth - 1, alpha, beta, false);
                maxEval = Math.max(maxEval, score);
                alpha = Math.max(alpha, score);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of validMoves) {
                const boardCopy = JSON.parse(JSON.stringify(board));
                boardCopy[move.row][move.col] = GomokuConstants.PLAYER1;
                const score = this.minimax(boardCopy, depth - 1, alpha, beta, true);
                minEval = Math.min(minEval, score);
                beta = Math.min(beta, score);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }
    checkWinner(board) {
        const rule = new GomokuRuleEngine({ board, isOnBoard: this.gameState.isOnBoard.bind(this.gameState) });
        // Optimization: Only check around occupied cells? 
        // For now, full scan is safe but slow. 
        // Better: Pass last move to checkWinner? 
        // Since we copy board, we lose last move context easily unless passed.
        // We'll stick to full scan for correctness but it might be slow on 19x19.
        // To optimize: Only check non-empty cells.
        for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) {
            for (let c = 0; c < GomokuConstants.BOARD_SIZE; c++) {
                if (board[r][c] !== GomokuConstants.EMPTY) {
                    if (rule.checkWin(r, c, board[r][c])) return board[r][c];
                }
            }
        }
        return GomokuConstants.EMPTY;
    }
    isBoardEmpty(board) { for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) for (let c = 0; c < GomokuConstants.BOARD_SIZE; c++) if (board[r][c] !== GomokuConstants.EMPTY) return false; return true; }
    isBoardFull(board) { for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) for (let c = 0; c < GomokuConstants.BOARD_SIZE; c++) if (board[r][c] === GomokuConstants.EMPTY) return false; return true; }
    getValidMoves(board) {
        const moves = [];
        if (this.isBoardEmpty(board)) return [{ row: Math.floor(GomokuConstants.BOARD_SIZE / 2), col: Math.floor(GomokuConstants.BOARD_SIZE / 2) }];

        // Heuristic: Only consider moves near existing stones (distance 1 or 2)
        for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) {
            for (let c = 0; c < GomokuConstants.BOARD_SIZE; c++) {
                if (board[r][c] === GomokuConstants.EMPTY && this.hasNeighbors(board, r, c, 2)) {
                    moves.push({ row: r, col: c });
                }
            }
        }

        // Fallback if no moves found (shouldn't happen unless empty or full)
        if (moves.length === 0 && !this.isBoardFull(board)) {
            for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) for (let c = 0; c < GomokuConstants.BOARD_SIZE; c++) if (board[r][c] === GomokuConstants.EMPTY) moves.push({ row: r, col: c });
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
    evaluateBoard(board) {
        let aiScore = 0, humanScore = 0;
        const lines = this.getAllLines(board);
        for (const line of lines) {
            aiScore += this.evaluateLine(line, GomokuConstants.PLAYER2);
            humanScore += this.evaluateLine(line, GomokuConstants.PLAYER1);
        }
        return aiScore - humanScore;
    }
    getAllLines(board) {
        const lines = [];
        // Rows
        for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) lines.push(board[r]);
        // Cols
        for (let c = 0; c < GomokuConstants.BOARD_SIZE; c++) lines.push(board.map(row => row[c]));
        // Diagonals
        // Optimization: Only diagonals with length >= 5
        for (let k = 0; k <= 2 * (GomokuConstants.BOARD_SIZE - 1); k++) {
            const diag = [];
            for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) {
                const c = k - r;
                if (c >= 0 && c < GomokuConstants.BOARD_SIZE) diag.push(board[r][c]);
            }
            if (diag.length >= 5) lines.push(diag);
        }
        for (let k = 1 - GomokuConstants.BOARD_SIZE; k < GomokuConstants.BOARD_SIZE; k++) {
            const diag = [];
            for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) {
                const c = k + r;
                if (c >= 0 && c < GomokuConstants.BOARD_SIZE) diag.push(board[r][c]);
            }
            if (diag.length >= 5) lines.push(diag);
        }
        return lines;
    }
    evaluateLine(line, player) {
        let score = 0, len = line.length;
        for (let i = 0; i < len; i++) {
            if (line[i] === player) {
                let count = 0, openEnds = 0, k = i;
                while (k < len && line[k] === player) { count++; k++; }
                if (i > 0 && line[i - 1] === GomokuConstants.EMPTY) openEnds++;
                if (k < len && line[k] === GomokuConstants.EMPTY) openEnds++;
                const { PATTERN_SCORES } = GomokuConstants.AI;
                if (count >= 5) score += PATTERN_SCORES.FIVE;
                else if (count === 4) score += (openEnds === 2 ? PATTERN_SCORES.LIVE_FOUR : (openEnds === 1 ? PATTERN_SCORES.DEAD_FOUR : 0));
                else if (count === 3) score += (openEnds === 2 ? PATTERN_SCORES.LIVE_THREE : (openEnds === 1 ? PATTERN_SCORES.DEAD_THREE : 0));
                else if (count === 2) score += (openEnds === 2 ? PATTERN_SCORES.LIVE_TWO : (openEnds === 1 ? PATTERN_SCORES.DEAD_TWO : 0));
                else if (count === 1) score += (openEnds === 2 ? PATTERN_SCORES.LIVE_ONE : (openEnds === 1 ? PATTERN_SCORES.DEAD_ONE : 0));
                i = k - 1;
            }
        }
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

                // Allow UI to render before AI starts blocking
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
