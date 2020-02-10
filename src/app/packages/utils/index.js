import {
    MDCSelect
} from '@material/select/index';
import {
    MDCRipple
} from '@material/ripple/index';
import {
    MDCTopAppBar
} from '@material/top-app-bar/index';

import $ from 'jquery';

const phone = require('phone');
const axios = require('axios');
const Data = require('@tutorbook/data');

// Tutorbook utils class that contains basic utils used across the program
class Utils {

    constructor() {
        this.data = window.app ? window.app.data || new Data() : new Data();
    }

    static visible(opts = {}) {
        if (!opts.el) return false;

        const element = typeof opts.el === 'string' ? $(opts.el)[0] : opts.el;
        const pageTop = opts.pageTop || $(window).scrollTop();
        const pageBottom = opts.pageBottom || pageTop + $(window).height();
        const elementTop = $(element).offset().top;
        const elementBottom = elementTop + $(element).height();

        if (opts.partiallyInView) {
            return ((elementTop <= pageBottom) && (elementBottom >= pageTop));
        } else {
            return ((pageTop < elementTop) && (pageBottom > elementBottom));
        }
    }

    static sync(obj, root) {
        Object.entries(obj).forEach(([k, v]) => root[k] = Utils.clone(v));
    }

    static identicalMaps(mapA, mapB) { // Thanks to https://bit.ly/2H4Nz1S
        if (mapA.size !== mapB.size) return false;
        for (var [key, val] of Object.entries(mapA)) {
            if (typeof val === 'object' && !Utils.identicalMaps(mapB[key], val))
                return false;
            if (typeof val !== 'object' && mapB[key] !== val) return false;
        }
        return true;
    }

    static shortenString(str, length = 100, ending = '...') {
        return str.length > length ? str.substring(0, length - ending.length) +
            ending : str;
    }

    static updateSetupProfileCard(p) {
        if (!Object.values(p.availability).length) {
            return p.type === 'Tutor' ? p.cards.setupProfile = true : p.cards
                .setupAvailability = true;
        } else if (p.type !== 'Tutor') {
            return p.cards.setupAvailability = false;
        }
        for (var key of ['type', 'grade', 'gender', 'phone', 'email']) {
            if (!p[key]) return p.cards.setupProfile = true;
        }
        if (!p.subjects.length) return p.cards.setupProfile = true;
        p.cards.setupProfile = false;
    }

    static wrap(str, maxWidth) { // See https://bit.ly/2GePdNV
        const testWhite = (x) => {
            const white = new RegExp(/^\s$/);
            return white.test(x.charAt(0));
        };
        const newLineStr = "\n";
        var res = '';
        while (str.length > maxWidth) {
            var found = false;
            // Inserts new line at first whitespace of the line
            for (var i = maxWidth - 1; i >= 0; i--) {
                if (testWhite(str.charAt(i))) {
                    res = res + [str.slice(0, i), newLineStr].join('');
                    str = str.slice(i + 1);
                    found = true;
                    break;
                }
            }
            // Inserts new line at maxWidth position, the word is too long to 
            // wrap
            if (!found) {
                res += [str.slice(0, maxWidth), newLineStr].join('');
                str = str.slice(maxWidth);
            }
        }
        return res + str;
    }

    static viewRaw(doc) {
        const json = JSON.stringify({
            data: doc.data(),
            id: doc.id,
        }, null, 2);
        const w = window.open();
        w.document.open();
        w.document.write('<html><body><pre>' + json + '</pre>' +
            '</body></html>');
        w.document.close();
    }

