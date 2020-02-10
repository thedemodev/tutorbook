const admin = require('firebase-admin');
const firestore = admin.firestore();
const partitions = {
    default: firestore.collection('partitions').doc('default'),
    test: firestore.collection('partitions').doc('test'),
};
const cors = require('cors')({
    origin: true,
});

const Email = require('email');
const SMS = require('sms');
const Webpush = require('webpush');
const Utils = require('utils');

// helper - returns whether or not request was from test partition
const getTest = (context) => context.params.partition === 'test';

// helper - returns partition based on context.partition
const getDB = (context) => {
    if (context.params.partition === 'test') return partitions.test;
    return partitions.default;
};

// helper - returns the proper gender pronoun
const getPronoun = (gender) => {
    switch (gender) {
        case 'Male':
            return 'his';
        case 'Female':
            return 'her';
        default:
            return 'their';
    };
};

// helper - uppercases first letter of a given string
const upper = (str) => {
    return str.substring(0, 1).toUpperCase() + str.substring(1, str.length);
};

const day = () => {
    return [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
    ][new Date().getDay()];
};

// scheduled appt - calls the below apptNotification function every week as
// configured in each location's Firestore document
const dailyApptNotifications = async (context) => {
    const db = getDB(context);
    const today = day();
    const locations = (await db.collection('locations').get()).docs;
    return Promise.all(locations.map(async (doc) => {
        const config = doc.data().config;
        if (!config.dailyApptNotifications ||
            !config.dailyApptNotifications.email &&
            !config.dailyApptNotifications.sms) return;
        return axios({
            method: 'get',
            url: 'https://us-central1-tutorbook-779d8.cloudfunctions.net/appt' +
                'Notification',
            params: {
                token: functions.config().tests.key,
                location: doc.id,
                day: today,
                tutor: true,
                pupil: true,
                email: config.dailyApptNotifications.email || false,
                sms: config.dailyApptNotifications.sms || false,
            },
        });
    }));
};
const weeklyApptNotifications = async (context) => {
    const db = getDB(context);
    const today = day();
    const locations = (await db.collection('locations').get()).docs;
    return Promise.all(locations.map(async (doc) => {
        const config = doc.data().config;
        if (!config.weeklyApptNotifications ||
            !config.weeklyApptNotifications.email &&
            !config.weeklyApptNotifications.sms) return;
        return axios({
            method: 'get',
            url: 'https://us-central1-tutorbook-779d8.cloudfunctions.net/appt' +
                'Notification',
            params: {
                token: functions.config().tests.key,
                location: doc.id,
                day: today,
                tutor: true,
                pupil: true,
                email: config.dailyApptNotifications.email || false,
                sms: config.dailyApptNotifications.sms || false,
            },
        });
    }));
};

