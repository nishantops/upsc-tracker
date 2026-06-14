// =========================================================================
// UPSC Tracker - Sync & Metrics Module
// =========================================================================

async function syncLatestCloudState() {
    if(!dbClient) return;
    try {
        const plansPromise = dbClient.from('upsc_custom_plans').select('*').eq('user_id', currentUserId);
        const progressPromise = dbClient.from('upsc_tracker_progress').select('*').eq('user_id', currentUserId);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));

        const [plansRes, progressRes] = await Promise.race([
            Promise.all([plansPromise, progressPromise]),
            timeoutPromise
        ]);

        if (plansRes.data) {
            plansRes.data.forEach(plan => {
                buildPlanCardDOM(plan.plan_title, plan.plan_id, plan.plan_type);
            });
        }

        if (progressRes.data) {
            progressRes.data.forEach(row => {
                const noteValue = row.topic_note || '';
                if(row.id.startsWith('custom_')) {
                    const parts = row.id.split('_');
                    const targetBox = parts[1];
                    const encodedPayload = parts.slice(2).join('_');
                    try {
                        const decodedText = decodeURIComponent(escape(atob(encodedPayload)));
                        buildCustomTopicNode(targetBox, decodedText, row.id, row.is_checked, noteValue);
                    } catch(e) {}
                }
                else if (row.id.startsWith('plan_card_')) {
                    const noteInput = document.getElementById('note-' + row.id);
                    if (noteInput) noteInput.value = noteValue;
                }
                else if (row.id.startsWith('plan_task_')) {
                    const parts = row.id.split('_');
                    const planB64 = parts[2];
                    const taskB64 = parts[3];
                    try {
                        const decodedTask = decodeURIComponent(escape(atob(taskB64)));
                        buildPlanTaskDOM(planB64, decodedTask, row.id, row.is_checked, noteValue);
                    } catch(e) {}
                }
                else {
                    const box = document.getElementById(row.id);
                    const noteInput = document.getElementById('note-' + row.id);
                    if (box) box.checked = row.is_checked;
                    if (noteInput) noteInput.value = noteValue;
                }

                if(row.is_checked && row.id && !row.id.startsWith('plan_card_')) { toggleNoteLock(row.id, true); }
            });
        }

        document.getElementById("sync-status-text").innerText = "CLOUD SYNCED ACROSS DEVICES";
        document.getElementById("sync-status-indicator").className = "inline-block w-2.5 h-2.5 rounded-full bg-emerald-500";
        calculateMetricsHUD(); calculatePlanPies();
    } catch(e) {
        document.getElementById("sync-status-text").innerText = "OFFLINE: DB CONNECTION REJECTED";
        document.getElementById("sync-status-indicator").className = "inline-block w-2.5 h-2.5 rounded-full bg-rose-500";
    }
}

// Debounced auto-save for note inputs
const _syncTimers = {};
function debouncedSync(elementId) {
    if (_syncTimers[elementId]) clearTimeout(_syncTimers[elementId]);
    document.getElementById("sync-status-text").innerText = "SAVING...";
    document.getElementById("sync-status-indicator").className = "inline-block w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse";
    _syncTimers[elementId] = setTimeout(() => {
        handleSyncAction(elementId);
        delete _syncTimers[elementId];
    }, 1500);
}

async function handleSyncAction(elementId) {
    const isChecked = document.getElementById(elementId) ? document.getElementById(elementId).checked : false;
    const noteInput = document.getElementById('note-' + elementId);
    const noteText = noteInput ? noteInput.value : '';

    toggleNoteLock(elementId, isChecked);
    calculateMetricsHUD(); calculatePlanPies();

    if(!dbClient) return;
    try {
        const pushPromise = dbClient.from('upsc_tracker_progress').upsert({ id: elementId, user_id: currentUserId, is_checked: isChecked, topic_note: noteText, updated_at: new Date().toISOString() }, { onConflict: 'id,user_id' });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
        await Promise.race([pushPromise, timeoutPromise]);
        document.getElementById("sync-status-text").innerText = "CLOUD SYNCED ACROSS DEVICES";
        document.getElementById("sync-status-indicator").className = "inline-block w-2.5 h-2.5 rounded-full bg-emerald-500";
    } catch(e) {
        document.getElementById("sync-status-text").innerText = "SYNC FAILED: NETWORK OFFLINE";
        document.getElementById("sync-status-indicator").className = "inline-block w-2.5 h-2.5 rounded-full bg-rose-500";
    }
}

function calculateMetricsHUD() {
    const allBoxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    const syllabusBoxes = allBoxes.filter(b => !b.id.startsWith('plan_') && !b.id.startsWith('uid-pyq') && !b.id.startsWith('uid-ts') && !b.id.startsWith('uid-pq') && !b.id.startsWith('uid-qg') && !b.id.startsWith('uid-qa') && !b.id.startsWith('uid-tp') && !b.id.startsWith('uid-tg') && !b.id.startsWith('uid-te') && !b.id.startsWith('uid-ta'));

    let total = syllabusBoxes.length, checked = 0;
    syllabusBoxes.forEach(b => { if(b.checked) checked++; });

    document.getElementById("global-count-total").innerText = total;
    document.getElementById("global-count-checked").innerText = checked;
    const percentage = total > 0 ? ((checked / total) * 100).toFixed(1) : 0;
    document.getElementById("global-perc-text").innerText = percentage + "%";
    document.getElementById("global-progress-bar").style.width = percentage + "%";

    const prefixes = ['p1', 'p2', 'gs1', 'gs2', 'gs3', 'gs4', 'a1', 'a2', 'ca'];
    prefixes.forEach(pfx => {
        const secBoxes = document.querySelectorAll(`input[type="checkbox"][id*="-${pfx}-"]`);
        let sTotal = secBoxes.length, sChecked = 0;
        secBoxes.forEach(b => { if(b.checked) sChecked++; });

        const sPct = sTotal > 0 ? Math.round((sChecked / sTotal) * 100) : 0;
        const theme = pieColors[pfx];
        const pieEl = document.getElementById(`pie-${pfx}`);
        const lblEl = document.getElementById(`lbl-${pfx}`);

        if (pieEl && lblEl) {
            lblEl.innerText = sPct + "%";
            lblEl.style.backgroundColor = theme.hex + '33';
            lblEl.style.color = theme.hex;
            pieEl.style.background = `conic-gradient(${theme.hex} ${sPct}%, rgba(51,65,85,0.6) 0%)`;
            if (sPct > 0) { pieEl.style.border = 'none'; } else { pieEl.style.border = '2px solid rgba(139,92,246,0.3)'; }
        }
    });
}

function trackLiveClockTimelines() {
    const pDate = new Date(ENV.PRELIMS_DATE).getTime();
    const mDate = new Date(ENV.MAINS_DATE).getTime();
    function update() {
        const now = new Date();
        document.getElementById("live-date-hud").innerText = now.toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
        const ms = now.getTime();
        document.getElementById("prelims-countdown-live").innerText = pDate > ms ? Math.floor((pDate - ms) / (1000*60*60*24)) + " Days" : "Passed";
        document.getElementById("mains-countdown-live").innerText = mDate > ms ? Math.floor((mDate - ms) / (1000*60*60*24)) + " Days" : "Executed";
    }
    update(); setInterval(update, 60000);
}
