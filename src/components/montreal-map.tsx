import { Group, Shape } from "react-konva"
import { arrondissementPolys, montrealBbox, montrealPolys } from "../data/data.compile"
import { BBox } from '../data/utils'
import { useRef, useEffect, memo, useMemo, Ref, MutableRefObject } from "react"
import { Node } from "konva/lib/Node"
import { colorRed60 } from "./story-content"
import { Context } from "konva/lib/Context"
import { ShapeConfig } from "konva/lib/Shape"
import Konva from "konva"

const MARGIN = 5

type PathFn = (ctx: Context) => void

// return a canvas path for a given polygon, as if drawn within the given bounding box
function geoPolyAsPath(poly: { x: number, y: number }[], bbox: BBox): PathFn {
    const aspect = bbox.height / bbox.width
    const scale = 100 / bbox.width
    // adjust coordinates so that the top left corner of the bounding box is (0, 0)
    const adjust = (x: number, y: number) => [scale * (x - bbox.minX), 100 * aspect - scale * (y - bbox.minY)] as [number, number]
    return (ctx) => {
        const [{ x, y }, ...next] = poly
        ctx.moveTo(...adjust(x, y))
        next.forEach(({ x, y }) => ctx.lineTo(...adjust(x, y)))
    }
}

const GeoShape = memo(({ pathFn, bbox, ref, cached, ...rest }: { cached?: boolean, name: string, pathFn: PathFn, bbox: BBox, ref?: Ref<Node> } & ShapeConfig) => {
    const aspect = bbox.height / bbox.width
    useEffect(() => {
        if (!cached || !ref || !(ref as MutableRefObject<Node>).current) return
        const _ref = ref as MutableRefObject<Node> | undefined
        _ref?.current?.cache({ pixelRatio: 10 })
    }, [cached])

    return <Shape
        ref={ref as any}
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

    // polygons for Montreal
    const bgPolys = montrealPolys
        .map((poly, i) => <GeoShape
            cached={true}
            key={`mtl_${i}`} name="Montreal" fill="white" shadowOffset={{ x: .6, y: .6 }} shadowColor="#aaa" shadowBlur={.6}
            bbox={montrealBbox} pathFn={geoPolyAsPath(poly, montrealBbox)} />)

    // polygons for the boroughs to highlight
    const fgPolysProps = arrondissementPolys
        .filter(({ name }) => highlights[name] !== undefined)
        .map(({ name, simplePolys }) => {
            const targetOpacity = highlights[name] / maxHighlights
            return {
                name,
                bbox: montrealBbox,
                pathFn: geoPolyAsPath(simplePolys[0], montrealBbox),
                fill: colorRed60,
                opacity: 0,
                targetOpacity,
            }
        })
        .toSorted((a, b) => a.targetOpacity - b.targetOpacity)

    return { montrealBbox, bgPolys, fgPolysProps }
}

export function MontrealMap({ highlights, animate, offsetX, offsetY }: { offsetX: number, offsetY: number, animate: boolean, highlights: { [key: string]: number } }) {
    const mapRef = useRef<Node>(null)
    const highlightedRefs = useRef<{ node: Node | null, targetOpacity: number }[]>([])

    const { montrealBbox, bgPolys, fgPolysProps } = useMemo(() => computePolys(highlights), [highlights])

    useEffect(() => {
        const animation = new Konva.Animation((frame) => {
            const len = highlightedRefs.current.length
            const totalDur = 4_000 / 2
            const dur = totalDur / len
            const curTime = Math.floor(frame.time / dur)

            highlightedRefs.current.forEach(({ node, targetOpacity }, i) => {
                const val = curTime - i + (frame.time % dur) / dur
                const clamped = Math.max(0, Math.min(1, val))
                node?.setAttr("opacity", clamped * targetOpacity)
            })

            return curTime <= highlightedRefs.current.length
        }, mapRef.current?.getLayer())

        if (animate) animation.start()
        else animation.stop()
        return () => { animation.stop() }
    }, [animate])


    return (
        <Group
            ref={mapRef as any}
            offsetY={-MARGIN + offsetY} offsetX={-MARGIN + offsetX}>
            {/* draw Montreal in the background */}
            {bgPolys}
            <Group clipFunc={(ctx) => {
                // clip anything drawn on top to the real physical limits of Montreal
                // indeed, the data we use for the boroughs extends beyond physical limits, we don't want to see that here
                ctx.beginPath()
                montrealPolys.forEach((poly) => geoPolyAsPath(poly, montrealBbox)(ctx))
            }}>
                {
                    fgPolysProps.map(({ targetOpacity, ...props }, i) => (
                        <GeoShape key={props.name} ref={node => {
                            highlightedRefs.current[i] = { node, targetOpacity }
                        }} {...props} />
                    ))
                }
            </Group>
        </Group>
    )
}