// appt - upcoming appt sms messages manually requested by supervisor
// params - {
//   tutor: Send a notification to the toUser?
//   pupil: Send a notification to the fromUser?
//   token: A valid Firebase Authentication token
//   location: The ID of the location (that the appointments are at)
//   day: The day of the appointments
// }
const apptNotification = (req, res) => {
    return cors(req, res, async () => {
        if (!req.query.tutor && !req.query.pupil) {
            res.send('[ERROR] Please specify who to send notifications to.');
            return console.warn('[WARNING] Request did not send any ' +
                'notifications.');
        }
        const db = req.query.test === 'true' ? partitions.test : partitions
            .default;
        const users = db.collection('users');
        const token = await admin.auth().verifyIdToken(req.query.token);
        if (!token.supervisor) {
            res.send('[ERROR] Invalid supervisor authentication token.');
            return console.warn('[WARNING] Request did not send a valid ' +
                'supervisor authentication token.');
        }
        // TODO: Pass uID as request param when not using actual token.
        const supervisor = (await users.doc(token.uid).get()).data();
        const tutors = [];
        const pupils = [];
        const appts = [];
        (await admin.firestore() // TODO: Split this query by partition
            .collectionGroup('appointments')
            .where('location.id', '==', req.query.location)
            .where('time.day', '==', upper(req.query.day)).get()
        ).forEach((doc) => {
            appts.push(doc.data());
        });
        await Promise.all((appts).map(async (appt) => {
            if (req.query.tutor === 'true' &&
                tutors.indexOf(appt.for.toUser.uid) < 0) {
                tutors.push(appt.for.toUser.uid);
                const tutor = (await users.doc(appt.for.toUser.uid).get())
                    .data();
                await new SMS(tutor, supervisor.name + ' wanted to ' +
                    'remind you that you have a tutoring session for ' +
                    appt.subject + ' in the ' + appt.location.name + ' on ' +
                    appt.time.day + ' at ' + appt.time.from + '. Log into ' +
                    'Tutorbook (https://tutorbook.app/app/) to edit, cancel, ' +
                    'or clock into this appointment.', req.query.test === 'true');
            }
            if (req.query.pupil === 'true' &&
                pupils.indexOf(appt.for.fromUser.uid) < 0) {
                pupils.push(appt.for.fromUser.uid);
                const pupil = (await users.doc(appt.for.fromUser.uid).get())
                    .data();
                await new SMS(pupil, supervisor.name + ' wanted to ' +
                    'remind you that you have a tutoring session for ' +
                    appt.subject + ' in the ' + appt.location.name + ' on ' +
                    appt.time.day + ' at ' + appt.time.from + '. Log into ' +
                    'Tutorbook (https://tutorbook.app/app/) to view, edit, or' +
                    ' cancel this appointment.', req.query.test === 'true');
            }
        }));
        return res.json({
            tutors: tutors,
            pupils: pupils,
            appts: appts,
        });
    });
};

// user - sms, email for new users (custom by user type)
const userNotification = async (snap, context) => {
    const profile = snap.data();
    if (!profile || !profile.name) return console.warn('[WARNING] Cannot send' +
        ' welcome notifications to users without names.');
    console.log('[DEBUG] Sending ' + profile.name + ' <' + profile.email +
        '> welcome notifications...');
    await new Email('welcome', profile);
    await new SMS(profile, 'Welcome to Tutorbook! This is how ' +
        'you\'ll receive SMS notifications. To turn them off, go to ' +
        'settings and toggle SMS notifications off.', getTest(context));
    console.log('[DEBUG] Sent ' + profile.name + ' <' + profile.email +
        '> welcome notifications.');
};

// announcements - sms, webpush for new announcement messages
const announcementNotification = async (snap, context) => {
    const db = getDB(context);
    const isTest = getTest(context);
    // 1) Get all users that match announcement group filters
    console.log('[DEBUG] Getting users that match announcement group ' +
        'filters...');
    const locRef = db.collection('locations').doc(context.params.location);
    const a = (await locRef
        .collection('announcements')
        .doc(context.params.announcement)
        .get()
    ).data();
    const users = await Utils.getFilteredUsers(a.filters, isTest);
    // 2) Add messages to supervisor's chats with those users
    console.log('[DEBUG] Sending messages to ' + users.length + ' users that ' +
        'matched announcement group filters...');
    const msg = snap.data();
    const loc = (await locRef.get()).data();
    const supervisorDMs = {};
    (await db
        .collection('chats')
        .where('chatterUIDs', 'array-contains', msg.sentBy.uid)
        .get()
    ).forEach(chat => {
        const c = chat.data();
        if (c.chatters.length !== 2) return console.warn('[WARNING] Skipping ' +
            'non-DM chat (' + chat.id + ') w/out exactly two chatters.');
        const other = c.chatters[0].uid !== msg.sentBy.uid ? c.chatters[0] : c
            .chatters[1];
        supervisorDMs[other.uid] = chat.ref;
    });
    console.log('[DEBUG] Got ' + Object.keys(supervisorDMs).length +
        ' existing DM chats with these users:', Object.keys(supervisorDMs));
    return Promise.all(users.map(async (user) => {
        if (!supervisorDMs[user.uid]) {
            const chat = {
                lastMessage: {
                    message: msg.message,
                    sentBy: msg.sentBy,
                    timestamp: msg.timestamp,
                },
                chatters: [
                    msg.sentBy,
                    Utils.filterRequestUserData(user),
                ],
                chatterUIDs: [
                    msg.sentBy.uid,
                    user.uid,
                ],
                chatterEmails: [
                    msg.sentBy.email,
                    user.email,
                ],
                location: {
                    id: locRef.id,
                    name: loc.name,
                },
                createdBy: msg.sentBy,
                name: '', // We just use the chatter name as the chat name
                photo: '', // We just use the chatter photo as the chat photo
            };
            supervisorDMs[user.uid] = db.collection('chats').doc();
            await supervisorDMs[user.uid].set(chat);
        } else {
            await supervisorDMs[user.uid].update({
                lastMessage: {
                    message: msg.message,
                    sentBy: msg.sentBy,
                    timestamp: msg.timestamp,
                },
            });
        }
        return supervisorDMs[user.uid].collection('messages').doc().set(msg);
    }));
};

