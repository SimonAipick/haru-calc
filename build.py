#!/usr/bin/env python3
"""tools/*.html 조각을 공용 레이아웃으로 감싸 dist/에 정적 사이트를 만든다.

조각 파일 형식:
  <!-- {JSON 메타데이터} -->
  계산기 폼과 스크립트
  <!-- guide -->
  설명 본문

사용법: python3 build.py
"""
import json
import re
import shutil
from datetime import date
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
CATEGORY_ORDER = ["직장·급여", "금융", "생활"]

cfg = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
SITE_URL = cfg["site_url"].rstrip("/")
VERSION = date.today().strftime("%Y%m%d")


def load_tools():
    tools = []
    for path in sorted((ROOT / "tools").glob("*.html")):
        text = path.read_text(encoding="utf-8")
        m = re.match(r"\s*<!--(.*?)-->", text, re.S)
        if not m:
            raise SystemExit(f"{path.name}: 맨 위에 JSON 메타데이터 주석이 없습니다")
        meta = json.loads(m.group(1))
        body = text[m.end():]
        calc, _, guide = body.partition("<!-- guide -->")
        meta.update(calc=calc.strip(), guide=guide.strip())
        tools.append(meta)
    tools.sort(key=lambda t: (CATEGORY_ORDER.index(t["category"]), t.get("order", 99)))
    return tools


def head_extras():
    out = []
    if cfg.get("google_site_verification"):
        out.append(f'<meta name="google-site-verification" content="{escape(cfg["google_site_verification"])}">')
    if cfg.get("naver_site_verification"):
        out.append(f'<meta name="naver-site-verification" content="{escape(cfg["naver_site_verification"])}">')
    if cfg.get("adsense_client"):
        # 자동 광고: AdSense 대시보드에서 켜면 광고 위치를 구글이 알아서 정한다
        out.append(
            '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
            f'?client={escape(cfg["adsense_client"])}" crossorigin="anonymous"></script>'
        )
    return "\n".join(out)


def page(*, base, path, title, description, body, crumb=None, jsonld=None, scripts=True):
    full_title = title if title == cfg["site_name"] else f'{title} | {cfg["site_name"]}'
    canonical = f"{SITE_URL}/{path}"
    crumb_html = f'<div class="crumb"><a href="{base}">홈</a> › {escape(crumb)}</div>' if crumb else ""
    ld = f'<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>' if jsonld else ""
    js = f'<script src="{base}assets/calc.js?v={VERSION}"></script>' if scripts else ""
    return f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(full_title)}</title>
<meta name="description" content="{escape(description)}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="{escape(full_title)}">
<meta property="og:description" content="{escape(description)}">
<meta property="og:url" content="{canonical}">
<meta property="og:site_name" content="{escape(cfg["site_name"])}">
<meta property="og:locale" content="ko_KR">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%231f6feb'/%3E%3Ctext x='16' y='23' font-size='18' text-anchor='middle' fill='white' font-family='sans-serif' font-weight='700'%3E%3D%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="{base}assets/style.css?v={VERSION}">
{head_extras()}
{ld}
{js}
</head>
<body>
<header class="site"><div class="wrap">
  <a class="brand" href="{base}">{escape(cfg["site_name"])}</a>
  <nav><a href="{base}#all">전체 계산기</a></nav>
</div></header>
<main class="wrap">
{crumb_html}
{body}
</main>
<footer class="site"><div class="wrap">
  <p><a href="{base}about/">소개</a><a href="{base}privacy/">개인정보처리방침</a></p>
  <p>계산 결과는 참고용이며 실제 금액은 회사·금융기관·관계 법령에 따라 달라질 수 있습니다.</p>
  <p>© {date.today().year} {escape(cfg["site_name"])}</p>
</div></footer>
</body>
</html>
"""


def cards(tools, base, exclude=None):
    items = "".join(
        f'<li><a href="{base}{t["slug"]}/"><strong>{escape(t["title"])}</strong>'
        f'<span>{escape(t["short"])}</span></a></li>'
        for t in tools if t["slug"] != exclude
    )
    return f'<ul class="cards">{items}</ul>'


def build_tool(t, tools):
    base = "../"
    related = [x for x in tools if x["category"] == t["category"] and x["slug"] != t["slug"]]
    related += [x for x in tools if x["category"] != t["category"]][: max(0, 6 - len(related))]
    body = f"""<h1>{escape(t["title"])}</h1>
<p class="lead">{escape(t["lead"])}</p>
{t["calc"]}
<article class="guide">
{t["guide"]}
</article>
<section class="related">
<h2>함께 쓰는 계산기</h2>
{cards(related, base)}
</section>"""
    jsonld = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": t["title"],
        "description": t["description"],
        "url": f'{SITE_URL}/{t["slug"]}/',
        "applicationCategory": "UtilitiesApplication",
        "operatingSystem": "All",
        "inLanguage": "ko",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "KRW"},
    }
    return page(base=base, path=f'{t["slug"]}/', title=t["title"], description=t["description"],
                body=body, crumb=t["category"], jsonld=jsonld)


def build_index(tools):
    sections = []
    for cat in CATEGORY_ORDER:
        group = [t for t in tools if t["category"] == cat]
        if group:
            sections.append(f"<h2>{escape(cat)}</h2>{cards(group, '')}")
    body = f"""<h1>{escape(cfg["site_name"])}</h1>
