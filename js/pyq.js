// =========================================================================
// UPSC Tracker - PYQ (Previous Year Questions) Module
// =========================================================================

function renderPYQTopics() {
    if (typeof pyqGS1Data === 'undefined') return;
    const container = document.getElementById('pyq-topics-container');
    if (!container) return;

    let totalQ = 0;
    let topicHtml = '';

    pyqGS1Data.forEach((topic, tIdx) => {
        let topicQCount = 0;
        topic.subtopics.forEach(st => { topicQCount += st.questions.length; });
        totalQ += topicQCount;

        let subtopicsHtml = '';
        topic.subtopics.forEach((st, sIdx) => {
            subtopicsHtml += `
                <div class="pyq-subtopic border-b border-slate-700/30 last:border-b-0">
                    <button onclick="togglePYQSubtopic(${tIdx}, ${sIdx})" class="w-full flex items-center justify-between px-6 py-3 hover:bg-white/5 transition-all cursor-pointer">
                        <div class="flex items-center gap-2">
                            <span class="text-indigo-400 text-xs transition-transform duration-200" id="arrow-st-${tIdx}-${sIdx}">&#9654;</span>
                            <span class="font-semibold text-sm text-slate-100">${st.name}</span>
                        </div>
                        <span class="text-[10px] font-mono font-bold text-indigo-300">${st.questions.length} Q</span>
                    </button>
                    <div id="pyq-st-body-${tIdx}-${sIdx}" class="hidden px-4 pb-3"></div>
                </div>`;
        });

        topicHtml += `
        <div class="pyq-topic border border-indigo-500/30 rounded-2xl overflow-hidden shadow-lg">
            <button onclick="togglePYQTopic(${tIdx})" class="w-full flex items-center justify-between p-4 bg-gradient-to-r from-indigo-900/60 to-slate-800/60 hover:from-indigo-800/70 hover:to-slate-700/60 transition-all cursor-pointer">
                <div class="flex items-center gap-3">
                    <span class="text-indigo-400 transition-transform duration-200" id="arrow-topic-${tIdx}">&#9654;</span>
                    <span class="font-bold text-sm text-white">${topic.name}</span>
                </div>
                <span class="text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-md border border-indigo-500/30">${topicQCount} Q</span>
            </button>
            <div id="pyq-topic-body-${tIdx}" class="hidden border-t border-indigo-500/20 bg-slate-900/30">
                ${subtopicsHtml}
            </div>
        </div>`;
    });

    container.innerHTML = topicHtml;
    const countEl = document.getElementById('pyq-total-count');
    if (countEl) countEl.textContent = totalQ;
}

function togglePYQTopic(tIdx) {
    const body = document.getElementById('pyq-topic-body-' + tIdx);
    const arrow = document.getElementById('arrow-topic-' + tIdx);
    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        arrow.style.transform = 'rotate(90deg)';
    } else {
        body.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
    }
}

function togglePYQSubtopic(tIdx, sIdx) {
    const body = document.getElementById('pyq-st-body-' + tIdx + '-' + sIdx);
    const arrow = document.getElementById('arrow-st-' + tIdx + '-' + sIdx);
    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        arrow.style.transform = 'rotate(90deg)';
        renderSubtopicQuestions(tIdx, sIdx);
    } else {
        body.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
    }
}

function renderSubtopicQuestions(tIdx, sIdx) {
    renderQuestionsGeneric(tIdx, sIdx, pyqGS1Data, 'pyq', 'pyq-search', 'pyq-year-filter');
}

function renderCSATSubtopicQuestions(tIdx, sIdx) {
    renderQuestionsGeneric(tIdx, sIdx, pyqCSATData, 'csat', 'csat-search', 'csat-year-filter');
}

