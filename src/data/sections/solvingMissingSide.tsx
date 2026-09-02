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
    InlineSpotColor,
    InlineTooltip,
    InlineTrigger,
    InteractionHintSequence,
    RevealOnInteraction,
} from "@/components/atoms";
import { Figure, FigureSlider, FormulaBlock } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { clamp, useSpring, type Vec2 } from "@/lib/motion";
import {
    choicePropsFromDefinition,
    clozePropsFromDefinition,
    getVariableInfo,
    linkedHighlightPropsFromDefinition,
    numberPropsFromDefinition,
    scrubVarsFromDefinitions,
    spotColorPropsFromDefinition,
} from "../variables";

// ── View geometry ────────────────────────────────────────────────────────────

const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 340;
const GROUND_Y = 286;
const WALL_X = 170;
const PX_PER_METRE = 19;
const WALL_TOP_METRES = 12.2;

const INK_STRUCTURE = "#64748B";
const INK_QUIET = "#CBD5E1";

// The lesson's shared colour language, again: teal height, indigo angle,
// violet ladder, and rose for the student's own prediction.
const OPPOSITE = "#62D0AD";
const OPPOSITE_TEXT = "#3FA98A";
const ANGLE = "#8E90F5";
const HYPOTENUSE = "#9575E8";
const GUESS = "#E285B5";

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

    // The number the working formula reads back out of the store.
    useEffect(() => {
        setVar("predictTrueHeight", Math.round(trueHeight * 10) / 10);
    }, [trueHeight, setVar]);
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
                <text x="24" y="32" fill={HYPOTENUSE} opacity={opacity("ladder")}>
                    {`ladder = ${formatMetres(length)}`}
                </text>
                <text x={VIEW_WIDTH - 24} y="32" fill={ANGLE} textAnchor="end" opacity={opacity("angle")}>
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
                        stroke={HYPOTENUSE}
                        strokeWidth={weight("ladder", 3) + 6}
                        strokeLinecap="round"
                    />
                </Halo>
                <line
                    x1={footX}
                    y1={GROUND_Y}
                    x2={locked ? WALL_X : stubX}
                    y2={locked ? topY : stubY}
                    stroke={HYPOTENUSE}
                    strokeWidth={weight("ladder", 3)}
                    strokeLinecap="round"
                />
                {!locked && (
                    <line x1={stubX} y1={stubY} x2={dashX} y2={dashY} stroke={INK_QUIET} strokeWidth="1.5" strokeDasharray="3 7" />
                )}
            </g>

            {/* ANGLE group — the arc at the foot. */}
            <g {...hoverProps("angle")} opacity={opacity("angle")} style={EASE_150}>
                <Halo active={isActive("angle")}>
                    <path d={arcPath} fill="none" stroke={ANGLE} strokeWidth={weight("angle", 2.5) + 6} strokeLinecap="round" />
                </Halo>
                <path d={arcPath} fill="none" stroke={ANGLE} strokeWidth={weight("angle", 2.5)} strokeLinecap="round" />
            </g>

            {/* HEIGHT group — revealed only once the prediction is committed,
                so the guess marker stays beside it as the comparand. */}
            {locked === 1 && (
                <g {...hoverProps("height")} opacity={opacity("height")} style={EASE_150}>
                    <Halo active={isActive("height")}>
                        <line x1={WALL_X} y1={GROUND_Y} x2={WALL_X} y2={topY} stroke={OPPOSITE} strokeWidth={weight("height", 3) + 6} strokeLinecap="round" />
                    </Halo>
                    <line x1={WALL_X} y1={GROUND_Y} x2={WALL_X} y2={topY} stroke={OPPOSITE} strokeWidth={weight("height", 3)} strokeLinecap="round" />
                    <line x1={WALL_X} y1={topY} x2={WALL_X + 74} y2={topY} stroke={OPPOSITE} strokeWidth="1.5" strokeDasharray="3 4" opacity={0.6} />
                    <text x={WALL_X + 12} y={topY - 8} fill={OPPOSITE} fontSize="12" style={{ fontVariantNumeric: "tabular-nums" }}>
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

// ── The working, as a live formula ───────────────────────────────────────────

const PREDICT_FORMULA_VARIABLES = {
    predictLadderLength: {
        ...scrubVarsFromDefinitions(["predictLadderLength"]).predictLadderLength,
        formatValue: (value: number) => value.toFixed(1),
    },
    predictLeanAngle: {
        ...scrubVarsFromDefinitions(["predictLeanAngle"]).predictLeanAngle,
        formatValue: (value: number) => `${Math.round(value)}^\\circ`,
    },
    predictTrueHeight: {
        color: OPPOSITE_TEXT,
        formatValue: (value: number) => value.toFixed(1),
    },
};

const PREDICT_FORMULA_HIGHLIGHTS = {
    height: {
        varName: "predictHighlight",
        color: OPPOSITE_TEXT,
        bgColor: "rgba(98, 208, 173, 0.22)",
    },
    ladder: {
        varName: "predictHighlight",
        color: HYPOTENUSE,
        bgColor: "rgba(149, 117, 232, 0.20)",
    },
};

/** The answer only joins the equation once the prediction has been committed. */
function PredictWorkingFormula() {
    const locked = useVar<number>("predictLocked", 0);
    const latex =
        "\\highlight{height}{\\mathrm h} \\;=\\; \\scrub{predictLadderLength}\\,\\text{m} " +
        "\\times \\sin \\scrub{predictLeanAngle}" +
        (locked === 1 ? " \\;=\\; \\val{predictTrueHeight}\\,\\text{m}" : "");
    return (
        <FormulaBlock
            latex={latex}
            variables={PREDICT_FORMULA_VARIABLES}
            linkedHighlights={PREDICT_FORMULA_HIGHLIGHTS}
        />
    );
}

// ── Blocks ───────────────────────────────────────────────────────────────────

export const solvingMissingSideBlocks: ReactElement[] = [
    <StackLayout key="layout-solving-heading" maxWidth="xl">
        <Block id="solving-heading" padding="md">
            <EditableH2 id="h2-solving-heading" blockId="solving-heading">
                Applying the Trigonometric Ratios to an Unknown Side
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-solving-setup" maxWidth="xl">
        <Block id="solving-setup" padding="sm">
            <EditableParagraph id="para-solving-setup" blockId="solving-setup">
                Now for the payoff. The pair of sides in the question picks the ratio for you, and one
                of that pair is the unknown, which leaves a single letter to solve for. Before any
                working shows up, drag the rose marker up the wall to where you think a{" "}
                <InlineScrubbleNumber
                    varName="predictLadderLength"
                    {...numberPropsFromDefinition(getVariableInfo("predictLadderLength"))}
                    formatValue={formatMetres}
                />{" "}
                ladder leaning at{" "}
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
                Let go and the working appears: the violet{" "}
                <InlineLinkedHighlight
                    varName="predictHighlight"
                    highlightId="ladder"
                    color={HYPOTENUSE}
                    bgColor="rgba(149, 117, 232, 0.20)"
                >
                    ladder
                </InlineLinkedHighlight>{" "}
                multiplied by the sine of its indigo{" "}
                <InlineLinkedHighlight
                    varName="predictHighlight"
                    highlightId="angle"
                    color={ANGLE}
                    bgColor="rgba(142, 144, 245, 0.22)"
                >
                    lean
                </InlineLinkedHighlight>{" "}
                gives the teal{" "}
                <InlineLinkedHighlight
                    varName="predictHighlight"
                    highlightId="height"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("predictHighlight"))}
                >
                    height h it reaches
                </InlineLinkedHighlight>
                . Opposite and hypotenuse means sine, every time.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-solving-formula" maxWidth="xl">
        <Block id="solving-formula" padding="lg">
            <PredictWorkingFormula />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-solving-worked" maxWidth="xl">
        <Block id="solving-worked" padding="sm">
            <EditableParagraph id="para-solving-worked" blockId="solving-worked">
                Back to the window cleaner, then: the{" "}
                <InlineTrigger id="trigger-solving-cleaner-ladder" varName="predictLadderLength" value={6}>
                    cleaner{"\u2019"}s 6 m ladder
                </InlineTrigger>{" "}
                at its{" "}
                <InlineTrigger id="trigger-solving-safety-lean" varName="predictLeanAngle" value={75}>
                    75° safety lean
                </InlineTrigger>{" "}
                reaches 6 × sin 75°, which comes to 5.8 m. The pavement never had to be measured, and the{" "}
                <InlineSpotColor
                    id="spot-solving-hypotenuse"
                    varName="sideHypotenuse"
                    {...spotColorPropsFromDefinition(getVariableInfo("sideHypotenuse"))}
                >
                    hypotenuse
                </InlineSpotColor>{" "}
                did all the work.
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
                time the ladder's own length is the unknown. That pairs the{" "}
                <InlineTooltip
                    id="tooltip-solving-adjacent"
                    tooltip="The adjacent side is the leg that touches the angle you are working from, running from that corner to the right angle."
                >
                    adjacent side
                </InlineTooltip>{" "}
                with the hypotenuse, so the ratio to reach for is{" "}
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