// messages - sms, webpush for new messages
const messageNotification = async (snap, context) => {
    const db = getDB(context);
    const chat = await db.collection('chats')
        .doc(context.params.chat).get();
    return chat.data().chatterUIDs.forEach(async (uid) => {
        if (uid !== snap.data().sentBy.uid) {
            await new SMS((await db.collection('users')
                    .doc(uid).get()).data(),
                snap.data().sentBy.name.split(' ')[0] +
                ' says: ' + snap.data().message,
                getTest(context),
            );
            await new Webpush(
                uid,
                'Message from ' + snap.data().sentBy.name.split(' ')[0],
                snap.data().message, {
                    id: context.params.chat
                },
            );
        }
    });
};

// chats - sms, webpush for all other recipients to a new chat group
const chatNotification = (snap, context) => {
    const chat = snap.data();
    const body = chat.createdBy.name + ' wants to chat with you. Log ' +
        'into Tutorbook (https://tutorbook.app/app/messages) to respond ' +
        'to ' + getPronoun(chat.createdBy.gender) + ' messages.';
    const title = 'Chat with ' + chat.createdBy.name;
    // Send notification to all the other people on the chat
    return chat.chatters.forEach(async (chatter) => {
        if (chatter.uid !== chat.createdBy.uid) {
            await new SMS((await admin
                .firestore()
                .collection('users')
                .doc(chatter.uid)
                .get()
            ).data(), body, getTest(context));
            await new Webpush(chatter.uid, title, body);
        }
    });
};

// feedback - sms to me for new feedback
const feedbackNotification = async (snap, context) => {
    await new SMS({
            phone: '+16508612723',
            email: 'nc26459@pausd.us',
            id: 'nc26459@pausd.us',
            location: 'Test Location',
        }, 'Feedback from ' + snap.data().from.name + ': ' +
        snap.data().message, getTest(context));
};

// appts - email location rules to new 'tutor matches'
const rulesNotification = async (snap, context) => {
    const db = getDB(context);
    const appt = snap.data();
    const users = db.collection('users');
    const tutor = (await users
        .doc(appt.for.toUser.uid).get()).data();
    const pupil = (await users
        .doc(appt.for.fromUser.uid).get()).data();
    const supervisorId = (await db.collection('locations')
        .doc(context.params.location).get()).data().supervisors[0];
    const supervisor = (await users.doc(supervisorId).get()).data();
    [tutor, pupil, supervisor].forEach(async (user) => {
        await new Email('rules', user, {
            appt: appt,
            tutor: tutor,
            pupil: pupil,
            supervisor: supervisor,
        });
    });
};

