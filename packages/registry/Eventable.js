import { EventBus } from "./EventBus";

/**
 * Call this method to add fire, listen and unlisten methods to the passed
 * object. This will create an EventBus object and attach it to the passed
 * object with the member name eventBus.
 *
 * @param {Object} obj the object being extended
 */
export function makeEventable(obj) {
	obj.eventBus = new EventBus('eventable:');

	obj.eventBus.implementOn(obj, 'fire');
	obj.eventBus.implementOn(obj, 'listen');
	obj.eventBus.implementOn(obj, 'unlisten');
}
