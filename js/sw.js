// =========================================================================
// UPSC Tracker — Strengths & Weaknesses Module (sw.js v1)
// Persists to upsc_user_profiles.profile_data JSONB column
// =========================================================================

var _swData = { strengths: [], weaknesses: [], show_sw: true };
var _swSaveTimer = null;

// ── Load ──────────────────────────────────────────────────────────────────
async function loadSWData() {
    // Try localStorage first (fast render)
    var cached = currentUserId ? localStorage.getItem('upsc_sw_' + currentUserId) : null;
    if (cached) {
        try { _swData = JSON.parse(cached); } catch(e) {}
    }
    // Then fetch from DB
    if (typeof dbClient !== 'undefined' && dbClient && currentUserId) {
        try {
            var res = await dbClient.from('upsc_user_profiles')
                .select('profile_data').eq('user_id', currentUserId).maybeSingle();
            if (res.data && res.data.profile_data) {
                var pd = res.data.profile_data;
                if (pd.strengths !== undefined || pd.weaknesses !== undefined) {
                    _swData.strengths = pd.strengths || [];
                    _swData.weaknesses = pd.weaknesses || [];
                    if (pd.show_sw !== undefined) _swData.show_sw = pd.show_sw;
                    localStorage.setItem('upsc_sw_' + currentUserId, JSON.stringify(_swData));
                }
            }
        } catch(e) { console.warn('[SW] load:', e.message); }
    }
    renderSWWidget();
}

// ── Save ──────────────────────────────────────────────────────────────────
function _swDebounceSave() {
    if (_swSaveTimer) clearTimeout(_swSaveTimer);
    _swSaveTimer = setTimeout(async function() {
        if (currentUserId) localStorage.setItem('upsc_sw_' + currentUserId, JSON.stringify(_swData));
        if (typeof dbClient === 'undefined' || !dbClient || !currentUserId) return;
        try {
            // Read existing profile_data first, then merge (avoid overwriting other JSONB keys)
            var existing = {};
            var rd = await dbClient.from('upsc_user_profiles')
                .select('profile_data').eq('user_id', currentUserId).maybeSingle();
            if (rd.data && rd.data.profile_data) existing = rd.data.profile_data;
            var merged = Object.assign({}, existing, {
                strengths: _swData.strengths,
                weaknesses: _swData.weaknesses,
                show_sw: _swData.show_sw
            });
            await dbClient.from('upsc_user_profiles')
                .update({ profile_data: merged }).eq('user_id', currentUserId);
        } catch(e) { console.warn('[SW] save:', e.message); }
    }, 800);
}

// ── Render homepage widget ────────────────────────────────────────────────
function renderSWWidget() {
    var widget = document.getElementById('sw-widget');
    if (!widget) return;

    // Never fully hide the widget — keeps the layout stable and the toggle always accessible.
    // Just dim the rails when show_sw is false.
    widget.classList.remove('hidden');

    // Toggle checkbox sync
    var toggle = document.getElementById('sw-homepage-toggle');
    if (toggle) toggle.checked = !!_swData.show_sw;

    // Dim rails when hidden from homepage; re-enable when visible
    var rails = widget.querySelector('.sw-rails');
    if (rails) {
        if (!_swData.show_sw) {
            rails.style.opacity = '0.35';
            rails.style.pointerEvents = 'none';
        } else {
            rails.style.opacity = '';
            rails.style.pointerEvents = '';
        }
    }

    // Strengths chips
    var sc = document.getElementById('sw-chips-strengths');
    if (sc) sc.innerHTML = _swData.strengths.map(function(item) {
        return '<div class="sw-chip sw-chip-strength" data-id="' + escSW(item.id) + '">'
            + '<span class="sw-chip-text">' + escSW(item.text) + '</span>'
            + '<button class="sw-chip-edit" onclick="swEditItem(\'' + escSW(item.id) + '\',\'strength\')" title="Edit">✎</button>'
            + '<button class="sw-chip-del" onclick="swDeleteItem(\'' + escSW(item.id) + '\',\'strength\')" title="Remove">✕</button>'
            + '</div>';
    }).join('') + '<button class="sw-chip-add" onclick="openSWManager(\'strength\')">+ Add</button>';

    // Weaknesses chips
    var wc = document.getElementById('sw-chips-weaknesses');
    if (wc) wc.innerHTML = _swData.weaknesses.map(function(item) {
        return '<div class="sw-chip sw-chip-weakness" data-id="' + escSW(item.id) + '">'
            + '<span class="sw-chip-text">' + escSW(item.text) + '</span>'
            + '<button class="sw-chip-edit" onclick="swEditItem(\'' + escSW(item.id) + '\',\'weakness\')" title="Edit">✎</button>'
            + '<button class="sw-chip-del" onclick="swDeleteItem(\'' + escSW(item.id) + '\',\'weakness\')" title="Remove">✕</button>'
            + '</div>';
    }).join('') + '<button class="sw-chip-add" onclick="openSWManager(\'weakness\')">+ Add</button>';
}

