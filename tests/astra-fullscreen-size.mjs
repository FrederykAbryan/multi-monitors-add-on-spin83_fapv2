import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const code = readFileSync(new URL('../astraSourceGeometry.js', import.meta.url), 'utf8');
const {retainAstraSourceHeight} = await import(`data:text/javascript,${encodeURIComponent(code)}`);

class Actor {
    constructor(properties = {}) {
        Object.assign(this, {mapped: true, min_height: 0, natural_height: 0,
            min_height_set: false, natural_height_set: false, allocatedHeight: 26}, properties);
        this.signals = new Map();
        this.nextId = 1;
    }
    has_allocation() { return this.allocatedHeight > 0; }
    get_allocation_box() { return {get_height: () => this.allocatedHeight}; }
    set_height(height) {
        this.min_height = this.natural_height = height;
        this.min_height_set = this.natural_height_set = true;
    }
    queue_relayout() {}
    allocatePreferred() {
        // Clutter gives the hidden Astra box 32px of preferred height,
        // then compresses it into a 26px clone unless the source is pinned.
        this.allocatedHeight = this.natural_height_set ? this.natural_height : 32;
        this.emit('notify::allocation');
    }
    connect(signal, callback) {
        const id = this.nextId++;
        this.signals.set(id, {signal, callback});
        return id;
    }
    disconnect(id) { assert.ok(this.signals.delete(id)); }
    emit(signal) {
        for (const handler of [...this.signals.values()]) {
            if (handler.signal === signal)
                handler.callback();
        }
    }
    setMapped(mapped) { this.mapped = mapped; this.emit('notify::mapped'); }
}

test('hidden source keeps its visible allocation and 1:1 clone scale', () => {
    const source = new Actor();
    const panel = new Actor();
    const release = retainAstraSourceHeight(source, panel, () => 24);
    panel.setMapped(false);
    for (let i = 0; i < 10; i++) {
        source.allocatePreferred();
        assert.equal(source.allocatedHeight, 26);
        assert.equal(26 / source.allocatedHeight, 1);
    }
    panel.setMapped(true);
    assert.equal(source.natural_height_set, false);
    source.allocatedHeight = 30;
    source.emit('notify::allocation');
    panel.setMapped(false);
    source.allocatePreferred();
    assert.equal(source.allocatedHeight, 30);
    release();
    assert.equal(source.min_height_set, false);
    assert.equal(source.signals.size, 0);
    assert.equal(panel.signals.size, 0);
});

test('enabling while fullscreen uses the panel content height', () => {
    const source = new Actor({allocatedHeight: 32});
    const panel = new Actor({mapped: false});
    const release = retainAstraSourceHeight(source, panel, () => 26);
    source.allocatePreferred();
    assert.equal(source.allocatedHeight, 26);
    release();
});

test('multiple mirrors share the pin and restore original requests on last release', () => {
    const original = {min_height: 10, natural_height: 40,
        min_height_set: true, natural_height_set: false};
    const source = new Actor(original);
    const panel = new Actor();
    const first = retainAstraSourceHeight(source, panel, () => 26);
    const second = retainAstraSourceHeight(source, panel, () => 26);
    panel.setMapped(false);
    first();
    first();
    source.allocatePreferred();
    assert.equal(source.allocatedHeight, 26);
    second();
    for (const [key, value] of Object.entries(original))
        assert.equal(source[key], value);
    assert.equal(panel.signals.size, 0);
    assert.equal(source.signals.size, 0);
});

test('destroying the source removes external handlers before mirror cleanup', () => {
    const source = new Actor();
    const panel = new Actor();
    const release = retainAstraSourceHeight(source, panel, () => 26);
    source.emit('destroy');
    assert.equal(panel.signals.size, 0);
    release();
    release();
});
