/*
Copyright (C) 2025-2026  Frederyk Abryan Palinoan

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, visit https://www.gnu.org/licenses/.
*/

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Settings keys
export const SHOW_ACTIVITIES_ID = 'show-activities';
export const SHOW_APP_MENU_ID = 'show-app-menu';
export const SHOW_DATE_TIME_ID = 'show-date-time';
export const AVAILABLE_INDICATORS_ID = 'available-indicators';
export const TRANSFER_INDICATORS_ID = 'transfer-indicators';
export const EXCLUDE_INDICATORS_ID = 'exclude-indicators';

// Store reference to mmPanel array set by extension.js
let _mmPanelArrayRef = null;

// Helper function to set the mmPanel reference
export function setMMPanelArrayRef(mmPanelArray) {
	_mmPanelArrayRef = mmPanelArray;
}

// Panels that registered themselves at construction. _pushPanel() adds panels
// to whichever array the reference happens to point at, which has proven
// unreliable at session start: the panels exist and render while the shared
// array stays empty, so StatusIndicatorsController._findPanel() finds nothing
// and every indicator transfer silently no-ops. Self-registration does not
// depend on the reference being set first.
const _registeredPanels = [];

export function registerMMPanel(panel) {
	if (!_registeredPanels.includes(panel))
		_registeredPanels.push(panel);

	// Keep the shared array in step when it is available, so callers reading it
	// directly see the panel too.
	if (_mmPanelArrayRef && !_mmPanelArrayRef.includes(panel))
		_mmPanelArrayRef.push(panel);
}

export function unregisterMMPanel(panel) {
	const localIndex = _registeredPanels.indexOf(panel);
	if (localIndex >= 0)
		_registeredPanels.splice(localIndex, 1);

	if (_mmPanelArrayRef) {
		const sharedIndex = _mmPanelArrayRef.indexOf(panel);
		if (sharedIndex >= 0)
			_mmPanelArrayRef.splice(sharedIndex, 1);
	}
}

// Helper function to safely access mmPanel array
export function getMMPanelArray() {
	// First try Main.mmPanel if it exists
	if ('mmPanel' in Main && Main.mmPanel) {
		return Main.mmPanel;
	}
	// Then the reference set by extension.js, but only when it actually holds
	// panels - an empty one means registration went astray.
	if (_mmPanelArrayRef && _mmPanelArrayRef.length > 0) {
		return _mmPanelArrayRef;
	}
	// Fall back to panels that registered themselves.
	return _registeredPanels;
}
