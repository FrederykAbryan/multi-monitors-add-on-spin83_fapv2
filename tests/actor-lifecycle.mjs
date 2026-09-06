import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const removed = [];
const context = vm.createContext({
    GLib: { source_remove: id => removed.push(id) },
    Main: { ctrlAltTabManager: { removeGroup() {} } },
});
vm.runInContext(readFileSync(new URL('../actorLifecycle.js', import.meta.url), 'utf8')
    .replace('export function', 'function'), context);
function methods(file, className, names) {
    const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    const body = source.slice(source.indexOf('class ' + className));
    return vm.runInContext('({' + names.map(name => {
        const start = body.indexOf('        ' + name + '(');
        assert.ok(start >= 0, name);
        const end = body.indexOf('\n        }', start) + 10;
        return body.slice(start, end);
    }).join(',') + '})', context);
}
const disposed = {
    disconnect() { throw Error('already disposed'); },
    disconnectObject() { throw Error('already disposed'); },
    unbind() { throw Error('already disposed'); },
    get_first_child() { assert.fail('cleanup must not traverse source children'); },
};
const mirror = methods('mirroredIndicatorButton.js', 'MirroredIndicatorButton', [
    '_cleanup', '_disconnectMirroredClockDisplay', '_disconnectLabelCopyBindings',
    '_disconnectIconSyncSource', '_disconnectWorkspaceWindowSignals',
]);
Object.assign(mirror, {
    _sourceIndicator: disposed, _sourcePresenceChild: disposed,
    _sourceDestroyId: 10, _clockBinding: disposed, _labelCopyBindings: [disposed],
    _quickSettingsSource: disposed, _sourceSizeChangedId: 11,
    _allocationCloneSignals: [{ source: disposed, id: 12 }],
    _workspacePreviewWindowSignalIds: [{ object: disposed, id: 13 }],
    _forwardClickTimeoutId: 14, _allocationCloneTimeouts: [15],
    _genericMenuPendingRestore() { throw Error('menu disposed'); },
});
mirror._cleanup();
assert.equal(mirror._sourceIndicator, null);
assert.equal(mirror._sourcePresenceChild, null);
assert.equal(mirror._quickSettingsSource, null);
assert.equal(mirror._genericMenuPendingRestore, null);
assert.deepEqual(removed, [14, 15]);
mirror._cleanup();
assert.deepEqual(removed, [14, 15], 'cleanup must be idempotent');

const panel = methods('mmpanel.js', 'MultiMonitorsPanel', [
    '_cleanup', '_schedulePanelRefresh', '_disconnectIndicatorSignals', '_destroyIndicator',
]);
Object.assign(panel, {
    _primaryPanelBoxes: [disposed], _initialCheckTimeouts: [16],
    _panelRefreshTimeouts: [17], statusArea: {
        tray: { ...disposed, _mmDestroyId: 18, _mmMenuSetId: 19 },
    },
});
panel._cleanup();
assert.equal(panel._leftBox, null);
assert.equal(Object.keys(panel.statusArea).length, 0);
assert.deepEqual(removed, [14, 15, 16, 17]);
panel._schedulePanelRefresh([50]); // Must not call timeout_add after destruction.
panel._cleanup();
assert.deepEqual(removed, [14, 15, 16, 17]);
panel.statusArea.tray = { ...disposed, destroy() { throw Error('disposed'); } };
panel._destroyIndicator('tray');
assert.equal(panel.statusArea.tray, undefined);
// Issue #40: repeated refreshes must destroy every retired copy while JS can
// still run its destroy handlers, and release bindings before destruction.
class Label {
    constructor() { this.text = ''; this.destroyed = false; }
    get_style_class_name() { return ''; }
    bind_property(_source, target) {
        target.text = this.text;
        target.bound = true;
        return { unbind() { target.bound = false; } };
    }
    destroy() {
        assert.equal(this.bound, false, 'unbind before destroying the label');
        this.destroyed = true;
    }
}
class Container {
    children = [];
    add_child(child) { this.children.push(child); }
    destroy_all_children() {
        this.children.forEach(child => child.destroy());
        this.children = [];
    }
    remove_all_children() { this.children = []; }
}
context.St = { Label, Icon: class {}, BoxLayout: class {} };
context.Clutter = { ActorAlign: { CENTER: 0 } };
context.GObject = { BindingFlags: { SYNC_CREATE: 1 } };
const refresh = methods('mirroredIndicatorButton.js', 'MirroredIndicatorButton', [
    '_copyIconsFromSource', '_createLabelCopy', '_disconnectLabelCopyBindings',
]);
const sourceLabel = new Label();
refresh._isClipboardIndicator = () => false;
refresh._findAllDisplayWidgets = () => [sourceLabel];
const container = new Container();
for (let i = 0; i < 20; i++) {
    const previous = [...container.children];
    sourceLabel.text = String(i);
    refresh._copyIconsFromSource(container, sourceLabel);
    assert.ok(previous.every(child => child.destroyed), 'retired labels must be destroyed');
    assert.equal(container.children.length, 1);
    assert.equal(container.children[0].text, String(i));
    assert.equal(refresh._labelCopyBindings.length, 1);
    assert.equal(sourceLabel.destroyed, false, 'the primary panel label is borrowed');
}
refresh._disconnectLabelCopyBindings();
container.destroy_all_children();
console.log('Actor lifecycle regression checks passed (including 20 label refreshes)');
