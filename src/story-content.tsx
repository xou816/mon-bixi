import Konva from "konva";
import { useRef, useEffect, Children, ReactNode, useState } from "react";
import { Group, Layer, Path, Rect, Text } from "react-konva";
import { BixiBike } from "./bike";
import { useStories } from "./stories";
import { StatsDetail } from "./stats";
import { Node } from "konva/lib/Node";
import { GroupConfig } from "konva/lib/Group";
import { arrondissementPolys } from "./data/data.compile";
import { MontrealMap } from "./mtl";

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

function Resize({ toWidth, ...rest }: { toWidth: number } & GroupConfig) {
    const ref = useRef<Node>(null)
    useEffect(() => {
        if (!ref.current) return
        const { width } = ref.current.getClientRect()
        const scale = toWidth / width
        ref.current.scale({ x: scale, y: scale })
    }, [])
    return <Group {...rest} ref={ref as any} />
}

function PageGroup({ children }: { children: ReactNode }) {
    const { activePage: page } = useStories();
    const groupRef = useRef<Node>(null);
    useEffect(() => {
        if (!groupRef.current) return;
        groupRef.current.to({
            node: groupRef.current,
            duration: 0.3,
            x: -page * 100,
            easing: Konva.Easings.EaseOut
        });
    }, [page]);
    return <Group ref={groupRef as any}>{children}</Group>
}

function Page({ index, children }: { index: number, children: ReactNode }) {
    return <Group x={index * 100}>{children}</Group>
}

const pageColors = [
    "#f5b9e1",
    "#f5f596",
    "#bee1f0"
]


export function MonBixiStory({ height, stats }: { width: number, height: number, stats: StatsDetail }) {
    const { activePage: page } = useStories();
    const { totalHoursYearly, mostVisitedBorough } = stats;
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
            <Rect ref={background as any} x={0} y={0} width={100} height={height} fill={pageColors[0]} />
            <PageGroup>
                <Page index={0}>
                    <VStack x={5} y={8}>
                        <Resize toWidth={90}><Text {...titleStyle} text="Mon année" /></Resize>
                        <Resize toWidth={90}><Text {...titleStyle} fill="black" text="2025" /></Resize>
                        <Resize toWidth={90}><Text {...titleStyle} text="avec Bixi" /></Resize>
                    </VStack>
                </Page>

                <Page index={1}>
                    <Text
                        {...titleStyle}
                        text={`${totalHoursYearly} heures à vélo !`}
                        x={4}
                        y={12} />
                </Page>

                <Page index={2}>
                    <Text
                        {...titleStyle}
                        text={`Ton hood, c'est ${mostVisitedBorough}.`}
                        x={4}
                        y={12} />
                    <Resize toWidth={90}><MontrealMap highlight={mostVisitedBorough} /></Resize>
                </Page>
            </PageGroup>

            <BixiBike ref={bixiBike as any} animated={page === 1} x={0} y={30} scale={1} />
            <Text x={5} y={height - 5} fontSize={2} width={90} align="right" fill="gray" text="Illus.: Mathilde Filippi" />
        </Layer>
    );
}