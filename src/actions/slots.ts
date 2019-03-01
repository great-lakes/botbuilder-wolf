import { SlotId, PromptSlotReason } from '../types'

export const FILL_SLOT = 'FILL_SLOT'
export const fillSlot = (slotName: string, abilityName: string | null, value: any) => ({
  type: FILL_SLOT,
  payload: { slotName, abilityName, value }
})

export const ADD_SLOT_TO_PROMPTED_STACK = 'ADD_SLOT_TO_PROMPTED_STACK'
export const addSlotToPromptedStack = (promptedSlot: SlotId, reason: PromptSlotReason) => ({
  type: ADD_SLOT_TO_PROMPTED_STACK,
  payload: {
    slotId: promptedSlot,
    reason
  }
})

/**
 * Set slot.prompted property
 */
export const SET_SLOT_PROMPTED = 'SET_SLOT_PROMPTED'
export const setSlotPrompted = (slotId: SlotId, prompted: boolean) => ({
  type: SET_SLOT_PROMPTED,
  payload: { slotId, prompted }
})

export const REMOVE_SLOT_FROM_PROMPTED_STACK = 'REMOVE_SLOT_FROM_PROMPTED_STACK'
export const removeSlotFromPromptedStack = (removeSlot: SlotId) => ({
  type: REMOVE_SLOT_FROM_PROMPTED_STACK,
  payload: removeSlot
})

export const ENABLE_SLOT = 'ENABLE_SLOT'
export const enableSlot = (slotId: SlotId) => ({
  type: ENABLE_SLOT,
  payload: slotId
})

export const DISABLE_SLOT = 'DISABLE_SLOT'
export const disableSlot = (slotId: SlotId) => ({
  type: DISABLE_SLOT,
  payload: slotId
})

export const REQ_CONFIRM_SLOT = 'REQ_CONFIRM_SLOT'
export const reqConfirmSlot = (originSlotId: SlotId, confirmationSlotId: SlotId) => ({
  type: REQ_CONFIRM_SLOT,
  payload: {
    originSlotId,
    confirmationSlotId
  }
})

export const ACCEPT_SLOT = 'ACCEPT_SLOT'
export const acceptSlot = (originSlotId: SlotId) => ({
  type: ACCEPT_SLOT,
  payload: originSlotId
})

export const DENY_SLOT = 'DENY_SLOT'
export const denySlot = (originSlotId: SlotId) => ({
  type: DENY_SLOT,
  payload: originSlotId
})

export const RESET_SLOT_STATUS_BY_ABILITY_NAME = 'RESET_SLOT_STATUS_BY_ABILITY_NAME'
export const resetSlotStatusByAbilityName = (abilityName: string) => ({
  type: RESET_SLOT_STATUS_BY_ABILITY_NAME,
  payload: abilityName
})

export const INCREMENT_TURN_COUNT_BY_ID = 'INCREMENT_TURN_COUNT_BY_ID'
export const incrementTurnCountBySlotId = (slotId: SlotId) => ({
  type: INCREMENT_TURN_COUNT_BY_ID,
  payload: slotId
})

export const SET_SLOT_DONE = 'SET_SLOT_DONE'
export const setSlotDone = (slotId: SlotId, isDone: boolean) => ({
  type: SET_SLOT_DONE,
  payload: {slotId, isDone}
})

export const ADD_SLOT_TO_ON_FILL_STACK = 'ADD_SLOT_TO_ON_FILL_STACK'
export const addSlotToOnFillStack = (slotId: SlotId, value: any) => ({
  type: ADD_SLOT_TO_ON_FILL_STACK,
  payload: { slotName: slotId.slotName, abilityName: slotId.abilityName, value }
})

export const REMOVE_SLOT_FROM_ON_FILL_STACK = 'REMOVE_SLOT_FROM_ON_FILL_STACK'
export const removeSlotFromOnFillStack = (slotId: SlotId) => ({
  type: REMOVE_SLOT_FROM_ON_FILL_STACK,
  payload: slotId
})
