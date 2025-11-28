// 採用模組化設計，將代碼分為多個關注點

// 遊戲常量模組
const GameConstants = {
    BOARD_SIZE: 15,
    CELL_SIZE: 35,
    EMPTY: 0,
    PLAYER1: 1, // 黑棋 (人類玩家)
    PLAYER2: 2, // 白棋 (AI)
    MODES: { GOBANG: 'gobang', GO: 'go' },
    
    // AI評分常量
    AI: {
        SEARCH_DEPTH: 3,
        WIN_SCORE: 100000,
        PATTERN_SCORES: {
            FIVE: 100000,           // 五連勝
            LONG_CONNECT: 0,        // 長連（不算勝）
            LIVE_FOUR: 10000,       // 活四
            DEAD_FOUR: 800,         // 死四
            LIVE_THREE: 800,        // 活三
            DEAD_THREE: 100,        // 死三
            LIVE_TWO: 100,          // 活二
            DEAD_TWO: 10,           // 死二
            LIVE_ONE: 10,           // 活一
            DEAD_ONE: 1             // 死一
        }
    }
};

// 遊戲狀態管理器
class GameState {
    constructor() {
        this.board = this._createEmptyBoard();
        this.currentPlayer = GameConstants.PLAYER1;
        this.gameOver = true;
        this.winner = GameConstants.EMPTY;
        this.lastMove = null;
        this.gameMode = GameConstants.MODES.GOBANG;
        this.passCount = 0;
        this.capturedStones = { 
            [GameConstants.PLAYER1]: 0, 
            [GameConstants.PLAYER2]: 0 
        };
        this.isAiThinking = false;
    }
    
    _createEmptyBoard() {
        return Array(GameConstants.BOARD_SIZE).fill(null)
            .map(() => Array(GameConstants.BOARD_SIZE).fill(GameConstants.EMPTY));
    }
    
    reset() {
        this.board = this._createEmptyBoard();
        this.currentPlayer = GameConstants.PLAYER1;
        this.gameOver = false;
        this.winner = GameConstants.EMPTY;
        this.lastMove = null;
        this.isAiThinking = false;
        this.passCount = 0;
        this.capturedStones = { 
            [GameConstants.PLAYER1]: 0, 
            [GameConstants.PLAYER2]: 0 
        };
    }
    
    switchPlayer() {
        this.currentPlayer = (this.currentPlayer === GameConstants.PLAYER1) 
            ? GameConstants.PLAYER2 
            : GameConstants.PLAYER1;
        console.log(`切換玩家，現在是 ${this.currentPlayer === GameConstants.PLAYER1 ? "人類" : "AI"} 回合`);
    }
    
    isOnBoard(row, col) {
        return row >= 0 && row < GameConstants.BOARD_SIZE && 
               col >= 0 && col < GameConstants.BOARD_SIZE;
    }
    
    // 用於深拷貝棋盤狀態
    cloneBoard() {
        return JSON.parse(JSON.stringify(this.board));
    }
}

// 棋盤渲染器
class BoardRenderer {
    constructor(gameState, uiElements) {
        this.gameState = gameState;
        this.elements = uiElements;
    }
    
