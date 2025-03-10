import { ServiceOject } from "./ServiceObject";
import { registry } from "./Registry";

/**
 * Use this call as a base for a service implementation. This is not necessary
 * to create a service but provides some basic functionality. The methods fire,
 * listen and unlisten will be added to the class instance.
 */
export class Service {
	/**
	 * Constructor for the class
	 * @param {String} [name] is passed, this service will be registered with
	 * 		this name
	 */
	constructor (name) {
		this.serviceObject = new ServiceOject(name);

		this.serviceObject.implementOn(this, 'fire');
		this.serviceObject.implementOn(this, 'listen');
		this.serviceObject.implementOn(this, 'unlisten');

		if (name) {
			registry.register(name, this.serviceObject);
		}
	}

	/**
	 * Call this method to add a number of methods to the servie object.
	 *
	 * @param {Array.<String>} names each entry in this list is a method to
	 * 		implement. The implementation of these methods will be a method on
	 * 		the service class (this) with the same name as the array item.
	 */
	implement (names) {
		var methods = {};

		names.forEach(function(name) {
			if (this[name]) {
				methods[name] = this[name].bind(this);
			} else {
				console.warn('method', name, 'not implemented on service', this.name ? this.name : '<unnamed service>')
			}
		}, this);

		this.serviceObject.implement(methods);
	}
}
