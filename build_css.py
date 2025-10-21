import re
import sys
from pathlib import Path

SOURCE_FILES = ['index.html', 'pharmacy.html']


def extract_classes() -> set[str]:
    classes: set[str] = set()
    patterns = [
        re.compile(r'class="([^"]+)"'),
        re.compile(r"classList\.add\('([^']+)'\)"),
        re.compile(r"classList\.remove\('([^']+)'\)"),
        re.compile(r"classList\.toggle\('([^']+)'"),
    ]
    for file in SOURCE_FILES:
        text = Path(file).read_text()
        for pattern in patterns:
            for match in pattern.findall(text):
                for token in match.split():
                    if token and "${" not in token:
                        classes.add(token)
    return classes


classes = sorted(extract_classes())
class_set = set(classes)

spacing_map = {
    '0': '0rem',
    '0.5': '0.125rem',
    '1': '0.25rem',
    '1.5': '0.375rem',
    '2': '0.5rem',
    '2.5': '0.625rem',
    '3': '0.75rem',
    '3.5': '0.875rem',
    '4': '1rem',
    '5': '1.25rem',
    '6': '1.5rem',
    '8': '2rem',
    '10': '2.5rem',
    '12': '3rem',
    '14': '3.5rem',
    '16': '4rem',
}

color_map = {
    'white': '#ffffff',
    'black': '#000000',
    'brand-500': '#29a3a3',
    'brand-600': '#208181',
    'brand-700': '#196464',
    'slate-50': '#f8fafc',
    'slate-100': '#f1f5f9',
    'slate-200': '#e2e8f0',
    'slate-300': '#cbd5f5',
    'slate-400': '#94a3b8',
    'slate-500': '#64748b',
    'slate-600': '#475569',
    'slate-700': '#334155',
    'slate-800': '#1e293b',
    'slate-900': '#0f172a',
    'slate-950': '#020617',
    'emerald-50': '#ecfdf5',
    'emerald-100': '#d1fae5',
    'emerald-200': '#a7f3d0',
    'emerald-300': '#6ee7b7',
    'emerald-600': '#059669',
    'emerald-700': '#047857',
    'emerald-800': '#065f46',
    'emerald-900': '#14532d',
    'sky-50': '#f0f9ff',
    'sky-100': '#e0f2fe',
    'sky-300': '#7dd3fc',
    'sky-600': '#0284c7',
    'sky-700': '#0369a1',
    'sky-800': '#075985',
    'sky-900': '#0c4a6e',
    'amber-50': '#fffbeb',
    'amber-100': '#fef3c7',
    'amber-200': '#fde68a',
    'amber-300': '#fcd34d',
    'amber-700': '#b45309',
    'amber-800': '#92400e',
    'amber-900': '#78350f',
    'red-100': '#fee2e2',
    'red-400': '#f87171',
    'red-600': '#dc2626',
    'red-900': '#7f1d1d',
}

alpha_re = re.compile(r'^(?P<base>[a-z0-9\-]+)/(\d+)$')


def color_value(token: str) -> str | None:
    if token in color_map:
        return color_map[token]
    match = alpha_re.match(token)
    if match:
        base = match.group('base')
        alpha = int(match.group(2)) / 100
        hex_val = color_map.get(base)
        if hex_val:
            r, g, b = (int(hex_val[i:i+2], 16) for i in (1, 3, 5))
            return f'rgba({r}, {g}, {b}, {alpha:.2f})'
    return None


font_sizes = {
    'text-xs': ('0.75rem', '1rem'),
    'text-sm': ('0.875rem', '1.25rem'),
    'text-base': ('1rem', '1.5rem'),
    'text-lg': ('1.125rem', '1.75rem'),
    'text-xl': ('1.25rem', '1.75rem'),
    'text-2xl': ('1.5rem', '2rem'),
    'text-4xl': ('2.25rem', '2.5rem'),
    'text-5xl': ('3rem', '1'),
}

shadow_map = {
    'shadow-soft': '0 16px 40px rgba(2,6,23,0.12)',
    'shadow-lg': '0 20px 25px -5px rgba(15,23,42,0.1), 0 10px 10px -5px rgba(15,23,42,0.04)',
}

