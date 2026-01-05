import { Node } from "konva/lib/Node";
import { Shape, Text } from "react-konva";
import { TextConfig } from "konva/lib/shapes/Text";
import { useEffect, useRef } from "react";
import { Context } from "konva/lib/Context";
import Konva from "konva";

export function TextShaky(props: TextConfig) {
    const textRef = useRef<Node>(null)
    const shakeValue = useRef([-1, 1])

    useEffect(() => {
        const animation = new Konva.Animation((frame) => {
            if (!textRef.current) return
            shakeValue.current = [Math.cos(frame.time * 3e-2), Math.sin(frame.time * 3e-2)]
        }, textRef.current?.getLayer())
        animation.start()
        return () => { animation.stop() }
    }, [])

    return <Text {...props}
        ref={textRef as any}
        charRenderFunc={({ context, index }: { context: Context, index: number }) => {
            const realIndex = Array.from(props.text ?? "").reduce((acc, letter, i) => /\s/.test(letter) || i > index ? acc : acc + 1, 0)
            context.translate(0, 0.10 * shakeValue.current[realIndex % 2])
        }} />
}

let seed = 420;
function pseudoRandom() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

function makeSnowflake(variantCount: number) {
    return {
        x: Math.round(pseudoRandom() * 100),
        y: Math.round(pseudoRandom() * 180),
        phase: pseudoRandom(),
        scale: 0.4 + 0.3 * pseudoRandom(),
        speed: 0.8 + 0.4 * pseudoRandom(),
        variant: Math.round(pseudoRandom() * (variantCount - 1))
    }
}

type SnowFlakeParams = ReturnType<typeof makeSnowflake>

function useLoopingAnimation(animate: boolean) {
    const shapeRef = useRef<Node>(null)
    const drawParams = useRef({
        animationStep: 0,
        canvasHeight: 0
    })
    useEffect(() => {
        const layer = shapeRef.current?.getLayer()
        const animation = new Konva.Animation((frame) => {
            const layerScale = layer?.getAbsoluteScale().y
            const layerHeight = layer?.getHeight()
            if (!shapeRef.current || !layerScale || !layerHeight) return
            drawParams.current = {
                animationStep: (frame.time * 1e-2),
                canvasHeight: 1.1 * layerHeight / layerScale
            }
        }, shapeRef.current?.getLayer())
        animation.start()

        return () => { animation.stop() }
    }, [animate])
    return { drawParams, shapeRef }
}

export function SnowFall({ animate, fill }: { animate: boolean, fill?: string }) {
    // 3 snowflakes variations
    const svgPath = useRef([
        new Path2D("m 0,0 c 0.2,-0.9 0.8,-2.7 -0.8,-1.7 -0.8,0.2 -2.4,1.2 -2.9,0.5 0.8,-1 2.8,-1 3.3,-2.1 -0.6,-1.2 -1.6,-2.2 -2,-3.5 0.9,0.3 1.5,1.2 2.1,1.8 0.4,0.4 0.8,0.8 1.1,1.2 0.3,-1.1 0.5,-2.3 1.1,-3.4 0.6,0 0.2,1.6 0.2,2.3 0,0.5 -0.3,1.2 0.4,0.7 1.1,-0.4 2.2,-1 3.4,-1.2 0.5,1.1 -1.8,1.7 -2.7,2.1 -0.5,0.2 -1,0.4 -1.5,0.5 0.7,0.8 1.5,1.7 1.5,2.8 -0.6,0.3 -1.3,-0.8 -1.9,-1.3 -0.6,-0.5 -0.4,1.4 -1.1,1.4 -0.2,0.2 -0.5,-0.1 -0.4,-0.3 z"),
        new Path2D("m 0,0 c 0.2,-1 0,-2.1 -1.2,-1.3 -0.6,0 -2.4,1.3 -2.4,0.4 1.2,-0.8 2.6,-1.3 3.7,-2.3 -1,-1 -2.2,-1.8 -2.9,-3 1.1,-0.4 2.2,1.4 3.3,1.9 0.7,-1.2 0.1,-3 1.1,-4 0.6,1.3 -0.2,2.9 -0.1,4.2 1,-0.3 2.6,-2.1 3.4,-1.2 -0.4,1.3 -3.7,1.7 -2.3,3.1 0.8,0.3 1.5,2.2 0.1,1.2 -0.7,-0.7 -2.1,-1.3 -1.8,0.3 0.2,0.7 -0.5,3.1 -1,1.6 0,-0.3 0,-0.7 0,-1 z"),
        new Path2D("m 0,0 c -0.3,-1.5 -0.2,-3.1 -0.7,-4.6 -1.5,0.7 -2.7,1.8 -4.1,2.6 0,-0.8 1.3,-1.5 2,-2.1 0.4,-0.4 0.9,-0.7 1.3,-1.1 -1,-0.8 -2.2,-1.5 -3,-2.5 0.7,-1 2.3,0.8 3.3,1.1 1.1,0.3 0.4,-2 0.6,-2.7 0.1,-0.6 -0.2,-2.6 0.3,-2.4 0.5,1.6 0.2,3.4 0.8,5 1.4,-0.7 2.3,-2.2 3.8,-2.5 0.9,0.8 -1.3,1.8 -1.9,2.5 -0.8,0.3 -1.7,1 -0.4,1.5 1,0.8 2.7,1 3.2,2.4 -0.9,0.7 -2.1,-0.4 -3.1,-0.7 -0.5,-0.2 -1,-0.5 -1.5,-0.7 0,1.6 0.2,3.2 0,4.8 -0.2,0.6 -0.6,-0.2 -0.6,-0.4 z")
    ])

    const positions = useRef<SnowFlakeParams[]>([])
    useEffect(() => {
        positions.current = Array.from({ length: 18 }, () => makeSnowflake(svgPath.current.length))
    }, [])

    const { drawParams, shapeRef } = useLoopingAnimation(animate)

    return <Shape ref={shapeRef as any}
        sceneFunc={(context) => {
            const { animationStep, canvasHeight } = drawParams.current
            context.fillStyle = fill ?? "white"

            for (const { x, y, phase, scale, variant, speed } of positions.current) {
                context.save()
                context.translate(
                    x + 2 * Math.cos(animationStep * 0.1 + Math.PI * phase),
                    (y + speed * animationStep) % canvasHeight)
                context.rotate(Math.PI / 24 * Math.cos(animationStep * 0.1 + Math.PI * phase))
                context.scale(scale, scale)
                // use of the paths used to draw snowflakes
                context.fill(svgPath.current[variant])
                context.restore()
            }
        }} />
}