const functions = require('firebase-functions');
const client = require('algoliasearch')(
    functions.config().algolia.id,
    functions.config().algolia.key
);

class Algolia {
    static update(change, context, indexID, settings) {
        const index = client.initIndex(context.params.partition + '-' + indexID);
        if (!change.after.exists) return index.deleteObject(context.params.id);
        const object = change.after.data();
        object.objectID = context.params.id; // TODO: Do we want to the path?
        object.ref = change.after.ref.path;
        if (settings) index.setSettings(settings);
        return index.saveObject(object);
    }

    static user(change, context) {
        return Algolia.update(change, context, 'users', {
            attributesForFaceting: [
                'filterOnly(payments.type)',
                'filterOnly(location)',
            ],
        });
    }

    static appt(change, context) {
        return Algolia.update(change, context, 'appts', {
            attributesForFaceting: [
                'filterOnly(location.id)',
            ],
        });
    }

    static activeAppt(change, context) {
        return Algolia.update(change, context, 'activeAppts');
    }

    static pastAppt(change, context) {
        return Algolia.update(change, context, 'pastAppts');
    }

    static chat(change, context) {
        return Algolia.update(change, context, 'chats', {
            attributesForFaceting: [
                'filterOnly(location.id)',
                'filterOnly(chatterUIDs)',
            ],
        });
    }
};

module.exports = Algolia;