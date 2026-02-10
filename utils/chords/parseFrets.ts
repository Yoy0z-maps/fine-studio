/**
 * 프렛 문자열을 숫자 배열로 파싱
 * "x02220" → [-1, 0, 2, 2, 2, 0]
 * "577655" → [5, 7, 7, 6, 5, 5]
 * "xcb9a9" → [-1, 12, 11, 9, 10, 9]
 */
export function parseFrets(frets: string | number[]): number[] {
  if (Array.isArray(frets)) {
    return frets;
  }

  return frets.split("").map((char) => {
    if (char === "x" || char === "X") return -1;
    const code = char.charCodeAt(0);
    // '0'-'9' → 0-9
    if (code >= 48 && code <= 57) return code - 48;
    // 'a'-'z' → 10-35
    if (code >= 97 && code <= 122) return code - 87;
    // 'A'-'Z' → 10-35
    if (code >= 65 && code <= 90) return code - 55;
    return -1;
  });
}

/**
 * fingers 문자열도 동일하게 파싱
 */
export function parseFingers(fingers: string | number[]): number[] {
  if (Array.isArray(fingers)) {
    return fingers;
  }
  return fingers.split("").map((char) => {
    const code = char.charCodeAt(0);
    if (code >= 48 && code <= 57) return code - 48;
    return 0;
  });
}

/**
 * barres 문자열/숫자를 숫자 배열로 파싱
 */
export function parseBarres(barres: string | number | number[] | undefined): number[] {
  if (!barres) return [];
  if (Array.isArray(barres)) return barres;
  if (typeof barres === "number") return [barres];
  // 문자열인 경우 숫자로 변환
  const num = parseInt(barres, 10);
  return isNaN(num) ? [] : [num];
}
