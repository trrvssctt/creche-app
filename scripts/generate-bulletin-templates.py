#!/usr/bin/env python3
"""
Génère services/bulletinTemplates.data.ts à partir des modèles Word officiels de l'école.

    python3 scripts/generate-bulletin-templates.py [dossier_des_docx]

Par défaut : assets/Bulletins_news/ (un fichier par niveau : PS, MS, GS, CP, CE1, CE2, CM1, CM2).
Lit directement word/document.xml (aucune dépendance) et extrait, pour chaque niveau,
les rubriques et leurs compétences / observables. Les bilans trimestriels et les
« précisions d'utilisation » ne sont pas repris (ils sont gérés par l'application).

Relancer ce script après toute correction des modèles Word par l'école.
"""

import pathlib
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'assets' / 'Bulletins_news'
OUT = ROOT / 'services' / 'bulletinTemplates.data.ts'

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
NIVEAUX = ['PS', 'MS', 'GS', 'CP', 'CE1', 'CE2', 'CM1', 'CM2']

SKIP = {'T1', 'T2', 'T3', 'Objectif / indicateur observable', 'Compétences / observables'}
CODES_CELL = re.compile(r'^(EA|A|M|NA|EC|NE)( / (EA|A|M|NA|EC|NE))*$')
STOP = re.compile(r'^(APPRÉCIATIONS|PRÉCISIONS D|BILAN PÉRIODIQUE)')


def paragraphs(docx: pathlib.Path) -> list[str]:
    """Textes des paragraphes dans l'ordre du document (cellules de tableaux comprises)."""
    with zipfile.ZipFile(docx) as z:
        root = ET.fromstring(z.read('word/document.xml'))
    out = []
    for p in root.iter(f'{W}p'):
        parts = []
        for node in p.iter():
            if node.tag == f'{W}t' and node.text:
                parts.append(node.text)
            elif node.tag in (f'{W}tab', f'{W}br'):
                parts.append(' ')
        text = re.sub(r'\s+', ' ', ''.join(parts)).strip()
        if text and not re.fullmatch(r'_+', text):
            out.append(text)
    return out


def is_upper_heading(line: str) -> bool:
    letters = [c for c in line if c.isalpha()]
    return len(line) > 4 and bool(letters) and sum(c.isupper() for c in letters) / len(letters) > 0.8


def parse_maternelle(lines):
    """« 1. Domaine » → sous-rubriques (ligne suivie de « Objectif / indicateur observable »)."""
    out, domaine, current = [], None, None
    for i, line in enumerate(lines):
        if STOP.match(line):
            break
        if re.match(r'^\d+\.\s', line):
            domaine, current = line, None
            continue
        if domaine is None or line in SKIP or CODES_CELL.match(line):
            continue
        if i + 1 < len(lines) and lines[i + 1] == 'Objectif / indicateur observable':
            current = {'nom': line, 'section': domaine, 'competences': []}
            out.append(current)
            continue
        if current is not None:
            current['competences'].append(line)
    return out


def parse_cycle2(lines):
    """Rubriques en majuscules ; une compétence est suivie de sa cellule « EA / A / M / NA »."""
    out, current = [], None
    for i, line in enumerate(lines):
        if STOP.match(line):
            break
        if line in SKIP or CODES_CELL.match(line):
            continue
        nxt = lines[i + 1] if i + 1 < len(lines) else ''
        if CODES_CELL.match(nxt):
            if current is not None:
                current['competences'].append(line)
            continue
        if is_upper_heading(line) and not line.startswith(('LE TOIT', 'BULLETIN', 'DOMAINES ET ATTENDUS')):
            current = {'nom': line, 'competences': []}
            out.append(current)
    return out


def parse_cycle3(lines):
    """Rubrique = ligne suivie de « Compétences / observables » ; puis une compétence par ligne."""
    out, current = [], None
    for i, line in enumerate(lines):
        if STOP.match(line):
            break
        nxt = lines[i + 1] if i + 1 < len(lines) else ''
        if nxt == 'Compétences / observables':
            current = {'nom': line, 'competences': []}
            out.append(current)
            continue
        if current is None or line in SKIP or CODES_CELL.match(line):
            continue
        current['competences'].append(line)
    return out


def ts_str(s: str) -> str:
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


def render(grilles: dict) -> str:
    lines = [
        '// GÉNÉRÉ par scripts/generate-bulletin-templates.py depuis les modèles Word de l\'école',
        '// (assets/Bulletins_news/*.docx) — ne pas éditer à la main : corriger le .docx puis relancer.',
        '// Chaque niveau : liste de rubriques ; en maternelle, `section` = domaine d\'apprentissage.',
        '',
        'export interface TemplateDomaine { nom: string; competences: string[]; section?: string; }',
        '',
        'export const BULLETIN_GRILLES: Record<string, TemplateDomaine[]> = {',
    ]
    for niveau in NIVEAUX:
        lines.append(f'  {niveau}: [')
        for d in grilles[niveau]:
            section = f' section: {ts_str(d["section"])},' if d.get('section') else ''
            lines.append(f'    {{ nom: {ts_str(d["nom"])},{section} competences: [')
            lines.extend(f'      {ts_str(c)},' for c in d['competences'])
            lines.append('    ] },')
        lines.append('  ],')
    lines.append('};')
    return '\n'.join(lines) + '\n'


def main():
    grilles = {}
    for docx in sorted(SRC.glob('*.docx')):
        m = re.search(r'\b(PS|MS|GS|CP|CE1|CE2|CM1|CM2)\b', docx.stem)
        if not m:
            continue
        niveau = m.group(1)
        lines = paragraphs(docx)
        parser = parse_maternelle if niveau in ('PS', 'MS', 'GS') else parse_cycle3 if niveau in ('CM1', 'CM2') else parse_cycle2
        rubriques = [d for d in parser(lines) if d['competences']]
        grilles[niveau] = rubriques
        total = sum(len(d['competences']) for d in rubriques)
        print(f'{niveau:4} {len(rubriques):3} rubriques  {total:4} compétences  ← {docx.name}')

    missing = [n for n in NIVEAUX if n not in grilles]
    if missing:
        sys.exit(f'Modèles manquants : {", ".join(missing)} (dans {SRC})')

    OUT.write_text(render(grilles), encoding='utf-8')
    print(f'→ {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