    renderBoard(cellClickHandler) {
        console.log(`渲染棋盤: 遊戲結束=${this.gameState.gameOver}, AI思考中=${this.gameState.isAiThinking}, 當前玩家=${this.gameState.currentPlayer}`);
        
        const boardElement = this.elements.boardElement;
        boardElement.innerHTML = '';
        boardElement.style.width = `${GameConstants.BOARD_SIZE * GameConstants.CELL_SIZE}px`;
        boardElement.style.height = `${GameConstants.BOARD_SIZE * GameConstants.CELL_SIZE}px`;
        boardElement.style.gridTemplateColumns = `repeat(${GameConstants.BOARD_SIZE}, ${GameConstants.CELL_SIZE}px)`;
        boardElement.style.gridTemplateRows = `repeat(${GameConstants.BOARD_SIZE}, ${GameConstants.CELL_SIZE}px)`;
        
        const { gameOver, isAiThinking, currentPlayer, board, lastMove } = this.gameState;
        
        for (let r = 0; r < GameConstants.BOARD_SIZE; r++) {
            for (let c = 0; c < GameConstants.BOARD_SIZE; c++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = r;
                cell.dataset.col = c;
                cell.style.width = `${GameConstants.CELL_SIZE}px`;
                cell.style.height = `${GameConstants.CELL_SIZE}px`;
                
                const piece = board[r][c];
                if (piece === GameConstants.EMPTY) {
                    cell.classList.add('empty');
                    
                    // 添加點擊事件處理
                    cell.addEventListener('click', cellClickHandler);
                    
                    if (!gameOver && !isAiThinking && currentPlayer === GameConstants.PLAYER1) {
                        cell.style.cursor = 'pointer';
                    } else if (isAiThinking) {
                        cell.style.cursor = 'wait';
                        cell.classList.add('thinking');
                    } else {
                        cell.style.cursor = 'default';
                    }
                } else {
                    const stone = document.createElement('div');
                    stone.classList.add('stone');
                    stone.classList.add(piece === GameConstants.PLAYER1 ? 'black' : 'white');
                    cell.appendChild(stone);
                    cell.style.cursor = 'default';
                }
                
                if (lastMove && lastMove.row === r && lastMove.col === c) {
                    cell.classList.add('last-move');
                } else {
                    cell.classList.remove('last-move');
                }
                
                boardElement.appendChild(cell);
            }
        }
    }
    
    updateMessage() {
        const { isAiThinking, gameOver, winner, currentPlayer, gameMode, passCount } = this.gameState;
        const messageElement = this.elements.messageElement;
        
        let msg = "";
        if (isAiThinking) {
            msg = "AI (⚪) 正在思考...";
            messageElement.style.color = 'purple';
        } else if (gameOver) {
            if (winner === GameConstants.PLAYER1) {
                msg = `遊戲結束：恭喜你 (⚫) 獲勝！`;
                messageElement.style.color = 'darkgreen';
            } else if (winner === GameConstants.PLAYER2) {
                msg = `遊戲結束：AI (⚪) 獲勝！`;
                messageElement.style.color = 'darkred';
            } else if (winner === -1) {
                if (gameMode === GameConstants.MODES.GOBANG) msg = "遊戲結束：平局！";
                else msg = "遊戲結束：雙方連續 Pass";
                messageElement.style.color = 'darkorange';
            } else {
                msg = "選擇模式開始新遊戲";
                messageElement.style.color = '#555';
            }
        } else {
            const playerText = currentPlayer === GameConstants.PLAYER1 ? '你 (⚫)' : 'AI (⚪)';
            msg = `輪到 ${playerText} 下棋`;
            messageElement.style.color = '#555';
            if (gameMode === GameConstants.MODES.GO && passCount > 0) {
                msg += ` (一方已 Pass)`;
            }
        }
        messageElement.textContent = msg;
    }
    
    updateGoUI() {
        const { gameMode, gameOver, isAiThinking } = this.gameState;
        const { goInfoElement, passButton } = this.elements;
        
        goInfoElement.style.display = (gameMode === GameConstants.MODES.GO) ? 'flex' : 'none';
        passButton.style.display = (gameMode === GameConstants.MODES.GO) ? 'inline-block' : 'none';
        passButton.disabled = (gameMode !== GameConstants.MODES.GO) || gameOver || isAiThinking;
    }
    
    updateCapturedStonesDisplay() {
        const { capturedStones } = this.gameState;
        const { capturedP1Element, capturedP2Element } = this.elements;
        
        capturedP1Element.textContent = capturedStones[GameConstants.PLAYER1];
        capturedP2Element.textContent = capturedStones[GameConstants.PLAYER2];
    }
    
    updateBoardState(disabled) {
        const { resetButton, passButton, gobangModeBtn, goModeBtn, boardElement } = this.elements;
        const { gameMode } = this.gameState;
        
        console.log(`${disabled ? "禁用" : "啟用"}棋盤, isAiThinking設為 ${disabled}`);
        this.gameState.isAiThinking = disabled;
        
        const thinkingCursor = disabled ? 'wait' : 'default';
        boardElement.style.cursor = thinkingCursor;
        resetButton.disabled = disabled;
        passButton.disabled = disabled || (gameMode !== GameConstants.MODES.GO);
        gobangModeBtn.disabled = disabled;
        goModeBtn.disabled = disabled;
        
        this.renderBoard();
        this.updateMessage();
    }
}

