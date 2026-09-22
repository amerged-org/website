"""Remove inline <style> blocks and style="" attributes from the ported SVG
modules. amerged.com serves a CSP without 'unsafe-inline' for styles; the
equivalent rules live in app/globals.css ("SVG styles" section)."""
import json, re, sys
for path in sys.argv[1:]:
    src = open(path).read()
    head, _, rest = src.partition('= ')
    svg = json.loads(rest[:rest.rindex(';')])
    before = svg
    svg = re.sub(r'<style>[\s\S]*?</style>', '', svg)
    # Every style attribute duplicates a presentation attribute on the same
    # element (fill="none", fill="#b12c2b", font-style="italic").
    svg = re.sub(r' style="(fill:none|fill:#b12c2b|font-style:italic!important)"', '', svg)
    assert ' style="' not in svg and '<style' not in svg, path
    open(path, 'w').write(head + '= ' + json.dumps(svg, ensure_ascii=False) + ';\n')
    print(path, len(before), '->', len(svg))
