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
    InteractionHintSequence,
    RevealOnInteraction,
} from "@/components/atoms";
import { Figure } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { clamp, useSpring, vec2, type Vec2 } from "@/lib/motion";
import {
    choicePropsFromDefinition,
    clozePropsFromDefinition,
    getVariableInfo,
    linkedHighlightPropsFromDefinition,
} from "../variables";

// ── View geometry ────────────────────────────────────────────────────────────

const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 330;
const BOUNDS = { minX: 48, maxX: 512, minY: 62, maxY: 292 };

const INK = "#334155";
const INK_STRUCTURE = "#64748B";
const INK_QUIET = "#CBD5E1";
const ACCENT = "#62D0AD";
const GUESS = "#F7B23B";

const EASE_150 = { transition: "opacity 150ms ease, stroke-width 150ms ease" } as const;

const SNAP_DEGREES = 6;

type Corner = "A" | "B" | "C";
type Side = "AB" | "BC" | "CA";

interface TriangleState extends Record<string, number> {
    ax: number;
    ay: number;
    bx: number;
    by: number;
    cx: number;
    cy: number;
}

const DEFAULT_TRIANGLE: TriangleState = { ax: 110, ay: 110, bx: 400, by: 80, cx: 419.6, cy: 269 };

const CORNERS: Corner[] = ["A", "B", "C"];
/** The side facing each corner — the hypotenuse when that corner is the right angle. */
const OPPOSITE_SIDE: Record<Corner, Side> = { A: "BC", B: "CA", C: "AB" };
const SIDE_ENDS: Record<Side, [Corner, Corner]> = { AB: ["A", "B"], BC: ["B", "C"], CA: ["C", "A"] };

const pointsOf = (triangle: TriangleState): Record<Corner, Vec2> => ({
    A: { x: triangle.ax, y: triangle.ay },
    B: { x: triangle.bx, y: triangle.by },
    C: { x: triangle.cx, y: triangle.cy },
});

const angleAt = (corner: Vec2, first: Vec2, second: Vec2) => {
    const u = vec2.sub(first, corner);
    const v = vec2.sub(second, corner);
    const lengths = vec2.len(u) * vec2.len(v);
    if (lengths < 1) return 0;
    return (Math.acos(clamp(vec2.dot(u, v) / lengths, -1, 1)) * 180) / Math.PI;
};

const otherCorners = (corner: Corner): [Corner, Corner] =>
    CORNERS.filter((candidate) => candidate !== corner) as [Corner, Corner];

const cornerAngles = (triangle: TriangleState): Record<Corner, number> => {
    const points = pointsOf(triangle);
    return CORNERS.reduce((result, corner) => {
        const [first, second] = otherCorners(corner);
        result[corner] = angleAt(points[corner], points[first], points[second]);
        return result;
    }, {} as Record<Corner, number>);
};

/** The right-angle corner, or null when this triangle simply has not got one. */
const rightAngleCorner = (triangle: TriangleState): Corner | null => {
    const angles = cornerAngles(triangle);
    return CORNERS.find((corner) => Math.abs(angles[corner] - 90) < 0.6) ?? null;
};

/**
 * Free dragging never lands exactly on 90°, so a corner that comes within a few
 * degrees is pulled onto the exact right angle: onto the Thales circle when the
 * near-square corner is the one being dragged, onto the perpendicular ray when
 * it is one of the other two.
 */
