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
        +     '<span class="plan-card-title" id="pcard-title-' + encodedName + '">' + title + '</span>'
        +     '<button class="plan-card-del" onclick="event.stopPropagation();eraseCustomNode(\'plan_meta_' + encodedName + '\',this)" title="Delete plan">\xd7</button>'
        +   '</div>'
        +   '<div class="plan-card-badges">'
        +     '<span class="plan-badge plan-type-badge">' + type + '</span>'
        +     '<span class="plan-badge plan-cat-badge plan-cat-' + category + '">' + catLabel + '</span>'
        +     '<span class="plan-badge plan-div-badge">' + divLabel + '</span>'
        +     mutedHtml
        +   '</div>'
        +   '<div class="plan-card-dates" id="pcard-dates-wrap-' + encodedName + '"' + (!dateStr ? ' style="display:none"' : '') + '>\ud83d\udcc5 <span id="pcard-dates-' + encodedName + '">' + dateStr + '</span><span id="pcard-days-' + encodedName + '" class="pcard-days ' + (daysHtml ? (diff < 0 ? 'pcard-days-over' : diff <= 7 ? 'pcard-days-warn' : 'pcard-days-ok') : '') + '">' + (daysHtml ? daysHtml.replace(/<[^>]+>/g,'') : '') + '</span></div>'
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
// ── Plan Edit ──────────────────────────────────────────────────────────────
function _peField(label, content) {
    return '<div style="display:flex;flex-direction:column;gap:0.2rem;">'
        + '<label style="font-size:0.58rem;font-weight:700;color:var(--t3);font-family:var(--mono);text-transform:uppercase;">' + label + '</label>'
        + content + '</div>';
}
function _peInput(id, type, val, extra) {
    return '<input id="' + id + '" type="' + type + '" value="' + val + '" ' + (extra||'') + ' style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:0.4rem;padding:0.3rem 0.55rem;font-size:0.72rem;color:var(--t1);font-family:var(--mono);">';
}
function _peSelect(id, options, curVal) {
    return '<select id="' + id + '" style="width:100%;background:var(--surf);border:1px solid var(--bdr);border-radius:0.4rem;padding:0.3rem 0.55rem;font-size:0.72rem;color:var(--t1);font-family:var(--mono);">'
        + options.map(function(o){ return '<option value="'+o[0]+'"'+(o[0]===curVal?' selected':'')+'>'+o[1]+'</option>'; }).join('')
        + '</select>';
}

