const Utils = require('utils');
const PDFDocument = require('pdfkit');
const PdfPrinter = require('pdfmake');
const cors = require('cors')({
    origin: true,
});
const styles = require('./styles.js');
const admin = require('firebase-admin');
const firestore = admin.firestore();
const partitions = {
    test: firestore.collection('partitions').doc('test'),
    default: firestore.collection('partitions').doc('default'),
};

const caps = (str) => {
    if (!str || typeof str !== 'string') return 'Unknown';
    if (str.substr(0, 4) === 'http') return str;
    return str[0].toUpperCase() + str.substr(1);
};

const parse = (key, val) => {
    switch (key) {
        case 'subjects':
            return (val.join(', ') || 'No subjects') + '.';
        case 'proxy':
            return (val.join(', ') || 'No proxies') + '.';
        case 'locations':
            return (val.join(', ') || 'No locations') + '.';
        case 'availability':
            return (Utils.getAvailabilityStrings(val).join(', ') || 'No ' +
                'availability') + '.';
        default:
            return 'Adding complex object-to-string conversion soon.';
    }
};

const enumerate = (ob, add, doc) => {
    Object.entries(ob).forEach(([key, val]) => {
        switch (typeof val) {
            case 'string':
                add(key + ': ', styles.bold, doc);
                add(val, styles.para, doc);
                break;
            case 'number':
                return doc
                add(key + ': ', styles.bold, doc);
                add(new String(val), styles.para, doc);
                break;
            case 'boolean':
                add(key + ': ', styles.bold, doc);
                add(val ? 'Yes' : 'No', styles.para, doc);
                break;
            case 'object':
                add(key + ': ', styles.bold, doc);
                add(parse(key, val), styles.para, doc);
                break;
            default:
                throw new Error('Unsupported field type: ' + typeof val);
        }
    });
};

const appts = async (ref, doc) => {
    const tutor = (appt) => (appt.attendees[0].type === 'Tutor') ? appt
        .attendees[0].name : appt.attendees[1].name;
    const pupil = (appt) => (appt.attendees[0].type === 'Pupil') ? appt
        .attendees[0].name : appt.attendees[1].name;
    const appts = (await ref.collection('appointments').get()).docs;
    if (appts.length === 0) return;
    add('Weekly Appointments', styles.h3, doc);
    appts.forEach((apptDoc) => {
        const appt = apptDoc.data();
        add(appt.time.day + 's - ' + appt.for.subject + ': ', styles.bold, doc);
        add('Weekly appointment between ' + tutor(appt) + ' (the tutor) and ' +
            pupil(appt) + ' (the pupil) at the ' + appt.location.name +
            ' from ' + appt.time.from + ' until ' + appt.time.to + '.',
            styles.para, doc);
    }); // TODO: Add pastAppointments as well (make limit configurable in req).
};

const add = (text, style, doc) => {
    if (style.font) doc.font(style.font);
    if (style.fontSize) doc.fontSize(style.fontSize);
    if (style.textTransform === 'capitalize') text = caps(text);
    if (style.textTransform === 'uppercase') text = text.toUpperCase();
    doc.text(text, style);
    if (style.padding && !style.continued) doc.y += style.padding;
};

/*
 *Export user data as a PDF.
 *@param {bool} tutors - Whether or not to include tutors data in PDF.
 *@param {bool} pupils - Whether or not to include pupils data in PDF.
 *@param {bool} test - Whether to use the test partition of our Firestore db.
 *@param {string} token - Valid supervisor auth token generated by Firebase.
 *@param {string} location - ID of location to export data for.
 *@returns {stream} pdf - Generated PDF piped as a stream into exp Response().
 */