// 五子棋規則引擎
class GobangRuleEngine {
    constructor(gameState) {
        this.gameState = gameState;
    }
    
    makeMove(row, col, player) {
        const { board, gameOver } = this.gameState;
        
        if (gameOver || !this.gameState.isOnBoard(row, col) || board[row][col] !== GameConstants.EMPTY) {
            console.log(`落子失敗: gameOver=${gameOver}, 位置狀態=${board[row][col]}`);
            return false;
        }
        
        console.log(`玩家${player}在(${row}, ${col})落子`);
        board[row][col] = player;
        this.gameState.lastMove = { row, col };
        
        try {
            if (this.checkWin(row, col, player)) {
                console.log(`玩家${player}獲勝`);
                this.gameState.gameOver = true;
                this.gameState.winner = player;
            } else if (this.checkDraw()) {
                console.log("遊戲平局");
                this.gameState.gameOver = true;
                this.gameState.winner = -1;
            }
        } catch (error) {
            console.error("檢查勝負時出錯:", error);
        }
        
        return true;
    }
    
    checkWin(row, col, player) {
        const { board } = this.gameState;
        
        if (!this.gameState.isOnBoard(row, col) || board[row][col] !== player) return false;

        const directions = [
            { dr: 0, dc: 1 },  // 水平
            { dr: 1, dc: 0 },  // 垂直
            { dr: 1, dc: 1 },  // 對角線 ↘
            { dr: 1, dc: -1 }  // 對角線 ↙
        ];
        
        for (const { dr, dc } of directions) {
            let count = 1;
            
            // 正方向計數
            for (let i = 1; i < 6; i++) {
                const r = row + i * dr, c = col + i * dc;
                if (this.gameState.isOnBoard(r, c) && board[r][c] === player) 
                    count++; 
                else 
                    break;
            }
            
            // 反方向計數
            for (let i = 1; i < 6; i++) {
                const r = row - i * dr, c = col - i * dc;
                if (this.gameState.isOnBoard(r, c) && board[r][c] === player) 
                    count++; 
                else 
                    break;
            }

            // 檢查是否正好五連
            if (count === 5) {
                console.log(`玩家${player}在(${row}, ${col})處達成五連，方向(${dr},${dc})，計數=${count}`);
                return true;
            } else if (count > 5) {
                console.log(`玩家${player}在(${row}, ${col})處達成長連(>5)，方向(${dr},${dc})，計數=${count}，不算贏`);
                // 長連不算贏
            }
        }
        return false;
    }
    
    checkDraw() {
        const { board } = this.gameState;
        
        for (let r = 0; r < GameConstants.BOARD_SIZE; r++) {
            for (let c = 0; c < GameConstants.BOARD_SIZE; c++) {
                if (board[r][c] === GameConstants.EMPTY) return false;
            }
        }
        return true;
    }
}

// 圍棋規則引擎
class GoRuleEngine {
    constructor(gameState) {
        this.gameState = gameState;
    }
    
    makeMove(row, col, player) {
        console.warn("圍棋邏輯需要完整實現.");
        const { board } = this.gameState;
        
        if (board[row][col] === GameConstants.EMPTY) {
            this.gameState.lastMove = { row, col };
            board[row][col] = player;
            return true;
        }
        return false;
    }
    
    handlePass(player) {
        this.gameState.passCount++;
        this.gameState.lastMove = null;
        console.log(`Player ${player} passed. Pass count: ${this.gameState.passCount}`);
        
        if (this.gameState.passCount >= 2) {
            this.gameState.gameOver = true;
            this.gameState.winner = -1;
        }
    }
    
    getNeighbors(r, c) {
        const neighbors = [];
        const directions = [
            {dr: -1, dc: 0}, // 上
            {dr: 1, dc: 0},  // 下
            {dr: 0, dc: -1}, // 左
            {dr: 0, dc: 1}   // 右
        ];
        
        for (const {dr, dc} of directions) {
            const nr = r + dr;
            const nc = c + dc;
            if (this.gameState.isOnBoard(nr, nc)) {
                neighbors.push({ r: nr, c: nc });
            }
        }
        return neighbors;
    }
    