const snapToRightAngle = (triangle: TriangleState, dragged: Corner): TriangleState => {
    const points = pointsOf(triangle);
    const angles = cornerAngles(triangle);
    const candidate = CORNERS
        .filter((corner) => Math.abs(angles[corner] - 90) < SNAP_DEGREES)
        .sort((left, right) => Math.abs(angles[left] - 90) - Math.abs(angles[right] - 90))[0];
    if (!candidate) return triangle;

    let snapped: Vec2;
    if (candidate === dragged) {
        const [first, second] = otherCorners(dragged);
        const middle = vec2.scale(vec2.add(points[first], points[second]), 0.5);
        const radius = vec2.dist(points[first], points[second]) / 2;
        const direction = vec2.sub(points[dragged], middle);
        if (vec2.len(direction) < 1) return triangle;
        snapped = vec2.add(middle, vec2.scale(vec2.norm(direction), radius));
    } else {
        const third = otherCorners(candidate).find((corner) => corner !== dragged) as Corner;
        const along = vec2.sub(points[third], points[candidate]);
        if (vec2.len(along) < 1) return triangle;
        const unit = vec2.norm(along);
        const normal = { x: -unit.y, y: unit.x };
        const offset = vec2.sub(points[dragged], points[candidate]);
        snapped = vec2.add(points[candidate], vec2.scale(normal, vec2.dot(offset, normal)));
    }

    const clamped = {
        x: clamp(snapped.x, BOUNDS.minX, BOUNDS.maxX),
        y: clamp(snapped.y, BOUNDS.minY, BOUNDS.maxY),
    };
    const key = dragged.toLowerCase() as "a" | "b" | "c";
    return { ...triangle, [`${key}x`]: clamped.x, [`${key}y`]: clamped.y };
};

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
    const highlight = useVar<string>("namingHighlight", "");
    const setVar = useSetVar();
    return {
        opacity: (id: string) => (highlight && highlight !== id ? 0.35 : 1),
        weight: (id: string, resting: number) => (highlight === id ? resting * 1.6 : resting),
        isActive: (id: string) => highlight === id,
        hoverProps: (id: string) => ({
            onPointerEnter: () => setVar("namingHighlight", id),
            onPointerLeave: () => setVar("namingHighlight", ""),
        }),
    };
};

const Halo = ({ active, children }: { active: boolean; children: React.ReactNode }) =>
    active ? <g opacity={0.28}>{children}</g> : null;

// ── The drawing ──────────────────────────────────────────────────────────────

