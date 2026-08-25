import React, { useEffect, useRef, useState, type ReactElement } from "react";
import { Block } from "@/components/templates";
import { SplitLayout, StackLayout } from "@/components/layouts";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeChoice,
    InlineClozeInput,
    InlineFeedback,
    InlineLinkedHighlight,
    InlineScrubbleNumber,
    InteractionHintSequence,
    RevealOnInteraction,
} from "@/components/atoms";
import { Figure, FigureSlider } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { clamp, remap, useSpring, type Vec2 } from "@/lib/motion";
import {
    choicePropsFromDefinition,
    clozePropsFromDefinition,
    getVariableInfo,
    linkedHighlightPropsFromDefinition,
    numberPropsFromDefinition,
} from "../variables";

// ── Shared view geometry — THE VISIBLE TIE ───────────────────────────────────
// Both drawings use the same viewBox, the same ground line, and the same number
// of pixels per unit of ratio: the ladder's teal height in the left view is the
// identical pixel height as the teal bar in the right view.

const VIEW_WIDTH = 360;
const VIEW_HEIGHT = 300;
const GROUND_Y = 250;      // the value 0 in BOTH views
const SCALE_PX = 150;      // ladder length in px = one unit of ratio in px

const WALL_X = 92;
const PLOT_LEFT = 70;
const PLOT_RIGHT = 336;

const LADDER_METRES = 6;
const DEFAULT_ANGLE = 55;
const MIN_ANGLE = 10;
const MAX_ANGLE = 85;

const INK = "#334155";
const INK_STRUCTURE = "#64748B";
const INK_QUIET = "#CBD5E1";
const ACCENT = "#62D0AD";

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

// One formatter per quantity, used by both drawings, the slider and the prose.
const formatAngle = (degrees: number) => `${Math.round(degrees)}°`;
const formatRatio = (value: number) => value.toFixed(2);
const formatMetres = (value: number) => `${value.toFixed(1)} m`;

const EASE_150 = { transition: "opacity 150ms ease, stroke-width 150ms ease" } as const;

// ── Shared highlight helpers (the linked-highlight contract) ─────────────────

const useHighlightState = () => {
    const highlight = useVar<string>("ladderViewHighlight", "");
    const setVar = useSetVar();
    return {
        opacity: (id: string) => (highlight && highlight !== id ? 0.35 : 1),
        weight: (id: string, resting: number) => (highlight === id ? resting * 1.6 : resting),
        isActive: (id: string) => highlight === id,
        hoverProps: (id: string) => ({
            onPointerEnter: () => setVar("ladderViewHighlight", id),
            onPointerLeave: () => setVar("ladderViewHighlight", ""),
        }),
    };
};

const Halo = ({ active, children }: { active: boolean; children: React.ReactNode }) =>
    active ? <g opacity={0.28}>{children}</g> : null;

const svgPointFromEvent = (event: React.PointerEvent, svg: SVGSVGElement | null): Vec2 => {
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
        x: ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT,
    };
};

// ── Shared readout strip — identical in both figures ─────────────────────────

function SharedReadouts({ angle }: { angle: number }) {
    const { opacity } = useHighlightState();
    const ratio = Math.sin(toRadians(angle));
    return (
        <g fontSize="12" style={{ fontVariantNumeric: "tabular-nums", ...EASE_150 }}>
            <text x="24" y="34" fill={INK} opacity={opacity("angle")}>
                {`lean = ${formatAngle(angle)}`}
            </text>
            <text x={VIEW_WIDTH - 24} y="34" fill={ACCENT} textAnchor="end" opacity={opacity("height")}>
                {`height ÷ ladder = ${formatRatio(ratio)}`}
            </text>
        </g>
    );
}

// ── VIEW A: the ladder against the wall (the concrete situation) ─────────────