// ── Generic list renderer (used by both manager modal and profile modal) ─────
function _renderSWList(containerId, prefix) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var allItems = _swData.strengths.map(function(i) { return Object.assign({}, i, { type: 'strength' }); })
        .concat(_swData.weaknesses.map(function(i) { return Object.assign({}, i, { type: 'weakness' }); }));
    if (allItems.length === 0) {
        el.innerHTML = '<div class="sw-empty">No items yet. Add your first strength or weakness above.</div>';
        return;
    }
    el.innerHTML = allItems.map(function(item) {
        var tag = item.type === 'strength'
            ? '<span class="sw-type-tag sw-type-strength">💪 Strength</span>'
            : '<span class="sw-type-tag sw-type-weakness">⚠️ Weakness</span>';
        return '<div class="sw-manager-row" id="' + prefix + '-row-' + escSW(item.id) + '">'
            + tag
            + '<span class="sw-manager-text" id="' + prefix + '-text-' + escSW(item.id) + '">' + escSW(item.text) + '</span>'
            + '<div class="sw-manager-actions">'
            + '<button class="sw-mgr-btn sw-mgr-edit" onclick="swStartEditRow(\'' + escSW(item.id) + '\',\'' + item.type + '\',\'' + prefix + '\')" title="Edit">✎</button>'
            + '<button class="sw-mgr-btn sw-mgr-del" onclick="swDeleteItem(\'' + escSW(item.id) + '\',\'' + item.type + '\')" title="Delete">🗑</button>'
            + '</div>'
            + '</div>';
    }).join('');
}

function renderSWManagerList() {
    _renderSWList('sw-manager-list', 'sw');
}

function renderSWInProfileModal() {
    _renderSWList('pm-sw-list', 'pm-sw');
    var toggle = document.getElementById('pm-sw-homepage-toggle');
    if (toggle) toggle.checked = !!_swData.show_sw;
}

// ── Open / close manager ──────────────────────────────────────────────────
function openSWManager(defaultType) {
    var modal = document.getElementById('sw-manager-modal');
    if (!modal) return;
    renderSWManagerList();
    // Pre-select type if called from widget "+ Add" button
    var typeSel = document.getElementById('sw-new-type');
    if (typeSel && defaultType) typeSel.value = defaultType;
    document.getElementById('sw-new-text').value = '';
    document.getElementById('sw-add-error').style.display = 'none';
    // Sync toggle checkboxes
    var t1 = document.getElementById('sw-homepage-toggle');
    var t2 = document.getElementById('sw-homepage-toggle-modal');
    if (t1) t1.checked = !!_swData.show_sw;
    if (t2) t2.checked = !!_swData.show_sw;
    modal.classList.remove('hidden');
    document.getElementById('sw-new-text').focus();
}

function closeSWManager() {
    var modal = document.getElementById('sw-manager-modal');
    if (modal) modal.classList.add('hidden');
}