z_map = {
    'z-30': '30',
    'z-40': '40',
    'z-50': '50',
    'z-[60]': '60',
    'z-[70]': '70',
    'z-[80]': '80',
}

size_map = {
    'size-4': '1rem',
    'size-5': '1.25rem',
    'h-6': '1.5rem',
    'h-10': '2.5rem',
    'h-24': '6rem',
    'w-6': '1.5rem',
    'w-10': '2.5rem',
    'w-24': '6rem',
}

max_w_map = {
    'max-w-2xl': '42rem',
    'max-w-3xl': '48rem',
    'max-w-4xl': '56rem',
    'max-w-5xl': '64rem',
    'max-w-lg': '32rem',
    'max-w-md': '28rem',
}

spacing_pattern = re.compile(r'^(?P<prop>[mp][trblxy]?)-(?P<val>-?[0-9]+(?:\.[05])?)$')
spacey_pattern = re.compile(r'^space-y-(?P<val>[0-9]+(?:\.[05])?)$')
gap_pattern = re.compile(r'^gap-(?P<val>[0-9]+(?:\.[05])?)$')
arbitrary_pattern = re.compile(r'^(?P<prop>[a-z\-]+)\[(?P<value>.+)\]$')

rules: list[str] = []


def esc(cls: str) -> str:
    return (cls.replace('\\', r'\\')
               .replace(':', r'\:')
               .replace('/', r'\/')
               .replace('[', r'\[')
               .replace(']', r'\]')
               .replace('%', r'\%')
               .replace('(', r'\(')
               .replace(')', r'\)')
               .replace('.', r'\.')
               .replace(',', r'\,')
               .replace(' ', r'\ '))


def add_rule(selector: str, declaration: str, media: str | None = None) -> None:
    if not declaration:
        return
    block = f"{selector} {{{declaration}}}"
    if media:
        block = f"{media} {{{block}}}"
    rules.append(block)


base_rules = {
    'absolute': 'position: absolute;',
    'relative': 'position: relative;',
    'fixed': 'position: fixed;',
    'sticky': 'position: sticky;',
    'inset-0': 'top: 0; right: 0; bottom: 0; left: 0;',
    'top-0': 'top: 0;',
    'top-3': 'top: 0.75rem;',
    'top-16': 'top: 4rem;',
    'bottom-4': 'bottom: 1rem;',
    'left-3': 'left: 0.75rem;',
    'left-1/2': 'left: 50%;',
    'right-3': 'right: 0.75rem;',
    'w-full': 'width: 100%;',
    'w-fit': 'width: fit-content;',
    'h-full': 'height: 100%;',
    'h-px': 'height: 1px;',
    'max-h-[90vh]': 'max-height: 90vh;',
    'min-h-full': 'min-height: 100%;',
    'min-h-[100svh]': 'min-height: 100svh;',
    'ml-auto': 'margin-left: auto;',
    'mx-auto': 'margin-left: auto; margin-right: auto;',
    'inline-flex': 'display: inline-flex;',
    'flex': 'display: flex;',
    'flex-1': 'flex: 1 1 0%;',
    'flex-col': 'flex-direction: column;',
    'flex-wrap': 'flex-wrap: wrap;',
    'grid': 'display: grid;',
    'grid-cols-1': 'grid-template-columns: repeat(1, minmax(0, 1fr));',
    'grid-cols-2': 'grid-template-columns: repeat(2, minmax(0, 1fr));',
    'items-center': 'align-items: center;',
    'items-start': 'align-items: flex-start;',
    'justify-between': 'justify-content: space-between;',
    'justify-center': 'justify-content: center;',
    'justify-end': 'justify-content: flex-end;',
    'place-items-center': 'place-items: center;',
    'hidden': 'display: none;',
    'block': 'display: block;',
    'text-center': 'text-align: center;',
    'overflow-hidden': 'overflow: hidden;',
    'overflow-y-auto': 'overflow-y: auto;',
    'pointer-events-none': 'pointer-events: none;',
    'pointer-events-auto': 'pointer-events: auto;',
    'whitespace-pre-wrap': 'white-space: pre-wrap;',
    'break-all': 'word-break: break-all;',
    'list-decimal': 'list-style-type: decimal;',
    'underline': 'text-decoration: underline;',
    'underline-offset-4': 'text-underline-offset: 4px;',
    'tracking-tight': 'letter-spacing: -0.01em;',
    'leading-relaxed': 'line-height: 1.625;',
    'font-sans': "font-family: 'Inter','ui-sans-serif','system-ui','-apple-system','Segoe UI','Helvetica','Arial',sans-serif;",
    'font-medium': 'font-weight: 500;',
    'font-semibold': 'font-weight: 600;',
    'font-bold': 'font-weight: 700;',
    'font-extrabold': 'font-weight: 800;',
    'rounded-xl': 'border-radius: 0.75rem;',
    'rounded-lg': 'border-radius: 0.5rem;',
    'rounded-2xl': 'border-radius: 1rem;',
    'rounded-3xl': 'border-radius: 1.5rem;',
    'rounded-b-2xl': 'border-bottom-left-radius: 1rem; border-bottom-right-radius: 1rem;',
    'border': 'border-width: 1px; border-style: solid;',
    'border-b': 'border-bottom-width: 1px; border-bottom-style: solid;',
    'backdrop-blur': 'backdrop-filter: blur(20px);',
    'backdrop-blur-sm': 'backdrop-filter: blur(4px);',
    'accent-brand-600': 'accent-color: #208181;',
    'btn': 'display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.5rem 0.75rem; border-radius: 0.75rem; border-width: 1px; border-style: solid; font-weight: 600; transition: background-color .2s ease, opacity .2s ease, color .2s ease;',
    'card': 'border-radius: 1rem; background-color: rgba(255,255,255,0.9); backdrop-filter: blur(8px); border: 1px solid rgba(226,232,240,1); padding: 1rem; box-shadow: 0 16px 40px rgba(2,6,23,0.12);',
}

