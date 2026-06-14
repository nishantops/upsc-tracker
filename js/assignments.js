// =========================================================================
// UPSC Tracker - Assignments Module
// =========================================================================

function openCustomTopicModal() {
    document.getElementById('modal-target-wrapper').classList.remove('hidden');
    document.getElementById('modal-asn-fields').classList.add('hidden');
    document.getElementById("modal-title-display").innerText = "📂 Add Custom Entry";
    document.getElementById("custom-modal").classList.remove('hidden');
}
function openAssignmentModal() {
    document.getElementById('modal-select-panel').value = 'box-anthro-asn';
    document.getElementById('modal-target-wrapper').classList.add('hidden');
    document.getElementById("modal-title-display").innerText = "🎓 Add New Assignment";
    document.getElementById('modal-asn-fields').classList.remove('hidden');
    document.getElementById("custom-modal").classList.remove('hidden');
}
function closeCustomTopicModal() { document.getElementById("custom-modal").classList.add('hidden'); document.getElementById("modal-text-content").value = ""; document.getElementById('modal-asn-fields').classList.add('hidden'); document.getElementById('modal-asn-total').value = ''; document.getElementById('modal-asn-attempted').value = ''; }

function executeInjectCustomNode() {
    const targetBox = document.getElementById("modal-select-panel").value;
    const textValue = document.getElementById("modal-text-content").value.trim();
    if (!textValue) return alert("Cannot be empty.");

    const isAssignment = targetBox === 'box-anthro-asn';
    let noteData = '';
    if (isAssignment) {
        const total = parseInt(document.getElementById('modal-asn-total').value) || 0;
        const attempted = parseInt(document.getElementById('modal-asn-attempted').value) || 0;
        if (total < 1) return alert("Total questions must be at least 1.");
        if (attempted > total) return alert("Attempted cannot exceed total.");
        noteData = JSON.stringify({ total: total, attempted: attempted, userNote: '', feedback: '' });
    }

    const encodedSafeText = btoa(unescape(encodeURIComponent(textValue)));
    const generatedCloudId = `custom_${targetBox}_${encodedSafeText}`;

    buildCustomTopicNode(targetBox, textValue, generatedCloudId, false, noteData);
    handleSyncAction(generatedCloudId);
    closeCustomTopicModal();
}

