document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const boardElement = document.getElementById('board');
    const messageElement = document.getElementById('message');
    const resetButton = document.getElementById('resetButton');
    const gobangModeBtn = document.getElementById('gobangModeBtn');
    const goModeBtn = document.getElementById('goModeBtn');
    const goInfoElement = document.getElementById('go-info');
    const passButton = document.getElementById('passButton');
    const capturedP1Element = document.getElementById('captured-p1');
    const capturedP2Element = document.getElementById('captured-p2');

    // --- Game Constants ---
    const BOARD_SIZE = 15;
    const CELL_SIZE = 35;
    const EMPTY = 0;
    const PLAYER1 = 1; // Black (Human in Gobang AI mode)
    const PLAYER2 = 2; // White (AI in Gobang AI mode)
    const MODES = { GOBANG: 'gobang', GO: 'go' };

    // --- AI Constants ---
    const AI_PLAYER = PLAYER2;
    const HUMAN_PLAYER = PLAYER1;
    const SEARCH_DEPTH = 3; // Adjust AI search depth
    const WIN_SCORE = 100000;
    const PatternScores = { // Heuristic scores (Adjustable)
        // ★★★ 修改：長連分數設為 0 或負數，因為不算贏 ★★★
        FIVE: WIN_SCORE,       // Exactly five in a row
        LONG_CONNECT: 0,       // Score for 6 or more (not winning, maybe even bad)
        LIVE_FOUR: 10000,      // __OOOO__ (Highest threat)
        DEAD_FOUR: 800,        // XOOOO_ / _OOOOX / OO_OO
        LIVE_THREE: 800,       // __OOO__
        DEAD_THREE: 100,       // XOOO_ / _OOOX / O_OOX
        LIVE_TWO: 100,         // __OO__
        DEAD_TWO: 10,          // XOO__ / __OOX / O_OX
        LIVE_ONE: 10,
        DEAD_ONE: 1
    };

    // --- Game State Variables ---
    let board = [];
    let currentPlayer = HUMAN_PLAYER;
    let gameOver = true;
    let winner = EMPTY;
    let gameMode = MODES.GOBANG;
    let passCount = 0;
    let capturedStones = { [PLAYER1]: 0, [PLAYER2]: 0 };
    let lastMove = null;
    let isAiThinking = false;
    let aiTimeout = null; // 用於追蹤AI思考的計時器

    // --- 添加緊急恢復機制 ---
    let recoveryAttemptsCount = 0;
    window.emergencyReset = function() {
        console.warn("緊急重置被觸發");
        isAiThinking = false;
        clearTimeout(aiTimeout); // 清除可能的AI思考計時器
        disableBoardInput(false);
        renderBoard();
        updateMessage();
        alert("棋盤已緊急重置！");
    };

    // --- Initialization ---
    function initGame() {
        // 清除任何可能的計時器
        if (aiTimeout) {
            clearTimeout(aiTimeout);
            aiTimeout = null;
        }
        
        board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
        currentPlayer = HUMAN_PLAYER; // Human always starts in Gobang AI for simplicity
        gameOver = false;
        winner = EMPTY;
        lastMove = null;
        isAiThinking = false; // 明確重置AI思考狀態
        passCount = 0;
        capturedStones = { [PLAYER1]: 0, [PLAYER2]: 0 };
        recoveryAttemptsCount = 0; // 重置恢復計數
        
        updateCapturedStonesDisplay();
        renderBoard();
        updateMessage();
        updateGoUI();
        resetButton.disabled = false;
        passButton.disabled = (gameMode !== MODES.GO);
        disableBoardInput(false); // 確保棋盤啟用
        console.log(`遊戲初始化完成，模式: ${gameMode}，AI思考狀態: ${isAiThinking}`);
    }

    // --- UI Updates ---
    function updateMessage() { 
        let msg = "";
        if (isAiThinking) {
            msg = "AI (⚪) 正在思考...";
            messageElement.style.color = 'purple';
        } else if (gameOver) {
            if (winner === HUMAN_PLAYER) {
                msg = `遊戲結束：恭喜你 (⚫) 獲勝！`; messageElement.style.color = 'darkgreen';
            } else if (winner === AI_PLAYER) {
                 msg = `遊戲結束：AI (⚪) 獲勝！`; messageElement.style.color = 'darkred';
            } else if (winner === -1) {
                 if (gameMode === MODES.GOBANG) msg = "遊戲結束：平局！";
                 else msg = "遊戲結束：雙方連續 Pass"; // Go logic
                 messageElement.style.color = 'darkorange';
            } else {
                 msg = "選擇模式開始新遊戲"; messageElement.style.color = '#555';
            }
        } else {
            const playerText = currentPlayer === HUMAN_PLAYER ? '你 (⚫)' : 'AI (⚪)';
            msg = `輪到 ${playerText} 下棋`;
            messageElement.style.color = '#555';
            if (gameMode === MODES.GO && passCount > 0) { msg += ` (一方已 Pass)`; }
        }
        messageElement.textContent = msg;
     }
     
    function updateGoUI() { 
        goInfoElement.style.display = (gameMode === MODES.GO) ? 'flex' : 'none';
        passButton.style.display = (gameMode === MODES.GO) ? 'inline-block' : 'none';
        passButton.disabled = (gameMode !== MODES.GO) || gameOver || isAiThinking;
    }
    
    function updateCapturedStonesDisplay() { 
        capturedP1Element.textContent = capturedStones[PLAYER1];
        capturedP2Element.textContent = capturedStones[PLAYER2];
    }
    
    function switchMode(newMode) { 
        if (gameMode === newMode && !gameOver) return;
        
        // 清除任何可能的計時器
        if (aiTimeout) {
            clearTimeout(aiTimeout);
            aiTimeout = null;
        }
        
        gameMode = newMode;
        gobangModeBtn.classList.toggle('active', newMode === MODES.GOBANG);
        goModeBtn.classList.toggle('active', newMode === MODES.GO);
        gobangModeBtn.textContent = (newMode === MODES.GOBANG) ? "五子棋 (對戰 AI)" : "五子棋";
        goModeBtn.textContent = (newMode === MODES.GO) ? "圍棋 (進行中)" : "圍棋 (簡化版)";
        gameOver = true; winner = EMPTY;
        initGame();
    }

    // --- Board Rendering & Interaction Control ---
    function renderBoard() { 
        console.log(`渲染棋盤: 遊戲結束=${gameOver}, AI思考中=${isAiThinking}, 當前玩家=${currentPlayer}`);
        
        boardElement.innerHTML = '';
        boardElement.style.width = `${BOARD_SIZE * CELL_SIZE}px`;
        boardElement.style.height = `${BOARD_SIZE * CELL_SIZE}px`;
        boardElement.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`;
        boardElement.style.gridTemplateRows = `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`;
        
        const currentGameOver = gameOver;
        const currentThinking = isAiThinking;
        
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const cell = document.createElement('div'); 
                cell.classList.add('cell');
                cell.dataset.row = r; 
                cell.dataset.col = c;
                cell.style.width = `${CELL_SIZE}px`; 
                cell.style.height = `${CELL_SIZE}px`;
                
                const piece = board[r][c];
                if (piece === EMPTY) {
                    cell.classList.add('empty');
                    
                    // 強制始終啟用點擊以防失效（在處理函數中檢查條件）
                    cell.addEventListener('click', handleCellClick);
                    
                    if (!currentGameOver && !currentThinking && currentPlayer === HUMAN_PLAYER) {
                        cell.style.cursor = 'pointer';
                    } else if (currentThinking) { 
                        cell.style.cursor = 'wait'; 
                        cell.classList.add('thinking'); 
                    } else { 
                        cell.style.cursor = 'default'; 
                    }
                } else {
                    const stone = document.createElement('div'); 
                    stone.classList.add('stone');
                    stone.classList.add(piece === PLAYER1 ? 'black' : 'white'); 
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
    
    function disableBoardInput(disabled) { 
        console.log(`${disabled ? "禁用" : "啟用"}棋盤, isAiThinking設為 ${disabled}`);
        isAiThinking = disabled;
        const thinkingCursor = disabled ? 'wait' : 'default';
        boardElement.style.cursor = thinkingCursor;
        resetButton.disabled = disabled;
        passButton.disabled = disabled || (gameMode !== MODES.GO);
        gobangModeBtn.disabled = disabled;
        goModeBtn.disabled = disabled;
        renderBoard(); 
        updateMessage();
    }

    // --- Event Handlers ---
    function handleCellClick(event) { 
        // 直接在函數內檢查所有條件，而不僅僅依賴外部狀態和事件綁定
        const cell = event.target.closest('.cell');
        if (!cell || !cell.classList.contains('empty')) return;
        
        const row = parseInt(cell.dataset.row); 
        const col = parseInt(cell.dataset.col);
        
        // 檢查是否應該允許點擊
        if (gameOver) {
            console.log("遊戲已結束，點擊無效");
            return;
        }
        
        if (isAiThinking) {
            console.log("AI正在思考中，點擊無效");
            recoveryAttemptsCount++;
            
            // 如果用戶多次嘗試點擊，可能是卡住了，自動重置
            if (recoveryAttemptsCount >= 3) {
                console.warn("偵測到多次點擊嘗試，執行自動恢復");
                window.emergencyReset();
                return;
            }
            return;
        }
        
        if (currentPlayer !== HUMAN_PLAYER) {
            console.log("不是人類玩家回合，點擊無效");
            return;
        }
        
        // 重置恢復嘗試計數
        recoveryAttemptsCount = 0;
        
        if (gameMode === MODES.GOBANG) {
            console.log(`人類玩家嘗試在(${row}, ${col})落子`);
            
            if (makeMove(row, col, HUMAN_PLAYER)) {
                if (!gameOver) {
                    switchPlayer(); 
                    // 使用setTimeout確保界面更新後再觸發AI
                    setTimeout(() => triggerAIMove(), 100);
                }
            }
        } else if (gameMode === MODES.GO) {
            if (handleGoMove(row, col, HUMAN_PLAYER)) {
                if (!gameOver) { 
                    switchPlayer(); 
                    // 圍棋AI邏輯（如果有）
                }
            }
        }
    }
    
    function handlePassClick() { 
        if (gameOver || gameMode !== MODES.GO || isAiThinking || currentPlayer !== HUMAN_PLAYER) return;
        handlePassClickInternal(HUMAN_PLAYER);
        if (!gameOver) { switchPlayer(); /* Maybe trigger Go AI */ }
    }
    
    function handlePassClickInternal(player) { 
        passCount++; 
        lastMove = null; 
        console.log(`Player ${player} passed. Pass count: ${passCount}`);
        if (passCount >= 2) { 
            gameOver = true; 
            winner = -1; 
        }
        renderBoard(); 
        updateMessage(); 
        updateGoUI();
    }

    // --- Game Logic ---
    function switchPlayer() { 
        currentPlayer = (currentPlayer === PLAYER1) ? PLAYER2 : PLAYER1; 
        console.log(`切換玩家，現在是 ${currentPlayer === PLAYER1 ? "人類" : "AI"} 回合`);
    }
    
    function makeMove(row, col, player) { 
        if (gameOver || !isOnBoard(row, col) || board[row][col] !== EMPTY) {
            console.log(`落子失敗: gameOver=${gameOver}, isOnBoard=${isOnBoard(row, col)}, 位置狀態=${board[row][col]}`);
            return false;
        }
        
        console.log(`玩家${player}在(${row}, ${col})落子`);
        board[row][col] = player; 
        lastMove = { row, col };
        
        if (gameMode === MODES.GOBANG) {
            try {
                if (checkWinGoBang(row, col, player, board)) {
                    console.log(`玩家${player}獲勝`);
                    gameOver = true; 
                    winner = player;
                } else if (checkDrawGoBang()) {
                    console.log("遊戲平局");
                    gameOver = true; 
                    winner = -1;
                }
            } catch (error) {
                console.error("檢查勝負時出錯:", error);
                // 即使出錯，也讓遊戲繼續
            }
        }
        
        renderBoard();
        updateMessage();
        return true;
    }
    
    function isOnBoard(r, c) { 
        return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE; 
    }

    // --- Gobang Win/Draw Checks ---
    function checkWinGoBang(row, col, player, currentBoard = board) {
        if (!isOnBoard(row,col) || currentBoard[row][col] !== player) return false;

        const directions = [ 
            { dr: 0, dc: 1 }, // 水平
            { dr: 1, dc: 0 }, // 垂直
            { dr: 1, dc: 1 }, // 對角線 ↘
            { dr: 1, dc: -1 } // 對角線 ↙
        ];
        
        for (const { dr, dc } of directions) {
            let count = 1;
            
            // 正方向計數
            for (let i = 1; i < 6; i++) {
                const r = row + i * dr, c = col + i * dc;
                if (isOnBoard(r, c) && currentBoard[r][c] === player) 
                    count++; 
                else 
                    break;
            }
            
            // 反方向計數
            for (let i = 1; i < 6; i++) {
                const r = row - i * dr, c = col - i * dc;
                if (isOnBoard(r, c) && currentBoard[r][c] === player) 
                    count++; 
                else 
                    break;
            }

            // 檢查是否正好是5個子
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

    function checkDrawGoBang() { 
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === EMPTY) return false;
            }
        }
        return !gameOver;
    }

    // --- Go Logic Stubs ---
    function handleGoMove(row, col, player) { 
        console.warn("圍棋邏輯需要完整實現."); 
        if (board[row][col] === EMPTY) { 
            makeMove(row, col, player); 
            return true; 
        } 
        return false;
    }
    
    function getNeighbors(r, c) { 
        const neighbors = []; 
        const directions = [{dr: -1, dc: 0}, {dr: 1, dc: 0}, {dr: 0, dc: -1}, {dr: 0, dc: 1}]; 
        for (const {dr, dc} of directions) { 
            const nr = r + dr; 
            const nc = c + dc; 
            if (isOnBoard(nr, nc)) { 
                neighbors.push({ r: nr, c: nc }); 
            } 
        } 
        return neighbors; 
    }
    
    function getGroup(startRow, startCol) { 
        const player = board[startRow][startCol]; 
        if (player === EMPTY) return { stones: [], liberties: 0 }; 
        
        const groupStones = new Set(); 
        const liberties = new Set(); 
        const queue = [{ r: startRow, c: startCol }]; 
        const visited = new Set(); 
        
        visited.add(`${startRow},${startCol}`); 
        groupStones.add(`${startRow},${startCol}`); 
        
        let head = 0; 
        while(head < queue.length) { 
            const { r, c } = queue[head++]; 
            const neighbors = getNeighbors(r, c); 
            
            for (const {r: nr, c: nc} of neighbors) { 
                const neighborKey = `${nr},${nc}`; 
                if(visited.has(neighborKey)) continue; 
                
                const neighborState = board[nr][nc]; 
                if (neighborState === EMPTY) { 
                    liberties.add(neighborKey); 
                } else if (neighborState === player) { 
                    visited.add(neighborKey); 
                    groupStones.add(neighborKey); 
                    queue.push({ r: nr, c: nc }); 
                } 
            } 
        } 
        
        const stoneCoords = Array.from(groupStones).map(s => { 
            const [r, c] = s.split(',').map(Number); 
            return { r, c }; 
        }); 
        
        return { stones: stoneCoords, liberties: liberties.size }; 
    }
    
    function removeGroup(stones) { 
        let removedCount = 0; 
        for (const { r, c } of stones) { 
            if (board[r][c] !== EMPTY) { 
                board[r][c] = EMPTY; 
                removedCount++; 
            } 
        } 
        console.log(`移除了${removedCount}個子`); 
        return removedCount; 
    }
    
    function checkAndRemoveCaptures(row, col, player, opponent) { 
        let totalCaptured = 0; 
        const neighbors = getNeighbors(row, col); 
        
        for(const {r, c} of neighbors) { 
            if (isOnBoard(r,c) && board[r][c] === opponent) { 
                const groupInfo = getGroup(r, c); 
                if (groupInfo.liberties === 0) { 
                    totalCaptured += removeGroup(groupInfo.stones); 
                } 
            } 
        } 
        return totalCaptured; 
    }


    // ========================================
    // ===          AI LOGIC START          ===
    // ========================================

    async function triggerAIMove() { 
        if (gameOver || currentPlayer !== AI_PLAYER || gameMode !== MODES.GOBANG) {
            console.log("不需要觸發AI: gameOver=", gameOver, "currentPlayer=", currentPlayer, "gameMode=", gameMode);
            return;
        }
        
        console.log("觸發AI思考...");
        disableBoardInput(true);
        
        // 清除任何可能的先前計時器
        if (aiTimeout) {
            clearTimeout(aiTimeout);
        }
        
        // 設置AI執行的超時保護
        aiTimeout = setTimeout(() => {
            console.warn("AI計算超時！執行緊急恢復");
            window.emergencyReset();
        }, 10000); // 10秒後自動重置，防止卡死
        
        try {
            // 先更新一下UI顯示AI思考中
            await new Promise(resolve => setTimeout(resolve, 50));
            renderBoard();
            updateMessage();
            
            console.time("AI計算");
            const bestMove = getAIMove(board, AI_PLAYER);
            console.timeEnd("AI計算");
            
            let moveMade = false;
            if (bestMove && isOnBoard(bestMove.row, bestMove.col) && board[bestMove.row][bestMove.col] === EMPTY) {
                console.log(`AI選擇了位置(${bestMove.row}, ${bestMove.col})`);
                moveMade = makeMove(bestMove.row, bestMove.col, AI_PLAYER);
            }
            
            if (!moveMade) {
                console.error("AI無法找到或執行有效的移動", bestMove);
                // 備用策略：找第一個空位
                const fallbackMove = findFirstEmpty();
                if (fallbackMove) {
                    console.log("AI執行備用移動");
                    moveMade = makeMove(fallbackMove.row, fallbackMove.col, AI_PLAYER);
                } else {
                    // 無法移動 - 應該是平局
                    if (!gameOver) {
                        gameOver = true; 
                        winner = -1;
                        console.log("AI找不到有效移動，宣布平局");
                    }
                }
            }
        } catch (error) {
            console.error("AI思考過程中發生錯誤:", error);
        } finally {
            // 清除計時器
            if (aiTimeout) {
                clearTimeout(aiTimeout);
                aiTimeout = null;
            }
            
            // 重置棋盤狀態
            disableBoardInput(false);
            
            if (!gameOver) { 
                switchPlayer(); 
            }
            
            renderBoard(); 
            updateMessage();
        }
    }
    
    function findFirstEmpty() {
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === EMPTY) return {row: r, col: c};
            }
        }
        return null;
    }

    function getValidMoves(currentBoard) {
        const moves = []; 
        const opponent = (currentPlayer === PLAYER1) ? PLAYER2 : PLAYER1; 
        let boardIsEmpty = true;
        
        // 檢查棋盤是否為空
        for (let r = 0; r < BOARD_SIZE; r++) { 
            for (let c = 0; c < BOARD_SIZE; c++) { 
                if (currentBoard[r][c] !== EMPTY) { 
                    boardIsEmpty = false; 
                    break; 
                } 
            } 
            if (!boardIsEmpty) break; 
        }

        // 如果棋盤為空，返回中心點（效率優化）
        if (boardIsEmpty) {
            return [{row: Math.floor(BOARD_SIZE/2), col: Math.floor(BOARD_SIZE/2)}];
        }
        
        // 否則，尋找所有有鄰居的空位
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (currentBoard[r][c] === EMPTY) {
                    if (hasNeighbors(currentBoard, r, c, 2)) {
                        moves.push({ row: r, col: c });
                    }
                }
            }
        }
        
        // 如果沒有找到任何有鄰居的空位，返回所有空位
        if (moves.length === 0) {
            for (let r = 0; r < BOARD_SIZE; r++) { 
                for (let c = 0; c < BOARD_SIZE; c++) { 
                    if (currentBoard[r][c] === EMPTY) { 
                        moves.push({ row: r, col: c }); 
                    } 
                } 
            }
        }
        
        return moves;
    }
    
    function hasNeighbors(board, r, c, distance) { 
        for (let i = -distance; i <= distance; i++) { 
            for (let j = -distance; j <= distance; j++) { 
                if (i === 0 && j === 0) continue; 
                const nr = r + i; 
                const nc = c + j; 
                if (isOnBoard(nr, nc) && board[nr][nc] !== EMPTY) { 
                    return true; 
                } 
            } 
        } 
        return false; 
    }

    // --- Minimax with Alpha-Beta Pruning ---
    function getAIMove(currentBoard, player) {
        try {
            let bestScore = -Infinity; 
            let bestMove = null;
            
            const moves = getValidMoves(currentBoard);
            
            // 如果棋盤全空，直接下中心點
            if (moves.length === 1 && moves[0].row === Math.floor(BOARD_SIZE / 2) && moves[0].col === Math.floor(BOARD_SIZE / 2)) {
                return moves[0];
            }
            
            let alpha = -Infinity; 
            let beta = Infinity;
            
            for (const move of moves) {
                try {
                    const boardCopy = JSON.parse(JSON.stringify(currentBoard));
                    boardCopy[move.row][move.col] = player;
                    
                    // 從對手回合開始（最小化）
                    const score = minimax(boardCopy, SEARCH_DEPTH - 1, alpha, beta, false, player);
                    
                    if (score > bestScore) { 
                        bestScore = score; 
                        bestMove = move; 
                    }
                    
                    alpha = Math.max(alpha, score);
                } catch (error) {
                    console.error(`評估移動(${move.row}, ${move.col})時出錯:`, error);
                    // 繼續評估其他移動
                }
            }
            
            console.log(`AI選擇移動(${bestMove?.row}, ${bestMove?.col})，分數: ${bestScore}`);
            return bestMove;
        } catch (error) {
            console.error("AI getAIMove出錯:", error);
            // 返回一個默認移動或null
            return null;
        }
    }

    function minimax(board, depth, alpha, beta, isMaximizingPlayer, aiPlayerId) {
        try {
            const humanPlayerId = (aiPlayerId === PLAYER1) ? PLAYER2 : PLAYER1;

            // 檢查終局狀態
            const winnerNow = checkForWinner(board);
            if (winnerNow === aiPlayerId) return WIN_SCORE + depth; // AI獲勝
            if (winnerNow === humanPlayerId) return -WIN_SCORE - depth; // 人類獲勝
            if (checkBoardFull(board)) return 0; // 平局
            if (depth === 0) {
                return evaluateBoard(board, aiPlayerId); // 到達搜索深度限制
            }

            const validMoves = getValidMoves(board);

            if (isMaximizingPlayer) { // AI的回合（最大化分數）
                let maxEval = -Infinity;
                for (const move of validMoves) {
                    const boardCopy = JSON.parse(JSON.stringify(board));
                    boardCopy[move.row][move.col] = aiPlayerId;
                    const score = minimax(boardCopy, depth - 1, alpha, beta, false, aiPlayerId); // 接下來是對手回合
                    maxEval = Math.max(maxEval, score);
                    alpha = Math.max(alpha, score);
                    if (beta <= alpha) { break; } // Beta剪枝
                }
                return maxEval;
            } else { // 對手回合（最小化分數）
                let minEval = Infinity;
                for (const move of validMoves) {
                    const boardCopy = JSON.parse(JSON.stringify(board));
                    boardCopy[move.row][move.col] = humanPlayerId;
                    const score = minimax(boardCopy, depth - 1, alpha, beta, true, aiPlayerId); // 接下來是AI回合
                    minEval = Math.min(minEval, score);
                    beta = Math.min(beta, score);
                    if (beta <= alpha) { break; } // Alpha剪枝
                }
                return minEval;
            }
        } catch (error) {
            console.error("Minimax計算錯誤:", error);
            // 返回一個中性評分
            return 0;
        }
    }
    
    // 檢查棋盤是否已滿
    function checkBoardFull(board) {
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === EMPTY) return false;
            }
        }
        return true;
    }

    // 輔助函數，用於檢查勝者（使用修改過的checkWinGoBang）
    function checkForWinner(board) {
        try {
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    const player = board[r][c];
                    if (player !== EMPTY) {
                        if (checkWinGoBang(r, c, player, board)) {
                            return player; // 返回勝者
                        }
                    }
                }
            }
            return EMPTY; // 沒有勝者
        } catch (error) {
            console.error("檢查勝者時出錯:", error);
            return EMPTY; // 出錯時默認沒有勝者
        }
    }

    // --- Heuristic Evaluation Function ---
    function evaluateBoard(currentBoard, aiPlayerId) {
        try {
            let aiScore = 0; 
            let humanScore = 0;
            const humanPlayerId = (aiPlayerId === PLAYER1) ? PLAYER2 : PLAYER1;
            
            const lines = getAllLines(currentBoard);
            for (const line of lines) {
                aiScore += evaluateLine(line, aiPlayerId, humanPlayerId);
                humanScore += evaluateLine(line, humanPlayerId, aiPlayerId);
            }
            
            return aiScore - humanScore; // AI的分數減去人類的分數
        } catch (error) {
            console.error("計算棋盤評分時出錯:", error);
            return 0; // 出錯時返回中性評分
        }
    }
    
    function getAllLines(board) {
        const lines = [];
        
        // 行
        for (let r = 0; r < BOARD_SIZE; r++) { 
            lines.push(board[r]); 
        }
        
        // 列
        for (let c = 0; c < BOARD_SIZE; c++) { 
            lines.push(board.map(row => row[c])); 
        }
        
        // 對角線 ↘
        for (let k = 0; k <= 2 * (BOARD_SIZE - 1); k++) { 
            const diag = []; 
            for (let r = 0; r < BOARD_SIZE; r++) { 
                const c = k - r; 
                if (c >= 0 && c < BOARD_SIZE) { 
                    diag.push(board[r][c]); 
                } 
            } 
            if (diag.length >= 5) lines.push(diag); 
        }
        
        // 對角線 ↙
        for (let k = 1 - BOARD_SIZE; k < BOARD_SIZE; k++) { 
            const diag = []; 
            for (let r = 0; r < BOARD_SIZE; r++) { 
                const c = k + r; 
                if (c >= 0 && c < BOARD_SIZE) { 
                    diag.push(board[r][c]); 
                } 
            } 
            if (diag.length >= 5) lines.push(diag); 
        }
        
        return lines;
    }

    // 評估一行 - 修改後更健壯的模式檢查
    function evaluateLine(line, player, opponent) {
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
                    if (i > 0 && line[i - 1] === EMPTY) {
                        openEnds++;
                    }
                    if (k < len && line[k] === EMPTY) {
                        openEnds++;
                    }

                    // 基於數量和開放端評分
                    if (count === 5) { 
                        score += PatternScores.FIVE; 
                    } else if (count === 4) {
                        if (openEnds === 2) score += PatternScores.LIVE_FOUR;
                        else if (openEnds === 1) score += PatternScores.DEAD_FOUR;
                    } else if (count === 3) {
                        if (openEnds === 2) {
                            if (i > 1 && line[i-2] === EMPTY || k < len - 1 && line[k+1] === EMPTY) {
                                score += PatternScores.LIVE_THREE;
                            } else {
                                score += PatternScores.DEAD_THREE;
                            }
                        } else if (openEnds === 1) score += PatternScores.DEAD_THREE;
                    } else if (count === 2) {
                        if (openEnds === 2) {
                            if (i > 1 && line[i-2] === EMPTY || k < len - 1 && line[k+1] === EMPTY) {
                                score += PatternScores.LIVE_TWO;
                            } else {
                                score += PatternScores.DEAD_TWO;
                            }
                        } else if (openEnds === 1) score += PatternScores.DEAD_TWO;
                    } else if (count === 1) {
                        if (openEnds === 2) score += PatternScores.LIVE_ONE;
                        else if (openEnds === 1) score += PatternScores.DEAD_ONE;
                    } else if (count >= 6) {
                        score += PatternScores.LONG_CONNECT;
                    }

                    i = k - 1; // 繼續搜索當前塊之後
                }
            }

            return score;
        } catch (error) {
            console.error("評估線條時出錯:", error);
            return 0; // 出錯時返回中性評分
        }
    }

    // ========================================
    // ===           AI LOGIC END           ===
    // ========================================

    // --- Event Listeners ---
    resetButton.addEventListener('click', initGame);
    gobangModeBtn.addEventListener('click', () => switchMode(MODES.GOBANG));
    goModeBtn.addEventListener('click', () => switchMode(MODES.GO));
    passButton.addEventListener('click', handlePassClick); // Go mode only

    // 添加緊急重置按鈕（隱藏，但可通過鍵盤訪問）
    window.addEventListener('keydown', function(e) {
        // 按Ctrl+Alt+R執行緊急重置
        if (e.ctrlKey && e.altKey && e.key === 'r') {
            window.emergencyReset();
        }
    });

    // --- Initial Setup ---
    switchMode(MODES.GOBANG);
    
    // 在全局範圍暴露重置功能（用於調試和緊急情況）
    window.resetGame = initGame;
});