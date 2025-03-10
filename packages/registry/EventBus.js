import * as uuid from 'uuid';

/**
 * Thsi is the implementation for a generic event bus that uses callbacks as
 * event listeners.
 */
export class EventBus {
	/**
	 * This is the constructor the EventBus class
	 * @param {String} prefix this string will be added to the beginning of
	 * 		every event name. This is transparetn to caller, these are only
	 * 		used internally.
	 */
	constructor (prefix = '') {
		this.listeners = {};
		this.prefix = prefix;
	}

	/**
	 * Call this method to listen for a fired event.
	 *
	 * @param {String} eventName the name of the event to listen to
	 * @param {Function} cb the method to call when the event is fired,.
	 * @returns {*} A unique value that can be used later to reference that
	 * 		listener.
	 */
	listen (eventName, cb) {
		var listenerId = uuid.v1();
		var name = this.prefix + eventName;

		this.listeners[name] = this.listeners[name] || [];
		this.listeners[name].push({cb, listenerId});

		return listenerId;
	}

	/**
	 * Call this method to stop listening for an event
	 * @param {string} eventName the name of the event to stop listening to
	 * @param {*} listenerId the unique value returned from listen to reference
	 * 		this specific listener
	 */
	unlisten(eventName, listenerId) {
		var name = this.prefix + eventName;
		var listeners = this.listeners[name] || [];

		var index = listeners.findIndex(function (listener) {
			return listener.listenerId === listenerId;
		}, this);

		// if found, remove it from the array
		if (index !== -1) {
			listeners.splice(index, 1);
		}
	}

	/**
	 * Call this method to fire all of the listeners for an event.
	 *
	 * @param {String} eventName the name of the event to fire
	 * @param  {...any} args the parameters to pass to the listeners
	 * @returns {any|Promise.<any>} The first listener to return a value is the
	 * 		result of this method. If one or more listeners returns a promise,
	 * 		this method will return a promise that will resolve to the return
	 * 		result once all promises have settled.
	 */
	fire(eventName, ...args) {
		var name = this.prefix + eventName;
		var listeners = this.listeners[name];
		var promises = [];
		var firstResult;

		if (!listeners) return;

		listeners.forEach(function(listener) {
			var result = listener.cb.apply(this, args);
			var isPromise = result && result.then;

			firstResult = firstResult !== undefined ? firstResult : (result !== undefined && !isPromise) ? result : undefined;
			if (isPromise) promises.push(result);
		}, this)

		// if there are no promises, just return the firstResult
		if (promises.length === 0) {
			return firstResult;
		}

		// if there are promises, wait until they have all completed, then return the first result, or the value of the first fulfilled promise
		return Promise.allSettled(promises)
			.then(function(results) {
				var promisesResult

				//report on errors
				results.forEach(function(callResult) {
					if (callResult.status !== 'fulfilled') {
						console.warn(callResult.reason);
					}
				}, this);

				var found = results.find(function(callResult) {
					return callResult.status === 'fulfilled' && callResult.value !== undefined;
				}, this);

				promisesResult = found ? found.value : undefined;

				return firstResult !== undefined ? firstResult : promisesResult;
			}.bind(this));
	}

	/**
	 * Call this method to asycnronously fire an event.
	 *
	 * @param {String} eventName the name of the event to fire
	 * @param  {...any} args the paranmeters to pass to the listeners
	 * @returns {Promise.<*>} the result of the fire
	 */
	async asyncFire(eventName, ...args) {
		return await this.fire(eventName, ...args);
	}

	/**
	 * Call this method to imlement a method listener on the given object.
	 *
	 * @param {Object} obj the object the method is bound to
	 * @param {String} name the name of the event. This is also the name of the
	 * 		method being created on the implementation object.
	 */
	implementOn(obj, name) {
		obj[name] = this[name].bind(this);
	}
}