function buildCustomTopicNode(targetBoxId, text, fullId, isChecked, noteText) {
    const container = document.getElementById(targetBoxId);
    if(!container || document.getElementById(fullId)) return;

    const checkAttr = isChecked ? 'checked' : '';
    const isAssignment = targetBoxId === 'box-anthro-asn';

    if (isAssignment) {
        let asnData = { total: 0, attempted: 0, userNote: '', feedback: '' };
        try { asnData = JSON.parse(noteText); } catch(e) { asnData.userNote = noteText || ''; }
        const total = asnData.total || 0;
        const attempted = Math.min(asnData.attempted || 0, total);
        const pct = total > 0 ? Math.round((attempted / total) * 100) : 0;
        const pieColor = pct >= 75 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#f43f5e';
        const pieGradient = total > 0 ? `conic-gradient(${pieColor} ${pct}%, rgba(100,116,139,0.3) 0%)` : 'rgba(100,116,139,0.2)';

        const htmlNode = `
        <div id="${fullId}" class="asn-card rounded-2xl p-4 transition group relative">
            <div class="flex items-center gap-4">
                <div class="asn-pie" style="background: ${pieGradient}; display:flex; align-items:center; justify-content:center;">
                    <div style="width:36px;height:36px;border-radius:50%;background:rgba(15,23,42,0.9);display:flex;align-items:center;justify-content:center;">
                        <span class="text-[10px] font-black text-white font-mono">${pct}%</span>
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="bg-amber-500/20 text-amber-300 text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider font-black border border-amber-500/30">Assignment</span>
                        <input type="checkbox" id="cb-${fullId}" onchange="handleAssignmentCheck('${fullId}')" class="h-4 w-4 rounded border-slate-500 text-emerald-500 cursor-pointer" ${checkAttr}>
                    </div>
                    <h4 class="text-sm font-bold text-slate-100 leading-tight break-words ${isChecked ? 'line-through text-slate-500' : ''}">${text}</h4>
                    <div class="flex items-center gap-3 mt-1.5">
                        <span class="text-[10px] font-mono text-slate-400">Total: <strong class="text-violet-300">${total}</strong></span>
                        <span class="text-[10px] font-mono text-slate-400">Done: <strong class="text-emerald-300">${attempted}</strong></span>
                        <span class="text-[10px] font-mono text-slate-400">Left: <strong class="text-rose-300">${total - attempted}</strong></span>
                    </div>
                </div>
                <div class="flex flex-col gap-1">
                    <button onclick="editAssignmentProgress('${fullId}')" class="text-violet-400 hover:text-violet-300 transition cursor-pointer" title="Update progress"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
                    <button onclick="eraseCustomNode('${fullId}', this)" class="text-slate-500 hover:text-rose-400 transition cursor-pointer" title="Delete"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                </div>
            </div>
            <div class="mt-3 ml-16 space-y-2">
                <input type="text" id="note-${fullId}" data-asn-json='${JSON.stringify(asnData).replace(/'/g, "&#39;")}' oninput="debouncedSyncAssignment('${fullId}')" value="${asnData.userNote || ''}" placeholder="Add a note..." class="w-full bg-slate-900/40 border border-violet-500/20 rounded-lg p-2 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-violet-400 focus:bg-slate-900/60 transition-all placeholder-slate-500 ${isChecked ? 'locked-note' : ''}">
                <textarea id="feedback-${fullId}" oninput="debouncedSyncAssignment('${fullId}')" placeholder="Write feedback / self-review for this assignment..." rows="2" class="w-full bg-slate-900/40 border border-amber-500/20 rounded-lg p-2 text-[11px] font-mono text-amber-200/80 focus:outline-none focus:border-amber-400 focus:bg-slate-900/60 transition-all placeholder-slate-500 resize-none ${isChecked ? 'locked-note' : ''}">${asnData.feedback || ''}</textarea>
            </div>
        </div>`;
        container.insertAdjacentHTML('beforeend', htmlNode);
    } else {
        const badgeStr = 'Added Task';
        const colorStr = 'bg-indigo-600';
        const htmlNode = `
        <div class="task-row flex flex-col p-3.5 rounded-2xl transition group relative">
            <div class="flex justify-between items-start w-full">
                <label for="${fullId}" class="flex items-start cursor-pointer w-full text-xs sm:text-sm font-bold tracking-tight select-none">
                    <input type="checkbox" id="${fullId}" onchange="handleSyncAction('${fullId}')" class="mt-0.5 mr-3.5 h-5 w-5 rounded-md border-violet-400/50 text-indigo-600 cursor-pointer" ${checkAttr}>
                    <span class="text-slate-200 group-has-[:checked]:text-slate-500 group-has-[:checked]:line-through break-words font-medium flex items-center flex-wrap gap-2">
                        <span class="${colorStr} text-white text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-black shadow-sm">${badgeStr}</span>
                        ${text}
                    </span>
                </label>
                <button onclick="eraseCustomNode('${fullId}', this)" class="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition cursor-pointer ml-4"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>
            <div class="mt-2 ml-10 w-[calc(100%-2.5rem)]">
                <input type="text" id="note-${fullId}" oninput="debouncedSync('${fullId}')" value="${noteText || ''}" placeholder="Add a note or reminder here..." class="w-full bg-slate-900/40 border border-violet-500/20 rounded-lg p-2 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-violet-400 focus:bg-slate-900/60 transition-all placeholder-slate-500 ${isChecked ? 'locked-note' : ''}" ${isChecked ? 'readonly' : ''}>
            </div>
        </div>`;
        container.insertAdjacentHTML('beforeend', htmlNode);
    }
    calculateMetricsHUD();
}

async function eraseCustomNode(id, btnElement) {
    if(confirm("Permanently erase this from the cloud database?")) {
        btnElement.closest('.task-row, .asn-card, [id^=plan_card_wrapper]').remove();
        calculateMetricsHUD(); calculatePlanPies();
        if(dbClient) {
            if (id.startsWith('plan_meta_')) {
                const planId = id.substring(10);
                await dbClient.from('upsc_custom_plans').delete().eq('plan_id', planId).eq('user_id', currentUserId);
                await dbClient.from('upsc_tracker_progress').delete().like('id', `plan_task_${planId}_%`).eq('user_id', currentUserId);
                await dbClient.from('upsc_tracker_progress').delete().eq('id', `plan_card_${planId}`).eq('user_id', currentUserId);
            } else {
                await dbClient.from('upsc_tracker_progress').delete().eq('id', id).eq('user_id', currentUserId);
            }
        }
    }
}

