import type React from 'react'

import type { ModuleId } from '@/contracts/module-catalog'

import EventHeader from './event-header'
import ProductionList from './production-list'
import type { ModuleComponentProps } from './types'

/**
 * Module id -> component. The renderer's entire knowledge of what modules exist.
 *
 * Partial by design: the catalog specifies more modules than are implemented, and
 * `implemented: false` there is what keeps the two in step. A module missing here
 * is dropped by the validator with a note, never rendered as a blank.
 */
export const MODULE_REGISTRY: Partial<
    Record<ModuleId, React.FC<ModuleComponentProps<any>>>
> = {
    event_header: EventHeader,
    production_list: ProductionList,
}

export function getModuleComponent(id: ModuleId) {
    return MODULE_REGISTRY[id] ?? null
}