for cls, decl in base_rules.items():
    if cls in class_set:
        add_rule(f".{esc(cls)}", decl)

for cls, shadow in shadow_map.items():
    if cls in class_set:
        add_rule(f".{esc(cls)}", f"box-shadow: {shadow};")

for cls, z in z_map.items():
    if cls in class_set:
        add_rule(f".{esc(cls)}", f"z-index: {z};")

for cls, size in size_map.items():
    if cls in class_set:
        if cls.startswith('size-'):
            add_rule(f".{esc(cls)}", f"width: {size}; height: {size};")
        elif cls.startswith('h-'):
            add_rule(f".{esc(cls)}", f"height: {size};")
        elif cls.startswith('w-'):
            add_rule(f".{esc(cls)}", f"width: {size};")

for cls, maxw in max_w_map.items():
    if cls in class_set:
        add_rule(f".{esc(cls)}", f"max-width: {maxw};")

transform_rules = {
    '-mt-3': 'margin-top: -0.75rem;',
    '-translate-x-1/2': 'transform: translateX(-50%);',
}
for cls, decl in transform_rules.items():
    if cls in classes:
        add_rule(f".{esc(cls)}", decl)

for cls in classes:
    match = spacing_pattern.match(cls)
    if not match:
        continue
    prop, val = match.group('prop'), match.group('val')
    negative = val.startswith('-')
    if negative:
        val = val[1:]
    rem = spacing_map.get(val)
    if rem is None:
        continue
    if negative:
        if rem.startswith('-'):
            rem = rem[1:]
        rem = f"-{rem}"
    if prop == 'p':
        declaration = f"padding: {rem};"
    elif prop == 'px':
        declaration = f"padding-left: {rem}; padding-right: {rem};"
    elif prop == 'py':
        declaration = f"padding-top: {rem}; padding-bottom: {rem};"
    elif prop == 'pt':
        declaration = f"padding-top: {rem};"
    elif prop == 'pb':
        declaration = f"padding-bottom: {rem};"
    elif prop == 'pl':
        declaration = f"padding-left: {rem};"
    elif prop == 'pr':
        declaration = f"padding-right: {rem};"
    elif prop == 'm':
        declaration = f"margin: {rem};"
    elif prop == 'mx':
        declaration = f"margin-left: {rem}; margin-right: {rem};"
    elif prop == 'my':
        declaration = f"margin-top: {rem}; margin-bottom: {rem};"
    elif prop == 'mt':
        declaration = f"margin-top: {rem};"
    elif prop == 'mb':
        declaration = f"margin-bottom: {rem};"
    elif prop == 'ml':
        declaration = f"margin-left: {rem};"
    elif prop == 'mr':
        declaration = f"margin-right: {rem};"
    else:
        continue
    add_rule(f".{esc(cls)}", declaration)

