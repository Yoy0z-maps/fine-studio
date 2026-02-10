from pathlib import Path

dir_path = Path("./assets/data/chords/A")
output_path = Path("./assets/data/chords/CHORDS.ts")

# "-"를 " / "로 변경하고, 루트 대문자로 변경
def to_display_name(stem: str) -> str:
    if "_" not in stem:
        return stem

    left, right = stem.split("_", 1)
    root = right.upper()

    if left == "":
        return root

    return f"{left} / {root}"

# path.glob(".extension") 지정한 디렉토리에서 해당 확장자의 파일들을 반환 =>  Path("~.extension")
# Path("~")는 3가지 속성이 있음, Path("./assets/data/chords/A/7_a#.json") 일 때
# p.name => 7_a#.json (파일이름.확장자)
# p.stem => 7_a#(파일 이름)
# p.suffix => .json(확장자)
file_stems = [p.stem for p in dir_path.glob("*.json")]

display_map = {
    stem: to_display_name(stem)
    for stem in file_stems
}

with open(output_path, "w", encoding="utf-8") as f:
    f.write("export const CHORDS_PATH = [\n")
    for stem in file_stems:
        f.write(f'  "{stem}",\n')
    f.write("];\n\n")

    f.write("const ChordMap = {\n")
    for key, value in display_map.items():
        f.write(f'  "{key}": "{value}",\n')
    f.write("};\n\n")

    f.write("export default ChordMap;\n")

print("Successfully Generate File: CHORDS.ts")

BASE_DIR = Path("./assets/data/chords")
OUTPUT_PATH = BASE_DIR / "CHORD_FILES_MAP.ts"

lines: list[str] = []

lines.append(
    'export const CHORD_FILES_MAP: Record<string, Record<string, any>> = {\n'
)

for root_dir in sorted(p for p in BASE_DIR.iterdir() if p.is_dir()):
    root = root_dir.name

    lines.append(f'  "{root}": {{\n')

    for json_file in sorted(root_dir.glob("*.json")):
        suffix = json_file.stem
        lines.append(
            f'    "{suffix}": require("./{root}/{json_file.name}"),\n'
        )

    lines.append("  },\n")

lines.append("};\n")

OUTPUT_PATH.write_text("".join(lines), encoding="utf-8")

print("Successfully Generate CHORD_FILES_MAP.ts")