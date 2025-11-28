// Gomoku Game Logic (MVC Pattern) - Tournament-Level AI (Alpha-Beta + VCT + Double Threat Detection)

const GomokuConstants = {
    BOARD_SIZE: 19, // Dynamic
    EMPTY: 0,
    PLAYER1: 1, // Black (Human)
    PLAYER2: 2, // White (AI)
    AI: {
        TIME_LIMIT: 1000,
        WIN_SCORE: 100000000, // 100M (Absolute Win)
        VIRTUAL_WIN: 5000000, // 5M (Unstoppable: 3-3, 4-3, 4-4)
        SCORES: {
            FIVE: 100000000,
            LIVE_FOUR: 10000000, // Guaranteed Win
            DOUBLE_THREAT: 5000000, // 3-3, 4-3, 4-4
            LIVE_THREE: 50000,   // User Request: Live 3 > Rush 4
            DEAD_FOUR: 10000,    // Rush 4
            LIVE_TWO: 5000,
            DEAD_THREE: 1000,
            DEAD_TWO: 100
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

        // 5. Check Block Human Dead 4 (Forced Defense)
        move = this.findDead4Block(board, human);
        if (move) return move;

        // 6. Check Block Human Live 3 (Becomes Live 4)
        move = this.findPattern(board, human, "01110");
        if (move) return move;
        move = this.findPattern(board, human, "010110");
        if (move) return move;
        move = this.findPattern(board, human, "011010");
        if (move) return move;

        return null;
    }

    findPattern(board, player, patternStr) {
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
        const directions = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }];
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
                if (currentBestScore >= GomokuConstants.AI.SCORES.WIN_SCORE / 2) break; // Found winning path
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
            return this.evaluateBoard(this.gameState.board, player);
        }

        const candidates = this.getNeighbors(this.gameState.board, 1);
        if (candidates.length === 0) return this.evaluateBoard(this.gameState.board, player);

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
                break;
            }
        }

        this.gameState.tt.store(hash, depth, bestScore, flag, bestMove);
        return bestScore;
    }

    evaluateBoard(board, player) {
        const opponent = player === GomokuConstants.PLAYER1 ? GomokuConstants.PLAYER2 : GomokuConstants.PLAYER1;

        const myPatterns = this.countPatterns(board, player);
        const opPatterns = this.countPatterns(board, opponent);

        let myScore = this.calculateScoreFromPatterns(myPatterns);
        let opScore = this.calculateScoreFromPatterns(opPatterns);

        // Positional
        for (let r = 0; r < GomokuConstants.BOARD_SIZE; r++) {
            for (let c = 0; c < GomokuConstants.BOARD_SIZE; c++) {
                if (board[r][c] === player) myScore += this.posWeights[r][c];
                else if (board[r][c] === opponent) opScore += this.posWeights[r][c];
            }
        }

        return myScore - opScore * 1.2;
    }

    countPatterns(board, player) {
        const counts = {
            five: 0,
            live4: 0,
            dead4: 0,
            live3: 0,
            dead3: 0,
            live2: 0
        };

        const lines = this.getAllLines(board);
        for (const line of lines) {
            const p = this.getLinePatterns(line, player);
            counts.five += p.five;
            counts.live4 += p.live4;
            counts.dead4 += p.dead4;
            counts.live3 += p.live3;
            counts.dead3 += p.dead3;
            counts.live2 += p.live2;
        }
        return counts;
    }

    getLinePatterns(line, player) {
        let str = "";
        for (let i = 0; i < line.length; i++) {
            if (line[i] === player) str += "x";
            else if (line[i] === GomokuConstants.EMPTY) str += "_";
            else str += "o";
        }

        const counts = { five: 0, live4: 0, dead4: 0, live3: 0, dead3: 0, live2: 0 };

        if (str.includes("xxxxx")) counts.five++;
        if (str.includes("_xxxx_")) counts.live4++;
        if (str.includes("oxxxx_") || str.includes("_xxxxo") || str.includes("x_xxx") || str.includes("xxx_x") || str.includes("xx_xx")) counts.dead4++;
        if (str.includes("_xxx_") || str.includes("_x_xx_") || str.includes("_xx_x_")) counts.live3++;
        if (str.includes("oxxx_") || str.includes("_xxxo")) counts.dead3++;
        if (str.includes("_xx_") || str.includes("_x_x_")) counts.live2++;

        return counts;
    }

    calculateScoreFromPatterns(counts) {
        const S = GomokuConstants.AI.SCORES;
        let score = 0;

        if (counts.five > 0) return S.FIVE;

        // Explicit Double Threat Detection
        // 4-4, 4-3, 3-3 are Virtual Wins
        const isDoubleThreat = (counts.live4 >= 1) || (counts.dead4 >= 2) || (counts.dead4 >= 1 && counts.live3 >= 1) || (counts.live3 >= 2);

        if (isDoubleThreat) score += GomokuConstants.AI.VIRTUAL_WIN;

        score += counts.live4 * S.LIVE_FOUR;
        score += counts.dead4 * S.DEAD_FOUR;
        score += counts.live3 * S.LIVE_THREE;
        score += counts.dead3 * S.DEAD_THREE;
        score += counts.live2 * S.LIVE_TWO;

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
