/**
 * Variables Configuration
 * =======================
 * 
 * CENTRAL PLACE TO DEFINE ALL SHARED VARIABLES
 * 
 * This file defines all variables that can be shared across sections.
 * AI agents should read this file to understand what variables are available.
 * 
 * USAGE:
 * 1. Define variables here with their default values and metadata
 * 2. Use them in any section with: const x = useVar('variableName', defaultValue)
 * 3. Update them with: setVar('variableName', newValue)
 */

import { type VarValue } from '@/stores';

/**
 * Variable definition with metadata
 */
export interface VariableDefinition {
    /** Default value */
    defaultValue: VarValue;
    /** Human-readable label */
    label?: string;
    /** Description for AI agents */
    description?: string;
    /** Variable type hint */
    type?: 'number' | 'text' | 'boolean' | 'select' | 'array' | 'object' | 'spotColor' | 'linkedHighlight';
    /** Unit (e.g., 'Hz', '°', 'm/s') - for numbers */
    unit?: string;
    /** Minimum value (for number sliders) */
    min?: number;
    /** Maximum value (for number sliders) */
    max?: number;
    /** Step increment (for number sliders) */
    step?: number;
    /** Display color for InlineScrubbleNumber / InlineSpotColor (e.g. '#D81B60') */
    color?: string;
    /** Options for 'select' type variables */
    options?: string[];
    /** Placeholder text for text inputs */
    placeholder?: string;
    /**
     * Correct answer for cloze input validation.
     * Accepts a single string, pipe-separated alternates (e.g. "first | 1 | 1st"),
     * or an array of accepted answers (e.g. ["first", "1", "1st"]).
     */
    correctAnswer?: string | string[];
    /** Whether cloze matching is case sensitive */
    caseSensitive?: boolean;
    /** Background color for inline components */
    bgColor?: string;
    /** Schema hint for object types (for AI agents) */
    schema?: string;
}

/**
 * =====================================================
 * 🎯 DEFINE YOUR VARIABLES HERE
 * =====================================================
 * 
 * SUPPORTED TYPES:
 * 
 * 1. NUMBER (slider):
 *    { defaultValue: 5, type: 'number', min: 0, max: 10, step: 1 }
 * 
 * 2. TEXT (free text):
 *    { defaultValue: 'Hello', type: 'text', placeholder: 'Enter text...' }
 * 
 * 3. SELECT (dropdown):
 *    { defaultValue: 'sine', type: 'select', options: ['sine', 'cosine', 'tangent'] }
 * 
 * 4. BOOLEAN (toggle):
 *    { defaultValue: true, type: 'boolean' }
 * 
 * 5. ARRAY (list of numbers):
 *    { defaultValue: [1, 2, 3], type: 'array' }
 * 
 * 6. OBJECT (complex data):
 *    { defaultValue: { x: 5, y: 10 }, type: 'object', schema: '{ x: number, y: number }' }
 */
