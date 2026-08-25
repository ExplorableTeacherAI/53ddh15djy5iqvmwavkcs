import React, { useEffect, useRef, useState, type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
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
import { clamp, useSpring, type Vec2 } from "@/lib/motion";
import {
    choicePropsFromDefinition,
    clozePropsFromDefinition,
    getVariableInfo,
    linkedHighlightPropsFromDefinition,
    numberPropsFromDefinition,
} from "../variables";

// ── View geometry ────────────────────────────────────────────────────────────

const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 340;
const GROUND_Y = 286;
const WALL_X = 170;
const PX_PER_METRE = 19;
const WALL_TOP_METRES = 12.2;

const INK = "#334155";
const INK_STRUCTURE = "#64748B";
const INK_QUIET = "#CBD5E1";
const ACCENT = "#62D0AD";
const GUESS = "#F7B23B";

const EASE_150 = { transition: "opacity 150ms ease, stroke-width 150ms ease" } as const;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

// One formatter per quantity — drawing, sliders, working line and prose.
const formatMetres = (value: number) => `${value.toFixed(1)} m`;
const formatAngle = (degrees: number) => `${Math.round(degrees)}°`;

const yForMetres = (metres: number) => GROUND_Y - metres * PX_PER_METRE;

const svgPointFromEvent = (event: React.PointerEvent, svg: SVGSVGElement | null): Vec2 => {
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
        x: ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT,
    };
};

// ── Highlight helpers (the linked-highlight contract) ────────────────────────

const useHighlightState = () => {
    const highlight = useVar<string>("predictHighlight", "");
    const setVar = useSetVar();
    return {
        opacity: (id: string) => (highlight && highlight !== id ? 0.35 : 1),
        weight: (id: string, resting: number) => (highlight === id ? resting * 1.6 : resting),
        isActive: (id: string) => highlight === id,
        hoverProps: (id: string) => ({
            onPointerEnter: () => setVar("predictHighlight", id),
            onPointerLeave: () => setVar("predictHighlight", ""),
        }),
    };
};

const Halo = ({ active, children }: { active: boolean; children: React.ReactNode }) =>
    active ? <g opacity={0.28}>{children}</g> : null;

// ── The drawing ──────────────────────────────────────────────────────────────

