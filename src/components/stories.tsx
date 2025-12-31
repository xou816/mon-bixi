import { createContext, CSSProperties, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import classes from "../extension.module.css";

const asClassName = (classTab: { [k: string]: boolean }) => Object.entries(classTab).reduce((str, [klass, active]) => `${str} ${active ? klass : ""}`.trimEnd(), "")

type TimeoutData = {
    timeout: ReturnType<typeof setTimeout> | undefined,
    latest: number | undefined, // latest date recorded when entering playing state
    elapsed: number // elapsed time, computed when pausing
}

export function useStoriesSlideshow({ pageCount, duration }: { pageCount: number, duration: number }) {
    const [{ playing, activePage }, setPlayState] = useState({
        activePage: 0,
        playing: false,
    })

    const setPlaying = (playing: boolean) => setPlayState((s) => ({ ...s, playing, activePage: Math.max(s.activePage, 0) }))
    const setPage = (page: number) => setPlayState((s) => ({ ...s, playing: true, activePage: Math.min(page, pageCount - 1) }))
    const nextPage = () => setPlayState((s) => ({ ...s, playing: true, activePage: Math.min(s.activePage + 1, pageCount - 1) }))
    const togglePlaying = () => setPlayState((s) => ({ ...s, playing: !s.playing, activePage: Math.max(s.activePage, 0) }))

    const timeoutData = useRef<{ [k: number]: TimeoutData }>({})

    useEffect(() => {
        // clear timeouts on previously visited pages
        for (const [pageIndex, data] of Object.entries(timeoutData.current)) {
            const index = parseInt(pageIndex)
            if (index !== activePage && data.timeout) {
                clearTimeout(data.timeout)
            }
        }

        const cur = document.timeline.currentTime as number
        let { latest, elapsed, timeout } = timeoutData.current[activePage] ?? { latest: undefined, elapsed: 0 }

        if (playing && activePage <= pageCount - 1 && activePage > -1) {
            if (!timeout) {
                console.log(`Running for ${duration - elapsed}ms`)
                timeout = setTimeout(() => nextPage(), duration - elapsed)
            }
            timeoutData.current = {
                [activePage]: {
                    latest: latest ?? cur,
                    elapsed,
                    timeout
                }
            }
        } else {
            clearTimeout(timeout)
            timeoutData.current = {
                [activePage]: {
                    latest: undefined,
                    elapsed: latest !== undefined ? cur - (latest ?? 0) + elapsed : elapsed,
                    timeout: undefined
                }
            }
        }
    }, [[playing, activePage]])

    return { playing, activePage, setPlaying, setPage, togglePlaying, pageCount, duration }
}

type CSSStoryProperties = { "--stepperTiming"?: string } & CSSProperties
type StoriesProps = {
    playing: boolean,
    activePage: number,
    duration: number,
    setPage: (p: number) => void,
    togglePlaying: () => void,
    pageCount: number,
    children: ReactNode
}

const StoriesContext = createContext({ activePage: 0, playing: false })
export const useStories = () => useContext(StoriesContext)

export function StoriesSlideshow({ playing, activePage, duration, setPage, togglePlaying, pageCount, children }: StoriesProps) {
    const stepperStyle = useMemo(() => ({ "--stepperTiming": `${duration}ms` } as CSSStoryProperties), [duration])

    return (
        <>
            <StoriesContext.Provider value={{ activePage, playing }}>
                {children}
            </StoriesContext.Provider>
            <nav className={classes.stepper} style={stepperStyle}>
                {Array.from({ length: pageCount }).map((_, index) => {
                    const classNames = {
                        [classes.stepperItem]: true,
                        [classes.stepperItemActive]: activePage === index,
                        [classes.stepperItemActivePaused]: activePage === index && !playing,
                        [classes.stepperItemDone]: activePage > index
                    }
                    return <a onClick={() => setPage(index)} key={index} className={asClassName(classNames)}></a>
                })}
            </nav>
            <button className={classes.pauseButton} onClick={() => togglePlaying()}>{playing ? <>&#10073;&#10073;</> : <>&#9658;</>}</button>
        </>
    )
}