function TipedTriangleDrawing() {
    const setVar = useSetVar();
    const triangle = useVar<TriangleState>("namingTriangle", DEFAULT_TRIANGLE);
    const guess = useVar<string>("namingGuess", "");
    const { opacity, weight, isActive, hoverProps } = useHighlightState();

    const [draggingCorner, setDraggingCorner] = useState<Corner | null>(null);
    const [hoveredCorner, setHoveredCorner] = useState<Corner | null>(null);
    const draggingRef = useRef<Corner | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const points = pointsOf(triangle);
    const rightCorner = rightAngleCorner(triangle);
    const revealed = guess !== "";
    const trueHypotenuse = rightCorner ? OPPOSITE_SIDE[rightCorner] : null;

    // Numeric mirrors of the state, so guided hints can watch for progress.
    useEffect(() => {
        setVar("namingHasRightAngle", rightCorner ? 1 : 0);
        setVar("namingGuessCorrect", revealed && guess === trueHypotenuse ? 1 : 0);
    }, [rightCorner, revealed, guess, trueHypotenuse, setVar]);

    const handlePointerMove = (event: React.PointerEvent<SVGCircleElement>) => {
        const corner = draggingRef.current;
        if (!corner) return;
        const point = svgPointFromEvent(event, svgRef.current);
        const key = corner.toLowerCase() as "a" | "b" | "c";
        const moved: TriangleState = {
            ...triangle,
            [`${key}x`]: clamp(point.x, BOUNDS.minX, BOUNDS.maxX),
            [`${key}y`]: clamp(point.y, BOUNDS.minY, BOUNDS.maxY),
        };
        setVar("namingTriangle", snapToRightAngle(moved, corner));
    };

    const startDrag = (corner: Corner) => (event: React.PointerEvent<SVGCircleElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        draggingRef.current = corner;
        setDraggingCorner(corner);
        setVar("namingExplored", true);
    };

    const endDrag = () => {
        draggingRef.current = null;
        setDraggingCorner(null);
    };

    const chooseSide = (side: Side) => () => {
        setVar("namingGuess", side);
        setVar("namingExplored", true);
    };

    const rightAngleMark = () => {
        if (!revealed || !rightCorner) return null;
        const [first, second] = otherCorners(rightCorner);
        const corner = points[rightCorner];
        const u = vec2.scale(vec2.norm(vec2.sub(points[first], corner)), 17);
        const v = vec2.scale(vec2.norm(vec2.sub(points[second], corner)), 17);
        const path =
            `M ${corner.x + u.x} ${corner.y + u.y} ` +
            `L ${corner.x + u.x + v.x} ${corner.y + u.y + v.y} ` +
            `L ${corner.x + v.x} ${corner.y + v.y}`;
        return (
            <g {...hoverProps("rightangle")} opacity={opacity("rightangle")} style={EASE_150}>
                <Halo active={isActive("rightangle")}>
                    <path d={path} fill="none" stroke={INK} strokeWidth={weight("rightangle", 2) + 6} strokeLinejoin="round" />
                </Halo>
                <path d={path} fill="none" stroke={INK} strokeWidth={weight("rightangle", 2)} strokeLinejoin="round" />
            </g>
        );
    };

    const sideLine = (side: Side) => {
        const [from, to] = SIDE_ENDS[side];
        const isHypotenuse = revealed && trueHypotenuse === side;
        const isGuess = guess === side;
        const groupId = isHypotenuse ? "hypotenuse" : "__structure";
        return (
            <g
                key={side}
                {...(isHypotenuse ? hoverProps("hypotenuse") : {})}
                opacity={opacity(groupId)}
                style={EASE_150}
            >
                {isHypotenuse && (
                    <Halo active={isActive("hypotenuse")}>
                        <line
                            x1={points[from].x}
                            y1={points[from].y}
                            x2={points[to].x}
                            y2={points[to].y}
                            stroke={ACCENT}
                            strokeWidth={weight("hypotenuse", 3.5) + 6}
                            strokeLinecap="round"
                        />
                    </Halo>
                )}
                <line
                    x1={points[from].x}
                    y1={points[from].y}
                    x2={points[to].x}
                    y2={points[to].y}
                    stroke={isHypotenuse ? ACCENT : INK_STRUCTURE}
                    strokeWidth={isHypotenuse ? weight("hypotenuse", 3.5) : 2}
                    strokeLinecap="round"
                />
                {isGuess && (
                    <line
                        x1={points[from].x}
                        y1={points[from].y}
                        x2={points[to].x}
                        y2={points[to].y}
                        stroke={GUESS}
                        strokeWidth="2"
                        strokeDasharray="6 6"
                        strokeLinecap="round"
                    />
                )}
                {/* Generous transparent strip so a side is easy to tap. */}
                <line
                    x1={points[from].x}
                    y1={points[from].y}
                    x2={points[to].x}
                    y2={points[to].y}
                    stroke="transparent"
                    strokeWidth="22"
                    style={{ cursor: "pointer", touchAction: "none" }}
                    onPointerDown={chooseSide(side)}
                />
            </g>
        );
    };

    const cornerHandle = (corner: Corner) => {
        const point = points[corner];
        const active = draggingCorner === corner || hoveredCorner === corner;
        return (
            <g key={corner}>
                <CornerDot x={point.x} y={point.y} active={active} />
                <circle
                    cx={point.x}
                    cy={point.y}
                    r="22"
                    fill="transparent"
                    style={{ cursor: draggingCorner === corner ? "grabbing" : "grab", touchAction: "none" }}
                    onPointerDown={startDrag(corner)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onPointerEnter={() => setHoveredCorner(corner)}
                    onPointerLeave={() => setHoveredCorner(null)}
                />
            </g>
        );
    };

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="A tipped triangle whose corners can be dragged; tapping a side commits a guess at the hypotenuse"
        >
            <defs>
                <filter id="naming-corner-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* The ghost of the starting triangle — every change stays visible
                against where it began. */}
            <polygon
                points={`${DEFAULT_TRIANGLE.ax},${DEFAULT_TRIANGLE.ay} ${DEFAULT_TRIANGLE.bx},${DEFAULT_TRIANGLE.by} ${DEFAULT_TRIANGLE.cx},${DEFAULT_TRIANGLE.cy}`}
                fill="none"
                stroke={INK_QUIET}
                strokeWidth="1.5"
                strokeDasharray="4 6"
                opacity={opacity("__structure")}
                style={EASE_150}
            />

            {(["AB", "BC", "CA"] as Side[]).map(sideLine)}
            {rightAngleMark()}
            <g opacity={opacity("__structure")} style={EASE_150}>
                {CORNERS.map(cornerHandle)}
            </g>
        </svg>
    );
}

