import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH1, EditableParagraph } from "@/components/atoms";

export const findingMissingSideBlocks: ReactElement[] = [
    <StackLayout key="layout-orient-title" maxWidth="xl">
        <Block id="orient-title" padding="md">
            <EditableH1 id="h1-orient-title" blockId="orient-title">
                Finding a Missing Side
            </EditableH1>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-orient-ladder-hook" maxWidth="xl">
        <Block id="orient-ladder-hook" padding="sm">
            <EditableParagraph id="para-orient-ladder-hook" blockId="orient-ladder-hook">
                A window cleaner leans a 6 metre ladder against a wall, and the safety rule says it
                should sit at 75° to the ground. How far up the wall does the top reach? Nobody can
                measure that from the pavement, yet the answer is already decided by that single angle.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-orient-promise" maxWidth="xl">
        <Block id="orient-promise" padding="sm">
            <EditableParagraph id="para-orient-promise" blockId="orient-promise">
                That is what trigonometry is for, and by the end you will be able to find a missing side
                of any right triangle from one angle and one length. You already know how to spot a right
                angle and its hypotenuse, that similar triangles share side ratios, and how to solve
                x/8 = 0.5. Your calculator handles the rest.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