    // 這裡省略其他圍棋規則相關的函數...
}

// AI引擎
class AIEngine {
    constructor(gameState) {
        this.gameState = gameState;
        this.aiTimeout = null;
    }
    
    async makeMove() {
        if (this.gameState.gameOver || 
            this.gameState.currentPlayer !== GameConstants.PLAYER2 || 
            this.gameState.gameMode !== GameConstants.MODES.GOBANG) {
            return false;
        }
        
        // 設置超時保護
        if (this.aiTimeout) {
            clearTimeout(this.aiTimeout);
        }
        
        this.aiTimeout = setTimeout(() => {
            console.warn("AI計算超時！執行緊急恢復");
            this.gameState.isAiThinking = false;
            clearTimeout(this.aiTimeout);
            this.aiTimeout = null;
        }, 10000);
        
        try {
            // 等待一點時間讓UI更新
            await new Promise(resolve => setTimeout(resolve, 50));
            
            console.time("AI計算");
            const bestMove = this.getBestMove();
            console.timeEnd("AI計算");
            
            if (bestMove && this.gameState.isOnBoard(bestMove.row, bestMove.col) && 
                this.gameState.board[bestMove.row][bestMove.col] === GameConstants.EMPTY) {
                console.log(`AI選擇了位置(${bestMove.row}, ${bestMove.col})`);
                return bestMove;
            } else {
                console.error("AI無法找到有效的移動", bestMove);
                return this.findFirstEmpty();
            }
        } catch (error) {
            console.error("AI思考過程中發生錯誤:", error);
            return this.findFirstEmpty();
        } finally {
            // 清除計時器
            if (this.aiTimeout) {
                clearTimeout(this.aiTimeout);
                this.aiTimeout = null;
            }
        }
    }
    
    findFirstEmpty() {
        const { board } = this.gameState;
        
        for (let r = 0; r < GameConstants.BOARD_SIZE; r++) {
            for (let c = 0; c < GameConstants.BOARD_SIZE; c++) {
                if (board[r][c] === GameConstants.EMPTY) {
                    return { row: r, col: c };
                }
            }
        }
        return null;
    }
    