const backupAsPDF = (req, res) => {
    return cors(req, res, async () => {
        const isTest = req.query.test === 'true';
        console.log('[INFO] Responding to ' + (isTest ? 'test' : 'live') +
            ' backup as PDF request for location (' + req.query.location +
            ')...');
        const token = await admin.auth().verifyIdToken(req.query.token);
        if (!token.supervisor) return res.status(400).send('[ERROR] Given ' +
            'authentication token lacks supervisor custom auth.');
        if (token.locations.indexOf(req.query.location) < 0) return res
            .status(400).send('[ERROR] Token\'s locations did not contain ' +
                'requested location.');
        const db = isTest ? partitions.test : partitions.default;
        const locations = (await db.collection('locations').get()).docs;
        if (locations.map(d => d.id).indexOf(req.query.location) < 0) return res
            .status(400).send('[ERROR] Requested location doesn\'t exist.');
        if (req.query.tutors !== 'true' && req.query.pupils !== 'true')
            return res.status(400).send('[ERROR] Skipping empty request.');
        const doc = new PDFDocument();
        const locationName = locations[locations
            .findIndex(d => d.id === req.query.location)].data().name;
        const types = req.query.tutors === 'true' &&
            req.query.pupils === 'true' ? ['Tutor', 'Pupil'] :
            req.query.tutors === 'true' ? ['Tutor'] : ['Pupil'];
        Object.values(styles).forEach((style) => {
            doc.registerFont(style.font, 'fonts/' + style.font + '.ttf');
        });
        doc.pipe(res);
        doc.image('img/text-logo-bg.png', 612 / 8, 792 / 3, {
            width: 612 * 3 / 4, // Center horz, 1/3 from top, and size 3/4 width
        });
        doc.y += (792 / 3) + styles.h1.padding;
        add(locationName.split(' ')[0] + ' Data Backup', styles.h1, doc);
        for (d of (await db
                .collection('users')
                .where('location', '==', locationName)
                .where('type', 'in', types)
                .orderBy('name')
                .get()
            ).docs) {
            var user = d.data();
            doc.addPage();
            add(user.name, styles.h2, doc);
            enumerate(user, add, doc);
            await appts(d.ref, doc);
        }
        doc.end();
    });
};

const addUserServiceHours = async (d, docDefinition, isTest) => {
    console.log('[DEBUG] Adding ' + d.data().name + ' (' + d.id + ')\'s ' +
        (isTest ? 'test' : 'live') + ' service hour data to PDF...');
    const db = isTest ? partitions.test : partitions.default;
    const appts = (await d.ref.collection('pastAppointments')
        .orderBy('clockIn.sentTimestamp').get()).docs;
    if (!appts.length) return console.warn('[WARNING] Did not fetch any ' +
        'pastAppts, skipping ' + d.data().name + ' (' + d.id + ')...');
    const table = {
        headerRows: 1,
        style: 'serviceHoursTable',
        widths: ['auto', 'auto', 'auto', '*', 'auto', 47, 'auto', 'auto', 47],
        body: [
            ['Date', 'Clock-in', 'Pupil name', 'Subject', 'Clock-out',
                'Duration', 'Initials', 'Verify', 'Total',
            ].map(t => {
                return {
                    text: t,
                    style: 'cellHeader',
                };
            }),
        ],
    };
    const pop = (arr) => {
        arr.pop();
        return arr;
    };
    const timezone = {
        timeZone: 'America/Los_Angeles',
    };
    var a, cIn, cInSplit, cOut, cOutSplit,
        supervisor, duration, runningTotal = '00:00:00';
    for (appt of appts) {
        a = appt.data();
        cIn = a.clockIn.sentTimestamp.toDate();
        cInSplit = cIn.toLocaleString('en-US', timezone).split(', ');
        cOut = a.clockOut.sentTimestamp.toDate();
        cOutSplit = cOut.toLocaleString('en-US', timezone).split(', ');
        supervisor = (await db.collection('users').doc(a.supervisor)
            .get()).data();
        duration = Utils.getDurationStringFromDates(cIn, cOut);
        runningTotal = Utils.addDurationStrings(runningTotal, duration);
        table.body.push([{
            text: pop(cInSplit[0].split('/')).join('/'),
            style: 'cell',
            noWrap: true,
        }, {
            text: pop(cInSplit[1].split(' ')[0].split(':')).join(':') + ' ' +
                cIn.toLocaleString('en-US', timezone).split(' ')[2],
            style: 'cell',
            noWrap: true,
        }, {
            text: a.for.fromUser.name,
            style: 'cell',
            noWrap: true,
        }, {
            text: a.for.subject,
            style: 'cell',
        }, {
            text: pop(cOutSplit[1].split(' ')[0].split(':')).join(':') + ' ' +
                cOut.toLocaleString('en-US', timezone).split(' ')[2],
            style: 'cell',
            noWrap: true,
        }, {
            text: duration,
            style: 'cell',
        }, {
            text: a.for.fromUser.name.split(' ').map(n => n[0]).join('.') + '.',
            style: 'cell',
            noWrap: true,
        }, {
            text: supervisor.name.split(' ').map(n => n[0]).join('.') + '.',
            style: 'cell',
            noWrap: true,
        }, {
            text: runningTotal,
            style: 'cell',
        }]);
    }
    const numOfSingleRowsPerHeaderPage = 23;
    const numOfSingleRowsPerPage = 25;
    const emptyCells = [];
    for (var i = 0; i < 9; i++) {
        emptyCells.push({
            text: '',
            style: 'emptyCell',
        });
    }
    if (appts.length <= numOfSingleRowsPerHeaderPage) {
        for (var count = 0; count < numOfSingleRowsPerHeaderPage -
            appts.length; count++) {
            table.body.push(emptyCells);
        }
    } else {
        for (var count = 0; count < numOfSingleRowsPerPage -
            (appts.length - numOfSingleRowsPerHeaderPage) %
            numOfSingleRowsPerPage; count++) {
            table.body.push(emptyCells);
        }
    }
    docDefinition.content.push({
        text: d.data().name + ' - Service Hours',
        style: 'header',
    }, {
        text: [
            'All of ' + d.data().name.split(' ')[0] + '\'s past appointments ' +
            'as recorded on the Tutorbook web app. Go to ',
            {
                text: 'tutorbook.app',
                bold: true,
            },
            ' to view, edit, or clock-in to any of these tutoring appointments.',
        ],
        style: 'subheader',
    }, {
        table: table,
    });
};

