// =========================================================================
// UPSC Tracker - Plans Module (v2)
// =========================================================================

function openPlannerModal() { document.getElementById('plan-modal').classList.remove('hidden'); }
function closePlannerModal() {
    document.getElementById('plan-modal').classList.add('hidden');
    document.getElementById('modal-plan-title').value = '';
    document.getElementById('modal-plan-start-date').value = '';
    document.getElementById('modal-plan-end-date').value = '';
    var cat = document.getElementById('modal-plan-category');
    var div = document.getElementById('modal-plan-division');
    var notif = document.getElementById('modal-plan-notif');
    var subj = document.getElementById('modal-plan-subject');
    var customName = document.getElementById('modal-plan-custom-name');
    if (cat) { cat.value = 'common'; onPlanCategoryChange('common'); }
    if (div) div.value = 'both';
    if (notif) notif.checked = true;
    if (subj) subj.value = '';
    if (customName) customName.value = '';
}

function onPlanCategoryChange(val) {
    var subjWrap   = document.getElementById('modal-plan-subject-wrap');
    var customWrap = document.getElementById('modal-plan-custom-name-wrap');
    var subjLabel  = document.getElementById('modal-plan-subject-label');
    var gsLabels   = { gs1:'Subject in GS 1', gs2:'Subject in GS 2', gs3:'Subject in GS 3', gs4:'Subject in GS 4', essay:'Essay Topic / Niche', optional:'Optional Subject', common:'Focus Area (optional)' };
    if (val === 'custom') {
        if (subjWrap)   subjWrap.style.display   = 'none';
        if (customWrap) customWrap.style.display = 'block';
    } else if (['gs1','gs2','gs3','gs4','essay','optional','common'].includes(val)) {
        if (subjWrap)   subjWrap.style.display   = 'block';
        if (customWrap) customWrap.style.display = 'none';
        if (subjLabel)  subjLabel.textContent    = gsLabels[val] || 'Subject / Topic';
    } else {
        if (subjWrap)   subjWrap.style.display   = 'none';
        if (customWrap) customWrap.style.display = 'none';
    }
}

async function executeCreatePlan() {
    var title    = document.getElementById('modal-plan-title').value.trim();
    var type     = document.getElementById('modal-plan-type').value;
    var startDate = document.getElementById('modal-plan-start-date').value || null;
    var endDate   = document.getElementById('modal-plan-end-date').value || null;
    var catEl    = document.getElementById('modal-plan-category');
    var divEl    = document.getElementById('modal-plan-division');
    var notifEl  = document.getElementById('modal-plan-notif');
    var subjEl   = document.getElementById('modal-plan-subject');
    var customNameEl = document.getElementById('modal-plan-custom-name');
    var category = catEl ? catEl.value : 'common';
    var division = divEl ? divEl.value : 'both';
    var notifEnabled = notifEl ? notifEl.checked : true;
    var planSubject  = subjEl && subjEl.value.trim() ? subjEl.value.trim() : '';
    var customName   = customNameEl && customNameEl.value.trim() ? customNameEl.value.trim() : '';
    if (category === 'custom' && customName) planSubject = customName;

    if (!title) { alert('Plan Title required'); return; }

    var encodedName = btoa(unescape(encodeURIComponent(title)));
    buildPlanCardDOM(title, encodedName, type, startDate, endDate, category, division, notifEnabled, planSubject);

    if (dbClient) {
        await dbClient.from('upsc_custom_plans').upsert({
            plan_id: encodedName, user_id: currentUserId,
            plan_title: title, plan_type: type,
            start_date: startDate, end_date: endDate,
            plan_category: category, plan_division: division,
            notif_enabled: notifEnabled,
            plan_subject: planSubject || null
        }, { onConflict: 'plan_id,user_id' });
    }
    closePlannerModal();
}

