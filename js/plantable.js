// =========================================================================
// UPSC Tracker – Plan Spreadsheet Module (plantable.js v2)
// =========================================================================

var PT_DEFAULT_COLS = [
    { id: 'c_week',   name: 'Week / Date',  width: 140 },
    { id: 'c_target', name: 'Target',        width: 200 },
    { id: 'c_status', name: 'Self Status',   width: 130 },
    { id: 'c_remark', name: 'Remarks',       width: 220 }
];

var _ptCache      = {};   // { planId: [sheet, …] }
var _ptSaveTimers = {};   // debounce timers
var _ptZoom       = {};   // { planId: 1.0 }

// ── Load ──────────────────────────────────────────────────────────────────
async function loadPlanTables(planId) {
    var container = document.getElementById('plan-table-container-' + planId);
    if (!container) return;
    if (_ptCache[planId] !== undefined) { renderPlanTableUI(planId); return; }

    container.innerHTML = '<div class="pt-loading">Loading…</div>';
    var sheets = [];

    if (typeof dbClient !== 'undefined' && typeof currentUserId !== 'undefined' && currentUserId) {
        try {
            var res = await dbClient.from('upsc_plan_tables')
                .select('*').eq('user_id', currentUserId).eq('plan_id', planId)
                .order('sort_order', { ascending: true });
            if (!res.error && res.data) sheets = res.data;
        } catch(e) { console.warn('[PT] DB load:', e.message); }
    }

    if (sheets.length === 0) {
        try { sheets = JSON.parse(localStorage.getItem('upsc_pt_' + planId) || '[]'); } catch(e) {}
    }

    if (sheets.length === 0) {
        var def = ptCreateDefaultSheet(planId, 'Sheet 1', 0);
        sheets = [def];
        ptSaveSheet(def, planId);
    }

    _ptCache[planId] = sheets;
    if (_ptZoom[planId] === undefined) _ptZoom[planId] = 1.0;
    renderPlanTableUI(planId);
}

function ptCreateDefaultSheet(planId, sheetName, sortOrder) {
    var cols = PT_DEFAULT_COLS.map(function(c) { return { id: c.id, name: c.name, width: c.width }; });
    var rows = [];
    for (var i = 0; i < 5; i++) {
        var cells = {};
        cols.forEach(function(c) { cells[c.id] = ''; });
        rows.push({ id: 'r_' + Date.now() + '_' + i, cells: cells });
    }
    return { id: null, plan_id: planId, sheet_name: sheetName,
             columns_data: cols, rows_data: rows, sort_order: sortOrder };
}

async function ptSaveSheet(sheet, planId) {
    var all = _ptCache[planId] || [sheet];
    try { localStorage.setItem('upsc_pt_' + planId, JSON.stringify(all)); } catch(e) {}
    if (typeof dbClient === 'undefined' || typeof currentUserId === 'undefined' || !currentUserId) return;
    try {
        var payload = {
            user_id: currentUserId, plan_id: planId,
            sheet_name: sheet.sheet_name,
            columns_data: sheet.columns_data, rows_data: sheet.rows_data,
            sort_order: sheet.sort_order || 0,
            updated_at: new Date().toISOString()
        };
        if (sheet.id) {
            await dbClient.from('upsc_plan_tables').update(payload).eq('id', sheet.id);
        } else {
            var ins = await dbClient.from('upsc_plan_tables').insert(payload).select().single();
            if (ins.data && _ptCache[planId]) {
                var idx = _ptCache[planId].indexOf(sheet);
                if (idx >= 0) _ptCache[planId][idx].id = ins.data.id;
            }
        }
    } catch(e) { console.warn('[PT] save:', e.message); }
}

function ptShowSaveStatus(planId, state) {
    var el = document.getElementById('pt-save-status-' + planId);
    if (!el) return;
    if (state === 'saving') {
        el.textContent = 'Saving…'; el.style.color = 'var(--t4)';
    } else {
        el.textContent = '✓ Saved'; el.style.color = '#10b981';
        setTimeout(function() { if (el.textContent === '✓ Saved') el.textContent = ''; }, 2500);
    }
}

