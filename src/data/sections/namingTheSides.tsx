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
const BOUNDS = { minX: 48, maxX: 512, minY: 58, maxY: 288 };

const INK = "#334155";
const INK_STRUCTURE = "#64748B";
const INK_QUIET = "#CBD5E1";
const ACCENT = "#62D0AD";

const EASE_150 = { transition: "opacity 150ms ease, stroke-width 150ms ease" } as const;

/** How square is square enough before the foot is pulled onto the exact spot. */
const SNAP_DEGREES = 3.5;
const START_FOOT = 0.72;

type Corner = "A" | "B" | "C";

interface TriangleState extends Record<string, number> {
    ax: number;
    ay: number;
    bx: number;
    by: number;
    cx: number;
    cy: number;
}

const DEFAULT_TRIANGLE: TriangleState = { ax: 110, ay: 255, bx: 470, by: 215, cx: 250, cy: 80 };

const CORNERS: Corner[] = ["A", "B", "C"];

const pointsOf = (triangle: TriangleState): Record<Corner, Vec2> => ({
    A: { x: triangle.ax, y: triangle.ay },
    B: { x: triangle.bx, y: triangle.by },
    C: { x: triangle.cx, y: triangle.cy },
});

const baseCorners = (apex: Corner): [Corner, Corner] =>
    CORNERS.filter((corner) => corner !== apex) as [Corner, Corner];

/**
 * The foot may run past the ends of the base, but never past the edge of the
 * drawing: this works out how far along the base it is still allowed to go.
 */
const footLimits = (start: Vec2, along: Vec2): [number, number] => {
    const pad = 18;
    const limitsFor = (from: number, delta: number, low: number, high: number): [number, number] => {
        if (Math.abs(delta) < 1e-6) return [-0.3, 1.3];
        const first = (low - from) / delta;
        const second = (high - from) / delta;
        return [Math.min(first, second), Math.max(first, second)];
    };
    const [xLow, xHigh] = limitsFor(start.x, along.x, BOUNDS.minX + pad, BOUNDS.maxX - pad);
    const [yLow, yHigh] = limitsFor(start.y, along.y, BOUNDS.minY + pad, BOUNDS.maxY - pad);
    return [Math.max(-0.3, xLow, yLow), Math.min(1.3, xHigh, yHigh)];
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

const svgPointFromEvent = (event: React.PointerEvent, svg: SVGSVGElement | null): Vec2 => {
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
        x: ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT,
    };
};

// ── The drawing ──────────────────────────────────────────────────────────────

