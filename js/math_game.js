// Math Tutor Game Logic

let currentMode = '';
let num1 = 0, num2 = 0;
let mixedProblem = null;
let correctAnswer = 0;
let currentExplanationHTML = '';
let currentSessionScore = 0;
let highScores = { 'add': 0, 'subtract': 0, 'multiply': 0, 'divide': 0, 'mixed': 0 };

function initMathGame() {
    loadHighScores();
    updateMenuScores();
}

function loadHighScores() { const saved = localStorage.getItem('mathTutorHighScores'); if (saved) highScores = JSON.parse(saved); }
function saveHighScores() { localStorage.setItem('mathTutorHighScores', JSON.stringify(highScores)); }
function updateMenuScores() { for (const [m, s] of Object.entries(highScores)) { const el = document.getElementById(`score-${m}`); if (el) el.innerText = `紀錄: ${s}`; } }

function startPractice(mode) {
    currentMode = mode;
    currentSessionScore = 0;
    document.getElementById('home-menu').style.display = 'none';
    document.getElementById('practice-area').style.display = 'block';
    const titles = { 'add': '加法練習', 'subtract': '減法練習', 'multiply': '乘法練習', 'divide': '除法練習', 'mixed': '混合運算 (隨機題型)' };
    document.getElementById('mode-title').innerText = titles[mode];
    updateScoreUI();
    generateProblem();
}

function updateScoreUI() {
    const currEl = document.getElementById('current-score');
    currEl.innerText = currentSessionScore;
    document.getElementById('best-score').innerText = highScores[currentMode];
    if (currentSessionScore > highScores[currentMode] && highScores[currentMode] > 0) currEl.classList.add('new-record-anim');
    else currEl.classList.remove('new-record-anim');
}

function goHome() {
    document.getElementById('practice-area').style.display = 'none';
    document.getElementById('home-menu').style.display = 'block';
    updateMenuScores();
    resetUI();
}

function generateProblem() {
    resetUI();
    const input = document.getElementById('answer-input');
    input.value = '';
    if (currentMode === 'mixed') generateMixedProblem();
    else generateBasicProblem();
}

function generateBasicProblem() {
    switch (currentMode) {
        case 'add': num1 = r(10, 99); num2 = r(10, 99); correctAnswer = num1 + num2; setProblem(`${num1} + ${num2} = ?`); break;
        case 'subtract': num1 = r(10, 99); num2 = r(1, num1 - 1); correctAnswer = num1 - num2; setProblem(`${num1} - ${num2} = ?`); break;
        case 'multiply': num1 = r(2, 9); num2 = r(2, 9); correctAnswer = num1 * num2; setProblem(`${num1} × ${num2} = ?`); break;
        case 'divide': num2 = r(2, 9); correctAnswer = r(2, 9); num1 = num2 * correctAnswer; setProblem(`${num1} ÷ ${num2} = ?`); break;
    }
}

function generateMixedProblem() {
    const type = Math.floor(Math.random() * 5);
    let n1, n2, n3, op2, midVal;

    if (type === 0) {
        n1 = r(20, 90); n2 = r(10, 50); n3 = r(10, 50);
        let op1 = Math.random() > 0.5 ? '+' : '-';
        op2 = Math.random() > 0.5 ? '+' : '-';
        if (op1 === '-' && n1 < n2) n1 += n2;
        let val1 = (op1 === '+') ? n1 + n2 : n1 - n2;
        if (op2 === '-' && val1 < n3) op2 = '+';
        correctAnswer = (op2 === '+') ? val1 + n3 : val1 - n3;
        mixedProblem = {
            text: `${n1} ${op1} ${n2} ${op2} ${n3} = ?`,
            html: generateStepHTML('只有加減法時，從左算到右', `${n1} ${op1} ${n2} = ${val1}`, `${val1} ${op2} ${n3} = ${correctAnswer}`)
        };
    } else if (type === 1) {
        n1 = r(2, 9); n2 = r(2, 9); midVal = n1 * n2; n3 = r(10, 90);
        op2 = Math.random() > 0.5 ? '+' : '-';
        if (op2 === '-' && midVal < n3) n3 = r(1, midVal - 1);
        correctAnswer = (op2 === '+') ? midVal + n3 : midVal - n3;
        mixedProblem = {
            text: `${n1} × ${n2} ${op2} ${n3} = ?`,
            html: generateStepHTML('由左而右，先算乘法', `${n1} × ${n2} = ${midVal}`, `${midVal} ${op2} ${n3} = ${correctAnswer}`)
        };
    } else if (type === 2) {
        n2 = r(2, 9); n3 = r(2, 9); midVal = n2 * n3; n1 = r(10, 90);
        let op1 = Math.random() > 0.5 ? '+' : '-';
        if (op1 === '-' && n1 < midVal) n1 = midVal + r(5, 20);
        correctAnswer = (op1 === '+') ? n1 + midVal : n1 - midVal;
        mixedProblem = {
            text: `${n1} ${op1} ${n2} × ${n3} = ?`,
            html: generateStepHTML('注意！先乘除，後加減', `先算後面： ${n2} × ${n3} = ${midVal}`, `再算前面： ${n1} ${op1} ${midVal} = ${correctAnswer}`)
        };
    } else if (type === 3) {
        n2 = r(2, 9); let q = r(2, 9); n1 = n2 * q; n3 = r(10, 90);
        op2 = Math.random() > 0.5 ? '+' : '-';
        if (op2 === '-' && q < n3) op2 = '+';
        if (op2 === '-' && q > n3) correctAnswer = q - n3; else { op2 = '+'; correctAnswer = q + n3; }
        mixedProblem = {
            text: `${n1} ÷ ${n2} ${op2} ${n3} = ?`,
            html: generateStepHTML('由左而右，先算除法', `${n1} ÷ ${n2} = ${q}`, `${q} ${op2} ${n3} = ${correctAnswer}`)
        };
    } else {
        n2 = r(2, 9); let q = r(2, 9); let divPart = n2 * q;
        let C = r(2, 9); let Q = r(2, 9); let B = C * Q; let A = r(10, 90);
        let op1 = Math.random() > 0.5 ? '+' : '-';
        if (op1 === '-' && A < Q) A = Q + r(5, 20);
        correctAnswer = (op1 === '+') ? A + Q : A - Q;
        mixedProblem = {
            text: `${A} ${op1} ${B} ÷ ${C} = ?`,
            html: generateStepHTML('看到除號要先算！(先乘除後加減)', `先算後面： ${B} ÷ ${C} = ${Q}`, `再算前面： ${A} ${op1} ${Q} = ${correctAnswer}`)
        };
    }
    setProblem(mixedProblem.text);
}