function ptDebounce(planId, sheetIdx) {
    var key = planId + '_' + sheetIdx;
    ptShowSaveStatus(planId, 'saving');
    if (_ptSaveTimers[key]) clearTimeout(_ptSaveTimers[key]);
    _ptSaveTimers[key] = setTimeout(async function() {
        if (_ptCache[planId] && _ptCache[planId][sheetIdx]) {
            await ptSaveSheet(_ptCache[planId][sheetIdx], planId);
            ptShowSaveStatus(planId, 'saved');
        }
    }, 1200);
}

async function ptManualSave(planId) {
    var container = document.getElementById('plan-table-container-' + planId);
    var sheetIdx = parseInt((container && container.dataset.activeSheet) || '0');
    var sheet = _ptCache[planId] && _ptCache[planId][sheetIdx];
    if (!sheet) return;
    ptShowSaveStatus(planId, 'saving');
    await ptSaveSheet(sheet, planId);
    ptShowSaveStatus(planId, 'saved');
}

// ── Render ────────────────────────────────────────────────────────────────
function renderPlanTableUI(planId) {
    var container = document.getElementById('plan-table-container-' + planId);
    if (!container) return;
    var sheets = _ptCache[planId] || [];
    var activeIdx = parseInt(container.dataset.activeSheet || '0');
    if (activeIdx >= sheets.length) activeIdx = 0;
    if (_ptZoom[planId] === undefined) _ptZoom[planId] = 1.0;

    var zoom = _ptZoom[planId];
    var zoomPct = Math.round(zoom * 100);

    // Pie: count completed tasks from the plan's task tab
    var taskBoxes = document.querySelectorAll('.plan-task-box-' + planId);
    var tTotal = taskBoxes.length, tDone = 0;
    taskBoxes.forEach(function(b) { if (b.checked) tDone++; });
    var tPct = tTotal > 0 ? Math.round((tDone / tTotal) * 100) : 0;
    var pieBg = 'conic-gradient(#10b981 ' + tPct + '%, rgba(100,116,139,0.35) 0%)';

    // Sheet tabs
    var sheetTabsHtml = sheets.map(function(s, i) {
        return '<button class="pt-sheet-tab ' + (i === activeIdx ? 'active' : '') + '" '
            + 'id="pt-stab-' + planId + '-' + i + '" '
            + 'onclick="ptSwitchSheet(\'' + planId + '\',' + i + ')" '
            + 'ondblclick="ptRenameSheet(\'' + planId + '\',' + i + ',this)">'
            + ptEsc(s.sheet_name) + '</button>';
    }).join('') + '<button class="pt-add-sheet" onclick="ptAddSheet(\'' + planId + '\')">+ Sheet</button>';

    container.innerHTML =
        // toolbar
        '<div class="pt-toolbar">'
        +   '<div class="pt-toolbar-left">'
        +     '<span class="pt-tb-label">Zoom</span>'
        +     '<button class="pt-zoom-btn" onclick="ptZoomOut(\'' + planId + '\')" title="Zoom out">−</button>'
        +     '<span id="pt-zoom-pct-' + planId + '" class="pt-zoom-pct">' + zoomPct + '%</span>'
        +     '<button class="pt-zoom-btn" onclick="ptZoomIn(\'' + planId + '\')" title="Zoom in">+</button>'
        +     '<button class="pt-zoom-btn" onclick="ptZoomReset(\'' + planId + '\')" title="Reset zoom" style="font-size:0.58rem;padding:0.1rem 0.45rem;">Reset</button>'
        +   '</div>'
        +   '<div class="pt-toolbar-right">'
        +     '<div class="pt-mini-pie" style="background:' + pieBg + '" title="Task completion: ' + tPct + '%"></div>'
        +     '<span style="font-size:0.6rem;color:var(--t3);font-family:var(--mono);">' + tPct + '% done</span>'
        +     '<button class="pt-tb-btn" onclick="ptOpenFullscreen(\'' + planId + '\')" title="Full-page view">⛶ Full</button>'
        +     '<button class="pt-tb-btn pt-save-btn" onclick="ptManualSave(\'' + planId + '\')" title="Save now">💾 Save</button>'
        +     '<span id="pt-save-status-' + planId + '" class="pt-save-status"></span>'
        +   '</div>'
        + '</div>'
        + '<div class="pt-table-wrapper" id="pt-wrap-' + planId + '" style="zoom:' + zoom + '">'
        +   ptRenderSheet(planId, activeIdx)
        + '</div>'
        + '<div class="pt-sheet-bar">' + sheetTabsHtml + '</div>';

    container.dataset.activeSheet = activeIdx;
}

