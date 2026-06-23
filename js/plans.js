// =========================================================================
// UPSC Tracker - Plans Module (v3) — card grid + drawer + gantt
// =========================================================================

// Module state
var _planDataStore   = {};   // { enc: { title, type, startDate, endDate, category, division, notifEnabled, planSubject, contentType } }
var _activeDrawerPlan = null;
var _activeDrawerTab  = 'tasks';

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
    var content = document.getElementById('modal-plan-content');
    if (cat) { cat.value = 'common'; onPlanCategoryChange('common'); }
    if (div) div.value = 'both';
    if (notif) notif.checked = true;
    if (subj) subj.value = '';
    if (customName) customName.value = '';
    if (content) content.value = 'both';
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
    var contentEl    = document.getElementById('modal-plan-content');
    var contentType  = contentEl ? contentEl.value : 'both';
    if (category === 'custom' && customName) planSubject = customName;

    if (!title) { alert('Plan Title required'); return; }

    var encodedName = btoa(unescape(encodeURIComponent(title)));
    buildPlanCardDOM(title, encodedName, type, startDate, endDate, category, division, notifEnabled, planSubject, contentType);

    if (dbClient) {
        await dbClient.from('upsc_custom_plans').upsert({
            plan_id: encodedName, user_id: currentUserId,
            plan_title: title, plan_type: type,
            start_date: startDate, end_date: endDate,
            plan_category: category, plan_division: division,
            notif_enabled: notifEnabled,
            plan_subject: planSubject || null,
            content_type: contentType
        }, { onConflict: 'plan_id,user_id' });
    }
    closePlannerModal();
}

function buildPlanCardDOM(title, encodedName, type, startDate, endDate, category, division, notifEnabled, planSubject, contentType) {
    if (document.getElementById('plan_card_wrapper_' + encodedName)) return;
    category    = category    || 'common';
    division    = division    || 'both';
    contentType = contentType || 'both';
    notifEnabled = (notifEnabled === false) ? false : true;

    // Cache plan metadata
    _planDataStore[encodedName] = {
        title: title, type: type, startDate: startDate || null, endDate: endDate || null,
        category: category, division: division, notifEnabled: notifEnabled,
        planSubject: planSubject || '', contentType: contentType
    };

    var catStyle = PLAN_CAT_STYLES[category] || PLAN_CAT_STYLES.custom;
    var catLabel = planSubject ? planSubject : (PLAN_CAT_LABELS[category] || category);
    var divLabel = PLAN_DIV_LABELS[division] || division;

    // Date text + days-left badge
    var dateStr = '';
    var daysHtml = '';
    if (startDate || endDate) {
        dateStr = (startDate ? formatPlanDate(startDate) : '?') + (endDate ? ' \u2192 ' + formatPlanDate(endDate) : '');
    }
    if (endDate) {
        var diff = Math.ceil((new Date(endDate + 'T00:00:00') - new Date()) / 86400000);
        var dLabel = diff > 0 ? diff + 'd left' : (diff === 0 ? 'Due today' : Math.abs(diff) + 'd over');
        var dCls   = diff < 0 ? 'pcard-days-over' : (diff <= 7 ? 'pcard-days-warn' : 'pcard-days-ok');
        daysHtml = ' <span class="pcard-days ' + dCls + '">' + dLabel + '</span>';
    }
    var mutedHtml = !notifEnabled ? ' <span class="plan-badge plan-muted-badge">\ud83d\udd15</span>' : '';

    // ── COMPACT CARD (visible in grid) ─────────────────────────────────────
    var cardHtml =
        '<div class="plan-card" onclick="openPlanDrawer(\'' + encodedName + '\')" role="button" tabindex="0" onkeydown="if(event.key===\'Enter\'||event.key===\' \')openPlanDrawer(\'' + encodedName + '\')">'
        + '<div class="plan-card-stripe" style="background:linear-gradient(90deg,' + catStyle.text + '99,' + catStyle.text + '22);"></div>'
        + '<div class="plan-card-inner">'
        +   '<div class="plan-card-top">'
        +     '<span class="plan-card-title">' + title + '</span>'
        +     '<button class="plan-card-del" onclick="event.stopPropagation();eraseCustomNode(\'plan_meta_' + encodedName + '\',this)" title="Delete plan">\xd7</button>'
        +   '</div>'
        +   '<div class="plan-card-badges">'
        +     '<span class="plan-badge plan-type-badge">' + type + '</span>'
        +     '<span class="plan-badge plan-cat-badge plan-cat-' + category + '">' + catLabel + '</span>'
        +     '<span class="plan-badge plan-div-badge">' + divLabel + '</span>'
        +     mutedHtml
        +   '</div>'
        +   (dateStr ? '<div class="plan-card-dates">\ud83d\udcc5 ' + dateStr + daysHtml + '</div>' : '')
        +   '<div class="plan-card-footer">'
        +     '<div class="plan-card-pbar"><div id="pbar-plan-' + encodedName + '" class="plan-card-pbar-fill" style="width:0%"></div></div>'
        +     '<span id="lbl-plan-' + encodedName + '" class="plan-card-pct">0%</span>'
        +   '</div>'
        + '</div>'
        + '</div>';

    // ── HIDDEN DETAIL DOM (moved into drawer when opened) ──────────────────
    var detailHtml =
        '<div id="plan_detail_' + encodedName + '" class="plan-detail-data" style="display:none;">'
        // Note pane
        + '<div id="plan-pane-note-' + encodedName + '" class="plan-detail-pane" style="display:none;padding:0.5rem 0;">'
        +   '<textarea id="note-plan_card_' + encodedName + '" oninput="debouncedSync(\'plan_card_' + encodedName + '\')" rows="6" placeholder="Master strategy / goals for this plan\u2026" '
        +   'style="width:100%;background:var(--inp);border:1px solid var(--bdr);color:var(--t2);border-radius:0.75rem;padding:0.75rem 1rem;font-size:0.8rem;font-family:var(--mono);resize:vertical;outline:none;box-sizing:border-box;" '
        +   'onfocus="this.style.borderColor=\'var(--bdr-h)\'" onblur="this.style.borderColor=\'var(--bdr)\'"></textarea>'
        + '</div>'
        // Tasks pane
        + '<div id="plan-pane-tasks-' + encodedName + '" class="plan-detail-pane">'
        +   '<div id="target-list-' + encodedName + '" class="space-y-2 mb-3"></div>'
        +   '<button onclick="addPlanTaskPrompt(\'' + encodedName + '\')" class="ptask-add-btn" id="ptask-add-btn-' + encodedName + '">'
        +     '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg> Add Row'
        +   '</button>'
        + '</div>'
        // Tables pane (plantable.js spreadsheet)
        + '<div id="plan-pane-table-' + encodedName + '" class="plan-detail-pane" style="display:none;">'
        +   '<div id="plan-table-container-' + encodedName + '" class="pt-container">'
        +     '<div class="pt-loading">Loading table\u2026</div>'
        +   '</div>'
        + '</div>'
        // Hidden pie anchor
        + '<div id="pie-plan-' + encodedName + '" style="display:none;"></div>'
        + '</div>';

    var wrapperHtml = '<div id="plan_card_wrapper_' + encodedName + '" class="plan-card-wrapper">'
        + cardHtml + detailHtml + '</div>';

    var grid = document.getElementById('planner-grid');
    if (grid) grid.insertAdjacentHTML('afterbegin', wrapperHtml);
    _updatePlannerEmpty();
}

