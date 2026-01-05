import Konva from "konva";
import { GroupConfig } from "konva/lib/Group";
import { Node } from "konva/lib/Node";
import { memo, ReactNode, useState, useRef, useEffect, Children } from "react";
import { Group } from "react-konva";

export const VerticalStack = memo(({ children, animate, ...rest }: { children: ReactNode; animate: boolean; } & GroupConfig) => {
    const [offsets, setOffsets] = useState<number[]>([]);
    const refs = useRef<Node[]>([]);
    const groupRef = useRef<Node>(null);

    // computes the offset of each element so that they stack vertically
    useEffect(() => {
        if (!refs.current) return;
        const newOffsets = refs.current.reduce((acc, ref, i) => {
            acc.push(ref.getClientRect().height + acc[i]);
            return acc;
        }, [0]);
        setOffsets(newOffsets);
    }, []);

    // staggered entrance :)
    const dur = 500;
    useEffect(() => {
        if (!refs.current || !groupRef.current) return;
        const animation = new Konva.Animation((frame) => {
            const curTime = Math.floor(frame.time / dur);
            refs.current.forEach((ref, i) => {
                const val = curTime - i + (frame.time % dur) / dur;
                const clamped = Math.max(0, Math.min(1, val));
                ref?.setAttr("opacity", clamped);
            });
            return curTime <= refs.current.length;
        }, groupRef.current.getLayer()).start();

        if (animate) animation.start();
        else animation.stop();
        return () => { animation.stop(); };
    }, [animate]);

    return (
        <Group ref={groupRef as any} {...rest}>
            {Children.map(children, (child, i) => (
                <Group
                    opacity={animate ? 1 : 0}
                    ref={r => refs.current[i] = r as Node}
                    offsetY={-(offsets[i] ?? 0)}>
                    {child}
                </Group>
            ))}
        </Group>
    );
});

// buggy! try not to use it with changing content
export function Resize({ toWidth, ...rest }: { toWidth: number; } & GroupConfig) {
    const ref = useRef<Node>(null);
    useEffect(() => {
        if (!ref.current) return;
        const { width } = ref.current.getClientRect();
        const scale = toWidth / width;
        ref.current.scale({ x: scale, y: scale });
    }, []);
    return <Group {...rest} ref={ref as any} />;
}