function ptRenderSheet(planId, sheetIdx) {
    var sheet = _ptCache[planId] && _ptCache[planId][parseInt(sheetIdx)];
    if (!sheet) return '<div class="pt-loading">No sheet data</div>';
    var cols = sheet.columns_data || [];
    var rows = sheet.rows_data    || [];
    var si   = parseInt(sheetIdx);

    var headerCells = cols.map(function(c) {
        return '<th class="pt-th" data-col="' + c.id + '">'
            + '<span class="pt-col-name" ondblclick="ptStartRenameCol(\'' + planId + '\',' + si + ',\'' + c.id + '\',this)" title="Dbl-click to rename">'
            +   ptEsc(c.name)
            + '</span>'
            + '<button class="pt-edit-col" onclick="ptStartRenameColBtn(\'' + planId + '\',' + si + ',\'' + c.id + '\',this)" title="Rename">✎</button>'
            + '<button class="pt-del-col" onclick="ptDelCol(\'' + planId + '\',' + si + ',\'' + c.id + '\')" title="Delete">✕</button>'
            + '</th>';
    }).join('');

    var bodyRows = rows.map(function(row, ri) {
        var cells = cols.map(function(c) {
            var val = (row.cells && row.cells[c.id]) ? row.cells[c.id] : '';
            return '<td class="pt-td" contenteditable="true" '
                + 'data-plan="' + planId + '" data-sidx="' + si + '" data-row="' + ri + '" data-col="' + c.id + '" '
                + 'oninput="ptOnInput(this)" onblur="ptOnBlur(this)">'
                + ptEsc(val)
                + '</td>';
        }).join('');
        return '<tr>'
            + '<td class="pt-td-num">' + (ri + 1) + '</td>'
            + cells
            + '<td class="pt-td-del"><button onclick="ptDelRow(\'' + planId + '\',' + si + ',' + ri + ')" title="Delete row">✕</button></td>'
            + '</tr>';
    }).join('');

    return '<table class="pt-table">'
        + '<thead><tr>'
        +   '<th class="pt-th-num">#</th>'
        +   headerCells
        +   '<th class="pt-th-add"><button onclick="ptAddCol(\'' + planId + '\',' + si + ')" title="Add column">+ col</button></th>'
        + '</tr></thead>'
        + '<tbody>' + bodyRows
        + '<tr><td colspan="' + (cols.length + 3) + '" class="pt-add-row-cell">'
        +   '<button onclick="ptAddRow(\'' + planId + '\',' + si + ')" class="pt-add-row-btn">+ Add Row</button>'
        + '</td></tr>'
        + '</tbody></table>';
}

function ptEsc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Actions ───────────────────────────────────────────────────────────────
function ptSwitchSheet(planId, idx) {
    var container = document.getElementById('plan-table-container-' + planId);
    if (!container) return;
    idx = parseInt(idx);
    container.dataset.activeSheet = idx;
    var wrap = document.getElementById('pt-wrap-' + planId);
    if (wrap) wrap.innerHTML = ptRenderSheet(planId, idx);
    container.querySelectorAll('.pt-sheet-tab').forEach(function(b, i) { b.classList.toggle('active', i === idx); });
}

async function ptAddSheet(planId) {
    var sheets = _ptCache[planId];
    if (!sheets) return;
    var name = 'Sheet ' + (sheets.length + 1);
    var ns = ptCreateDefaultSheet(planId, name, sheets.length);
    sheets.push(ns);
    await ptSaveSheet(ns, planId);
    renderPlanTableUI(planId);
    ptSwitchSheet(planId, sheets.length - 1);
}