// ── Plan Drawer ─────────────────────────────────────────────────────────────
function openPlanDrawer(encodedName) {
    var plan = _planDataStore[encodedName];
    if (!plan) return;
    var detailEl   = document.getElementById('plan_detail_' + encodedName);
    var drawerBody = document.getElementById('plan-drawer-body');
    if (!detailEl || !drawerBody) return;

    // Populate header
    var catLabel = plan.planSubject || PLAN_CAT_LABELS[plan.category] || plan.category;
    document.getElementById('plan-drawer-title').textContent = plan.title;
    document.getElementById('plan-drawer-badges').innerHTML =
        '<span class="plan-badge plan-type-badge">' + plan.type + '</span>'
        + '<span class="plan-badge plan-cat-badge plan-cat-' + plan.category + '">' + catLabel + '</span>'
        + '<span class="plan-badge plan-div-badge">' + (PLAN_DIV_LABELS[plan.division] || plan.division) + '</span>';
    document.getElementById('plan-drawer-dates').textContent = (plan.startDate || plan.endDate)
        ? '\ud83d\udcc5 ' + (plan.startDate ? formatPlanDate(plan.startDate) : '?') + (plan.endDate ? ' \u2192 ' + formatPlanDate(plan.endDate) : '')
        : '';

    // Move entire detail DOM into drawer body
    drawerBody.innerHTML = '';
    drawerBody.appendChild(detailEl);
    detailEl.style.display = '';
    _activeDrawerPlan = encodedName;

    // Show/hide task auto-setup banner when Tasks tab has no rows and plan has dates
    var targetList = document.getElementById('target-list-' + encodedName);
    var hasTasks = targetList && Array.from(targetList.children).some(function(c) { return c.classList.contains('plan-trow'); });
    var existingAutoSetup = document.getElementById('plan-auto-setup');
    if (existingAutoSetup) existingAutoSetup.remove();
    if (!hasTasks && plan.startDate && plan.endDate) {
        var days = Math.ceil((new Date(plan.endDate + 'T00:00:00') - new Date(plan.startDate + 'T00:00:00')) / 86400000) + 1;
        var autoMode, autoLabel, autoDesc;
        if (days > 60)      { autoMode = 'monthly'; autoLabel = '\ud83d\udcc5 Monthly \u2192 Weekly structure'; autoDesc = days + ' days'; }
        else if (days > 13) { autoMode = 'weekly';  autoLabel = '\ud83d\udcc5 Weekly \u2192 Daily structure';   autoDesc = days + ' days'; }
        else                { autoMode = 'daily';   autoLabel = '\ud83d\udcc5 Generate Daily rows';             autoDesc = days + ' day' + (days !== 1 ? 's' : ''); }
        var tasksPaneEl = document.getElementById('plan-pane-tasks-' + encodedName);
        if (tasksPaneEl) {
            tasksPaneEl.insertAdjacentHTML('afterbegin',
                '<div id="plan-auto-setup" class="plan-auto-setup">'
                + '<div class="plan-auto-setup-label">\u26a1 Quick Setup \u2014 ' + (plan.startDate ? formatPlanDate(plan.startDate) : '') + ' \u2192 ' + (plan.endDate ? formatPlanDate(plan.endDate) : '') + '</div>'
                + '<div class="plan-auto-desc">' + autoDesc + '</div>'
                + '<div class="plan-auto-setup-btns">'
                + '<button class="plan-auto-btn plan-auto-btn-primary" onclick="generateAutoTasks(\'' + encodedName + '\',\'' + autoMode + '\')">' + autoLabel + '</button>'
                + '</div></div>');
        }
    }

    // Default to Tasks tab; if contentType is 'tables' start on Tables tab
    var ct = plan.contentType || 'both';
    switchDrawerTab(ct === 'tables' ? 'table' : 'tasks');

    _updateDrawerProgress(encodedName);

    // Open drawer
    var drawer  = document.getElementById('plan-drawer');
    var overlay = document.getElementById('plan-drawer-overlay');
    if (drawer)  drawer.style.transform = 'translateX(0)';
    if (overlay) overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function switchDrawerTab(tab) {
    var enc = _activeDrawerPlan;
    if (!enc) return;
    ['tasks', 'table', 'note'].forEach(function(t) {
        var btn  = document.getElementById('pdt-' + t);
        var pane = document.getElementById('plan-pane-' + t + '-' + enc);
        if (btn)  btn.classList.toggle('active', t === tab);
        if (pane) pane.style.display = (t === tab) ? '' : 'none';
    });
    if (tab === 'table' && typeof loadPlanTables === 'function') loadPlanTables(enc);
    _activeDrawerTab = tab;
}

function _updateDrawerProgress(enc) {
    var boxes = document.querySelectorAll('.plan-task-box-' + CSS.escape(enc));
    var total = boxes.length, done = 0;
    boxes.forEach(function(b) { if (b.checked) done++; });
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    var pctEl = document.getElementById('plan-drawer-pct');
    if (pctEl) pctEl.textContent = total > 0 ? pct + '% (' + done + '/' + total + ')' : '';
}

function closePlanDrawer() {
    var enc = _activeDrawerPlan;
    if (!enc) return;

    var detailEl   = document.getElementById('plan_detail_' + enc);
    var wrapper    = document.getElementById('plan_card_wrapper_' + enc);
    var drawerBody = document.getElementById('plan-drawer-body');

    // Sync note textarea value before hiding
    var noteTa = document.getElementById('note-plan_card_' + enc);
    if (noteTa && window.RTE) RTE.populate('note-plan_card_' + enc, noteTa.value);

    // Move detail DOM back to its card wrapper
    if (detailEl) {
        detailEl.style.display = 'none';
        if (wrapper) wrapper.appendChild(detailEl);
        else if (drawerBody) drawerBody.innerHTML = '';
    }

    var drawer  = document.getElementById('plan-drawer');
    var overlay = document.getElementById('plan-drawer-overlay');
    if (drawer)  drawer.style.transform = 'translateX(100%)';
    if (overlay) overlay.classList.add('hidden');
    document.body.style.overflow = '';
    _activeDrawerPlan = null;
    _activeDrawerTab  = 'tasks';
}

// ── Master Aggregate Dashboard ──────────────────────────────────────────────
function renderMasterAggregate() {
    var el = document.getElementById('master-aggregate');
    if (!el) return;
    var entries = Object.entries(_planDataStore || {});
    if (!entries.length) { el.innerHTML = ''; return; }

    // Gather task stats per plan (enc is the btoa key used as class suffix)
    var stats = entries.map(function(kv) {
        var enc = kv[0], p = kv[1];
        var boxes = document.querySelectorAll('.plan-task-box-' + CSS.escape(enc));
        var total = boxes.length, done = 0;
        boxes.forEach(function(b) { if (b.checked) done++; });
        return { title: p.title || 'Plan', total: total, done: done, color: p._color || '#818cf8' };
    }).filter(function(s) { return s.total > 0; });

    if (!stats.length) { el.innerHTML = '<p style="font-size:0.7rem;color:var(--t3);font-family:var(--mono);text-align:center;padding:1rem 0;">No task data yet — add tasks in plan cards.</p>'; return; }

    var totalTasks = stats.reduce(function(a, s) { return a + s.total; }, 0);
    var doneTasks = stats.reduce(function(a, s) { return a + s.done; }, 0);
    var overallPct = totalTasks ? Math.round(doneTasks / totalTasks * 100) : 0;

    // Build bar chart rows
    var bars = stats.map(function(s) {
        var pct = s.total ? Math.round(s.done / s.total * 100) : 0;
        return '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.45rem;">'
            + '<span style="min-width:10rem;max-width:10rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.68rem;color:var(--t2);font-family:var(--mono);" title="'+s.title+'">'+s.title+'</span>'
            + '<div style="flex:1;background:var(--bdr);border-radius:1rem;overflow:hidden;height:0.7rem;">'
            +   '<div style="width:'+pct+'%;background:'+s.color+';height:100%;border-radius:1rem;transition:width 0.4s;"></div>'
            + '</div>'
            + '<span style="font-size:0.65rem;color:var(--t3);font-family:var(--mono);min-width:2.8rem;text-align:right;">'+s.done+'/'+s.total+'</span>'
            + '<span style="font-size:0.65rem;font-weight:700;color:var(--t2);font-family:var(--mono);min-width:2.2rem;text-align:right;">'+pct+'%</span>'
            + '</div>';
    }).join('');

    // Pie donut SVG (overall)
    var dash = overallPct * 2.827; // circumference ≈ 2π×45=282.7
    var pieSvg = '<svg width="80" height="80" viewBox="0 0 100 100" style="transform:rotate(-90deg);">'
        + '<circle cx="50" cy="50" r="45" fill="none" stroke="var(--bdr)" stroke-width="10"/>'
        + '<circle cx="50" cy="50" r="45" fill="none" stroke="#818cf8" stroke-width="10"'
        +   ' stroke-dasharray="'+dash+' 282.7" stroke-linecap="round"/>'
        + '</svg>';

    el.innerHTML = '<div style="display:flex;align-items:flex-start;gap:1.5rem;flex-wrap:wrap;">'
        + '<div style="flex:1;min-width:240px;">'
        +   '<div style="font-size:0.72rem;font-weight:800;color:var(--t1);font-family:var(--mono);margin-bottom:0.6rem;text-transform:uppercase;letter-spacing:0.06em;">&#9642; Task Completion by Plan</div>'
        +   bars
        + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:center;gap:0.35rem;min-width:90px;">'
        +   '<div style="position:relative;width:80px;height:80px;">'
        +     pieSvg
        +     '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:0.9rem;font-weight:900;color:var(--t1);font-family:var(--mono);">'+overallPct+'%</div>'
        +   '</div>'
        +   '<div style="font-size:0.6rem;color:var(--t3);font-family:var(--mono);text-align:center;">Overall<br>'+doneTasks+'/'+totalTasks+' tasks</div>'
        + '</div>'
        + '</div>';
}

// ── Gantt Timeline ──────────────────────────────────────────────────────────
function renderGanttTimeline(viewMode) {
    var container = document.getElementById('plan-gantt-container');
    if (!container) return;
    viewMode = viewMode || 'month';
    ['month', 'week'].forEach(function(m) {
        var btn = document.getElementById('gantt-btn-' + m);
        if (btn) btn.classList.toggle('active', m === viewMode);
    });

    var allPlans     = Object.entries(_planDataStore);
    var datedPlans   = allPlans.filter(function(e) { return e[1].startDate && e[1].endDate; });
    var undatedPlans = allPlans.filter(function(e) { return !e[1].startDate || !e[1].endDate; });

    if (allPlans.length === 0) {
        container.innerHTML = '<div class="plan-gantt-empty-msg">No plans yet. Create plans to see the mission timeline.</div>'; return;
    }
    if (datedPlans.length === 0) {
        container.innerHTML = '<div class="plan-gantt-empty-msg">Add start \u2192 end dates to your plans to see them on the timeline.<br><br>'
            + undatedPlans.map(function(e) { return '<span class="plan-badge plan-type-badge" style="cursor:pointer" onclick="openPlanDrawer(\'' + e[0] + '\')">' + e[1].title + '</span>'; }).join(' ')
            + '</div>'; return;
    }

    var now = new Date();
    var allDates = [];
    datedPlans.forEach(function(e) {
        allDates.push(new Date(e[1].startDate + 'T00:00:00'));
        allDates.push(new Date(e[1].endDate   + 'T00:00:00'));
    });
    var minD = new Date(Math.min.apply(null, allDates));
    var maxD = new Date(Math.max.apply(null, allDates));

    var units = _ganttUnits(minD, maxD, viewMode);
    if (units.length > 52) units = units.slice(0, 52);

    var colMin = viewMode === 'month' ? '4.5rem' : '3rem';
    var html = '<div class="plan-gantt-scroll"><div class="plan-gantt-grid" style="grid-template-columns:9rem repeat(' + units.length + ',minmax(' + colMin + ',1fr));">';

    // Header
    html += '<div class="plan-gantt-corner">PLAN</div>';
    units.forEach(function(u) {
        var isNow = _ganttIsNow(u, viewMode, now);
        var label = viewMode === 'month'
            ? u.toLocaleDateString('en-IN', { month: 'short' }) + '<br><span class="plan-gantt-yr">' + u.getFullYear() + '</span>'
            : u.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        html += '<div class="plan-gantt-col-hdr' + (isNow ? ' plan-gantt-now-col' : '') + '">' + label + '</div>';
    });

    // Plan rows
    datedPlans.forEach(function(entry) {
        var enc = entry[0], plan = entry[1];
        var catStyle = PLAN_CAT_STYLES[plan.category] || PLAN_CAT_STYLES.custom;
        var catLabel = plan.planSubject || PLAN_CAT_LABELS[plan.category] || plan.category;
        var boxes = document.querySelectorAll('.plan-task-box-' + CSS.escape(enc));
        var total = boxes.length, done = 0;
        boxes.forEach(function(b) { if (b.checked) done++; });
        var pct = total > 0 ? Math.round((done / total) * 100) : -1;

        html += '<div class="plan-gantt-row-label" onclick="openPlanDrawer(\'' + enc + '\')" title="' + plan.title + '">'
            + '<div class="plan-gantt-plan-name">' + plan.title + '</div>'
            + '<div class="plan-gantt-plan-sub" style="color:' + catStyle.text + ';">' + catLabel + '</div>'
            + (pct >= 0 ? '<div class="plan-gantt-pct">' + pct + '%</div>' : '')
            + '</div>';

        var planStart = new Date(plan.startDate + 'T00:00:00');
        var planEnd   = new Date(plan.endDate   + 'T23:59:59');
        units.forEach(function(u, ci) {
            var uEnd = _ganttUnitEnd(u, viewMode);
            if (planStart > uEnd || planEnd < u) { html += '<div class="plan-gantt-empty-cell"></div>'; return; }
            var isFirst = ci === 0 || planStart > _ganttUnitEnd(units[ci - 1], viewMode);
            var isLast  = ci === units.length - 1 || planEnd < units[ci + 1];
            var rL = isFirst ? '0.4rem' : '0', rR = isLast ? '0.4rem' : '0';
            html += '<div class="plan-gantt-bar-cell" style="'
                + 'background:' + catStyle.bg + ';'
                + 'border-top:2px solid ' + catStyle.text + '55;border-bottom:2px solid ' + catStyle.text + '55;'
                + (isFirst ? 'border-left:3px solid ' + catStyle.text + ';' : '')
                + (isLast  ? 'border-right:2px solid ' + catStyle.text + ';' : '')
                + 'border-radius:' + rL + ' ' + rR + ' ' + rR + ' ' + rL + ';'
                + '"></div>';
        });
    });

    html += '</div></div>';
    if (undatedPlans.length > 0) {
        html += '<div class="plan-gantt-undated"><span style="color:var(--t3);font-size:0.65rem;font-family:var(--mono);">No date range:</span> '
            + undatedPlans.map(function(e) { return '<span class="plan-badge plan-type-badge" style="cursor:pointer" onclick="openPlanDrawer(\'' + e[0] + '\')">' + e[1].title + '</span>'; }).join(' ')
            + '</div>';
    }
    container.innerHTML = html;
}

function _ganttUnits(minD, maxD, viewMode) {
    var units = [];
    if (viewMode === 'month') {
        var d = new Date(minD.getFullYear(), minD.getMonth(), 1);
        var end = new Date(maxD.getFullYear(), maxD.getMonth() + 1, 0);
        while (d <= end) { units.push(new Date(d)); d.setMonth(d.getMonth() + 1); }
    } else {
        var d = new Date(minD);
        var day = d.getDay();
        d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        var end = new Date(maxD); end.setDate(end.getDate() + 7);
        while (d <= end) { units.push(new Date(d)); d.setDate(d.getDate() + 7); }
    }
    return units;
}
function _ganttUnitEnd(u, viewMode) {
    if (viewMode === 'month') return new Date(u.getFullYear(), u.getMonth() + 1, 0, 23, 59, 59);
    var e = new Date(u); e.setDate(e.getDate() + 6); e.setHours(23, 59, 59); return e;
}
function _ganttIsNow(u, viewMode, now) {
    if (viewMode === 'month') return u.getFullYear() === now.getFullYear() && u.getMonth() === now.getMonth();
    return now >= u && now <= _ganttUnitEnd(u, viewMode);
}

function _updatePlannerEmpty() {
    var grid  = document.getElementById('planner-grid');
    var empty = document.getElementById('planner-empty');
    if (!grid || !empty) return;
    empty.classList.toggle('hidden', grid.children.length > 0);
}

// ESC closes plan drawer first
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && _activeDrawerPlan) {
        closePlanDrawer(); e.stopImmediatePropagation();
    }
});

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

