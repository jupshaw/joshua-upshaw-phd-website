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
    if errors:
        print('FAIL\n'+'\n'.join(errors));return 1
    print(f'PASS: validated {len(pages)} HTML pages; no broken internal links.')
    return 0
if __name__=='__main__':sys.exit(test())
