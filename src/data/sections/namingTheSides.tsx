import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph } from "@/components/atoms";
import { VisualOptionCards } from "@/components/organisms";

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
                This is where marks quietly disappear. The hypotenuse is not whichever side looks longest
                on the page; it is the side lying directly across from the right angle. Move the right
                angle and the hypotenuse moves with it.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <Block key="layout-naming-visual" id="naming-visual">
        <VisualOptionCards
            blockId="naming-visual"
            cards={[
                {
                    id: "guess-then-reveal-hypotenuse",
                    title: "A right triangle tipped at an awkward angle, with its square right-angle mark hidden",
                    looks: "Imagine a right triangle tilted so it sits at an odd angle, its three sides all different lengths and no marks on any of them. The small square that shows where the right angle is stays hidden until a side has been chosen, then appears.",
                    manipulate: "Tap the side they believe is the hypotenuse, then see the right angle appear and check whether it sits opposite their choice",
                    reveals: "The hypotenuse is fixed by the right angle, not by which side happens to be drawn longest.",
                    targetsMisconception: "Students treat the longest drawn side as the hypotenuse regardless of the right angle",
                    paradigm: "prediction",
                    recommended: true,
                },
                {
                    id: "drag-name-tags",
                    title: "A right triangle with three empty name tags waiting beside it",
                    looks: "Imagine a right triangle with one of its corners marked by a small arc, and three loose name tags lying next to it reading hypotenuse, opposite and adjacent. A tag snaps onto a side when it is dropped there, and turns pale if it lands on the wrong one.",
                    manipulate: "Drag each name tag onto the side it belongs to, then move the marked corner to the other angle and place the tags again",
                    reveals: "Opposite and adjacent swap places when you work from the other angle, while the hypotenuse never moves.",
                    paradigm: "constructivist",
                },
                {
                    id: "twin-triangles-marked-angles",
                    title: "Two identical right triangles side by side, each with a different corner marked",
                    looks: "Imagine the same right triangle drawn twice, side by side. In the left copy one sloping corner is marked with an arc, in the right copy the other one is, and each side carries its name as soon as its triangle is touched.",
                    manipulate: "Move the marked corner in either triangle and compare how the two sets of names line up",
                    reveals: "One triangle can carry two different sets of names, depending on which angle you are working from.",
                    paradigm: "comparison",
                },
            ]}
        />
    </Block>,

    <StackLayout key="layout-naming-opposite-adjacent" maxWidth="xl">
        <Block id="naming-opposite-adjacent" padding="sm">
            <EditableParagraph id="para-naming-opposite-adjacent" blockId="naming-opposite-adjacent">
                The other two names depend on the angle you are working from, not on the page. The side
                facing your angle is the opposite, and the shorter side touching it is the adjacent.
                Switch to the other angle and those two names swap over.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
