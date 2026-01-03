import { Node } from "konva/lib/Node";
import { Shape } from "react-konva";
import { useEffect, useRef } from "react";
import Konva from "konva";
import { Easings } from "konva/lib/Tween";
import { colorRed60 } from "./story-content";

function useLoopingAnimation({ animate, duration }: { animate: boolean, factor: number, duration: number }) {
    const shapeRef = useRef<Node>(null)
    const drawParams = useRef({
        animationStep: 0,
        canvasHeight: 0
    })

    useEffect(() => {
        const layer = shapeRef.current?.getLayer()
        const layerScale = layer?.getAbsoluteScale().y
        const layerHeight = layer?.getHeight()

        if (!shapeRef.current || !layerScale || !layerHeight) return
        drawParams.current.canvasHeight = 1.1 * layerHeight / layerScale

        const animation = new Konva.Animation((frame) => {
            if (!shapeRef.current) return
            const step = Math.min(1, frame.time / duration)
            drawParams.current.animationStep = 1 - Math.pow(1 - step, 5)
            return step < 1
        }, shapeRef.current.getLayer())

        if (animate) animation.start()
        else animation.stop()
        return () => { animation.stop() }
    }, [animate])
    return { drawParams, shapeRef }
}

function getAnimationParams({ animationStep, canvasHeight, targetValue }: { targetValue: number, animationStep: number, canvasHeight: number }) {
    const segmentCount = 50
    const segmentEvery = 5
    const increment = canvasHeight * (segmentEvery / segmentCount * animationStep * Math.round(targetValue) - .6)

    const offsetOfIndex = (index: number) => increment + index * canvasHeight / segmentCount
    const pageOfIndex = (index: number) => Math.floor(offsetOfIndex(index) / canvasHeight)
    const valueOfIndex = (index: number) => 1 / segmentEvery * (segmentCount - index + pageOfIndex(index) * segmentCount)
    return {
        segmentCount,
        offsetOfIndex,
        valueOfIndex,
        segmentEvery
    }
}

export function Ruler({ animate, fill, fontFamily, targetValue }: { targetValue: number, animate: boolean, fill: string, fontFamily?: string }) {
    const { drawParams, shapeRef } = useLoopingAnimation({ animate, factor: 1, duration: 3_000 })
    fontFamily = fontFamily ?? "ProximaNova"

    return <Shape ref={shapeRef as any}
        sceneFunc={(context) => {
            const { animationStep, canvasHeight } = drawParams.current
            const { segmentCount, offsetOfIndex, valueOfIndex, segmentEvery } = getAnimationParams({ animationStep, canvasHeight, targetValue })

            for (let index = 0; index < segmentCount; index++) {
                context.save()

                const offset = offsetOfIndex(index)
                const value = valueOfIndex(index)
                context.translate(0, offset % canvasHeight)
                context.fillStyle = fill

                if (index % segmentEvery === 0) {
                    context.fillRect(100 - 9, -.5, 9, 1)
                } else {
                    context.fillRect(100 - 3, -.25, 3, .5)
                }

                if (index % (segmentEvery * 5) === 0) {
                    const text = value.toString()
                    context.font = `bold 5px "${fontFamily}", sans-serif`
                    const { actualBoundingBoxAscent, width } = context.measureText(text)
                    context.fillText(text, 100 - width - 12, actualBoundingBoxAscent / 2)
                }

                if (value === Math.round(targetValue)) {
                    const text = `... ${Math.round(targetValue)} km`
                    context.fillStyle = colorRed60
                    context.font = `bold 8px "${fontFamily}", sans-serif`
                    const { actualBoundingBoxAscent, width } = context.measureText(text)
                    context.fillText(text, 100 - width - 12, actualBoundingBoxAscent / 2)
                }

                context.restore()
            }
        }} />
}