import {
    MDCRipple
} from '@material/ripple/index';
import {
    MDCDialog
} from '@material/dialog/index';
import {
    MDCTextField
} from '@material/textfield/index';

import $ from 'jquery';

const Utils = require('@tutorbook/utils');

// Class that handles new logins and user sign ups
class Login {

    constructor() {
        app.user = {};
        this.render = window.app.render;
        this.renderSelf();
    }

    // Helper function to sign the user out
    static signOut() {
        firebase.auth().signOut();
        location = '/';
    };

    view() {
        window.app.view(this.header, this.main, '/app/login');
        this.manage();
    };

    renderSelf() {
        this.header = this.render.template('wrapper');
        this.main = this.render.template('login', {
            login: () => {
                Utils.url('/app/home'); // Don't redirect back to login page
                Login.viewGoogleSignIn();
            },
            signup: () => {
                displaySection('page-signup');
                window.app.user.cards = {};
            },
            expand: () => {
                // TODO: Add animations to scroll these els in and out
                this.main.querySelector('#expand-button').style.display = 'none';
                this.main.querySelector('#expand').style.display = 'inherit';
            },
            collapse: () => {
                this.main.querySelector('#expand').style.display = 'none';
                // NOTE: Settings display to inline-block centers the button el
                this.main.querySelector('#expand-button').style.display = 'inline-block';
            },
            pupil: () => {
                // Show setup cards in the dashboard for:
                // 1) Their profile (i.e. subjects, availability, locations)
                // 2) Linking Google Calendar or iCal to their account
                // 3) Setting up their first payment method
                // We want them to set availability so that tutors can edit their
                // requests as needed.
                Utils.url('/app/home?cards=searchTutors+setupNotifications+' +
                    'setupAvailability?auth=true?type=Pupil');
                Login.viewGoogleSignIn();
            },
            paidTutor: () => {
                Utils.url('/app/home?cards=setupProfile+setupNotifications?' +
                    'payments=true?auth=true?type=Tutor');
                Login.viewGoogleSignIn();
            },
            tutor: () => {
                // Show setup cards in the dashboard for:
                // 1) Their profile (i.e. subjects, availability, locations)
                // 2) Linking Google Calendar or iCal to their account
                // 3) Setting up their first deposit/payment method
                Utils.url('/app/home?cards=setupProfile+setupNotifications?' +
                    'auth=true?type=Tutor');
                Login.viewGoogleSignIn();
            },
            parent: () => {
                // Show setup cards in the dashboard for:
                // 1) Creating children accounts
                // 2) Searching for a tutor
                // 3) Enabling notifications (i.e. adding phone #, etc.)
                Utils.url('/app/home?cards=searchTutors+setupNotifications+' +
                    'setupAvailability?auth=true?type=Parent');
                Login.viewGoogleSignIn();
                /* TODO: Right now, we just show the pupil cards.
                 *Utils.url('/app/home?cards=searchTutors+addChildren+setupNotifications?auth=true?type=Parent');
                 *Login.viewGoogleSignIn();
                 */
            },
            supervisor: () => {
                // Show setup cards in the dashboard for:
                // 1) Their profile (i.e. subjects, availability, locations)
                // 2) Linking Google Calendar or iCal to their account
                // 3) Setting up their first location or applying to be a supervisor
                // for an existing location
                Utils.url('/app/home?cards=setupNotifications?auth=false?' +
                    'type=Supervisor');
                Login.viewGoogleSignIn();
            },
        });
        const pages = this.main.querySelectorAll('.page');

        function displaySection(id) {
            pages.forEach(function(sel) {
                if (sel.id === id) {
                    sel.style.display = 'inherit';
                } else {
                    sel.style.display = 'none';
                }
            });
        };
        displaySection('page-login');
    }

    manage() {
        $(this.main).find('.mdc-button').each(function() {
            MDCRipple.attachTo(this);
        });
        $(this.main).find('.mdc-icon-button').each(function() {
            MDCRipple.attachTo(this).unbounded = true;
        });
    }

    static viewGoogleSignIn() {
        const provider = new firebase.auth.GoogleAuthProvider();
        return firebase.auth().signInWithRedirect(provider).catch((error) => {
            var errorCode = error.code;
            var errorMessage = error.message;
            var email = error.email;
            window.app.snackbar.view('Could not open Google login. Reload ' +
                'this page and try again.');
            console.error('[ERROR] While signing in with Google Popup:', error);
        });
    }

    static getSupervisorCodes() {
        return window.app.db.collection('auth').doc('supervisors')
            .get().catch((err) => {
                console.error('[ERROR] While getting supervisor codes:', err);
                window.app.snackbar.view('Could not fetch verification codes.');
            });
    }

    static async codeSignIn() {
        // First, we check if they have a valid supervisor code.
        const codes = (await Login.getSupervisorCodes()).data();
        const dialogEl = window.app.render.template('dialog-code-signup');
        const dialog = MDCDialog.attachTo(dialogEl);

        const codeEl = dialogEl.querySelector('#code-input');
        const codeTextField = MDCTextField.attachTo(codeEl);

        $(dialogEl).find('#description').text('To ensure that you are ' +
            'an authenticated ' + window.app.user.type.toLowerCase() + ', ' +
            'please enter the verification code that you were assigned after ' +
            'your application was processed.');

        dialog.autoStackButtons = false;
        dialog.scrimClickAction = '';
        dialog.escapeKeyAction = '';
        $('body').prepend(dialogEl);
        dialog.open();

        // Then, we check if the email that they're trying to sign into is
        // associated with that code.
        const confirmButton = dialogEl.querySelector('#confirm-button');
        confirmButton.addEventListener('click', () => {
            try {
                if (codes[firebase.auth().currentUser.uid] ===
                    codeTextField.value) {
                    dialog.close();
                    window.app.user.authenticated = true;
                    window.app.updateUser();
                    window.app.snackbar.view('Code authenticated. ' +
                        'Successfully created ' + window.app.user.type
                        .toLowerCase() + ' account.');
                    window.app.init();
                    window.app.loader(false);
                    window.app.nav.start();
                } else {
                    window.app.snackbar.view('Invalid code. Please try again.');
                    codeTextField.valid = false;
                    codeTextField.required = true;
                }
            } catch (e) {
                codeTextField.valid = false;
                codeTextField.required = true;
            }
        });

        dialog.listen('MDCDialog:closing', (event) => {
            if (event.detail.action === 'close') {
                firebase.auth().signOut();
                window.app.snackbar.view('Could not verify account. Logged ' +
                    'out.');
            }
            $(dialogEl).remove();
        });
    }

};

module.exports = Login;