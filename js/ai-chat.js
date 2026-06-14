// =========================================================================
// AI CHAT MODULE — Gemini-powered UPSC Study Assistant
// Lightweight, Gemini-only, persistent chat history
// =========================================================================

const AI_CHAT = (() => {
    let isOpen = false;
    let chatHistory = [];
    const STORAGE_KEY = 'upsc_ai_chat_history';
    const CUSTOM_KEY_STORAGE = 'upsc_ai_key_gemini_custom';

    // Default key (free tier, shared across all users)
    // Users can override with their own key in settings
    const DEFAULT_KEY = (typeof ENV !== 'undefined' && ENV.GEMINI_API_KEY) || '';

    function getApiKey() {
        return localStorage.getItem(CUSTOM_KEY_STORAGE) || DEFAULT_KEY;
    }

    function loadHistory() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) chatHistory = JSON.parse(saved);
        } catch(e) { chatHistory = []; }
    }

    function saveHistory() {
        try {
            // Keep last 50 messages to prevent storage bloat
            const trimmed = chatHistory.slice(-50);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        } catch(e) { /* storage full, silent */ }
    }

    function getCurrentSectionContext() {
        let context = 'UPSC CSE Command Center tracker app.\n';
        const name = document.getElementById('user-display-name')?.textContent || 'User';
        const pct = document.getElementById('global-perc-text')?.textContent || '0%';
        context += `Student: ${name}, Progress: ${pct}\n`;

        const marathon = document.getElementById('view-marathon');
        const planner = document.getElementById('view-planner');
        if (marathon && !marathon.classList.contains('hidden')) context += 'Section: Marathon Tracker\n';
        else if (planner && !planner.classList.contains('hidden')) context += 'Section: Strategy Planner\n';
        return context;
    }

    async function callGemini(message, apiKey) {
        const systemInstruction = `You are an expert UPSC CSE preparation assistant. Help with syllabus, strategy, current affairs, answer writing, and study planning. Be concise and actionable.\n\nContext:\n${getCurrentSectionContext()}`;

        // Only send last 10 messages as context to keep requests fast
        const recentHistory = chatHistory.slice(-10).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));
        recentHistory.push({ role: 'user', parts: [{ text: message }] });

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemInstruction }] },
                contents: recentHistory,
                generationConfig: { maxOutputTokens: 800, temperature: 0.7 }
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `API error: ${response.status}`);
        }
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    async function sendMessage(msg) {
        const inputEl = document.getElementById('ai-chat-input');
        const message = msg || inputEl?.value || '';
        if (!message.trim()) return;
        if (inputEl) inputEl.value = '';

        const apiKey = getApiKey();
        if (!apiKey) {
            appendMessage('system', '⚠️ No API key configured. Click ⚙️ to add your Gemini key.');
            return;
        }

        appendMessage('user', message);
        chatHistory.push({ role: 'user', content: message });
        saveHistory();

        const typingEl = appendMessage('assistant', '● ● ●');
        typingEl.classList.add('typing-indicator');

        try {
            const reply = await callGemini(message, apiKey);
            typingEl.remove();
            appendMessage('assistant', reply);
            chatHistory.push({ role: 'assistant', content: reply });
            saveHistory();
        } catch(e) {
            typingEl.remove();
            const msg = e.message.includes('quota') || e.message.includes('429')
                ? '⚠️ Rate limit reached. Please wait a moment and try again.'
                : `❌ ${e.message}`;
            appendMessage('system', msg);
        }
    }

    function appendMessage(role, content) {
        const container = document.getElementById('ai-chat-messages');
        const div = document.createElement('div');
        div.className = `ai-msg ai-msg-${role}`;
        div.innerHTML = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return div;
    }

    function renderSavedHistory() {
        const container = document.getElementById('ai-chat-messages');
        if (!container || !chatHistory.length) return;
        container.innerHTML = '';
        chatHistory.forEach(m => appendMessage(m.role, m.content));
    }

    function toggle() {
        isOpen = !isOpen;
        const panel = document.getElementById('ai-chat-panel');
        const fab = document.getElementById('ai-chat-fab');
        if (isOpen) {
            panel.classList.remove('hidden');
            fab.innerHTML = '✕';
            fab.style.background = 'linear-gradient(135deg, #ef4444, #f97316)';
            if (!document.getElementById('ai-chat-messages').children.length && chatHistory.length) {
                renderSavedHistory();
            }
        } else {
            panel.classList.add('hidden');
            fab.innerHTML = '🤖';
            fab.style.background = 'linear-gradient(135deg, #6366f1, #a855f7)';
        }
    }

    function showSettings() {
        document.getElementById('ai-settings-panel').classList.remove('hidden');
        document.getElementById('ai-chat-view').classList.add('hidden');
        const customKey = localStorage.getItem(CUSTOM_KEY_STORAGE);
        document.getElementById('ai-key-gemini').value = customKey ? '••••••' + customKey.slice(-4) : '';
    }

    function hideSettings() {
        document.getElementById('ai-settings-panel').classList.add('hidden');
        document.getElementById('ai-chat-view').classList.remove('hidden');
    }

    function saveSettings() {
        const val = document.getElementById('ai-key-gemini').value.trim();
        if (val && !val.startsWith('••••')) {
            localStorage.setItem(CUSTOM_KEY_STORAGE, val);
        }
        hideSettings();
        appendMessage('system', '✅ Custom API key saved.');
    }

    function clearChat() {
        chatHistory = [];
        localStorage.removeItem(STORAGE_KEY);
        document.getElementById('ai-chat-messages').innerHTML = '';
        appendMessage('system', '🤖 Chat cleared. Ask me anything about UPSC prep!');
    }

    // Load history on init
    loadHistory();

    return { toggle, sendMessage, showSettings, hideSettings, saveSettings, clearChat };
})();