function openPlanEdit() {
    var enc = _activeDrawerPlan;
    var plan = enc && _planDataStore[enc];
    if (!plan) return;
    var existing = document.getElementById('plan-edit-inline');
    if (existing) { existing.remove(); return; }

    var header = document.getElementById('plan-drawer-header');
    if (!header) return;
    var catVal = plan.category || 'common';
    var catOpts = [['common','Common'],['gs1','GS 1'],['gs2','GS 2'],['gs3','GS 3'],['gs4','GS 4'],['essay','Essay'],['optional','Optional'],['custom','Custom']];
    var divOpts = [['both','Prelims + Mains'],['prelims','Prelims Only'],['mains','Mains Only']];
    var typeOpts = [['weekly','Weekly Sprint'],['monthly','Monthly'],['custom_block','Custom Block'],['daily','Daily Target']];
    var contOpts = [['both','✓ Tasks + ⊞ Tables'],['tasks','✓ Tasks Only'],['tables','⊞ Tables Only']];

    var form = document.createElement('div');
    form.id = 'plan-edit-inline';
    form.style.cssText = 'padding:0.8rem 1.25rem 0.9rem;border-bottom:1px solid var(--bdr);background:var(--bg2);display:flex;flex-direction:column;gap:0.5rem;';
    form.innerHTML =
        '<div style="font-size:0.62rem;font-weight:800;color:var(--accent1);font-family:var(--mono);text-transform:uppercase;letter-spacing:0.06em;">\u270e Edit Plan</div>'
        + _peField('Title', _peInput('pe-title','text', plan.title.replace(/"/g,'&quot;')))
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">'
        +   _peField('Start Date', _peInput('pe-start','date', plan.startDate||''))
        +   _peField('End Date',   _peInput('pe-end',  'date', plan.endDate||''))
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">'
        +   _peField('Category',  _peSelect('pe-cat',  catOpts,  catVal))
        +   _peField('Division',  _peSelect('pe-div',  divOpts,  plan.division||'both'))
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">'
        +   _peField('Plan Type', _peSelect('pe-type', typeOpts, (plan.type||'weekly').toLowerCase().replace(' ','_').replace(' sprint','').replace(' ','_')))
        +   _peField('Mode',      _peSelect('pe-cont', contOpts, plan.contentType||'both'))
        + '</div>'
        + _peField('Focus Area / Subject (optional)', _peInput('pe-subj','text', (plan.planSubject||'').replace(/"/g,'&quot;')))
        + '<div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.15rem;">'
        +   '<button onclick="document.getElementById(\'plan-edit-inline\').remove()" style="background:none;border:1px solid var(--bdr);color:var(--t3);border-radius:0.4rem;padding:0.28rem 0.75rem;font-size:0.65rem;font-family:var(--mono);cursor:pointer;">Cancel</button>'
        +   '<button onclick="savePlanEdit()" style="background:var(--accent1);border:none;color:#fff;border-radius:0.4rem;padding:0.28rem 0.9rem;font-size:0.65rem;font-weight:700;font-family:var(--mono);cursor:pointer;">Save</button>'
        + '</div>';
    header.insertAdjacentElement('afterend', form);
    document.getElementById('pe-title').focus();
}

async function savePlanEdit() {
    var enc = _activeDrawerPlan;
    var plan = enc && _planDataStore[enc];
    if (!plan) return;
    var newTitle   = (document.getElementById('pe-title').value || '').trim();
    var newStart   = document.getElementById('pe-start').value || null;
    var newEnd     = document.getElementById('pe-end').value   || null;
    var newCat     = document.getElementById('pe-cat').value   || plan.category;
    var newDiv     = document.getElementById('pe-div').value   || plan.division;
    var newType    = document.getElementById('pe-type').value  || plan.type;
    var newCont    = document.getElementById('pe-cont').value  || plan.contentType;
    var newSubj    = (document.getElementById('pe-subj').value || '').trim();
    if (!newTitle) { if (typeof showToast === 'function') showToast('Title cannot be empty', 'error'); return; }

    // Update in-memory store
    plan.title = newTitle;
    plan.startDate  = newStart; plan.endDate    = newEnd;
    plan.category   = newCat;   plan.division   = newDiv;
    plan.type       = newType;  plan.contentType = newCont;
    plan.planSubject = newSubj;

    var catStyle = PLAN_CAT_STYLES[newCat] || PLAN_CAT_STYLES.custom;
    var catLabel = newSubj || PLAN_CAT_LABELS[newCat] || newCat;

    // Update drawer header
    document.getElementById('plan-drawer-title').textContent = newTitle;
    document.getElementById('plan-drawer-badges').innerHTML =
        '<span class="plan-badge plan-type-badge">' + newType + '</span>'
        + '<span class="plan-badge plan-cat-badge plan-cat-' + newCat + '">' + catLabel + '</span>'
        + '<span class="plan-badge plan-div-badge">' + (PLAN_DIV_LABELS[newDiv] || newDiv) + '</span>';
    document.getElementById('plan-drawer-dates').textContent = (newStart || newEnd)
        ? '\ud83d\udcc5 ' + (newStart ? formatPlanDate(newStart) : '?') + (newEnd ? ' \u2192 ' + formatPlanDate(newEnd) : '') : '';

    // Update plan card DOM
    var titleEl = document.getElementById('pcard-title-' + enc);
    if (titleEl) titleEl.textContent = newTitle;
    var dateEl = document.getElementById('pcard-dates-' + enc);
    if (dateEl) dateEl.textContent = (newStart || newEnd) ? (newStart ? formatPlanDate(newStart) : '?') + (newEnd ? ' \u2192 ' + formatPlanDate(newEnd) : '') : '';
    var daysEl = document.getElementById('pcard-days-' + enc);
    if (daysEl && newEnd) {
        var diff = Math.ceil((new Date(newEnd + 'T00:00:00') - new Date()) / 86400000);
        daysEl.textContent = diff > 0 ? diff + 'd left' : (diff === 0 ? 'Due today' : Math.abs(diff) + 'd over');
        daysEl.className = 'pcard-days ' + (diff < 0 ? 'pcard-days-over' : diff <= 7 ? 'pcard-days-warn' : 'pcard-days-ok');
        daysEl.style.display = '';
    } else if (daysEl) { daysEl.style.display = 'none'; }

    // Persist to DB
    if (dbClient && currentUserId) {
        await dbClient.from('upsc_custom_plans').update({
            plan_title: newTitle, start_date: newStart, end_date: newEnd,
            plan_category: newCat, plan_division: newDiv, plan_type: newType,
            content_type: newCont, plan_subject: newSubj || null
        }).eq('plan_id', enc).eq('user_id', currentUserId);
    }

    document.getElementById('plan-edit-inline').remove();
    sortPlanCards();
    if (typeof renderGanttTimeline === 'function') renderGanttTimeline('month');
    if (typeof renderPlannerCal    === 'function') renderPlannerCal();
}


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

    // Gather task stats per plan — counts only spreadsheet table rows
    var stats = entries.map(function(kv) {
        var enc = kv[0], p = kv[1];
        var total = 0, done = 0;
        if (typeof _ptCache !== 'undefined' && _ptCache[enc]) {
            _ptCache[enc].forEach(function(sheet) {
                var statusColId = _ptFindStatusCol(sheet.columns_data);
                var subjectCols = (sheet.columns_data || []).filter(function(c) { return /subj|subject|topic/i.test(c.name) || c.id === 'c_subj'; });
                var targetCols  = (sheet.columns_data || []).filter(function(c) { return /target|task|goal/i.test(c.name) || c.id === 'c_target'; });
                function _cv(row, colList) { for (var i=0;i<colList.length;i++){var v=row.cells&&row.cells[colList[i].id]&&String(row.cells[colList[i].id].v||'').trim();if(v)return v;} return ''; }
                (sheet.rows_data || []).forEach(function(row) {
                    if (!_cv(row, subjectCols) && !_cv(row, targetCols)) return;
                    total++;
                    if (statusColId && row.cells[statusColId] && String(row.cells[statusColId].v || '').trim() === '\u2713 Done') done++;
                });
            });
        }
        return { title: p.title || 'Plan', total: total, done: done, color: p._color || '#818cf8' };
    }).filter(function(s) { return s.total > 0; });

    if (!stats.length) { el.innerHTML = '<p style="font-size:0.7rem;color:var(--t3);font-family:var(--mono);text-align:center;padding:1rem 0;">No table rows yet — add rows in your plan spreadsheets.</p>'; return; }

    var totalTasks = stats.reduce(function(a, s) { return a + s.total; }, 0);
    var doneTasks = stats.reduce(function(a, s) { return a + s.done; }, 0);
    var overallPct = totalTasks ? Math.round(doneTasks / totalTasks * 100) : 0;

    // Build bar chart rows — slimmer for scalability
    var bars = stats.map(function(s) {
        var pct = s.total ? Math.round(s.done / s.total * 100) : 0;
        return '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem;">'
            + '<span style="min-width:7.5rem;max-width:7.5rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.63rem;color:var(--t2);font-family:var(--mono);" title="'+s.title+'">'+s.title+'</span>'
            + '<div style="flex:1;background:var(--bdr);border-radius:1rem;overflow:hidden;height:0.42rem;">'
            +   '<div style="width:'+pct+'%;background:'+s.color+';height:100%;border-radius:1rem;transition:width 0.4s;"></div>'
            + '</div>'
            + '<span style="font-size:0.6rem;color:var(--t3);font-family:var(--mono);min-width:2.5rem;text-align:right;">'+s.done+'/'+s.total+'</span>'
            + '<span style="font-size:0.6rem;font-weight:700;color:var(--t2);font-family:var(--mono);min-width:2rem;text-align:right;">'+pct+'%</span>'
            + '</div>';
    }).join('');

    // ── Chart 2: Multi-segment pie — plan distribution (each plan's share of total work)
    var pieR = 42, pieRi = 27, pieC = 55; // outer r, inner r, center
    var svgSize = pieC * 2;
    var pieAngle = -Math.PI / 2;
    var pieSegs = '';
    var pieLegend = '';
    stats.forEach(function(s) {
        if (!s.total) return;
        var sweep = (s.total / totalTasks) * 2 * Math.PI;
        var ea = pieAngle + sweep;
        var large = sweep > Math.PI ? 1 : 0;
        var ox1 = pieC + pieR * Math.cos(pieAngle), oy1 = pieC + pieR * Math.sin(pieAngle);
        var ox2 = pieC + pieR * Math.cos(ea),       oy2 = pieC + pieR * Math.sin(ea);
        var ix1 = pieC + pieRi * Math.cos(ea),      iy1 = pieC + pieRi * Math.sin(ea);
        var ix2 = pieC + pieRi * Math.cos(pieAngle),iy2 = pieC + pieRi * Math.sin(pieAngle);
        pieSegs += '<path d="M'+ox1+','+oy1+' A'+pieR+','+pieR+' 0 '+large+',1 '+ox2+','+oy2
            +' L'+ix1+','+iy1+' A'+pieRi+','+pieRi+' 0 '+large+',0 '+ix2+','+iy2+' Z"'
            +' fill="'+s.color+'" opacity="0.88" stroke="var(--card)" stroke-width="1.5"/>';
        var pct = Math.round(s.total / totalTasks * 100);
        pieLegend += '<div style="display:flex;align-items:center;gap:0.3rem;margin-bottom:0.2rem;">'
            + '<span style="width:8px;height:8px;border-radius:50%;background:'+s.color+';flex-shrink:0;display:inline-block;"></span>'
            + '<span style="font-size:0.6rem;color:var(--t2);font-family:var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:6rem;" title="'+s.title+'">'+s.title+'</span>'
            + '<span style="font-size:0.58rem;color:var(--t3);font-family:var(--mono);margin-left:auto;">'+pct+'%</span>'
            + '</div>';
        pieAngle = ea;
    });
    var pieSvg = '<svg width="'+svgSize+'" height="'+svgSize+'" viewBox="0 0 '+svgSize+' '+svgSize+'">'
        + pieSegs
        + '<text x="'+pieC+'" y="'+(pieC+4)+'" text-anchor="middle" font-size="11" font-weight="900" fill="var(--t1)" font-family="monospace">'+totalTasks+'</text>'
        + '</svg>';

    // ── Chart 3: Master sheet Done vs Pending — compact stat chips (inline with row 1)
    var totalPending = totalTasks - doneTasks;
    var dpChips = '<div style="display:flex;flex-direction:column;gap:0.35rem;min-width:76px;">'
        + '<div style="font-size:0.6rem;font-weight:800;color:var(--t1);font-family:var(--mono);text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;">Overall</div>'
        + '<div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);border-radius:0.45rem;padding:0.35rem 0.5rem;text-align:center;">'
        +   '<div style="font-size:1.15rem;font-weight:900;color:#10b981;font-family:var(--mono);line-height:1;">'+doneTasks+'</div>'
        +   '<div style="font-size:0.55rem;color:var(--t3);font-family:var(--mono);margin-top:1px;">\u2713 Done</div>'
        + '</div>'
        + '<div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.22);border-radius:0.45rem;padding:0.35rem 0.5rem;text-align:center;">'
        +   '<div style="font-size:1.15rem;font-weight:900;color:#f59e0b;font-family:var(--mono);line-height:1;">'+totalPending+'</div>'
        +   '<div style="font-size:0.55rem;color:var(--t3);font-family:var(--mono);margin-top:1px;">\u25cb Pending</div>'
        + '</div>'
        + '<div style="font-size:0.6rem;font-weight:700;color:var(--t2);font-family:var(--mono);text-align:center;padding:0.15rem 0;">'+overallPct+'%</div>'
        + '</div>';

    el.innerHTML = '<div style="display:flex;align-items:flex-start;gap:1.5rem;flex-wrap:wrap;">'
        +   '<div style="flex:1;min-width:200px;">'
        +     '<div style="font-size:0.72rem;font-weight:800;color:var(--t1);font-family:var(--mono);margin-bottom:0.6rem;text-transform:uppercase;letter-spacing:0.06em;">&#9642; Completion % per Plan</div>'
        +     bars
        +   '</div>'
        +   '<div style="display:flex;flex-direction:column;align-items:center;gap:0.4rem;min-width:110px;">'
        +     '<div style="font-size:0.6rem;font-weight:800;color:var(--t1);font-family:var(--mono);text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;">Plan Distribution</div>'
        +     '<div style="display:flex;align-items:center;gap:0.5rem;">'
        +       pieSvg
        +       '<div style="min-width:76px;">' + pieLegend + '</div>'
        +     '</div>'
        +   '</div>'
        +   dpChips
        + '</div>';
}

// ── Master Aggregate Spreadsheet Builder (date-intelligent) ─────────────────

function _ptStatusColor(v) {
    if (v === '\u2713 Done')         return '#10b981';
    if (v === '\u27f3 In Progress')  return '#818cf8';
    if (v === '\u25cb Pending' || !v) return '#f59e0b';
    return '#94a3b8';
}

// Find the status/self-status column id in a sheet's column list
function _ptFindStatusCol(cols) {
    if (!cols) return null;
    var found = null;
    cols.forEach(function(c) {
        if (c.id === 'c_status' || /self.?status|^status$/i.test(c.name)) found = c.id;
    });
    return found;
}

// Extract only spreadsheet table rows for a given plan enc (checkbox tasks excluded)
function _masterGetPlanItems(enc, planTitle, periodStr, planCat) {
    var items = [];

    if (typeof _ptCache !== 'undefined' && _ptCache[enc]) {
        _ptCache[enc].forEach(function(sheet, si) {
            var cols = sheet.columns_data || [];
            var statusColId  = _ptFindStatusCol(cols);
            var subjectCols  = cols.filter(function(c) { return /subj|subject|topic/i.test(c.name) || c.id === 'c_subj'; });
            var targetCols   = cols.filter(function(c) { return /target|task|goal/i.test(c.name) || c.id === 'c_target'; });
            var datesCols    = cols.filter(function(c) { return /date|week|period/i.test(c.name) || c.id === 'c_dates'; });
            var remarksCols  = cols.filter(function(c) { return /remark|note|comment|hw/i.test(c.name) || c.id === 'c_remark' || c.id === 'c_hw'; });

            function _cellVal(row, colList) {
                for (var i = 0; i < colList.length; i++) {
                    var v = row.cells && row.cells[colList[i].id] && String(row.cells[colList[i].id].v || '').trim();
                    if (v) return v;
                }
                return '';
            }

            (sheet.rows_data || []).forEach(function(row, ri) {
                var subj   = _cellVal(row, subjectCols);
                var target = _cellVal(row, targetCols);
                if (!subj && !target) return;

                var dateStr = _cellVal(row, datesCols);
                var note    = _cellVal(row, remarksCols);
                var status  = statusColId && row.cells[statusColId] ? String(row.cells[statusColId].v || '').trim() : '';
                var taskParts = [subj, target].filter(Boolean);
                var statusLabel = status || '\u25cb Pending';
                items.push({ id: 'tbl_' + enc + '_' + si + '_' + ri,
                    plan: planTitle, planCat: planCat || 'common',
                    period: dateStr || periodStr,
                    task: taskParts.join(' \u2014 '), statusLabel: statusLabel,
                    statusColor: _ptStatusColor(statusLabel),
                    done: status === '\u2713 Done', note: note });
            });
        });
    }

    return items;
}

function buildMasterAggSheet() {
    var entries = Object.entries(_planDataStore || {});
    if (typeof _ptZoom !== 'undefined' && _ptZoom['master_sheet'] === undefined) _ptZoom['master_sheet'] = 1.0;

    if (!entries.length) {
        if (!_ptCache['master_sheet']) _ptCache['master_sheet'] = [_buildEmptyMasterSheet()];
        if (typeof renderPlanTableUI === 'function') renderPlanTableUI('master_sheet');
        return;
    }

    var allCols = [
        { id: 'c_plan',   name: 'Plan',       width: 140 },
        { id: 'c_period', name: 'Date / Week', width: 145 },
        { id: 'c_task',   name: 'Task / Row',  width: 255 },
        { id: 'c_status', name: 'Status',      width: 105 },
        { id: 'c_note',   name: 'Note',        width: 175 }
    ];

    function _ymKey(d)   { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
    function _ymLabel(d) { return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }); }
    function _fmtDate(d) { return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }

    function _mkRow(id, item, showPlan) {
        return { id: id, cells: {
            c_plan:   { v: showPlan ? item.plan : '', b: showPlan ? true : undefined },
            c_period: { v: item.period },
            c_task:   { v: item.task },
            c_status: { v: item.statusLabel || '\u25cb Pending', fg: item.statusColor || '#f59e0b' },
            c_note:   { v: item.note }
        }};
    }

    function _sortItems(items) {
        return items.slice().sort(function(a, b) {
            var oA = (typeof PLAN_CAT_ORDER !== 'undefined' ? PLAN_CAT_ORDER[a.planCat] : 0) || 99;
            var oB = (typeof PLAN_CAT_ORDER !== 'undefined' ? PLAN_CAT_ORDER[b.planCat] : 0) || 99;
            if (oA !== oB) return oA - oB;
            return a.plan.localeCompare(b.plan);
        });
    }

    function _buildRowsWithGrouping(items) {
        var rows = [], lastPlan = null;
        items.forEach(function(item) {
            var showPlan = item.plan !== lastPlan;
            lastPlan = item.plan;
            rows.push(_mkRow('r_' + item.id, item, showPlan));
        });
        return rows.length ? rows : [{ id: 'r_empty', cells: { c_plan:{v:'(no items)'}, c_period:{v:''}, c_task:{v:''}, c_status:{v:''}, c_note:{v:''} } }];
    }

    var allItems = [];
    var monthBuckets = {};  // ymKey -> { label, yk, items:[] }

    entries.forEach(function(kv) {
        var enc = kv[0], plan = kv[1];
        var planTitle = plan.title || 'Plan';
        var planCat   = plan.category || 'common';
        var sd = plan.startDate ? new Date(plan.startDate + 'T00:00:00') : null;
        var ed = plan.endDate   ? new Date(plan.endDate   + 'T00:00:00') : null;
        var periodStr = (sd && ed)
            ? _fmtDate(sd).replace(', ' + sd.getFullYear(), '') + ' \u2013 ' + _fmtDate(ed)
            : 'No dates set';

        // Register months
        if (sd && ed) {
            var cur = new Date(sd); cur.setDate(1);
            while (cur <= ed) {
                var yk = _ymKey(cur);
                if (!monthBuckets[yk]) monthBuckets[yk] = { label: _ymLabel(cur), yk: yk, seen: {}, items: [] };
                cur.setMonth(cur.getMonth() + 1);
            }
        }

        var items = _masterGetPlanItems(enc, planTitle, periodStr, planCat);
        items.forEach(function(item) { item.sd = sd; });
        allItems = allItems.concat(items);

        if (sd && ed) {
            items.forEach(function(item) {
                var cur2 = new Date(sd); cur2.setDate(1);
                while (cur2 <= ed) {
                    var yk2 = _ymKey(cur2);
                    if (monthBuckets[yk2] && !monthBuckets[yk2].seen[item.id]) {
                        monthBuckets[yk2].seen[item.id] = true;
                        monthBuckets[yk2].items.push(item);
                    }
                    cur2.setMonth(cur2.getMonth() + 1);
                }
            });
        }
    });

    // ★ All Items: sort by category order then plan name
    var sortedAll = _sortItems(allItems);
    var allRows = _buildRowsWithGrouping(sortedAll);

    var sheets = [{ id: null, plan_id: 'master_sheet', sheet_name: '\u2605 All Items',
        columns_data: allCols, rows_data: allRows, sort_order: 0 }];

    // Monthly tabs: 1 per month, plans sorted by category, plan name shown once
    var sortedMonths = Object.values(monthBuckets).sort(function(a, b) { return a.yk.localeCompare(b.yk); });
    sortedMonths.forEach(function(m, idx) {
        var sorted = _sortItems(m.items);
        var rows = _buildRowsWithGrouping(sorted);
        sheets.push({ id: null, plan_id: 'master_sheet', sheet_name: m.label,
            columns_data: allCols.map(function(c) { return Object.assign({}, c); }),
            rows_data: rows, sort_order: idx + 1 });
    });

    // Fallback: no dated plans → one tab per plan
    if (!sortedMonths.length && allItems.length) {
        var byPlan = {};
        allItems.forEach(function(item) {
            if (!byPlan[item.plan]) byPlan[item.plan] = { cat: item.planCat, items: [] };
            byPlan[item.plan].items.push(item);
        });
        Object.keys(byPlan).sort(function(a, b) {
            var oA = (typeof PLAN_CAT_ORDER !== 'undefined' ? PLAN_CAT_ORDER[byPlan[a].cat] : 0) || 99;
            var oB = (typeof PLAN_CAT_ORDER !== 'undefined' ? PLAN_CAT_ORDER[byPlan[b].cat] : 0) || 99;
            return oA !== oB ? oA - oB : a.localeCompare(b);
        }).forEach(function(planTitle, idx) {
            var short = planTitle.length > 14 ? planTitle.substring(0, 12) + '\u2026' : planTitle;
            sheets.push({ id: null, plan_id: 'master_sheet', sheet_name: short,
                columns_data: allCols.map(function(c) { return Object.assign({}, c); }),
                rows_data: _buildRowsWithGrouping(byPlan[planTitle].items), sort_order: idx + 1 });
        });
    }

    _ptCache['master_sheet'] = sheets;
    if (typeof renderPlanTableUI === 'function') renderPlanTableUI('master_sheet');
}

function _buildEmptyMasterSheet() {
    var cols = [
        { id: 'c_plan',   name: 'Plan',       width: 150 },
        { id: 'c_period', name: 'Date Range',  width: 155 },
        { id: 'c_task',   name: 'Task / Row',  width: 240 },
        { id: 'c_status', name: 'Status',      width: 100 },
        { id: 'c_note',   name: 'Note',        width: 175 }
    ];
    var rows = [];
    for (var i = 0; i < 6; i++) { var cells = {}; cols.forEach(function(c) { cells[c.id] = { v: '' }; }); rows.push({ id: 'r_' + i, cells: cells }); }
    return { id: null, plan_id: 'master_sheet', sheet_name: '\u2605 All Items', columns_data: cols, rows_data: rows, sort_order: 0 };
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
var PLAN_CAT_ORDER  = { gs1:1, gs2:2, gs3:3, gs4:4, essay:5, optional:6, common:7, custom:8 };

function sortPlanCards() {
    var grid = document.getElementById('planner-grid');
    if (!grid) return;
    var wrappers = Array.from(grid.querySelectorAll('.plan-card-wrapper'));
    wrappers.sort(function(a, b) {
        var encA = a.id.replace('plan_card_wrapper_', '');
        var encB = b.id.replace('plan_card_wrapper_', '');
        var pA = _planDataStore[encA] || {}, pB = _planDataStore[encB] || {};
        var oA = PLAN_CAT_ORDER[pA.category] || 99, oB = PLAN_CAT_ORDER[pB.category] || 99;
        if (oA !== oB) return oA - oB;
        return (pA.title || '').localeCompare(pB.title || '');
    });
    wrappers.forEach(function(w) { grid.appendChild(w); });
}

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

    // For plans using Tables mode (or both), generate spreadsheet rows instead of checkbox tasks
    var useTable = (plan.contentType === 'tables' || plan.contentType === 'both');
    if (useTable) { generateAutoTableRows(enc, mode); return; }

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

// ── Auto-generate table rows for Quick Setup ────────────────────────────────
function generateAutoTableRows(enc, mode) {
    var plan = _planDataStore[enc];
    if (!plan || !plan.startDate || !plan.endDate) return;
    var start = new Date(plan.startDate + 'T00:00:00');
    var end   = new Date(plan.endDate   + 'T00:00:00');

    function fmtRange(d1, d2) {
        return d1.toLocaleDateString('en-IN', { day:'numeric', month:'short' })
             + ' \u2013 ' + d2.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
    }

    // Ensure the plan's table cache is loaded, then add rows
    var doAdd = function() {
        var sheets = _ptCache[enc];
        if (!sheets || !sheets.length) return;
        var sheet = sheets[0];
        var newRows = [];

        if (mode === 'monthly') {
            var d = new Date(start.getFullYear(), start.getMonth(), 1);
            var mNum = 1;
            while (d <= end) {
                var mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                if (mEnd > end) mEnd = new Date(end);
                // Month header row
                var mLabel = 'Month ' + mNum + ' — ' + d.toLocaleDateString('en-IN', { month: 'long', year:'numeric' });
                var mCells = {}; sheet.columns_data.forEach(function(c) { mCells[c.id] = {v:''}; });
                mCells['c_subj'] = {v: mLabel, b: true};
                newRows.push({ id:'r_auto_m'+mNum+'_'+Date.now(), cells: mCells });
                // Weekly sub-rows
                var wStart = new Date(d < start ? start : d), wNum = 1;
                while (wStart <= mEnd) {
                    var wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 6);
                    if (wEnd > mEnd) wEnd = new Date(mEnd);
                    var wCells = {}; sheet.columns_data.forEach(function(c) { wCells[c.id] = {v:''}; });
                    wCells['c_dates'] = {v: 'Wk '+wNum+' ('+fmtRange(wStart,wEnd)+')'};
                    newRows.push({ id:'r_auto_w'+wNum+'_'+Date.now()+wNum, cells: wCells });
                    wStart.setDate(wStart.getDate() + 7); wNum++;
                }
                d.setMonth(d.getMonth() + 1); mNum++;
            }
        } else if (mode === 'weekly') {
            var wStart = new Date(start), wNum = 1;
            while (wStart <= end) {
                var wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 6);
                if (wEnd > end) wEnd = new Date(end);
                var wCells = {}; sheet.columns_data.forEach(function(c) { wCells[c.id] = {v:''}; });
                wCells['c_dates'] = {v: 'Wk '+wNum+' ('+fmtRange(wStart,wEnd)+')'};
                newRows.push({ id:'r_auto_wk'+wNum+'_'+Date.now()+wNum, cells: wCells });
                wStart.setDate(wStart.getDate() + 7); wNum++;
            }
        } else { // daily
            var d2 = new Date(start), dayNum = 1;
            while (d2 <= end) {
                var dCells = {}; sheet.columns_data.forEach(function(c) { dCells[c.id] = {v:''}; });
                dCells['c_dates'] = {v: 'Day '+dayNum+' — '+d2.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})};
                newRows.push({ id:'r_auto_d'+dayNum+'_'+Date.now()+dayNum, cells: dCells });
                d2.setDate(d2.getDate() + 1); dayNum++;
            }
        }

        newRows.forEach(function(r) { sheet.rows_data.push(r); });
        // Remove quick-setup banner
        var banner = document.getElementById('plan-auto-setup');
        if (banner) banner.remove();
        // Switch to Tables tab and re-render
        switchDrawerTab('table');
        if (typeof renderPlanTableUI === 'function') renderPlanTableUI(enc);
        ptDebounce(enc, 0);
    };

    if (_ptCache[enc]) { doAdd(); }
    else { loadPlanTables(enc).then ? loadPlanTables(enc).then(doAdd) : setTimeout(function(){doAdd();},500); }
}

// ── Planner Mini Calendar ───────────────────────────────────────────────────
var _calYear = new Date().getFullYear();
var _calMonth = new Date().getMonth(); // 0-indexed

function renderPlannerCal() {
    var title = document.getElementById('planner-cal-title');
    var grid  = document.getElementById('planner-cal-grid');
    if (!title || !grid) return;

    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    title.textContent = months[_calMonth] + ' ' + _calYear;

    // Collect all plan date ranges for dot indicators AND hover tooltips
    var planDates = {}; // 'YYYY-MM-DD' -> [planTitle, ...]
    Object.values(_planDataStore || {}).forEach(function(p) {
        if (!p.startDate || !p.endDate) return;
        var s = new Date(p.startDate + 'T00:00:00'), e = new Date(p.endDate + 'T00:00:00');
        for (var d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
            var key = d.toISOString().slice(0,10);
            if (!planDates[key]) planDates[key] = [];
            planDates[key].push(p.title || 'Plan');
        }
    });

    var today = new Date(); today.setHours(0,0,0,0);
    var first = new Date(_calYear, _calMonth, 1);
    var startDay = first.getDay(); // 0=Sun
    var daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
    var daysInPrev  = new Date(_calYear, _calMonth, 0).getDate();

    var days = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    var html = days.map(function(d) { return '<div class="planner-cal-day-hdr">' + d + '</div>'; }).join('');

    // Leading blanks
    for (var i = 0; i < startDay; i++) {
        var prevDay = daysInPrev - startDay + 1 + i;
        html += '<div class="planner-cal-cell other-month">' + prevDay + '</div>';
    }
    // Current month days
    for (var d2 = 1; d2 <= daysInMonth; d2++) {
        var dt = new Date(_calYear, _calMonth, d2);
        var iso = dt.toISOString().slice(0,10);
        var cls = 'planner-cal-cell';
        if (dt.getTime() === today.getTime()) cls += ' today';
        else if (dt < today) cls += ' past';
        var plans = planDates[iso];
        var tooltip = '';
        if (plans && plans.length) {
            cls += ' has-plan';
            tooltip = ' title="' + plans.join(', ').replace(/"/g, '&quot;') + '"';
        }
        html += '<div class="' + cls + '"' + tooltip + '>' + d2 + '</div>';
    }
    // Trailing blanks
    var total = startDay + daysInMonth;
    var trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (var t = 1; t <= trailing; t++) {
        html += '<div class="planner-cal-cell other-month">' + t + '</div>';
    }

    grid.innerHTML = html;
}

function plannerCalMove(dir) {
    _calMonth += dir;
    if (_calMonth < 0)  { _calMonth = 11; _calYear--; }
    if (_calMonth > 11) { _calMonth = 0;  _calYear++; }
    renderPlannerCal();
}

function plannerCalToday() {
    var now = new Date();
    _calYear  = now.getFullYear();
    _calMonth = now.getMonth();
    renderPlannerCal();
}

function plannerCalToggle() {
    var wrap = document.getElementById('planner-cal-wrap');
    var btn  = document.getElementById('planner-cal-view-btn');
    if (!wrap) return;
    var collapsed = wrap.classList.toggle('planner-cal-collapsed');
    if (btn) btn.classList.toggle('active', !collapsed);
    if (!collapsed) renderPlannerCal();
}