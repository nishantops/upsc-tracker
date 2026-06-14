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
        const name = document.getElementById('user-display-name')?.textContent || 'User';
        const pct = document.getElementById('global-perc-text')?.textContent || '0%';
        const checked = document.getElementById('global-count-checked')?.textContent || '0';
        const total = document.getElementById('global-count-total')?.textContent || '0';
        const prelimsDays = document.getElementById('prelims-countdown-live')?.textContent || '---';
        const mainsDays = document.getElementById('mains-countdown-live')?.textContent || '---';

        // Collect section-wise completion
        const sections = ['p1','p2','gs1','gs2','gs3','gs4','a1','a2','ca'].map(id => {
            const el = document.getElementById('lbl-' + id);
            return el ? `${id.toUpperCase()}: ${el.textContent}` : null;
        }).filter(Boolean).join(', ');

        // Detect active view
        let activeView = 'Marathon Tracker';
        if (!document.getElementById('view-planner')?.classList.contains('hidden')) activeView = 'Strategy Planner';
        let activeTab = '';
        if (activeView === 'Marathon Tracker') {
            if (!document.getElementById('master-syllabus')?.classList.contains('hidden')) activeTab = 'Syllabus';
            else if (!document.getElementById('master-ca')?.classList.contains('hidden')) activeTab = 'Current Affairs';
            else if (!document.getElementById('master-pyq')?.classList.contains('hidden')) activeTab = 'PYQ (Previous Year Questions)';
            else if (!document.getElementById('master-testseries')?.classList.contains('hidden')) activeTab = 'Test Series';
        }

        return `Student: ${name}
Overall Progress: ${pct} (${checked}/${total} units checked)
Countdown: Prelims ${prelimsDays}, Mains ${mainsDays}
Section Completion: ${sections}
Active View: ${activeView}${activeTab ? ' > ' + activeTab : ''}`;
    }

    async function callGemini(message, apiKey) {
        const APP_KNOWLEDGE = `You are the built-in AI assistant of "UPSC CSE Command Center 2027" — a personal tracker app built by Nishant Kumar for UPSC Civil Services Examination preparation (target: 2027).

APP FEATURES YOU MUST KNOW:
1. MARATHON TRACKER (main view):
   - Syllabus tab: Full UPSC syllabus broken into checkable units across Prelims (GS Paper I, CSAT), Mains (GS-I to GS-IV, Essay, Languages), and Anthropology Optional (Paper I, II, Assignments)
   - CA Tracker tab: Monthly Current Affairs tracking with newspaper/magazine links, "My CA Links" self-service tab
   - PYQ tab: Previous Year Questions (2013-2025) for Prelims GS & CSAT, Mains GS-I to GS-IV, Anthro — searchable, filterable by year
   - Test Series tab: Track test performance across all papers

2. STRATEGY PLANNER (second root view):
   - My Plans: Create custom plans (Daily/Weekly/Monthly) with isolated progress
   - Sources & Links: Manage study resources and bookmarks

3. KEY METRICS:
   - Global Syllabus Absorption % (across all sections)
   - Section-wise pie charts (P1, P2, GS1-4, A1, A2, CA)
   - Prelims & Mains countdown timers
   - Custom topic addition

4. OTHER FEATURES:
   - Google OAuth + Email sign-in via Supabase
   - Auto-save (debounced) on all inputs
   - 15-minute session timeout
   - Custom CA links management
   - Profile (name/alias) stored in DB
   - Dark glassmorphism UI

BEHAVIOR RULES:
- You have access to the student's LIVE progress data (provided below). Reference it when giving advice.
- Be specific: mention their actual percentages, days left, weak sections.
- Give actionable UPSC-specific advice: booklist suggestions, answer writing tips, revision strategies, current affairs sources.
- If asked about app features, explain them from the list above.
- Keep answers concise (2-4 paragraphs max) unless detailed explanation requested.`;

        const systemInstruction = `${APP_KNOWLEDGE}\n\nLIVE DATA:\n${getCurrentSectionContext()}`;

        // Only send last 10 messages as context to keep requests fast
        const recentHistory = chatHistory.slice(-10).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));
        recentHistory.push({ role: 'user', parts: [{ text: message }] });

        const model = (typeof ENV !== 'undefined' && ENV.GEMINI_MODEL) || 'gemini-1.5-pro';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
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
        div.setAttribute('data-raw', content);
        div.innerHTML = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
        if (role === 'user') {
            div.title = 'Click to edit';
            div.addEventListener('click', () => editMessage(div, content));
        }
        container.appendChild(div);
        requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
        return div;
    }

    function editMessage(msgEl, originalText) {
        const inputEl = document.getElementById('ai-chat-input');
        if (!inputEl) return;
        inputEl.value = originalText;
        inputEl.focus();
        // Remove this message and its response from history & DOM
        const container = document.getElementById('ai-chat-messages');
        const msgs = Array.from(container.children);
        const idx = msgs.indexOf(msgEl);
        // Remove from idx onwards (user msg + assistant reply)
        for (let i = msgs.length - 1; i >= idx; i--) {
            msgs[i].remove();
        }
        // Trim chatHistory to match
        const userMsgIndex = chatHistory.findIndex((m, hi) => {
            let count = 0;
            for (let j = 0; j <= hi; j++) { if (chatHistory[j].role === 'user') count++; }
            return count === Math.ceil((idx + 1) / 2) && m.role === 'user';
        });
        if (userMsgIndex >= 0) {
            chatHistory = chatHistory.slice(0, userMsgIndex);
            saveHistory();
        }
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