function PredictLadderDrawing() {
    const setVar = useSetVar();
    const length = useVar<number>("predictLadderLength", 7);
    const angle = useVar<number>("predictLeanAngle", 62);
    const guess = useVar<number>("predictGuessHeight", 4.5);
    const locked = useVar<number>("predictLocked", 0);
    const { opacity, weight, isActive, hoverProps } = useHighlightState();

    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);
    const draggingRef = useRef(false);
    const svgRef = useRef<SVGSVGElement>(null);
    const handleScale = useSpring(dragging || hovered ? 1.15 : 1, { stiffness: 400, damping: 26 });

    // A new ladder or a new lean opens a fresh round: the answer hides again.
    useEffect(() => {
        setVar("predictLocked", 0);
    }, [length, angle, setVar]);

    const radians = toRadians(angle);
    const trueHeight = length * Math.sin(radians);
    const footX = WALL_X + Math.cos(radians) * length * PX_PER_METRE;
    const topY = yForMetres(trueHeight);
    const guessY = yForMetres(guess);
    // The ladder is only drawn part of the way up before the reveal: enough to
    // show its direction, never far enough to give the height away.
    const stubMetres = length * 0.45;
    const dashMetres = length * 0.7;
    const stubX = WALL_X + Math.cos(radians) * stubMetres * PX_PER_METRE;
    const stubY = yForMetres(stubMetres * Math.sin(radians));
    const dashX = WALL_X + Math.cos(radians) * dashMetres * PX_PER_METRE;
    const dashY = yForMetres(dashMetres * Math.sin(radians));

    const handlePointerMove = (event: React.PointerEvent<SVGRectElement>) => {
        if (!draggingRef.current) return;
        const point = svgPointFromEvent(event, svgRef.current);
        const metres = (GROUND_Y - point.y) / PX_PER_METRE;
        setVar("predictGuessHeight", Math.round(clamp(metres, 0, WALL_TOP_METRES) * 10) / 10);
        setVar("solvingExplored", true);
    };

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
            aria-label="A ladder leaning against an unmarked wall, with a marker that slides up and down the wall"
        >
            <defs>
                <filter id="predict-marker-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* The two numbers the question gives you. */}
            <g fontSize="12" style={{ fontVariantNumeric: "tabular-nums", ...EASE_150 }}>
                <text x="24" y="32" fill={INK} opacity={opacity("ladder")}>
                    {`ladder = ${formatMetres(length)}`}
                </text>
                <text x={VIEW_WIDTH - 24} y="32" fill={INK} textAnchor="end" opacity={opacity("angle")}>
                    {`lean = ${formatAngle(angle)}`}
                </text>
            </g>

            {/* Wall and ground. The wall carries no scale, so the height cannot
                be read off the picture — it has to be worked out. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <line x1={WALL_X} y1={GROUND_Y} x2={WALL_X} y2={yForMetres(WALL_TOP_METRES)} stroke={INK_STRUCTURE} strokeWidth="2" />
                <line x1={60} y1={GROUND_Y} x2={520} y2={GROUND_Y} stroke={INK_STRUCTURE} strokeWidth="2" />
            </g>

            {/* LADDER group — a stub before the reveal, the whole ladder after. */}
            <g {...hoverProps("ladder")} opacity={opacity("ladder")} style={EASE_150}>
                <Halo active={isActive("ladder")}>
                    <line
                        x1={footX}
                        y1={GROUND_Y}
                        x2={locked ? WALL_X : stubX}
                        y2={locked ? topY : stubY}
                        stroke={INK_STRUCTURE}
                        strokeWidth={weight("ladder", 2.5) + 6}
                        strokeLinecap="round"
                    />
                </Halo>
                <line
                    x1={footX}
                    y1={GROUND_Y}
                    x2={locked ? WALL_X : stubX}
                    y2={locked ? topY : stubY}
                    stroke={INK_STRUCTURE}
                    strokeWidth={weight("ladder", 2.5)}
                    strokeLinecap="round"
                />
                {!locked && (
                    <line x1={stubX} y1={stubY} x2={dashX} y2={dashY} stroke={INK_QUIET} strokeWidth="1.5" strokeDasharray="3 7" />
                )}
            </g>

            {/* ANGLE group — the arc at the foot. */}
            <g {...hoverProps("angle")} opacity={opacity("angle")} style={EASE_150}>
                <Halo active={isActive("angle")}>
                    <path d={arcPath} fill="none" stroke={INK_STRUCTURE} strokeWidth={weight("angle", 2) + 6} strokeLinecap="round" />
                </Halo>
                <path d={arcPath} fill="none" stroke={INK_STRUCTURE} strokeWidth={weight("angle", 2)} strokeLinecap="round" />
            </g>

            {/* HEIGHT group — revealed only once the prediction is committed,
                so the guess marker stays beside it as the comparand. */}
            {locked === 1 && (
                <g {...hoverProps("height")} opacity={opacity("height")} style={EASE_150}>
                    <Halo active={isActive("height")}>
                        <line x1={WALL_X} y1={GROUND_Y} x2={WALL_X} y2={topY} stroke={ACCENT} strokeWidth={weight("height", 3) + 6} strokeLinecap="round" />
                    </Halo>
                    <line x1={WALL_X} y1={GROUND_Y} x2={WALL_X} y2={topY} stroke={ACCENT} strokeWidth={weight("height", 3)} strokeLinecap="round" />
                    <line x1={WALL_X} y1={topY} x2={WALL_X + 74} y2={topY} stroke={ACCENT} strokeWidth="1.5" strokeDasharray="3 4" opacity={0.6} />
                    <text x={WALL_X + 12} y={topY - 8} fill={ACCENT} fontSize="12" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {`reaches ${formatMetres(trueHeight)}`}
                    </text>
                </g>
            )}

            {/* The prediction marker — the one handle in this figure. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <line x1={WALL_X - 26} y1={guessY} x2={WALL_X + 26} y2={guessY} stroke={GUESS} strokeWidth="2.5" strokeLinecap="round" />
                <text x={WALL_X - 34} y={guessY + 4} fill={GUESS} fontSize="12" textAnchor="end" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {`guess ${formatMetres(guess)}`}
                </text>
                <g transform={`translate(${WALL_X} ${guessY}) scale(${handleScale})`}>
                    <circle r="8" fill={GUESS} filter="url(#predict-marker-shadow)" />
                </g>
            </g>
            <rect
                x={WALL_X - 24}
                y={guessY - 22}
                width="48"
                height="44"
                fill="transparent"
                style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    draggingRef.current = true;
                    setDragging(true);
                    setVar("predictLocked", 0);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={() => {
                    draggingRef.current = false;
                    setDragging(false);
                    setVar("predictLocked", 1);
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

// ── The working, below the drawing ───────────────────────────────────────────

function PredictWorking() {
    const length = useVar<number>("predictLadderLength", 7);
    const angle = useVar<number>("predictLeanAngle", 62);
    const guess = useVar<number>("predictGuessHeight", 4.5);
    const locked = useVar<number>("predictLocked", 0);

    if (locked !== 1) {
        return (
            <span className="text-slate-500">
                Drag the marker up or down the wall, then let go to see the working.
            </span>
        );
    }

    const trueHeight = length * Math.sin(toRadians(angle));
    const gap = Math.abs(trueHeight - guess);
    const close = gap <= 0.3;
    return (
        <span className={close ? "text-emerald-600" : "text-amber-600"} style={{ fontVariantNumeric: "tabular-nums" }}>
            {`${length.toFixed(1)} × sin ${formatAngle(angle)} = ${formatMetres(trueHeight)}. `}
            {close
                ? `Your marker was only ${gap.toFixed(1)} m out.`
                : `Your marker sat ${gap.toFixed(1)} m ${guess > trueHeight ? "above" : "below"} it, so try another lean.`}
        </span>
    );
}

// ── Figure shell ─────────────────────────────────────────────────────────────

function PredictLadderFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="solving-predict-ladder"
            onReset={() => {
                setVar("predictLadderLength", 7);
                setVar("predictLeanAngle", 62);
                setVar("predictGuessHeight", 4.5);
                setVar("predictLocked", 0);
                setVar("predictHighlight", "");
            }}
            caption="The wall carries no scale, so the height has to be worked out. Place the marker, let go, and the ladder finishes its climb."
        >
            <PredictLadderDrawing />
            <div className="px-6 pb-2 text-sm">
                <PredictWorking />
            </div>
            <div className="space-y-2 px-6 pb-5">
                <FigureSlider
                    varName="predictLadderLength"
                    label="Ladder length"
                    {...numberPropsFromDefinition(getVariableInfo("predictLadderLength"))}
                    formatValue={formatMetres}
                />
                <FigureSlider
                    varName="predictLeanAngle"
                    label="Lean angle"
                    {...numberPropsFromDefinition(getVariableInfo("predictLeanAngle"))}
                    formatValue={formatAngle}
                />
            </div>
            <InteractionHintSequence
                hintKey="solving-predict-marker"
                steps={[
                    {
                        gesture: "drag-vertical",
                        label: "Drag the marker to your predicted height, then let go",
                        position: { x: "30%", y: "34%" },
                        dragPath: { type: "line", startOffset: { x: 0, y: 24 }, endOffset: { x: 0, y: -24 } },
                    },
                ]}
            />
        </Figure>
    );
}

// ── Blocks ───────────────────────────────────────────────────────────────────

export const solvingMissingSideBlocks: ReactElement[] = [
    <StackLayout key="layout-solving-heading" maxWidth="xl">
        <Block id="solving-heading" padding="md">
            <EditableH2 id="h2-solving-heading" blockId="solving-heading">
                Solving for the Missing Side
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-solving-setup" maxWidth="xl">
        <Block id="solving-setup" padding="sm">
            <EditableParagraph id="para-solving-setup" blockId="solving-setup">
                Now for the payoff. The pair of sides in the question picks the ratio for you, and one
                of that pair is the unknown, which leaves a single letter to solve for. Before any
                working shows up, drag the marker up the wall to where you think a ladder leaning at{" "}
                <InlineScrubbleNumber
                    varName="predictLeanAngle"
                    {...numberPropsFromDefinition(getVariableInfo("predictLeanAngle"))}
                    formatValue={formatAngle}
                />{" "}
                reaches.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-solving-visual" maxWidth="xl">
        <Block id="solving-visual" padding="sm" hasVisualization>
            <PredictLadderFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-solving-rule" maxWidth="xl">
        <Block id="solving-rule" padding="sm">
            <EditableParagraph id="para-solving-rule" blockId="solving-rule">
                Let go and the working appears: the ladder's length multiplied by the sine of its lean
                gives the{" "}
                <InlineLinkedHighlight
                    varName="predictHighlight"
                    highlightId="height"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("predictHighlight"))}
                >
                    height it reaches
                </InlineLinkedHighlight>
                . Opposite and hypotenuse means sine, every time.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-solving-worked" maxWidth="xl">
        <Block id="solving-worked" padding="sm">
            <EditableParagraph id="para-solving-worked" blockId="solving-worked">
                Back to the window cleaner, then: a 6 m ladder at 75° gives a height of 6 × sin 75°,
                which comes to 5.8 m. The pavement never had to be measured at all.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-solving-question-height" maxWidth="xl">
        <Block id="solving-question-height" padding="md">
            <EditableParagraph id="para-solving-question-height" blockId="solving-question-height">
                <RevealOnInteraction varName="solvingExplored">
                    A 12 m ladder leaning at 65° reaches, to one decimal place, a height in metres of{" "}
                    <InlineFeedback
                        varName="answer_solving_height"
                        correctValue={["10.9", "10.9 m", "10.9m", "10.88"]}
                        position="terminal"
                        successMessage="— spot on, 12 × sin 65° = 10.9, and notice the ladder only loses about a metre to its lean"
                        failureMessage="— worth another go."
                        hint="The height sits opposite the 65° angle and the ladder is the hypotenuse"
                        visualizationHint={{
                            blockId: "solving-visual",
                            hintKey: "feedback-solving-height",
                            steps: [
                                {
                                    gesture: "drag-vertical",
                                    label: "This is that very ladder: drag the marker to your height and let go to see the working",
                                    position: { x: "30%", y: "34%" },
                                    completionVar: "predictLocked",
                                    completionValue: 1,
                                    completionTolerance: 0.4,
                                },
                            ],
                            label: "Discover it yourself",
                            resetVars: {
                                predictLadderLength: 12,
                                predictLeanAngle: 65,
                                predictGuessHeight: 6,
                                predictLocked: 0,
                            },
                        }}
                    >
                        <InlineClozeInput
                            varName="answer_solving_height"
                            correctAnswer={["10.9", "10.9 m", "10.9m", "10.88"]}
                            {...clozePropsFromDefinition(getVariableInfo("answer_solving_height"))}
                        />
                    </InlineFeedback>.
                </RevealOnInteraction>
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-solving-question-ratio" maxWidth="xl">
        <Block id="solving-question-ratio" padding="md">
            <EditableParagraph id="para-solving-question-ratio" blockId="solving-question-ratio">
                A different job: a ladder leans at 70° with its foot 1.5 m out from the wall, and this
                time the ladder's own length is the unknown. That pairs the adjacent side with the
                hypotenuse, so the ratio to reach for is{" "}
                <InlineFeedback
                    varName="answer_solving_ratio"
                    correctValue="cosine"
                    position="terminal"
                    successMessage="— yes, and 1.5 ÷ cos 70° gives a ladder of about 4.4 m"
                    failureMessage="— not that one."
                    hint="Sine needs the opposite side, and tangent never touches the hypotenuse"
                >
                    <InlineClozeChoice
                        varName="answer_solving_ratio"
                        correctAnswer="cosine"
                        options={["sine", "cosine", "tangent"]}
                        {...choicePropsFromDefinition(getVariableInfo("answer_solving_ratio"))}
                    />
                </InlineFeedback>.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
