import { type ReactElement } from "react";

// Initialize variables and their colors from this file's variable definitions
import { useVariableStore, initializeVariableColors } from "@/stores";
import { getDefaultValues, variableDefinitions } from "./variables";
useVariableStore.getState().initialize(getDefaultValues());
initializeVariableColors(variableDefinitions);

import { findingMissingSideBlocks } from "./sections/findingMissingSide";
import { ratioIgnoresSizeBlocks } from "./sections/ratioIgnoresSize";
import { namingTheSidesBlocks } from "./sections/namingTheSides";
import { solvingMissingSideBlocks } from "./sections/solvingMissingSide";
import { wrappingUpBlocks } from "./sections/wrappingUp";

export const blocks: ReactElement[] = [
    ...findingMissingSideBlocks,
    ...ratioIgnoresSizeBlocks,
    ...namingTheSidesBlocks,
    ...solvingMissingSideBlocks,
    ...wrappingUpBlocks,
];