function renderQuestionsGeneric(tIdx, sIdx, dataSource, prefix, searchId, yearId) {
    const container = document.getElementById(prefix + '-st-body-' + tIdx + '-' + sIdx);
    const allQuestions = dataSource[tIdx].subtopics[sIdx].questions;

    const search = (document.getElementById(searchId).value || '').toLowerCase();
    const year = document.getElementById(yearId).value;
    const questions = allQuestions.filter(q => {
        const matchSearch = !search || (q.question || '').toLowerCase().includes(search);
        const matchYear = !year || q.year === year;
        return matchSearch && matchYear;
    });

    let qHtml = '<div class="space-y-2">';
    questions.forEach((q, qIdx) => {
        const qId = prefix + '-q-' + tIdx + '-' + sIdx + '-' + qIdx;
        const isDropped = q.answer === 'X';
        const ansLetter = isDropped ? 'X' : (q.answer ? q.answer.toUpperCase() : '?');

        const optHtml = Object.entries(q.options || {}).map(([key, val]) =>
            '<label class="flex items-start gap-1.5 py-1 cursor-pointer rounded px-2 hover:bg-indigo-50 transition-all" id="' + qId + '-opt-' + key + '">' +
                '<input type="radio" name="' + qId + '" value="' + key + '" onchange="checkAnswer(\'' + qId + '\',\'' + key + '\',\'' + (q.answer || '') + '\')" class="mt-0.5 h-4 w-4 text-indigo-600 border-gray-400 cursor-pointer">' +
                '<span class="font-bold text-indigo-700 text-[12px]">(' + key + ')</span>' +
                '<span class="text-[12px] text-gray-800 font-medium">' + escH(val) + '</span>' +
            '</label>'
        ).join('');
        const clearBtn = '<button onclick="clearAnswer(\'' + qId + '\')" class="text-[10px] font-bold text-red-400 hover:text-red-600 mt-1.5 cursor-pointer">✕ Clear</button>';

        const yearBadge = q.year ? '<span class="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300">' + q.year + '</span>' : '';

        let answerDisplay;
        if (isDropped) {
            answerDisplay = '<div class="hidden mt-2 bg-orange-100 border-2 border-orange-300 rounded-lg px-3 py-2"><span class="text-[12px] font-bold text-orange-800">⚠ Dropped by UPSC</span><span class="text-[11px] text-orange-700 ml-1">- No valid answer</span></div>';
        } else {
            const ansText = (q.answer && q.options && q.options[q.answer]) ? q.options[q.answer] : '';
            answerDisplay = '<div class="hidden mt-2 bg-emerald-100 border-2 border-emerald-300 rounded-lg px-3 py-2"><span class="text-[12px] font-bold text-emerald-800">✓ Answer: (' + ansLetter + ')</span>' + (ansText ? '<span class="text-[12px] text-emerald-700 ml-1 font-medium">- ' + escH(ansText) + '</span>' : '') + '</div>';
        }

        const feedbackDiv = '<div id="' + qId + '-feedback" class="hidden mt-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold"></div>';

        let passageHtml = '';
        if (q.passage) {
            const prevQ = qIdx > 0 ? questions[qIdx - 1] : null;
            const samePassage = prevQ && prevQ.passage === q.passage;
            if (!samePassage) {
                passageHtml = '<div class="mb-3 bg-blue-50 border-2 border-blue-200 rounded-lg p-3">' +
                    '<button onclick="this.nextElementSibling.classList.toggle(\'hidden\');this.querySelector(\'span\').textContent=this.nextElementSibling.classList.contains(\'hidden\')?\'Show Passage ▸\':\'Hide Passage ▾\'" class="text-[11px] font-bold text-blue-700 hover:text-blue-900 cursor-pointer"><span>Show Passage ▸</span></button>' +
                    '<div class="hidden mt-2 text-[12px] text-gray-800 leading-relaxed font-medium">' + q.passage + '</div></div>';
            }
        }

        qHtml += '<div class="pyq-question bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-indigo-400 hover:shadow-md transition-all" id="' + qId + '-card">' +
            '<div class="flex items-start gap-3">' +
                '<input type="checkbox" id="' + prefix + '-cb-' + tIdx + '-' + sIdx + '-' + qIdx + '" onchange="handleSyncAction(this.id)" class="mt-1 h-5 w-5 rounded border-gray-400 text-indigo-600 focus:ring-indigo-500/30 cursor-pointer shrink-0">' +
                '<div class="flex-1 min-w-0">' +
                    '<div class="flex items-center gap-2 mb-1.5"><span class="text-[11px] font-mono font-bold text-gray-500">Q' + q.number + '</span>' + yearBadge + (isDropped ? '<span class="text-[10px] font-mono font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded border border-orange-300">DROPPED</span>' : '') + '</div>' +
                    passageHtml +
                    '<p class="text-[13px] text-gray-900 font-semibold leading-relaxed">' + formatQText(q.question) + '</p>' +
                    '<div class="mt-3 pl-3 border-l-3 border-indigo-200">' + optHtml + clearBtn + '</div>' +
                    feedbackDiv +
                    '<div class="mt-3"><button onclick="this.nextElementSibling.classList.toggle(\'hidden\');this.textContent=this.textContent===\'Show Answer\'?\'Hide Answer\':\'Show Answer\'" class="text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-md cursor-pointer transition-all">Show Answer</button>' +
                    answerDisplay + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="mt-3 ml-8"><input type="text" id="note-' + prefix + '-cb-' + tIdx + '-' + sIdx + '-' + qIdx + '" oninput="debouncedSync(\'' + prefix + '-cb-' + tIdx + '-' + sIdx + '-' + qIdx + '\')" placeholder="✏ Add a note..." class="w-full bg-gray-50 border-2 border-gray-300 rounded-lg p-2 text-[11px] font-mono text-gray-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder-gray-400"></div>' +
        '</div>';
    });
    qHtml += '</div>';
    container.innerHTML = qHtml;
}

