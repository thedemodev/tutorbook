const functions = require('firebase-functions');
const express = require('express');
const twilio = new require('twilio')(
    functions.config().twilio.id,
    functions.config().twilio.key,
);
const cors = require('cors')({
    origin: true,
});
const session = require('express-session')({
    secret: functions.config().twilio.webhook,
});
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const Message = require('message');
const getUser = require('utils').getUserFromPhone;

class SMS {

    constructor(recipient, message, isTest = false) {
        if (this.valid(recipient, message, isTest)) {
            this.recipient = recipient;
            this.message = message; // TODO: Alert sender if message fails
            this.send();
        }
    }

    valid(recipient, message, isTest) {
        if (recipient.location === 'Paly Peer Tutoring Center') return console
            .error('[ERROR] Cannot send SMS to ' + (location || recipient
                .location) + ' users.');
        if (!recipient || !recipient.phone) return console.error('[ERROR] ' +
            'Cannot send to undefined phone numbers.');
        if (!message) return console.warn('[WARNING] Skipped sending empty ' +
            'message.');
        if (isTest) return console.warn('[WARNING] Skipping test messages.');
        return true;
    }

    send() {
        return twilio.messages.create({
            body: this.message,
            from: functions.config().twilio.phone,
            to: this.recipient.phone,
        }).then((message) => console.log('Sent message (' + message.id +
            ') to ' + this.recipient.name + ' (' + this.recipient.phone + ').'));
        //new Message({ TODO: Create notification banners in in-app chat
        //message: this.message,
        //to: this.recipient,
        //})
    }

    static receive() {
        const app = express();
        app.use(cors);
        app.use(session);
        app.post('/', async (req, res) => {
            console.log('[DEBUG] Responding to request with phone (' +
                req.body.From + ') and body (' + req.body.Body + ')...');
            new SMS({
                    phone: '+16508612723',
                    name: 'Nicholas Chiang',
                }, 'SMS from ' + (await getUser(req.body.From)).name + ' (' +
                req.body.From + '): ' + req.body.Body);
            new Message({
                message: req.body.Body,
                from: (await getUser(req.body.From)),
            });
            const smsCount = req.session.counter || 0;
            if (smsCount > 0) return res.status(200).end();
            req.session.counter = smsCount + 1;
            const twiml = new MessagingResponse();
            twiml.message('Your message has been forwarded to your Tutorbook ' +
                'supervisor. He or she will get back to you as soon as ' +
                'possible.');
            return res.set({
                'Content-Type': 'text/xml',
            }).status(200).send(twiml.toString());
        });
        return app;
    }

    static fallback(req, res) {
        return cors(req, res, async () => {
            console.log('[DEBUG] Responding to request with phone (' +
                req.body.From + ') and body (' + req.body.Body + ')...');
            const twiml = new MessagingResponse();
            twiml.message('Sorry, it looks like we encountered an error and ' +
                'could not relay your message to your Tutorbook supervisor. ' +
                'Try messaging (650) 861-2723 to get this resolved.');
            return res.set({
                'Content-Type': 'text/xml',
            }).status(200).send(twiml.toString());
        });
    }
}

module.exports = SMS;