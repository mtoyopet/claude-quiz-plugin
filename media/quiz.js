const vscode = acquireVsCodeApi();
const quiz = window.__quiz;

document.body.innerHTML = `
  <div id="topic">${quiz.topic} のクイズ</div>
  <div id="question">${quiz.question}</div>
  <ul id="choices">
    ${quiz.choices.map((c, i) => `
      <li><button data-index="${i}">${c}</button></li>
    `).join('')}
  </ul>
  <div id="result"></div>
`;

document.getElementById('choices').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) { return; }
    document.querySelectorAll('button').forEach(b => b.disabled = true);
    vscode.postMessage({ type: 'answer', index: Number(btn.dataset.index) });
});

window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type !== 'result') { return; }

    const resultEl = document.getElementById('result');
    resultEl.textContent = msg.correct ? '正解！' : `不正解。正解は「${quiz.choices[msg.answer]}」`;
    resultEl.className = msg.correct ? 'correct' : 'incorrect';
    resultEl.insertAdjacentHTML('beforeend', `<p class="explanation">${msg.explanation}</p>`);
});