    getBestMove() {
        try {
            const currentBoard = this.gameState.cloneBoard();
            let bestScore = -Infinity;
            let bestMove = null;
            
            const moves = this.getValidMoves(currentBoard);
            
            // 如果棋盤全空，直接下中心點
            if (this.isBoardEmpty(currentBoard)) {
                const center = Math.floor(GameConstants.BOARD_SIZE / 2);
                return { row: center, col: center };
            }
            
            let alpha = -Infinity;
            let beta = Infinity;
            
            for (const move of moves) {
                try {
                    const boardCopy = JSON.parse(JSON.stringify(currentBoard));
                    boardCopy[move.row][move.col] = GameConstants.PLAYER2; // AI
                    
                    // 從對手回合開始（最小化）
                    const score = this.minimax(
                        boardCopy, 
                        GameConstants.AI.SEARCH_DEPTH - 1, 
                        alpha, 
                        beta, 
                        false
                    );
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestMove = move;
                    }
                    
                    alpha = Math.max(alpha, score);
                } catch (error) {
                    console.error(`評估移動(${move.row}, ${move.col})時出錯:`, error);
                }
            }
            
            console.log(`AI選擇移動(${bestMove?.row}, ${bestMove?.col})，分數: ${bestScore}`);
            return bestMove;
        } catch (error) {
            console.error("AI getBestMove出錯:", error);
            return null;
        }
    }
    
    minimax(board, depth, alpha, beta, isMaximizingPlayer) {
        try {
            // 檢查終局狀態
            const winner = this.checkWinner(board);
            if (winner === GameConstants.PLAYER2) return GameConstants.AI.WIN_SCORE + depth; // AI獲勝
            if (winner === GameConstants.PLAYER1) return -GameConstants.AI.WIN_SCORE - depth; // 人類獲勝
            if (this.isBoardFull(board)) return 0; // 平局
            if (depth === 0) {
                return this.evaluateBoard(board); // 到達搜索深度限制
            }

            const validMoves = this.getValidMoves(board);

            if (isMaximizingPlayer) { // AI的回合（最大化分數）
                let maxEval = -Infinity;
                for (const move of validMoves) {
                    const boardCopy = JSON.parse(JSON.stringify(board));
                    boardCopy[move.row][move.col] = GameConstants.PLAYER2; // AI
                    const score = this.minimax(boardCopy, depth - 1, alpha, beta, false); // 接下來是對手回合
                    maxEval = Math.max(maxEval, score);
                    alpha = Math.max(alpha, score);
                    if (beta <= alpha) break; // Beta剪枝
                }
                return maxEval;
            } else { // 對手回合（最小化分數）
                let minEval = Infinity;
                for (const move of validMoves) {
                    const boardCopy = JSON.parse(JSON.stringify(board));
                    boardCopy[move.row][move.col] = GameConstants.PLAYER1; // 人類
                    const score = this.minimax(boardCopy, depth - 1, alpha, beta, true); // 接下來是AI回合
                    minEval = Math.min(minEval, score);
                    beta = Math.min(beta, score);
                    if (beta <= alpha) break; // Alpha剪枝
                }
                return minEval;
            }
        } catch (error) {
            console.error("Minimax計算錯誤:", error);
            return 0;
        }
    }
    
    checkWinner(board) {
        const gobangRules = new GobangRuleEngine({ board, isOnBoard: this.gameState.isOnBoard.bind(this.gameState) });
        
        for (let r = 0; r < GameConstants.BOARD_SIZE; r++) {
            for (let c = 0; c < GameConstants.BOARD_SIZE; c++) {
                const player = board[r][c];
                if (player !== GameConstants.EMPTY) {
                    if (gobangRules.checkWin(r, c, player)) {
                        return player;
                    }
                }
            }
        }
        return GameConstants.EMPTY;
    }
    
    isBoardEmpty(board) {
        for (let r = 0; r < GameConstants.BOARD_SIZE; r++) {
            for (let c = 0; c < GameConstants.BOARD_SIZE; c++) {
                if (board[r][c] !== GameConstants.EMPTY) {
                    return false;
                }
            }
        }
        return true;
    }
    
    isBoardFull(board) {
        for (let r = 0; r < GameConstants.BOARD_SIZE; r++) {
            for (let c = 0; c < GameConstants.BOARD_SIZE; c++) {
                if (board[r][c] === GameConstants.EMPTY) {
                    return false;
                }
            }
        }
        return true;
    }
    
    getValidMoves(board) {
        const moves = [];
        
        // 如果棋盤為空，返回中心點
        if (this.isBoardEmpty(board)) {
            const center = Math.floor(GameConstants.BOARD_SIZE / 2);
            return [{ row: center, col: center }];
        }
        
        // 找有鄰居的空位（優化搜索空間）
        for (let r = 0; r < GameConstants.BOARD_SIZE; r++) {
            for (let c = 0; c < GameConstants.BOARD_SIZE; c++) {
                if (board[r][c] === GameConstants.EMPTY) {
                    if (this.hasNeighbors(board, r, c, 2)) {
                        moves.push({ row: r, col: c });
                    }
                }
            }
        }
        
        // 如果沒有找到任何有鄰居的空位，返回所有空位
        if (moves.length === 0) {
            for (let r = 0; r < GameConstants.BOARD_SIZE; r++) {
                for (let c = 0; c < GameConstants.BOARD_SIZE; c++) {
                    if (board[r][c] === GameConstants.EMPTY) {
                        moves.push({ row: r, col: c });
                    }
                }
            }
        }
        
        return moves;
    }
    
    hasNeighbors(board, r, c, distance) {
        for (let i = -distance; i <= distance; i++) {
            for (let j = -distance; j <= distance; j++) {
                if (i === 0 && j === 0) continue;
                
                const nr = r + i;
                const nc = c + j;
                
                if (this.gameState.isOnBoard(nr, nc) && board[nr][nc] !== GameConstants.EMPTY) {
                    return true;
                }
            }
        }
        return false;
    }
    
    evaluateBoard(board) {
        try {
            let aiScore = 0;
            let humanScore = 0;
            
            const lines = this.getAllLines(board);
            for (const line of lines) {
                aiScore += this.evaluateLine(line, GameConstants.PLAYER2, GameConstants.PLAYER1);
                humanScore += this.evaluateLine(line, GameConstants.PLAYER1, GameConstants.PLAYER2);
            }
            
            return aiScore - humanScore; // AI的分數減去人類的分數
        } catch (error) {
            console.error("計算棋盤評分時出錯:", error);
            return 0;
        }
    }
    
    getAllLines(board) {
        const lines = [];
        
        // 行
        for (let r = 0; r < GameConstants.BOARD_SIZE; r++) {
            lines.push(board[r]);
        }
        
        // 列
        for (let c = 0; c < GameConstants.BOARD_SIZE; c++) {
            lines.push(board.map(row => row[c]));
        }
        
        // 對角線 ↘
        for (let k = 0; k <= 2 * (GameConstants.BOARD_SIZE - 1); k++) {
            const diag = [];
            for (let r = 0; r < GameConstants.BOARD_SIZE; r++) {
                const c = k - r;
                if (c >= 0 && c < GameConstants.BOARD_SIZE) {
                    diag.push(board[r][c]);
                }
            }
            if (diag.length >= 5) lines.push(diag);
        }
        
        // 對角線 ↙
        for (let k = 1 - GameConstants.BOARD_SIZE; k < GameConstants.BOARD_SIZE; k++) {
            const diag = [];
            for (let r = 0; r < GameConstants.BOARD_SIZE; r++) {
                const c = k + r;
                if (c >= 0 && c < GameConstants.BOARD_SIZE) {
                    diag.push(board[r][c]);
                }
            }
            if (diag.length >= 5) lines.push(diag);
        }
        
        return lines;
    }
    
    evaluateLine(line, player, opponent) {
        try {
            let score = 0;
            const len = line.length;

            for (let i = 0; i < len; i++) {
                if (line[i] === player) {
                    // 從這個子開始檢查模式
                    let count = 0;
                    let openEnds = 0;
                    let k = i;

                    // 計算連續的子
                    while (k < len && line[k] === player) {
                        count++;
                        k++;
                    }

                    // 檢查開放端
                    if (i > 0 && line[i - 1] === GameConstants.EMPTY) {
                        openEnds++;
                    }
                    if (k < len && line[k] === GameConstants.EMPTY) {
                        openEnds++;
                    }

                    // 基於數量和開放端評分
                    const { PATTERN_SCORES } = GameConstants.AI;
                    
                    if (count === 5) {
                        score += PATTERN_SCORES.FIVE;
                    } else if (count === 4) {
                        if (openEnds === 2) score += PATTERN_SCORES.LIVE_FOUR;
                        else if (openEnds === 1) score += PATTERN_SCORES.DEAD_FOUR;
                    } else if (count === 3) {
                        if (openEnds === 2) {
                            if ((i > 1 && line[i-2] === GameConstants.EMPTY) || 
                                (k < len - 1 && line[k+1] === GameConstants.EMPTY)) {
                                score += PATTERN_SCORES.LIVE_THREE;
                            } else {
                                score += PATTERN_SCORES.DEAD_THREE;
                            }
                        } else if (openEnds === 1) {
                            score += PATTERN_SCORES.DEAD_THREE;
                        }
                    } else if (count === 2) {
                        if (openEnds === 2) {
                            if ((i > 1 && line[i-2] === GameConstants.EMPTY) || 
                                (k < len - 1 && line[k+1] === GameConstants.EMPTY)) {
                                score += PATTERN_SCORES.LIVE_TWO;
                            } else {
                                score += PATTERN_SCORES.DEAD_TWO;
                            }
                        } else if (openEnds === 1) {
                            score += PATTERN_SCORES.DEAD_TWO;
                        }
                    } else if (count === 1) {
                        if (openEnds === 2) score += PATTERN_SCORES.LIVE_ONE;
                        else if (openEnds === 1) score += PATTERN_SCORES.DEAD_ONE;
                    } else if (count >= 6) {
                        score += PATTERN_SCORES.LONG_CONNECT;
                    }

                    i = k - 1; // 繼續搜索當前塊之後
                }
            }

            return score;
        } catch (error) {
            console.error("評估線條時出錯:", error);
            return 0;
        }
    }
}

