import Konva from "konva";
import { useRef, useEffect, Children, ReactNode, useState } from "react";
import { Group, Layer, Rect, Text } from "react-konva";
import { BixiBike } from "./bike";
import { useStories } from "./stories";
import { TextConfig } from "konva/lib/shapes/Text";
import { StatsDetail } from "./stats";
import { Node } from "konva/lib/Node";
import { GroupConfig } from "konva/lib/Group";

export const colorRed60 = window.getComputedStyle(document.body).getPropertyValue("--core-ui-color-red60");
const titleStyle = {
    fontSize: 8,
    fontStyle: "bold",
    fontFamily: "LyftProUI",
    fill: colorRed60
}


function VStack({ children, ...rest }: { children: ReactNode } & GroupConfig) {
    const { playing } = useStories();
    const [offsets, setOffsets] = useState<number[]>([])
    const refs = useRef<Node[]>([])

    useEffect(() => {
        if (!refs.current) return
        const newOffsets = refs.current.reduce((acc, ref, i) => {
            acc.push(ref.getClientRect().height + acc[i])
            return acc
        }, [0])
        setOffsets(newOffsets)
    }, [])

    // staggered entrance :)
    useEffect(() => {
        if (!playing || !refs.current) return
        const dur = 500
        new Konva.Animation((frame) => {
            const curTime = Math.floor(frame.time / dur)
            refs.current.forEach((ref, i) => {
                const val = curTime > i ? 1 :
                    curTime === i ? (frame.time % dur) / dur :
                        0
                ref.setAttr("opacity", val)
            })
            return curTime <= refs.current.length
        }).start()
    }, [playing])

    return (
        <Group {...rest}>
            {
                Children.map(children, (child, i) => (
                    <Group
                        opacity={0}
                        ref={r => refs.current[i] = r as Node}
                        offsetY={-(offsets[i] ?? 0)}>
                        {child}
                    </Group>
                ))
            }
        </Group>
    )
}

function FullWidthText(props: TextConfig) {
    const ref = useRef<Node>(null)
    useEffect(() => {
        if (!ref.current) return
        const { width } = ref.current.getClientRect()
        const scale = 90 / width
        ref.current.scale({ x: scale, y: scale })
    }, [])
    return <Text {...props} ref={ref as any} />
}

function PageGroup({ children }: { children: ReactNode }) {
    const { activePage: page } = useStories();
    const groupRef = useRef(null);
    useEffect(() => {
        if (!groupRef.current) return;
        const tween = new Konva.Tween({
            node: groupRef.current,
            duration: 0.3,
            x: -page * 100,
            easing: Konva.Easings.EaseOut
        });
        tween.play();
    }, [page]);
    return <Group ref={groupRef}>{children}</Group>
}

function Page({ index, children }: { index: number, children: ReactNode }) {
    return <Group x={index * 100}>{children}</Group>
}

const pageColors = [
    "#f5b9e1",
    "#f5f596",
    "#bee1f0"
]

export function MonBixiStory({ stats }: { stats: StatsDetail }) {
    const { activePage: page } = useStories();
    const { totalHoursYearly } = stats;
    const bixiBike = useRef<Node>(null);
    const background = useRef<Node>(null);

    useEffect(() => {
        if (!bixiBike.current) return;
        bixiBike.current.to({
            node: bixiBike.current,
            duration: 0.5,
            x: - page * 110,
            easing: Konva.Easings.EaseOut
        })

        if (!background.current) return
        background.current.to({ fill: pageColors[page % pageColors.length] })
    }, [page]);

    return (
        <Layer listening={false}>
            <Rect ref={background as any} x={0} y={0} width={100} height={200} fill={pageColors[0]} />
            <PageGroup>
                <Page index={0}>
                    <VStack x={5} y={8}>
                        <FullWidthText {...titleStyle} text="Mon année" />
                        <FullWidthText {...titleStyle} fill="black" text="2025" />
                        <FullWidthText {...titleStyle} text="avec Bixi" />
                    </VStack>
                </Page>

                <Page index={1}>
                    <Text
                        {...titleStyle}
                        text={`${totalHoursYearly} heures à vélo !`}
                        x={4}
                        y={12} />
                </Page>
            </PageGroup>

            <BixiBike ref={bixiBike as any} x={0} y={30} scale={1} />
        </Layer>
    );
}