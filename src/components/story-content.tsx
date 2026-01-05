import Konva from "konva";
import { useRef, useEffect, Children, ReactNode, Ref, createContext, useContext, useMemo } from "react";
import { Group, Layer, Rect, Text } from "react-konva";
import { BixiBike } from "./bixi-bike";
import { useStories } from "./stories";
import { StatsDetail } from "../data/compute-stats";
import { Node } from "konva/lib/Node";
import { MontrealMap } from "./montreal-map";
import { SnowFall, TextShaky } from "./winter";
import { useLocale } from "./mon-bixi-dialog";
import { Ruler } from "./ruler";
import { Resize, VerticalStack } from "./utils";

export const colorRed60 = window.getComputedStyle(document.body).getPropertyValue("--core-ui-color-red60");

const titleStyle = {
    fontSize: 8,
    fontStyle: "bold",
    fontFamily: "LyftProUI",
    fill: colorRed60,
    lineHeight: 1.2
}

const bodyStyle = {
    fontSize: 4,
    fontStyle: "bold",
    fontFamily: "ProximaNova",
    fill: "#444",
    lineHeight: 1.2
}

const PageIndex = createContext({
    index: 0,
    setColor: (i: number, color: string) => { }
})

// all "pages" are rendered at once, but offset to the side so that only one page is visible
function PageGroup({ children, height }: { children: ReactNode, height: number }) {
    const { activePage: page } = useStories();

    // transition the background color
    const background = useRef<Node>(null);
    const pageColors = useRef<string[]>(["#f5b9e1"])
    useEffect(() => {
        if (!background.current) return
        background.current.to({ fill: pageColors.current[page % pageColors.current.length] })
    }, [page]);

    // slide to next page
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
            // each child of the page group is given its index, so as to render everything at the right offset
            // also given a way to register the color they want to transition to
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


function useActivePage() {
    const { index } = useContext(PageIndex)
    const { activePage } = useStories()
    return index === activePage
}

function HomePage({ stats, height }: { stats: StatsDetail, height: number }) {
    const _ = useLocale()
    const { index } = useContext(PageIndex)
    const { activePage } = useStories()
    return (
        <Page color="#f5b9e1">
            <VerticalStack x={5} y={10} animate={activePage === index}>
                {_("myYearWithBixiLong", stats.year.toString()).split("\n").map((text) => {
                    // specific style for the year portion of this message
                    const isYear = /\d/.test(text.trim())
                    return (
                        <Resize key={text} toWidth={90}>
                            <Text {...titleStyle} text={text.trim()}
                                lineHeight={isYear ? 0.9 : titleStyle.lineHeight}
                                fill={isYear ? "#333" : colorRed60} />
                        </Resize>
                    );
                })}
            </VerticalStack>
            
            {/* this content overflow on the next page (index + 1) */}
            <BixiBike animated={activePage === index + 1} x={0} y={35} scale={1} />
            {activePage <= index + 1 && <Text x={5} y={height - 5} fontSize={2} width={90} align="right" fill="gray" text="Illus.: Mathilde Filippi" />}
        </Page>
    )
}

function TimeSpentPage({ stats }: { stats: StatsDetail }) {
    const _ = useLocale()
    const animate = useActivePage()
    return (
        <Page color="#f5f596">
            <VerticalStack x={5} y={12} animate={animate}>
                <Text {...titleStyle} width={90} text={_("weSpentHoursTogether", stats.totalTimeYearly)} />
                <Text
                    width={90} offsetY={-5} {...bodyStyle}
                    text={[
                        _("tripAverage", stats.averageRideTime),
                        _("longestRide", stats.longestRide)
                    ].join("\n")} />
            </VerticalStack>
        </Page>
    )
}

function MostVisitedPage({ stats }: { stats: StatsDetail }) {
    const _ = useLocale()
    const animate = useActivePage()
    return (
        <Page color="#bee1f0">
            <VerticalStack x={5} y={12} animate={animate}>
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
                <MontrealMap offsetX={-5} offsetY={-70} animate={animate} highlights={stats.mostVisitedBoroughs} />
            </Resize>
        </Page>
    )
}

function TravelledPage({ stats, height }: { stats: StatsDetail, height: number }) {
    const _ = useLocale()
    const animate = useActivePage()
    return (
        <Page color="#febd97">
            <Ruler targetValue={stats.totalDistanceYearly / 1_000} animate={animate} fill="#d3803c" />
            <VerticalStack x={5} y={50} animate={animate}>
                <Text width={70} {...titleStyle} fill="#333" text={_("youRode")} />
                <Text width={70} offsetY={-20} {...bodyStyle} text={[
                    _("averageDist", stats.averageRideDist),
                    _("totalTrips", stats.rideCountYearly)
                ].join("\n")} />
            </VerticalStack>
            <Text x={5} y={height - 5} fontSize={2} width={90} align="right" fill="gray" text={_("estimate")} />
        </Page>
    )
}

function WinterPage({ stats }: { stats: StatsDetail }) {
    const _ = useLocale()
    const animate = useActivePage()
    return (
        <Page color="#bec8ff">
            <SnowFall animate={animate} />
            <VerticalStack x={5} y={25} animate={animate}>
                <Resize toWidth={90}><Text {...titleStyle} fill="#327fba" text={_("winter")} /></Resize>
                <Resize toWidth={90}><TextShaky {...titleStyle} fill="#327fba" text={_("notEvenCold")} /></Resize>
                <Text offsetY={-10} {...titleStyle} width={90} fill="#333" text={_("winterTrips", stats.winterRides)} />
            </VerticalStack>
        </Page>
    )
}

export const pageCount = (stats?: StatsDetail) => stats?.winterRides === 0 ? 5 : 6

export function StoryContent({ height, stats, ref }: { width: number, height: number, stats: StatsDetail, ref: Ref<HTMLCanvasElement> }) {
    const _ = useLocale()

    return (
        <Layer ref={ref as any} listening={false}>
            <PageGroup height={height}>
                <HomePage stats={stats} height={height} />
                <TimeSpentPage stats={stats} />
                <TravelledPage stats={stats} height={height} />
                <MostVisitedPage stats={stats} />
                {stats.winterRides > 0 && <WinterPage stats={stats} />}
                <Page color="#f5b9e1">
                    <Text x={5} y={25} {...titleStyle} fill="#333" width={90} align="center" text={_("share")} />
                </Page>
            </PageGroup>
            <Text x={5} y={height - 5} fontSize={2} width={90} align="left" fill="gray" text={`Extension "Mon Bixi"`} />
        </Layer>
    );
}