function SketchRightTriangleDrawing() {
    const setVar = useSetVar();
    const triangle = useVar<TriangleState>("namingTriangle", DEFAULT_TRIANGLE);
    const apex = useVar<string>("namingApex", "C") as Corner;
    const foot = useVar<number>("namingFoot", START_FOOT);
    const { opacity, weight, isActive, hoverProps } = useHighlightState();

    const [draggingCorner, setDraggingCorner] = useState<Corner | null>(null);
    const [hoveredCorner, setHoveredCorner] = useState<Corner | null>(null);
    const [draggingFoot, setDraggingFoot] = useState(false);
    const [hoveredFoot, setHoveredFoot] = useState(false);
    const draggingCornerRef = useRef<Corner | null>(null);
    const draggingFootRef = useRef(false);
    const pressOriginRef = useRef<Vec2>({ x: 0, y: 0 });
    const movedRef = useRef(false);
    const svgRef = useRef<SVGSVGElement>(null);
    const footScale = useSpring(draggingFoot || hoveredFoot ? 1.15 : 1, { stiffness: 400, damping: 26 });

    const points = pointsOf(triangle);
    const [baseStart, baseEnd] = baseCorners(apex);
    const startPoint = points[baseStart];
    const endPoint = points[baseEnd];
    const apexPoint = points[apex];

    const along = vec2.sub(endPoint, startPoint);
    const baseLength = Math.max(vec2.len(along), 1);
    const unit = vec2.scale(along, 1 / baseLength);
    // Where the foot has to sit for the line to stand square to the base.
    const squareFoot = vec2.dot(vec2.sub(apexPoint, startPoint), unit) / baseLength;
    const height = Math.abs(vec2.dot(vec2.sub(apexPoint, startPoint), { x: -unit.y, y: unit.x }));
    const snapWindow = (height * Math.tan((SNAP_DEGREES * Math.PI) / 180)) / baseLength;

    // Corners can be dragged after the foot was placed, so the stored position
    // is kept inside the drawing here as well as during the drag.
    const [lowestFoot, highestFoot] = footLimits(startPoint, along);
    const safeFoot = clamp(foot, lowestFoot, highestFoot);
    const isSquare = Math.abs(safeFoot - squareFoot) < 1e-6;
    const footPoint = vec2.add(startPoint, vec2.scale(along, safeFoot));

    useEffect(() => {
        setVar("namingPerpendicular", isSquare ? 1 : 0);
    }, [isSquare, setVar]);

    const moveFoot = (event: React.PointerEvent<SVGCircleElement>) => {
        if (!draggingFootRef.current) return;
        const point = svgPointFromEvent(event, svgRef.current);
        const raw = vec2.dot(vec2.sub(point, startPoint), unit) / baseLength;
        const snapped = Math.abs(raw - squareFoot) < snapWindow ? squareFoot : raw;
        const [lowest, highest] = footLimits(startPoint, along);
        setVar("namingFoot", clamp(snapped, lowest, highest));
        setVar("namingExplored", true);
    };

    const moveCorner = (event: React.PointerEvent<SVGCircleElement>) => {
        const corner = draggingCornerRef.current;
        if (!corner) return;
        const point = svgPointFromEvent(event, svgRef.current);
        if (vec2.dist(point, pressOriginRef.current) > 4) movedRef.current = true;
        const key = corner.toLowerCase() as "a" | "b" | "c";
        setVar("namingTriangle", {
            ...triangle,
            [`${key}x`]: clamp(point.x, BOUNDS.minX, BOUNDS.maxX),
            [`${key}y`]: clamp(point.y, BOUNDS.minY, BOUNDS.maxY),
        });
        setVar("namingExplored", true);
    };

    const releaseCorner = (corner: Corner) => () => {
        // A press that never moved is a tap: drop the line from that corner.
        if (!movedRef.current && corner !== apex) {
            setVar("namingApex", corner);
            setVar("namingFoot", START_FOOT);
        }
        draggingCornerRef.current = null;
        setDraggingCorner(null);
    };

    // The right-angle squares, one for each of the two new triangles.
    const squareMarks = () => {
        if (!isSquare) return null;
        const up = vec2.scale(vec2.norm(vec2.sub(apexPoint, footPoint)), 15);
        const side = vec2.scale(unit, 15);
        const corner = (direction: Vec2) =>
            `M ${footPoint.x + direction.x} ${footPoint.y + direction.y} ` +
            `L ${footPoint.x + direction.x + up.x} ${footPoint.y + direction.y + up.y} ` +
            `L ${footPoint.x + up.x} ${footPoint.y + up.y}`;
        return (
            <g {...hoverProps("rightangle")} opacity={opacity("rightangle")} style={EASE_150}>
                <Halo active={isActive("rightangle")}>
                    <path d={corner(side)} fill="none" stroke={INK} strokeWidth={weight("rightangle", 2) + 6} strokeLinejoin="round" />
                    <path d={corner(vec2.scale(side, -1))} fill="none" stroke={INK} strokeWidth={weight("rightangle", 2) + 6} strokeLinejoin="round" />
                </Halo>
                <path d={corner(side)} fill="none" stroke={INK} strokeWidth={weight("rightangle", 2)} strokeLinejoin="round" />
                <path d={corner(vec2.scale(side, -1))} fill="none" stroke={INK} strokeWidth={weight("rightangle", 2)} strokeLinejoin="round" />
            </g>
        );
    };

    const cornerHandle = (corner: Corner) => {
        const point = points[corner];
        const active = draggingCorner === corner || hoveredCorner === corner;
        return (
            <g key={corner}>
                <CornerDot x={point.x} y={point.y} active={active} isApex={corner === apex} />
                <circle
                    cx={point.x}
                    cy={point.y}
                    r="22"
                    fill="transparent"
                    style={{ cursor: draggingCorner === corner ? "grabbing" : "grab", touchAction: "none" }}
                    onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        draggingCornerRef.current = corner;
                        pressOriginRef.current = svgPointFromEvent(event, svgRef.current);
                        movedRef.current = false;
                        setDraggingCorner(corner);
                    }}
                    onPointerMove={moveCorner}
                    onPointerUp={releaseCorner(corner)}
                    onPointerCancel={releaseCorner(corner)}
                    onPointerEnter={() => setHoveredCorner(corner)}
                    onPointerLeave={() => setHoveredCorner(null)}
                />
            </g>
        );
    };

    const outsideFoot = safeFoot < 0 || safeFoot > 1;
    const nearestEnd = safeFoot < 0 ? startPoint : endPoint;

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="A slanted triangle with a line dropped from one corner; sliding its foot along the base makes it square"
        >
            <defs>
                <filter id="naming-handle-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* The two right triangles, tinted only once the line is square. */}
            {isSquare && (
                <g opacity={opacity("__structure")} style={EASE_150}>
                    <polygon
                        points={`${startPoint.x},${startPoint.y} ${footPoint.x},${footPoint.y} ${apexPoint.x},${apexPoint.y}`}
                        fill={ACCENT}
                        opacity={0.1}
                    />
                    <polygon
                        points={`${footPoint.x},${footPoint.y} ${endPoint.x},${endPoint.y} ${apexPoint.x},${apexPoint.y}`}
                        fill={ACCENT}
                        opacity={0.16}
                    />
                </g>
            )}

            {/* The base — a leg of both new triangles, never a hypotenuse. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                {outsideFoot && (
                    <line x1={nearestEnd.x} y1={nearestEnd.y} x2={footPoint.x} y2={footPoint.y} stroke={INK_QUIET} strokeWidth="1.5" strokeDasharray="4 6" />
                )}
                <line x1={startPoint.x} y1={startPoint.y} x2={endPoint.x} y2={endPoint.y} stroke={INK_STRUCTURE} strokeWidth="2" strokeLinecap="round" />
            </g>

            {/* The two sloping sides — the hypotenuse of each new triangle. */}
            <g {...hoverProps("hypotenuse")} opacity={opacity("hypotenuse")} style={EASE_150}>
                <Halo active={isActive("hypotenuse")}>
                    <line x1={startPoint.x} y1={startPoint.y} x2={apexPoint.x} y2={apexPoint.y} stroke={INK_STRUCTURE} strokeWidth={weight("hypotenuse", 2) + 6} strokeLinecap="round" />
                    <line x1={endPoint.x} y1={endPoint.y} x2={apexPoint.x} y2={apexPoint.y} stroke={INK_STRUCTURE} strokeWidth={weight("hypotenuse", 2) + 6} strokeLinecap="round" />
                </Halo>
                <line x1={startPoint.x} y1={startPoint.y} x2={apexPoint.x} y2={apexPoint.y} stroke={INK_STRUCTURE} strokeWidth={weight("hypotenuse", 2)} strokeLinecap="round" />
                <line x1={endPoint.x} y1={endPoint.y} x2={apexPoint.x} y2={apexPoint.y} stroke={INK_STRUCTURE} strokeWidth={weight("hypotenuse", 2)} strokeLinecap="round" />
            </g>

            {/* The dropped line — the one accent, and the thing being aimed. */}
            <g {...hoverProps("height")} opacity={opacity("height")} style={EASE_150}>
                <Halo active={isActive("height")}>
                    <line x1={apexPoint.x} y1={apexPoint.y} x2={footPoint.x} y2={footPoint.y} stroke={ACCENT} strokeWidth={weight("height", 3) + 6} strokeLinecap="round" />
                </Halo>
                <line
                    x1={apexPoint.x}
                    y1={apexPoint.y}
                    x2={footPoint.x}
                    y2={footPoint.y}
                    stroke={ACCENT}
                    strokeWidth={weight("height", isSquare ? 3 : 2.5)}
                    strokeLinecap="round"
                    strokeDasharray={isSquare ? undefined : "7 6"}
                />
            </g>

            {squareMarks()}

            <g opacity={opacity("__structure")} style={EASE_150}>
                {CORNERS.map(cornerHandle)}
            </g>

            {/* The foot handle — slides along the base. */}
            <g transform={`translate(${footPoint.x} ${footPoint.y}) scale(${footScale})`}>
                <circle r="8" fill={ACCENT} filter="url(#naming-handle-shadow)" />
            </g>
            <circle
                cx={footPoint.x}
                cy={footPoint.y}
                r="24"
                fill="transparent"
                style={{ cursor: draggingFoot ? "grabbing" : "grab", touchAction: "none" }}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    draggingFootRef.current = true;
                    setDraggingFoot(true);
                }}
                onPointerMove={moveFoot}
                onPointerUp={() => {
                    draggingFootRef.current = false;
                    setDraggingFoot(false);
                }}
                onPointerCancel={() => {
                    draggingFootRef.current = false;
                    setDraggingFoot(false);
                }}
                onPointerEnter={() => setHoveredFoot(true)}
                onPointerLeave={() => setHoveredFoot(false)}
            />
        </svg>
    );
}