export const variableDefinitions: Record<string, VariableDefinition> = {
    // ========================================
    // SECTION: The Ratio That Ignores Size
    // ========================================

    /** The ONE shared quantity of the linked pair: the ladder's lean angle. */
    ladderAngle: {
        defaultValue: 55,
        type: 'number',
        label: 'Lean angle',
        description: 'Angle between the ladder and the ground, shared by the ladder view and the ratio graph',
        unit: '\u00B0',
        min: 10,
        max: 85,
        step: 1,
        color: '#62D0AD',
    },

    /** Shared highlight channel across both views: '' | 'height' | 'angle'. */
    ladderViewHighlight: {
        defaultValue: '',
        type: 'text',
        label: 'Ladder view highlight',
        description: 'Which quantity is highlighted across the ladder view and the ratio graph',
        color: '#3FA98A',
        bgColor: 'rgba(98, 208, 173, 0.22)',
    },

    /** Lowest lean angle the student has visited, for the trail on the graph. */
    ladderTraceMin: {
        defaultValue: 55,
        type: 'number',
        label: 'Trail start angle',
        description: 'Smallest lean angle visited so far',
        min: 10,
        max: 85,
        step: 1,
    },

    /** Highest lean angle the student has visited, for the trail on the graph. */
    ladderTraceMax: {
        defaultValue: 55,
        type: 'number',
        label: 'Trail end angle',
        description: 'Largest lean angle visited so far',
        min: 10,
        max: 85,
        step: 1,
    },

    // ========================================
    // SECTION: Naming the Sides
    // ========================================

    /** The three corners of the tipped triangle, in view coordinates. */
    namingTriangle: {
        defaultValue: { ax: 110, ay: 110, bx: 400, by: 80, cx: 419.6, cy: 269 },
        type: 'object',
        label: 'Triangle corners',
        description: 'Positions of corners A, B and C of the tipped triangle',
        schema: '{ ax: number, ay: number, bx: number, by: number, cx: number, cy: number }',
    },

    /** Which side the student has committed to: '' | 'AB' | 'BC' | 'CA'. */
    namingGuess: {
        defaultValue: '',
        type: 'text',
        label: 'Chosen side',
        description: 'The side the student tapped as their hypotenuse guess',
    },

    /** 1 when the current triangle actually has a right angle, else 0. */
    namingHasRightAngle: {
        defaultValue: 1,
        type: 'number',
        label: 'Right angle present',
        description: 'Whether the triangle currently has a right angle',
        min: 0,
        max: 1,
        step: 1,
    },

    /** 1 when the student's tapped side really is the hypotenuse, else 0. */
    namingGuessCorrect: {
        defaultValue: 0,
        type: 'number',
        label: 'Guess correct',
        description: 'Whether the tapped side is the hypotenuse',
        min: 0,
        max: 1,
        step: 1,
    },

    /** Shared highlight channel: '' | 'rightangle' | 'hypotenuse'. */
    namingHighlight: {
        defaultValue: '',
        type: 'text',
        label: 'Triangle highlight',
        description: 'Which part of the triangle is currently highlighted',
        color: '#3FA98A',
        bgColor: 'rgba(98, 208, 173, 0.22)',
    },

    /** Answer: naming the hypotenuse of triangle PQR from where the right angle sits. */
    answer_naming_hypotenuse: {
        defaultValue: '',
        type: 'text',
        label: 'Hypotenuse of PQR',
        description: 'Student answer naming the hypotenuse when the right angle is at Q',
        placeholder: '???',
        correctAnswer: ['PR', 'RP'],
        color: '#8E90F5',
    },

    /** Answer: naming side QR when working from angle P. */
    answer_naming_side_from_p: {
        defaultValue: '',
        type: 'select',
        label: 'Name of side QR from angle P',
        description: 'Student answer naming QR relative to angle P',
        placeholder: '???',
        correctAnswer: 'opposite',
        options: ['opposite', 'adjacent', 'hypotenuse'],
        color: '#8E90F5',
    },

    /** Answer: what the height-to-length ratio actually depends on. */
    answer_ratio_depends: {
        defaultValue: '',
        type: 'select',
        label: 'What the ratio depends on',
        description: 'Student answer: the ratio is fixed by the lean angle alone',
        placeholder: '???',
        correctAnswer: 'the lean angle',
        options: ['the lean angle', 'the ladder length', 'the wall height'],
        color: '#8E90F5',
    },

    /** Answer: half-length ladder at the same angle reaches half the height. */
    answer_ratio_half_ladder: {
        defaultValue: '',
        type: 'text',
        label: 'Height of the 5 m ladder',
        description: 'Student answer for the shorter ladder at the same lean angle',
        placeholder: '???',
        correctAnswer: ['3.2', '3.2 m', '3.2m'],
        color: '#8E90F5',
    },

    // Uncomment and modify these examples for your lesson:

    /*
    // ─────────────────────────────────────────
    // NUMBER - Use with sliders
    // ─────────────────────────────────────────
    myValue: {
        defaultValue: 5,
        type: 'number',
        label: 'My Value',
        description: 'A number that controls something',
        unit: 'm',           // optional unit display
        min: 0,
        max: 10,
        step: 0.5,
    },

    // ─────────────────────────────────────────
    // TEXT - Free text input
    // ─────────────────────────────────────────
    lessonTitle: {
        defaultValue: 'My Lesson',
        type: 'text',
        label: 'Lesson Title',
        description: 'The title of your lesson',
        placeholder: 'Enter a title...',
    },

    // ─────────────────────────────────────────
    // SELECT - Dropdown with options
    // ─────────────────────────────────────────
    difficulty: {
        defaultValue: 'medium',
        type: 'select',
        label: 'Difficulty',
        description: 'The difficulty level of the lesson',
        options: ['easy', 'medium', 'hard', 'expert'],
    },

    // ─────────────────────────────────────────
    // BOOLEAN - Toggle switch
    // ─────────────────────────────────────────
    showHints: {
        defaultValue: true,
        type: 'boolean',
        label: 'Show Hints',
        description: 'Toggle to show or hide hints',
    },

    // ─────────────────────────────────────────
    // ARRAY - List of numbers
    // ─────────────────────────────────────────
    dataPoints: {
        defaultValue: [1, 4, 9, 16, 25],
        type: 'array',
        label: 'Data Points',
        description: 'Y-values for plotting a graph',
    },

    // ─────────────────────────────────────────
    // OBJECT - Complex structured data
    // ─────────────────────────────────────────
    graphSettings: {
        defaultValue: { 
            xMin: -10, 
            xMax: 10, 
            showGrid: true 
        },
        type: 'object',
        label: 'Graph Settings',
        description: 'Configuration for the graph display',
        schema: '{ xMin: number, xMax: number, showGrid: boolean }',
    },
    */
};

/**
 * Get all variable names (for AI agents to discover)
 */
export const getVariableNames = (): string[] => {
    return Object.keys(variableDefinitions);
};

/**
 * Get a variable's default value
 */
