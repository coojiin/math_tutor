// Gomoku Game Logic (MVC Pattern) - Tournament-Level AI (Alpha-Beta + VCT)

const GomokuConstants = {
    BOARD_SIZE: 19, // Dynamic
    EMPTY: 0,
    PLAYER1: 1, // Black (Human)
    PLAYER2: 2, // White (AI)
    AI: {
        TIME_LIMIT: 1000,
        WIN_SCORE: 10000000, // Lower than Infinity to allow depth preference
        SCORES: {
            FIVE: 10000000,
            LIVE_FOUR: 100000,
            DEAD_FOUR: 10000,
            LIVE_THREE: 10000,
            DEAD_THREE: 1000,
            LIVE_TWO: 100,
            DEAD_TWO: 10
        }
    }
};

// --- Zobrist Hashing ---
class ZobristHasher {
    constructor(size) {
        this.size = size;
        this.table = this.initTable(size);
    }
    initTable(size) {
        const table = [];
        for (let r = 0; r < size; r++) {
            const row = [];
            for (let c = 0; c < size; c++) {
                row.push([0n, this.random64(), this.random64()]);
            }
            table.push(row);
        }
        return table;
    }
    random64() {
        const h = BigInt(Math.floor(Math.random() * 0xFFFFFFFF));
        const l = BigInt(Math.floor(Math.random() * 0xFFFFFFFF));
        return (h << 32n) | l;
    }
    updateHash(hash, r, c, player) {
        return hash ^ this.table[r][c][player];
    }
}

// --- Transposition Table ---
class TranspositionTable {
    constructor() { this.map = new Map(); }
    store(hash, depth, score, flag, bestMove) { this.map.set(hash, { depth, score, flag, bestMove }); }
    get(hash) { return this.map.get(hash); }
    clear() { this.map.clear(); }
}
const TT_FLAGS = { EXACT: 0, LOWERBOUND: 1, UPPERBOUND: 2 };

// --- Game State ---
class GomokuState {
    constructor() {
        this.determineBoardSize();
        this.zobrist = new ZobristHasher(GomokuConstants.BOARD_SIZE);
        this.tt = new TranspositionTable();
        this.reset();
    }

    determineBoardSize() {
        GomokuConstants.BOARD_SIZE = window.innerWidth < 600 ? 13 : 19;
    }

    reset() {
        this.determineBoardSize();
        if (this.zobrist.size !== GomokuConstants.BOARD_SIZE) {
            this.zobrist = new ZobristHasher(GomokuConstants.BOARD_SIZE);
        }
        this.tt.clear();
        this.board = Array(GomokuConstants.BOARD_SIZE).fill(null).map(() => Array(GomokuConstants.BOARD_SIZE).fill(GomokuConstants.EMPTY));
        this.currentHash = 0n;
        this.currentPlayer = GomokuConstants.PLAYER1;
        this.gameOver = false;
        this.winner = GomokuConstants.EMPTY;
        this.lastMove = null;
        this.isAiThinking = false;
    }

    isOnBoard(row, col) { return row >= 0 && row < GomokuConstants.BOARD_SIZE && col >= 0 && col < GomokuConstants.BOARD_SIZE; }

    makeMove(row, col, player) {
        this.board[row][col] = player;
        this.currentHash = this.zobrist.updateHash(this.currentHash, row, col, player);
    }
    undoMove(row, col, player) {
        this.board[row][col] = GomokuConstants.EMPTY;
        this.currentHash = this.zobrist.updateHash(this.currentHash, row, col, player);
    }
}