function LadderDrawing() {
    const setVar = useSetVar();
    const angle = useVar<number>("ladderAngle", DEFAULT_ANGLE);
    const { opacity, weight, isActive, hoverProps } = useHighlightState();

    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);
    const draggingRef = useRef(false);
    const svgRef = useRef<SVGSVGElement>(null);
    const handleScale = useSpring(dragging || hovered ? 1.15 : 1, { stiffness: 400, damping: 26 });

    // Direct 1:1 tracking: where the foot lands IS the lean angle.
    const handlePointerMove = (event: React.PointerEvent<SVGCircleElement>) => {
        if (!draggingRef.current) return;
        const point = svgPointFromEvent(event, svgRef.current);
        const along = clamp((point.x - WALL_X) / SCALE_PX, 0, 1);
        const degrees = (Math.acos(along) * 180) / Math.PI;
        setVar("ladderAngle", Math.round(clamp(degrees, MIN_ANGLE, MAX_ANGLE)));
        setVar("ratioExplored", true);
    };

    const radians = toRadians(angle);
    const footX = WALL_X + Math.cos(radians) * SCALE_PX;
    const topY = GROUND_Y - Math.sin(radians) * SCALE_PX;
    const heightMetres = LADDER_METRES * Math.sin(radians);

    const ghostRadians = toRadians(DEFAULT_ANGLE);
    const ghostFootX = WALL_X + Math.cos(ghostRadians) * SCALE_PX;
    const ghostTopY = GROUND_Y - Math.sin(ghostRadians) * SCALE_PX;

    const arcRadius = 30;
    const arcPath =
        `M ${footX - arcRadius} ${GROUND_Y} ` +
        `A ${arcRadius} ${arcRadius} 0 0 1 ` +
        `${footX - Math.cos(radians) * arcRadius} ${GROUND_Y - Math.sin(radians) * arcRadius}`;

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="A ladder leaning on a wall; dragging its foot changes the lean angle and the height it reaches"
        >
            <defs>
                <filter id="ratio-ladder-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <SharedReadouts angle={angle} />

            {/* Wall and ground — ambient structure, plus the ghost of where the
                ladder started, so every change is seen against a before-state. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <line x1={WALL_X} y1={GROUND_Y} x2={WALL_X} y2={GROUND_Y - SCALE_PX - 12} stroke={INK_STRUCTURE} strokeWidth="1.5" />
                <line x1={40} y1={GROUND_Y} x2={PLOT_RIGHT} y2={GROUND_Y} stroke={INK_STRUCTURE} strokeWidth="1.5" />
                <line x1={WALL_X} y1={GROUND_Y} x2={ghostFootX} y2={ghostTopY} stroke={INK_QUIET} strokeWidth="1.5" strokeDasharray="4 5" />
                <line x1={ghostFootX} y1={GROUND_Y} x2={ghostFootX} y2={GROUND_Y - 6} stroke={INK_QUIET} strokeWidth="1.5" />
            </g>

            {/* ANGLE group — the arc at the foot. Its counterpart in the graph
                is the span along the angle axis, carrying the same id. */}
            <g {...hoverProps("angle")} opacity={opacity("angle")} style={EASE_150}>
                <Halo active={isActive("angle")}>
                    <path d={arcPath} fill="none" stroke={INK_STRUCTURE} strokeWidth={weight("angle", 2) + 6} strokeLinecap="round" />
                </Halo>
                <path d={arcPath} fill="none" stroke={INK_STRUCTURE} strokeWidth={weight("angle", 2)} strokeLinecap="round" />
                <text x={footX - 40} y={GROUND_Y - 12} fill={INK} fontSize="12" textAnchor="middle">
                    lean
                </text>
            </g>

            {/* The ladder itself — structure, drawn from the model. */}
            <line
                x1={WALL_X}
                y1={topY}
                x2={footX}
                y2={GROUND_Y}
                stroke={INK_STRUCTURE}
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity={opacity("__structure")}
                style={EASE_150}
            />

            {/* HEIGHT group — the shared quantity in the ONE accent hue. Its
                pixel length equals the teal bar in the graph, exactly. */}
            <g {...hoverProps("height")} opacity={opacity("height")} style={EASE_150}>
                <Halo active={isActive("height")}>
                    <line x1={WALL_X} y1={GROUND_Y} x2={WALL_X} y2={topY} stroke={ACCENT} strokeWidth={weight("height", 3) + 6} strokeLinecap="round" />
                </Halo>
                <line x1={WALL_X} y1={GROUND_Y} x2={WALL_X} y2={topY} stroke={ACCENT} strokeWidth={weight("height", 3)} strokeLinecap="round" />
                <text x={WALL_X - 10} y={(GROUND_Y + topY) / 2 + 4} fill={ACCENT} fontSize="12" textAnchor="end">
                    height
                </text>
            </g>

            {/* Draggable foot — the only handle in this view. */}
            <g transform={`translate(${footX} ${GROUND_Y}) scale(${handleScale})`}>
                <circle r="8" fill={ACCENT} filter="url(#ratio-ladder-shadow)" />
            </g>
            <circle
                cx={footX}
                cy={GROUND_Y}
                r="24"
                fill="transparent"
                style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    draggingRef.current = true;
                    setDragging(true);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={() => {
                    draggingRef.current = false;
                    setDragging(false);
                }}
                onPointerCancel={() => {
                    draggingRef.current = false;
                    setDragging(false);
                }}
                onPointerEnter={() => setHovered(true)}
                onPointerLeave={() => setHovered(false)}
            />

            <g fontSize="12" style={{ fontVariantNumeric: "tabular-nums" }}>
                <text x="24" y={GROUND_Y + 30} fill={ACCENT} opacity={opacity("height")}>
                    {`height = ${formatMetres(heightMetres)}`}
                </text>
                <text x={VIEW_WIDTH - 24} y={GROUND_Y + 30} fill={INK} textAnchor="end">
                    {`ladder = ${formatMetres(LADDER_METRES)}`}
                </text>
            </g>
        </svg>
    );
}