function formatQText(s) {
    if (!s) return '';
    return s.split('<br>').map(p => escH(p)).join('<br>');
}

function checkAnswer(qId, selected, correct) {
    const fb = document.getElementById(qId + '-feedback');
    if (!fb) return;
    fb.classList.remove('hidden');

    if (correct === 'X') {
        fb.className = 'mt-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold bg-orange-50 border border-orange-200 text-orange-700';
        fb.textContent = '⚠ This question was dropped by UPSC - no valid answer';
        return;
    }

    if (selected === correct) {
        fb.className = 'mt-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700';
        fb.textContent = '✓ Correct!';
        document.getElementById(qId + '-card').classList.add('border-emerald-200');
        document.getElementById(qId + '-card').classList.remove('border-red-200');
    } else {
        fb.className = 'mt-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold bg-red-50 border border-red-200 text-red-700';
        fb.textContent = '✗ Wrong! Correct answer is (' + correct.toUpperCase() + ')';
        document.getElementById(qId + '-card').classList.add('border-red-200');
        document.getElementById(qId + '-card').classList.remove('border-emerald-200');
    }
}

function clearAnswer(qId) {
    document.querySelectorAll('input[name="' + qId + '"]').forEach(r => r.checked = false);
    const fb = document.getElementById(qId + '-feedback');
    if (fb) { fb.classList.add('hidden'); fb.textContent = ''; }
    const card = document.getElementById(qId + '-card');
    if (card) { card.classList.remove('border-emerald-200', 'border-red-200'); }
}

function filterPYQ() {
    const search = (document.getElementById('pyq-search').value || '').toLowerCase();
    const year = document.getElementById('pyq-year-filter').value;

    if (!search && !year) { renderPYQTopics(); return; }

    const container = document.getElementById('pyq-topics-container');
    if (!container) return;
    let totalFiltered = 0;
    let topicHtml = '';

    pyqGS1Data.forEach((topic, tIdx) => {
        let topicMatch = 0;
        let subtopicsHtml = '';

        topic.subtopics.forEach((st, sIdx) => {
            const matchingQs = st.questions.filter(q => {
                const matchSearch = !search || (q.question || '').toLowerCase().includes(search);
                const matchYear = !year || q.year === year;
                return matchSearch && matchYear;
            });

            if (matchingQs.length > 0) {
                topicMatch += matchingQs.length;
                subtopicsHtml += '<div class="pyq-subtopic border-b border-slate-700/30 last:border-b-0">' +
                    '<button onclick="togglePYQSubtopic(' + tIdx + ',' + sIdx + ')" class="w-full flex items-center justify-between px-6 py-3 hover:bg-white/5 transition-all cursor-pointer">' +
                        '<div class="flex items-center gap-2"><span class="text-indigo-400 text-xs transition-transform duration-200" id="arrow-st-' + tIdx + '-' + sIdx + '">&#9654;</span>' +
                        '<span class="font-semibold text-sm text-slate-100">' + st.name + '</span></div>' +
                        '<span class="text-[10px] font-mono text-amber-300 font-bold">' + matchingQs.length + '/' + st.questions.length + ' Q</span>' +
                    '</button>' +
                    '<div id="pyq-st-body-' + tIdx + '-' + sIdx + '" class="hidden px-4 pb-3"></div></div>';
            }
        });

        if (topicMatch > 0) {
            totalFiltered += topicMatch;
            topicHtml += '<div class="pyq-topic border border-indigo-500/30 rounded-2xl overflow-hidden shadow-lg">' +
                '<button onclick="togglePYQTopic(' + tIdx + ')" class="w-full flex items-center justify-between p-4 bg-gradient-to-r from-indigo-900/60 to-slate-800/60 hover:from-indigo-800/70 hover:to-slate-700/60 transition-all cursor-pointer">' +
                    '<div class="flex items-center gap-3"><span class="text-indigo-400 transition-transform duration-200" id="arrow-topic-' + tIdx + '">&#9654;</span>' +
                    '<span class="font-bold text-sm text-white">' + topic.name + '</span></div>' +
                    '<span class="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-md border border-amber-500/30">' + topicMatch + ' Q</span>' +
                '</button>' +
                '<div id="pyq-topic-body-' + tIdx + '" class="hidden border-t border-indigo-500/20 bg-slate-900/30">' + subtopicsHtml + '</div></div>';
        }
    });

    container.innerHTML = topicHtml;
    const countEl = document.getElementById('pyq-total-count');
    if (countEl) countEl.textContent = totalFiltered + (year || search ? ' (filtered)' : '');
}

