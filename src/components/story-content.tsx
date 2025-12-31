import Konva from "konva";
import { useRef, useEffect, Children, ReactNode, useState } from "react";
import { Group, Layer, Rect, Text } from "react-konva";
import { BixiBike } from "./bixi-bike";
import { useStories } from "./stories";
import { StatsDetail } from "../data/compute-stats";
import { Node } from "konva/lib/Node";
import { GroupConfig } from "konva/lib/Group";
import { MontrealMap } from "./montreal-map";

export const colorRed60 = window.getComputedStyle(document.body).getPropertyValue("--core-ui-color-red60");
const titleStyle = {
    fontSize: 8,
    fontStyle: "bold",
    fontFamily: "LyftProUI",
    fill: colorRed60
}

const bodyStyle = {
    fontSize: 3,
    fontStyle: "bold",
    fontFamily: "ProximaNova",
    fill: "#444"
}

function VerticalStack({ children, animateOnPage, ...rest }: { children: ReactNode, animateOnPage?: number } & GroupConfig) {
    const { playing, activePage } = useStories();
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
        if (!refs.current || animateOnPage === undefined || !(playing && animateOnPage === activePage)) return
        const dur = 500
        new Konva.Animation((frame) => {
            const curTime = Math.floor(frame.time / dur)
            refs.current.forEach((ref, i) => {
                const val = curTime - i + (frame.time % dur) / dur
                const clamped = Math.max(0, Math.min(1, val))
                ref.setAttr("opacity", clamped)
            })
            return curTime <= refs.current.length
        }).start()
    }, [playing, activePage, animateOnPage])

    return (
        <Group {...rest}>
            {
                Children.map(children, (child, i) => (
                    <Group
                        opacity={animateOnPage === undefined ? 1 : 0}
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


export function StoryContent({ height, stats }: { width: number, height: number, stats: StatsDetail }) {
    const { activePage: page } = useStories();
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
                    <VerticalStack x={5} y={12} animateOnPage={0}>
                        <Resize toWidth={90}><Text {...titleStyle} text="Mon année" /></Resize>
                        <Resize toWidth={90}><Text {...titleStyle} fill="#333" text={stats.year.toString()} /></Resize>
                        <Resize toWidth={90}><Text {...titleStyle} text="avec Bixi" /></Resize>
                    </VerticalStack>
                </Page>

                <Page index={1}>
                    <VerticalStack x={5} y={12} animateOnPage={1}>
                        <Text {...titleStyle} width={90} text={[
                            `Cette année, on a passé ${stats.totalHoursYearly} heures ensemble.`,
                            `Pas mal, non ?`
                        ].join("\n")} />
                        <Text
                            width={90} offsetY={-5} {...bodyStyle}
                            text={[
                                `Durée moyenne d'un trajet : ${Math.floor(stats.averageRideTimeMs / 60)} minutes`,
                            ].join("\n")} />
                    </VerticalStack>

                </Page>

                <Page index={2}>
                    <VerticalStack x={5} y={12} animateOnPage={2}>
                        <Resize toWidth={90}><Text {...titleStyle} fill="#333" text="Ton quartier, c'est" /></Resize>
                        <Resize toWidth={90} deps={[stats.mostVisitedBorough]}><Text {...titleStyle} text={stats.mostVisitedBorough + "."} /></Resize>
                        <Resize toWidth={95} offsetX={5}>
                            <MontrealMap highlights={stats.mostVisitedBoroughs} /></Resize>
                        <Text
                            width={90} offsetY={-5} {...bodyStyle}
                            text={[
                                `Station la plus utilisée : ${stats.mostUsedStation}`,
                                `Nombre de trajets depuis/vers ${stats.mostVisitedBorough} : ${stats.mostVisitedBoroughs[stats.mostVisitedBorough]}`
                            ].join("\n")} />
                    </VerticalStack>
                </Page>
            </PageGroup>

            <BixiBike ref={bixiBike as any} animated={page === 1} x={0} y={35} scale={1} />
            {page <= 1 && <Text x={5} y={height - 5} fontSize={2} width={90} align="right" fill="gray" text="Illus.: Mathilde Filippi" />}
        </Layer>
    );
}