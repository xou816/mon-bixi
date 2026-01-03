import Konva from "konva";
import { useRef, useEffect, Children, ReactNode, useState, Ref, createContext, useContext, useMemo } from "react";
import { Group, Layer, Rect, Text } from "react-konva";
import { BixiBike } from "./bixi-bike";
import { useStories } from "./stories";
import { StatsDetail } from "../data/compute-stats";
import { Node } from "konva/lib/Node";
import { GroupConfig } from "konva/lib/Group";
import { MontrealMap } from "./montreal-map";
import { SnowFall, TextShaky } from "./winter";
import { useLocale } from "./mon-bixi-dialog";
import { Ruler } from "./ruler";

export const colorRed60 = window.getComputedStyle(document.body).getPropertyValue("--core-ui-color-red60");
const titleStyle = {
    fontSize: 8,
    fontStyle: "bold",
    fontFamily: "LyftProUI",
    fill: colorRed60
}

const bodyStyle = {
    fontSize: 4,
    fontStyle: "bold",
    fontFamily: "ProximaNova",
    fill: "#444"
}

function VerticalStack({ children, animateOnPage, ...rest }: { children: ReactNode, animateOnPage?: number } & GroupConfig) {
    const { playing, activePage } = useStories();
    const [offsets, setOffsets] = useState<number[]>([])
    const refs = useRef<Node[]>([])
    const groupRef = useRef<Node>(null)

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
                ref?.setAttr("opacity", clamped)
            })
            return curTime <= refs.current.length
        }, groupRef.current?.getLayer()).start()
    }, [playing, activePage, animateOnPage])

    return (
        <Group ref={groupRef as any} {...rest}>
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

// buggy! try not to use it with changing content
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

const PageIndex = createContext({ index: 0, setColor: (i: number, color: string) => { } })

function PageGroup({ children, height }: { children: ReactNode, height: number }) {
    const { activePage: page } = useStories();

    const background = useRef<Node>(null);
    const pageColors = useRef<string[]>(["#f5b9e1"])
    useEffect(() => {
        if (!background.current) return
        background.current.to({ fill: pageColors.current[page % pageColors.current.length] })
    }, [page]);

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

    const mappedChildren = useMemo(() => {
        let i = -1
        return Children.map(children, (child) => {
            if (child !== null) {
                i++
                const ctx = {
                    index: i,
                    setColor: (i: number, c: string) => { pageColors.current[0 + i] = c }
                }
                return <PageIndex.Provider key={i} value={ctx}>{child}</PageIndex.Provider>
            }
        })
    }, [children])

    return (
        <>
            <Rect ref={background as any} x={0} y={0} width={100} height={height} fill={pageColors.current[0]} />
            <Group ref={groupRef as any}>{mappedChildren}</Group>
        </>
    )
}

function Page({ children, color }: { children: ReactNode, color: string }) {
    const { index, setColor } = useContext(PageIndex)
    useEffect(() => { setColor(index, color) }, [color])
    return <Group x={index * 100}>{children}</Group>
}

export const pageCount = (stats?: StatsDetail) => stats?.winterRides === 0 ? 5 : 6

function HomePage({ stats }: { stats: StatsDetail }) {
    const _ = useLocale()
    const { index } = useContext(PageIndex)
    return (
        <Page color="#f5b9e1">
            <VerticalStack x={5} y={12} animateOnPage={index}>
                {_("myYearWithBixiLong", stats.year.toString()).split("\n").map((text) => (
                    <Resize key={text} toWidth={90}>
                        <Text {...titleStyle} fill={/\d/.test(text.trim()) ? "#333" : colorRed60} text={text.trim()} />
                    </Resize>
                ))}
            </VerticalStack>
        </Page>
    )
}

function TimeSpentPage({ stats }: { stats: StatsDetail }) {
    const _ = useLocale()
    const { index } = useContext(PageIndex)
    return (
        <Page color="#f5f596">
            <VerticalStack x={5} y={12} animateOnPage={index}>
                <Text {...titleStyle} width={90} text={_("weSpentHoursTogether", Math.round(stats.totalTimeYearly / 3600))} />
                <Text
                    width={90} offsetY={-5} {...bodyStyle}
                    text={_("tripAverage", Math.round(stats.averageRideTime / 60))} />
            </VerticalStack>
        </Page>
    )
}

function MostVisitedPage({ stats }: { stats: StatsDetail }) {
    const _ = useLocale()
    const { activePage: page } = useStories();
    const { index } = useContext(PageIndex)
    return (
        <Page color="#bee1f0">
            <VerticalStack x={5} y={12} animateOnPage={index}>
                <Resize toWidth={90}><Text {...titleStyle} fill="#333" text={_("yourHome")} /></Resize>
                <Resize toWidth={90} deps={[stats.mostVisitedBorough]}><Text {...titleStyle} text={stats.mostVisitedBorough + "."} /></Resize>
                <Text
                    width={90} offsetY={-75} {...bodyStyle}
                    text={[
                        _("mostUsedStation", stats.mostUsedStation),
                        _("tripsFromTo", stats.mostVisitedBorough, stats.mostVisitedBoroughs[stats.mostVisitedBorough])
                    ].join("\n")} />
            </VerticalStack>
            <Resize toWidth={95} offsetX={5}>
                <MontrealMap offsetX={-5} offsetY={-60} animate={page === index} highlights={stats.mostVisitedBoroughs} />
            </Resize>
        </Page>
    )
}

function TravelledPage({ stats }: { stats: StatsDetail }) {
    const _ = useLocale()
    const { activePage: page } = useStories();
    const { index } = useContext(PageIndex)
    return (
        <Page color="#febd97">
            <Text x={5} y={55} width={70} {...titleStyle} fill="#333" text={_("youRode")} />
            <Ruler targetValue={stats.totalDistanceYearly / 1_000} animate={page === index} fill="white" />
        </Page>
    )
}

function WinterPage({ stats }: { stats: StatsDetail }) {
    const _ = useLocale()
    const { activePage: page } = useStories();
    const { index } = useContext(PageIndex)
    return (
        <Page color="#bec8ff">
            <SnowFall animate={page === index} />
            <VerticalStack x={5} y={25} animateOnPage={index}>
                <Resize toWidth={90}><Text {...titleStyle} fill="#327fba" text={_("winter")} /></Resize>
                <Resize toWidth={90}><TextShaky {...titleStyle} fill="#327fba" text={_("notEvenCold")} /></Resize>
                <Text offsetY={-10} {...titleStyle} width={90} fill="#333" text={_("winterTrips", stats.winterRides)} />
            </VerticalStack>
        </Page>
    )
}

export function StoryContent({ height, stats, ref }: { width: number, height: number, stats: StatsDetail, ref: Ref<HTMLCanvasElement> }) {
    const { activePage: page } = useStories();
    const _ = useLocale()
    const bixiBike = useRef<Node>(null);

    useEffect(() => {
        if (!bixiBike.current) return;
        bixiBike.current.to({
            node: bixiBike.current,
            duration: 0.5,
            x: - page * 110,
            easing: Konva.Easings.EaseOut
        })
    }, [page]);

    return (
        <Layer ref={ref as any} listening={false}>
            <PageGroup height={height}>
                <HomePage stats={stats} />
                <TimeSpentPage stats={stats} />
                <MostVisitedPage stats={stats} />
                <TravelledPage stats={stats} />
                {stats.winterRides > 0 && <WinterPage stats={stats} />}
                <Page color="#f5b9e1">
                    <Text x={5} y={25} {...titleStyle} fill="#333" width={90} align="center" text={_("share")} />
                </Page>
            </PageGroup>

            <BixiBike ref={bixiBike as any} animated={page === 1} x={0} y={35} scale={1} />
            {page <= 1 && <Text x={5} y={height - 5} fontSize={2} width={90} align="right" fill="gray" text="Illus.: Mathilde Filippi" />}
            <Text x={5} y={height - 5} fontSize={2} width={90} align="left" fill="gray" text={`Extension "Mon Bixi"`} />
        </Layer>
    );
}