<p class="lead">{escape(cfg["site_tagline"])}. 회원가입 없이 무료로, 입력하는 즉시 계산됩니다.</p>
<section id="all">
{"".join(sections)}
</section>"""
    jsonld = {"@context": "https://schema.org", "@type": "WebSite", "name": cfg["site_name"], "url": f"{SITE_URL}/", "inLanguage": "ko"}
    return page(base="", path="", title=cfg["site_name"], description=f'{cfg["site_tagline"]}. 무료 생활 계산기 모음.',
                body=body, jsonld=jsonld, scripts=False)


def build_static(slug, title, html_body):
    return page(base="../", path=f"{slug}/", title=title, description=f'{cfg["site_name"]} {title}',
                body=f"<h1>{escape(title)}</h1>\n<article class=\"guide\">{html_body}</article>", scripts=False)


def about_body():
    contact = f'<p>문의: <a href="mailto:{escape(cfg["contact_email"])}">{escape(cfg["contact_email"])}</a></p>' if cfg.get("contact_email") else ""
    return f"""<p>{escape(cfg["site_name"])}는 일상과 직장생활에서 자주 하는 계산을 빠르고 정확하게 할 수 있도록 만든 무료 계산기 모음입니다.</p>
<p>모든 계산은 여러분의 브라우저 안에서만 이루어지며, 입력한 숫자는 서버로 전송되거나 저장되지 않습니다.</p>
<p>각 계산기에는 계산 공식과 근거 법령, 자주 묻는 질문을 함께 정리했습니다. 다만 결과는 참고용이며, 실제 지급액·이자는 회사 규정이나 금융기관의 계산 방식에 따라 달라질 수 있습니다.</p>
{contact}"""


def privacy_body():
    return f"""<p>{escape(cfg["site_name"])}(이하 '사이트')는 이용자의 개인정보를 중요하게 생각합니다.</p>
<h2>1. 수집하는 정보</h2>
<p>사이트는 회원가입이 없으며 이름, 연락처 등 개인을 식별할 수 있는 정보를 수집하지 않습니다. 계산기에 입력한 값은 브라우저 안에서만 처리되고 서버로 전송되지 않습니다.</p>
<h2>2. 쿠키와 광고</h2>
<p>사이트는 운영 비용을 위해 Google AdSense 광고를 게재할 수 있습니다. Google을 포함한 제3자 광고 사업자는 쿠키를 사용해 이용자의 이 사이트 및 다른 사이트 방문 기록을 바탕으로 광고를 제공할 수 있습니다.</p>
<p>이용자는 <a href="https://adssettings.google.com" rel="nofollow">Google 광고 설정</a>에서 맞춤 광고를 끌 수 있으며, 자세한 내용은 <a href="https://policies.google.com/technologies/ads?hl=ko" rel="nofollow">Google 광고 정책</a>에서 확인할 수 있습니다. 브라우저 설정에서 쿠키 저장을 거부할 수도 있습니다.</p>
<h2>3. 방문 통계</h2>
<p>서비스 개선을 위해 호스팅 업체가 제공하는 익명 접속 통계(페이지 조회 수 등)를 참고할 수 있으며, 이 정보로 개인을 식별하지 않습니다.</p>
<h2>4. 변경</h2>
<p>이 방침이 바뀌면 이 페이지에 공지합니다.</p>
<p>시행일: {date.today().isoformat()}</p>"""


def main():
    tools = load_tools()
    if DIST.exists():
        shutil.rmtree(DIST)
    (DIST / "assets").mkdir(parents=True)
    for f in (ROOT / "assets").iterdir():
        shutil.copy(f, DIST / "assets" / f.name)

    def write(rel, content):
        p = DIST / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")

    write("index.html", build_index(tools))
    for t in tools:
        write(f'{t["slug"]}/index.html', build_tool(t, tools))
    write("about/index.html", build_static("about", "소개", about_body()))
    write("privacy/index.html", build_static("privacy", "개인정보처리방침", privacy_body()))
    write("404.html", f'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
                      f'<title>페이지를 찾을 수 없습니다</title><body style="font-family:sans-serif;padding:40px 16px;text-align:center">'
                      f'<h1>페이지를 찾을 수 없습니다</h1><p><a href="{SITE_URL}/">{escape(cfg["site_name"])} 홈으로</a></p></body>')

    today = date.today().isoformat()
    urls = [""] + [f'{t["slug"]}/' for t in tools] + ["about/", "privacy/"]
    write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          + "".join(f"  <url><loc>{SITE_URL}/{u}</loc><lastmod>{today}</lastmod></url>\n" for u in urls) + "</urlset>\n")
    write("robots.txt", f"User-agent: *\nAllow: /\nSitemap: {SITE_URL}/sitemap.xml\n")
    if cfg.get("adsense_client"):
        pub = cfg["adsense_client"].replace("ca-", "")
        write("ads.txt", f"google.com, {pub}, DIRECT, f08c47fec0942fa0\n")
    (DIST / ".nojekyll").write_text("")

    print(f"{len(tools)}개 계산기 → {DIST}")


if __name__ == "__main__":
    main()