// 遊戲控制器 - 協調所有模組
class GameController {
    constructor() {
        // 遊戲狀態
        this.gameState = new GameState();
        
        // UI元素
        this.uiElements = {
            boardElement: document.getElementById('board'),
            messageElement: document.getElementById('message'),
            resetButton: document.getElementById('resetButton'),
            gobangModeBtn: document.getElementById('gobangModeBtn'),
            goModeBtn: document.getElementById('goModeBtn'),
            goInfoElement: document.getElementById('go-info'),
            passButton: document.getElementById('passButton'),
            capturedP1Element: document.getElementById('captured-p1'),
            capturedP2Element: document.getElementById('captured-p2')
        };
        
        // 初始化渲染器
        this.renderer = new BoardRenderer(this.gameState, this.uiElements);
        
        // 初始化規則引擎
        this.gobangRules = new GobangRuleEngine(this.gameState);
        this.goRules = new GoRuleEngine(this.gameState);
        
        // 初始化AI引擎
        this.aiEngine = new AIEngine(this.gameState);
        
        // 恢復嘗試計數
        this.recoveryAttemptsCount = 0;
        
        // 綁定事件處理
        this.bindEvents();
        
        // 初始化遊戲
        this.switchMode(GameConstants.MODES.GOBANG);
    }
    