function checkAnswer() {
    const userVal = document.getElementById('answer-input').value;
    if (userVal === '') { return; }
    const userAnswer = parseInt(userVal);
    const feedback = document.getElementById('mini-feedback');
    prepareExplanation();

    if (userAnswer === correctAnswer) {
        currentSessionScore += 10;
        let isNewRecord = false;
        if (currentSessionScore > highScores[currentMode]) {
            highScores[currentMode] = currentSessionScore;
            saveHighScores();
            isNewRecord = true;
        }
        updateScoreUI();
        document.getElementById('keypad').style.display = 'none';
        document.getElementById('result-panel').style.display = 'block';
        const resultMsg = document.getElementById('result-msg');
        const resultScore = document.getElementById('result-score-text');
        if (isNewRecord && currentSessionScore > 10) {
            resultMsg.innerHTML = "🏆 破紀錄啦！";
            resultMsg.style.color = "#d0021b";
        } else {
            resultMsg.innerHTML = "🎉 答對了！";
            resultMsg.style.color = "var(--success-color)";
        }
        resultScore.innerText = `本次得分: ${currentSessionScore}`;
        feedback.innerHTML = "";
    } else {
        feedback.innerHTML = "<span style='color:red'>💪 加油，看看解題思路！</span>";
        document.getElementById('explain-trigger').style.display = 'inline-block';
        document.getElementById('explain-trigger').innerText = "💡 點我看怎麼算";
    }
}

function appendNumber(num) { const input = document.getElementById('answer-input'); if (input.value.length < 6) input.value += num; }
function backspace() { const input = document.getElementById('answer-input'); input.value = input.value.slice(0, -1); }
function clearInput() { document.getElementById('answer-input').value = ''; }
function setProblem(text) { document.getElementById('problem-text').innerText = text; }

function resetUI() {
    document.getElementById('mini-feedback').innerHTML = "";
    document.getElementById('keypad').style.display = 'grid';
    document.getElementById('result-panel').style.display = 'none';
    document.getElementById('check-btn').style.display = 'none';
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('explain-trigger').style.display = 'none';
    document.getElementById('explain-trigger').innerText = "💡 查看解題思路";
}

function generateStepHTML(hint, s1, s2) { return `<div style="color:#666; margin-bottom:10px;">💡 提示：${hint}</div><div class="step-box"><strong>Step 1:</strong><br> ${s1}</div><div class="step-box" style="border-left-color: var(--success-color);"><strong>Step 2:</strong><br> ${s2}</div>`; }

function prepareExplanation() {
    if (currentMode === 'mixed') currentExplanationHTML = mixedProblem.html;
    else {
        let logic = "";
        if (currentMode === 'add') logic = `把 ${num1} 和 ${num2} 合起來。`;
        if (currentMode === 'subtract') logic = `從 ${num1} 拿走 ${num2}。`;
        if (currentMode === 'multiply') logic = `${num1} 個 ${num2} 相加。`;
        if (currentMode === 'divide') logic = `${num1} 分成 ${num2} 份。`;
        currentExplanationHTML = `<p style="font-size:1.1rem;">${logic}</p><div class="step-box">答案是： ${correctAnswer}</div>`;
    }
}

function openModal() { document.getElementById('modal-body').innerHTML = currentExplanationHTML; const modal = document.getElementById('explanation-modal'); modal.style.display = 'flex'; setTimeout(() => modal.classList.add('active'), 10); document.getElementById('answer-input').blur(); }
function closeModal() { const modal = document.getElementById('explanation-modal'); modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 300); }
function closeModalOutside(event) { if (event.target.id === 'explanation-modal') closeModal(); }
