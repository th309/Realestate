/**
 * Stub type declaration for @mapbox/point-geometry.
 *
 * The @types/mapbox__point-geometry package (transitive dep from mapbox-gl)
 * is installed at the monorepo root but ships without an index.d.ts,
 * causing TS2688. This stub satisfies the type resolution.
 */
declare module "@mapbox/point-geometry" {
  class Point {
    x: number;
    y: number;
    constructor(x: number, y: number);
    clone(): Point;
    add(p: Point): Point;
    sub(p: Point): Point;
    mult(k: number): Point;
    div(k: number): Point;
    rotate(angle: number): Point;
    matMult(m: [number, number, number, number]): Point;
    unit(): Point;
    perp(): Point;
    round(): Point;
    mag(): number;
    equals(other: Point): boolean;
    dist(p: Point): number;
    distSqr(p: Point): number;
    angle(): number;
    angleTo(b: Point): number;
    angleWith(b: Point): number;
    angleWithSep(x: number, y: number): number;
    static convert(p: Point | [number, number]): Point;
  }
  export = Point;
}
