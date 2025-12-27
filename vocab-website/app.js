// app.js - 網站版生詞分析助手

let tbclData = {};
let oldVocab = new Set();
let analyzedVocab = [];

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadTBCLData();
  await loadOldVocab();
  
  // 綁定事件
  document.getElementById('analyzeBtn').addEventListener('click', analyzeText);
  document.getElementById('clearBtn').addEventListener('click', clearInput);
  document.getElementById('copyBtn').addEventListener('click', copyAllVocab);
  document.getElementById('exportBtn').addEventListener('click', exportJSON);
  
  document.getElementById('addOldVocabBtn').addEventListener('click', () => saveOldVocab('add'));
  document.getElementById('replaceOldVocabBtn').addEventListener('click', () => saveOldVocab('replace'));
  document.getElementById('showOldVocabBtn').addEventListener('click', showOldVocab);
  document.getElementById('clearOldVocabBtn').addEventListener('click', clearOldVocab);
  
  updateVocabCount();
});

// 載入 TBCL 資料
async function loadTBCLData() {
  try {
    const response = await fetch('tbcl_data.json');
    tbclData = await response.json();
    console.log('TBCL 資料載入成功，共', Object.keys(tbclData).length, '個詞彙');
  } catch (error) {
    console.error('載入 TBCL 資料失敗:', error);
    showStatus('載入 TBCL 資料失敗，請確認 tbcl_data.json 檔案存在', 'error');
  }
}

// 載入舊詞清單
async function loadOldVocab() {
  try {
    // 先載入預設舊詞
    const response = await fetch('default_vocab.txt');
    const text = await response.text();
    const defaultVocab = text.split('\n').map(w => w.trim()).filter(w => w.length > 0);
    
    // 從 localStorage 載入使用者自訂的舊詞
    const storedVocab = localStorage.getItem('oldVocabList');
    if (storedVocab) {
      const customVocab = JSON.parse(storedVocab);
      oldVocab = new Set([...defaultVocab, ...customVocab]);
    } else {
      oldVocab = new Set(defaultVocab);
    }
    
    console.log('舊詞清單載入成功，共', oldVocab.size, '個詞彙');
    updateVocabCount();
  } catch (error) {
    console.error('載入舊詞清單失敗:', error);
  }
}

// 分析文字
function analyzeText() {
  const input = document.getElementById('textInput').value.trim();
  
  if (!input) {
    showStatus('請輸入要分析的文字', 'error');
    return;
  }
  
  // 顯示載入中
  document.getElementById('loading').classList.add('active');
  showStatus('正在分析中...', 'info');
  
  // 使用 setTimeout 讓 UI 有時間更新
  setTimeout(() => {
    performAnalysis(input);
    document.getElementById('loading').classList.remove('active');
  }, 100);
}

// 執行分析
function performAnalysis(text) {
  // Step 1: 使用 Intl.Segmenter 進行中文斷詞
  const segmenter = new Intl.Segmenter('zh-TW', { granularity: 'word' });
  const segments = segmenter.segment(text);
  
  // 收集所有詞彙（保持出現順序）
  const wordsInOrder = [];
  const seenWords = new Set();
  
  for (const segment of segments) {
    const word = segment.segment.trim();
    
    // 過濾：只保留包含中文字元的詞
    if (word.length > 0 && /[\u4e00-\u9fff]/.test(word)) {
      // Step 2: 過濾舊詞
      if (!oldVocab.has(word) && !seenWords.has(word)) {
        seenWords.add(word);
        
        // Step 3: TBCL 分級
        const level = tbclData[word] || '未知/超綱';
        
        wordsInOrder.push({
          word: word,
          level: level
        });
      }
    }
  }
  
  analyzedVocab = wordsInOrder;
  
  // Step 4: 顯示結果
  displayResults(wordsInOrder);
  
  if (wordsInOrder.length === 0) {
    showStatus('未發現新生詞（所有詞彙都在舊詞清單中）', 'info');
  } else {
    showStatus(`分析完成！找到 ${wordsInOrder.length} 個生詞`, 'success');
  }
}

// 顯示分析結果
function displayResults(vocabList) {
  const resultsDiv = document.getElementById('results');
  const statsDiv = document.getElementById('stats');
  const copyBtn = document.getElementById('copyBtn');
  const exportBtn = document.getElementById('exportBtn');
  
  resultsDiv.innerHTML = '';
  
  if (vocabList.length === 0) {
    copyBtn.disabled = true;
    exportBtn.disabled = true;
    statsDiv.style.display = 'none';
    return;
  }
  
  copyBtn.disabled = false;
  exportBtn.disabled = false;
  
  // 統計各等級數量
  const levelStats = {};
  
  vocabList.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'vocab-item';
    
    const wordSpan = document.createElement('span');
    wordSpan.className = 'vocab-word';
    wordSpan.textContent = `${index + 1}. ${item.word}`;
    
    const levelSpan = document.createElement('span');
    levelSpan.className = 'vocab-level';
    
    // 判斷等級並設定樣式
    if (item.level === '未知/超綱') {
      levelSpan.className += ' level-unknown';
      levelSpan.textContent = item.level;
      levelStats['未知/超綱'] = (levelStats['未知/超綱'] || 0) + 1;
    } else {
      const levelNum = parseInt(item.level);
      levelSpan.className += ` level-${levelNum}`;
      levelSpan.textContent = `Level ${item.level}`;
      levelStats[`Level ${item.level}`] = (levelStats[`Level ${item.level}`] || 0) + 1;
    }
    
    div.appendChild(wordSpan);
    div.appendChild(levelSpan);
    resultsDiv.appendChild(div);
  });
  
  // 顯示統計資訊
  displayStats(vocabList.length, levelStats);
}

