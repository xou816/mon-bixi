import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRideStoreTx } from "./db";
import { useOpenMonBixi } from "./extension";
import classes from "./extension.module.css";
import { fetchRidesAsNeeded } from "./import";
import { getOrComputeStats, StatsDetail } from "./stats";
import { Stories, useStoriesSlideshow } from "./stories";
import { Layer, Text } from "react-konva";
import { TextConfig } from "konva/lib/shapes/Text";
import { BixiBike } from "./bike";
import Konva from "konva";

const StatsContext = createContext<StatsDetail>({} as StatsDetail)
export const useStats = () => useContext(StatsContext)

export const colorRed60 = window.getComputedStyle(document.body).getPropertyValue("--core-ui-color-red60")

const Title = (props: TextConfig) => <Text
    fontSize={30}
    fontStyle="bold"
    fontFamily="LyftProUI"
    fill={colorRed60}
    {...props} />

function MonBixiStory({ page }: { page: number }) {
    const { totalHoursYearly } = useStats()
    const group = useRef()

    useEffect(() => {
        if (!group.current) return
        const tween = new Konva.Tween({
            node: group.current,
            duration: 0.5,
            x: -400 + page * 1000,
            easing: Konva.Easings.EaseOut
        })
        tween.play()
    }, [page])

    return (
        <Layer listening={false}>
            <Title
                text={page === 0 ? "Mon année en Bixi" : `${totalHoursYearly} heures à vélo !`}
                x={16}
                y={32} />
            <BixiBike groupRef={group} x={-400} y={0} scale={4} />
        </Layer>
    )
}

export function MonBixiDialog() {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const [open, setOpen] = useState(false)
    const [stats, setStats] = useState<StatsDetail>({} as StatsDetail);

    const duration = 5_000
    const { setPlaying, ...storiesProps } = useStoriesSlideshow({ duration, pageCount: 2 })

    useRideStoreTx(async (db) => {
        await fetchRidesAsNeeded(db)
        const freshStats = await getOrComputeStats(db)
        setStats((stats) => ({ ...stats, ...freshStats.stats }))
    })

    useOpenMonBixi(() => {
        dialogRef.current?.showModal()
        setOpen(true)
    });

    useEffect(() => {
        if (stats != undefined && open) setPlaying(true)
    }, [open, stats])

    return (
        <dialog ref={dialogRef} className={classes.rootDialog} closedby="any">
            <StatsContext.Provider value={stats}>
                <Stories
                    {...storiesProps}
                    renderPage={(page) => <MonBixiStory page={page} />}
                    duration={duration} />
            </StatsContext.Provider>
        </dialog>
    );
}