// ===== CSAT Paper II =====
function renderCSATTopics() {
    if (typeof pyqCSATData === 'undefined') return;
    const container = document.getElementById('csat-topics-container');
    if (!container) return;

    let totalQ = 0;
    let topicHtml = '';

    pyqCSATData.forEach((topic, tIdx) => {
        let topicQCount = 0;
        topic.subtopics.forEach(st => { topicQCount += st.questions.length; });
        totalQ += topicQCount;

        let subtopicsHtml = '';
        topic.subtopics.forEach((st, sIdx) => {
            subtopicsHtml += '<div class="pyq-subtopic border-b border-slate-700/30 last:border-b-0">' +
                '<button onclick="toggleCSATSubtopic(' + tIdx + ',' + sIdx + ')" class="w-full flex items-center justify-between px-6 py-3 hover:bg-white/5 transition-all cursor-pointer">' +
                    '<div class="flex items-center gap-2"><span class="text-teal-400 text-xs transition-transform duration-200" id="arrow-st-csat-' + tIdx + '-' + sIdx + '">&#9654;</span>' +
                    '<span class="font-semibold text-sm text-slate-100">' + st.name + '</span></div>' +
                    '<span class="text-[10px] font-mono font-bold text-teal-300">' + st.questions.length + ' Q</span>' +
                '</button>' +
                '<div id="csat-st-body-' + tIdx + '-' + sIdx + '" class="hidden px-4 pb-3"></div></div>';
        });

        topicHtml += '<div class="pyq-topic border border-teal-500/30 rounded-2xl overflow-hidden shadow-lg">' +
            '<button onclick="toggleCSATTopic(' + tIdx + ')" class="w-full flex items-center justify-between p-4 bg-gradient-to-r from-teal-900/60 to-slate-800/60 hover:from-teal-800/70 hover:to-slate-700/60 transition-all cursor-pointer">' +
                '<div class="flex items-center gap-3"><span class="text-teal-400 transition-transform duration-200" id="arrow-topic-csat-' + tIdx + '">&#9654;</span>' +
                '<span class="font-bold text-sm text-white">' + topic.name + '</span></div>' +
                '<span class="text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 px-2.5 py-1 rounded-md border border-teal-500/30">' + topicQCount + ' Q</span>' +
            '</button>' +
            '<div id="csat-topic-body-' + tIdx + '" class="hidden border-t border-teal-500/20 bg-slate-900/30">' + subtopicsHtml + '</div></div>';
    });

    container.innerHTML = topicHtml;
    const countEl = document.getElementById('csat-total-count');
    if (countEl) countEl.textContent = totalQ;
}

function toggleCSATTopic(tIdx) {
    const body = document.getElementById('csat-topic-body-' + tIdx);
    const arrow = document.getElementById('arrow-topic-csat-' + tIdx);
    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        arrow.style.transform = 'rotate(90deg)';
    } else {
        body.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
    }
}

function toggleCSATSubtopic(tIdx, sIdx) {
    const body = document.getElementById('csat-st-body-' + tIdx + '-' + sIdx);
    const arrow = document.getElementById('arrow-st-csat-' + tIdx + '-' + sIdx);
    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        arrow.style.transform = 'rotate(90deg)';
        renderCSATSubtopicQuestions(tIdx, sIdx);
    } else {
        body.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
    }
}

