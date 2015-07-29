'use strict';
var fs = require('fs-extra-promise');
var semver = require('semver');
var shell = require('shelljs');
var _ = require('lodash');
var Promise = require('promise');
var moment = require('moment');
var colors = require('colors');

module.exports = function build(v) {
    fs.readJsonAsync('bower.json')
    .then(function(s) {
        var version = semver.valid(s.version);
        var message = v.args[1];
        var commits = [];
        var lastTag;

        if (version === null) {
            throw new Error('version value wrong! ' + s.version.gray + ' is not valid semver. See semver.org');
        }

        version = semver.inc(version, v.args[0]);

        var result = shell.exec('git describe --abbrev=0 --tags', {silent: true});
        if (result.code === 0) {
            lastTag = _.trim(result.output);
        }

        if (lastTag) {
            commits = getCommitMessages(lastTag);
        } else {
            message = 'Initial release';
        }

        s.version = version;
        return Promise.all([writeBower(s), updateReadme(version, s), updateChangelog(version, message, commits)])
        .then(function() {
            console.log('OK.'.green + ' Bumped to version ' + version.green);
        });
        // console.log(lastTag, version, commits);

    })
    .catch(function(e) {
        var r = 'Error: '.red;
        if (e.code === 'ENOENT') {
            console.log(r + 'Can\'t open ' + e.path.gray);
        } else {
            var errString = e.toString();
            var errWord = errString.substring(0, errString.indexOf(':') + 1);
            console.log(errString.replace(errWord, errWord.red));
        }
    });
};

function getCommitMessages(tag) {
    var r = shell.exec('git log ' + tag + '..HEAD --pretty=format:%s --no-merges', {silent: true});
    r = r.output.split('\n').map(_.trim);
    return r;
}

function writeBower(s) {
    return fs.writeJsonAsync('./bower.json', s);
}

function updateReadme(version, bow) {
    return fs.readFileAsync('./README.md')
    .then(function(s) {
        // Replace ' | <old-version> | ' with ' | <new-version> '
        s = s.toString().replace(/(\|\s*)[0-9.]+(\s*\|)/, '$1' + version + '$2');
        return fs.writeFileAsync('./README.md', s);
    })
    .catch(function() {
        console.log('Warning!'.yellow + ' Error reading ' + 'README.md'.gray);
    });
}

function updateChangelog(version, message, commits) {
    var output = '### v' + version + ' - `' + moment().format("DD/MM/YYYY, h:mma") + '`\n';
    if (message) output += '#### ' + message + '  \n';
    _.each(commits, function(msg, i) {
        if (!msg || msg.toLowerCase().substring(0, 4) === 'bump') return;
        output += '* ' + msg + '  \n';
    });

    return fs.readFileAsync('./CHANGELOG.md')
    .then(function(s) {
        s = s.toString();
        output += '\n\n' + s;
        return fs.writeFileAsync('./CHANGELOG.md', output);
    })
    .catch(function() {
        return fs.writeFileAsync('./CHANGELOG.md', output);
    });
}