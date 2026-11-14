"""Search the style catalog or print an automatic-selection prompt."""

import argparse
import json
from pathlib import Path
import unicodedata


REFERENCES = Path(__file__).resolve().parents[1] / 'references'


def load_modes():
    return json.loads((REFERENCES / 'catalog.json').read_text(encoding='utf-8'))['modes']


def normalized(value):
    return unicodedata.normalize('NFKC', value).strip().casefold()


def find_modes(modes, query):
    needle = normalized(query)
    return [mode for mode in modes if needle in normalized(' '.join([
        mode['title'], *mode['aliases'], mode['family'], mode['usage']
    ]))]


def build_prompt(character, intensity, surface):
    selection = (REFERENCES / 'selection.md').read_text(encoding='utf-8').strip()
    runtime = (REFERENCES / 'runtime.md').read_text(encoding='utf-8').strip()
    appearance = (REFERENCES / 'appearance.md').read_text(encoding='utf-8').strip()
    cards = '\n\n'.join((REFERENCES / mode['card']).read_text(encoding='utf-8').strip() for mode in load_modes())
    display = 'agent-guild。専用の表示構文に対応。' if surface == 'agent-guild' else 'plain。専用構文は使わない。'
    return f'''# キャラクター会話の指定

選択：自動（必要なければ普段の口調）
強度：{intensity}
固定するキャラクター設定：{character}
表示先：{display}

以下の規約とカードに従い、会話に合う話し方を返答ごとに選ぶ。例文を現在の会話の事実へ移さない。

{runtime}

---

{selection}

---

{appearance}

---

{cards}
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    listing = commands.add_parser('list', help='Search by title, alias, category, or use.')
    listing.add_argument('query', nargs='?', default='')
    listing.add_argument('--json', action='store_true')
    prompt = commands.add_parser('prompt', help='Print the automatic-selection instruction.')
    prompt.add_argument('--character', default='既に指定されたキャラクターの設定を維持する。')
    prompt.add_argument('--intensity', choices=['弱', '中', '強'], default='弱')
    prompt.add_argument('--surface', choices=['plain', 'agent-guild'], default='plain')
    args = parser.parse_args()
    if args.command == 'list':
        modes = find_modes(load_modes(), args.query)
        if args.json:
            print(json.dumps(modes, ensure_ascii=False, indent=2))
        else:
            for mode in modes:
                print(f"{mode['title']} [{mode['family']}] — {' / '.join(mode['aliases'])}")
    else:
        print(build_prompt(args.character, args.intensity, args.surface), end='')


if __name__ == '__main__':
    import sys

    sys.stdout.reconfigure(encoding='utf-8')
    main()