function filterCSAT() {
    const search = (document.getElementById('csat-search').value || '').toLowerCase();
    const year = document.getElementById('csat-year-filter').value;

    if (!search && !year) { renderCSATTopics(); return; }

    const container = document.getElementById('csat-topics-container');
    if (!container) return;
    let totalFiltered = 0;
    let topicHtml = '';

    pyqCSATData.forEach((topic, tIdx) => {
        let topicMatch = 0;
        let subtopicsHtml = '';

        topic.subtopics.forEach((st, sIdx) => {
            const matchingQs = st.questions.filter(q => {
                const matchSearch = !search || (q.question || '').toLowerCase().includes(search);
                const matchYear = !year || q.year === year;
                return matchSearch && matchYear;
            });

            if (matchingQs.length > 0) {
                topicMatch += matchingQs.length;
                subtopicsHtml += '<div class="pyq-subtopic border-b border-slate-700/30 last:border-b-0">' +
                    '<button onclick="toggleCSATSubtopic(' + tIdx + ',' + sIdx + ')" class="w-full flex items-center justify-between px-6 py-3 hover:bg-white/5 transition-all cursor-pointer">' +
                        '<div class="flex items-center gap-2"><span class="text-teal-400 text-xs transition-transform duration-200" id="arrow-st-csat-' + tIdx + '-' + sIdx + '">&#9654;</span>' +
                        '<span class="font-semibold text-sm text-slate-100">' + st.name + '</span></div>' +
                        '<span class="text-[10px] font-mono text-amber-300 font-bold">' + matchingQs.length + '/' + st.questions.length + ' Q</span>' +
                    '</button>' +
                    '<div id="csat-st-body-' + tIdx + '-' + sIdx + '" class="hidden px-4 pb-3"></div></div>';
            }
        });

        if (topicMatch > 0) {
            totalFiltered += topicMatch;
            topicHtml += '<div class="pyq-topic border border-teal-500/30 rounded-2xl overflow-hidden shadow-lg">' +
                '<button onclick="toggleCSATTopic(' + tIdx + ')" class="w-full flex items-center justify-between p-4 bg-gradient-to-r from-teal-900/60 to-slate-800/60 hover:from-teal-800/70 hover:to-slate-700/60 transition-all cursor-pointer">' +
                    '<div class="flex items-center gap-3"><span class="text-teal-400 transition-transform duration-200" id="arrow-topic-csat-' + tIdx + '">&#9654;</span>' +
                    '<span class="font-bold text-sm text-white">' + topic.name + '</span></div>' +
                    '<span class="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-md border border-amber-500/30">' + topicMatch + ' Q</span>' +
                '</button>' +
                '<div id="csat-topic-body-' + tIdx + '" class="hidden border-t border-teal-500/20 bg-slate-900/30">' + subtopicsHtml + '</div></div>';
        }
    });

    container.innerHTML = topicHtml;
    const countEl = document.getElementById('csat-total-count');
    if (countEl) countEl.textContent = totalFiltered + (year || search ? ' (filtered)' : '');
}

// ===== Anthropology Optional Mains PYQs =====

function renderAnthroP1PYQ() {
    renderAnthroPYQGeneric(pyqAnthroP1Data, 'anthro-p1', 'anthro-p1-search', 'anthro-p1-year-filter', 'anthro-p1-total-count');
}

function renderAnthroP2PYQ() {
    renderAnthroPYQGeneric(pyqAnthroP2Data, 'anthro-p2', 'anthro-p2-search', 'anthro-p2-year-filter', 'anthro-p2-total-count');
}

