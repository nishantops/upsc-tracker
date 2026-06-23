// =========================================================================
// UPSC Tracker - Plan Spreadsheet Module (plantable.js)
// =========================================================================

var PT_DEFAULT_COLS = [
    { id: 'c_week',   name: 'Week / Date',  width: 140 },
    { id: 'c_target', name: 'Target',        width: 200 },
    { id: 'c_status', name: 'Self Status',   width: 130 },
    { id: 'c_remark', name: 'Remarks',       width: 220 }
];

var _ptCache      = {};
var _ptSaveTimers = {};

// ── Load ──────────────────────────────────────────────────────────────────
async function loadPlanTables(planId) {
    var container = document.getElementById('plan-table-container-' + planId);
    if (!container) return;
    if (_ptCache[planId] !== undefined) { renderPlanTableUI(planId); return; }

    container.innerHTML = '<div class="pt-loading">Loading...</div>';
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

function ptDebounce(planId, sheetIdx) {
    var key = planId + '_' + sheetIdx;
    if (_ptSaveTimers[key]) clearTimeout(_ptSaveTimers[key]);
    _ptSaveTimers[key] = setTimeout(async function() {
        if (_ptCache[planId] && _ptCache[planId][sheetIdx]) {
            await ptSaveSheet(_ptCache[planId][sheetIdx], planId);
        }
    }, 1200);
}

// ── Render ────────────────────────────────────────────────────────────────
function renderPlanTableUI(planId) {
    var container = document.getElementById('plan-table-container-' + planId);
    if (!container) return;
    var sheets = _ptCache[planId] || [];
    var activeIdx = parseInt(container.dataset.activeSheet || '0');
    if (activeIdx >= sheets.length) activeIdx = 0;

    var sheetTabsHtml = sheets.map(function(s, i) {
        return '<button class="pt-sheet-tab ' + (i === activeIdx ? 'active' : '') + '" '
            + 'onclick="ptSwitchSheet(\'' + planId + '\',' + i + ')" '
            + 'ondblclick="ptRenameSheet(\'' + planId + '\',' + i + ',this)">'
            + ptEsc(s.sheet_name) + '</button>';
    }).join('') + '<button class="pt-add-sheet" onclick="ptAddSheet(\'' + planId + '\')">+ Sheet</button>';

    container.innerHTML = '<div class="pt-table-wrapper" id="pt-wrap-' + planId + '">'
        + ptRenderSheet(planId, activeIdx)
        + '</div>'
        + '<div class="pt-sheet-bar">' + sheetTabsHtml + '</div>';
    container.dataset.activeSheet = activeIdx;
}

function ptRenderSheet(planId, sheetIdx) {
    var sheet = _ptCache[planId] && _ptCache[planId][sheetIdx];
    if (!sheet) return '<div class="pt-loading">No sheet data</div>';
    var cols = sheet.columns_data || [];
    var rows = sheet.rows_data    || [];

    var headerCells = cols.map(function(c) {
        return '<th class="pt-th" data-col="' + c.id + '">'
            + '<span class="pt-col-name" ondblclick="ptStartRenameCol(\'' + planId + '\',' + sheetIdx + ',\'' + c.id + '\',this)">' + ptEsc(c.name) + '</span>'
            + '<button class="pt-del-col" onclick="ptDelCol(\'' + planId + '\',' + sheetIdx + ',\'' + c.id + '\')" title="Delete column">&#10005;</button>'
            + '</th>';
    }).join('');

    var bodyRows = rows.map(function(row, ri) {
        var cells = cols.map(function(c) {
            return '<td class="pt-td" contenteditable="true" '
                + 'data-plan="' + planId + '" data-sidx="' + sheetIdx + '" data-row="' + ri + '" data-col="' + c.id + '" '
                + 'oninput="ptOnInput(this)" onblur="ptOnBlur(this)">'
                + ptEsc(row.cells && row.cells[c.id] ? row.cells[c.id] : '')
                + '</td>';
        }).join('');
        return '<tr data-row="' + ri + '">'
            + '<td class="pt-td-num">' + (ri + 1) + '</td>'
            + cells
            + '<td class="pt-td-del"><button onclick="ptDelRow(\'' + planId + '\',' + sheetIdx + ',' + ri + ')" title="Delete row">&#10005;</button></td>'
            + '</tr>';
    }).join('');

    return '<table class="pt-table">'
        + '<thead><tr><th class="pt-th-num">#</th>' + headerCells
        + '<th class="pt-th-add"><button onclick="ptAddCol(\'' + planId + '\',' + sheetIdx + ')" title="Add column">+ col</button></th></tr></thead>'
        + '<tbody>' + bodyRows
        + '<tr><td colspan="' + (cols.length + 3) + '" class="pt-add-row-cell">'
        + '<button onclick="ptAddRow(\'' + planId + '\',' + sheetIdx + '\')">+ Add Row</button></td></tr>'
        + '</tbody></table>';
}

function ptEsc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Actions ───────────────────────────────────────────────────────────────
function ptSwitchSheet(planId, idx) {
    var container = document.getElementById('plan-table-container-' + planId);
    if (!container) return;
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

function ptRenameSheet(planId, idx, btn) {
    var newName = prompt('Sheet name:', btn.textContent.trim());
    if (!newName) return;
    if (_ptCache[planId] && _ptCache[planId][idx]) {
        _ptCache[planId][idx].sheet_name = newName.trim();
        btn.textContent = newName.trim();
        ptDebounce(planId, idx);
    }
}

function ptAddRow(planId, sheetIdx) {
    var sheet = _ptCache[planId] && _ptCache[planId][sheetIdx];
    if (!sheet) return;
    var cells = {};
    sheet.columns_data.forEach(function(c) { cells[c.id] = ''; });
    sheet.rows_data.push({ id: 'r_' + Date.now(), cells: cells });
    var wrap = document.getElementById('pt-wrap-' + planId);
    if (wrap) wrap.innerHTML = ptRenderSheet(planId, sheetIdx);
    ptDebounce(planId, sheetIdx);
}

function ptDelRow(planId, sheetIdx, rowIdx) {
    var sheet = _ptCache[planId] && _ptCache[planId][sheetIdx];
    if (!sheet) return;
    sheet.rows_data.splice(rowIdx, 1);
    var wrap = document.getElementById('pt-wrap-' + planId);
    if (wrap) wrap.innerHTML = ptRenderSheet(planId, sheetIdx);
    ptDebounce(planId, sheetIdx);
}

function ptAddCol(planId, sheetIdx) {
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

function ptStartRenameCol(planId, sheetIdx, colId, span) {
    var current = span.textContent;
    var input = document.createElement('input');
    input.type = 'text'; input.value = current; input.className = 'pt-col-edit';
    span.replaceWith(input); input.focus(); input.select();
    var commit = function() {
        var newName = input.value.trim() || current;
        var sheet = _ptCache[planId] && _ptCache[planId][sheetIdx];
        if (sheet) {
            var col = sheet.columns_data.find(function(c) { return c.id === colId; });
            if (col) col.name = newName;
            ptDebounce(planId, sheetIdx);
        }
        var ns = document.createElement('span');
        ns.className = 'pt-col-name';
        ns.ondblclick = function() { ptStartRenameCol(planId, sheetIdx, colId, ns); };
        ns.textContent = newName;
        input.replaceWith(ns);
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = current; input.blur(); }
    });
}

function ptOnInput(td) {
    var planId = td.dataset.plan, sheetIdx = parseInt(td.dataset.sidx);
    var rowIdx = parseInt(td.dataset.row), colId = td.dataset.col;
    var sheet = _ptCache[planId] && _ptCache[planId][sheetIdx];
    if (sheet && sheet.rows_data[rowIdx]) {
        sheet.rows_data[rowIdx].cells[colId] = td.textContent;
    }
}

function ptOnBlur(td) {
    ptDebounce(td.dataset.plan, parseInt(td.dataset.sidx));
}