// --- Renderer ---
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
                intersection.dataset.row = r; intersection.dataset.col = c;

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
                    intersection.style.cursor = (!gameOver && !isAiThinking && currentPlayer === GomokuConstants.PLAYER1) ? 'pointer' : 'default';
                } else {
                    const stone = document.createElement('div');
                    stone.classList.add('stone', piece === GomokuConstants.PLAYER1 ? 'black' : 'white');
                    intersection.appendChild(stone);
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
        const stars = size === 19 ? [3, 9, 15] : [3, 6, 9];
        return stars.includes(r) && stars.includes(c);
    }

    updateMessage() {
        const { isAiThinking, gameOver, winner, currentPlayer } = this.gameState;
        let msg = "";
        if (isAiThinking) { msg = "AI (⚪) 正在思考..."; this.messageElement.style.color = 'purple'; }
        else if (gameOver) {
            msg = winner === GomokuConstants.PLAYER1 ? "遊戲結束：恭喜你 (⚫) 獲勝！" : (winner === GomokuConstants.PLAYER2 ? "遊戲結束：AI (⚪) 獲勝！" : "遊戲結束：平局！");
            this.messageElement.style.color = winner === GomokuConstants.PLAYER1 ? 'darkgreen' : (winner === GomokuConstants.PLAYER2 ? 'darkred' : 'darkorange');
        } else {
            msg = currentPlayer === GomokuConstants.PLAYER1 ? "輪到你 (⚫) 下棋" : "輪到 AI (⚪) 下棋";
            this.messageElement.style.color = '#555';
        }
        this.messageElement.textContent = msg;
    }
}

// --- Rule Engine ---
class GomokuRuleEngine {
    constructor(gameState) { this.gameState = gameState; }
    makeMove(row, col, player) {
        const { board, gameOver } = this.gameState;
        if (gameOver || !this.gameState.isOnBoard(row, col) || board[row][col] !== GomokuConstants.EMPTY) return false;
        this.gameState.makeMove(row, col, player);
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
            for (let i = 1; i < 5; i++) { if (this.gameState.isOnBoard(row + i * dr, col + i * dc) && board[row + i * dr][col + i * dc] === player) count++; else break; }
            for (let i = 1; i < 5; i++) { if (this.gameState.isOnBoard(row - i * dr, col - i * dc) && board[row - i * dr][col - i * dc] === player) count++; else break; }
            if (count >= 5) return true;
        }
        return false;
    }
    checkDraw() {
        for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) for (let c = 0; c < GomokuConstants.BOARD_SIZE; c++) if (this.gameState.board[r][c] === GomokuConstants.EMPTY) return false;
        return true;
    }
}

// --- Tournament-Level AI Engine ---
class GomokuAIEngine {
    constructor(gameState) {
        this.gameState = gameState;
        this.initPositionalWeights();
    }

    initPositionalWeights() {
        this.posWeights = [];
        const size = GomokuConstants.BOARD_SIZE;
        const center = (size - 1) / 2;
        for (let r = 0; r < size; r++) {
            const row = [];
            for (let c = 0; c < size; c++) {
                const dist = Math.sqrt(Math.pow(r - center, 2) + Math.pow(c - center, 2));
                const maxDist = Math.sqrt(Math.pow(center, 2) + Math.pow(center, 2));
                row.push(Math.max(0, 7 - (dist / maxDist) * 7));
            }
            this.posWeights.push(row);
        }
    }

    async makeMove() {
        if (this.gameState.gameOver || this.gameState.currentPlayer !== GomokuConstants.PLAYER2) return;
        this.gameState.isAiThinking = true;
        await new Promise(resolve => setTimeout(resolve, 20));

        // 1. VCT Search (Victory by Continuous Threats)
        // Look for forced wins first.
        const vctMove = this.vctSearch();
        if (vctMove) {
            console.log("VCT Found!", vctMove);
            return vctMove;
        }

        // 2. Alpha-Beta Search
        const bestMove = this.iterativeDeepening();
        return bestMove;
    }

