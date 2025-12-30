import { Group, Path } from "react-konva"
import { arrondissementPolys } from "./data/data.compile"
import { useRef, useEffect, memo } from "react"
import { Node } from "konva/lib/Node"
import { colorRed60 } from "./story-content"

const geoPolyAsPath = (poly: { x: number, y: number }[]) => {
    const path = poly.reduce((path, { x, y }, i) => `${path}${i === 0 ? "M" : "L"} ${100 * (74 + x)} ${100 * (46 - y)} `, "")
    // console.log(path)
    return path
}

const Borough = memo(({ name, poly, fill }: { name: string, poly: { x: number, y: number }[], fill: string }) => {
    if (fill === "black") console.log(name, geoPolyAsPath(poly))
    return <Path
        perfectDrawEnabled={false}
        data={geoPolyAsPath(poly)}
        stroke={fill}
        strokeWidth={.5}
        fill={fill} />
})

export function MontrealMap({ highlight }: { highlight?: string }) {
    const mapRef = useRef<Node>(null)
    useEffect(() => {
        if (!mapRef.current) return
        mapRef.current.cache({ pixelRatio: 10 })
    }, [highlight])

    const bgPolys = arrondissementPolys
        .filter(({ name }) => name !== highlight)
        .map(({ name, simplePolys }) => <Borough key={name} name={name} poly={simplePolys[0]} fill="white" />)

    const fgPolys = arrondissementPolys
        .filter(({ name }) => name === highlight)
        .map(({ name, simplePolys }) => <Borough key={name} name={name} poly={simplePolys[0]} fill={colorRed60} />)

    return (
        <Group offsetX={-2} ref={mapRef as any}>
            {bgPolys}
            {fgPolys}
        </Group>
    )
}