    static getNextDateWithDay(day) {
        const now = new Date();
        const date = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0, 0, 0, 0);
        var count = 0;
        // Added counter just in case we get something that goes on forever
        while (Data.days[date.getDay()] !== day && count <= 256) {
            date.setDate(date.getDate() + 1);
            count++;
        }
        return date;
    }

    static color(time, colors) {
        if (!colors || typeof colors !== 'object') colors = {};
        if (colors[time.day] && colors[time.day][time.from])
            return colors[time.day][time.from];
        const palette = {
            'purples': ['#7e57c2', '#5e35b1', '#4527a0', '#311b92'],
            'pinks': ['#ec407a', '#d81b60', '#ad1457', '#880e4f'],
            'blues': ['#5c6bc0', '#3949ab', '#283593', '#1a237e'],
            'oranges': ['#ffa726', '#fb8c00', '#ef6c00', '#e65100'],
            'greens': ['#26a69a', '#00897b', '#00695c', '#004d40'],
            'greys': ['#78909c', '#546e7a', '#37474f', '#263238'],
        };
        if (colors[time.day]) {
            var type = 'oranges';
            var used = [];
            Object.entries(palette).forEach((entry) => {
                Object.values(colors[time.day]).forEach((color) => {
                    if (entry[1].indexOf(color) >= 0) type = entry[0];
                    used.push(color);
                });
            });
            for (var i = 0; i < palette[type].length; i++) {
                if (used.indexOf(palette[type][i]) < 0) {
                    colors[time.day][time.from] = palette[type][i];
                    break;
                }
            }
            if (!colors[time.day][time.from])
                colors[time.day][time.from] = used[0];
        } else {
            colors[time.day] = {};
            var type = 'oranges';
            var used = [];
            Object.entries(palette).forEach((entry) => {
                Object.values(colors).forEach((times) => {
                    Object.values(times).forEach((c) => {
                        if (entry[1].indexOf(c) >= 0) used.push(entry[0]);
                    });
                });
            });
            for (var i = 0; i < Object.keys(palette).length; i++) {
                var key = Object.keys(palette)[i];
                if (used.indexOf(key) < 0) type = key;
            }
            colors[time.day][time.from] = palette[type][0];
        }
        return colors[time.day][time.from];
    }

    static showPayments() {
        window.app.user.config.showPayments = true;
        window.app.nav.initDrawer();
        window.app.updateUser();
        window.app.payments.view();
    }

    static viewCard(card, cards) {
        if (!card) {
            throw new Error('Invalid card passed to viewCard:', card);
        }
        var id = $(card).attr('id').trim();
        var existing = $(cards).find('#' + id);
        if ($(existing).length) {
            return $(existing).replaceWith(card);
        }
        var timestamp = new Date($(card).attr('timestamp'));
        for (var i = 0; i < cards.children.length; i++) {
            var child = cards.children[i];
            var time = new Date($(child).attr('timestamp'));
            if (time && time < timestamp) {
                return $(card).insertBefore(child);
            }
        }
        $(cards).append(card);
    }

    static recycle(queries, recycler) {
        Object.entries(queries).forEach((entry) => {
            var subcollection = entry[0];
            var query = entry[1];
            window.app.listeners.push(query.onSnapshot({
                error: (err) => console.error('Could not get ' + subcollection +
                    ' data snapshot b/c of ', err),
                next: (snapshot) => {
                    if (!snapshot.size) {
                        return recycler.empty(subcollection);
                    }

                    snapshot.docChanges().forEach((change) => {
                        if (change.type === 'removed') {
                            recycler.remove(change.doc, subcollection);
                        } else {
                            recycler.display(change.doc, subcollection);
                        }
                    });
                },
            }));
        });
    }

    static getDurationStringFromDates(start, end, readable) {
        const secs = (end.getTime() - start.getTime()) / 1000;
        const string = Utils.getDurationStringFromSecs(secs);
        if (readable) return string.slice(0, -3);
        return string + '.00'; // For clockIn timers
    }

    static getDurationStringFromSecs(secs) {
        // See: https://www.codespeedy.com/convert-seconds-to-hh-mm-ss-format-
        // in-javascript/
        const time = new Date(null);
        time.setSeconds(secs);
        return time.toISOString().substr(11, 8);
    }

    static getEarliestDateWithDay(date) {
        return new Date(date.getFullYear(), date.getMonth(),
            date.getDate(), 0, 0, 0, 0);
    }

    static getTimeString(timestamp) {
        // NOTE: Although we create timestamp objects here as new Date() objects,
        // Firestore converts them to Google's native Timestamp() objects and thus
        // we must call toDate() to access any Date() methods.
        var timeString = timestamp.toDate().toLocaleTimeString();
        var timeStringSplit = timeString.split(':');
        var hour = timeStringSplit[0];
        var min = timeStringSplit[1];
        var ampm = timeStringSplit[2].split(' ')[1];
        return hour + ':' + min + ' ' + ampm;
    }

    static getOther(notThisUser, attendees) {
        if (!notThisUser.email && !!notThisUser.length) {
            if (notThisUser[0].email === window.app.user.email) {
                return notThisUser[1];
            }
            return notThisUser[0];
        }
        if (attendees[0].email === notThisUser.email) {
            return attendees[1];
        }
        return attendees[0];
    }

    static caps(str) {
        var str = str.split(' ');
        for (let i = 0, x = str.length; i < x; i++) {
            str[i] = str[i][0].toUpperCase() + str[i].substr(1);
        }
        return str.join(' ');
    }

    static getPhone(phoneString) {
        const parsed = phone(phoneString);
        if (!parsed[0]) return phoneString || '';
        return parsed[0];
    }

    static getName(profile) { // Capitalizes the name ("nick li" -> "Nick Li")
        var name = profile.name || profile.displayName || '';
        return Utils.caps(name);
    }

    static getType(type) {
        if (type) return type;
        if (location.toString().indexOf('type') >= 0) {
            const pairs = location.toString().split('?');
            const tPair = pairs[pairs.findIndex(p => p.indexOf('type') >= 0)];
            return Utils.caps(tPair.split('=')[1].replace('/', ''));
        }
        return '';
    }

    static getLocation(profile) {
        // TODO: Bug here is that data.locationNames only includes name of the 
        // current app location (unless partition is 'Any').
        const valid = window.app.data.locationNames;
        if (valid.indexOf(profile.location) >= 0) return profile.location;
        // This uses the most recently added availability (i.e. the last key).
        if (!profile.availability) return window.app.location.name || '';
        for (var loc of Object.keys(profile.availability).reverse()) {
            if (valid.indexOf(loc) >= 0) return loc;
        }
        return window.app.location.name || '';
    }

    static getLocations(profile) {
        return profile.availability ? Utils.concatArr(Object.keys(profile
            .availability), [window.app.location.name]) : [window.app.location
            .name
        ];
    }

    static getAuth(profile) {
        if (profile.authenticated) return profile.authenticated;
        if (['Pupil', 'Tutor'].indexOf(profile.type) >= 0) return true;
        return false;
    }

    static filterProfile(profile) {
        return {
            'name': Utils.getName(profile),
            'uid': profile.uid || "",
            'photo': profile.photoURL || profile.photo || "",
            'id': profile.email || "", // Use email as ID
            'email': profile.email || "",
            'phone': Utils.getPhone(profile.phone),
            'type': Utils.getType(profile.type),
            'gender': profile.gender || "",
            'grade': profile.grade || "",
            'bio': profile.bio || "",
            'avgRating': profile.avgRating || 0,
            'numRatings': profile.numRatings || 0,
            'subjects': profile.subjects || [],
            'cards': profile.cards || {},
            'settings': profile.settings || {},
            'config': profile.config || {
                showPayments: false,
                showProfile: true,
            },
            'availability': profile.availability || {},
            'payments': profile.payments || {
                hourlyChargeString: '$25.00',
                hourlyCharge: 25,
                totalChargedString: '$0.00',
                totalCharged: 0,
                currentBalance: 0,
                currentBalanceString: '$0.00',
                type: 'Free',
                policy: 'Hourly rate is $25.00 per hour. Will accept ' +
                    'lesson cancellations if given notice within 24 hours.' +
                    ' No refunds will be issued unless covered by a Tutorbook ' +
                    'guarantee.',
            },
            'authenticated': Utils.getAuth(profile),
            'location': Utils.getLocation(profile),
            'locations': Utils.getLocations(profile),
            'children': profile.children || [],
            'secondsTutored': profile.secondsTutored || 0,
            'secondsPupiled': profile.secondsPupiled || 0,
            'proxy': profile.proxy || [],
            'created': profile.createdTimestamp || new Date(),
        };
    }

    static concatArr(arrA = [], arrB = []) {
        var result = [];
        arrA.forEach((item) => {
            if (result.indexOf(item) < 0 && item !== '') {
                result.push(item);
            }
        });
        arrB.forEach((item) => {
            if (result.indexOf(item) < 0 && item !== '') {
                result.push(item);
            }
        });
        return result;
    }

    static getOtherUser(userA, userB) {
        if (userA.email === window.app.user.email) {
            return userB;
        }
        return userA; // Default is to return the first user
    }

    static genID() {
        // See: https://gist.github.com/gordonbrander/2230317
        // Math.random should be unique because of its seeding algorithm.
        // Convert it to base 36 (numbers + letters), and grab the first 9 
        // characters after the decimal.
        return '_' + Math.random().toString(36).substr(2, 9);
    }

    static url(url) {
        history.pushState({}, null, url);
    }

    static getCleanPath(dirtyPath) {
        dirtyPath = dirtyPath || document.location.pathname;
        if (dirtyPath.startsWith('/app/index.html')) {
            const newPath = dirtyPath.split('/').slice(2).join('/');
            return newPath;
        } else {
            return dirtyPath;
        }
    }

    static attachHeader(headerEl = 'header .mdc-top-app-bar') {
        if (typeof headerEl === 'string') headerEl = $(headerEl)[0];
        $(headerEl).find('.mdc-icon-button').each(function() {
            MDCRipple.attachTo(this).unbounded = true;
        });
        $(headerEl).find('.mdc-list-item').each(function() {
            MDCRipple.attachTo(this);
        });
        return MDCTopAppBar.attachTo(headerEl);
    }

    static attachSelect(selectEl) {
        if (typeof selectEl === 'string') selectEl = $(selectEl)[0];
        const ops = [];
        $(selectEl).find('.mdc-list-item').each(function() {
            MDCRipple.attachTo(this);
            if (ops.indexOf(this.innerText) < 0) ops.push(this.innerText);
        });
        const selected = $(selectEl).find('.mdc-select__selected-text').text();
        const select = MDCSelect.attachTo(selectEl);
        // Render empty selects even when val is null, undefined, or false.
        if (selected !== '') select.selectedIndex = ops.indexOf(selected);
        return select;
    }

    static urlData() {
        const data = window.location.toString().split('?');
        data.forEach((pairs) => {
            var key = pairs.split('=')[0];
            var val = pairs.split('=')[1];
            switch (key) {
                case 'payments':
                    window.app.user.config.showPayments = true;
                    window.app.user.payments.type = 'Paid';
                    break;
                case 'code':
                    window.app.user.cards.setupStripe = false;
                    window.app.redirectedFromStripe = true; // For payments
                    window.app.snackbar.view('Connecting payments account...');
                    axios({
                        method: 'GET',
                        url: window.app.functionsURL + 'initStripeAccount',
                        params: {
                            code: val.replace('/', ''),
                            id: firebase.auth().currentUser.uid,
                            test: window.app.test,
                        },
                    }).then((res) => {
                        window.app.snackbar.view(
                            'Connected payments account.', 'View', () => {
                                window.open(res.data.url); // Opens dashboard
                            });
                    }).catch((err) => {
                        console.error('Error while initializing Stripe ' +
                            'account:', err);
                        window.app.snackbar.view('Could not connect payments ' +
                            'account.', 'Retry', () => {
                                window.location = window.app.payments.setupURL;
                            });
                    });
                    break;
                case 'type':
                    window.app.user.type = val.replace('/', '');
                    break;
                case 'auth':
                    if (val.indexOf('false') >= 0) {
                        window.app.user.authenticated = false;
                    } else {
                        window.app.user.authenticated = true;
                    }
                    break;
                case 'cards':
                    Data.setupCards.forEach((card) => {
                        if (val.indexOf(card) >= 0) {
                            window.app.user.cards[card] = true;
                        }
                    });
                    break;
            }
        });
        window.app.updateUser();
    }

    static parseAvailabilityStrings(strings) {
        // Then, convert those strings into individual parsed maps
        var maps = [];
        strings.forEach((string) => {
            maps.push(Utils.parseAvailabilityString(string));
        });

        // Finally, parse those maps into one availability map
        var result = {};
        maps.forEach((map) => {
            result[map.location] = {};
        });
        maps.forEach((map) => {
            result[map.location][map.day] = [];
        });
        maps.forEach((map) => {
            result[map.location][map.day].push({
                open: map.fromTime,
                close: map.toTime,
                booked: false,
            });
        });
        return result;
    }

    // Helper function to parse a profile availability string into a map of day,
    // location, fromTime, and toTime values.
    static parseAvailabilityString(string, openingDialog) {
        // NOTE: The string is displayed in the textField as such:
        // 'Friday at the Gunn Library from 11:00 AM to 12:00 PM'

        if (string.indexOf('at the') < 0 && string !== '') {
            return Utils.parseAvailabilityString(string.replace('at', 'at the'));
        }

        // First check if this is a valid string. If it isn't we want to throw
        // an error so nothing else happens.
        if (string.indexOf('at the') < 0 ||
            string.indexOf('from') < 0 ||
            string.indexOf('to') < 0) {
            if (openingDialog) {
                return {
                    day: '',
                    location: '',
                    fromTime: '',
                    toTime: '',
                };
            }
            window.app.snackbar.view('Invalid availability. Please click on ' +
                'the input to re-select your availability.');
            throw new Error('Invalid availabilityString:', string);
        }

        // Helper function to return the string between the two others within an
        // array of strings
        function getStringBetween(splitString, startString, endString) {
            // We know that 'Friday at the' and 'from 11:00 AM' will always be the
            // same.
            const startIndex = splitString.indexOf(startString);
            const endIndex = splitString.indexOf(endString);
            var result = "";
            for (var i = startIndex + 1; i < endIndex; i++) {
                result += splitString[i] + ' ';
            }
            return result.trim();
        };

        // Same as above but without an endString (returns from startString
        // until the end)
        function getStringUntilEnd(splitString, startString) {
            const startIndex = splitString.indexOf(startString);
            var result = "";
            for (var i = startIndex + 1; i < splitString.length; i++) {
                result += splitString[i] + ' ';
            }
            return result.trim();
        };

        const split = string.split(' ');
        const day = split[0].substring(0, split[0].length - 1);
        const location = getStringBetween(split, 'the', 'from');
        const fromTime = getStringBetween(split, 'from', 'to');
        const toTime = getStringUntilEnd(split, 'to').replace('.', '');

        return {
            day: day,
            location: location,
            fromTime: fromTime,
            toTime: toTime,
            time: fromTime !== toTime ? fromTime + ' to ' + toTime : fromTime,
        };
    }

    // Helper function to return an array of timeStrings (e.g. '11:00 AM') for every
    // 30 min between the startTime and endTime. (Or for every period in that day's
    // schedule if the startTime and endTime are given as periods.)
    // TODO: Make sure to sync w/ the Gunn App to be able to have an up to date
    // daily period/schedule data.
    getTimesBetween(start, end, day) {
        var times = [];
        // First check if the time is a period
        if (this.data.periods[day].indexOf(start) >= 0) {
            // Check the day given and return the times between those two
            // periods on that given day.
            var periods = Data.gunnSchedule[day];
            for (
                var i = periods.indexOf(start); i <= periods.indexOf(end); i++
            ) {
                times.push(periods[i]);
            }
        } else {
            var timeStrings = this.data.timeStrings;
            // Otherwise, grab every 30 min interval from the start and the end
            // time.
            for (
                var i = timeStrings.indexOf(start); i <= timeStrings.indexOf(end); i += 30
            ) {
                times.push(timeStrings[i]);
            }
        }
        return times;
    }

    // Helper function that returns the duration (in hrs:min:sec) between two
    // timeStrings
    getDurationFromStrings(startString, endString) {
        // TODO: Right now, we just support getting times from actual time strings
        // not periods. To implement getting hours from periods, we need to
        // know exactly the day that the startString and endString took place
        // and the schedule for that day.
        var duration = '';
        var hours = this.getHoursFromStrings(startString, endString);
        duration += hours.split('.')[0];
        // NOTE: We multiply by 6 and not 60 b/c we already got rid of that
        // decimal when we split it (i.e. 0.5 becomes just 5)
        var minutes = Number(hours.split('.')[1]) * 6;
        duration += ':' + minutes;
        return duration;
    }

    // Helper function that returns the hours between two timeStrings
    getHoursFromStrings(startString, endString) {
        var times = this.data.timeStrings;
        var minutes = Math.abs(times.indexOf(endString) - times.indexOf(startString));
        return minutes / 60 + '';
    }

    // Helper function to return all of a user's possible days based on their
    // availability map.
    static getLocationDays(availability) {
        // NOTE: Location availability is stored in the Firestore database as:
        // availability: {
        //     Friday: [
        //       { open: '10:00 AM', close: '3:00 PM' },
        //       { open: '10:00 AM', close: '3:00 PM' },
        //     ],
        //   }
        //   ...
        // };
        var days = [];
        Object.entries(availability).forEach((time) => {
            var day = time[0];
            days.push(day);
        });
        return days;
    }

    getLocationTimeWindowsByDay(day, hours) {
        const times = [];
        hours[day].forEach((time) => {
            times.push(time);
        });
        return times;
    }

    // Helper function to return a list of all a location's times for a given
    // day.
    getLocationTimesByDay(day, hours) {
        // NOTE: Location availability is stored in the Firestore database as:
        // availability: {
        //     Friday: [
        //       { open: '10:00 AM', close: '3:00 PM' },
        //       { open: '10:00 AM', close: '3:00 PM' },
        //     ],
        //   }
        //   ...
        // };
        var times = [];
        hours[day].forEach((time) => {
            times.push(time);
        });

        // Now, we have an array of time maps (i.e. { open: '10:00 AM', close: 
        // '3:00 PM' })
        var result = [];
        times.forEach((timeMap) => {
            result = result.concat(
                this.getTimesBetween(timeMap.open, timeMap.close, day));
        });
        return result;
    }

    getLocationTimeWindows(availability) {
        const result = [];
        Object.entries(availability).forEach((time) => {
            var timeArray = time[1];
            var day = time[0];
            timeArray.forEach((time) => {
                result.push(Utils.combineMaps(time, {
                    day: day
                }));
            });
        });
        return result;
    }

    // Helper function to return all of a user's possible times based on their
    // availability map.
    getLocationTimes(availability) {
        // NOTE: Location availability is stored in the Firestore database as:
        // availability: {
        //     Friday: [
        //       { open: '10:00 AM', close: '3:00 PM' },
        //       { open: '10:00 AM', close: '3:00 PM' },
        //     ],
        //   }
        //   ...
        // };
        var result = [];
        Object.entries(availability).forEach((time) => {
            var timeArray = time[1];
            var day = time[0];
            timeArray.forEach((time) => {
                result.push(Utils.combineMaps(time, {
                    day: day
                }));
            });
        });

        // Now, we have an array of time maps (i.e. { open: '10:00 AM', close: 
        // '3:00 PM' })
        var times = [];
        result.forEach((timeMap) => {
            times = times.concat(
                this.getTimesBetween(timeMap.open, timeMap.close, timeMap.day));
        });
        return times;
    }

    // Helper function to return all of a user's possible locations based on their
    // availability map.
    static getUserAvailableLocations(availability) {
        // NOTE: Availability is stored in the Firestore database as:
        // availability: {
        //   Gunn Library: {
        //     Friday: [
        //       { open: '10:00 AM', close: '3:00 PM' },
        //       { open: '10:00 AM', close: '3:00 PM' },
        //     ],
        //   }
        //   ...
        // };
        var locations = [];
        Object.entries(availability).forEach((entry) => {
            locations.push(entry[0]);
        });
        return locations;
    }

    // Helper function to return a user's available days for a given location
    static getUserAvailableDaysForLocation(availability, location) {
        // NOTE: Availability is stored in the Firestore database as:
        // availability: {
        //   Gunn Library: {
        //     Friday: [
        //       { open: '10:00 AM', close: '3:00 PM' },
        //       { open: '10:00 AM', close: '3:00 PM' },
        //     ],
        //   }
        //   ...
        // };
        try {
            var days = [];
            Object.entries(availability[location]).forEach((entry) => {
                var day = entry[0];
                var times = entry[1];
                days.push(day);
            });
            return days;
        } catch (e) {
            // This is most likely b/c the user's profile's location we deleted
            // or changed somehow
            console.warn('Error while getting userAvailableDaysForLocation (' +
                location + '):', e);
            Utils.viewNoAvailabilityDialog(location);
        }
    }

    getUserAvailableTimeslots(availability) {
        var times = [];
        for (var locationHours of Object.values(availability)) {
            for (var timeslots of Object.values(locationHours)) {
                times = times.concat(timeslots.map(timeslot => timeslot.open ===
                    timeslot.close ? timeslot.open : timeslot.open + ' to ' +
                    timeslot.close));
            }
        }
        return times.filter(Boolean);
    }

    getUserAvailableTimeslotsForDay(availability, day, location) {
        for (var entry of Object.entries(availability[location])) {
            var d = entry[0];
            var times = entry[1].map(timeslot => timeslot.open ===
                timeslot.close ? timeslot.open : timeslot.open + ' to ' +
                timeslot.close);
            if (d === day) return times.filter(Boolean);
        }
        return this.getUserAvailableTimeslots(availability);
    }

    // Helper function to return a user's available times for a given day and 
    // location
    getUserAvailableTimesForDay(availability, day, location) {
        // NOTE: Availability is stored in the Firestore database as:
        // availability: {
        //   Gunn Library: {
        //     Friday: [
        //       { open: '10:00 AM', close: '3:00 PM' },
        //       { open: '10:00 AM', close: '3:00 PM' },
        //     ],
        //   }
        //   ...
        // };
        try {
            var times = [];
            Object.entries(availability[location]).forEach((entry) => {
                var d = entry[0];
                var t = entry[1];
                if (d === day) times = t;
            });

            var result = [];
            times.forEach((time) => {
                result = result.concat(this.getTimesBetween(time.open, time
                    .close, day));
            });
            return result;
        } catch (e) {
            // This is most likely b/c the user's profile's location we deleted
            // or changed somehow
            console.warn('Error while getting userAvailableTimesForDay (' +
                day + 's at the ' + location + '):', e);
            Utils.viewNoAvailabilityDialog(location);
        }
    }

    static viewNoAvailabilityDialog(location) {
        new window.app.NotificationDialog('No Availability', 'This user or ' +
            'location does not have any availability. The ' + location +
            ' may no longer be open at these times or this user may no longer' +
            ' be available. Ask the user and location to update their ' +
            'availability or cancel this request and create a new one.',
            () => {}).view();
    }

    // Helper function to return all of a user's possible days based on their
    // availability map.
    static getUserAvailableDays(availability) {
        // NOTE: Availability is stored in the Firestore database as:
        // availability: {
        //   Gunn Library: {
        //     Friday: [
        //       { open: '10:00 AM', close: '3:00 PM' },
        //       { open: '10:00 AM', close: '3:00 PM' },
        //     ],
        //   }
        //   ...
        // };
        var days = [];
        Object.entries(availability).forEach((entry) => {
            var times = entry[1];
            Object.entries(times).forEach((time) => {
                var day = time[0];
                days.push(day);
            });
        });
        return days;
    }

    // Helper function to return all of a user's possible times based on their
    // availability map.
    getUserAvailableTimes(availability) {
        // NOTE: Availability is stored in the Firestore database as:
        // availability: {
        //   Gunn Library: {
        //     Friday: [
        //       { open: '10:00 AM', close: '3:00 PM' },
        //       { open: '10:00 AM', close: '3:00 PM' },
        //     ],
        //   }
        //   ...
        // };
        var that = this;
        var result = [];
        Object.entries(availability).forEach((entry) => {
            var location = entry[0];
            var times = entry[1];
            Object.entries(times).forEach((time) => {
                var timeArray = time[1];
                var day = time[0];
                timeArray.forEach((time) => {
                    result.push(Utils.combineMaps(time, {
                        day: day
                    }));
                });
            });
        });

        // Now, we have an array of time maps (i.e. { open: '10:00 AM', close: '3:00 PM' })
        var times = [];
        result.forEach((timeMap) => {
            times = times.concat(this.getTimesBetween(timeMap.open, timeMap.close, timeMap.day));
        });
        return times;
    }

    static combineMaps(mapA, mapB) {
        // NOTE: This function gives priority to mapB over mapA
        const result = {};
        for (var i in mapA) {
            result[i] = mapA[i];
        }
        for (var i in mapB) {
            result[i] = mapB[i];
        }
        return result;
    }

    static combineAvailability(availA, availB) {
        const concatTimeslots = (slotsA, slotsB) => {
            slotsA.forEach(slot => {
                if (slotsB.findIndex(t => t.open === slot.open && t.close ===
                        slot.close) < 0) slotsB.push(slot);
            });
            return slotsB;
        };
        const combined = {};
        for (var l in availA) { // Location
            if (!combined[l]) combined[l] = {};
            for (var d in availA[l]) { // Day
                if (!combined[l][d]) combined[l][d] = []; // Timeslots
                combined[l][d] = concatTimeslots(combined[l][d], availA[l][d]);
            }
        }
        for (var l in availB) { // Location
            if (!combined[l]) combined[l] = {};
            for (var d in availB[l]) { // Day
                if (!combined[l][d]) combined[l][d] = []; // Timeslots
                combined[l][d] = concatTimeslots(combined[l][d], availB[l][d]);
            }
        }
        return combined;
    }

    static getAvailabilityString(data) {
        if (Data.locations.indexOf(data.location) >= 0) {
            return data.day + 's at the ' + data.location + ' from ' +
                data.fromTime + ' to ' + data.toTime;
        }
        return data.day + 's at ' + data.location + ' from ' + data.fromTime +
            ' to ' + data.toTime;
    }

    static parseHourStrings(strings) {
        // @param [
        //   'Fridays from 10:00 AM to 3:00 PM',
        //   'Fridays from 10:00 AM to 3:00 PM',
        //   'Tuesdays from 10:00 AM to 3:00 PM',
        // ]
        // @return hours: {
        //   Friday: [
        //     { open: '10:00 AM', close: '3:00 PM' },
        //     { open: '10:00 AM', close: '3:00 PM' },
        //   ],
        //   Tuesday: [
        //     { open: '10:00 AM', close: '3:00 PM' },
        //   ],
        // }
        const timeslots = strings.map(str => Utils.parseHourString(str));
        const hours = {};
        timeslots.forEach(timeslot => {
            if (!hours[timeslot.day]) hours[timeslot.day] = [];
            if (hours[timeslot.day].findIndex(t => t.open === timeslot.open &&
                    t.close === timeslot.close) < 0) hours[timeslot.day].push({
                open: timeslot.open,
                close: timeslot.close,
            });
        });
        return hours;
    }

    static parseHourString(string) {
        // @param 'Fridays from 10:00 AM to 3:00 PM'
        // @return {
        //   day: 'Friday',
        //   open: '10:00 AM',
        //   close: '3:00 PM',
        // }
        try {
            const split = string.split(' ');
            return {
                day: split[0].slice(0, -1) || '',
                open: split[2] && split[3] ? split[2] + ' ' + split[3] : '',
                close: split[5] && split[6] ? split[5] + ' ' + split[6] : '',
            };
        } catch (e) {
            console.warn('[WARNING] Could not parse hour string:', string);
            return {
                day: '',
                open: '',
                close: '',
            };
        }
    }

    static getHourString(hour) {
        return hour.day + 's from ' + hour.open + ' to ' + hour.close;
    }

    static getHourStrings(hours = {}) {
        // @param hours: {
        //   Friday: [
        //     { open: '10:00 AM', close: '3:00 PM' },
        //     { open: '10:00 AM', close: '3:00 PM' },
        //   ],
        //   Tuesday: [
        //     { open: '10:00 AM', close: '3:00 PM' },
        //   ],
        // }
        // @return [
        //   'Fridays from 10:00 AM to 3:00 PM',
        //   'Fridays from 10:00 AM to 3:00 PM',
        //   'Tuesdays from 10:00 AM to 3:00 PM',
        // ]
        const strings = [];
        Object.entries(hours).forEach(([day, times]) => times.forEach(t =>
            strings.push(day + 's from ' + t.open + ' to ' + t.close)));
        return strings;
    }

    static getAvailabilityStrings(availability = {}) {
        // NOTE: User availability is stored in the Firestore database as:
        // availability: {
        // 	Gunn Academic Center: {
        //     Friday: [
        //       { open: '10:00 AM', close: '3:00 PM' },
        //       { open: '10:00 AM', close: '3:00 PM' },
        //     ],
        //   },
        //   Paly Tutoring Center: {
        //   ...
        //   },
        // };
        const availableTimes = [];
        Object.entries(availability).forEach((entry) => {
            var location = entry[0];
            var times = entry[1];
            Object.entries(times).forEach((time) => {
                var day = time[0];
                var openAndCloseTimes = time[1];
                openAndCloseTimes.forEach((openAndCloseTime) => {
                    availableTimes.push(Utils.getAvailabilityString({
                        day: day,
                        location: location,
                        fromTime: openAndCloseTime.open,
                        toTime: openAndCloseTime.close,
                    }) + '.');
                });
            })
        });

        // Next, sort the strings by day
        const result = [];
        const temp = {};
        availableTimes.forEach((time) => {
            var day = time.split(' ')[0];
            try {
                temp[day].push(time);
            } catch (e) {
                temp[day] = [time];
            }
        });
        [
            'Mondays',
            'Tuesdays',
            'Wednesdays',
            'Thursdays',
            'Fridays',
            'Saturdays',
            'Sundays',
        ].forEach((day) => {
            Object.entries(temp).forEach((entry) => {
                if (entry[0] === day) {
                    entry[1].forEach((time) => {
                        result.push(time);
                    });
                }
            });
        });
        return result;
    }

    static clone(val) {
        return val instanceof Array ? Utils.cloneArr(val) :
            val instanceof firebase.firestore.Timestamp ? val.toDate() :
            val instanceof Date ? new Date(val) :
            val instanceof Object ? Utils.cloneMap(val) : val;
    }

    static cloneArr(arr) {
        return arr.map(i => Utils.clone(i));
    }

    static cloneMap(map) {
        const clone = {};
        for (var i in map) {
            clone[i] = Utils.clone(map[i]);
        }
        return clone;
    }

    static getPronoun(gender) {
        switch (gender) {
            case 'Male':
                return 'his';
            case 'Female':
                return 'her';
            case 'Other':
                return 'their';
            default:
                return 'their';
        };
    }

    static replaceElement(parent, content) {
        parent.innerHTML = '';
        parent.append(content);
    }

    // Helper function that takes in a map and returns only those values that
    // correspond with location data.
    static filterLocationData(data) {
        const hrsConfig = {
            'threshold': Data.thresholds[0],
            'rounding': Data.roundings[0],
            'timeThreshold': Data.timeThresholds[0],
        };
        return {
            'name': data.name,
            'city': data.city,
            'hours': Utils.cloneMap(data.hours),
            'config': {
                'hrs': data.config ? Utils.cloneMap(data.config.hrs ||
                    hrsConfig) : hrsConfig,
            },
            'description': data.description,
            'supervisors': data.supervisors,
            'timestamp': data.timestamp,
        };
    }

    // Helper function that takes in a map and returns only those values that
    // correspond with the location data that is editable by request dialogs.
    static filterLocationInputData(data) {
        return {
            'name': data.name,
            'city': data.city,
            'hours': data.hours,
            'description': data.description,
            'supervisors': data.supervisors,
        };
    }

    // Helper function that takes in a map and returns only those values that
    // correspond with the request data that is editable by request dialogs.
    static filterRequestInputData(data) {
        return {
            'subject': data.subject,
            'time': data.time,
            'message': data.message,
            'location': data.location,
        };
    }

    // Helper function that takes in a map and returns only those valuse that
    // correspond with appt data.
    static filterPastApptData(data) {
        return {
            attendees: data.attendees,
            for: this.filterRequestData(data.for),
            time: {
                day: data.time.day,
                from: data.time.from,
                to: data.time.to,
                clocked: data.time.clocked,
            },
            clockIn: data.clockIn,
            clockOut: data.clockOut,
            location: data.location,
            timestamp: data.timestamp,
            id: data.id || '', // NOTE: We use this to be able to access and update the
            // Firestore document across different functions within the app all
            // using the same `this.currentRequest` map.
        };
    }

    // Helper function that takes in a map and returns only those valuse that
    // correspond with appt data.
    static filterApptData(data) {
        return {
            attendees: data.attendees,
            for: this.filterRequestData(data.for),
            time: {
                day: data.time.day,
                from: data.time.from,
                to: data.time.to,
                clocked: data.time.clocked || '0:0:0.00',
            },
            location: data.location,
            timestamp: data.timestamp,
            id: data.id || '', // NOTE: We use this to be able to access and 
            // update the Firestore document across different functions within 
            // the app all using the same `this.currentRequest` map.
        };
    }

    static filterMessageData(data) {
        return {
            message: data.message,
            sentBy: Utils.filterRequestUserData(data.sentBy),
            timestamp: data.timestamp,
        };
    }

    static filterChatData(data) {
        return {
            chatters: data.chatters,
            chatterEmails: data.chatterEmails,
            chatterUIDs: data.chatterUIDs,
            lastMessage: Utils.filterMessageData(data.lastMessage),
            createdBy: Utils.filterRequestUserData(data.createdBy),
            name: data.name || '', // We use the chatter name as the chat name
            photo: data.photo || '', // Use the chatter photo as the chat photo
            location: data.location || window.app.location,
        };
    }

    // Helper function that takes in a map and returns only those values that
    // correspond with activeAppt data.
    static filterActiveApptData(data) {
        return {
            attendees: data.attendees,
            for: this.filterRequestData(data.for),
            time: {
                day: data.time.day,
                from: data.time.from,
                to: data.time.to,
                clocked: data.time.clocked || '0:0:0.00',
            },
            location: data.location,
            timestamp: data.timestamp,
            // activeAppt only data
            clockIn: {
                sentBy: data.clockIn.sentBy,
                sentTimestamp: data.clockIn.sentTimestamp,
                approvedBy: data.clockIn.approvedBy,
                approvedTimestamp: data.clockIn.approvedTimestamp,
            },
            supervisor: data.supervisor,
            id: data.id || '', // NOTE: We use this to be able to access and update the
            // Firestore document across different functions within the app all
            // using the same `this.currentRequest` map.
        };
    }

    // Helper function that takes in a map and returns only those values that
    // correspond with pastAppt data (this is also how my Firebase Functions will be
    // able to process payments, etc).
    static filterPastApptData(data) {
        return {
            attendees: data.attendees,
            for: this.filterRequestData(data.for),
            time: {
                day: data.time.day,
                from: data.time.from,
                to: data.time.to,
                clocked: data.time.clocked || '0:0:0.00',
            },
            location: data.location,
            timestamp: data.timestamp,
            // activeAppt only data
            clockIn: {
                sentBy: data.clockIn.sentBy,
                sentTimestamp: data.clockIn.sentTimestamp,
                approvedBy: data.clockIn.approvedBy,
                approvedTimestamp: data.clockIn.approvedTimestamp,
            },
            supervisor: {
                name: data.supervisor.name,
                email: data.supervisor.email,
                phone: data.supervisor.phone,
            },
            // pastAppt only data
            clockOut: {
                sentBy: data.clockIn.sentBy,
                sentTimestamp: data.clockIn.sentTimestamp,
                approvedBy: data.clockIn.approvedBy,
                approvedTimestamp: data.clockIn.approvedTimestamp,
            },
            duration: data.duration,
            payment: data.payment, // TODO: Implement a payment method system
            // that can detect when an appt occurred and select the correct
            // payment method(s) b/c of the timestamp(s).
            id: data.id || '', // NOTE: We use this to be able to access and update the
            // Firestore document across different functions within the app all
            // using the same `this.currentRequest` map.
        };
    }

    // Helper function that takes in a map and returns only those values that
    // correspond with request data.
    static filterRequestData(data) {
        return {
            'subject': data.subject,
            'time': data.time,
            'message': data.message,
            'location': data.location,
            'fromUser': Utils.filterRequestUserData(data.fromUser),
            'toUser': Utils.filterRequestUserData(data.toUser),
            'timestamp': data.timestamp,
            'payment': data.payment || {
                amount: 0,
                type: 'Free',
                method: 'PayPal',
            },
            'id': data.id || '', // NOTE: We use this to be able to access and update the
            // Firestore document across different functions within the app all
            // using the same `this.currentRequest` map.
        };
    }

    // Helper function that filters a user profile to only the fields that we care
    // about in the context of an appt
    static filterApptUserData(user) {
        return {
            name: user.name,
            email: user.email,
            phone: user.phone,
            uid: user.uid,
            id: user.id,
            photo: user.photo,
            type: user.type,
        };
    }

    // Helper function that filters a user profile to only the fields that we care
    // about in the context of a request
    static filterRequestUserData(user) {
        return { // Needed info to properly render various user headers
            name: user.name,
            email: user.email,
            uid: user.uid,
            id: user.id,
            photo: user.photo,
            type: user.type,
            grade: user.grade,
            gender: user.gender, // We need this to render gender pronouns correctly
            hourlyCharge: (!!user.payments) ? user.payments.hourlyCharge : 0,
            payments: user.payments,
            proxy: user.proxy,
        };
    }

};

module.exports = Utils;