    // --- VCT Search ---
    // Simplified VCT: Look for Win in 1, Block Win in 1, Win in 3 (Live 4), Block Win in 3
    vctSearch() {
        const board = this.gameState.board;
        const ai = GomokuConstants.PLAYER2;
        const human = GomokuConstants.PLAYER1;

        // 1. Check AI Win (5)
        let move = this.findPattern(board, ai, "11111");
        if (move) return move;

        // 2. Check Block Human Win (5)
        move = this.findPattern(board, human, "11111");
        if (move) return move;

        // 3. Check AI Live 4 (Unstoppable)
        move = this.findPattern(board, ai, "011110");
        if (move) return move;

        // 4. Check Block Human Live 4 (Unstoppable)
        move = this.findPattern(board, human, "011110");
        if (move) return move;

        // 5. Check AI Dead 4 (Forcing Move) -> Can lead to win?
        // For full VCT, we would recurse here. For now, we prioritize making Dead 4 if it's safe.
        // But simply making Dead 4 isn't always good.

        // 6. Check Block Human Dead 4 (Forced Defense)
        // If human has Dead 4 (e.g. 011112), we MUST block.
        // Dead 4 patterns: 011112, 211110, 10111, 11011, 11101
        move = this.findDead4Block(board, human);
        if (move) return move;

        // 7. Check Block Human Live 3 (Becomes Live 4)
        move = this.findPattern(board, human, "01110");
        if (move) return move;
        move = this.findPattern(board, human, "010110");
        if (move) return move;
        move = this.findPattern(board, human, "011010");
        if (move) return move;

        return null;
    }

    findPattern(board, player, patternStr) {
        // patternStr example: "011110" where 1=player, 0=empty
        // We need to find a place to put '1' that completes the pattern?
        // No, findPattern checks if the pattern exists *potentially* or *imminently*.
        // Actually, for "Win in 1", we look for "1111" and an empty spot.

        // Helper: Check all empty spots. If placing stone creates pattern, return spot.
        const candidates = this.getNeighbors(board, 1);
        for (const move of candidates) {
            board[move.row][move.col] = player;
            if (this.checkPatternCreated(board, move.row, move.col, player, patternStr)) {
                board[move.row][move.col] = GomokuConstants.EMPTY;
                return move;
            }
            board[move.row][move.col] = GomokuConstants.EMPTY;
        }
        return null;
    }

    findDead4Block(board, player) {
        // Check if opponent has Dead 4. If so, return the blocking move.
        // Dead 4 means opponent has 4 stones and 1 empty spot to make 5.
        // We simulate opponent placing stone. If they get 5, we must block there.
        const candidates = this.getNeighbors(board, 1);
        for (const move of candidates) {
            board[move.row][move.col] = player; // Opponent moves
            if (this.checkWin(board, move.row, move.col, player)) {
                board[move.row][move.col] = GomokuConstants.EMPTY;
                return move; // We must take this spot
            }
            board[move.row][move.col] = GomokuConstants.EMPTY;
        }
        return null;
    }

