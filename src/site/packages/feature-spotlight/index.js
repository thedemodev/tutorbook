const $ = require('jquery');
const html = require('./index.html').toString();
const css = require('./index.scss').toString();

class FeatureSpotlight extends HTMLElement {
    constructor() {
        super();
        const color = this.getAttribute('color');
        const flipped = this.hasAttribute('flipped');
        const get = (id) => $(this).find('#' + id).text();
        const header = get('header');
        const subheader = get('subheader');
        const img = get('img');
        const vid = get('vid');
        const qoute = get('qoute');
        const qouteByName = get('qoute-by-name');
        const qouteByTitle = get('qoute-by-title');
        const qouteByLogo = get('qoute-by-logo');
        const ctaLabel = get('cta-label') || 'Learn more';
        this.innerText = this.innerHTML = '';
        const shadow = this.attachShadow({
            mode: 'open',
        });
        shadow.innerHTML = '<style>' + css + '</style>' + html
            .replace('{ CTA Label }', ctaLabel);
        $(shadow)
            .find('.feature-spotlight__heading').text(header).end()
            .find('.feature-spotlight__subheading').text(subheader).end()
            .find('.testimonial__qoute').text(qoute).end()
            .find('.testimonial__cite').text(qouteByName).end()
            .find('.testimonial__logo').attr('src', qouteByLogo);
        if (['coral', 'tan', 'teal', 'white', 'yello'].indexOf(color) >= 0)
            $(shadow)
            .find('.feature-spotlight').addClass('feature-spotlight--' + color)
            .end().find('video').attr('poster', color + '-placeholder.png');
        if (vid) {
            $(shadow).find('video source').attr('src', vid).end()
                .find('.feature-spotlight__media-img-wrapper').remove();
        } else if (img) {
            $(shadow).find('.feature-spotlight__media-img').attr('src', img)
                .end().find('.feature-spotlight__media-player-wrapper').remove();
        }
        if (flipped) $(shadow)
            .find('.feature-spotlight__lead').addClass('feature-spotlight__' +
                'lead--flipped').end()
            .find('.feature-spotlight__children').addClass('feature-spotlight' +
                '__children--flipped').end()
            .find('.feature-spotlight__media').addClass('feature-spotlight__' +
                'media--flipped').end();
    }
}

window.customElements.define('feature-spotlight', FeatureSpotlight);

module.exports = FeatureSpotlight;