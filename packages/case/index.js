/**
 * Call this function to convert the string so that the first letter is
 * uppercase.
 *
 * @param {String} name the name
 * @returns {String} the given name with the first letter uppercased.
 */
function upperCase(name) {
	var letters = [...name];
	var first = letters.shift().toUpperCase();
	letters.unshift(first)
	return letters.join('');
}

/**
 * Call this method to convert the string to title case. This will separate the
 * individual parts of the normalized name with a space and upper case the first
 * letter of each segment
 *
 * @param {String} name the name in normalized case
 * @returns {String} the title cased name
 */
export function titleCase(name) {
	name = normalizeCase(name);
	var parts = name.split('_');
	return parts.map(function(part) {
		return upperCase(part);
	}).join(' ');
}

/**
 * Call this function to convert the string to pascal case. Pascal case
 * separates each part of the name so the first letter is upper case. It will
 * normalize the string first
 *
 * @param {String} name the name to be converted.
 * @returns {String} the name in Pascal case
 */
export function pascalCase(name) {
	name = normalizeCase(name);
	name = name.replace(/_/g, ' ');

	return name.split(' ').map(function(part, idx) {
		return upperCase(part);
	}).join('');
}

/**
 * Call this function to convert the string to camel case. Camel case separates
 * each part of the name with an uppercase letter except the first which has the
 * first letter lowercase.  It will normalize the string first
 *
 * @param {String} name the name to convert
 * @returns {String} the camel case name
 */
export function camelCase(name) {
	name = normalizeCase(name);
	name = name.replace(/_/g, ' ');

	return name.split(' ').map(function(part, idx) {
		return idx === 0 ? part.toLowerCase() : upperCase(part);
	}).join('');
}

/**
 * Call this function to convert the string to kabob case. Kabob case separates
 * each part of the name with '-'. It will normalize the string first
 *
 * @param {String} name the name to convert
 * @returns {String} the camel case name
 */
export function kabobCase(name) {
	name = normalizeCase(name);
	return name.replace(/_/g, '-');
}

/**
 * Call this method to convert the string to snake case: each individual part is
 * lower case and separated by '_'. The string is normalized first
 *
 * @param {String} name the name to normalize
 *
 * @returns {String} the normalized string which will be in snake case;
 */
export function snakeCase(name) {
	return normalizeCase(name)
}

/**
 * Call this method to normalize the name. This normalization will assure that
 * all casing functions start in a known state. The inputs can be passed with
 * individual words separated by ' ', '-',  or '_'. They can also be separated
 * by capitalization.
 *
 * The current result of this function is a string in snake case, but that
 * should not be assumed to remain the same in the future.
 *
 * @param {String} name the name to normalize
 *
 * @returns {String} the normalized value;
 */
function normalizeCase(name = '') {
	// start with pascal case, because we will break it into pieces based on
	// each part starting with an uppercase letter.
	name = name.replace(/-/g, ' ');
	name = name.replace(/_/g, ' ');

	name = name.split(' ').map(function(part, idx) {
		return upperCase(part);
	}).join('');

	// separate the string by assuming each part starts with an uppercase letter
	var parts = [...name.matchAll(/([A-Z][a-z]*)/g)];

	parts = parts.map(function (part) {
		return part[1].toLowerCase();
	})

	return parts.join('_');
}
