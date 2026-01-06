import { Circle, Group, Path } from "react-konva";
import { colorRed60 } from "./story-content";
import { useEffect, useRef, useState } from "react";
import Konva from "konva";
import { Node } from "konva/lib/Node";

function FrontWheel({ animated }: { animated: boolean }) {
    const [wheelFrame, setWheelFrame] = useState(0)
    const ref = useRef<Node>(null)

    const lastTime = useRef(0)
    const animation = useRef(new Konva.Animation((frame) => {
        const curTime = Math.floor(frame.time / 100)
        const draw = curTime !== lastTime.current
        lastTime.current = curTime
        if (draw) {
            setWheelFrame(v => (v + 1) % 5)
        }
        return draw
    }, ref.current?.getLayer()))

    useEffect(() => {
        if (animated) animation.current.start()
    }, [animated])
    return (
        <Group ref={ref as any}>
            <Circle
                x={149} y={76}
                radius={27.7}
                stroke="black"
                strokeWidth={4} />
            {/* cant be bothered to figure out coordinates to rotate the arc instead of duplicating -- oh well, that'll do */}
            {wheelFrame === 0 && <Path
                key="wheel-0"
                stroke="black"
                strokeWidth={2}
                data="m 167.65647,64.911068 a 21.9,21.9 0 0 1 -3.3614,27.954265" />}
            {wheelFrame === 1 && <Path
                key="wheel-1"
                stroke="black"
                strokeWidth={2}
                data="m 166.5231,89.966829 a 21.9,21.9 0 0 1 -27.41222,6.427302" />}
            {wheelFrame === 2 && <Path
                key="wheel-2"
                stroke="black"
                strokeWidth={2}
                data="m 131.66918,89.743993 a 21.9,21.9 0 0 1 1.18366,-28.130747" />}
            {wheelFrame === 3 && <Path
                key="wheel-3"
                stroke="black"
                strokeWidth={2}
                data="m 135.97254,59.187386 a 21.9,21.9 0 0 1 28.13665,1.033918" />}
            {wheelFrame === 4 && <Path
                key="wheel-4"
                stroke="black"
                strokeWidth={2}
                data="m 148.69041,54.756041 a 21.9,21.9 0 0 1 22.20011,17.317478" />}
        </Group>
    )
}