for cls in classes:
    match = spacey_pattern.match(cls)
    if match:
        rem = spacing_map.get(match.group('val'))
        if rem:
            add_rule(f".{esc(cls)} > :not([hidden]) ~ :not([hidden])", f"margin-top: {rem};")

for cls in classes:
    match = gap_pattern.match(cls)
    if match:
        rem = spacing_map.get(match.group('val'))
        if rem:
            add_rule(f".{esc(cls)}", f"gap: {rem};")

for cls in classes:
    match = arbitrary_pattern.match(cls)
    if match:
        prop, value = match.group('prop'), match.group('value')
        if prop == 'w':
            add_rule(f".{esc(cls)}", f"width: {value};")
        elif prop == 'max-h':
            add_rule(f".{esc(cls)}", f"max-height: {value};")

opacity_values = {
    'opacity-50': '0.5',
    'opacity-60': '0.6',
    'opacity-80': '0.8',
    'opacity-90': '0.9',
}
for cls, val in opacity_values.items():
    if cls in class_set:
        add_rule(f".{esc(cls)}", f"opacity: {val};")

for cls, (size, lh) in font_sizes.items():
    if cls in class_set:
        add_rule(f".{esc(cls)}", f"font-size: {size}; line-height: {lh};")

for cls in classes:
    if cls.startswith('text-'):
        value = color_value(cls[len('text-'):])
        if value:
            add_rule(f".{esc(cls)}", f"color: {value};")
    elif cls.startswith('bg-'):
        value = color_value(cls[len('bg-'):])
        if value:
            add_rule(f".{esc(cls)}", f"background-color: {value};")
    elif cls.startswith('border-'):
        value = color_value(cls[len('border-'):])
        if value:
            add_rule(f".{esc(cls)}", f"border-color: {value};")

if 'bg-gradient-to-r' in class_set:
    add_rule('.bg-gradient-to-r', 'background-image: linear-gradient(to right, var(--tw-gradient-stops));')
if 'from-brand-500' in class_set:
    add_rule(
        '.from-brand-500',
        '--tw-gradient-from: #29a3a3; '
        '--tw-gradient-to: rgba(41,163,163,0); '
        '--tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(41,163,163,0));'
    )
if 'to-brand-600' in class_set:
    add_rule('.to-brand-600', '--tw-gradient-to: #208181;')

if 'focus:outline-none' in class_set:
    add_rule('.focus\:outline-none:focus', 'outline: none;')
if 'focus:ring-4' in class_set:
    add_rule('.focus\:ring-4:focus', 'box-shadow: 0 0 0 4px var(--tw-focus-ring, rgba(41,163,163,0.3));')
if 'focus:ring-brand-500/30' in class_set:
    add_rule('.focus\:ring-brand-500\/30', '--tw-focus-ring: rgba(41,163,163,0.3);')

hover_colors = {
    'hover:bg-white': '#ffffff',
    'hover:bg-white/70': 'rgba(255,255,255,0.7)',
    'hover:bg-brand-50': 'rgba(41,163,163,0.1)',
    'hover:bg-brand-700': '#196464',
    'hover:bg-emerald-700': '#047857',
    'hover:bg-emerald-100/60': 'rgba(209,250,229,0.6)',
    'hover:bg-sky-700': '#0369a1',
    'hover:bg-slate-100': '#f1f5f9',
    'hover:bg-slate-50': '#f8fafc',
}
for cls, color in hover_colors.items():
    if cls in class_set:
        add_rule(f".{esc(cls)}:hover", f"background-color: {color};")

for cls in classes:
    if cls.startswith('hover:opacity-'):
        value = int(cls.split('-')[-1]) / 100
        add_rule(f".{esc(cls)}:hover", f"opacity: {value};")

