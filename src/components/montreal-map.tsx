import { Group, Path, Shape } from "react-konva"
import { arrondissementPolys, BBox, montrealBbox, montrealPolys } from "../data/data.compile"
import { useRef, useEffect, memo, useMemo } from "react"
import { Node } from "konva/lib/Node"
import { colorRed60 } from "./story-content"
import { Context } from "konva/lib/Context"
import { ShapeConfig } from "konva/lib/Shape"

const MARGIN = 5

type PathFn = (ctx: Context) => void

function geoPolyAsPath(poly: { x: number, y: number }[], bbox: BBox): PathFn {
    const aspect = bbox.height / bbox.width
    const scale = 100 / bbox.width
    const adjust = (x: number, y: number) => [scale * (x - bbox.minX), 100 * aspect - scale * (y - bbox.minY)] as [number, number]
    return (ctx) => {
        const [{ x, y }, ...next] = poly
        ctx.moveTo(...adjust(x, y))
        next.forEach(({ x, y }) => ctx.lineTo(...adjust(x, y)))
    }
}

const Borough = memo(({ pathFn, bbox, ...rest }: { name: string, pathFn: PathFn, bbox: BBox } & ShapeConfig) => {
    const aspect = bbox.height / bbox.width
    return <Shape
        perfectDrawEnabled={false}
        sceneFunc={(ctx, shape) => {
            ctx.beginPath()
            pathFn(ctx);
            ctx.fillStrokeShape(shape);
        }}
        width={100 + MARGIN * 2}
        height={100 * aspect + MARGIN * 2}
        {...rest} />
})

function computePolys(highlights: { [key: string]: number }) {
    const maxHighlights = Object.values(highlights).reduce((max, v) => Math.max(max, v), 0)

    const bgPolys = montrealPolys
        .map((poly, i) => <Borough
            key={`mtl_${i}`} name="Montreal" fill="white" shadowOffset={{x: .6, y: .6}} shadowColor="#aaa" shadowBlur={.6}
            bbox={montrealBbox} pathFn={geoPolyAsPath(poly, montrealBbox)} />)

    const fgPolys = arrondissementPolys
        .filter(({ name }) => highlights[name] !== undefined)
        .map(({ name, simplePolys }) => {
            const opacity = highlights[name] / maxHighlights
            return <Borough
                key={name} name={name}
                bbox={montrealBbox} pathFn={geoPolyAsPath(simplePolys[0], montrealBbox)}
                fill={colorRed60} opacity={opacity} />
        })

    return { montrealBbox, bgPolys, fgPolys }
}

export function MontrealMap({ highlights }: { highlights: { [key: string]: number } }) {
    const mapRef = useRef<Node>(null)
    useEffect(() => {
        if (!mapRef.current) return
        mapRef.current.cache({ pixelRatio: 10 })
    }, [highlights])

    const { montrealBbox, bgPolys, fgPolys } = useMemo(() => computePolys(highlights), [highlights])

    return (
        <Group
            ref={mapRef as any}
            offsetY={-MARGIN} offsetX={-MARGIN}>
            {bgPolys}
            <Group clipFunc={(ctx) => {
                ctx.beginPath()
                montrealPolys.forEach((poly) => geoPolyAsPath(poly, montrealBbox)(ctx))
            }}>{fgPolys}</Group>
        </Group>
    )
}