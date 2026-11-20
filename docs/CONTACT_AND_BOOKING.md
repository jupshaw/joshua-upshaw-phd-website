# Contact form and virtual meeting scheduling

The portfolio's [Contact page](https://joshuaupshawphd.com/contact/) contains two working HTML form submissions:

1. **Contact inquiry:** name, reply email, optional organization, inquiry topic, and message.
2. **Virtual meeting request:** 15- or 30-minute preference, name, reply email, weekday date, start time in US Central, agenda, and optional alternative times.

This is a **request workflow**, not a live availability or automatic calendar reservation. Meeting times become confirmed only after Joshua responds and sends an invitation.

## Contact form delivery

The static GitHub Pages website cannot send emails itself. Both forms submit over HTTPS to [FormSubmit](https://formsubmit.co/) and specify the receiving mailbox **joshua@joshuaupshawphd.com**.

**Important: Activate the endpoint.** FormSubmit requires an initial form submission and an email confirmation link before it forwards messages to the receiving address:

1. Visit https://joshuaupshawphd.com/contact/.
2. Submit a harmless test inquiry with your own name and reply email.
3. Check **joshua@joshuaupshawphd.com**, including Junk, for FormSubmit's activation message.
4. Follow the activation link. Without this step, the form has not been confirmed to deliver email.
5. Submit a second test inquiry and a meeting request. Verify receipt and reply-to address.

The forms include a spam honeypot and use FormSubmit's standard spam controls. FormSubmit is a **third-party processor**; submissions should not contain PHI, patient details, credentials, sensitive data, or confidential research. Before promoting the site widely, review the provider's terms, privacy posture, and retention. FormSubmit documents a 30-day submission archive.

Forms are generated from `scripts/page_sections/contact.html`. The matching success page is `scripts/page_sections/contact-thanks.html` and is excluded from the sitemap and marked `noindex`.

## Meeting request defaults

| Setting | Default |
| --- | --- |
| Meeting lengths | 15 or 30 minutes |
| Format | Virtual, by mutually agreed meeting platform |
| Days | Monday to Friday |
| Window | 9:00 AM to 5:00 PM US Central (America/Chicago) |
| Proposed start times | Every 30 minutes, from 9:00 AM through 4:30 PM Central |
| Lead time | At least one calendar day |
| Request horizon | Up to 45 days |
| Calendar checking | Not connected yet |
| Confirmation | Manual email confirmation and calendar invitation |

`scripts/page_sections/contact.js` validates the user's preferred date against the owner's Central timezone, prevents weekend requests, and changes the requested duration. The HTML select restricts proposed start times to the stated business window. Client-side checks are for usability, not a server-side booking guarantee.

## Enable actual self-service bookings in Microsoft Bookings

Recommended when Microsoft Bookings is enabled for your Microsoft 365 mailbox. The site currently has **no** Bookings meeting URLs, because a public schedule has not yet been configured.

1. Sign into [Microsoft Bookings](https://book.ms/) using the mailbox intended to host professional meetings, ideally **joshua@joshuaupshawphd.com**. Access is subject to your Microsoft 365 license and organization settings.
2. Open your Personal booking page, or set up a suitable shared booking page.
3. Configure two **public** meeting types:
   - **15-minute virtual introduction**, 15-minute duration.
   - **30-minute research / career / product conversation**, 30-minute duration.
4. Set availability to Monday through Friday, 9:00 AM to 5:00 PM, **America/Chicago**. Consider at least 24 hours of lead time and a buffer between meetings.
5. Enable Microsoft Teams for virtual meetings, and ensure the calendar used for availability is the intended one. Review reminders, external booking permissions, and calendar privacy.
6. Copy each meeting type's **public booking URL**. In `scripts/page_sections/contact.html`, set the values of `data-booking-url-15=""` and `data-booking-url-30=""` on the Meetings section.
7. Run `python3 scripts/build.py && python3 scripts/check_site.py`, push to GitHub, and verify both links using a separate browser session.

When a valid HTTPS booking URL is supplied, the corresponding meeting card opens the live calendar page. If a URL is blank, the card selects the manual meeting-request form. The request form remains visible as a fallback for visitors who cannot use self-service booking.

Microsoft's documentation: [Personal Bookings FAQ](https://learn.microsoft.com/en-us/microsoft-365/bookings/personal-bookings-faq), [meeting types](https://learn.microsoft.com/en-us/microsoft-365/bookings/create-new-meeting-type), and [share personal booking links](https://learn.microsoft.com/en-us/microsoft-365/bookings/preview-share-personal-booking-page).

## Quality checks

- Confirm both forms function after activation, from desktop and mobile.
- Check that the requested meeting duration and Central timezone appear in the email.
- Verify weekday validation and that the preferred date is in range.
- Check success-page navigation and that an unconfirmed request never appears to be a booked event.
- Confirm the hosting account has the correct mailbox and sufficient Microsoft Bookings entitlements before adding live booking links.