// 顯示統計資訊
function displayStats(total, levelStats) {
  const statsDiv = document.getElementById('stats');
  statsDiv.style.display = 'block';
  
  let statsHTML = `<div class="stats-row"><strong>總計：</strong><span>${total} 個生詞</span></div>`;
  
  // 排序等級
  const sortedLevels = Object.keys(levelStats).sort((a, b) => {
    if (a === '未知/超綱') return 1;
    if (b === '未知/超綱') return -1;
    return parseInt(a.replace('Level ', '')) - parseInt(b.replace('Level ', ''));
  });
  
  sortedLevels.forEach(level => {
    statsHTML += `<div class="stats-row"><strong>${level}：</strong><span>${levelStats[level]} 個</span></div>`;
  });
  
  statsDiv.innerHTML = statsHTML;
}

// 複製所有詞彙
function copyAllVocab() {
  if (analyzedVocab.length === 0) return;
  
  let text = '生詞清單\n' + '='.repeat(30) + '\n\n';
  
  analyzedVocab.forEach((item, index) => {
    text += `${index + 1}. ${item.word} (${item.level === '未知/超綱' ? item.level : 'Level ' + item.level})\n`;
  });
  
  navigator.clipboard.writeText(text).then(() => {
    showStatus('已複製到剪貼簿！', 'success');
  }).catch(err => {
    console.error('複製失敗:', err);
    showStatus('複製失敗', 'error');
  });
}

// 匯出 JSON
function exportJSON() {
  if (analyzedVocab.length === 0) return;
  
  const data = {
    timestamp: new Date().toISOString(),
    totalWords: analyzedVocab.length,
    vocabulary: analyzedVocab
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vocabulary_analysis_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showStatus('已匯出 JSON 檔案！', 'success');
}

// 清空輸入
function clearInput() {
  document.getElementById('textInput').value = '';
  document.getElementById('results').innerHTML = '';
  document.getElementById('stats').style.display = 'none';
  document.getElementById('copyBtn').disabled = true;
  document.getElementById('exportBtn').disabled = true;
  analyzedVocab = [];
}

// 儲存舊詞清單
function saveOldVocab(mode) {
  const input = document.getElementById('oldVocabInput').value.trim();
  
  if (!input) {
    showVocabStatus('請輸入詞彙！', 'error');
    return;
  }
  
  // 解析輸入的詞彙
  const newVocabList = parseVocabInput(input);
  
  if (newVocabList.length === 0) {
    showVocabStatus('未偵測到有效的中文詞彙！', 'error');
    return;
  }
  
  // 取得目前的自訂舊詞（不包括預設舊詞）
  const storedVocab = localStorage.getItem('oldVocabList');
  const customVocab = storedVocab ? JSON.parse(storedVocab) : [];
  
  let finalVocabList = [];
  
  if (mode === 'add') {
    // 累加模式：合併
    finalVocabList = [...new Set([...customVocab, ...newVocabList])];
    showVocabStatus(`成功新增！自訂舊詞共 ${finalVocabList.length} 個`, 'success');
  } else {
    // 覆蓋模式
    finalVocabList = newVocabList;
    showVocabStatus(`成功覆蓋！自訂舊詞共 ${finalVocabList.length} 個`, 'success');
  }
  
  // 儲存到 localStorage
  localStorage.setItem('oldVocabList', JSON.stringify(finalVocabList));
  
  // 重新載入舊詞清單
  loadOldVocab();
  
  // 清空輸入框
  document.getElementById('oldVocabInput').value = '';
}

// 解析輸入的詞彙
function parseVocabInput(input) {
  const text = input
    .replace(/[,，、]/g, '\n')
    .replace(/\s+/g, '\n')
    .split('\n')
    .map(word => word.trim())
    .filter(word => word.length > 0 && /[\u4e00-\u9fff]/.test(word));
  
  const uniqueVocab = [...new Set(text)];
  uniqueVocab.sort((a, b) => a.localeCompare(b, 'zh-TW'));
  
  return uniqueVocab;
}

// 顯示目前舊詞
async function showOldVocab() {
  const vocabArray = Array.from(oldVocab).sort((a, b) => a.localeCompare(b, 'zh-TW'));
  document.getElementById('oldVocabInput').value = vocabArray.join('\n');
  showVocabStatus(`已顯示 ${vocabArray.length} 個舊詞`, 'success');
}

// 清除舊詞
function clearOldVocab() {
  const confirmed = confirm('確定要清除所有自訂舊詞嗎？（預設的 B1-B6L1 詞彙不會被刪除）');
  
  if (!confirmed) return;
  
  localStorage.removeItem('oldVocabList');
  loadOldVocab();
  document.getElementById('oldVocabInput').value = '';
  showVocabStatus('已清除自訂舊詞', 'success');
}

// 更新舊詞數量
function updateVocabCount() {
  const count = oldVocab.size;
  document.getElementById('vocabCount').textContent = `${count} 個`;
}

// 顯示狀態訊息
function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
  
  if (type !== 'info') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
}

// 顯示舊詞管理狀態訊息
function showVocabStatus(message, type) {
  const statusDiv = document.getElementById('vocabStatus');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
  
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}