// ── VIEW B: the same ratio, plotted against the lean angle ──────────────────

function RatioGraphDrawing() {
    const setVar = useSetVar();
    const angle = useVar<number>("ladderAngle", DEFAULT_ANGLE);
    const traceMin = useVar<number>("ladderTraceMin", DEFAULT_ANGLE);
    const traceMax = useVar<number>("ladderTraceMax", DEFAULT_ANGLE);
    const { opacity, weight, isActive, hoverProps } = useHighlightState();

    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);
    const draggingRef = useRef(false);
    const svgRef = useRef<SVGSVGElement>(null);
    const handleScale = useSpring(dragging || hovered ? 1.15 : 1, { stiffness: 400, damping: 26 });

    // The trail: everywhere the student has taken the ladder so far.
    useEffect(() => {
        if (angle < traceMin) setVar("ladderTraceMin", angle);
        if (angle > traceMax) setVar("ladderTraceMax", angle);
    }, [angle, traceMin, traceMax, setVar]);

    const xForAngle = (degrees: number) => remap(degrees, 0, 90, PLOT_LEFT, PLOT_RIGHT);
    const yForAngle = (degrees: number) => GROUND_Y - Math.sin(toRadians(degrees)) * SCALE_PX;

    const handlePointerMove = (event: React.PointerEvent<SVGCircleElement>) => {
        if (!draggingRef.current) return;
        const point = svgPointFromEvent(event, svgRef.current);
        const degrees = remap(point.x, PLOT_LEFT, PLOT_RIGHT, 0, 90);
        setVar("ladderAngle", Math.round(clamp(degrees, MIN_ANGLE, MAX_ANGLE)));
        setVar("ratioExplored", true);
    };

    const pathBetween = (from: number, to: number) => {
        const steps = 90;
        return Array.from({ length: steps + 1 }, (_, index) => from + ((to - from) * index) / steps)
            .map((degrees, index) => `${index === 0 ? "M" : "L"} ${xForAngle(degrees)} ${yForAngle(degrees)}`)
            .join(" ");
    };

    const markerX = xForAngle(angle);
    const markerY = yForAngle(angle);

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="Graph of height divided by ladder length against the lean angle, with a draggable marker"
        >
            <defs>
                <filter id="ratio-graph-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <SharedReadouts angle={angle} />

            {/* Axes, labels, and the untraced curve — the before-state. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <line x1={PLOT_LEFT} y1={GROUND_Y} x2={PLOT_RIGHT} y2={GROUND_Y} stroke={INK_STRUCTURE} strokeWidth="1.5" />
                <line x1={PLOT_LEFT} y1={GROUND_Y} x2={PLOT_LEFT} y2={GROUND_Y - SCALE_PX - 12} stroke={INK_STRUCTURE} strokeWidth="1.5" />
                <g fill={INK} fontSize="12" textAnchor="end" style={{ fontVariantNumeric: "tabular-nums" }}>
                    <text x={PLOT_LEFT - 10} y={GROUND_Y - SCALE_PX + 4}>1.00</text>
                    <text x={PLOT_LEFT - 10} y={GROUND_Y + 4}>0.00</text>
                </g>
                <g fill={INK} fontSize="12">
                    <text x={PLOT_LEFT} y={GROUND_Y + 22} textAnchor="start">0{"°"}</text>
                    <text x={xForAngle(45)} y={GROUND_Y + 22} textAnchor="middle">45{"°"}</text>
                    <text x={PLOT_RIGHT} y={GROUND_Y + 22} textAnchor="end">90{"°"}</text>
                    <text x={(PLOT_LEFT + PLOT_RIGHT) / 2} y={GROUND_Y + 40} textAnchor="middle">lean angle</text>
                </g>
                <path d={pathBetween(0, 90)} fill="none" stroke={INK_QUIET} strokeWidth="1.5" />
            </g>

            {/* ANGLE group — counterpart of the arc at the ladder's foot. */}
            <g {...hoverProps("angle")} opacity={opacity("angle")} style={EASE_150}>
                <Halo active={isActive("angle")}>
                    <line x1={PLOT_LEFT} y1={GROUND_Y} x2={markerX} y2={GROUND_Y} stroke={INK_STRUCTURE} strokeWidth={weight("angle", 2) + 6} strokeLinecap="round" />
                </Halo>
                <line x1={PLOT_LEFT} y1={GROUND_Y} x2={markerX} y2={GROUND_Y} stroke={INK_STRUCTURE} strokeWidth={weight("angle", 2)} strokeLinecap="round" />
            </g>

            {/* HEIGHT group — the trail already walked, and the bar whose pixel
                height matches the ladder's teal height exactly. */}
            <g {...hoverProps("height")} opacity={opacity("height")} style={EASE_150}>
                <path d={pathBetween(traceMin, traceMax)} fill="none" stroke={ACCENT} strokeWidth={weight("height", 2.5)} strokeLinecap="round" strokeLinejoin="round" />
                <Halo active={isActive("height")}>
                    <line x1={markerX} y1={GROUND_Y} x2={markerX} y2={markerY} stroke={ACCENT} strokeWidth={weight("height", 3) + 6} strokeLinecap="round" />
                </Halo>
                <line x1={markerX} y1={GROUND_Y} x2={markerX} y2={markerY} stroke={ACCENT} strokeWidth={weight("height", 3)} strokeLinecap="round" />
                <line x1={PLOT_LEFT} y1={markerY} x2={markerX} y2={markerY} stroke={ACCENT} strokeWidth="1.5" strokeDasharray="3 4" opacity={0.6} />
            </g>

            <g transform={`translate(${markerX} ${markerY}) scale(${handleScale})`}>
                <circle r="8" fill={ACCENT} filter="url(#ratio-graph-shadow)" />
            </g>
            <circle
                cx={markerX}
                cy={markerY}
                r="24"
                fill="transparent"
                style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    draggingRef.current = true;
                    setDragging(true);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={() => {
                    draggingRef.current = false;
                    setDragging(false);
                }}
                onPointerCancel={() => {
                    draggingRef.current = false;
                    setDragging(false);
                }}
                onPointerEnter={() => setHovered(true)}
                onPointerLeave={() => setHovered(false)}
            />
        </svg>
    );
}