for cls in classes:
    if cls.startswith('dark:hover:'):
        base = cls[len('dark:hover:'):]
        if base.startswith('bg-'):
            value = color_value(base[3:])
            if value:
                add_rule(f"html.dark .{esc(cls)}:hover", f"background-color: {value};")

for cls in classes:
    if cls.startswith('dark:bg-'):
        value = color_value(cls[len('dark:bg-'):])
        if value:
            add_rule(f"html.dark .{esc(cls)}", f"background-color: {value};")
    elif cls.startswith('dark:text-'):
        value = color_value(cls[len('dark:text-'):])
        if value:
            add_rule(f"html.dark .{esc(cls)}", f"color: {value};")
    elif cls.startswith('dark:border-'):
        value = color_value(cls[len('dark:border-'):])
        if value:
            add_rule(f"html.dark .{esc(cls)}", f"border-color: {value};")

sm_media = '@media (min-width: 640px)'
md_media = '@media (min-width: 768px)'

for cls in classes:
    if cls.startswith('sm:'):
        base = cls.split(':', 1)[1]
        rule = None
        if base.startswith('grid-cols-'):
            cols = base.split('-')[-1]
            rule = f"grid-template-columns: repeat({cols}, minmax(0, 1fr));"
        elif base == 'hidden':
            rule = 'display: none;'
        elif base == 'inline':
            rule = 'display: inline;'
        elif base == 'gap-5':
            rule = f"gap: {spacing_map['5']};"
        elif base == 'text-5xl':
            size, lh = font_sizes['text-5xl']
            rule = f"font-size: {size}; line-height: {lh};"
        elif base == 'text-base':
            size, lh = font_sizes['text-base']
            rule = f"font-size: {size}; line-height: {lh};"
        if rule:
            add_rule(f".{esc(cls)}", rule, sm_media)

for cls in classes:
    if cls.startswith('md:') and cls.split(':', 1)[1].startswith('grid-cols-'):
        cols = cls.split('-')[-1]
        add_rule(f".{esc(cls)}", f"grid-template-columns: repeat({cols}, minmax(0, 1fr));", md_media)

for cls in classes:
    if cls.startswith('placeholder:text-'):
        value = color_value(cls.split(':')[-1][len('text-'):])
        if value:
            add_rule(f".{esc(cls)}::placeholder", f"color: {value};")

for cls in classes:
    if cls.startswith('opacity-') and cls not in opacity_values:
        try:
            value = int(cls.split('-')[-1]) / 100
            add_rule(f".{esc(cls)}", f"opacity: {value};")
        except ValueError:
            pass

component_rules = {
    'badge': 'display: inline-flex; align-items: center; gap: 6px; padding: 0.25rem 0.5rem; border-radius: 999px; font-size: 0.75rem;',
    'avail': 'background-color: #ecfdf5; color: #047857; border-radius: 999px; padding: 0.125rem 0.5rem; font-size: 0.75rem;',
    'unavail': 'background-color: #fee2e2; color: #b91c1c; border-radius: 999px; padding: 0.125rem 0.5rem; font-size: 0.75rem;',
    'select-pharm': 'display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; border-radius: 0.75rem; padding: 0.5rem 0.75rem; font-weight: 600;',
    'gen-chk': 'width: 1rem; height: 1rem;',
}
for cls, decl in component_rules.items():
    if cls in class_set:
        add_rule(f".{esc(cls)}", decl)

if 'btn' in class_set:
    add_rule('html.dark .btn', 'background-color: rgba(15,23,42,0.2); border-color: rgba(71,85,105,0.6); color: #e2e8f0;')
if 'card' in class_set:
    add_rule('html.dark .card', 'background-color: rgba(15,23,42,0.6); border-color: rgba(71,85,105,0.6); box-shadow: 0 16px 40px rgba(2,6,23,0.45);')

styles_path = Path('styles')
styles_path.mkdir(exist_ok=True)
styles_path.joinpath('tailwind-lite.css').write_text('\n'.join(rules) + '\n')
print('Generated', len(rules), 'rules', file=sys.stderr)
