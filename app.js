// app.js - 網站版生詞分析助手 (新增避開清單選擇功能)

let tbclData = {};
let allDefaultVocab = new Set(); // 所有預設詞彙
let oldVocab = new Set(); // 當前使用的舊詞集合
let analyzedVocab = [];

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadTBCLData();
  await loadDefaultVocab();
  await loadCustomVocab();
  
  // 綁定事件
  document.getElementById('analyzeBtn').addEventListener('click', analyzeText);
  document.getElementById('clearBtn').addEventListener('click', clearInput);
  document.getElementById('copyBtn').addEventListener('click', copyAllVocab);
  document.getElementById('exportBtn').addEventListener('click', exportJSON);
  
  document.getElementById('addOldVocabBtn').addEventListener('click', () => saveOldVocab('add'));
  document.getElementById('replaceOldVocabBtn').addEventListener('click', () => saveOldVocab('replace'));
  document.getElementById('showOldVocabBtn').addEventListener('click', showOldVocab);
  document.getElementById('clearOldVocabBtn').addEventListener('click', clearOldVocab);
  
  // 綁定避開清單選擇事件
  document.getElementById('selectAllBtn').addEventListener('click', selectAllBooks);
  document.getElementById('deselectAllBtn').addEventListener('click', deselectAllBooks);
  
  // 綁定每個checkbox的change事件
  const checkboxes = document.querySelectorAll('#bookCheckboxes input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const item = e.target.closest('.checkbox-item');
      if (e.target.checked) {
        item.classList.add('checked');
      } else {
        item.classList.remove('checked');
      }
      updateOldVocabFromSelection();
      updateExcludeStats();
    });
  });
  
  // 點擊checkbox-item也能切換
  document.querySelectorAll('.checkbox-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        const checkbox = item.querySelector('input[type="checkbox"]');
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
    });
  });
  
  updateVocabCount();
  updateExcludeStats();
});

// 載入 TBCL 資料
async function loadTBCLData() {
  try {
    const response = await fetch('tbcl_data.json');
    tbclData = await response.json();
    console.log('TBCL 資料載入成功,共', Object.keys(tbclData).length, '個詞彙');
  } catch (error) {
    console.error('載入 TBCL 資料失敗:', error);
    showStatus('載入 TBCL 資料失敗,請確認 tbcl_data.json 檔案存在', 'error');
  }
}

// 載入預設詞彙(B1-B6L1)
async function loadDefaultVocab() {
  try {
    const response = await fetch('default_vocab.txt');
    const text = await response.text();
    const words = text.split('\n').map(w => w.trim()).filter(w => w.length > 0);
    
    // 將所有預設詞彙存入 allDefaultVocab
    allDefaultVocab = new Set(words);
    
    console.log('預設詞彙載入成功,共', allDefaultVocab.size, '個詞彙');
    updateOldVocabFromSelection();
  } catch (error) {
    console.error('載入預設詞彙失敗:', error);
    showStatus('載入預設詞彙失敗,請確認 default_vocab.txt 檔案存在', 'error');
  }
}

// 載入自訂舊詞
async function loadCustomVocab() {
  const storedVocab = localStorage.getItem('customOldVocabList');
  if (storedVocab) {
    const customVocab = JSON.parse(storedVocab);
    customVocab.forEach(word => oldVocab.add(word));
  }
  updateVocabCount();
}

// 根據選擇更新舊詞集合
function updateOldVocabFromSelection() {
  const selectedBooks = getSelectedBooks();
  
  // 重新建立舊詞集合
  oldVocab = new Set();
  
  // 如果有勾選任何冊別,加入預設詞彙
  if (selectedBooks.length > 0) {
    allDefaultVocab.forEach(word => oldVocab.add(word));
  }
  
  // 加入使用者自訂的舊詞
  const storedVocab = localStorage.getItem('customOldVocabList');
  if (storedVocab) {
    const customVocab = JSON.parse(storedVocab);
    customVocab.forEach(word => oldVocab.add(word));
  }
  
  updateVocabCount();
}

// 獲取選中的冊別
function getSelectedBooks() {
  const checkboxes = document.querySelectorAll('#bookCheckboxes input[type="checkbox"]');
  const selected = [];
  checkboxes.forEach(checkbox => {
    if (checkbox.checked) {
      selected.push(checkbox.value);
    }
  });
  return selected;
}

// 全選
function selectAllBooks() {
  const checkboxes = document.querySelectorAll('#bookCheckboxes input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = true;
    checkbox.closest('.checkbox-item').classList.add('checked');
  });
  updateOldVocabFromSelection();
  updateExcludeStats();
}

// 全不選
function deselectAllBooks() {
  const checkboxes = document.querySelectorAll('#bookCheckboxes input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
    checkbox.closest('.checkbox-item').classList.remove('checked');
  });
  updateOldVocabFromSelection();
  updateExcludeStats();
}

