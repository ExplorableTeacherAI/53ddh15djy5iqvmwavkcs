import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph } from "@/components/atoms";

export const wrappingUpBlocks: ReactElement[] = [
    <StackLayout key="layout-wrapping-heading" maxWidth="xl">
        <Block id="wrapping-heading" padding="md">
            <EditableH2 id="h2-wrapping-heading" blockId="wrapping-heading">
                Wrapping Up
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-wrapping-idea" maxWidth="xl">
        <Block id="wrapping-idea" padding="sm">
            <EditableParagraph id="para-wrapping-idea" blockId="wrapping-idea">
                All of right-triangle trigonometry rests on one stubborn fact: fix the angle and the
                ratios between the sides are fixed too, however large you draw the triangle. Sine, cosine
                and tangent are simply the names of those three ratios, and the calculator is the book
                that stores their values.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-wrapping-next" maxWidth="xl">
        <Block id="wrapping-next" padding="sm">
            <EditableParagraph id="para-wrapping-next" blockId="wrapping-next">
                Once you can name the sides from the angle you are standing at, every question becomes
                the same short routine: pick the pair, pick the ratio, solve for the letter. Surveyors,
                roofers and game designers all use it to find lengths nobody can reach with a tape
                measure. Next comes the reverse trip, using two known sides to find the missing angle.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