// ── Inline task entry ───────────────────────────────────────────────────────
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
    if (!container || document.getElementById('plan-trow-' + fullId)) return;

    var noteVal = (noteText || '').replace(/"/g, '&quot;');
    var div = document.createElement('div');
    div.id = 'plan-trow-' + fullId;
    div.className = 'task-row plan-trow';
    div.innerHTML =
        '<div class="plan-trow-top">'
        + '<input type="checkbox" id="' + fullId + '" onchange="handleSyncAction(\'' + fullId + '\');_planTaskChecked(\'' + fullId + '\')" class="plan-task-box-' + planEncodedName + '" ' + (isChecked ? 'checked' : '') + '>'
        + '<label for="' + fullId + '" class="plan-trow-label' + (isChecked ? ' plan-trow-done' : '') + '">' + taskText + '</label>'
        + '<div class="plan-trow-actions">'
        +   '<button class="plan-stoggle-btn" id="plan-stoggle-' + fullId + '" onclick="togglePlanSubTasks(\'' + fullId + '\')" title="Sub-tasks">\u25be</button>'
        +   '<button class="plan-trow-del" onclick="eraseCustomNode(\'' + fullId + '\',this)" title="Delete">\xd7</button>'
        + '</div>'
        + '</div>'
        + '<input type="text" id="note-' + fullId + '" oninput="debouncedSync(\'' + fullId + '\')" value="' + noteVal + '" placeholder="Note\u2026" class="plan-trow-note' + (isChecked ? ' locked-note' : '') + '"' + (isChecked ? ' readonly' : '') + '>'
        + '<div class="plan-stask-area" id="plan-starea-' + fullId + '" style="display:none;">'
        +   '<div id="plan-strows-' + fullId + '" class="plan-stask-rows"></div>'
        +   '<button class="plan-stask-add" id="plan-stadd-' + fullId + '" onclick="addPlanSubTask(\'' + planEncodedName + '\',\'' + fullId + '\')">'
        +     '\u2795 Sub-task'
        +   '</button>'
        + '</div>';
    container.appendChild(div);
    if (window.RTE) RTE.init('note-' + fullId, { minH: '1.8rem' });
    calculatePlanPies();
}
function buildSubTaskRow(planEnc, parentId, subText, subId, isChecked, noteText) {
    var stRows = document.getElementById('plan-strows-' + parentId);
    if (!stRows || document.getElementById('plan-strow-' + subId)) return;
    var noteVal = (noteText || '').replace(/"/g, '&quot;');
    var div = document.createElement('div');
    div.id = 'plan-strow-' + subId;
    div.className = 'plan-strow';
    div.innerHTML =
        '<input type="checkbox" id="' + subId + '" onchange="handleSyncAction(\'' + subId + '\');_subTaskChecked(\'' + subId + '\')" class="plan-task-box-' + planEnc + '" ' + (isChecked ? 'checked' : '') + '>'
        + '<label for="' + subId + '" class="plan-strow-label' + (isChecked ? ' plan-trow-done' : '') + '">' + subText + '</label>'
        + '<input type="text" id="note-' + subId + '" oninput="debouncedSync(\'' + subId + '\')" value="' + noteVal + '" placeholder="Note\u2026" class="plan-strow-note' + (isChecked ? ' locked-note' : '') + '"' + (isChecked ? ' readonly' : '') + '>'
        + '<button class="plan-strow-del" onclick="deletePlanSubTask(\'' + subId + '\',\'' + parentId + '\',this)" title="Delete">\xd7</button>';
    stRows.appendChild(div);
    if (window.RTE) RTE.init('note-' + subId, { minH: '1.5rem' });
    calculatePlanPies();
}

function togglePlanSubTasks(fullId) {
    var area = document.getElementById('plan-starea-' + fullId);
    var btn  = document.getElementById('plan-stoggle-' + fullId);
    if (!area) return;
    var open = area.style.display !== 'none';
    area.style.display = open ? 'none' : '';
    if (btn) btn.classList.toggle('open', !open);
}

function addPlanSubTask(planEnc, parentId) {
    var area = document.getElementById('plan-starea-' + parentId);
    if (area) area.style.display = '';
    var existing = document.getElementById('plan-stinline-' + parentId);
    if (existing) { existing.querySelector('input').focus(); return; }
    var stRows = document.getElementById('plan-strows-' + parentId);
    if (!stRows) return;
    var addBtn = document.getElementById('plan-stadd-' + parentId);
    if (addBtn) addBtn.style.display = 'none';
    var d = document.createElement('div');
    d.id = 'plan-stinline-' + parentId;
    d.className = 'ptask-inline';
    d.innerHTML = '<input type="text" id="plan-stinline-inp-' + parentId + '" placeholder="Sub-task\u2026" class="ptask-inline-input">'
        + '<div class="ptask-inline-btns"><button onclick="submitPlanSubTask(\'' + planEnc + '\',\'' + parentId + '\')" class="ptask-submit">Add</button>'
        + '<button onclick="cancelPlanSubTask(\'' + parentId + '\')" class="ptask-cancel">Cancel</button></div>';
    stRows.appendChild(d);
    var inp = document.getElementById('plan-stinline-inp-' + parentId);
    if (inp) {
        inp.focus();
        inp.addEventListener('keydown', function(e) {
            if (e.key === 'Enter')  submitPlanSubTask(planEnc, parentId);
            if (e.key === 'Escape') cancelPlanSubTask(parentId);
        });
    }
}

function cancelPlanSubTask(parentId) {
    var el = document.getElementById('plan-stinline-' + parentId);
    if (el) el.remove();
    var addBtn = document.getElementById('plan-stadd-' + parentId);
    if (addBtn) addBtn.style.display = '';
}

function submitPlanSubTask(planEnc, parentId) {
    var inp = document.getElementById('plan-stinline-inp-' + parentId);
    var subText = inp ? inp.value.trim() : '';
    cancelPlanSubTask(parentId);
    if (!subText) return;
    // parentId = 'plan_task_{planEnc}_{parentB64}'
    var parts = parentId.split('_');
    var parentB64 = parts[3];
    var subB64 = btoa(unescape(encodeURIComponent(subText)));
    var subId = 'plan_task_' + planEnc + '_' + parentB64 + '_sub_' + subB64;
    buildSubTaskRow(planEnc, parentId, subText, subId, false, '');
    handleSyncAction(subId);
}

function deletePlanSubTask(subId, parentId, btn) {
    if (!confirm('Delete this sub-task?')) return;
    var row = document.getElementById('plan-strow-' + subId);
    if (row) row.remove();
    calculatePlanPies();
    if (dbClient && currentUserId) {
        dbClient.from('upsc_tracker_progress').delete().eq('id', subId).eq('user_id', currentUserId);
    }
}

function _planTaskChecked(fullId) {
    var box   = document.getElementById(fullId);
    var row   = document.getElementById('plan-trow-' + fullId);
    var note  = document.getElementById('note-' + fullId);
    if (!box || !row) return;
    var label = row.querySelector('.plan-trow-label');
    if (label) label.classList.toggle('plan-trow-done', box.checked);
    if (note)  { note.readOnly = box.checked; note.className = 'plan-trow-note' + (box.checked ? ' locked-note' : ''); }
    toggleNoteLock(fullId, box.checked);
    _updateDrawerProgress(_activeDrawerPlan);
}

function _subTaskChecked(subId) {
    var box = document.getElementById(subId);
    var row = document.getElementById('plan-strow-' + subId);
    if (!box || !row) return;
    var label = row.querySelector('.plan-strow-label');
    var note  = row.querySelector('.plan-strow-note');
    if (label) label.classList.toggle('plan-trow-done', box.checked);
    if (note)  { note.readOnly = box.checked; note.className = 'plan-strow-note' + (box.checked ? ' locked-note' : ''); }
    toggleNoteLock(subId, box.checked);
    _updateDrawerProgress(_activeDrawerPlan);
}

// ── Auto-generate tasks from date range ────────────────────────────────────
function generateAutoTasks(enc, mode) {
    var plan = _planDataStore[enc];
    if (!plan || !plan.startDate || !plan.endDate) return;
    var start = new Date(plan.startDate + 'T00:00:00');
    var end   = new Date(plan.endDate   + 'T00:00:00');
    var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // ── Helpers ──────────────────────────────────────────────────────────
    function encText(t) { return btoa(unescape(encodeURIComponent(t))); }
    function addTask(text) {
        var id = 'plan_task_' + enc + '_' + encText(text);
        buildPlanTaskDOM(enc, text, id, false, '');
        handleSyncAction(id);
        return id;
    }
    function addSub(parentId, text) {
        var parentB64 = parentId.replace('plan_task_' + enc + '_', '');
        var subId = 'plan_task_' + enc + '_' + parentB64 + '_sub_' + encText(text);
        buildSubTaskRow(enc, parentId, text, subId, false, '');
        handleSyncAction(subId);
        // Auto-open the sub-task area so rows are visible immediately
        var stArea = document.getElementById('plan-stask-area-' + parentId);
        if (stArea) stArea.style.display = '';
        var stBtn = document.getElementById('plan-stoggle-' + parentId);
        if (stBtn) stBtn.classList.add('open');
        return subId;
    }
    function fmtDay(d) {
        return dayNames[d.getDay()] + ' ' + d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }
    function fmtRange(d1, d2) {
        return d1.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
             + ' \u2013 '
             + d2.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }

    // ── Mode: monthly → weekly sub-tasks per month ───────────────────────
    if (mode === 'monthly') {
        var d = new Date(start.getFullYear(), start.getMonth(), 1);
        var mNum = 1;
        while (d <= end) {
            var mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            if (mEnd > end) mEnd = new Date(end);
            var mText = 'Month ' + mNum + ' (' + d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) + ')';
            var mId = addTask(mText);
            // Weekly sub-tasks within this month
            var wStart = new Date(d < start ? start : d);
            var wNum = 1;
            while (wStart <= mEnd) {
                var wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 6);
                if (wEnd > mEnd) wEnd = new Date(mEnd);
                addSub(mId, 'Wk ' + wNum + ' (' + fmtRange(wStart, wEnd) + ')');
                wStart.setDate(wStart.getDate() + 7);
                wNum++;
            }
            d.setMonth(d.getMonth() + 1);
            mNum++;
        }

    // ── Mode: weekly → daily sub-tasks per week ──────────────────────────
    } else if (mode === 'weekly') {
        var wStart = new Date(start);
        var wNum = 1;
        while (wStart <= end) {
            var wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 6);
            if (wEnd > end) wEnd = new Date(end);
            var wId = addTask('Week ' + wNum + ' (' + fmtRange(wStart, wEnd) + ')');
            // Daily sub-tasks for this week
            var dayD = new Date(wStart);
            while (dayD <= wEnd) {
                addSub(wId, fmtDay(dayD));
                dayD.setDate(dayD.getDate() + 1);
            }
            wStart.setDate(wStart.getDate() + 7);
            wNum++;
        }

    // ── Mode: daily → just day rows, no further sub-tasks ───────────────
    } else {
        var d = new Date(start);
        while (d <= end) {
            addTask(fmtDay(d));
            d.setDate(d.getDate() + 1);
        }
    }

    var autoSetup = document.getElementById('plan-auto-setup');
    if (autoSetup) autoSetup.style.display = 'none';
}

function calculatePlanPies() {
    document.querySelectorAll('[id^="pie-plan-"]').forEach(function(pieEl) {
        var encodedName = pieEl.id.replace('pie-plan-', '');
        var taskBoxes = document.querySelectorAll('.plan-task-box-' + CSS.escape(encodedName));
        var lblEl  = document.getElementById('lbl-plan-' + encodedName);
        var pbarEl = document.getElementById('pbar-plan-' + encodedName);
        var sTotal = taskBoxes.length, sChecked = 0;
        taskBoxes.forEach(function(b) { if (b.checked) sChecked++; });
        var sPct = sTotal > 0 ? Math.round((sChecked / sTotal) * 100) : 0;
        if (lblEl)  lblEl.innerText = sPct + '%';
        if (pbarEl) pbarEl.style.width = sPct + '%';
        pieEl.style.background = 'conic-gradient(#10b981 ' + sPct + '%, rgba(51,65,85,0.6) 0%)';
    });
    if (_activeDrawerPlan) _updateDrawerProgress(_activeDrawerPlan);
}

function formatPlanDate(dateStr) {
    if (!dateStr) return '';
    try {
        var d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch(e) { return dateStr; }
}