const $ = require('jquery');
const html = require('./index.html');
const css = require('./index.scss').toString();

const DEFAULT_POLICY = 'privacy';

class Legal extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({
            mode: 'open',
        });
        const viewPolicy = (policyId, policyName = $(shadow)
                .find('.terms__policy-nav [data-policy="' + policyId + '"]')
                .text()) => $(shadow)
            .find('.terms__nav-list .selected').removeClass('selected')
            .addClass('collapsed').end()
            .find('.terms__article').addClass('u__hidden').end()
            .find('.terms__content [data-policy="' + policyId + '"]')
            .removeClass('u__hidden').end()
            .find('.terms__nav-list [data-policy="' + policyId + '"]')
            .removeClass('collapsed').addClass('selected').end()
            .find('.terms__mobile-nav-header .terms__nav-heading')
            .attr('data-policy', policyId).text(policyName).end()
            .find('.terms__sidebar').removeClass('open').addClass('closed');
        const ids = {};
        shadow.innerHTML = '<style>' + css + '</style>' + html;
        $(shadow).find('.terms__nav-subheadings a').each(function() {
            const policyId = $(this).parents('.terms__policy-nav').attr('data' +
                '-policy');
            if (!ids[policyId]) ids[policyId] = [];
            ids[policyId].push($(this).attr('href').replace('#', ''));
            this.addEventListener('click', () => {
                const item = $(shadow).find($(this).attr('href'))[0];
                document.body.scrollBy({ // Thanks to https://bit.ly/2USf5HY
                    top: item.offsetTop - document.body.scrollTop - 100,
                    left: 0,
                    behavior: 'smooth',
                });
            });
        });
        $(shadow).find('.terms__nav-list .terms__policy-nav').each(function() {
            const policyId = $(this).attr('data-policy');
            this.addEventListener('click', () => viewPolicy(policyId));
        });
        $(shadow).find('.terms__mobile-nav-header')[0]
            .addEventListener('click', () => {
                const sidebar = $(shadow).find('.terms__sidebar');
                if (sidebar.hasClass('closed'))
                    return sidebar.removeClass('closed').addClass('open');
                sidebar.removeClass('open').addClass('closed');
            });
        const id = window.location.toString().split('#')[1];
        Object.entries(ids).forEach(([policyId, elIds]) => {
            if (policyId === id) return viewPolicy(policyId);
            elIds.forEach(elId => {
                if (elId !== id) return;
                if (policyId !== DEFAULT_POLICY) viewPolicy(policyId);
                $(shadow).find('#' + elId)[0].scrollIntoView();
            });
        });
    }
}

window.customElements.define('layered-legal', Legal);

module.exports = Legal;