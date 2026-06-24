// =========================================================================
// MetricsService — Singleton Observer pattern
// Batches events and flushes every 10s or on page unload
// =========================================================================
var MetricsService = (function() {
    'use strict';

    var _queue      = [];
    var _sessionId  = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2,6);
    var _flushTimer = null;
    var _pageStart  = Date.now();
    var FLUSH_INTERVAL = 10000; // 10s

    function _userId() {
        return typeof currentUserId !== 'undefined' ? currentUserId : null;
    }

    function track(eventType, data) {
        if (!_userId()) return;
        _queue.push({
            user_id:    _userId(),
            event_type: eventType,
            event_data: data || {},
            session_id: _sessionId
        });
        if (!_flushTimer) {
            _flushTimer = setTimeout(flush, FLUSH_INTERVAL);
        }
    }

    async function flush() {
        clearTimeout(_flushTimer);
        _flushTimer = null;
        if (!_queue.length || !_userId() || typeof dbClient === 'undefined') return;
        var batch = _queue.splice(0, 50); // max 50 per flush
        try {
            var res = await dbClient.from('upsc_app_metrics').insert(batch);
            if (res.error) {
                // Put back on error (idempotency via retry)
                _queue.unshift.apply(_queue, batch);
                console.warn('[Metrics] flush err:', res.error.message);
            }
        } catch(e) {
            _queue.unshift.apply(_queue, batch);
        }
        // Schedule next flush if queue still has items
        if (_queue.length) {
            _flushTimer = setTimeout(flush, FLUSH_INTERVAL);
        }
    }

    // Track page unload (session duration)
    window.addEventListener('beforeunload', function() {
        var dur = Math.round((Date.now() - _pageStart) / 1000);
        if (dur > 3) {
            track('session_end', { duration_seconds: dur });
        }
        flush();
    });

    // Auto-track page load
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() {
            if (_userId()) {
                track('page_load', {
                    url: window.location.pathname,
                    ua: navigator.userAgent.substr(0, 80)
                });
            }
        }, 2000); // after auth
    });

    return {
        track: track,
        flush: flush,
        sessionId: function() { return _sessionId; }
    };
})();

// ── Convenience tracking wrappers ─────────────────────────────────────────
function trackTabSwitch(tab)     { MetricsService.track('tab_switch',     { tab: tab });     }
function trackTopicCheck(id, v)  { MetricsService.track('topic_check',    { id: id, checked: v }); }
function trackPlanCreate(cat)    { MetricsService.track('plan_create',     { category: cat }); }
function trackPlanEdit()         { MetricsService.track('plan_edit',       {}); }
function trackFocusStart()       { MetricsService.track('focus_start',     {}); }
function trackFocusEnd(secs)     { MetricsService.track('focus_end',       { duration_seconds: secs }); }
function trackTableEdit(planId)  { MetricsService.track('table_edit',      { plan_id: planId }); }
function trackPYQView(topic)     { MetricsService.track('pyq_view',        { topic: topic }); }
function trackCAView(month)      { MetricsService.track('ca_view',         { month: month }); }
function trackSearch(query)      { MetricsService.track('search',          { query: query }); }
function trackMsgSent()          { MetricsService.track('message_sent',    {}); }
function trackFeedbackSent()     { MetricsService.track('feedback_sent',   {}); }
