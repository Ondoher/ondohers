const SECOND = 1000;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const YEAR = DAY * 365;

export class Logger {
	constructor() {
		this.numbers = [1];
		this.groups = ['Logger'];
		this.first = true;
		this.timers = {};
	}

	wrapMethod(object, name, prefix = '') {
		var method = object[name];

		if (typeof method !== 'function' || name === 'constructor') return;

		object[name] = (...args) => {
			var result;
			try {
				this.push(prefix + name);
				var result = method.call(object, ...args);
				return result;
			} finally {
				if (result?.then) result.then(() => {this.pop(name)});
				else this.pop(name);
			}
		};
	}

	collectNames(object, names) {
		names = [...names, ...Object.getOwnPropertyNames(object)];
		var prototype = Object.getPrototypeOf(object);
		var done = !prototype || prototype === Object.getPrototypeOf({})

		if (!done) names = this.collectNames(prototype, names);

		return names;
	}

	wrapObject(object, objectName = '') {
		var names = this.collectNames(object, []);
		var prefix = objectName ? `${objectName}::` : '';

		names.forEach((name) => this.wrapMethod(object, name, prefix));
	}

	startTimer(name) {
		var timer = this.timers[name] = this.timers[name] || {name: name, count: 0, started: 0, total: 0}
		timer.started = performance.now();
	}

	stopTimer(name) {
		var timer = this.timers[name] = this.timers[name] || {count: 0, started: 0, total: 0}
		var stop = performance.now();
		var duration = stop - timer.started;
		timer.total += duration;
		timer.count++;
	}

	break(char = '-') {
		var prefix = this.renderPrefix('');
		var line = char.repeat(80);
		this.str('\n', prefix, line);
	}

	noop(val) {
		return val;
	}

	makeClockParts(time) {
		var date = new Date(time);

		return {
			year: date.getFullYear(),
			month: date.getMonth() + 1,
			day: date.getDate(),
			hour: date.getHours(),
			minute: date.getMinutes(),
			second: date.getSeconds(),
			ms: date.getMilliseconds()
		}
	}

	makeClock(ts, includeMs = true) {
		var {year, month, day, hour, minute, second, ms} = this.makeClockParts(ts);
		year = ('' + year).padStart(4, 0);
		month = ('' + month).padStart(2, 0);
		day = ('' + day).padStart(2, 0);
		hour = ('' + hour).padStart(2, 0);
		minute = ('' + minute).padStart(2, 0);
		second = ('' + second).padStart(2, 0);
		ms = includeMs ? '.' + String(ms).padStart(3, 0) : '';

		return `${month}/${day}/${year} ${hour}:${minute}:${second}${ms}`;
	}

	makeDate(ts) {
		return new Date(ts).toLocaleDateString('en-US');
	}

	makeShortTime(time, long = false) {
		time = Math.floor(time % DAY);
		return this.makeFullTime(time, long);
	}

	makeFullTime(time, base = 0, long = true) {
		time = Math.floor(time);
		time = time - base;
		var days = Math.floor(time / DAY);
		time = time % DAY;
		var hours = Math.floor(time / HOUR);
		time = time % HOUR;
		var minutes = Math.floor(time / MINUTE);
		time = time - minutes * MINUTE;
		var seconds = Math.floor(time / SECOND);
		time = time - seconds * SECOND;
		var ms = time;

		var hasDays = Boolean(days);
		var hasHours = Boolean(hours);
		var hasMinutes = Boolean(minutes);
		var hasSeconds = Boolean(seconds);
		var hasMs = Boolean(ms);
		long = hasDays || long;

		var dayStr = days + '';
		var hourStr = !long ? ('' + hours).padStart(2, '0') : hours + '';
		var minuteStr = !long ? ('' + minutes).padStart(2, '0') : minutes + '';
		var secondStr = !long ? ('' + seconds).padStart(2, '0') : seconds + '';
		var msStr = !long ? ('' + ms).padStart(3, '0') : ms + '';

		var showDays = hasDays;
		var showHours = hasHours || showDays && !long;
		var showMinutes = hasMinutes || showHours && !long;
		var showSeconds = hasSeconds || showMinutes && !long;
		var showMs = hasMs || showSeconds && !long;

		var daySep = long ? 'd, ' : '';
		var hourSep = long ? 'h, ' : ':';
		var minuteSep = long ? 'm, ' : ':';
		var secondSep = long ? 's, ' : ':';
		var msSep = long ? 'ms ' : '';

		dayStr = showDays ? dayStr + daySep : '';
		hourStr = showHours  ? hourStr + hourSep : '';
		minuteStr = showMinutes ? minuteStr + minuteSep : '';
		secondStr = showSeconds ? secondStr + secondSep : '';
		msStr = showMs ? msStr + msSep : '';

		var result = `${dayStr}${hourStr}${minuteStr}${secondStr}${msStr}`;

		if (result.endsWith(', ')) result = result.slice(0, -2);
		if (result === '') return long ? '0s': '0.000';
		return result;
	}

