// =========================================================================
// UPSC Tracker - Sources CRUD Module
// =========================================================================

function openSourceModal(editId) {
    document.getElementById('source-modal').classList.remove('hidden');
    document.getElementById('source-edit-id').value = editId || '';
    if (editId) {
        document.getElementById('source-modal-title').innerHTML = '✏️ Edit Source';
        const card = document.getElementById(`source-card-${editId}`);
        if (card) {
            document.getElementById('source-input-title').value = card.dataset.title || '';
            document.getElementById('source-input-link').value = card.dataset.link || '';
            document.getElementById('source-input-topic').value = card.dataset.topic || 'General';
            document.getElementById('source-input-notes').value = card.dataset.notes || '';
        }
    } else {
        document.getElementById('source-modal-title').innerHTML = '📚 Add New Source';
    }
}

function closeSourceModal() {
    document.getElementById('source-modal').classList.add('hidden');
    document.getElementById('source-input-title').value = '';
    document.getElementById('source-input-link').value = '';
    document.getElementById('source-input-topic').value = 'General';
    document.getElementById('source-input-notes').value = '';
    document.getElementById('source-edit-id').value = '';
}

async function saveSource() {
    const title = document.getElementById('source-input-title').value.trim();
    const link = document.getElementById('source-input-link').value.trim();
    const topic = document.getElementById('source-input-topic').value;
    const notes = document.getElementById('source-input-notes').value.trim();
    const editId = document.getElementById('source-edit-id').value;

    if (!title) { alert('Title is required.'); return; }

    const sourceId = editId || ('src_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8));

    if (dbClient && currentUserId) {
        try {
            await dbClient.from('upsc_user_sources').upsert({
                source_id: sourceId,
                user_id: currentUserId,
                title: title,
                link: link || null,
                topic: topic,
                notes: notes || null
            }, { onConflict: 'source_id,user_id' });
        } catch(e) { console.error('Save source error:', e); }
    }

    closeSourceModal();
    loadSources();
}

async function deleteSource(sourceId) {
    if (!confirm('Delete this source permanently?')) return;
    if (dbClient && currentUserId) {
        try {
            await dbClient.from('upsc_user_sources').delete().eq('source_id', sourceId).eq('user_id', currentUserId);
        } catch(e) { console.error('Delete source error:', e); }
    }
    loadSources();
}

async function loadSources() {
    const container = document.getElementById('sources-container');
    const emptyEl = document.getElementById('sources-empty');
    if (!dbClient || !currentUserId) return;

    try {
        const { data, error } = await dbClient.from('upsc_user_sources').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false });
        if (error) throw error;

        container.innerHTML = '';
        if (!data || data.length === 0) {
            emptyEl.style.display = 'block';
            return;
        }
        emptyEl.style.display = 'none';

        const topicColors = {
            'General': 'from-slate-100 to-gray-100 border-slate-300 text-slate-700',
            'Current Affairs': 'from-amber-50 to-orange-50 border-amber-300 text-amber-700',
            'History': 'from-rose-50 to-pink-50 border-rose-300 text-rose-700',
            'Geography': 'from-emerald-50 to-green-50 border-emerald-300 text-emerald-700',
            'Polity': 'from-blue-50 to-indigo-50 border-blue-300 text-blue-700',
            'Economy': 'from-violet-50 to-purple-50 border-violet-300 text-violet-700',
            'Science & Tech': 'from-cyan-50 to-sky-50 border-cyan-300 text-cyan-700',
            'Environment': 'from-lime-50 to-green-50 border-lime-300 text-lime-700',
            'Ethics': 'from-fuchsia-50 to-pink-50 border-fuchsia-300 text-fuchsia-700',
            'Anthropology': 'from-orange-50 to-amber-50 border-orange-300 text-orange-700',
            'Essay': 'from-teal-50 to-emerald-50 border-teal-300 text-teal-700',
            'Newspaper': 'from-yellow-50 to-amber-50 border-yellow-300 text-yellow-700',
            'YouTube': 'from-red-50 to-rose-50 border-red-300 text-red-700',
            'Test Series': 'from-indigo-50 to-violet-50 border-indigo-300 text-indigo-700',
            'Other': 'from-gray-50 to-slate-50 border-gray-300 text-gray-700'
        };

        data.forEach(src => {
            const colorClass = topicColors[src.topic] || topicColors['Other'];
            const linkHtml = src.link
                ? `<a href="${src.link}" target="_blank" rel="noopener" class="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-500 mt-2 truncate transition-all hover:underline">
                    <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                    <span class="truncate">${src.link}</span>
                   </a>`
                : '';
            const notesHtml = src.notes ? `<p class="text-[11px] text-slate-500 mt-2 line-clamp-2 font-medium">${src.notes}</p>` : '';

            container.innerHTML += `
                <div id="source-card-${src.source_id}" class="neo-card rounded-2xl p-5 border-l-4 border-l-transparent bg-gradient-to-br ${colorClass} relative group transition-all hover:shadow-lg"
                     data-title="${src.title}" data-link="${src.link || ''}" data-topic="${src.topic}" data-notes="${src.notes || ''}">
                    <div class="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="openSourceModal('${src.source_id}')" class="p-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-500 hover:text-violet-600 shadow-sm transition-all cursor-pointer" title="Edit">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>
                        </button>
                        <button onclick="deleteSource('${src.source_id}')" class="p-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-500 hover:text-rose-600 shadow-sm transition-all cursor-pointer" title="Delete">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
                        </button>
                    </div>
                    <div class="flex items-start gap-3">
                        <div class="flex-shrink-0 w-9 h-9 rounded-xl bg-white/80 flex items-center justify-center shadow-sm border border-white/60">
                            <span class="text-base">${src.link ? '🔗' : '📄'}</span>
                        </div>
                        <div class="flex-1 min-w-0 pr-12">
                            <h4 class="font-bold text-sm text-slate-800 truncate">${src.title}</h4>
                            <span class="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/60 border border-current/20">${src.topic}</span>
                            ${linkHtml}
                            ${notesHtml}
                        </div>
                    </div>
                    <!-- Spreadsheet table toggle -->
                    <div style="margin-top:0.65rem;border-top:1px solid rgba(0,0,0,0.06);padding-top:0.5rem;display:flex;align-items:center;justify-content:space-between;">
                        <button onclick="toggleSourceTable('${src.source_id}')" id="src-tbl-btn-${src.source_id}" style="font-size:0.62rem;font-weight:700;font-family:var(--mono);background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);color:#6366f1;border-radius:0.35rem;padding:0.2rem 0.6rem;cursor:pointer;">⊞ Table</button>
                    </div>
                    <div id="src-tbl-${src.source_id}" style="display:none;margin-top:0.5rem;">
                        <div id="plan-table-container-${src.source_id}" class="pt-container"></div>
                    </div>
                </div>`;
        });
    } catch(e) {
        console.error('Load sources error:', e);
    }
}

function toggleSourceTable(sourceId) {
    var wrap = document.getElementById('src-tbl-' + sourceId);
    var btn  = document.getElementById('src-tbl-btn-' + sourceId);
    if (!wrap) return;
    var isOpen = wrap.style.display !== 'none';
    wrap.style.display = isOpen ? 'none' : 'block';
    if (btn) btn.textContent = isOpen ? '⊞ Table' : '⊟ Hide Table';
    if (!isOpen && typeof loadPlanTables === 'function') {
        loadPlanTables(sourceId);
    }
}
