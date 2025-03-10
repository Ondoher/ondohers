function checkBoolean(val) {
	var boolValues = {
		'true' : true,
		'false': false,
		'on': true,
		'off': false,
		'set': true,
		'clear': false,
	}

    if (val === true) return true;
    if (val === false) return false;

	return boolValues[val] !== undefined ? boolValues[val] : val;
}

/**
 * Call this method to get the value of an option from the cli. It will convert
 * this value to a boolean if it can.
 *
 * @param {String} name the full name of the options
 * @param {String} short the short name of the option
 * @returns {*} the value of the option
 */
function getOption(argv, name, short) {
	if (argv[name] !== undefined) return checkBoolean(argv[name]);
	if (argv[short] != undefined) return checkBoolean(argv[short]);
}

export function getOptions(defaults, argv, definition) {
    var longNames = Object.keys(definition);
    var options = longNames.reduce(function(options, long) {
        var short = definition[long];
        var option = getOption(argv, long, short);
        options[long] = option;

        return options;
    }, {});

    var keys = Object.keys(defaults);
    keys.forEach(function(key) {
        options[key] = (options[key] !== undefined) ? options[key] : defaults[key];
    })

    return options;
}