export function BixiBike({ x, y, scale, animated }: { x: number; y: number; scale: number; animated: boolean }) {
    const groupRef = useRef<Node>(null)
    const fullBike = useRef<Node>(null)
    const bikeFrame = useRef<Node>(null)

    useEffect(() => {
        if (!fullBike.current) return
        // cache the render of everything but the animated wheel
        fullBike.current.cache({ pixelRatio: 5 })
    }, [])

    // horizontal oscillation of the bike
    useEffect(() => {
        const animation = new Konva.Animation((frame) => {
            if (!groupRef.current || !bikeFrame.current) return
            const cos = 5 * Math.cos(frame.time * 1e-3)
            groupRef.current.setAttr("offsetX", cos)
        }, groupRef.current?.getLayer())

        if (!animated) animation.stop()
        else animation.start()
        return () => { animation.stop() }
    }, [animated])

    return (
        <Group ref={groupRef as any} x={x} y={y} scaleX={scale} scaleY={scale}>
            <FrontWheel animated={animated} />
            <Group ref={fullBike as any}>
                <Circle
                    x={37} y={76}
                    radius={27.7}
                    stroke="black"
                    strokeWidth={4} />
                <Path
                    fill="#ddd"
                    data="m 64.5,38.7 2.9,-1.4 3.8,10.1 -2.9,1.4 z" />
                <Path
                    fill="#333"
                    data="m 122.3,6 c -9,-0.1 -11.6,0.1 -11.7,2.2 -0.1,2 0.7,2.4 5.6,2.7 5.8,0.4 5.7,0.3 7.6,7.2 1.8,6.7 2.6,9.1 3.1,9.4 1.4,0.3 5,0 5.7,-1.2 4.4,-8.8 1.6,-20.1 -10.3,-20.2 z m 24.8,3.2 c -2.2,-0.1 -1.7,0.2 -1,6.6 0.4,7.9 2.6,12.4 -5.9,12.8 -3.9,0.1 -4.2,0 -6.5,0.1 -1.2,0 -0.9,0.1 -1,1.2 -0.1,1.4 -0.1,2 0.4,2 3.5,0.2 13.6,0.2 15.6,-2.4 1.7,-2.3 0.8,-5.9 0.1,-17.6 -0.2,-2.5 -0.1,-2.5 -1.7,-2.6 z M 75.3,31 c -1,0 -2.2,0 -3.8,0.2 -2.8,0.3 -6.2,0.2 -8.7,-0.3 -5.5,-1.1 -8.7,0.1 -9.3,3.3 -0.7,3.3 6.4,4.6 8.3,4.5 2.8,0 7.8,-1.1 12,-3 0.4,-0.2 2.5,-0.1 3.9,-0.5 1.4,-0.4 3.1,-1.7 1.5,-2.9 -1.3,-0.9 -2.2,-1.3 -3.8,-1.4 z m 63.1,9.7 -7.6,2.4 0.9,3.5 c 0,0 -9.9,7.5 -13.3,15.3 -3.5,8 -3.2,9.3 -3.7,15.3 -0.1,0.7 3.3,1.1 4,0.3 5.2,-6.1 13.3,-13.5 18.3,-18 1.5,-1.3 2.3,-1.3 3.9,2.4 4.5,10.1 5,11 6.7,15.4 0.5,1.3 3.3,0.3 2.9,-1 -2.9,-10.1 -3.3,-11.2 -5.7,-19.7 -0.3,-1 -0.8,-2.9 0.4,-3.8 4.6,-3.6 5.6,-3.9 8.2,-5.8 0.7,-0.5 0.6,-1.6 -0.1,-1.8 -3.3,-1 -5.1,-1.3 -7.6,-1.3 -1.7,0 -5.9,0.7 -5.9,0.7 z m -120.9,10.2 c -6,4.5 -9.2,10.1 -9.2,11.6 15.3,0.9 26.5,1.6 40.1,2.3 1.9,0.1 -4.8,3.4 -3.9,7.8 1.1,3.8 0.6,4.6 25.3,5.7 3.8,0.2 3.6,-5 -1.1,-15.3 -5.9,-13.2 -15.3,-17.8 -24.4,-19.2 -10.3,-1.5 -20.7,2.4 -26.8,7.1 z" />
                <Path
                    ref={bikeFrame as any}
                    fill={colorRed60}
                    data="m 72.9,80.5 c -9.4,-0.5 -17.1,-0.7 -24,-1.1 -10.5,-0.6 -13.5,0.2 -13.6,-2.3 0,-1.9 1.7,-3.8 3.4,-6 6.7,-8.7 12.9,-17.1 28.1,-25.1 0.6,-0.3 -1.5,-0.9 2.2,-2.2 2.1,-0.7 1.4,-1.2 6.1,11.3 0.3,0.8 4.3,11.4 5.1,13.3 1.5,3.5 1.6,3.3 7.2,2.8 17,-1.4 17.9,-14.4 33.8,-34.8 4.2,-5.4 5.3,-4.3 4.5,-6.7 -0.8,-2.3 -0.9,-2.4 1,-2.9 4.6,-1.2 3.7,-1.1 7,-1.9 2,-0.4 1.9,-0.5 2.3,1.2 0.1,0.3 2.3,9.2 3,13.5 0.4,2.1 0.6,2.1 -0.9,2.5 -3.2,0.9 -2.6,0.7 -6.5,1.9 -0.8,0.2 -0.9,0 -1.5,-1.5 -0.2,-0.6 -0.4,-0.7 -0.8,-1.8 -0.3,-0.7 -5.8,8.3 -21.9,33.5 -4.5,7.2 -12.4,6.5 -14.8,6.5 -2.5,0 -0.9,2.2 -4.4,5.1 -6,4.9 -11.2,0.2 -12.2,-1.3 -1,-1.6 -1.2,-4 -3.1,-3.9 z m -0.2,-9.5 c 3.3,0.2 3.1,0.4 2,-2.4 -1.7,-4.4 -3.5,-8.9 -5.2,-13.3 -1.5,-4 -1.4,-4 -3.1,-3.1 -9.5,4.8 -11.1,6.6 -19.9,17.9 1.6,-0.1 26.2,0.9 26.2,0.9 z" />
                <Path
                    fill="#ddd"
                    data="m 81,84 2.3,-1.1 3.6,9.4 -2.3,1.1 z" />
                <Path
                    fill="#333"
                    data="m 82.9,73.7 c -3.5,-0.2 -6.4,2.6 -6.5,6.1 -0.2,3.4 2.6,6.4 6,6.5 3.5,0.2 6.4,-2.6 6.5,-6.1 0.2,-3.4 -2.6,-6.4 -6,-6.5 z m 10.6,19.5 c -4.6,0 -4.3,-0.1 -9.7,0.1 -0.9,0 -0.9,2.7 0,2.7 5.1,0.1 5.3,0.1 9.8,0 0.9,0 0.8,-2.8 -0.1,-2.8 z" />
            </Group>
        </Group>
    );
}

