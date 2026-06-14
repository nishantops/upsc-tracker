// =========================================================================
// UPSC Tracker - Plans Module
// =========================================================================

function openPlannerModal() { document.getElementById('plan-modal').classList.remove('hidden'); }
function closePlannerModal() { document.getElementById('plan-modal').classList.add('hidden'); document.getElementById('modal-plan-title').value = ""; }

async function executeCreatePlan() {
    const title = document.getElementById('modal-plan-title').value.trim();
    const type = document.getElementById('modal-plan-type').value;
    if(!title) return alert("Plan Title required");

    const encodedName = btoa(unescape(encodeURIComponent(title)));
    buildPlanCardDOM(title, encodedName, type);

    if(dbClient) { await dbClient.from('upsc_custom_plans').upsert({ plan_id: encodedName, user_id: currentUserId, plan_title: title, plan_type: type }, { onConflict: 'plan_id,user_id' }); }
    closePlannerModal();
}

function buildPlanCardDOM(title, encodedName, type) {
    if(document.getElementById(`plan_card_wrapper_${encodedName}`)) return;
    const html = `
        <div id="plan_card_wrapper_${encodedName}" class="neo-card rounded-3xl p-6 border-l-4 border-emerald-500 shadow-sm relative group">
            <button onclick="eraseCustomNode('plan_meta_${encodedName}', this)" class="absolute right-4 top-4 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition cursor-pointer" title="Delete Entire Plan"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            <div class="flex justify-between items-center mb-4 pr-6">
                <div>
                    <h3 class="heading-font text-xl font-black text-slate-900">${title}</h3>
                    <span class="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">${type}</span>
                </div>
                <div class="flex items-center gap-3">
                    <div class="text-right"><div class="text-[10px] font-bold text-slate-400 font-mono tracking-wide uppercase">Completion</div><div id="lbl-plan-${encodedName}" class="text-sm font-black text-slate-800">0%</div></div>
                    <div id="pie-plan-${encodedName}" class="pie-chart-frame bg-slate-200 w-10 h-10 border-emerald-500"></div>
                </div>
            </div>
            <div class="mb-4"><textarea id="note-plan_card_${encodedName}" oninput="debouncedSync('plan_card_${encodedName}')" rows="2" placeholder="Master Strategy / Goals for this plan..." class="w-full bg-slate-50/50 border border-slate-200 rounded-xl p-3 text-xs sm:text-sm font-medium text-slate-600 focus:outline-none focus:border-emerald-400 focus:bg-white transition-all custom-scrollbar"></textarea></div>
            <div id="target-list-${encodedName}" class="space-y-3 mb-4"></div>
            <button onclick="addPlanTaskPrompt('${encodedName}')" class="cursor-pointer text-xs font-black uppercase tracking-wider text-emerald-600 hover:text-emerald-500 flex items-center gap-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg> Add Sub-Target</button>
        </div>
    `;
    document.getElementById('planner-container').insertAdjacentHTML('afterbegin', html);
}

function addPlanTaskPrompt(planEncodedName) {
    const taskName = prompt("Enter specific target or task:");
    if(!taskName) return;
    const taskEncoded = btoa(unescape(encodeURIComponent(taskName)));
    const fullId = `plan_task_${planEncodedName}_${taskEncoded}`;
    buildPlanTaskDOM(planEncodedName, taskName, fullId, false, "");
    handleSyncAction(fullId);
}

function buildPlanTaskDOM(planEncodedName, taskText, fullId, isChecked, noteText) {
    const container = document.getElementById(`target-list-${planEncodedName}`);
    if(!container || document.getElementById(fullId)) return;
    const checkAttr = isChecked ? 'checked' : '';
    const htmlNode = `
        <div class="task-row flex flex-col p-3 bg-white border border-slate-200 hover:border-emerald-300 rounded-xl transition group relative shadow-2xs">
            <div class="flex justify-between items-start w-full">
                <label for="${fullId}" class="flex items-start cursor-pointer w-full text-xs sm:text-sm font-bold tracking-tight select-none">
                    <input type="checkbox" id="${fullId}" onchange="handleSyncAction('${fullId}')" class="plan-task-box-${planEncodedName} mt-0.5 mr-3 h-4 w-4 rounded border-slate-300 text-emerald-500 cursor-pointer" ${checkAttr}>
                    <span class="text-slate-700 group-has-[:checked]:text-slate-400 group-has-[:checked]:line-through break-words font-medium transition-all">${taskText}</span>
                </label>
                <button onclick="eraseCustomNode('${fullId}', this)" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition cursor-pointer ml-4"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>
            <div class="mt-2 ml-7 w-[calc(100%-1.75rem)]">
                <input type="text" id="note-${fullId}" oninput="debouncedSync('${fullId}')" value="${noteText || ''}" placeholder="Task note..." class="w-full bg-slate-50 border border-slate-100 rounded-md p-1.5 text-[10px] font-mono text-slate-500 focus:outline-none focus:border-emerald-300 focus:bg-white transition-all placeholder-slate-300 ${isChecked ? 'locked-note' : ''}" ${isChecked ? 'readonly' : ''}>
            </div>
        </div>`;
    container.insertAdjacentHTML('beforeend', htmlNode);
    calculatePlanPies();
}

function calculatePlanPies() {
    document.querySelectorAll('[id^="pie-plan-"]').forEach(pieEl => {
        const encodedName = pieEl.id.replace('pie-plan-', '');
        const taskBoxes = document.querySelectorAll(`.plan-task-box-${encodedName}`);
        const lblEl = document.getElementById(`lbl-plan-${encodedName}`);
        let sTotal = taskBoxes.length, sChecked = 0;
        taskBoxes.forEach(b => { if(b.checked) sChecked++; });
        const sPct = sTotal > 0 ? Math.round((sChecked / sTotal) * 100) : 0;
        if (lblEl) lblEl.innerText = sPct + "%";
        pieEl.style.background = `conic-gradient(#10b981 ${sPct}%, rgba(51,65,85,0.6) 0%)`;
    });
}