/*
 *Export service hours PDF for groups of or a certain user.
 *@param {string} uid - The Firebase user ID of who you want to export data for.
 *@param {string} location - Location ID to export user data from (ignored if a 
 *valid uid was given).
 *@param {bool} test - Whether to use the test partition of our Firestore db.
 *@param {string} token - Valid supervisor auth token generated by Firebase.
 *@return {stream} pdf - User service hours in PDF form piped to exp Response().
 */
const serviceHoursAsPDF = (req, res) => {
    return cors(req, res, async () => {
        const isTest = req.query.test === 'true';
        console.log('[INFO] Responding to ' + (isTest ? 'test' : 'live') +
            ' service hours as PDF request for location (' +
            req.query.location + ') and user ID (' + req.query.uid + ')...');
        const token = await admin.auth().verifyIdToken(req.query.token);
        if (!token.supervisor) return res.status(400).send('[ERROR] Given ' +
            'authentication token lacks supervisor custom auth.');
        const db = isTest ? partitions.test : partitions.default;
        const fonts = {
            Roboto: {
                normal: 'fonts/Roboto-Regular.ttf',
                bold: 'fonts/Roboto-Bold.ttf',
            },
            Poppins: {
                normal: 'fonts/Poppins-Regular.ttf',
                bolditalics: 'fonts/Poppins-SemiBold.ttf', // Workaround
                bold: 'fonts/Poppins-Bold.ttf',
            },
        };
        const printer = new PdfPrinter(fonts);
        const docDefinition = {
            info: {
                title: 'Tutorbook Service Hours Log',
                author: 'Tutorbook',
                subject: 'Community Service Hours Log',
                creator: 'Tutorbook',
                producer: 'Tutorbook',
                keywords: 'Tutorbook App, Peer Tutoring, Community Service',
            },
            content: [],
            styles: {
                header: {
                    font: 'Poppins',
                    fontSize: 18,
                    bold: true,
                    margin: [0, 0, 0, 4],
                },
                subheader: {
                    font: 'Poppins',
                    fontSize: 12,
                    margin: [0, 0, 0, 10],
                },
                emptyCell: {
                    font: 'Poppins',
                    margin: [0, 23.5, 0, 0],
                },
                cell: {
                    font: 'Poppins',
                    fontSize: 11,
                    margin: [0, 4, 0, 4],
                },
                cellHeader: {
                    font: 'Poppins',
                    fontSize: 10,
                    bold: true,
                    italics: true,
                    color: 'black',
                },
            },
            pageSize: 'LETTER',
            pageOrientation: 'portrait',
            pageMargins: [20, 25, 20, 25],
        };
        if (req.query.uid) {
            const user = await db.collection('users').doc(req.query.uid).get();
            if (!user.exists) return res.status(400).send('[ERROR] Requested ' +
                'user (' + req.query.uid + ') did not exist.');
            await addUserServiceHours(user, docDefinition, isTest);
        } else if (req.query.location) {
            if (token.locations.indexOf(req.query.location) < 0) return res
                .status(400).send('[ERROR] Token\'s locations did not contain' +
                    ' requested location.');
            const location = await db.collection('locations').doc(req.query
                .location).get();
            if (!location.exists) return res.status(400).send('[ERROR] ' +
                'Requested location doesn\'t exist.');
            const users = Utils.concatArr((await db.collection('users')
                .where('locations', 'array-contains', location.data().name)
                .where('type', '==', 'Tutor')
                .orderBy('name')
                .get()
            ).docs, (await db.collection('users')
                .where('location', '==', location.data().name)
                .where('type', '==', 'Tutor')
                .orderBy('name')
                .get()
            ).docs);
            await Promise.all(users.map(user => addUserServiceHours(user,
                docDefinition, isTest)));
        } else {
            return res.status(400).send('[ERROR] Request did not send a valid' +
                ' location ID or user ID to export service hours for.');
        }
        const doc = printer.createPdfKitDocument(docDefinition);
        doc.pipe(res);
        return doc.end();
    });
};

module.exports = {
    backup: backupAsPDF,
    hrs: serviceHoursAsPDF,
};