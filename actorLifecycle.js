// A source actor may already have been disposed by Clutter. Keep independent
// teardown operations running so one stale object cannot leave timers/signals alive.
export function cleanupSafely(callback) {
    try {
        callback();
    } catch (_error) {
        // Destruction can originate in C and bypass JavaScript destroy overrides.
    }
}
