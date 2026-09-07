import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../mmoverview.js', import.meta.url), 'utf8');
const controlsBody = source.slice(source.indexOf('class MultiMonitorsControlsManager'));
const showStart = controlsBody.indexOf('        show()');
const showSource = controlsBody.slice(showStart, controlsBody.indexOf('\n        }', showStart) + 10);
const listeners = new Map();
const overview = {
    visible: false,
    visibleTarget: false,
    connectObject(...args) {
        const owner = args.pop();
        const signals = new Map();
        for (let i = 0; i < args.length; i += 2)
            signals.set(args[i], args[i + 1]);
        listeners.set(owner, signals);
    },
    disconnectObject(owner) { listeners.delete(owner); },
};
const group = {
    actors: new Set(),
    add_child(actor) { this.actors.add(actor); },
    remove_child(actor) { assert.ok(this.actors.delete(actor)); },
};
const context = vm.createContext({
    Main: { overview, layoutManager: { overviewGroup: group, monitors: [] } },
    global: { get_pointer: () => [0, 0] },
});
const show = vm.runInContext('({' + showSource + '}).show', context);
context.MultiMonitorsOverviewActor = class {
    constructor() {
        this._controls = {
            _visible: false,
            syncs: 0,
            show,
            hide() { this._visible = false; },
            _connectOverviewStateWatcher() {},
            _syncAppGridState() {
                assert.ok(group.actors.has(this.actor), 'attach the actor before synchronizing');
                assert.equal(this._visible, true, 'search must see an active overview');
                this.syncs++;
            },
            actor: this,
        };
    }
    destroy() { this.destroyed = true; }
};
const Overview = vm.runInContext(source.slice(source.indexOf('export class MultiMonitorsOverview {'))
    .replace('export class', 'class') + '\nMultiMonitorsOverview;', context);

// Creating after the showing signal, including startup and monitor rebuilds,
// must initialize controls immediately, without another overview transition.
for (const [visible, target, expectedSyncs] of [
    [true, true, 1],
    [false, false, 0],
    [true, false, 0], // Closing: still visible, but search must stay inactive.
]) {
    overview.visible = visible;
    overview.visibleTarget = target;
    const instance = new Overview(1, {});
    const controls = instance._overview._controls;
    assert.equal(controls.syncs, expectedSyncs);
    assert.equal(controls._visible, target);

    // Normal subsequent hide/show cycles still update controls.
    listeners.get(instance._overview).get('hiding')();
    assert.equal(controls._visible, false);
    listeners.get(instance._overview).get('showing')();
    assert.equal(controls._visible, true);
    assert.equal(controls.syncs, expectedSyncs + 1);
    instance.destroy();
    assert.equal(listeners.size, 0);
    assert.equal(group.actors.size, 0);
}
console.log('Overview initial-state regression checks passed');