// ── Figure shells ────────────────────────────────────────────────────────────

const resetLadder = (setVar: (name: string, value: number | string | boolean) => void) => {
    setVar("ladderAngle", DEFAULT_ANGLE);
    setVar("ladderTraceMin", DEFAULT_ANGLE);
    setVar("ladderTraceMax", DEFAULT_ANGLE);
    setVar("ladderViewHighlight", "");
};

function LadderFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="ratio-ladder"
            onReset={() => resetLadder(setVar)}
            caption="A 6 m ladder against a wall. Drag its foot along the ground and the teal height follows the lean."
        >
            <LadderDrawing />
            <InteractionHintSequence
                hintKey="ratio-ladder-foot-drag"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Drag the foot of the ladder",
                        position: { x: "49%", y: "78%" },
                        dragPath: { type: "line", startOffset: { x: -30, y: 0 }, endOffset: { x: 30, y: 0 } },
                    },
                ]}
            />
        </Figure>
    );
}

function RatioGraphFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="ratio-graph"
            onReset={() => resetLadder(setVar)}
            caption="The same height, divided by the ladder's length and plotted against the lean. Drag this marker and the ladder follows."
        >
            <RatioGraphDrawing />
            <div className="px-6 pb-5">
                <FigureSlider
                    varName="ladderAngle"
                    label="Lean angle"
                    {...numberPropsFromDefinition(getVariableInfo("ladderAngle"))}
                    formatValue={formatAngle}
                />
            </div>
            <InteractionHintSequence
                hintKey="ratio-graph-marker-drag"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Drag the marker along the curve",
                        position: { x: "64%", y: "42%" },
                        dragPath: { type: "line", startOffset: { x: -28, y: 0 }, endOffset: { x: 28, y: 0 } },
                    },
                ]}
            />
        </Figure>
    );
}

// ── Blocks ───────────────────────────────────────────────────────────────────

