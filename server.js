require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const { createClient } = require('redis');
const app = express();
const port = process.env.PORT || 3000;

// Redis
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redisClient.connect().catch(console.error);

// Middleware
app.use(bodyParser.json());

// Endpoint lưu API key và student level
app.post('/save-settings', async (req, res) => {
  const { apiKey, studentLevel } = req.body;
  await redisClient.set('apiKey', apiKey);
  await redisClient.set('studentLevel', studentLevel);
  res.json({ success: true });
});

// Endpoint chat
app.post('/chat', async (req, res) => {
  const message = req.body.message;
  const apiKey = await redisClient.get('apiKey');
  const studentLevel = await redisClient.get('studentLevel') || 'trung bình';

  if (!apiKey) return res.status(400).json({ error: 'API key chưa được thiết lập' });

  try {
    // Gọi API Gemimi
    const response = await fetch('https://api.gemimi.ai/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        studentLevel
      })
    });
    const data = await response.json();
    res.json({ reply: data.reply || 'Không có phản hồi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server AI' });
  }
});

// Giao diện web gộp trong server
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>AI Chat</title>
<style>
body { font-family: Arial; background:#f5f5f5; margin:0; }
.chat-container { width: 100%; max-width: 700px; margin:50px auto; border:1px solid #ccc; background:#fff; border-radius:8px; display:flex; flex-direction:column; }
.chat-header { padding:10px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #ccc; }
.chat-box { flex:1; padding:10px; overflow-y:auto; min-height:300px; }
.chat-input { display:flex; border-top:1px solid #ccc; }
.chat-input input { flex:1; padding:10px; border:none; outline:none; }
.chat-input button { padding:10px 20px; border:none; background:#007bff; color:#fff; cursor:pointer; }
.message { margin:5px 0; }
.user { text-align:right; color:#007bff; }
.ai { text-align:left; color:#333; }
#settings { display:none; position:absolute; top:60px; right:20px; background:#fff; border:1px solid #ccc; padding:10px; border-radius:5px; }
#settings input, #settings select { margin-bottom:5px; width:100%; padding:5px; }
</style>
</head>
<body>
<div class="chat-container">
  <div class="chat-header">
    <h2>AI Chat</h2>
    <button id="settingsBtn">⋮</button>
  </div>
  <div id="chatBox" class="chat-box"></div>
  <div class="chat-input">
    <input type="text" id="userInput" placeholder="Nhập tin nhắn...">
    <button id="sendBtn">Gửi</button>
  </div>
</div>
<div id="settings">
  <input type="text" id="apiKeyInput" placeholder="Nhập API key">
  <select id="levelSelect">
    <option value="giỏi">Học sinh giỏi</option>
    <option value="khá">Học sinh khá</option>
    <option value="trung bình" selected>Học sinh trung bình</option>
    <option value="yếu">Học sinh yếu</option>
  </select>
  <button id="saveSettings">Lưu</button>
</div>
<script>
const chatBox = document.getElementById('chatBox');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settings = document.getElementById('settings');
const saveSettingsBtn = document.getElementById('saveSettings');
const apiKeyInput = document.getElementById('apiKeyInput');
const levelSelect = document.getElementById('levelSelect');

settingsBtn.onclick = () => settings.style.display = settings.style.display==='block'?'none':'block';

saveSettingsBtn.onclick = async () => {
  const apiKey = apiKeyInput.value.trim();
  const studentLevel = levelSelect.value;
  if(!apiKey) return alert('Nhập API key');
  await fetch('/save-settings', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({apiKey, studentLevel})
  });
  alert('Lưu thành công!');
  settings.style.display='none';
}

sendBtn.onclick = async () => {
  const message = userInput.value.trim();
  if(!message) return;
  appendMessage(message,'user');
  userInput.value='';
  try{
    const res = await fetch('/chat',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message})});
    const data = await res.json();
    appendMessage(data.reply||'','ai');
  }catch(e){
    appendMessage('Lỗi server AI','ai');
  }
}

function appendMessage(msg,cls){
  const div = document.createElement('div');
  div.className='message '+cls;
  div.textContent=msg;
  chatBox.appendChild(div);
  chatBox.scrollTop=chatBox.scrollHeight;
}

userInput.addEventListener('keypress', e => { if(e.key==='Enter') sendBtn.click(); });
</script>
</body>
</html>
  `);
});

app.listen(port, () => console.log(`Server chạy tại http://localhost:${port}`));
