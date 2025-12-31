export function boundingBox(poly: { x: number; y: number; }[]) {
    const xs = poly.map(({ x }) => x);
    const ys = poly.map(({ y }) => y);
    const minMax = (vs: number[]) => vs.reduce(
        ({ min, max }, v) => ({ min: Math.min(min, v), max: Math.max(max, v) }),
        { min: Infinity, max: -Infinity });
    const mx = minMax(xs);
    const my = minMax(ys);
    return {
        minX: mx.min, maxX: mx.max,
        minY: my.min, maxY: my.max,
        width: mx.max - mx.min, height: my.max - my.min
    };
}