export const ratioIgnoresSizeBlocks: ReactElement[] = [
    <StackLayout key="layout-ratio-heading" maxWidth="xl">
        <Block id="ratio-heading" padding="md">
            <EditableH2 id="h2-ratio-heading" blockId="ratio-heading">
                The Ratio That Ignores Size
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-ratio-setup" maxWidth="xl">
        <Block id="ratio-setup" padding="sm">
            <EditableParagraph id="para-ratio-setup" blockId="ratio-setup">
                Shrink the ladder to half its length but keep its lean at{" "}
                <InlineScrubbleNumber
                    varName="ladderAngle"
                    {...numberPropsFromDefinition(getVariableInfo("ladderAngle"))}
                    formatValue={formatAngle}
                />
                , and the height it reaches halves too, so height divided by ladder length is
                unchanged. Only the lean matters. Drag the foot of the ladder along the ground and
                watch the{" "}
                <InlineLinkedHighlight
                    varName="ladderViewHighlight"
                    highlightId="height"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("ladderViewHighlight"))}
                >
                    height
                </InlineLinkedHighlight>{" "}
                stretch while the marker beside it traces out its own curve.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <SplitLayout key="layout-ratio-visual" ratio="1:1" gap="lg" align="start">
        <Block id="ratio-ladder-figure" padding="sm" hasVisualization>
            <LadderFigure />
        </Block>
        <Block id="ratio-graph-figure" padding="sm" hasVisualization>
            <RatioGraphFigure />
        </Block>
    </SplitLayout>,

    <StackLayout key="layout-ratio-naming" maxWidth="xl">
        <Block id="ratio-naming" padding="sm">
            <EditableParagraph id="para-ratio-naming" blockId="ratio-naming">
                Every lean owns one ratio, and that curve is the record of all of them. The side
                opposite the angle divided by the hypotenuse is called the sine of that angle, which
                is exactly the number the sin button hands you.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-ratio-question-depends" maxWidth="xl">
        <Block id="ratio-question-depends" padding="md">
            <EditableParagraph id="para-ratio-question-depends" blockId="ratio-question-depends">
                <RevealOnInteraction varName="ratioExplored">
                    Whatever the ladder, the ratio of height to length is decided by{" "}
                    <InlineFeedback
                        varName="answer_ratio_depends"
                        correctValue="the lean angle"
                        position="terminal"
                        successMessage="— exactly, and that is why one angle is enough to work out a side"
                        failureMessage="— not quite."
                        hint="Two of those can change without the ratio moving at all"
                        visualizationHint={{
                            blockId: "ratio-ladder-figure",
                            hintKey: "feedback-ratio-depends",
                            steps: [
                                {
                                    gesture: "drag-horizontal",
                                    label: "Drag the ladder's foot out until the lean reaches about 30° — watch the ratio drop",
                                    position: { x: "62%", y: "78%" },
                                    completionVar: "ladderAngle",
                                    completionValue: 30,
                                    completionTolerance: 6,
                                },
                                {
                                    gesture: "drag-horizontal",
                                    label: "Now pull it back in toward 70° — the ratio climbs again, and nothing else changed",
                                    position: { x: "38%", y: "78%" },
                                    completionVar: "ladderAngle",
                                    completionValue: 70,
                                    completionTolerance: 6,
                                },
                            ],
                            label: "Discover it yourself",
                            resetVars: { ladderAngle: 55, ladderTraceMin: 55, ladderTraceMax: 55 },
                        }}
                    >
                        <InlineClozeChoice
                            varName="answer_ratio_depends"
                            correctAnswer="the lean angle"
                            options={["the lean angle", "the ladder length", "the wall height"]}
                            {...choicePropsFromDefinition(getVariableInfo("answer_ratio_depends"))}
                        />
                    </InlineFeedback>.
                </RevealOnInteraction>
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-ratio-question-half-ladder" maxWidth="xl">
        <Block id="ratio-question-half-ladder" padding="md">
            <EditableParagraph id="para-ratio-question-half-ladder" blockId="ratio-question-half-ladder">
                A 10 m ladder leaning at 40{"°"} reaches 6.4 m up a wall. A 5 m ladder propped at
                that same 40{"°"} reaches, in metres,{" "}
                <InlineFeedback
                    varName="answer_ratio_half_ladder"
                    correctValue={["3.2", "3.2 m", "3.2m"]}
                    position="terminal"
                    successMessage="— half the ladder, half the height, because the ratio 0.64 belongs to the angle and stays put"
                    failureMessage="— close, but check it again."
                    hint="Work out 6.4 divided by 10 first, then ask what that ratio does to a 5 m ladder"
                >
                    <InlineClozeInput
                        varName="answer_ratio_half_ladder"
                        correctAnswer={["3.2", "3.2 m", "3.2m"]}
                        {...clozePropsFromDefinition(getVariableInfo("answer_ratio_half_ladder"))}
                    />
                </InlineFeedback>.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