// Inline sheet rename (no prompt — dblclick on active tab)
function ptRenameSheet(planId, idx, btn) {
    idx = parseInt(idx);
    if (btn.querySelector && btn.querySelector('input')) return;
    var current = btn.textContent.trim();
    var input = document.createElement('input');
    input.type = 'text'; input.value = current;
    input.className = 'pt-sheet-rename-input';
    input.style.width = Math.max(60, current.length * 8 + 24) + 'px';
    btn.textContent = '';
    btn.appendChild(input);
    input.focus(); input.select();
    var commit = function() {
        var newName = input.value.trim() || current;
        if (_ptCache[planId] && _ptCache[planId][idx]) {
            _ptCache[planId][idx].sheet_name = newName;
            ptDebounce(planId, idx);
        }
        btn.textContent = newName;
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = current; input.blur(); }
    });
    input.addEventListener('click', function(e) { e.stopPropagation(); });
}

function ptAddRow(planId, sheetIdx) {
    sheetIdx = parseInt(sheetIdx);
    var sheet = _ptCache[planId] && _ptCache[planId][sheetIdx];
    if (!sheet) return;
    var cells = {};
    (sheet.columns_data || []).forEach(function(c) { cells[c.id] = ''; });
    sheet.rows_data.push({ id: 'r_' + Date.now(), cells: cells });
    var wrap = document.getElementById('pt-wrap-' + planId);
    if (wrap) wrap.innerHTML = ptRenderSheet(planId, sheetIdx);
    ptDebounce(planId, sheetIdx);
}

function ptDelRow(planId, sheetIdx, rowIdx) {
    sheetIdx = parseInt(sheetIdx);
    var sheet = _ptCache[planId] && _ptCache[planId][sheetIdx];
    if (!sheet) return;
    sheet.rows_data.splice(parseInt(rowIdx), 1);
    var wrap = document.getElementById('pt-wrap-' + planId);
    if (wrap) wrap.innerHTML = ptRenderSheet(planId, sheetIdx);
    ptDebounce(planId, sheetIdx);
}

function ptAddCol(planId, sheetIdx) {
    sheetIdx = parseInt(sheetIdx);
    var sheet = _ptCache[planId] && _ptCache[planId][sheetIdx];
    if (!sheet) return;
    var colId = 'c_' + Date.now();
    sheet.columns_data.push({ id: colId, name: 'Column ' + (sheet.columns_data.length + 1), width: 160 });
    sheet.rows_data.forEach(function(row) { row.cells[colId] = ''; });
    var wrap = document.getElementById('pt-wrap-' + planId);
    if (wrap) wrap.innerHTML = ptRenderSheet(planId, sheetIdx);
    ptDebounce(planId, sheetIdx);
}

function ptDelCol(planId, sheetIdx, colId) {
    sheetIdx = parseInt(sheetIdx);
    var sheet = _ptCache[planId] && _ptCache[planId][sheetIdx];
    if (!sheet || sheet.columns_data.length <= 1) {
        if (typeof showToast === 'function') showToast('Cannot delete the last column', 'error');
        return;
    }
    sheet.columns_data = sheet.columns_data.filter(function(c) { return c.id !== colId; });
    sheet.rows_data.forEach(function(row) { delete row.cells[colId]; });
    var wrap = document.getElementById('pt-wrap-' + planId);
    if (wrap) wrap.innerHTML = ptRenderSheet(planId, sheetIdx);
    ptDebounce(planId, sheetIdx);
}

function ptStartRenameColBtn(planId, sheetIdx, colId, btn) {
    sheetIdx = parseInt(sheetIdx);
    var th = btn.closest ? btn.closest('th') : btn.parentElement;
    if (!th) return;
    var span = th.querySelector('.pt-col-name');
    if (span) ptStartRenameCol(planId, sheetIdx, colId, span);
}

function ptStartRenameCol(planId, sheetIdx, colId, span) {
    sheetIdx = parseInt(sheetIdx);
    if (span.querySelector && span.querySelector('input')) return;
    var current = span.textContent.trim();
    var input = document.createElement('input');
    input.type = 'text'; input.value = current; input.className = 'pt-col-edit';
    span.replaceWith(input); input.focus(); input.select();
    var commit = function() {
        var newName = input.value.trim() || current;
        var sheet = _ptCache[planId] && _ptCache[planId][sheetIdx];
        if (sheet) {
            var col = sheet.columns_data.find(function(c) { return c.id === colId; });
            if (col) { col.name = newName; ptDebounce(planId, sheetIdx); }
        }
        var ns = document.createElement('span');
        ns.className = 'pt-col-name'; ns.title = 'Dbl-click to rename';
        ns.ondblclick = function() { ptStartRenameCol(planId, sheetIdx, colId, ns); };
        ns.textContent = newName;
        input.replaceWith(ns);
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = current; input.blur(); }
    });
}