// requestsIn - sms, webpush, email to tutor for new requests
const requestNotification = async (snap, context) => {
    const db = getDB(context);
    const request = snap.data();
    const user = await db.collection('users')
        .doc(context.params.user).get();
    const summary = request.fromUser.name + ' wants you as a ' +
        request.toUser.type.toLowerCase() + ' for ' + request.subject +
        '. Log into your Tutorbook dashboard (https://tutorbook.app/app)' +
        ' to approve or modify this request.';
    await new SMS(user.data(), summary, getTest(context));
    await new Email('request', user.data(), request);
    console.log('[DEBUG] Sent request notification to ' + user.data().name +
        ' <' + user.data().email + '> <' + user.data().phone + '>.');
};

// approvedRequestsOut - sms, webpush, email to pupil for approvedRequests
const approvedRequestNotification = async (snap, context) => {
    const db = getDB(context);
    const approvedBy = snap.data().approvedBy;
    const request = snap.data().for;
    const user = await db.collection('users')
        .doc(context.params.user).get();
    const summary = approvedBy.name + ' approved your lesson request. You' +
        ' now have tutoring appointments for ' + request.subject +
        ' with ' + request.toUser.name.split(' ')[0] + ' on ' +
        request.time.day + 's at the ' + request.location.name + ' from ' +
        request.time.from + ' until ' + request.time.to + '.';
    await new SMS(user.data(), summary, getTest(context));
    await new Email('appt', user.data(), snap.data());
    console.log('[DEBUG] Sent appt notification to ' + user.data().name + ' <' +
        user.data().email + '> <' + user.data().phone + '>.');
};

// pendingClockIns - sms, webpush to the recipient of a clockIn request
const clockIn = async (snap, context) => {
    console.warn('[WARNING] This notification function has not been ' +
        'implemented yet.');
};

// pendingClockOuts - sms, webpush to the recipient of a clockOut request
const clockOut = async (snap, context) => {
    console.warn('[WARNING] This notification function has not been ' +
        'implemented yet.');
};

// modifiedRequestsIn - sms, webpush to tutor when request is modified
const modifiedRequestIn = async (snap, context) => {
    console.warn('[WARNING] This notification function has not been ' +
        'implemented yet.');
};

// modifiedRequestsOut - sms, webpush to pupil when request is modified
const modifiedRequestOut = async (snap, context) => {
    console.warn('[WARNING] This notification function has not been ' +
        'implemented yet.');
};

// canceledRequestsIn - sms, webpush to tutor when request is canceled
const canceledRequestIn = async (snap, context) => {
    console.warn('[WARNING] This notification function has not been ' +
        'implemented yet.');
};

// rejectedRequestsOut - sms, webpush to pupil when request is rejected
const rejectedRequestOut = async (snap, context) => {
    console.warn('[WARNING] This notification function has not been ' +
        'implemented yet.');
};

// modifiedAppointments - sms, webpush, email to other attendee when appt is
// modified
const modifiedAppt = async (snap, context) => {
    console.warn('[WARNING] This notification function has not been ' +
        'implemented yet.');
};

// canceledAppointments - sms, webpush, email to other attendee when appt is
// canceled
const canceledAppt = async (snap, context) => {
    console.warn('[WARNING] This notification function has not been ' +
        'implemented yet.');
};


module.exports = {
    appt: apptNotification,
    rules: rulesNotification,
    user: userNotification,
    announcement: announcementNotification,
    message: messageNotification,
    chat: chatNotification,
    feedback: feedbackNotification,
    clockIn: clockIn,
    clockOut: clockOut,
    requestIn: requestNotification,
    modifiedIn: modifiedRequestIn,
    canceledIn: canceledRequestIn,
    approvedOut: approvedRequestNotification,
    rejectedOut: rejectedRequestOut,
    modifiedOut: modifiedRequestOut,
    modifiedAppt: modifiedAppt,
    canceledAppt: canceledAppt,
};