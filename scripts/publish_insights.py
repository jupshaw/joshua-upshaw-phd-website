"""Static Insights publishing. Only explicitly approved entries enter public/."""
from datetime import date
from email.utils import formatdate
from html import escape
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET
import calendar
import json
import re
import shutil

TOPICS = {
    "healthcare-ai": ("Healthcare AI", "Clinical intelligence, responsible AI, patient access and workflow innovation."),
    "cognitive-neuroscience": ("Cognitive Neuroscience", "Attention, creativity, cognitive control and digital behavior."),
    "neurotechnology": ("Neurotechnology", "Wearable sensing, multimodal measurement and future health technologies."),
    "product-innovation": ("Product & Innovation", "Evidence-driven product development, R&D and technology evaluation."),
}
KINDS = {"white-paper": "White paper", "perspective": "Perspective", "technical-report": "Technical report", "research-summary": "Research summary"}
SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
ASSET = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9_-]*\.(?:pdf|webp|png|jpg|jpeg)")
AUTHOR = "Joshua D. Upshaw, PhD"

def e(value):
    return escape(str(value), quote=True)

def safe_link(url, assets):
    if url in assets:
        return url
    parsed = urlsplit(url)
    if parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password:
        return url
    if url.startswith("/") and not url.startswith("//") and not parsed.scheme and not parsed.netloc and "\\" not in url:
        if ".." not in parsed.path.split("/"):
            return url
    raise ValueError("Unsupported link: " + url)

def inline(text, assets):
    """Restricted Markdown: links, images, emphasis and inline code. No raw HTML."""
    pattern = r"(!?\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\x60([^\x60\n]+)\x60)"
    result, pos = [], 0
    for m in re.finditer(pattern, text):
        result.append(e(text[pos:m.start()]))
        token, label, url, bold, italic, code = m.groups()
        if label is not None:
            if token.startswith("!"):
                if url not in assets or not url.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                    raise ValueError("Images must be declared local image assets: " + url)
                result.append(f'<img src="{e(url)}" alt="{e(label)}" loading="lazy" decoding="async">')
            else:
                result.append(f'<a href="{e(safe_link(url, assets))}">{e(label)}</a>')
        elif bold is not None:
            result.append(f"<strong>{e(bold)}</strong>")
        elif italic is not None:
            result.append(f"<em>{e(italic)}</em>")
        else:
            result.append(f"<code>{e(code)}</code>")
        pos = m.end()
    result.append(e(text[pos:]))
    return "".join(result)