function ptOnInput(td) {
    var planId = td.dataset.plan, sheetIdx = parseInt(td.dataset.sidx);
    var rowIdx = parseInt(td.dataset.row), colId = td.dataset.col;
    var sheet = _ptCache[planId] && _ptCache[planId][sheetIdx];
    if (sheet && sheet.rows_data[rowIdx]) {
        sheet.rows_data[rowIdx].cells[colId] = td.textContent;
        ptShowSaveStatus(planId, 'saving');
    }
}

function ptOnBlur(td) {
    ptDebounce(td.dataset.plan, parseInt(td.dataset.sidx));
}

// ── Zoom ──────────────────────────────────────────────────────────────────
function ptZoomIn(planId) {
    _ptZoom[planId] = Math.min(1.8, (_ptZoom[planId] || 1.0) + 0.15);
    ptApplyZoom(planId);
}
function ptZoomOut(planId) {
    _ptZoom[planId] = Math.max(0.5, (_ptZoom[planId] || 1.0) - 0.15);
    ptApplyZoom(planId);
}
function ptZoomReset(planId) {
    _ptZoom[planId] = 1.0;
    ptApplyZoom(planId);
}
function ptApplyZoom(planId) {
    var zoom = _ptZoom[planId];
    var wrap = document.getElementById('pt-wrap-' + planId);
    if (wrap) wrap.style.zoom = zoom;
    var pct = document.getElementById('pt-zoom-pct-' + planId);
    if (pct) pct.textContent = Math.round(zoom * 100) + '%';
}

// ── Fullscreen ────────────────────────────────────────────────────────────
function ptOpenFullscreen(planId) {
    var sheets = _ptCache[planId];
    if (!sheets) return;
    var container = document.getElementById('plan-table-container-' + planId);
    var activeIdx = parseInt((container && container.dataset.activeSheet) || '0');

    var overlay = document.getElementById('pt-fullscreen-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'pt-fullscreen-overlay';
        overlay.className = 'pt-fs-overlay';
        document.body.appendChild(overlay);
    }
    overlay.innerHTML =
        '<div class="pt-fs-inner">'
        +   '<div class="pt-fs-header">'
        +     '<span class="pt-fs-title">📊 Table — Full View</span>'
        +     '<button class="pt-fs-close" onclick="ptCloseFullscreen()">✕ Close</button>'
        +   '</div>'
        +   '<div class="pt-fs-table-wrap" id="pt-fs-wrap">'
        +     ptRenderSheet(planId, activeIdx)
        +   '</div>'
        +   '<div class="pt-sheet-bar" style="border-radius:0 0 0.75rem 0.75rem;">'
        +     sheets.map(function(s, i) {
                  return '<button class="pt-sheet-tab ' + (i === activeIdx ? 'active' : '') + '" '
                      + 'onclick="ptFsSwitchSheet(\'' + planId + '\',' + i + ',this)">'
                      + ptEsc(s.sheet_name) + '</button>';
              }).join('')
        +   '</div>'
        + '</div>';
    overlay.style.display = 'flex';
    overlay.onclick = function(e) { if (e.target === overlay) ptCloseFullscreen(); };
}

function ptFsSwitchSheet(planId, idx, btn) {
    var wrap = document.getElementById('pt-fs-wrap');
    if (wrap) wrap.innerHTML = ptRenderSheet(planId, parseInt(idx));
    var bar = btn.parentElement;
    bar.querySelectorAll('.pt-sheet-tab').forEach(function(b, i) { b.classList.toggle('active', i === parseInt(idx)); });
}

function ptCloseFullscreen() {
    var overlay = document.getElementById('pt-fullscreen-overlay');
    if (overlay) overlay.style.display = 'none';
}