    checkPatternCreated(board, r, c, player, patternStr) {
        // Check 4 directions
        const directions = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }];
        // Convert patternStr to regex. 1->x, 0->_, 2->o
        // But here patternStr uses 1 for player, 0 for empty.
        // Let's standardize: 'x' = player, '_' = empty, 'o' = opponent.

        // The input patternStr is like "011110" (Live 4).
        // This means: Empty, Player, Player, Player, Player, Empty.
        // We just placed a stone at r,c. We check if the line containing r,c matches.

        let targetRegex = patternStr.replace(/1/g, 'x').replace(/0/g, '_');

        for (const { dr, dc } of directions) {
            const line = this.getLineString(board, r, c, dr, dc, player);
            if (line.includes(targetRegex)) return true;
        }
        return false;
    }

    checkWin(board, row, col, player) {
        const directions = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }];
        for (const { dr, dc } of directions) {
            let count = 1;
            for (let i = 1; i < 5; i++) { if (this.gameState.isOnBoard(row + i * dr, col + i * dc) && board[row + i * dr][col + i * dc] === player) count++; else break; }
            for (let i = 1; i < 5; i++) { if (this.gameState.isOnBoard(row - i * dr, col - i * dc) && board[row - i * dr][col - i * dc] === player) count++; else break; }
            if (count >= 5) return true;
        }
        return false;
    }

    getLineString(board, r, c, dr, dc, player) {
        let str = "";
        for (let i = -4; i <= 4; i++) {
            const nr = r + i * dr;
            const nc = c + i * dc;
            if (!this.gameState.isOnBoard(nr, nc)) {
                str += "|";
            } else {
                const p = board[nr][nc];
                if (p === player) str += "x";
                else if (p === GomokuConstants.EMPTY) str += "_";
                else str += "o";
            }
        }
        return str;
    }

    // --- Alpha-Beta Search ---
    iterativeDeepening() {
        const board = this.gameState.board;
        if (this.isBoardEmpty(board)) return { row: Math.floor(GomokuConstants.BOARD_SIZE / 2), col: Math.floor(GomokuConstants.BOARD_SIZE / 2) };

        const startTime = Date.now();
        let bestMove = null;
        let depth = 1;
        const maxDepth = 10;

        let candidates = this.getNeighbors(board, 1);
        // Initial Sort
        candidates.sort((a, b) => this.evaluatePoint(board, b.row, b.col, GomokuConstants.PLAYER2) - this.evaluatePoint(board, a.row, a.col, GomokuConstants.PLAYER2));
        candidates = candidates || [];
        if (candidates.length === 0) return null;

        while (depth <= maxDepth) {
            if (Date.now() - startTime > GomokuConstants.AI.TIME_LIMIT) break;

            let alpha = -Infinity;
            let beta = Infinity;
            let currentBestMove = null;
            let currentBestScore = -Infinity;

            for (const move of candidates) {
                this.gameState.makeMove(move.row, move.col, GomokuConstants.PLAYER2);
                const score = -this.minimax(depth - 1, -beta, -alpha, GomokuConstants.PLAYER1, startTime);
                this.gameState.undoMove(move.row, move.col, GomokuConstants.PLAYER2);

                if (score > currentBestScore) {
                    currentBestScore = score;
                    currentBestMove = move;
                }
                alpha = Math.max(alpha, score);
                if (Date.now() - startTime > GomokuConstants.AI.TIME_LIMIT) break;
            }

            if (Date.now() - startTime <= GomokuConstants.AI.TIME_LIMIT) {
                bestMove = currentBestMove;
                // If found winning move, stop
                if (currentBestScore >= GomokuConstants.AI.SCORES.WIN_SCORE) break;
            } else {
                if (!bestMove) bestMove = currentBestMove;
                break;
            }
            depth++;
        }
        return bestMove || candidates[0];
    }

    minimax(depth, alpha, beta, player, startTime) {
        if ((Date.now() - startTime) > GomokuConstants.AI.TIME_LIMIT) return 0;

        const hash = this.gameState.currentHash;
        const ttEntry = this.gameState.tt.get(hash);
        if (ttEntry && ttEntry.depth >= depth) {
            if (ttEntry.flag === TT_FLAGS.EXACT) return ttEntry.score;
            if (ttEntry.flag === TT_FLAGS.LOWERBOUND) alpha = Math.max(alpha, ttEntry.score);
            if (ttEntry.flag === TT_FLAGS.UPPERBOUND) beta = Math.min(beta, ttEntry.score);
            if (alpha >= beta) return ttEntry.score;
        }

        if (depth === 0) {
            // Static Evaluation from current player's perspective
            const score = this.evaluateBoard(this.gameState.board, player);
            return score;
        }

        const candidates = this.getNeighbors(this.gameState.board, 1);
        if (candidates.length === 0) return this.evaluateBoard(this.gameState.board, player);

        // Move Ordering (Killer Heuristic - use TT best move)
        if (ttEntry && ttEntry.bestMove) {
            // Sort to put bestMove first (simplified)
        }

        let bestScore = -Infinity;
        let bestMove = null;
        let flag = TT_FLAGS.UPPERBOUND;

        for (const move of candidates) {
            this.gameState.makeMove(move.row, move.col, player);
            const nextPlayer = player === GomokuConstants.PLAYER1 ? GomokuConstants.PLAYER2 : GomokuConstants.PLAYER1;
            const val = -this.minimax(depth - 1, -beta, -alpha, nextPlayer, startTime);
            this.gameState.undoMove(move.row, move.col, player);

            if (val > bestScore) {
                bestScore = val;
                bestMove = move;
            }
            alpha = Math.max(alpha, val);
            if (alpha >= beta) {
                flag = TT_FLAGS.LOWERBOUND;
                break; // Beta Cutoff
            }
        }

        this.gameState.tt.store(hash, depth, bestScore, flag, bestMove);
        return bestScore;
    }

    evaluateBoard(board, player) {
        // Evaluate from 'player' perspective
        // Score = MyPatterns - OpponentPatterns
        const opponent = player === GomokuConstants.PLAYER1 ? GomokuConstants.PLAYER2 : GomokuConstants.PLAYER1;

        let myScore = 0;
        let opScore = 0;

        // Scan all lines
        const lines = this.getAllLines(board);
        for (const line of lines) {
            myScore += this.getLineScore(line, player);
            opScore += this.getLineScore(line, opponent);
        }

        // Positional
        for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) {
            for (let c = 0; c < GomokuConstants.BOARD_SIZE; c++) {
                if (board[r][c] === player) myScore += this.posWeights[r][c];
                else if (board[r][c] === opponent) opScore += this.posWeights[r][c];
            }
        }

        // Attack/Defense Ratio
        // If it's my turn, Attack is valuable. But Defense is critical if opponent is strong.
        // Standard: Score = My - Opponent * 1.2
        return myScore - opScore * 1.2;
    }

    getLineScore(line, player) {
        // String matching for patterns
        let str = "";
        for (let i = 0; i < line.length; i++) {
            if (line[i] === player) str += "x";
            else if (line[i] === GomokuConstants.EMPTY) str += "_";
            else str += "o";
        }

        let score = 0;
        const S = GomokuConstants.AI.SCORES;

        if (str.includes("xxxxx")) return S.FIVE;
        if (str.includes("_xxxx_")) score += S.LIVE_FOUR;
        if (str.includes("oxxxx_") || str.includes("_xxxxo") || str.includes("x_xxx") || str.includes("xxx_x") || str.includes("xx_xx")) score += S.DEAD_FOUR;
        if (str.includes("_xxx_") || str.includes("_x_xx_") || str.includes("_xx_x_")) score += S.LIVE_THREE;
        if (str.includes("oxxx_") || str.includes("_xxxo")) score += S.DEAD_THREE; // Less valuable
        if (str.includes("_xx_") || str.includes("_x_x_") || str.includes("_xx_")) score += S.LIVE_TWO;

        return score;
    }

    getAllLines(board) {
        const lines = [];
        const size = GomokuConstants.BOARD_SIZE;
        for (let i = 0; i < size; i++) {
            lines.push(board[i]);
            const col = []; for (let r = 0; r < size; r++) col.push(board[r][i]);
            lines.push(col);
        }
        for (let k = 0; k <= 2 * (size - 1); k++) {
            const diag1 = [];
            for (let r = 0; r < size; r++) {
                const c = k - r;
                if (c >= 0 && c < size) diag1.push(board[r][c]);
            }
            if (diag1.length >= 5) lines.push(diag1);
        }
        for (let k = 1 - size; k < size; k++) {
            const diag2 = [];
            for (let r = 0; r < size; r++) {
                const c = k + r;
                if (c >= 0 && c < size) diag2.push(board[r][c]);
            }
            if (diag2.length >= 5) lines.push(diag2);
        }
        return lines;
    }

    getNeighbors(board, distance) {
        const moves = [];
        const size = GomokuConstants.BOARD_SIZE;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] === GomokuConstants.EMPTY) {
                    if (this.hasNeighbors(board, r, c, distance)) {
                        moves.push({ row: r, col: c });
                    }
                }
            }
        }
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
        for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) for (let c = 0; c < GomokuConstants.BOARD_SIZE; c++) if (board[r][c] !== GomokuConstants.EMPTY) return false;
        return true;
    }

    evaluatePoint(board, r, c, player) {
        // Simple heuristic for sorting
        let score = 0;
        score += this.posWeights[r][c];
        return score;
    }
}

// --- Controller ---
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
function initGomokuGame() { if (!gomokuController) gomokuController = new GomokuController(); }
function resetGomokuGame() { if (gomokuController) gomokuController.reset(); }