	makeTimeDelta(start, stop, long = false) {
		stop += 1;
		var realStart = Math.min(start, stop);
		var realStop = Math.max(start, stop);
		var delta = realStop - realStart;

		return this.makeFullTime(delta, long);
	}

	push(name) {
		var group = this.groups.at(-1);
		this.groups.push(name ? name : group);
		this.numbers.push(1);
	}

	pop() {
		this.groups.pop();
		this.numbers.pop();
		var number = this.numbers.pop();
		number++;
		this.numbers.push(number);
	}

	reset(group) {
		this.numbers = [1];
		this.groups = [group];
		this.first = true;
		this.timers = {};
	}

	renderPrefix(prefix = '') {
		var nested = this.numbers.map((number) => '' + number + '.');
		nested = nested.reduce((nested, number) => nested+number, '');

		var group = this.groups.length > 0 ? ` ${this.groups[this.groups.length - 1]}:` : '';

		var number = this.numbers.pop();
		number++;
		this.numbers.push(number);

		return `${nested}${group}${prefix}`;
	}

	str(...args) {
		var nl = this.first ? '\n\n' : '';
		this.first = false;
		console.log(nl, ...args);
	}

	json(obj, prefix) {
		prefix = this.renderPrefix(prefix);
		var json = JSON.stringify(obj, null, '    ');
		this.str(`${prefix} ${json}`);
	}

	log(str, prefix) {
		prefix = this.renderPrefix(prefix);
		this.str(prefix, str);
	}

	shortTime(time, prefix, long = false) {
		var str = this.makeShortTime(time, long);
		this.log(str, prefix);
	}

	fullTime(time, prefix, base = 0, long = true) {
		var str = this.makeFullTime(time, base, long);
		this.log(str, prefix);
	}

	timeDelta(start, stop, prefix, long = false) {
		var str = this.makeTimeDelta(start, stop, long);
		this.log(str, prefix);
	}

	clock(ts, prefix) {
		var str = this.makeClock(ts);
		this.log(str, prefix);
	}

	date(ts, prefix) {
		var str = this.makeDate(ts);
		this.log(str, prefix);
	}

	timer(name, prefix) {
		timer = this.timers[name];
		if (!timer) this.log(`timer ${name} does not exist`);

		var average = timer.count ? timer.total / timer.count : 0;
		var message = `timer: ${name} count: ${timer.count} total: ${timer.total} average: ${average}`
	}

	logTimers(prefix) {
		function one(name, count, total, average) {
			name = name.padEnd(30);
			count = ('' + count).padEnd(10);
			total = ('' + total).padEnd(25);
			average = ('' + average).padEnd(25);
			return `${name} ${count} ${total} ${average}`;
		}
		var report = [''];
		report.push(one('NAME', 'COUNT', 'TOTAL', 'AVERAGE'));
		report.push('-'.repeat(90));
		var timers = Object.values(this.timers);
		var lines = timers.map((timer) => {
			var {name, count, total} = timer;
			var average = count ? total / count : 0;

			return one(name, count, total, average);
		})

		report = [...report, ...lines];
		report = report.join('\n');

		this.log(report, prefix);
	}
}

export default new Logger();
