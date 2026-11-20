#!/usr/bin/env python3
"""Smoke tests for generated static site, using only Python standard library."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import sys
import os

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
        'professional contact email': 'mailto:joshua@joshuaupshawphd.com',
        'contact form endpoint': 'action="https://formsubmit.co/joshua@joshuaupshawphd.com"',
        'contact form field': 'id="inquiry-message"',
        'meeting selection 15': 'data-meeting-duration="15"',
        'meeting selection 30': 'data-meeting-duration="30"',
        'meeting date field': 'id="meeting-date"',
        'meeting time field': 'id="meeting-time"',
        'confirmation destination': 'https://joshuaupshawphd.com/contact/thanks/',
        'meeting request disclaimer': 'not a confirmed reservation',
    }.items():
        if needle not in contact:
            errors.append(f'contact page: missing {label}')
    if contact.count('action="https://formsubmit.co/joshua@joshuaupshawphd.com"') != 2:
        errors.append('contact page: expected exactly two delivery forms')
    if 'jupshaw2010@gmail.com' in contact:
        errors.append('contact page: deprecated email address found')
    if '<meta name="robots" content="noindex,follow">' not in thanks:
        errors.append('contact confirmation: expected noindex directive')
    script = (OUT / 'assets' / 'site.js').read_text(encoding='utf-8')
    if 'chicagoToday' not in script or 'validateDate' not in script:
        errors.append('meeting requests: missing Central Time date validation')
    if errors:
        print('FAIL\n'+'\n'.join(errors));return 1
    print(f'PASS: validated {len(pages)} HTML pages; no broken internal links.')
    return 0
if __name__=='__main__':sys.exit(test())