def markdown(text, assets):
    """Render a documented Markdown subset and collect section anchors."""
    out, toc, paragraph, items = [], [], [], []
    list_type = None
    used = set()
    def flush():
        nonlocal list_type
        if paragraph:
            out.append("<p>" + inline(" ".join(paragraph), assets) + "</p>")
            paragraph.clear()
        if items:
            out.append(f"<{list_type}>" + "".join("<li>" + inline(i, assets) + "</li>" for i in items) + f"</{list_type}>")
            items.clear()
            list_type = None
    for line in text.splitlines():
        line = line.strip()
        if not line:
            flush()
            continue
        heading = re.fullmatch(r"(##|###|####)\s+(.+)", line)
        bullet = re.fullmatch(r"([-*]|\d+\.)\s+(.+)", line)
        if heading:
            flush()
            level, label = len(heading[1]), heading[2]
            slug = "section-" + (re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-") or "heading")
            anchor, n = slug, 2
            while anchor in used:
                anchor = f"{slug}-{n}"
                n += 1
            used.add(anchor)
            if level == 2:
                toc.append((anchor, label))
            out.append(f'<h{level} id="{anchor}">{e(label)}</h{level}>')
        elif bullet:
            kind = "ol" if bullet[1].endswith(".") else "ul"
            if paragraph or (items and list_type != kind):
                flush()
            list_type = kind
            items.append(bullet[2])
        else:
            if items:
                flush()
            paragraph.append(line)
    flush()
    return "\n".join(out), toc

def load_entries(root):
    entries, seen = [], set()
    for meta in sorted((root / "content" / "insights").glob("*/metadata.json")):
        data = json.loads(meta.read_text(encoding="utf-8"))
        # Drafts and unapproved work are never rendered or copied. The repository
        # is public; confidential drafts must be kept outside it altogether.
        if data.get("status") == "draft":
            continue
        if data.get("status") != "published" or data.get("approved_for_publication") is not True:
            raise ValueError(f"{meta}: explicit publication approval required")
        slug = meta.parent.name
        if not SLUG.fullmatch(slug) or slug in seen:
            raise ValueError(f"{meta}: invalid or duplicate slug")
        seen.add(slug)
        for field in ("title", "description", "abstract", "version", "topic", "type", "published"):
            if not isinstance(data.get(field), str) or not data[field].strip():
                raise ValueError(f"{meta}: missing {field}")
        if len(data["description"]) < 35 or len(data["description"]) > 200:
            raise ValueError(f"{meta}: description must be 35 to 200 characters")
        if data["topic"] not in TOPICS or data["type"] not in KINDS:
            raise ValueError(f"{meta}: unknown topic or type")
        if data.get("peer_reviewed") is not False:
            raise ValueError(f"{meta}: Insights entries must be labeled non-peer-reviewed; formal publications belong in Research")
        published = date.fromisoformat(data["published"])
        revised = date.fromisoformat(data.get("modified", data["published"]))
        if revised < published or published > date.today() or revised > date.today():
            raise ValueError(f"{meta}: invalid publication dates")
        assets = data.get("assets", [])
        if not isinstance(assets, list) or len(set(assets)) != len(assets):
            raise ValueError(f"{meta}: assets must be a unique list")
        for name in assets:
            if not isinstance(name, str) or not ASSET.fullmatch(name) or not (meta.parent / name).is_file() or (meta.parent / name).is_symlink():
                raise ValueError(f"{meta}: invalid asset {name}")
        for field, suffixes in (("pdf", (".pdf",)), ("cover", (".webp", ".png", ".jpg", ".jpeg"))):
            if field in data and (data[field] not in assets or not data[field].lower().endswith(suffixes)):
                raise ValueError(f"{meta}: {field} must name a declared asset")
        if data.get("cover") and not data.get("cover_alt"):
            raise ValueError(f"{meta}: cover_alt is required")
        keywords = data.get("keywords", [])
        if not isinstance(keywords, list) or not all(isinstance(k, str) and k.strip() for k in keywords):
            raise ValueError(f"{meta}: invalid keywords")
        related = data.get("related", [])
        if not isinstance(related, list) or not all(isinstance(x, dict) and isinstance(x.get("title"), str) and isinstance(x.get("url"), str) for x in related):
            raise ValueError(f"{meta}: invalid related links")
        body = (meta.parent / "paper.md").read_text(encoding="utf-8").strip()
        if not body:
            raise ValueError(f"{meta}: paper.md must not be empty")
        rendered, toc = markdown(body, assets)
        entries.append(dict(data, slug=slug, source=meta.parent, assets=assets,
                            keywords=keywords, related=related, modified=revised.isoformat(),
                            path=f"/insights/{data['topic']}/{slug}/", body=rendered, toc=toc))
    return sorted(entries, key=lambda x: (x["published"], x["slug"]), reverse=True)

def entry_card(entry):
    return (f'<article class="av-value-card insights-card"><p class="av-chip">{e(KINDS[entry["type"]])} · '
            f'{e(TOPICS[entry["topic"]][0])}</p><h3><a href="{e(entry["path"])}">{e(entry["title"])}</a></h3>'
            f'<p>{e(entry["description"])}</p><p class="insights-meta"><time datetime="{e(entry["published"])}">'
            f'{e(entry["published"])}</time> · Not peer reviewed</p>'
            f'<a class="av-inline-link" href="{e(entry["path"])}">Read publication →</a></article>')

def hero(title, description):
    return f'<section class="av-hero av-hero-centered"><div class="container"><p class="av-kicker">RESEARCH · PERSPECTIVES · INNOVATION</p><h1>{e(title)}</h1><p class="av-hero-lede">{e(description)}</p></div></section>'

def grid(entries):
    return '<div class="insights-grid">' + "".join(entry_card(x) for x in entries) + "</div>"

def register_insights(root, out, site, pages):
    entries = load_entries(root)
    # This directory is owned by this generator, so removed publications cannot
    # survive a subsequent build as stale public pages or downloadable files.
    destination = out / "insights"
    if destination.exists():
        shutil.rmtree(destination)
    topic_cards = []
    for key, (label, desc) in TOPICS.items():
        subset = [x for x in entries if x["topic"] == key]
        if subset:
            topic_cards.append(f'<a class="av-value-card insights-topic" href="/insights/{key}/"><h3>{e(label)}</h3><p>{e(desc)}</p><span>{len(subset)} publication(s) →</span></a>')
            pages[f"/insights/{key}/"] = dict(title=f"{label} Insights | Joshua Upshaw, PhD",
                description=desc, collection=True, content=hero(label, desc) +
                '<section class="av-section"><div class="container"><p><a href="/insights/">All insights</a></p><h2>Publications</h2>' + grid(subset) + "</div></section>")
        else:
            topic_cards.append(f'<article class="av-value-card"><h3>{e(label)}</h3><p>{e(desc)}</p></article>')
    latest = grid(entries) if entries else '<p class="av-prose">Original white papers and perspectives will appear here when approved for publication. Explore my <a href="/research/">peer-reviewed research</a> and <a href="/projects/">project portfolio</a> in the meantime.</p>'
    pages["/insights/"] = dict(title="Research & Insights | Joshua Upshaw, PhD",
        description="Original white papers, technical perspectives and research summaries on healthcare AI, cognitive neuroscience, neurotechnology and product innovation.",
        collection=True, content=hero("Research & Insights", "Exploring how science and intelligent technology can advance health and human potential.") +
        '<section class="av-section av-section-raised"><div class="container"><h2>Explore by topic</h2><div class="insights-grid">' + "".join(topic_cards) +
        '</div></div></section><section class="av-section"><div class="container"><h2>Latest publications</h2>' + latest +
        '<p><a href="/insights/feed.xml">RSS feed</a> · <a href="/research/">Peer-reviewed publications</a></p></div></section>')
    home_cards = grid(entries[:3]) if entries else '<p>Explore research-driven perspectives and future directions across healthcare AI, cognitive neuroscience, neurotechnology and product innovation.</p>'
    pages["/"]["content"] += ('<section class="av-section av-section-raised"><div class="container"><p class="av-kicker">ORIGINAL THINKING</p>'
        '<h2>Ideas shaping the future</h2>' + home_cards + '<p><a class="av-button av-button-primary" href="/insights/">Explore research &amp; insights →</a></p></div></section>')
    pages["/research/"]["content"] += '<section class="av-section"><div class="container"><h2>Beyond peer-reviewed research</h2><p>Explore separately labeled white papers, technical reports and professional perspectives.</p><a class="av-inline-link" href="/insights/">Research &amp; Insights →</a></div></section>'
    for entry in entries:
        path = entry["path"]
        article_dir = out / path.lstrip("/")
        article_dir.mkdir(parents=True, exist_ok=True)
        for name in entry["assets"]:
            shutil.copyfile(entry["source"] / name, article_dir / name)
        title, topic = entry["title"], TOPICS[entry["topic"]][0]
        citation = f'{AUTHOR}. ({entry["published"][:4]}). {title}. Version {entry["version"]}. {site}{path}'
        toc = ('<nav class="insights-toc" aria-label="Article contents"><h2>Contents</h2><ul>' +
               "".join(f'<li><a href="#{e(a)}">{e(t)}</a></li>' for a, t in entry["toc"]) + '</ul></nav>') if entry["toc"] else ""
        pdf = f'<a class="av-button av-button-primary" href="{e(entry["pdf"])}" download>Download PDF</a>' if entry.get("pdf") else ""
        cover = f'<img class="insights-cover" src="{e(entry["cover"])}" alt="{e(entry["cover_alt"])}" decoding="async">' if entry.get("cover") else ""
        related = [(x["title"], x["path"]) for x in entries if x["topic"] == entry["topic"] and x["slug"] != entry["slug"]][:3]
        related += [(x["title"], safe_link(x["url"], [])) for x in entry["related"]]
        related += [("Scientific publications", "/research/"), ("Project portfolio", "/projects/")]
        links = "".join(f'<li><a href="{e(url)}">{e(label)}</a></li>' for label,url in related)
        body = (f'<section class="av-section"><div class="container"><article class="insights-article">'
                f'<p><a href="/insights/">Insights</a> / <a href="/insights/{e(entry["topic"])}/">{e(topic)}</a></p>'
                f'<p class="av-kicker">{e(KINDS[entry["type"]])} · {e(topic)}</p><h1>{e(title)}</h1>'
                f'<p>By <a href="/about/">{e(AUTHOR)}</a> · <time datetime="{e(entry["published"])}">{e(entry["published"])}</time>'
                f' · Version {e(entry["version"])} · Not peer reviewed</p><p>Last updated: {e(entry["modified"])}</p>'
                f'{cover}<div class="av-actions">{pdf}</div><section class="insights-summary"><h2>Executive summary</h2><p>{e(entry["abstract"])}</p></section>'
                f'{toc}<div class="insights-body">{entry["body"]}</div><section class="insights-summary"><h2>Suggested citation</h2><p>{e(citation)}</p></section>'
                f'<section><h2>Related research and resources</h2><ul>{links}</ul></section>'
                '<section><h2>About the author</h2><p>Cognitive neuroscientist and healthcare AI researcher exploring evidence-driven technology and human health.</p>'
                '<p><a href="/about/">Author biography</a> · <a href="/contact/">Discuss this work or collaborate</a></p></section></article></div></section>')
        pages[path] = dict(title=title + " | Joshua Upshaw, PhD", description=entry["description"],
                           content=body, article=entry)
    destination.mkdir(parents=True, exist_ok=True)
    rss = ET.Element("rss", version="2.0")
    channel = ET.SubElement(rss, "channel")
    for k,v in (("title","Joshua Upshaw, PhD | Research & Insights"),("link",site+"/insights/"),("description","Original research perspectives and white papers."),("language","en")):
        ET.SubElement(channel,k).text = v
    for entry in entries:
        item = ET.SubElement(channel,"item")
        url = site + entry["path"]
        for k,v in (("title",entry["title"]),("link",url),("guid",url),("description",entry["description"]),("category",TOPICS[entry["topic"]][0]),
                    ("pubDate",formatdate(calendar.timegm(date.fromisoformat(entry["published"]).timetuple()),usegmt=True))):
            ET.SubElement(item,k).text = v
    ET.ElementTree(rss).write(destination / "feed.xml", encoding="utf-8", xml_declaration=True)

def article_schema(entry, site):
    url = site + entry["path"]
    data = {"@type":"Article","@id":url+"#article","mainEntityOfPage":{"@id":url+"#webpage"},
            "headline":entry["title"],"description":entry["description"],"abstract":entry["abstract"],
            "author":{"@id":site+"/#person"},"publisher":{"@id":site+"/#person"},"url":url,
            "datePublished":entry["published"],"dateModified":entry["modified"],"version":entry["version"],
            "articleSection":TOPICS[entry["topic"]][0],"keywords":entry["keywords"],"inLanguage":"en"}
    if entry.get("cover"):
        data["image"] = url + entry["cover"]
    if entry.get("pdf"):
        data["encoding"] = {"@type":"MediaObject","contentUrl":url+entry["pdf"],"encodingFormat":"application/pdf"}
    return data
