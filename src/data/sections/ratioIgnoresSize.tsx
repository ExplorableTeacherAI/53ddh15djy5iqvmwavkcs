import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph } from "@/components/atoms";
import { VisualOptionCards } from "@/components/organisms";

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
                Shrink that ladder to half its length but keep the same 75° lean against the wall. The
                height it reaches halves as well, so height divided by ladder length comes out exactly
                the same. Size cancels itself out, and only the angle survives.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <Block key="layout-ratio-visual" id="ratio-visual">
        <VisualOptionCards
            blockId="ratio-visual"
            cards={[
                {
                    id: "two-triangles-same-slope",
                    title: "A small right triangle sitting inside a much larger one, both with the same slope",
                    looks: "Imagine a small right triangle drawn from a corner, with a much larger one starting at the same corner and running along the same slope. Beside each triangle sits its own height divided by its longest side, worked out and written as a decimal.",
                    manipulate: "Stretch the large triangle out by its far corner and watch both decimals as it grows",
                    reveals: "Making a triangle bigger does not change the ratio between its sides; only the angle changes it.",
                    paradigm: "comparison",
                    recommended: true,
                },
                {
                    id: "ladder-trail-graph",
                    title: "A ladder sliding against a wall, beside a graph of its height-to-length ratio",
                    looks: "Imagine a ladder resting against a wall, with its foot free to slide in and out along the ground. Beside it a graph plots the height reached divided by the ladder's length, and a dot leaves a trail behind as the ladder swings.",
                    manipulate: "Slide the foot of the ladder in and out and watch the dot climb the curve it traces",
                    reveals: "Every lean angle has its own fixed ratio, and the calculator's sine button simply looks that ratio up.",
                    paradigm: "temporal",
                    secondView: {
                        shows: "A graph of the height-to-length ratio against the lean angle, with the current angle marked",
                        role: "complementary",
                        syncedBy: "the lean angle variable, plus a shared hover highlight linking the ladder to the point on the curve",
                    },
                },
                {
                    id: "hill-target-ratio",
                    title: "A hillside whose steepness can be tilted, with a target ratio written above it",
                    looks: "Imagine a hillside road drawn as a right triangle, with its height and its length labelled and the ratio between them shown underneath as a decimal. Above the hill a target such as 0.5 is written up as the number to hit.",
                    manipulate: "Tilt the hillside until the ratio underneath it matches the target exactly",
                    reveals: "One ratio always lands on one angle, which is why an angle alone is enough to pin down the sides.",
                    paradigm: "goal",
                },
            ]}
        />
    </Block>,

    <StackLayout key="layout-ratio-naming" maxWidth="xl">
        <Block id="ratio-naming" padding="sm">
            <EditableParagraph id="para-ratio-naming" blockId="ratio-naming">
                That fixed number has a name. For any angle, the side opposite it divided by the
                hypotenuse is called the sine of that angle, and a calculator stores every one of those
                values. Cosine and tangent are the same idea built from the other two pairs of sides.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
