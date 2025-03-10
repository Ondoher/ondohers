#!/usr/bin/env node

import pathOS from 'path';
import process from'process';
import minimist from 'minimist';
import { getOptions } from "./options.js";
import util from 'util';
import ChildProcess from 'child_process';
import fs from 'fs';

var {readFile, writeFile, readdir, stat} = fs.promises;
var path = pathOS.posix;

var DEBUG = true;

/**
 * This is the combined content of all the package.json files. The key is the
 * name of the module, the value is the contents of the package.json file
 *
 * @typedef {{[key: string]: Object}} Packages
 */

/**
 * This is the map between the package name, and the directory.
 *
 * @typedef {{[key: string]: String}} PackageMap
 */

/**
 * This is the information about all the packages
 *
 * @typedef {Object} Content
 * @property {Packages} contents the combined content of all the package.json
 *  files
 * @property {PackageMap} map the map between package name and directort
 */

var exec = util.promisify(ChildProcess.exec);

var defaultOptions = {
    version: false,
    major: false,
    minor: false,
    tag: false,
    notag: false,
    dry: false,
    verbose: false,
    write: true,
    path: './packages'
}

var flags = {
    major: 'j',
    minor: 'm',
    tag: 't',
    notag: 'n',
    dry: 'd',
    verbose: 'v',
    write: 'w',
    path: 'p'
}

var options;
var root;

var newVersion;
var newMajor;
var newTag;
var noTag;

var argv = minimist(process.argv.slice(2));
var targets = argv._ || [];

/**
 * call this function to force the file path to use posix notation and remove
 * all drive information.
 *
 * @param {String} src the filename wqe
 * @returns {String} the new path
 */
export function forceToPosix(src) {
	src = src.replace('file:', '');
	src = src.replace('///', '');
	src = src.replace(/.*?:/, '');
	src = src.replace(/\\/g, '/');

	return src;
}

/**
 * call this function to check if the given file exists
 *
 * @param {String} path the name of the file
 * @returns {Promise<Boolean>} true if the file exists
 */
