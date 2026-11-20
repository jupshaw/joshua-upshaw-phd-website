#!/usr/bin/env python3
"""Smoke tests for generated static site, using only Python standard library."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import sys
import os
import json
import re
from xml.etree import ElementTree as ET

OUT=Path(__file__).resolve().parents[1]/'public'
BASE_PATH=os.environ.get('SITE_BASE_PATH','').rstrip('/')
class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self.ids=set(); self.title=False; self.titles=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.add(a['id'])
        if tag in ('a','link') and 'href' in a:self.links.append((tag,a['href']))
        if tag=='script' and 'src' in a:self.links.append((tag,a['src']))
        if tag=='title':self.title=True
    def handle_data(self, data):
        if self.title:self.titles.append(data)
    def handle_endtag(self,tag):
        if tag=='title':self.title=False

def test():
    pages=sorted(OUT.rglob('*.html'))
    errors=[]
    for page in pages:
        p=Links(); body=page.read_text(encoding='utf-8');p.feed(body)
        if not p.titles:errors.append(f'{page}: missing title')
        if '<h1' not in body:errors.append(f'{page}: missing h1')
        for tag,href in p.links:
            if href.startswith(('https:','http:','mailto:','tel:','data:')):continue
            if href.startswith('#'):
                if href[1:] not in p.ids:errors.append(f'{page}: unresolved anchor {href}')
                continue
            u=urlsplit(href)
            if not u.path:continue
            path=unquote(u.path)
            if BASE_PATH and path.startswith(BASE_PATH+'/'):
                path=path[len(BASE_PATH):]
            elif BASE_PATH and path==BASE_PATH:
                path='/'
            candidate=(OUT/path.lstrip('/')) if path.startswith('/') else (page.parent/path)
            if candidate.is_dir():candidate=candidate/'index.html'
            if not candidate.is_file():errors.append(f'{page}: broken local link {href}')
    # Contact-page smoke tests: both forms, delivery target, confirmation path,
    # meeting request controls, and noindexed submission confirmation.
    contact = (OUT / 'contact' / 'index.html').read_text(encoding='utf-8')
    thanks = (OUT / 'contact' / 'thanks' / 'index.html').read_text(encoding='utf-8')
    for label, needle in {
        'professional contact email': 'mailto:contact@joshuaupshawphd.com',
        'secure inquiry form': 'data-secure-form="inquiry"',
        'secure meeting form': 'data-secure-form="meeting"',
        'Turnstile configuration': 'data-turnstile-sitekey="',
        'worker URL configuration': 'data-secure-contact-api="',
        'contact form field': 'id="inquiry-message"',
        'meeting selection 15': 'data-meeting-duration="15"',
        'meeting selection 30': 'data-meeting-duration="30"',
        'meeting date field': 'id="meeting-date"',
        'meeting time field': 'id="meeting-time"',
        'submission feedback': 'class="contact-form-status"',
        'meeting request disclaimer': 'not a confirmed reservation',
    }.items():
        if needle not in contact:
            errors.append(f'contact page: missing {label}')
    if contact.count('data-secure-submit disabled') != 2:
        errors.append('contact page: expected two disabled-by-default secure forms')
    if 'formsubmit.co' in contact.lower():
        errors.append('contact page: insecure third-party form endpoint remains')
    if 'jupshaw2010@gmail.com' in contact:
        errors.append('contact page: deprecated email address found')
    if '<meta name="robots" content="noindex,follow">' not in thanks:
        errors.append('contact confirmation: expected noindex directive')
    script = (OUT / 'assets' / 'site.js').read_text(encoding='utf-8')
    if 'chicagoToday' not in script or 'validateDate' not in script or 'turnstile/v0/api.js' not in script:
        errors.append('meeting requests: missing Central Time date validation')
    # Technical SEO / entity validation for every generated page.
    descriptions=set()
    for page in pages:
        if page.name == '404.html':
            continue
        html=page.read_text(encoding='utf-8')
        match=re.search(r'<script type="application/ld\+json">(.*?)</script>',html)
        if not match:
            errors.append(f'{page}: missing structured JSON-LD')
            continue
        try:
            graph=json.loads(match.group(1))['@graph']
        except (ValueError, KeyError, TypeError):
            errors.append(f'{page}: invalid entity JSON-LD')
            continue
        types={obj.get('@type') for obj in graph}
        if not {'Person','WebSite'} <= types or not ({'WebPage','ProfilePage','CollectionPage'} & types):
            errors.append(f'{page}: incomplete entity schema')
        meta=re.search(r'<meta name="description" content="([^"]+)"',html)
        if not meta or len(meta.group(1)) < 35:
            errors.append(f'{page}: missing descriptive meta description')
        elif meta.group(1) in descriptions:
            errors.append(f'{page}: duplicate meta description')
        elif meta: descriptions.add(meta.group(1))
        if '<link rel="canonical" href="https://joshuaupshawphd.com/' not in html:
            errors.append(f'{page}: missing canonical')
        if 'href="/privacy/"' not in html:
            errors.append(f'{page}: missing privacy link')
    privacy=(OUT/'privacy'/'index.html')
    if not privacy.exists():
        errors.append('Privacy and analytics notice missing')
    sitemap=ET.parse(OUT/'sitemap.xml')
    urls=[x.text for x in sitemap.findall('.//{*}loc')]
    if 'https://joshuaupshawphd.com/privacy/' not in urls:
        errors.append('Sitemap missing privacy page')
    if 'https://joshuaupshawphd.com/contact/thanks/' in urls:
        errors.append('Confirmation page unexpectedly indexed')
    home=(OUT/'index.html').read_text(encoding='utf-8')
    script=(OUT/'assets'/'site.js').read_text(encoding='utf-8')
    expected_ga4 = (os.environ.get('SITE_GA4_MEASUREMENT_ID') or 'G-ZCZ7BZ77CW').strip()
    if f'data-ga4-id="{expected_ga4}"' not in home or 'data-analytics-settings' not in script:
        errors.append('Configured GA4 Measurement ID or consent-ready integration missing')
    if 'data-gtm-id="GTM-P84JWK5G"' not in home:
        errors.append('Expected supplied GTM container configuration missing')
    if 'googletagmanager.com/gtm.js?id=' not in script or 'useTagManager' not in script:
        errors.append('GTM consent-based loader missing')
    if 'src="https://www.googletagmanager.com/' in home:
        errors.append('Analytics tag must not load before user consent')
    portrait=(OUT/'assets'/'joshua-upshaw-headshot.webp')
    if not portrait.is_file() or portrait.stat().st_size < 4000:
        errors.append('Homepage portrait asset missing')
    elif portrait.read_bytes()[:4] != b'RIFF' or portrait.read_bytes()[8:12] != b'WEBP':
        errors.append('Homepage portrait asset is not valid WebP')
    if 'src="/assets/joshua-upshaw-headshot.webp"' not in home:
        errors.append('Homepage does not display the uploaded portrait')
    if 'alt="Joshua Upshaw, PhD, professional headshot"' not in home:
        errors.append('Homepage portrait accessible alt text missing')
    if '<div class="visual-center">J<span>U</span></div>' in home:
        errors.append('Homepage initials placeholder still visible')
    about=(OUT/'about'/'index.html').read_text(encoding='utf-8')
    research=(OUT/'research'/'index.html').read_text(encoding='utf-8')
    images=('joshua-upshaw-headshot.webp','eeg-research-session.webp',
            'eeg-cap-detail.webp','research-conference-presentation.webp')
    for name in images:
        if not (OUT/'assets'/name).is_file():
            errors.append(f'Missing optimized image asset: {name}')
    if 'eeg-research-session.webp' not in about or 'joshua-upshaw-headshot.webp' not in about:
        errors.append('About page missing portrait or EEG research photo')
    if 'eeg-cap-detail.webp' not in research or 'research-conference-presentation.webp' not in research:
        errors.append('Research page missing laboratory or conference photo')
    if errors:
        print('FAIL\n'+'\n'.join(errors));return 1
    print(f'PASS: validated {len(pages)} HTML pages; no broken internal links.')
    return 0
if __name__=='__main__':sys.exit(test())