function CornerDot({ x, y, active, isApex }: { x: number; y: number; active: boolean; isApex: boolean }) {
    const scale = useSpring(active ? 1.15 : 1, { stiffness: 400, damping: 26 });
    return (
        <g transform={`translate(${x} ${y}) scale(${scale})`}>
            <circle
                r="7"
                fill={isApex ? INK : "#FFFFFF"}
                stroke={INK}
                strokeWidth="2"
                filter="url(#naming-handle-shadow)"
            />
        </g>
    );
}

// ── Status line, below the drawing ───────────────────────────────────────────

function SketchStatus() {
    const square = useVar<number>("namingPerpendicular", 0);
    if (square === 1) {
        return (
            <span className="text-emerald-600">
                Square on both sides: two right triangles, each one ready for sine, cosine and tangent.
            </span>
        );
    }
    return (
        <span className="text-slate-500">
            The dropped line still leans. Slide its foot along the base until it stands square.
        </span>
    );
}

// ── Figure shell ─────────────────────────────────────────────────────────────

function SketchRightTriangleFigure() {
    const setVar = useSetVar();
    const square = useVar<number>("namingPerpendicular", 0);
    return (
        <Figure
            id="naming-sketch-right-triangle"
            onReset={() => {
                setVar("namingTriangle", { ...DEFAULT_TRIANGLE });
                setVar("namingApex", "C");
                setVar("namingFoot", START_FOOT);
                setVar("namingHighlight", "");
            }}
            caption="A triangle with no right angle anywhere. Slide the foot of the dropped line along the base until it stands square, and tap any corner to drop the line from there instead."
        >
            <SketchRightTriangleDrawing />
            <div className="px-6 pb-5 text-sm">
                <SketchStatus />
            </div>
            <InteractionHintSequence
                hintKey="naming-sketch-foot"
                currentStep={square === 1 ? 1 : 0}
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Slide the foot along the base until the line stands square",
                        position: { x: "66%", y: "60%" },
                        dragPath: { type: "line", startOffset: { x: 26, y: 0 }, endOffset: { x: -26, y: 0 } },
                    },
                    {
                        gesture: "click",
                        label: "Tap another corner to drop the line from there instead",
                        position: { x: "20%", y: "68%" },
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
                Sine, cosine and tangent only ever work on a right triangle, and most triangles are
                not one. So we sketch one in: slide the foot of the dropped line along the base until
                it stands perfectly square, and tap a different corner to drop it from there instead.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-naming-visual" maxWidth="xl">
        <Block id="naming-visual" padding="sm" hasVisualization>
            <SketchRightTriangleFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-naming-rule" maxWidth="xl">
        <Block id="naming-rule" padding="sm">
            <EditableParagraph id="para-naming-rule" blockId="naming-rule">
                One line, and there are suddenly two right triangles to work with. Each brings its own{" "}
                <InlineLinkedHighlight
                    varName="namingHighlight"
                    highlightId="hypotenuse"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("namingHighlight"))}
                >
                    hypotenuse
                </InlineLinkedHighlight>
                , the sloping side facing its own{" "}
                <InlineLinkedHighlight
                    varName="namingHighlight"
                    highlightId="rightangle"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("namingHighlight"))}
                >
                    right angle
                </InlineLinkedHighlight>
                . The long base they share is a leg of both and the hypotenuse of neither, however
                long it looks.
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
                                    gesture: "drag-horizontal",
                                    label: "Slide the foot until the line stands square, then look at the side facing each little square",
                                    position: { x: "66%", y: "60%" },
                                    completionVar: "namingPerpendicular",
                                    completionValue: 1,
                                    completionTolerance: 0.4,
                                },
                            ],
                            label: "Discover it yourself",
                            resetVars: { namingApex: "C", namingFoot: 0.72, namingHighlight: "" },
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