export async function fileExists(path) {
    try {
        await stat(path)
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Call this method to check if the arguments specifies to publish all packages
 *
 * @returns {Boolean} returns true if the target for mpublish is all packages
 */
function isAll() {
    return (targets.length === 1) && (targets[0] === 'all');
}

/**
 * Call this method to get the directory contents of the given path
 *
 * @param {String} path the source path
 *
 * @returns {Promise<Dirent[]>}
 */
async function getDir(path) {
    return await readdir (path, {withFileTypes: true});
}

/**
 * Call this methof to check if the given path contains a package.json file
 *
 * @param {String} dir the directory to search
 * @returns {Promise<Boolean>} true if package.json exists
 */
async function hasPackage(dir) {
    return await fileExists(path.join(dir, 'package.json'));
}

/**
 * Call this to see if the given path is a directory
 * @param {String} path the directory to check
 *
 * @returns {Promise<Boolean>} true if the pathg is a directory
 */
async function isDirectory(path) {
    var stats = await stat(path);
    return stats && stats.isDirectory();
}

/**
 * Call this method to read the contents of a JSON file
 *
 * @param {String} path the path of the json file
 * @returns {Promise<Object>} a javascript object with the content
 */
export async function readJsonFile(path) {
    var contents;
    try {
        contents = await readFile(path, 'utf-8');

        // remove the BOM if present, we only support utf-8;
        contents = contents.replace(/^\uFEFF/, '');

        var json = JSON.parse(contents);

        return json;
    } catch(e) {
        console.warn('unable to load the json file: ', path)
        console.warn(e);

        return {};
    }
}

/**
 * Call this method to write the contents of an object as a json file
 *
 * @param {String} path the relative path of the json file
 * @param {Object} content a javascript object
 * @return {Promise<Boolean>} true if the write succeded, false otherwise
 */
async function writeJsonFile(path, content) {
    try {
        await writeFile(path, JSON.stringify(content, null, '  '));
        return true
    } catch(e) {
        console.error('unable to write the json file for application translations', path)
        console.error(e);

        return false;
    }
}

/**
 * Call this method to get the list of directores that have a package file.
 *
 * @returns {Promise<String[]>} the list of directories
 */
async function collectPackages() {
    var dirs = await getDir(root);
    var packages = [];

    for (let dirEnt of dirs) {
        let dir = path.join(root, dirEnt.name);
        if (await isDirectory(dir) && await hasPackage(dir))
            packages.push(dir);
    }

    return packages;
}

/**
 * Call this to load all the package.json content for all the packages
 * also get a mapping between the json package name and the path
 *
 * @param {Array<String>} packages the lost of psackage directories
 * @returns {Promise<Content>} the content
 */
async function getContent(packages) {
    var contents = {};
    var map = {};

    for (let dir of packages) {
        var content = await readJsonFile(path.join(dir, 'package.json'))
        var name = content.name;

        contents[name] = content;
        map[name] = dir;
    };

    return {contents, map};
}


/**
 * Call this to get the list of all the packages that need to be published. This
 * will include recursive dependencies of specified targets
 *
 * @param {Packages} contents the contents of all the packages
 * @param {Array<String>} targets the names of the packages to be published
 *
 * @returns {Array<String>} the list of package names that need to be published
 */

function getPublishList(contents, targets) {
    // all collected modules to be published
    var toPublish = targets.slice();

    // list of modules to check for dependants
    var queue = toPublish.slice();
    var all = isAll();


    if (all) {
        return Object.keys(contents);
    }

    // add to results
    function publish(name) {
        if (!toPublish.includes(name)) toPublish.push(name)
    }

    // add to list of modules to check
    function enqueue(name) {
        // if it's already waiting
        if (queue.includes(name)) return;

        // if it's already being published
        if (toPublish.includes(name)) return;

        queue.push(name);
    }

    // while there are any modules left to process, check for dependents
    while (queue.length) {
        // grab a new package off the queue then check if there are any other
        // mnodules that depend on it. thse will also need to be published
        let moduleName = queue.shift();

        // we are going to check all modules to see if they have a dependency on
        // this one
        let keys = Object.keys(contents);
        keys.forEach(function(name) {
            // if this module is already being published, don't process
            if (toPublish.includes(name)) return;

            // the package content for this module
            var content = contents[name];

            // the list of dependencies of module being checked
            var dependencies = Object.keys(content.dependencies || {});

            // is this module dependent on the dequeued module, if so, it needs
            // to be published, and all modules checked against it
            if (dependencies.includes(moduleName)) {
                enqueue(name)
                publish(name);
            }
        })
    }

    console.log('dependencies collected...');
    return toPublish;
}

/**
 * Call this method to sort the packages based on dependencies, such that the
 * dependencies of each package are published before the packages that depend on
 * them
 *
 * @param {Array<String>} list the list of package names to be published
 * @param {Packages} contents the content of all packages found
 *
 * @returns {Array<String>} the sorted list of module names
 */
function sortPackages(list, contents) {
    var result = [];
    var queue = list.slice();
    var shallowDependencies = {};

    function enqueue(module) {
        queue.push(module);
    };

    function dequeue() {
        return queue.shift();
    };

    function isComplete(module) {
        var dependencies = shallowDependencies[module] || [];
        for (let idx = 0; idx < dependencies.length; idx++) {
            let dependency = dependencies[idx]
            if (result.indexOf(dependency) === -1) {
                return false;
            }
        }

        return true;
    }

    function buildShallowDependencies() {
        list.forEach(function(one) {
            shallowDependencies[one] = [];
            var content = contents[one] || {};
            var dependencies = Object.keys(content.dependencies || {});
            dependencies.forEach(function(dependency) {
                if (list.indexOf(dependency) !== -1) {
                    shallowDependencies[one].push(dependency)
                }
            })
        });
    }

    buildShallowDependencies();

    //todo: detect circular reference
    while (queue.length) {
        let module = dequeue();

        if (isComplete(module)) {
            result.push(module)
        } else {
            enqueue(module)
        }
    }

    console.log('modules sorted...')
    return result;
}


/**
 * Call this method to update the version numbers of all the packages to be
 * published based on the command line options,
 *
 * @param {Object} content the package.json content for a specific module. This
 *  object will be modified with the new version
 *
 * @returns {String} the new version number
 */
function updateVersion(content) {
    var version = content.version;
    var parts = version.split('.');
    var patch;
    var packageTag;
    var pos;

    if (parts.length < 3) return;

// the patch is everything after the second '.'
    var patch = parts.slice(2).join('.');
    parts = parts.slice(0, 3);

// get the patch tag
    var pos = patch.indexOf('-');
    if (pos !== -1) {
        packageTag = patch.slice(pos + 1);
        patch = patch.slice(0, pos);
    }

// update the minor and patch versions
    if (newVersion && parts[1] != newVersion) {
        parts[1] = newVersion;
        parts[2] = '0';
    } else {
        parts[2] = parseInt(patch, 10) + 1;
    }

// add the tag
    if (newTag) {
        parts[2] += '-' + newTag;
    } else if (!noTag && packageTag) {
        parts[2] += '-' + packageTag;
    }

// set the new major version
    if (newMajor && parts[0] != newMajor) {
        parts[0] = newMajor;
    }

// update the package.json version field
    content.version = parts.join('.');
    return content.version;
}

/**
 * Call this method to update the version numbers of all the packages being
 * published
 *
 * @param {Packages} contents the content of all found packages. This content
 *  will be moified with the new version numbers
 * @param {Array<String>} list the list of package names to be updated
 *
 * @returns {{[key: string] : String}} a map between the package name and the
 * new version
 */
function updateVersions(contents, list) {
    var response = {};

    list.forEach(function(name) {
        var version = updateVersion(contents[name]);
        response[name] = version;
    });

    return response;
}

/**
 * Call this method to get the current version numbers of all the packages being
 * published
 *
 * @param {Packages} contents the content of all found packages. This content
 *  will be moified with the new version numbers
 * @param {Array<String>} list the list of package names to be updated
 *
 * @returns {{[key: string] : String}} a map between the package name and the
 *  version
 */
function getVersions(contents, list) {
    var response = {};

    list.forEach(function(name) {
        var version = contents[name].version;
        response[name] = version;
    });

    return response;
}

/**
 * Call this method to update all the dependency on packages to be published
 * with the new versions of the packages they depend on
 *
 * @param {Packages} contents the complete content of all found packages. This
 *  object will be modified
 * @param {Array<String>} list the list pf package names being published
 * @param {{[key: string] : String}} versions the map between package name and version
 */
function updateDependencies(contents, list, versions) {
    function updateOne(content) {
        var dependencies = content.dependencies || {};
        var keys = Object.keys(dependencies);

        keys.forEach(function(name) {
            if (versions[name]) {
                dependencies[name] = versions[name];
            }
        });

        if (options.verbose) {
            console.log('\nupdated package', content.name);
            console.log(JSON.stringify(content, null, '  '));
        }
    }

    list.forEach(function(name) {
        updateOne(contents[name]);
    });

    if (options.verbose) {
        console.log('-------------------------------\n');
    }

    console.log('versions updated...');
}

/**
 * Call this method to save the updated package.json file for all packages to
 * be published
 *
 * @param {Packages} contents the list of all found packages
 * @param {Array<String>} list the liost of package names to be published
 * @param {PackageMap} map the map between package name and the directory of the
 *  package
 *
 * @returns {Promise}
 */
async function writeUpdatedPackages(contents, list, map) {
    if (options.write) {
        for (let name of list) {
            let dir = map[name];
            let content = contents[name];

            await writeJsonFile(path.join(dir, 'package.json'), content);
        }
    }

    console.log('packages saved...');
}

/**
 * Call this method to publish all the identified packages
 *
 * @param {Array<String>} list the packages to be published
 * @param {PackageMap} map the maping between package name and directory
 *
 * @returns {Promise}
 */
async function publish(list, map) {
    var cur = process.cwd();

    for (let name of list) {
        let dir = map[name];

        // get the os specific path string
        let parts = dir.split('/');
        dir = parts.join(pathOS.sep);

        process.chdir(dir);
        if (options.verbose) {
            console.log(process.cwd(), 'npm install');
        }
        if (!options.dry) {
            await exec('npm install');
        }
        if (options.verbose) {
            console.log(process.cwd(), 'npm publish');
        }
        if (!options.dry) {
            await exec('npm publish');
        }
    }

    process.chdir(cur);

    console.log('all packages published');
}

/**
 * Call this method to output to the console the updated package versions
 *
 * @param {{[key: string] : String}} versions the map between the package name
 *  and the new module
 */
function displayResults(versions) {
    var keys = Object.keys(versions);
    console.log('')
    console.log('Published', keys.length, 'packages')
    console.log('==================================')
    keys.forEach(function(key) {
        var version = versions[key];

        console.log(key, '=>', version);
    });
}

/**
 * Call this method to output the cli instructions
 *
 * @returns {Promise}
 */
async function instructions() {
	var instructions = await readFile(path.join(forceToPosix(import.meta.url),  '../instructions.txt'), {encoding:'utf-8'});

    console.log(instructions);
}

/**
 * This is the main method of the application
 *
 * @returns {Promise}
 */
async function main() {
    options = getOptions(defaultOptions, argv, flags);
    targets = argv._ || [];
    root = forceToPosix(process.cwd());
    root = path.normalize(path.join(root, options.path));

    newVersion = options.minor;
    newMajor = options.major;
    newTag = options.tag;
    noTag = options.notag;

    var publishList;
    var versions;

    if (targets.length === 0) return await instructions();

    var packages = await collectPackages();
    var {contents, map} = await getContent(packages);

    // if not writing packages, use current versions
    if (options.write || options.dry) {
        publishList = getPublishList(contents, targets);
        versions = updateVersions(contents, publishList);

        updateDependencies(contents, publishList, versions);
        await writeUpdatedPackages(contents, publishList, map);
        publishList = sortPackages(publishList, contents);
    } else {
        publishList = Object.keys(map);
        versions = getVersions(contents, publishList);
        publishList = sortPackages(publishList, contents);
    }
    await publish(publishList, map);
    displayResults(versions);
}

main();
