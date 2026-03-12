const vscode = acquireVsCodeApi();
const quiz = window.__quiz;

const labels = ['A', 'B', 'C', 'D'];

document.body.innerHTML = `
  <div id="topic">${quiz.topic} のクイズ</div>
  <div id="question-box">
    <div id="question">${quiz.question}</div>
  </div>
  <ul id="choices">
    ${quiz.choices.map((c, i) => `
      <li><button data-index="${i}">
        <span class="choice-label">${labels[i]}:</span>
        <span class="choice-text">${c}</span>
      </button></li>
    `).join('')}
  </ul>
  <div id="result"></div>
  <div id="footer">
    <button id="history-btn">履歴を開く</button>
  </div>
`;

document.getElementById('history-btn').addEventListener('click', () => {
    vscode.postMessage({ type: 'showHistory' });
});

document.getElementById('choices').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) { return; }
    btn.classList.add('selected');
    document.querySelectorAll('button').forEach(b => b.disabled = true);
    vscode.postMessage({ type: 'answer', index: Number(btn.dataset.index) });
});

window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'result') {
        const resultEl = document.getElementById('result');
        resultEl.textContent = msg.correct ? '正解！' : `不正解。正解は「${labels[msg.answer]}: ${quiz.choices[msg.answer]}」`;
        resultEl.className = msg.correct ? 'correct' : 'incorrect';
        if (!msg.correct) {
            const correctBtn = document.querySelector(`#choices button[data-index="${msg.answer}"]`);
            correctBtn?.classList.add('correct-answer');
        }
        resultEl.insertAdjacentHTML('beforeend', `<p class="explanation">${msg.explanation}</p>`);
        resultEl.insertAdjacentHTML('beforeend', `<button id="next-btn">次の問題を表示する</button>`);

        document.getElementById('next-btn').addEventListener('click', () => {
            const btn = document.getElementById('next-btn');
            btn.disabled = true;
            btn.textContent = '生成中...';
            vscode.postMessage({ type: 'nextQuiz' });
        });
    }
});