function editAssignmentProgress(fullId) {
    const cardEl = document.getElementById(fullId);
    if (!cardEl) return;
    const noteInput = document.getElementById('note-' + fullId);
    const feedbackInput = document.getElementById('feedback-' + fullId);
    let asnData = { total: 0, attempted: 0, userNote: '', feedback: '' };
    try {
        const stored = noteInput ? noteInput.dataset.asnJson || '' : '';
        asnData = JSON.parse(stored);
    } catch(e) {}
    const newAttempted = prompt(`Update questions attempted (out of ${asnData.total}):`, asnData.attempted);
    if (newAttempted === null) return;
    const val = parseInt(newAttempted);
    if (isNaN(val) || val < 0 || val > asnData.total) { alert(`Must be between 0 and ${asnData.total}`); return; }
    asnData.attempted = val;
    asnData.userNote = noteInput ? noteInput.value : '';
    asnData.feedback = feedbackInput ? feedbackInput.value : '';
    cardEl.remove();
    const targetBoxId = 'box-anthro-asn';
    const parts = fullId.split('_');
    const encodedPayload = parts.slice(2).join('_');
    let decodedText = '';
    try { decodedText = decodeURIComponent(escape(atob(encodedPayload))); } catch(e) { decodedText = 'Assignment'; }
    const noteJson = JSON.stringify(asnData);
    buildCustomTopicNode(targetBoxId, decodedText, fullId, false, noteJson);
    syncAssignmentToCloud(fullId, noteJson);
}

function handleAssignmentCheck(fullId) {
    const cbEl = document.getElementById('cb-' + fullId);
    const isChecked = cbEl ? cbEl.checked : false;
    const noteInput = document.getElementById('note-' + fullId);
    const feedbackInput = document.getElementById('feedback-' + fullId);
    let asnData = { total: 0, attempted: 0, userNote: '', feedback: '' };
    try { asnData = JSON.parse(noteInput ? noteInput.dataset.asnJson || '{}' : '{}'); } catch(e) {}
    asnData.userNote = noteInput ? noteInput.value : '';
    asnData.feedback = feedbackInput ? feedbackInput.value : '';
    const noteJson = JSON.stringify(asnData);
    calculateMetricsHUD();
    if (!dbClient) return;
    dbClient.from('upsc_tracker_progress').upsert({ id: fullId, user_id: currentUserId, is_checked: isChecked, topic_note: noteJson, updated_at: new Date().toISOString() }, { onConflict: 'id,user_id' });
}

function debouncedSyncAssignment(fullId) {
    clearTimeout(window['_asnTimer_' + fullId]);
    window['_asnTimer_' + fullId] = setTimeout(() => {
        const noteInput = document.getElementById('note-' + fullId);
        const feedbackInput = document.getElementById('feedback-' + fullId);
        if (!noteInput) return;
        let asnData = { total: 0, attempted: 0, userNote: '', feedback: '' };
        try { asnData = JSON.parse(noteInput.dataset.asnJson || '{}'); } catch(e) {}
        asnData.userNote = noteInput.value;
        asnData.feedback = feedbackInput ? feedbackInput.value : '';
        const noteJson = JSON.stringify(asnData);
        noteInput.dataset.asnJson = noteJson;
        syncAssignmentToCloud(fullId, noteJson);
    }, 800);
}

async function syncAssignmentToCloud(fullId, noteJson) {
    if (!dbClient) return;
    try {
        const cbEl = document.getElementById('cb-' + fullId);
        const isChecked = cbEl ? cbEl.checked : false;
        await dbClient.from('upsc_tracker_progress').upsert({ id: fullId, user_id: currentUserId, is_checked: isChecked, topic_note: noteJson, updated_at: new Date().toISOString() }, { onConflict: 'id,user_id' });
        document.getElementById("sync-status-text").innerText = "CLOUD SYNCED ACROSS DEVICES";
        document.getElementById("sync-status-indicator").className = "inline-block w-2.5 h-2.5 rounded-full bg-emerald-500";
    } catch(e) {
        document.getElementById("sync-status-text").innerText = "SYNC FAILED: NETWORK OFFLINE";
        document.getElementById("sync-status-indicator").className = "inline-block w-2.5 h-2.5 rounded-full bg-rose-500";
    }
}