    bindEvents() {
        // 綁定方法的this上下文
        this.handleCellClick = this.handleCellClick.bind(this);
        this.handleResetClick = this.handleResetClick.bind(this);
        this.handlePassClick = this.handlePassClick.bind(this);
        
        // 添加事件監聽器
        this.uiElements.resetButton.addEventListener('click', this.handleResetClick);
        this.uiElements.gobangModeBtn.addEventListener('click', () => this.switchMode(GameConstants.MODES.GOBANG));
        this.uiElements.goModeBtn.addEventListener('click', () => this.switchMode(GameConstants.MODES.GO));
        this.uiElements.passButton.addEventListener('click', this.handlePassClick);
        
        // 添加緊急重置鍵盤快捷鍵
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.altKey && e.key === 'r') {
                this.emergencyReset();
            }
        });
        
        // 暴露緊急重置函數到全局
        window.emergencyReset = this.emergencyReset.bind(this);
        window.resetGame = this.initGame.bind(this);
    }
    
    async handleCellClick(event) {
        // 取得點擊的單元格
        const cell = event.target.closest('.cell');
        if (!cell || !cell.classList.contains('empty')) return;
        
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        
        // 檢查是否應該允許點擊
        if (this.gameState.gameOver) {
            console.log("遊戲已結束，點擊無效");
            return;
        }
        
        if (this.gameState.isAiThinking) {
            console.log("AI正在思考中，點擊無效");
            this.recoveryAttemptsCount++;
            
            // 如果用戶多次嘗試點擊，可能是卡住了，自動重置
            if (this.recoveryAttemptsCount >= 3) {
                console.warn("偵測到多次點擊嘗試，執行自動恢復");
                this.emergencyReset();
                return;
            }
            return;
        }
        
        if (this.gameState.currentPlayer !== GameConstants.PLAYER1) {
            console.log("不是人類玩家回合，點擊無效");
            return;
        }
        
        // 重置恢復嘗試計數
        this.recoveryAttemptsCount = 0;
        
        let moveMade = false;
        
        if (this.gameState.gameMode === GameConstants.MODES.GOBANG) {
            console.log(`人類玩家嘗試在(${row}, ${col})落子`);
            moveMade = this.gobangRules.makeMove(row, col, GameConstants.PLAYER1);
        } else if (this.gameState.gameMode === GameConstants.MODES.GO) {
            moveMade = this.goRules.makeMove(row, col, GameConstants.PLAYER1);
        }
        
        if (moveMade) {
            // 更新UI
            this.renderer.renderBoard(this.handleCellClick);
            this.renderer.updateMessage();
            
            if (!this.gameState.gameOver) {
                this.gameState.switchPlayer();
                
                // 如果是五子棋AI模式，觸發AI移動
                if (this.gameState.gameMode === GameConstants.MODES.GOBANG && 
                    this.gameState.currentPlayer === GameConstants.PLAYER2) {
                    // 延遲一點點再觸發AI，確保UI已更新
                    setTimeout(() => this.triggerAIMove(), 100);
                }
            }
        }
    }
    
    async triggerAIMove() {
        // 禁用棋盤輸入
        this.renderer.updateBoardState(true);
        
        try {
            const aiMove = await this.aiEngine.makeMove();
            
            if (aiMove) {
                const moveMade = this.gobangRules.makeMove(aiMove.row, aiMove.col, GameConstants.PLAYER2);
                
                if (!moveMade && !this.gameState.gameOver) {
                    console.error("AI移動失敗，嘗試備用移動");
                    const fallbackMove = this.aiEngine.findFirstEmpty();
                    
                    if (fallbackMove) {
                        this.gobangRules.makeMove(fallbackMove.row, fallbackMove.col, GameConstants.PLAYER2);
                    } else {
                        // 無法移動 - 應該是平局
                        this.gameState.gameOver = true;
                        this.gameState.winner = -1;
                        console.log("AI找不到有效移動，宣布平局");
                    }
                }
            }
        } finally {
            // 啟用棋盤輸入
            this.renderer.updateBoardState(false);
            
            if (!this.gameState.gameOver) {
                this.gameState.switchPlayer();
            }
            
            // 更新UI
            this.renderer.renderBoard(this.handleCellClick);
            this.renderer.updateMessage();
        }
    }
    
    handleResetClick() {
        this.initGame();
    }
    
    handlePassClick() {
        if (this.gameState.gameOver || 
            this.gameState.gameMode !== GameConstants.MODES.GO || 
            this.gameState.isAiThinking || 
            this.gameState.currentPlayer !== GameConstants.PLAYER1) return;
        
        this.goRules.handlePass(GameConstants.PLAYER1);
        
        // 更新UI
        this.renderer.renderBoard(this.handleCellClick);
        this.renderer.updateMessage();
        this.renderer.updateGoUI();
        
        if (!this.gameState.gameOver) {
            this.gameState.switchPlayer();
        }
    }
    
    switchMode(newMode) {
        if (this.gameState.gameMode === newMode && !this.gameState.gameOver) return;
        
        this.gameState.gameMode = newMode;
        
        // 更新按鈕狀態
        this.uiElements.gobangModeBtn.classList.toggle('active', newMode === GameConstants.MODES.GOBANG);
        this.uiElements.goModeBtn.classList.toggle('active', newMode === GameConstants.MODES.GO);
        
        // 更新按鈕文字
        this.uiElements.gobangModeBtn.textContent = (newMode === GameConstants.MODES.GOBANG) ? 
            "五子棋 (對戰 AI)" : "五子棋";
        this.uiElements.goModeBtn.textContent = (newMode === GameConstants.MODES.GO) ? 
            "圍棋 (進行中)" : "圍棋 (簡化版)";
        
        // 重置遊戲
        this.gameState.gameOver = true;
        this.gameState.winner = GameConstants.EMPTY;
        this.initGame();
    }
    
    initGame() {
        // 重置遊戲狀態
        this.gameState.reset();
        this.recoveryAttemptsCount = 0;
        
        // 更新UI
        this.renderer.updateCapturedStonesDisplay();
        this.renderer.renderBoard(this.handleCellClick);
        this.renderer.updateMessage();
        this.renderer.updateGoUI();
        
        console.log(`遊戲初始化完成，模式: ${this.gameState.gameMode}，AI思考狀態: ${this.gameState.isAiThinking}`);
    }
    
    emergencyReset() {
        console.warn("緊急重置被觸發");
        
        if (this.aiEngine.aiTimeout) {
            clearTimeout(this.aiEngine.aiTimeout);
            this.aiEngine.aiTimeout = null;
        }
        
        this.gameState.isAiThinking = false;
        this.renderer.updateBoardState(false);
        
        alert("棋盤已緊急重置！");
    }
}

// 當頁面加載完成後初始化遊戲
document.addEventListener('DOMContentLoaded', () => {
    const game = new GameController();
});