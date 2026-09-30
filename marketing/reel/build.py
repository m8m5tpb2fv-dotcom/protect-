import base64, pathlib
R = pathlib.Path(__file__).parent
F = R.parent.parent / "public" / "fonts"
b = lambda n: base64.b64encode((F / n).read_bytes()).decode()
logo = ('<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><g transform="translate(-1.1 -0.3)">'
        '<rect x="8.6" y="6.6" width="4.4" height="19.4" rx="2.2" fill="#0b0b0c"/>'
        '<circle cx="17.4" cy="13" r="6.4" fill="none" stroke="#0b0b0c" stroke-width="4.2"/>'
        '<circle cx="17.4" cy="13" r="1.9" fill="#0b0b0c"/></g></svg>')
s = (R / "template.html").read_text()
s = s.replace("__CYR__", b("inter-cyrillic-wght-normal.woff2")).replace("__LAT__", b("inter-latin-wght-normal.woff2")).replace("__LATEXT__", b("inter-latin-ext-wght-normal.woff2")).replace("__LOGO__", logo)
(R / "reel.html").write_text(s)  # generated, git-ignored
print("ok")
