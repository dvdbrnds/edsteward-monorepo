/**
 * @module Collapsible
 * @description A component that creates expandable and collapsible sections
 * @compliance ISO/IEC/IEEE 26514 4.3.8 - Interactive Component Documentation
 * 
 * @accessibility
 * - Implements ARIA expanded state
 * - Keyboard navigation support
 * - Screen reader announcements
 */

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

/**
 * @component Collapsible
 * @description Root component for collapsible content
 * @example
 * ```tsx
 * <Collapsible>
 *   <CollapsibleTrigger>Toggle</CollapsibleTrigger>
 *   <CollapsibleContent>Hidden content</CollapsibleContent>
 * </Collapsible>
 * ```
 */
const Collapsible = CollapsiblePrimitive.Root

/**
 * @component CollapsibleTrigger
 * @description Button that toggles the collapsible content
 */
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

/**
 * @component CollapsibleContent
 * @description Content that can be shown or hidden
 */
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

export { Collapsible, CollapsibleTrigger, CollapsibleContent }