function CornerDot({ x, y, active }: { x: number; y: number; active: boolean }) {
    const scale = useSpring(active ? 1.15 : 1, { stiffness: 400, damping: 26 });
    return (
        <g transform={`translate(${x} ${y}) scale(${scale})`}>
            <circle r="7" fill={ACCENT} filter="url(#naming-corner-shadow)" />
        </g>
    );
}

// ── Status line, below the drawing ───────────────────────────────────────────

function TriangleStatus() {
    const triangle = useVar<TriangleState>("namingTriangle", DEFAULT_TRIANGLE);
    const guess = useVar<string>("namingGuess", "");
    const rightCorner = rightAngleCorner(triangle);

    if (guess === "") {
        return <span className="text-slate-500">Tap a side to commit to your choice.</span>;
    }
    if (!rightCorner) {
        return (
            <span className="text-amber-600">
                No square appeared: this triangle has no right angle, so it has no hypotenuse at all.
            </span>
        );
    }
    if (guess === OPPOSITE_SIDE[rightCorner]) {
        return (
            <span className="text-emerald-600">
                That side sits directly across from the square, so it is the hypotenuse.
            </span>
        );
    }
    return (
        <span className="text-amber-600">
            That side runs into the square, so it is a leg. The hypotenuse is the side facing it.
        </span>
    );
}

// ── Figure shell ─────────────────────────────────────────────────────────────

function TippedTriangleFigure() {
    const setVar = useSetVar();
    const guess = useVar<string>("namingGuess", "");
    return (
        <Figure
            id="naming-tipped-triangle"
            onReset={() => {
                setVar("namingTriangle", { ...DEFAULT_TRIANGLE });
                setVar("namingGuess", "");
                setVar("namingHighlight", "");
            }}
            caption="Tap the side you think is the hypotenuse. The right-angle square appears only once you have committed, and dragging any corner starts a fresh triangle."
        >
            <TipedTriangleDrawing />
            <div className="px-6 pb-5 text-sm">
                <TriangleStatus />
            </div>
            <InteractionHintSequence
                hintKey="naming-triangle-tap"
                currentStep={guess === "" ? 0 : 1}
                steps={[
                    {
                        gesture: "click",
                        label: "Tap the side you think is the hypotenuse",
                        position: { x: "47%", y: "50%" },
                    },
                    {
                        gesture: "drag",
                        label: "Drag a corner to tip the triangle and try again",
                        position: { x: "75%", y: "72%" },
                    },
                ]}
            />
        </Figure>
    );
}

// ── Blocks ───────────────────────────────────────────────────────────────────

