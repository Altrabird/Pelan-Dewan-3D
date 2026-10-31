"""python tests/e2e.py  — needs the app served at http://localhost:8765 (Mula.bat)."""
import sys, os
from playwright.sync_api import sync_playwright

URL = os.environ.get('URL', 'http://localhost:8765/')
SHOTS = os.path.join(os.path.dirname(__file__), 'shots')
errors, fails = [], []
def check(ok, msg):
    print(('PASS ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1600, 'height': 900})
    pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.reload()
    pg.wait_for_timeout(1500)
    n0 = pg.evaluate('app.plan.items.length')
    check(n0 > 40, f'template loaded ({n0} items)')
    check('298' in pg.inner_text('#summary'), 'seat total shown')
    pg.screenshot(path=f'{SHOTS}/split.png')

    # add a chair block from the palette, then nudge and edit it
    pg.click('[data-add=chairs]')
    it = pg.evaluate('app.plan.items.at(-1)')
    check(it['type'] == 'chairs' and pg.evaluate('app.sel') == it['id'], 'palette adds + selects chair block')
    x0 = it['x']
    pg.keyboard.press('ArrowRight'); pg.keyboard.press('ArrowRight')
    check(abs(pg.evaluate('app.plan.items.at(-1).x') - (x0 + 0.2)) < 1e-6, 'arrow keys nudge')
    pg.fill('#props [data-k=rows]', '6'); pg.dispatch_event('#props [data-k=rows]', 'change')
    check(pg.evaluate('app.plan.items.at(-1).rows') == 6, 'rows edited from properties')
    pg.keyboard.press('Control+z')
    check(pg.evaluate('app.plan.items.at(-1).rows') == 4, 'undo restores rows')
    pg.keyboard.press('Control+z'); pg.keyboard.press('Control+z'); pg.keyboard.press('Control+z')
    check(pg.evaluate('app.plan.items.length') == n0, 'undo back to template')
    pg.keyboard.press('Control+y')
    check(pg.evaluate('app.plan.items.length') == n0 + 1, 'redo')

    # draw a wall with clicks + double-click
    box = pg.locator('#cv').bounding_box()
    pg.click('[data-tool=wall]')
    pg.mouse.click(box['x'] + 60, box['y'] + 60); pg.mouse.click(box['x'] + 160, box['y'] + 60); pg.mouse.dblclick(box['x'] + 160, box['y'] + 140)
    w = pg.evaluate('app.plan.items.at(-1)')
    check(w['type'] == 'wall' and len(w['pts']) == 3, f"wall drawn ({len(w.get('pts', []))} pts)")
    pg.keyboard.press('Delete')
    check(pg.evaluate('app.plan.items.at(-1).type') == 'chairs', 'delete removes selected wall')

    pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(1200)

    # real mouse: click a sofa, drag it 1 m right, rotate it with the handle, undo
    S = 'p => [ed.toS(p).x + document.querySelector("#cv").getBoundingClientRect().left, ed.toS(p).y + document.querySelector("#cv").getBoundingClientRect().top]'
    sofa = pg.evaluate('app.plan.items.find(i => i.type == "sofa")')
    x, y = pg.evaluate(f'({S})({{x:{sofa["x"]}, y:{sofa["y"]}}})')
    k = pg.evaluate('ed.scale')
    pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x + k * 0.5, y, steps=4); pg.mouse.move(x + k, y, steps=4); pg.mouse.up()
    moved = pg.evaluate(f'app.plan.items.find(i => i.id == "{sofa["id"]}")')
    check(pg.evaluate('app.sel') == sofa['id'] and abs(moved['x'] - sofa['x'] - 1) < 0.11, f"mouse drag moves sofa ({sofa['x']} -> {moved['x']})")
    hx, hy = pg.evaluate(f'(() => {{ const h = ed.handles(app.plan.items.find(i => i.id == "{sofa["id"]}")).find(h => h.kind == "rot"); return ({S})(h); }})()')
    pg.mouse.move(hx, hy); pg.mouse.down(); pg.mouse.move(hx + 3 * k, hy + 3 * k, steps=6); pg.mouse.up()
    rot = pg.evaluate(f'app.plan.items.find(i => i.id == "{sofa["id"]}").rot')
    check(rot % 15 == 0 and rot != 0, f'rotate handle snaps to 15° ({rot})')
    pg.keyboard.press('Control+z'); pg.keyboard.press('Control+z')
    check(pg.evaluate(f'app.plan.items.find(i => i.id == "{sofa["id"]}").x') == sofa['x'], 'undo drag')

    # 3D views
    pg.click('[data-view="3d"]'); pg.wait_for_timeout(800)
    pg.screenshot(path=f'{SHOTS}/3d.png')
    pg.click('[data-act=walls]'); pg.wait_for_timeout(500)
    pg.screenshot(path=f'{SHOTS}/3d-lowwalls.png')
    pg.click('[data-act=pov]'); pg.wait_for_timeout(9000)
    pg.screenshot(path=f'{SHOTS}/3d-pov.png')
    check(pg.evaluate('document.querySelector("[data-act=play]").classList.contains("on")'), 'POV starts playback')
    pg.click('[data-act=pov]')
    pg.click('[data-view="2d"]'); pg.wait_for_timeout(500)
    pg.screenshot(path=f'{SHOTS}/2d.png')
    check(not errors, 'no console errors ' + ('' if not errors else str(errors[:3])))
    b.close()
print('ALL OK' if not fails else f'{len(fails)} FAILED'); sys.exit(1 if fails else 0)