// 更新避開統計
function updateExcludeStats() {
  const selectedBooks = getSelectedBooks();
  const excludedBooksEl = document.getElementById('excludedBooks');
  const excludedCountEl = document.getElementById('excludedCount');
  
  if (selectedBooks.length === 0) {
    excludedBooksEl.textContent = '無(不過濾任何詞彙)';
    excludedCountEl.textContent = '0 個';
  } else {
    excludedBooksEl.textContent = selectedBooks.join(', ');
    // 計算預設詞彙數量
    const defaultCount = selectedBooks.length > 0 ? allDefaultVocab.size : 0;
    excludedCountEl.textContent = `${defaultCount} 個`;
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
  
  // 收集所有詞彙(保持出現順序)
  const wordsInOrder = [];
  const seenWords = new Set();
  
  for (const segment of segments) {
    const word = segment.segment.trim();
    
    // 過濾:只保留包含中文字元的詞
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
    showStatus('未發現新生詞(所有詞彙都在舊詞清單中)', 'info');
  } else {
    showStatus(`分析完成!找到 ${wordsInOrder.length} 個生詞`, 'success');
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
  
  let statsHTML = `<div class="stats-row"><strong>總計:</strong><span>${total} 個生詞</span></div>`;
  
  // 排序等級
  const sortedLevels = Object.keys(levelStats).sort((a, b) => {
    if (a === '未知/超綱') return 1;
    if (b === '未知/超綱') return -1;
    return parseInt(a.replace('Level ', '')) - parseInt(b.replace('Level ', ''));
  });
  
  sortedLevels.forEach(level => {
    statsHTML += `<div class="stats-row"><strong>${level}:</strong><span>${levelStats[level]} 個</span></div>`;
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
    showStatus('已複製到剪貼簿!', 'success');
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
  
  showStatus('已匯出 JSON 檔案!', 'success');
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
    showVocabStatus('請輸入詞彙!', 'error');
    return;
  }
  
  // 解析輸入的詞彙
  const newVocabList = parseVocabInput(input);
  
  if (newVocabList.length === 0) {
    showVocabStatus('未偵測到有效的中文詞彙!', 'error');
    return;
  }
  
  // 取得目前的自訂舊詞(不包括預設舊詞)
  const storedVocab = localStorage.getItem('customOldVocabList');
  const customVocab = storedVocab ? JSON.parse(storedVocab) : [];
  
  let finalVocabList = [];
  
  if (mode === 'add') {
    // 累加模式:合併
    finalVocabList = [...new Set([...customVocab, ...newVocabList])];
    showVocabStatus(`成功新增!自訂舊詞共 ${finalVocabList.length} 個`, 'success');
  } else {
    // 覆蓋模式
    finalVocabList = newVocabList;
    showVocabStatus(`成功覆蓋!自訂舊詞共 ${finalVocabList.length} 個`, 'success');
  }
  
  // 儲存到 localStorage
  localStorage.setItem('customOldVocabList', JSON.stringify(finalVocabList));
  
  // 重新載入舊詞清單
  updateOldVocabFromSelection();
  
  // 清空輸入框
  document.getElementById('oldVocabInput').value = '';
}

// 解析輸入的詞彙
function parseVocabInput(input) {
  const text = input
    .replace(/[,、，]/g, '\n')
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
  // 只顯示自訂的舊詞
  const storedVocab = localStorage.getItem('customOldVocabList');
  if (!storedVocab || JSON.parse(storedVocab).length === 0) {
    document.getElementById('oldVocabInput').value = '';
    showVocabStatus('目前沒有自訂舊詞', 'info');
    return;
  }
  
  const customVocab = JSON.parse(storedVocab);
  const vocabArray = [...customVocab].sort((a, b) => a.localeCompare(b, 'zh-TW'));
  document.getElementById('oldVocabInput').value = vocabArray.join('\n');
  showVocabStatus(`已顯示 ${vocabArray.length} 個自訂舊詞`, 'success');
}

// 清除舊詞
function clearOldVocab() {
  const confirmed = confirm('確定要清除所有自訂舊詞嗎?(預設的 B1-B6L1 詞彙不會被刪除)');
  
  if (!confirmed) return;
  
  localStorage.removeItem('customOldVocabList');
  updateOldVocabFromSelection();
  document.getElementById('oldVocabInput').value = '';
  showVocabStatus('已清除自訂舊詞', 'success');
}

// 更新舊詞數量
function updateVocabCount() {
  const storedVocab = localStorage.getItem('customOldVocabList');
  const customCount = storedVocab ? JSON.parse(storedVocab).length : 0;
  document.getElementById('vocabCount').textContent = `${customCount} 個`;
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