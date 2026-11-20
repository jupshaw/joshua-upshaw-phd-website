(() => { const button=document.querySelector('[data-menu-toggle]'); const nav=document.getElementById('primary-nav'); if(button && nav){button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!open));nav.classList.toggle('is-open',!open);});document.addEventListener('keydown',e=>{if(e.key==='Escape'){button.setAttribute('aria-expanded','false');nav.classList.remove('is-open');}});}const year=document.querySelector('[data-year]');if(year)year.textContent=String(new Date().getFullYear());})();
/* Contact-page meeting preference controls. The page never claims to reserve calendar time. */
(() => {
  'use strict';
  const section = document.getElementById('meetings');
  const form = document.getElementById('meeting-request-form');
  if (!section || !form) return;

  const durationInput = document.getElementById('meeting-duration-field');
  const heading = document.getElementById('meeting-form-heading');
  const subject = document.getElementById('meeting-request-subject');
  const badge = document.getElementById('meeting-length-badge');
  const dateInput = document.getElementById('meeting-date');
  const cards = Array.from(section.querySelectorAll('[data-meeting-duration]'));
  const requestPanel = document.getElementById('request-meeting');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const meetingLink = duration => {
    // Add the public URLs from your meeting scheduler to the two data-booking-url
    // attributes in scripts/page_sections/contact.html to enable live self-booking.
    const candidate = (section.getAttribute('data-booking-url-' + duration) || '').trim();
    try {
      const url = new URL(candidate);
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  };

  const selectDuration = duration => {
    if (duration !== '15' && duration !== '30') return;
    durationInput.value = duration + ' minutes';
    heading.textContent = 'Request a ' + duration + '-minute virtual meeting';
    subject.value = 'Professional website · ' + duration + '-minute virtual meeting request';
    badge.textContent = duration + ' MIN';
    cards.forEach(card => {
      const selected = card.dataset.meetingDuration === duration;
      card.classList.toggle('is-selected', selected);
      card.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  };

  cards.forEach(card => {
    const duration = card.dataset.meetingDuration;
    const externalUrl = meetingLink(duration);
    if (externalUrl) {
      const label = card.querySelector('.contact-meeting-cta');
      if (label) label.innerHTML = 'Check live availability <span aria-hidden="true">↗</span>';
      card.setAttribute('aria-label', duration + '-minute meeting, open live calendar booking in a new tab');
    }

    card.addEventListener('click', () => {
      if (externalUrl) {
        window.open(externalUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      selectDuration(duration);
      requestPanel?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
    });
  });

  // Set input range using the website owner's Central timezone, not the visitor's timezone.
  const chicagoToday = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), 12));
  };
  const formatDate = date => date.toISOString().slice(0, 10);
  const startOfRange = chicagoToday();
  const minDate = new Date(startOfRange);
  minDate.setUTCDate(minDate.getUTCDate() + 1);
  const maxDate = new Date(startOfRange);
  maxDate.setUTCDate(maxDate.getUTCDate() + 45);
  dateInput.min = formatDate(minDate);
  dateInput.max = formatDate(maxDate);

  const validateDate = () => {
    dateInput.setCustomValidity('');
    if (!dateInput.value) return;
    const selected = new Date(dateInput.value + 'T12:00:00Z');
    if (Number.isNaN(selected.getTime())) {
      dateInput.setCustomValidity('Select a valid date.');
    } else if (selected.getUTCDay() === 0 || selected.getUTCDay() === 6) {
      dateInput.setCustomValidity('Please choose a weekday, Monday through Friday.');
    } else if (selected < minDate || selected > maxDate) {
      dateInput.setCustomValidity('Choose a weekday at least one day ahead and within the next 45 days.');
    }
  };
  dateInput.addEventListener('change', validateDate);
  dateInput.addEventListener('input', validateDate);
  form.addEventListener('submit', event => {
    validateDate();
    if (!form.reportValidity()) event.preventDefault();
  });
  selectDuration('15');
})();
