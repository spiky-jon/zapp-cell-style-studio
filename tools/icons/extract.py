import json, os, re, sys
N='node_modules/'
# role: (lucide, phosphor, tabler, heroicons, material)
R = {
 'play': ('play','play','player-play','play','play_arrow'),
 'plus': ('plus','plus','plus','plus','add'),
 'check': ('check','check','check','check','check'),
 'heart': ('heart','heart','heart','heart','favorite'),
 'bookmark': ('bookmark','bookmark-simple','bookmark','bookmark','bookmark'),
 'share-ios': ('share','export','share-3','arrow-up-on-square','ios_share'),
 'share-network': ('share-2','share-network','share','share','share'),
 'download': ('download','download-simple','download','arrow-down-tray','download'),
 'download-progress': ('loader-circle','circle-notch','loader-2','arrow-path','progress_activity'),
 'download-done': ('circle-check','check-circle','circle-check','check-circle','check_circle'),
 'download-error': ('circle-alert','warning-circle','alert-circle','exclamation-circle','error'),
 'download-expired': ('clock','clock','clock','clock','schedule'),
 'trailer': ('clapperboard','film-slate','movie','film','movie'),
 'calendar-plus': ('calendar-plus','calendar-plus','calendar-plus','calendar','calendar_add_on'),
 'more-horizontal': ('ellipsis','dots-three','dots','ellipsis-horizontal','more_horiz'),
 'more-vertical': ('ellipsis-vertical','dots-three-vertical','dots-vertical','ellipsis-vertical','more_vert'),
 'volume-mute': ('volume-x','speaker-x','volume-off','speaker-x-mark','volume_off'),
 'volume-on': ('volume-2','speaker-high','volume','speaker-wave','volume_up'),
 'chevron-right': ('chevron-right','caret-right','chevron-right','chevron-right','chevron_right'),
 'chevron-left': ('chevron-left','caret-left','chevron-left','chevron-left','chevron_left'),
 'chevron-down': ('chevron-down','caret-down','chevron-down','chevron-down','keyboard_arrow_down'),
 'chevron-up': ('chevron-up','caret-up','chevron-up','chevron-up','keyboard_arrow_up'),
 'arrow-right': ('arrow-right','arrow-right','arrow-right','arrow-right','arrow_forward'),
 'info': ('info','info','info-circle','information-circle','info'),
 'close': ('x','x','x','x-mark','close'),
 'lock': ('lock','lock','lock','lock-closed','lock'),
 'search': ('search','magnifying-glass','search','magnifying-glass','search'),
 'star': ('star','star','star','star','star'),
 'live': ('radio','broadcast','broadcast','signal','sensors'),
 'list': ('list','list','list','bars-3','menu'),
}
LIBS = [
 ('lucide', 'Lucide', 'Outline, 2px rounded strokes (iOS-like, Feather family)', 'ISC', 0, lambda n: f'{N}lucide-static/icons/{n}.svg'),
 ('phosphor-regular', 'Phosphor Regular', 'Outline, 1.5px rounded strokes, friendly geometric', 'MIT', 1, lambda n: f'{N}@phosphor-icons/core/assets/regular/{n}.svg'),
 ('phosphor-bold', 'Phosphor Bold', 'Heavy outline, bold rounded strokes', 'MIT', 1, lambda n: f'{N}@phosphor-icons/core/assets/bold/{n}-bold.svg'),
 ('phosphor-fill', 'Phosphor Fill', 'Solid filled shapes, rounded', 'MIT', 1, lambda n: f'{N}@phosphor-icons/core/assets/fill/{n}-fill.svg'),
 ('tabler', 'Tabler Outline', 'Outline, 2px strokes, slightly technical', 'MIT', 2, lambda n: f'{N}@tabler/icons/icons/outline/{n}.svg'),
 ('heroicons-outline', 'Heroicons Outline', 'Outline, 1.5px strokes, clean UI', 'MIT', 3, lambda n: f'{N}heroicons/24/outline/{n}.svg'),
 ('heroicons-solid', 'Heroicons Solid', 'Solid filled, clean UI', 'MIT', 3, lambda n: f'{N}heroicons/24/solid/{n}.svg'),
 ('material-outlined', 'Material Symbols Outlined', 'Android / Google style outline, square-ish ends', 'Apache-2.0', 4, lambda n: f'{N}@material-symbols/svg-400/outlined/{n}.svg'),
 ('material-rounded', 'Material Symbols Rounded', 'Android / Google style outline, rounded ends', 'Apache-2.0', 4, lambda n: f'{N}@material-symbols/svg-400/rounded/{n}.svg'),
 ('material-rounded-fill', 'Material Symbols Rounded Filled', 'Android / Google style, solid filled, rounded', 'Apache-2.0', 4, lambda n: f'{N}@material-symbols/svg-400/rounded/{n}-fill.svg'),
]
def norm(svg, lib):
    svg = re.sub(r'<!--.*?-->', '', svg, flags=re.S).strip()
    svg = re.sub(r'\s(class|width|height)="[^"]*"', '', svg, count=0)
    head = re.match(r'<svg[^>]*>', svg).group(0)
    if 'fill=' not in head and 'stroke=' not in head:
        svg = svg.replace('<svg', '<svg fill="currentColor"', 1)
    return re.sub(r'\s+', ' ', svg)
out = {'version': 1, 'roles': list(R), 'libraries': {}}
miss = []
for lid, name, style, lic, col, path in LIBS:
    icons = {}
    for role, names in R.items():
        p = path(names[col])
        if os.path.exists(p): icons[role] = norm(open(p).read(), lid)
        else: miss.append((lid, role, names[col]))
    out['libraries'][lid] = {'name': name, 'style': style, 'licence': lic, 'icons': icons}
json.dump(out, open(sys.argv[1], 'w'), separators=(',', ':'))
print('missing', miss)
print(os.path.getsize(sys.argv[1]) // 1024, 'KB')