export const namingTheSidesBlocks: ReactElement[] = [
    <StackLayout key="layout-naming-heading" maxWidth="xl">
        <Block id="naming-heading" padding="md">
            <EditableH2 id="h2-naming-heading" blockId="naming-heading">
                Naming the Sides
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-naming-setup" maxWidth="xl">
        <Block id="naming-setup" padding="sm">
            <EditableParagraph id="para-naming-setup" blockId="naming-setup">
                This is where marks quietly disappear. Tap the side you believe is the hypotenuse,
                then drag any corner to tip the triangle into a new shape and try again. The little
                square only turns up once you have committed.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-naming-visual" maxWidth="xl">
        <Block id="naming-visual" padding="sm" hasVisualization>
            <TippedTriangleFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-naming-rule" maxWidth="xl">
        <Block id="naming-rule" padding="sm">
            <EditableParagraph id="para-naming-rule" blockId="naming-rule">
                The{" "}
                <InlineLinkedHighlight
                    varName="namingHighlight"
                    highlightId="hypotenuse"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("namingHighlight"))}
                >
                    hypotenuse
                </InlineLinkedHighlight>{" "}
                is not whichever side looks longest on the page; it is the side lying straight across
                from the{" "}
                <InlineLinkedHighlight
                    varName="namingHighlight"
                    highlightId="rightangle"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("namingHighlight"))}
                >
                    right angle
                </InlineLinkedHighlight>
                . Pull a corner far enough and the square vanishes, and a triangle with no right angle
                has no hypotenuse either.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-naming-opposite-adjacent" maxWidth="xl">
        <Block id="naming-opposite-adjacent" padding="sm">
            <EditableParagraph id="para-naming-opposite-adjacent" blockId="naming-opposite-adjacent">
                The other two names depend on the angle you work from. The side facing your angle is
                the opposite, and the leg touching it is the adjacent. Switch angles and those two
                swap over.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-naming-question-hypotenuse" maxWidth="xl">
        <Block id="naming-question-hypotenuse" padding="md">
            <EditableParagraph id="para-naming-question-hypotenuse" blockId="naming-question-hypotenuse">
                <RevealOnInteraction varName="namingExplored">
                    Triangle PQR has its right angle at Q, so its hypotenuse is the side{" "}
                    <InlineFeedback
                        varName="answer_naming_hypotenuse"
                        correctValue={["PR", "RP"]}
                        position="terminal"
                        successMessage="— yes, the only side that never touches Q"
                        failureMessage="— have another look."
                        hint="Name the two corners that are not Q"
                        visualizationHint={{
                            blockId: "naming-visual",
                            hintKey: "feedback-naming-hypotenuse",
                            steps: [
                                {
                                    gesture: "drag",
                                    label: "Drag a corner until the small square appears at one corner",
                                    position: { x: "75%", y: "72%" },
                                    completionVar: "namingHasRightAngle",
                                    completionValue: 1,
                                    completionTolerance: 0.4,
                                },
                                {
                                    gesture: "click",
                                    label: "Now tap the one side that does not run into that square",
                                    position: { x: "47%", y: "50%" },
                                    completionVar: "namingGuessCorrect",
                                    completionValue: 1,
                                    completionTolerance: 0.4,
                                },
                            ],
                            label: "Discover it yourself",
                            resetVars: { namingGuess: "", namingHighlight: "" },
                        }}
                    >
                        <InlineClozeInput
                            varName="answer_naming_hypotenuse"
                            correctAnswer={["PR", "RP"]}
                            {...clozePropsFromDefinition(getVariableInfo("answer_naming_hypotenuse"))}
                        />
                    </InlineFeedback>.
                </RevealOnInteraction>
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-naming-question-from-p" maxWidth="xl">
        <Block id="naming-question-from-p" padding="md">
            <EditableParagraph id="para-naming-question-from-p" blockId="naming-question-from-p">
                Still in triangle PQR with the right angle at Q, a student working from angle P should
                call side QR the{" "}
                <InlineFeedback
                    varName="answer_naming_side_from_p"
                    correctValue="opposite"
                    position="terminal"
                    successMessage="— right, it faces P without touching it, and from angle R it would be the adjacent instead"
                    failureMessage="— not this time."
                    hint="Check whether QR touches angle P or faces it from across the triangle"
                >
                    <InlineClozeChoice
                        varName="answer_naming_side_from_p"
                        correctAnswer="opposite"
                        options={["opposite", "adjacent", "hypotenuse"]}
                        {...choicePropsFromDefinition(getVariableInfo("answer_naming_side_from_p"))}
                    />
                </InlineFeedback>.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