export const getDefaultValue = (name: string): VarValue => {
    return variableDefinitions[name]?.defaultValue ?? 0;
};

/**
 * Get a variable's metadata
 */
export const getVariableInfo = (name: string): VariableDefinition | undefined => {
    return variableDefinitions[name];
};

/**
 * Get all default values as a record (for initialization)
 */
export const getDefaultValues = (): Record<string, VarValue> => {
    const defaults: Record<string, VarValue> = {};
    for (const [name, def] of Object.entries(variableDefinitions)) {
        defaults[name] = def.defaultValue;
    }
    return defaults;
};

/**
 * Get number props for InlineScrubbleNumber from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx, or getExampleVariableInfo(name) in exampleBlocks.tsx.
 */
export function numberPropsFromDefinition(def: VariableDefinition | undefined): {
    defaultValue?: number;
    min?: number;
    max?: number;
    step?: number;
    color?: string;
} {
    if (!def || def.type !== 'number') return {};
    return {
        defaultValue: def.defaultValue as number,
        min: def.min,
        max: def.max,
        step: def.step,
        ...(def.color ? { color: def.color } : {}),
    };
}

/**
 * Get cloze input props for InlineClozeInput from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx, or getExampleVariableInfo(name) in exampleBlocks.tsx.
 */
/**
 * Get cloze choice props for InlineClozeChoice from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx.
 */
export function choicePropsFromDefinition(def: VariableDefinition | undefined): {
    placeholder?: string;
    color?: string;
    bgColor?: string;
} {
    if (!def || def.type !== 'select') return {};
    return {
        ...(def.placeholder ? { placeholder: def.placeholder } : {}),
        ...(def.color ? { color: def.color } : {}),
        ...(def.bgColor ? { bgColor: def.bgColor } : {}),
    };
}

/**
 * Get toggle props for InlineToggle from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx.
 */
export function togglePropsFromDefinition(def: VariableDefinition | undefined): {
    color?: string;
    bgColor?: string;
} {
    if (!def || def.type !== 'select') return {};
    return {
        ...(def.color ? { color: def.color } : {}),
        ...(def.bgColor ? { bgColor: def.bgColor } : {}),
    };
}

export function clozePropsFromDefinition(def: VariableDefinition | undefined): {
    placeholder?: string;
    color?: string;
    bgColor?: string;
    caseSensitive?: boolean;
} {
    if (!def || def.type !== 'text') return {};
    return {
        ...(def.placeholder ? { placeholder: def.placeholder } : {}),
        ...(def.color ? { color: def.color } : {}),
        ...(def.bgColor ? { bgColor: def.bgColor } : {}),
        ...(def.caseSensitive !== undefined ? { caseSensitive: def.caseSensitive } : {}),
    };
}

/**
 * Get spot-color props for InlineSpotColor from a variable definition.
 * Extracts the `color` field.
 *
 * @example
 * <InlineSpotColor
 *     varName="radius"
 *     {...spotColorPropsFromDefinition(getVariableInfo('radius'))}
 * >
 *     radius
 * </InlineSpotColor>
 */
export function spotColorPropsFromDefinition(def: VariableDefinition | undefined): {
    color: string;
} {
    return {
        color: def?.color ?? '#8B5CF6',
    };
}

/**
 * Get linked-highlight props for InlineLinkedHighlight from a variable definition.
 * Extracts the `color` and `bgColor` fields.
 *
 * @example
 * <InlineLinkedHighlight
 *     varName="activeHighlight"
 *     highlightId="radius"
 *     {...linkedHighlightPropsFromDefinition(getVariableInfo('activeHighlight'))}
 * >
 *     radius
 * </InlineLinkedHighlight>
 */
export function linkedHighlightPropsFromDefinition(def: VariableDefinition | undefined): {
    color?: string;
    bgColor?: string;
} {
    return {
        ...(def?.color ? { color: def.color } : {}),
        ...(def?.bgColor ? { bgColor: def.bgColor } : {}),
    };
}

/**
 * Build the `variables` prop for FormulaBlock from variable definitions.
 *
 * Takes an array of variable names and returns the config map expected by
 * `<FormulaBlock variables={...} />`.
 *
 * @example
 * import { scrubVarsFromDefinitions } from './variables';
 *
 * <FormulaBlock
 *     latex="\scrub{mass} \times \scrub{accel}"
 *     variables={scrubVarsFromDefinitions(['mass', 'accel'])}
 * />
 */
export function scrubVarsFromDefinitions(
    varNames: string[],
): Record<string, { min?: number; max?: number; step?: number; color?: string }> {
    const result: Record<string, { min?: number; max?: number; step?: number; color?: string }> = {};
    for (const name of varNames) {
        const def = variableDefinitions[name];
        if (!def) continue;
        result[name] = {
            ...(def.min !== undefined ? { min: def.min } : {}),
            ...(def.max !== undefined ? { max: def.max } : {}),
            ...(def.step !== undefined ? { step: def.step } : {}),
            ...(def.color ? { color: def.color } : {}),
        };
    }
    return result;
}