// Category colour mapping
var PLAN_CAT_STYLES = {
    common:   { bg: 'rgba(99,102,241,0.15)',  text: '#818cf8', bdr: 'rgba(99,102,241,0.35)'  },
    gs1:      { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24', bdr: 'rgba(245,158,11,0.35)'  },
    gs2:      { bg: 'rgba(16,185,129,0.15)',  text: '#34d399', bdr: 'rgba(16,185,129,0.35)'  },
    gs3:      { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', bdr: 'rgba(59,130,246,0.35)'  },
    gs4:      { bg: 'rgba(236,72,153,0.15)',  text: '#f472b6', bdr: 'rgba(236,72,153,0.35)'  },
    essay:    { bg: 'rgba(139,92,246,0.15)',  text: '#a78bfa', bdr: 'rgba(139,92,246,0.35)'  },
    optional: { bg: 'rgba(244,63,94,0.15)',   text: '#fb7185', bdr: 'rgba(244,63,94,0.35)'   },
    custom:   { bg: 'rgba(156,163,175,0.15)', text: '#9ca3af', bdr: 'rgba(156,163,175,0.35)' }
};
var PLAN_CAT_LABELS = { common:'Common', gs1:'GS 1', gs2:'GS 2', gs3:'GS 3', gs4:'GS 4', essay:'Essay', optional:'Optional', custom:'Custom' };
var PLAN_DIV_LABELS = { prelims:'Prelims', mains:'Mains', both:'P + M' };

function buildPlanCardDOM(title, encodedName, type, startDate, endDate, category, division, notifEnabled, planSubject) {
    if (document.getElementById('plan_card_wrapper_' + encodedName)) return;
    category     = category || 'common';
    division     = division || 'both';
    notifEnabled = (notifEnabled === false) ? false : true;

    var catLabel = planSubject ? planSubject : (PLAN_CAT_LABELS[category] || category);
    var divLabel = PLAN_DIV_LABELS[division]  || division;

    var dateBadge = '';
    if (startDate || endDate) {
        dateBadge = '<div class="flex items-center gap-1.5 mt-1.5 flex-wrap">'
            + (startDate ? '<span class="plan-date-badge">&#128197; ' + formatPlanDate(startDate) + '</span>' : '')
            + (startDate && endDate ? '<span style="font-size:0.7rem;color:var(--t4);">&#8594;</span>' : '')
            + (endDate   ? '<span class="plan-date-badge">&#127937; ' + formatPlanDate(endDate)   + '</span>' : '')
            + '</div>';
    }
    var mutedBadge = !notifEnabled ? '<span class="plan-badge plan-muted-badge">&#128277; muted</span>' : '';

    var html = '<div id="plan_card_wrapper_' + encodedName + '" class="neo-card rounded-3xl p-6 border-l-4 border-emerald-500 shadow-sm relative group">'
        + '<button onclick="eraseCustomNode(\'plan_meta_' + encodedName + '\', this)" class="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition cursor-pointer" style="background:none;border:none;color:var(--t3);" title="Delete Plan">'
        + '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>'

        + '<div class="flex justify-between items-start mb-3 pr-6">'
        +   '<div>'
        +     '<h3 class="heading-font text-xl font-black" style="color:var(--t1);">' + title + '</h3>'
        +     '<div class="flex items-center gap-1.5 mt-1.5 flex-wrap">'
        +       '<span class="plan-badge plan-type-badge">' + type + '</span>'
        +       '<span class="plan-badge plan-cat-badge plan-cat-' + category + '">' + catLabel + '</span>'
        +       '<span class="plan-badge plan-div-badge">' + divLabel + '</span>'
        +       mutedBadge
        +     '</div>'
        +     dateBadge
        +   '</div>'
        +   '<div class="flex items-center gap-3 ml-3 flex-shrink-0">'
        +     '<div class="text-right"><div style="font-size:0.58rem;font-weight:800;font-family:var(--mono);text-transform:uppercase;letter-spacing:0.06em;color:var(--t3);">Done</div>'
        +     '<div id="lbl-plan-' + encodedName + '" style="font-size:0.85rem;font-weight:900;color:var(--t1);">0%</div></div>'
        +     '<div id="pie-plan-' + encodedName + '" class="pie-chart-frame w-10 h-10" style="background:var(--surf);"></div>'
        +   '</div>'
        + '</div>'

        // Strategy note
        + '<textarea id="note-plan_card_' + encodedName + '" oninput="debouncedSync(\'plan_card_' + encodedName + '\')" rows="2" placeholder="Master strategy / goals for this plan..." style="width:100%;background:var(--inp);border:1px solid var(--bdr);color:var(--t2);border-radius:0.75rem;padding:0.65rem 0.85rem;font-size:0.72rem;font-family:var(--mono);resize:none;outline:none;margin-bottom:0.75rem;" onfocus="this.style.borderColor=\'var(--bdr-h)\'" onblur="this.style.borderColor=\'var(--bdr)\'"></textarea>'

        // Tab bar
        + '<div class="plan-tabs" id="plan-tabs-' + encodedName + '">'
        +   '<button class="plan-tab-btn active" onclick="switchPlanTab(\'' + encodedName + '\',\'tasks\')" id="plan-tab-tasks-' + encodedName + '">&#9776; Tasks</button>'
        +   '<button class="plan-tab-btn" onclick="switchPlanTab(\'' + encodedName + '\',\'table\')" id="plan-tab-table-' + encodedName + '">&#9783; Table</button>'
        + '</div>'

        // Tasks pane
        + '<div id="plan-pane-tasks-' + encodedName + '" class="plan-pane">'
        +   '<div id="target-list-' + encodedName + '" class="space-y-2 mb-2"></div>'
        +   '<button onclick="addPlanTaskPrompt(\'' + encodedName + '\')" class="ptask-add-btn" id="ptask-add-btn-' + encodedName + '">'
        +     '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg> Add Sub-Target</button>'
        + '</div>'

        // Table pane (lazy loaded)
        + '<div id="plan-pane-table-' + encodedName + '" class="plan-pane hidden">'
        +   '<div id="plan-table-container-' + encodedName + '" class="pt-container">'
        +     '<div class="pt-loading">Loading table…</div>'
        +   '</div>'
        + '</div>'

        + '</div>';

    document.getElementById('planner-container').insertAdjacentHTML('afterbegin', html);
}

function switchPlanTab(encodedName, tab) {
    var tasksPane = document.getElementById('plan-pane-tasks-' + encodedName);
    var tablePane = document.getElementById('plan-pane-table-' + encodedName);
    var tasksBtn  = document.getElementById('plan-tab-tasks-' + encodedName);
    var tableBtn  = document.getElementById('plan-tab-table-' + encodedName);
    if (!tasksPane || !tablePane) return;

    if (tab === 'tasks') {
        tasksPane.classList.remove('hidden');
        tablePane.classList.add('hidden');
        if (tasksBtn) tasksBtn.classList.add('active');
        if (tableBtn) tableBtn.classList.remove('active');
    } else {
        tasksPane.classList.add('hidden');
        tablePane.classList.remove('hidden');
        if (tasksBtn) tasksBtn.classList.remove('active');
        if (tableBtn) tableBtn.classList.add('active');
        if (typeof loadPlanTables === 'function') loadPlanTables(encodedName);
    }
}

// ── Inline task entry (replaces prompt()) ──────────────────────────────────
function addPlanTaskPrompt(planEncodedName) {
    // If inline form already open, just focus it
    var existing = document.getElementById('ptask-inline-' + planEncodedName);
    if (existing) { existing.querySelector('input').focus(); return; }
    // Hide the add button
    var addBtn = document.getElementById('ptask-add-btn-' + planEncodedName);
    if (addBtn) addBtn.style.display = 'none';
    // Build inline form
    var container = document.getElementById('target-list-' + planEncodedName);
    if (!container) return;
    var div = document.createElement('div');
    div.id = 'ptask-inline-' + planEncodedName;
    div.className = 'ptask-inline';
    div.innerHTML = '<input type="text" id="ptask-inline-input-' + planEncodedName
        + '" placeholder="Enter specific target or task…" class="ptask-inline-input">'
        + '<div class="ptask-inline-btns">'
        + '<button onclick="submitInlineTask(\'' + planEncodedName + '\')" class="ptask-submit">Add</button>'
        + '<button onclick="cancelInlineTask(\'' + planEncodedName + '\')" class="ptask-cancel">Cancel</button>'
        + '</div>';
    container.appendChild(div);
    var inp = document.getElementById('ptask-inline-input-' + planEncodedName);
    if (inp) {
        inp.focus();
        inp.addEventListener('keydown', function(e) {
            if (e.key === 'Enter')  submitInlineTask(planEncodedName);
            if (e.key === 'Escape') cancelInlineTask(planEncodedName);
        });
    }
}

function submitInlineTask(planEncodedName) {
    var inp = document.getElementById('ptask-inline-input-' + planEncodedName);
    var taskName = inp ? inp.value.trim() : '';
    cancelInlineTask(planEncodedName);
    if (!taskName) return;
    var taskEncoded = btoa(unescape(encodeURIComponent(taskName)));
    var fullId = 'plan_task_' + planEncodedName + '_' + taskEncoded;
    buildPlanTaskDOM(planEncodedName, taskName, fullId, false, '');
    handleSyncAction(fullId);
}

function cancelInlineTask(planEncodedName) {
    var el = document.getElementById('ptask-inline-' + planEncodedName);
    if (el) el.remove();
    var addBtn = document.getElementById('ptask-add-btn-' + planEncodedName);
    if (addBtn) addBtn.style.display = '';
}

function buildPlanTaskDOM(planEncodedName, taskText, fullId, isChecked, noteText) {
    var container = document.getElementById('target-list-' + planEncodedName);
    if (!container || document.getElementById(fullId)) return;
    var checkAttr = isChecked ? 'checked' : '';
    var lockedAttr = isChecked ? 'readonly' : '';
    var lockedClass = isChecked ? 'locked-note' : '';
    var htmlNode = '<div class="task-row flex flex-col p-3 rounded-xl transition group relative" style="background:var(--surf);border:1px solid var(--bdr);margin-bottom:0.35rem;">'
        + '<div class="flex justify-between items-start w-full">'
        + '<label for="' + fullId + '" class="flex items-start cursor-pointer w-full text-xs sm:text-sm font-bold select-none">'
        + '<input type="checkbox" id="' + fullId + '" onchange="handleSyncAction(\'' + fullId + '\')" class="plan-task-box-' + planEncodedName + ' mt-0.5 mr-3 flex-shrink-0 cursor-pointer" ' + checkAttr + '>'
        + '<span style="color:var(--t1);" class="break-words font-medium transition-all">' + taskText + '</span>'
        + '</label>'
        + '<button onclick="eraseCustomNode(\'' + fullId + '\', this)" class="opacity-0 group-hover:opacity-100 transition cursor-pointer ml-3 flex-shrink-0" style="background:none;border:none;color:var(--t3);">'
        + '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>'
        + '</button></div>'
        + '<div class="mt-2" style="padding-left:1.65rem;">'
        + '<input type="text" id="note-' + fullId + '" oninput="debouncedSync(\'' + fullId + '\')" value="' + (noteText || '') + '" placeholder="Task note..." '
        + 'style="width:100%;background:var(--inp);border:1px solid var(--bdr);color:var(--t2);border-radius:0.4rem;padding:0.3rem 0.6rem;font-size:0.65rem;font-family:var(--mono);outline:none;" '
        + 'class="' + lockedClass + '" ' + lockedAttr + '>'
        + '</div></div>';
    container.insertAdjacentHTML('beforeend', htmlNode);
    calculatePlanPies();
}

function calculatePlanPies() {
    document.querySelectorAll('[id^="pie-plan-"]').forEach(function(pieEl) {
        var encodedName = pieEl.id.replace('pie-plan-', '');
        var taskBoxes = document.querySelectorAll('.plan-task-box-' + encodedName);
        var lblEl = document.getElementById('lbl-plan-' + encodedName);
        var sTotal = taskBoxes.length, sChecked = 0;
        taskBoxes.forEach(function(b) { if (b.checked) sChecked++; });
        var sPct = sTotal > 0 ? Math.round((sChecked / sTotal) * 100) : 0;
        if (lblEl) lblEl.innerText = sPct + '%';
        pieEl.style.background = 'conic-gradient(#10b981 ' + sPct + '%, rgba(51,65,85,0.6) 0%)';
    });
}

function formatPlanDate(dateStr) {
    if (!dateStr) return '';
    try {
        var d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch(e) { return dateStr; }
}