function renderAnthroPYQGeneric(dataSource, prefix, searchId, yearId, countId) {
    if (typeof dataSource === 'undefined') return;
    const container = document.getElementById(prefix + '-topics-container');
    if (!container) return;

    const search = (document.getElementById(searchId)?.value || '').toLowerCase();
    const year = document.getElementById(yearId)?.value || '';

    let totalQ = 0;
    let topicHtml = '';

    dataSource.forEach((topic, tIdx) => {
        const filtered = topic.questions.filter(q => {
            const matchSearch = !search || q.question.toLowerCase().includes(search);
            const matchYear = !year || q.year === year;
            return matchSearch && matchYear;
        });

        if (filtered.length === 0) return;
        totalQ += filtered.length;

        let qHtml = '<div class="space-y-2">';
        filtered.forEach((q, qIdx) => {
            const qId = prefix + '-q-' + tIdx + '-' + qIdx;
            const marksBadge = q.marks ? '<span class="text-[10px] font-mono font-bold bg-violet-100 text-violet-800 px-2 py-0.5 rounded border border-violet-300">' + q.marks + 'M</span>' : '';
            const yearBadge = q.year ? '<span class="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300">' + q.year + '</span>' : '';

            qHtml += '<div class="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-violet-400 hover:shadow-md transition-all" id="' + qId + '-card">' +
                '<div class="flex items-start gap-3">' +
                    '<input type="checkbox" id="' + prefix + '-cb-' + tIdx + '-' + qIdx + '" onchange="handleSyncAction(this.id)" class="mt-1 h-5 w-5 rounded border-gray-400 text-violet-600 focus:ring-violet-500/30 cursor-pointer shrink-0">' +
                    '<div class="flex-1 min-w-0">' +
                        '<div class="flex items-center gap-2 mb-1.5"><span class="text-[11px] font-mono font-bold text-gray-500">Q' + q.number + '</span>' + yearBadge + marksBadge + '</div>' +
                        '<p class="text-[13px] text-gray-900 font-semibold leading-relaxed">' + escH(q.question) + '</p>' +
                    '</div>' +
                '</div>' +
                '<div class="mt-3 ml-8"><input type="text" id="note-' + prefix + '-cb-' + tIdx + '-' + qIdx + '" oninput="debouncedSync(\'' + prefix + '-cb-' + tIdx + '-' + qIdx + '\')" placeholder="✏ Add answer notes..." class="w-full bg-gray-50 border-2 border-gray-300 rounded-lg p-2 text-[11px] font-mono text-gray-800 focus:outline-none focus:border-violet-500 focus:bg-white transition-all placeholder-gray-400"></div>' +
            '</div>';
        });
        qHtml += '</div>';

        topicHtml += '<div class="pyq-topic border border-violet-500/30 rounded-2xl overflow-hidden shadow-lg">' +
            '<button onclick="toggleAnthroPYQTopic(\'' + prefix + '\',' + tIdx + ')" class="w-full flex items-center justify-between p-4 bg-gradient-to-r from-violet-900/60 to-slate-800/60 hover:from-violet-800/70 hover:to-slate-700/60 transition-all cursor-pointer">' +
                '<div class="flex items-center gap-3"><span class="text-violet-400 transition-transform duration-200" id="arrow-' + prefix + '-' + tIdx + '">&#9654;</span>' +
                '<span class="font-bold text-sm text-white">' + topic.name + '</span></div>' +
                '<span class="text-[10px] font-mono font-bold bg-violet-500/20 text-violet-300 px-2.5 py-1 rounded-md border border-violet-500/30">' + filtered.length + (search || year ? '/' + topic.questions.length : '') + ' Q</span>' +
            '</button>' +
            '<div id="' + prefix + '-topic-body-' + tIdx + '" class="hidden border-t border-violet-500/20 bg-slate-900/30 px-4 pb-3">' + qHtml + '</div></div>';
    });

    container.innerHTML = topicHtml || '<p class="text-xs text-slate-400 text-center py-4">No questions match your filters.</p>';
    const countEl = document.getElementById(countId);
    if (countEl) countEl.textContent = totalQ + (search || year ? ' (filtered)' : '');
}

function toggleAnthroPYQTopic(prefix, tIdx) {
    const body = document.getElementById(prefix + '-topic-body-' + tIdx);
    const arrow = document.getElementById('arrow-' + prefix + '-' + tIdx);
    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        arrow.style.transform = 'rotate(90deg)';
    } else {
        body.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
    }
}

// ===== GS Mains PYQs =====

function renderMainsGS1PYQ() {
    renderAnthroPYQGeneric(pyqMainsGS1Data, 'mains-gs1', 'mains-gs1-search', 'mains-gs1-year-filter', 'mains-gs1-total-count');
}

function renderMainsGS2PYQ() {
    renderAnthroPYQGeneric(pyqMainsGS2Data, 'mains-gs2', 'mains-gs2-search', 'mains-gs2-year-filter', 'mains-gs2-total-count');
}

function renderMainsGS3PYQ() {
    renderAnthroPYQGeneric(pyqMainsGS3Data, 'mains-gs3', 'mains-gs3-search', 'mains-gs3-year-filter', 'mains-gs3-total-count');
}

function renderMainsGS4PYQ() {
    renderAnthroPYQGeneric(pyqMainsGS4Data, 'mains-gs4', 'mains-gs4-search', 'mains-gs4-year-filter', 'mains-gs4-total-count');
}
