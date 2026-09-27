 
  const LEVELS = {
    easy:   { rows: 9,  cols: 9,  mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    hard:   { rows: 16, cols: 30, mines: 99 }
  };

  let currentLevel = 'easy';
  let board = [];
  let rows, cols, totalMines;
  let revealedCount = 0;
  let flagCount = 0;
  let gameOver = false;
  let firstClick = true;
  let timer = 0;
  let timerInterval = null;

  const boardEl = document.getElementById('board');
  const mineCounterEl = document.getElementById('mineCounter');
  const timerEl = document.getElementById('timer');
  const resetBtn = document.getElementById('resetBtn');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const modalText = document.getElementById('modalText');
  const modalBtn = document.getElementById('modalBtn');

  function pad(n) {
    return String(Math.max(0, Math.min(999, n))).padStart(3, '0');
  }

  function updateMineCounter() {
    mineCounterEl.textContent = pad(totalMines - flagCount);
  }

  function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
      timer++;
      timerEl.textContent = pad(timer);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  function resetTimer() {
    stopTimer();
    timer = 0;
    timerEl.textContent = pad(0);
  }

  function initGame() {

    // Инициализация VK Bridge
    if (window.vkBridge) {
        vkBridge.send('VKWebAppInit')
            .then(() => console.log('✅ VK Bridge успешно инициализирован'))
            .catch((error) => console.error('❌ Ошибка инициализации VK Bridge:', error));
    }

    const cfg = LEVELS[currentLevel];
    rows = cfg.rows;
    cols = cfg.cols;
    totalMines = cfg.mines;

    board = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push({
          mine: false,
          revealed: false,
          flagged: false,
          adjacent: 0,
          r, c
        });
      }
      board.push(row);
    }

    revealedCount = 0;
    flagCount = 0;
    gameOver = false;
    firstClick = true;
    resetTimer();
    updateMineCounter();
    resetBtn.textContent = '😊';
    renderBoard();
  }

  function placeMines(safeR, safeC) {
    let placed = 0;
    const safeCells = new Set();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        safeCells.add(`${safeR + dr},${safeC + dc}`);
      }
    }

    while (placed < totalMines) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      if (!board[r][c].mine && !safeCells.has(`${r},${c}`)) {
        board[r][c].mine = true;
        placed++;
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].mine) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].mine) {
              count++;
            }
          }
        }
        board[r][c].adjacent = count;
      }
    }
  }

function renderBoard() {
    boardEl.innerHTML = '';
    
    // Адаптивный размер ячеек в зависимости от уровня сложности
    let cellSize = 32; // Базовый размер
    
    if (currentLevel === 'hard') {
        cellSize = 22; // Уменьшаем для уровня "Эксперт"
    } else if (currentLevel === 'medium') {
        cellSize = 22; // Чуть меньше для "Любителя"
    }
    
    // Устанавливаем сетку
    boardEl.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
    
    // Обновляем CSS для ячеек
    const style = document.createElement('style');
    style.textContent = `
        .cell {
            width: ${cellSize}px !important;
            height: ${cellSize}px !important;
            font-size: ${cellSize * 0.55}px !important;
        }
    `;
    document.head.appendChild(style);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = board[r][c];
            const el = document.createElement('div');
            el.className = 'cell';
            el.dataset.r = r;
            el.dataset.c = c;

            el.addEventListener('click', () => handleClick(r, c));
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                handleRightClick(r, c);
            });

            boardEl.appendChild(el);
            cell.el = el;
        }
    }
}

  function revealCell(r, c) {
    const cell = board[r][c];
    if (cell.revealed || cell.flagged) return;

    cell.revealed = true;
    revealedCount++;
    const el = cell.el;
    el.classList.add('revealed');

    if (cell.mine) {
      el.classList.add('mine-exploded');
      el.textContent = '💣';
      return;
    }

    if (cell.adjacent > 0) {
      el.textContent = cell.adjacent;
      el.classList.add('n' + cell.adjacent);
    } else {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            revealCell(nr, nc);
          }
        }
      }
    }
  }

  function handleClick(r, c) {
    if (gameOver) return;
    const cell = board[r][c];
    if (cell.flagged || cell.revealed) return;

    if (firstClick) {
      placeMines(r, c);
      firstClick = false;
      startTimer();
    }

    if (cell.mine) {
      gameOver = true;
      stopTimer();
      resetBtn.textContent = '😵';
      revealCell(r, c);
      revealAllMines();
      setTimeout(() => showModal(false), 600);
      return;
    }

    revealCell(r, c);
    checkWin();
  }

  function handleRightClick(r, c) {
    if (gameOver) return;
    const cell = board[r][c];
    if (cell.revealed) return;

    if (cell.flagged) {
      cell.flagged = false;
      flagCount--;
      cell.el.classList.remove('flagged');
      cell.el.textContent = '';
    } else {
      cell.flagged = true;
      flagCount++;
      cell.el.classList.add('flagged');
      cell.el.textContent = '🚩';
    }
    updateMineCounter();
  }

  function revealAllMines() {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = board[r][c];
        if (cell.mine && !cell.revealed) {
          cell.el.classList.add('revealed', 'mine-shown');
          cell.el.textContent = '💣';
        }
      }
    }
  }

  function checkWin() {
    if (revealedCount === rows * cols - totalMines) {
      gameOver = true;
      stopTimer();
      resetBtn.textContent = '😎';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = board[r][c];
          if (cell.mine && !cell.flagged) {
            cell.flagged = true;
            cell.el.classList.add('flagged');
            cell.el.textContent = '🚩';
          }
        }
      }
      flagCount = totalMines;
      updateMineCounter();
      setTimeout(() => showModal(true), 400);
    }
  }

function showModal(won) {
    if (won) {
        modalTitle.textContent = '🎉 Победа!';
        modalText.textContent = `Вы разминировали поле за ${timer} сек!`;
        
        // Магия VK Bridge: предлагаем поделиться победой
        if (window.vkBridge) {
            vkBridge.send('VKWebAppShowWallPostBox', {
                message: `Я разминировал поле в Сапёре за ${timer} сек! Попробуй побить мой рекорд! 💣🚩 #Сапёр #VKMiniApps`
            }).catch(() => {
                // Если пользователь отменил публикацию или мы тестируем не в ВК, просто игнорируем ошибку
                console.log('Публикация отменена или недоступна вне ВК');
            });
        }
    } else {
        modalTitle.textContent = '💥 Поражение!';
        modalText.textContent = 'Вы наступили на мину...';
    }
    modal.classList.add('show');
}

  modalBtn.addEventListener('click', () => {
    modal.classList.remove('show');
    initGame();
  });

  resetBtn.addEventListener('click', initGame);

  document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentLevel = btn.dataset.level;
      initGame();
    });
  });

  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.board')) e.preventDefault();
  });

 initGame(); 