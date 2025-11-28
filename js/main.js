// Main Navigation and Global Initialization

window.onload = function () {
    // Default show main menu, hide others
    showMainMenu();

    // Initialize Math Game
    if (typeof initMathGame === 'function') {
        initMathGame();
    }

    // Initialize Touch Feedback (Global)
    initTouchFeedback();
};

function showMainMenu() {
    document.getElementById('main-menu-container').style.display = 'block';
    document.getElementById('math-game-container').style.display = 'none';
    document.getElementById('gomoku-game-container').style.display = 'none';
}

function showMathGame() {
    document.getElementById('main-menu-container').style.display = 'none';
    document.getElementById('math-game-container').style.display = 'block';
    document.getElementById('home-menu').style.display = 'block';
    document.getElementById('practice-area').style.display = 'none';

    // Math Game Specific Updates
    if (typeof loadHighScores === 'function') loadHighScores();
    if (typeof updateMenuScores === 'function') updateMenuScores();
}

function showGomokuGame() {
    document.getElementById('main-menu-container').style.display = 'none';
    document.getElementById('gomoku-game-container').style.display = 'block';

    // Initialize Gomoku Controller if not already done
    if (typeof initGomokuGame === 'function') {
        initGomokuGame();
    }
}

function initTouchFeedback() {
    const keys = document.querySelectorAll('.key-btn');
    keys.forEach(btn => {
        btn.addEventListener('touchstart', function (e) {
            this.classList.add('pressed');
        }, { passive: true });
        btn.addEventListener('touchend', function (e) {
            this.classList.remove('pressed');
        });
        btn.addEventListener('touchcancel', function (e) {
            this.classList.remove('pressed');
        });
    });
}

// Helper function for random numbers (used globally or in math game)
function r(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
