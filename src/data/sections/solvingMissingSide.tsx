import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph } from "@/components/atoms";
import { VisualOptionCards } from "@/components/organisms";

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
                Now for the payoff. Name the sides from the angle you are given, then look at which two
                the question actually involves, because that pair chooses the ratio for you. One of them
                is unknown, so you end up with a single letter to solve for.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <Block key="layout-solving-visual" id="solving-visual">
        <VisualOptionCards
            blockId="solving-visual"
            cards={[
                {
                    id: "predict-ladder-height",
                    title: "A ladder leaning on a wall with a marker that slides up and down the brickwork",
                    looks: "Imagine a ladder of known length leaning against a wall at a set angle, with the wall unmarked so the height it reaches is not given away. A small marker sits on the brickwork and slides up and down, and the true height appears only once the marker has been placed.",
                    manipulate: "Slide the marker to the height they think the ladder reaches, then release it and see the real height appear beside their guess",
                    reveals: "The angle and the ladder length together fix the height, so it can be worked out rather than guessed.",
                    paradigm: "prediction",
                    recommended: true,
                },
                {
                    id: "ramp-to-tailgate",
                    title: "A loading ramp stretching up to a truck's tailgate, with its equation written alongside",
                    looks: "Imagine a delivery truck with its tailgate at a fixed height and a ramp running down to the ground at a safe angle. The ramp can be made longer or shorter, and beside the picture the working is written out with the numbers filling themselves in as the ramp changes.",
                    manipulate: "Lengthen the ramp until its top just meets the tailgate, then read the line of working that made it fit",
                    reveals: "Choosing the ratio and solving the equation gives the exact length that trial and error only stumbles onto.",
                    paradigm: "goal",
                    secondView: {
                        shows: "The line of working, with the chosen ratio, the known values and the result updating live",
                        role: "constructing",
                        syncedBy: "the ramp length and angle variables, plus a shared hover highlight linking each side to its term in the working",
                    },
                },
                {
                    id: "build-the-fraction",
                    title: "A right triangle beside an empty fraction frame waiting to be filled",
                    looks: "Imagine a right triangle with one angle and one side length given and a third side marked with a question mark. Next to it stands an empty fraction frame, and any side dropped into the frame lights up on the triangle at the same moment.",
                    manipulate: "Drag the two sides the question involves into the top and bottom of the frame, then pick the ratio name that matches",
                    reveals: "The pair of sides in the question is what picks sine, cosine or tangent, every single time.",
                    paradigm: "constructivist",
                },
            ]}
        />
    </Block>,

    <StackLayout key="layout-solving-worked" maxWidth="xl">
        <Block id="solving-worked" padding="sm">
            <EditableParagraph id="para-solving-worked" blockId="solving-worked">
                Back to the window cleaner: a 6 metre ladder at 75°, with the wall height sitting
                opposite that angle. Opposite and hypotenuse means sine, so the height is 6 × sin 75°,
                which comes to 5.8 metres. The pavement never had to be measured at all.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