// ── Add item ─────────────────────────────────────────────────────────────
function swAddItem() {
    var textEl = document.getElementById('sw-new-text');
    var typeEl = document.getElementById('sw-new-type');
    var errEl  = document.getElementById('sw-add-error');
    var text = textEl.value.trim();
    var type = typeEl.value;
    errEl.style.display = 'none';

    if (!text) { errEl.textContent = 'Please enter a description.'; errEl.style.display = 'block'; textEl.focus(); return; }
    if (text.length > 120) { errEl.textContent = 'Max 120 characters allowed.'; errEl.style.display = 'block'; return; }
    if (text.length < 2) { errEl.textContent = 'Min 2 characters required.'; errEl.style.display = 'block'; return; }

    var item = { id: type[0] + '_' + Date.now(), text: text, ts: Date.now() };
    if (type === 'strength') { _swData.strengths.push(item); }
    else { _swData.weaknesses.push(item); }

    textEl.value = '';
    _swDebounceSave();
    renderSWManagerList();
    renderSWInProfileModal();
    renderSWWidget();
    if (typeof showToast === 'function') showToast('Added to ' + type + 's ✓', 'success');
}

// ── Add item from profile modal ───────────────────────────────────────────
function pmSwAddItem() {
    var textEl = document.getElementById('pm-sw-text');
    var typeEl = document.getElementById('pm-sw-type');
    var errEl  = document.getElementById('pm-sw-error');
    var text = textEl.value.trim();
    var type = typeEl.value;
    errEl.style.display = 'none';

    if (!text) { errEl.textContent = 'Please enter a description.'; errEl.style.display = 'block'; textEl.focus(); return; }
    if (text.length > 120) { errEl.textContent = 'Max 120 characters allowed.'; errEl.style.display = 'block'; return; }
    if (text.length < 2) { errEl.textContent = 'Min 2 characters required.'; errEl.style.display = 'block'; return; }

    var item = { id: type[0] + '_' + Date.now(), text: text, ts: Date.now() };
    if (type === 'strength') { _swData.strengths.push(item); }
    else { _swData.weaknesses.push(item); }

    textEl.value = '';
    _swDebounceSave();
    renderSWManagerList();
    renderSWInProfileModal();
    renderSWWidget();
    if (typeof showToast === 'function') showToast('Added to ' + type + 's ✓', 'success');
}

// ── Delete item ───────────────────────────────────────────────────────────
function swDeleteItem(id, type) {
    if (type === 'strength') {
        _swData.strengths = _swData.strengths.filter(function(i) { return i.id !== id; });
    } else {
        _swData.weaknesses = _swData.weaknesses.filter(function(i) { return i.id !== id; });
    }
    _swDebounceSave();
    renderSWManagerList();
    renderSWInProfileModal();
    renderSWWidget();
}

// ── Inline edit (accepts prefix: 'sw' for manager modal, 'pm-sw' for profile modal) ─
function swStartEditRow(id, type, prefix) {
    prefix = prefix || 'sw';
    var row = document.getElementById(prefix + '-row-' + id);
    var textSpan = document.getElementById(prefix + '-text-' + id);
    if (!row || !textSpan) return;

    var current = textSpan.textContent;
    var input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.className = 'sw-edit-input';
    input.maxLength = 120;
    textSpan.replaceWith(input);
    input.focus(); input.select();

    var commit = function() {
        var newText = input.value.trim();
        if (!newText || newText.length < 2) { newText = current; }
        var arr = type === 'strength' ? _swData.strengths : _swData.weaknesses;
        var item = arr.find(function(i) { return i.id === id; });
        if (item) item.text = newText;
        _swDebounceSave();
        renderSWManagerList();
        renderSWInProfileModal();
        renderSWWidget();
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = current; input.blur(); }
    });
}

// ── Inline edit from widget chip ──────────────────────────────────────────
function swEditItem(id, type) {
    openSWManager(type);
    // Scroll to and trigger edit on the row
    setTimeout(function() { swStartEditRow(id, type); }, 80);
}

// ── Homepage visibility toggle ────────────────────────────────────────────
function swToggleHomepage(checked) {
    _swData.show_sw = !!checked;
    _swDebounceSave();
    renderSWWidget();
}

// ── ESC to close manager modal or profile modal ───────────────────────────
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        var swModal = document.getElementById('sw-manager-modal');
        if (swModal && !swModal.classList.contains('hidden')) { closeSWManager(); return; }
        var pmModal = document.getElementById('profile-modal-full');
        if (pmModal && !pmModal.classList.contains('hidden')) { closeProfileModal(); return; }
    }
});

// ── Util ──────────────────────────────────────────────────────────────────
function escSW(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
