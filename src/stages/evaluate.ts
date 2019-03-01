import { Store } from 'redux'
import {
  WolfState, Ability, SlotId, Slot, PromptSlotReason,
  NextAbilityResult, OutputMessageType, Flow, Trace, SlotRecord
} from '../types'
import {
  getAbilitiesCompleteOnCurrentTurn, getFilledSlotsOnCurrentTurn,
  getPromptedSlotStack, getFocusedAbility, getDefaultAbility, getSlotStatus,
  getAbilityStatus, getUnfilledEnabledSlots, getSlotRecords
} from '../selectors'
import { setFocusedAbility, addSlotToPromptedStack, abilityCompleted, addMessage } from '../actions'
import { getAbilitySlots, getAbilityByName } from '../helpers';
import { getTraceBySlotId } from '../helpers/trace';
import { fulfillSlot } from './fillSlot';
const logState = require('debug')('wolf:s3:enterState')
const log = require('debug')('wolf:s3')

/**
 * Evaluate Stage (S3):
 * 
 * Responsible for ensuring S4 (execute stage) has a slot or ability action to run.
 * S3 will ensure that `abilityCompleteOnCurrentTurn` and `promptedSlotStack` are up-to-date.
 * This will inform S4 for the next item to execute.
 * 
 * @param store redux
 * @param flow Flow is made up of Abilities and Slots and are used to define the bot conversation flow
 * @param convoStorageLayer convoState storage layer
 */
export default async function evaluate<T, G>(
  store: Store<WolfState>,
  flow: Flow<T, G>,
  convoStorageLayer: G
): Promise<void> {
  const { dispatch, getState } = store

  const state = getState()
  logState(state)

  const { abilities } = flow

  log('check if any abilities are marked to run onComplete this turn (identified by s2 or s3)..')
  // Check if ability is marked to run onComplete this turn
  const abilityCompleteResult = getAbilitiesCompleteOnCurrentTurn(getState())
  if (abilityCompleteResult.length > 0) {
    log('there are abilities to be completed this turn')
    // TODO: The completed ability should point to the next ability to be completed
    // Check if the next ability has been completed already
    // if no.. set the new focused ability to nextAbility and prompt a slot
    // REDO this later..
    const nextAbilityResult = getNextAbility(abilities, abilityCompleteResult[0], convoStorageLayer, getState())
    log('check if first ability to complete has a nextAbilityName')
    if (nextAbilityResult && nextAbilityResult.abilityName) {
      const { abilityName: nextAbilityName, message = null } = nextAbilityResult
      log('next ability to set: %s', nextAbilityName)
      log('check to see if %s is completed', nextAbilityName)
      if (!isAbilityCompleted(nextAbilityName, getState)) {
        log('%s is not completed yet, setting to focused ability', nextAbilityName)
        dispatch(setFocusedAbility(nextAbilityName))

        // FIND NEXT SLOT TO PROMPT IN FOCUSED ABILITY (duplicate of code below).. TODO: refactor
        log('find the next slot in the new focused ability to prompt')
        const nextSlot = findNextSlotToPrompt(getState, flow)

        if (!nextSlot) {
          log('no slots to prompt, set focused ability to null')
          dispatch(setFocusedAbility(null))
          log('exit stage')
          return // no slots to prompt
        }

        // ADD nextAbility.message to queue
        if (message) {
          log('nextAbility message is a string, add to output message queue')
          dispatch(addMessage({ message, type: OutputMessageType.nextAbilityMessage }))
        }

        // ADD SLOT TO PROMPTED STACK
        log('add slot %s to the promptedStack', nextSlot.slotName)
        dispatch(addSlotToPromptedStack(nextSlot, PromptSlotReason.query))
        log('exit stage')
        return
      }
    }

    // clear focused ability for now if next ability does not exist
    log('set focused ability to null since no nextAbilityName exists')
    dispatch(setFocusedAbility(null))

    log('exit stage')
    return // exit stage.. S4 will run ability.onComplete()
  }

  // Check if there were any slots filled during this turn
  log('check if there are any slots filled this turn..')
  const filledSlotsResult = getFilledSlotsOnCurrentTurn(getState())
  if (filledSlotsResult.length > 0) {
    log('slots have been filled this turn')
    // Check if any abilities have been completed as a result of the filled slot(s)
    log('check if there are any abilities that have been completed as a result of the filled slots this turn')
    const abilityListUnfiltered = getAbilitiesCompleted(getState, flow)

    // filtering out
    const abilityList = [... new Set(abilityListUnfiltered)]
    log('abilityList:', abilityList)
    if (abilityList.length > 0) {
      // ability complete
      log('at least one ability has been completed')
      abilityList.forEach((_) => {
        log('adding %s onto abilitiesCompleteOnCurrentTurn', _)
        dispatch(abilityCompleted(_))
      })

      // TODO: The completed ability should point to the next ability to be completed
      // Check if the next ability has been completed already
      // if no.. set the new focused ability to nextAbility and prompt a slot
      // REDO this later..
      const nextAbilityResult = getNextAbility(abilities, abilityList[0], convoStorageLayer, getState())
      log('check if first ability to complete has a nextAbilityName')
      if (nextAbilityResult && nextAbilityResult.abilityName) {
        const { abilityName: nextAbilityName, message = null } = nextAbilityResult
        log('next ability to set: %s', nextAbilityName)
        log('check to see if %s is completed', nextAbilityName)
        if (!isAbilityCompleted(nextAbilityName, getState)) {
          log('%s is not completed yet, setting to focused ability', nextAbilityName)
          dispatch(setFocusedAbility(nextAbilityName))

          // FIND NEXT SLOT TO PROMPT IN FOCUSED ABILITY (duplicate of code below).. TODO: refactor
          log('find the next slot in the new focused ability to prompt')
          const nextSlot = findNextSlotToPrompt(getState, flow)

          if (!nextSlot) {
            log('no slots to prompt, set focused ability to null')
            dispatch(setFocusedAbility(null))
            log('exit stage')
            return // no slots to prompt
          }

          // ADD nextAbility.message to queue
          if (message) {
            log('nextAbility message is a string, add to output message queue')
            dispatch(addMessage({ message, type: OutputMessageType.nextAbilityMessage }))
          }

          // NEXT SLOT EXISTS..
          // RUN TRACE LOGIC TO CHECK IF SLOT VALUE CAN BE INFERRED RESORTING TO PROMPTING (BELOW)
          const wasNextSlotFilled = await runTraceLogic(store, flow, convoStorageLayer, nextSlot)

          if (wasNextSlotFilled) {
            // INFERRED THE SLOT VALUE FROM CONVERSATION HISTORY
            // NO NEED TO PROMPT FOR THE SLOT.. ALREADY BEEN FILLED.
            log('filled slot with getValue, rerunning evaluate to find the next slot')

            // IDENTIFIED THE NEXT SLOT OF INTEREST..
            // Re-run evaluate to find next move
            await evaluate(store, flow, convoStorageLayer)
            return
          }

          // SLOT VALUE HAS NOT UTILIZED SLOT HISTORY.. REQUIRE PROMPTING TO OBTAIN VALUE
          // ADD SLOT TO PROMPTED STACK
          log('add slot %s to the promptedStack', nextSlot.slotName)
          dispatch(addSlotToPromptedStack(nextSlot, PromptSlotReason.query))
          log('exit stage')
          return
        }
      }

      // clear focused ability for now if next ability is completed (replace with above logic)
      log('set focused ability to null since no nextAbilityName exists')
      dispatch(setFocusedAbility(null))

      log('exit stage')
      return // exit stage.. S4 will run ability.onComplete()
    }
    // no ability has completed.. continue
  }

  // NO ABILITY TO COMPLETE THIS TURN.. check stack
  log('no ability has completed this turn.. check stack')
  const promptedSlotStack = getPromptedSlotStack(getState())

  // Check if there are slots in the stack
  log('check if promptedSlotStack has any items..')
  if (promptedSlotStack.length > 0) {
    log('items exist on stack')
    // slot in the stack
    // regardless of promptSlot.prompted, exit S3
    // if prompted = false.. S4 should prompt slot
    // if prompted = true.. S4 should do nothing
    log('exit stage')
    return
  }
  log('no items in stack..')

  // PROMPT STACK HAS NO ITEMS

  let focusedAbility = getFocusedAbility(getState())
  log('getting focusedAbility:', focusedAbility)
  if (!focusedAbility) {
    // focusedAbility is null, use default ability
    const defaultAbility = getDefaultAbility(getState())
    log('focusedAbility is empty.. checking defaultAbility..')

    // check if defaultAbility is null
    if (!defaultAbility) {
      log('defaultAbility is empty..')
      // focusedAbility and Default ability are both null..
      // no slots will be found.
      log('exit stage')
      return
    }

    // defaultAbility is a string
    log('defaultAbility is not empty, setting focusedAbility:', defaultAbility)
    focusedAbility = defaultAbility // update local
    dispatch(setFocusedAbility(defaultAbility)) // update state
  }

  // FIND NEXT SLOT TO PROMPT IN FOCUSED ABILITY

  log('find next slot to prompt based on focusedAbility..')
  const nextSlot = findNextSlotToPrompt(getState, flow)

  if (!nextSlot) {
    log('nextSlot is empty..')
    log('exist stage')
    return // no slots to prompt
  }

  // NEXT SLOT EXISTS..
  // RUN TRACE LOGIC TO CHECK IF SLOT VALUE CAN BE INFERRED RESORTING TO PROMPTING (BELOW)
  const wasNextSlotFilled = await runTraceLogic(store, flow, convoStorageLayer, nextSlot)

  if (wasNextSlotFilled) {
    // INFERRED THE SLOT VALUE FROM CONVERSATION HISTORY
    // NO NEED TO PROMPT FOR THE SLOT.. ALREADY BEEN FILLED.
    log('filled slot with getValue, rerunning evaluate to find the next slot')

    // IDENTIFIED THE NEXT SLOT OF INTEREST..
    // Re-run evaluate to find next move
    await evaluate(store, flow, convoStorageLayer)
    return
  }

  // SLOT VALUE HAS NOT UTILIZED SLOT HISTORY.. REQUIRE PROMPTING TO OBTAIN VALUE
  // ADD SLOT TO PROMPTED STACK
  log('adding %s slot to promptedStack', nextSlot.slotName)
  dispatch(addSlotToPromptedStack(nextSlot, PromptSlotReason.query))
  log('exit stage')
  return
}

/**
 * Given the identified `nextSlot` to operate on, Wolf will run the user defined `getValue` function on the trace object
 * If the `getValue` is able to utilize the historical slot records within the conversation to fill itself, we do not
 * need to prompt to get the information.
 * 
 * @param store Wolf store
 * @param flow `abilities` and `slots` objects
 * @param convoStorageLayer provides access to userState
 * @param nextSlot slotId of the identified next slot to fill
 * @returns boolean if the slot has been filled by `getValue`
 */
async function runTraceLogic<T, G>(
  store: Store<WolfState>,
  flow: Flow<T, G>,
  convoStorageLayer: G,
  nextSlot: SlotId
): Promise<boolean> {
  const { dispatch, getState } = store
  const { abilities } = flow
  const trace = getTraceBySlotId<T, G>(abilities, nextSlot)

  // CHECK IF SLOT VALUE CAN BE INFERRED (FROM SLOT HISTORY)
  if (trace.getValue) {
    const getValueResult = await runTraceGetValue(convoStorageLayer, getSlotRecords(getState()), trace)
    log('result of getValue: %o', getValueResult)
    if (getValueResult) {
      const { slotName, abilityName } = nextSlot
      // fill the slot with the value returned from the user
      log('running fulfillSlot..')
      const actions = await fulfillSlot(convoStorageLayer, flow, getValueResult, slotName, abilityName, getState, false)
      actions.forEach(dispatch)

      return Promise.resolve(true)
    }
  }
  return Promise.resolve(false)
}

/**
 * Find the next enabled and pending slot in the `focusedAbility` to be prompted
 */
function findNextSlotToPrompt<T, G>(
  getState: () => WolfState,
  flow: Flow<T, G>
): SlotId | null {
  log('in findNextSlotToPrompt()..')
  const focusedAbility = getFocusedAbility(getState())
  log('focusedAbility to check:', focusedAbility)

  if (!focusedAbility) {
    log('focused ability is empty.. return null')
    log('exiting findNextSlotToPrompt()')
    return null
  }

  const unfilledSlots = getUnfilledSlots(getState, flow, focusedAbility)
  log('enabled and unfilled slots are %o', unfilledSlots.map(_ => _.name))
  if (unfilledSlots.length === 0) {
    log('no enabled slots found')
    log('exiting findNextSlotToPrompt()')
    return null // no slots need to be filled in current focused ability
  }

  log('sorted Slots are %o', unfilledSlots.map(_ => _.name))
  log('found %s slot.. returning..', unfilledSlots[0].name)
  log('exiting findNextSlotToPrompt()')
  return {
    slotName: unfilledSlots[0].name,
    abilityName: focusedAbility
  }
}

/**
 * Check if there are any abilities with all enabled slots filled.
 */
function getAbilitiesCompleted<T, G>(
  getState: () => WolfState,
  flow: Flow<T, G>
): string[] {
  const filledSlotsResult = getFilledSlotsOnCurrentTurn(getState())

  if (filledSlotsResult.length === 0) {
    return []
  }

  const abilityList = filledSlotsResult.map((_) => _.abilityName)
  const completedAbilityList = abilityList.filter((_) =>
    isAbilityCompletedByFilledSlotsOnCurrentTurn(getState, flow, _))
  return completedAbilityList
}

/**
 * Given an abilityName, check if the ability is completed based on pending slots.
 * Check if all enabled slots are filled.
 */
function isAbilityCompletedByFilledSlotsOnCurrentTurn<T, G>(
  getState: () => WolfState,
  flow: Flow<T, G>,
  abilityName: string
): boolean {
  const state = getState()
  const slotStatus = getSlotStatus(state)
  const { abilities, slots } = flow
  const ability = abilities.find(_ => _.name === abilityName)
  if (!ability) {
    return false
  }
  const focusedSlotStatus = slotStatus.filter(_ => _.abilityName === ability.name)
  const isEveryAbilitySlotInSlotStatus = getAbilitySlots(slots, ability)
    .every(_ => !!focusedSlotStatus.find(status => status.slotName === _.name))

  if (!isEveryAbilitySlotInSlotStatus) {
    return false
  }

  // Every ability slot exists on slotStatus..
  // Check if every isEnabled slot isDone
  const isEveryEnabledSlotStatusDone = focusedSlotStatus
    .filter(_ => _.isEnabled)
    .every(_ => _.isDone)

  if (!isEveryEnabledSlotStatusDone) {
    return false
  }
  return true
}

function getMissingSlotsOnSlotStatus<T, G>(
  getState: () => WolfState,
  flow: Flow<T, G>,
  focusedAbility: string
): SlotId[] {
  const { abilities, slots } = flow
  const ability = getAbilityByName(abilities, focusedAbility)
  const state = getState()
  if (!ability) {
    return []
  }
  const namesOfSlotStatusOnAbility = getSlotStatus(state)
    .filter(_ => _.abilityName === focusedAbility)
    .map(_ => _.slotName)
  const abilitySlots = getAbilitySlots(slots, ability)
  return abilitySlots
    .map((_: Slot<G>) => _.name)
    .filter((_: string) => namesOfSlotStatusOnAbility.indexOf(_) === -1)
    .map((_: string) => ({
      abilityName: focusedAbility,
      slotName: _
    }))
}

/**
 * Find all unfilled slots in the target ability that are enabled. 
 */
function getUnfilledSlots<T, G>(
  getState: () => WolfState,
  flow: Flow<T, G>,
  focusedAbility: string
): Slot<G>[] {
  const { abilities, slots } = flow
  const ability = getAbilityByName(abilities, focusedAbility)
  if (!ability) {
    // ability is undefined - exit
    return []
  }

  const abilitySlots = getAbilitySlots(slots, ability)
  const state = getState()
  const missingSlotsOnSlotStatus: SlotId[] = getMissingSlotsOnSlotStatus(getState, flow, focusedAbility)
  log('Slots that are in ability but not on slotStatus %o', missingSlotsOnSlotStatus.map(_ => _.slotName))
  const unfilledEnabledSlotIdArray: SlotId[] = getUnfilledEnabledSlots(state, focusedAbility)
  log('Slots that are unfilled and enabled: %o', unfilledEnabledSlotIdArray.map(_ => _.slotName))
  const allUnfilledSlotIds = missingSlotsOnSlotStatus.concat(unfilledEnabledSlotIdArray)

  return allUnfilledSlotIds
    .map(({ slotName }) => abilitySlots.find((_: Slot<G>) => _.name === slotName))
    .filter(_ => _) as Slot<G>[]
}

function getNextAbility<T, G>(
  abilities: Ability<T, G>[],
  abilityName: string,
  convoStorageLayer: G,
  state: WolfState
): NextAbilityResult | null {
  const completedAbility = getAbilityByName(abilities, abilityName)

  if (completedAbility && completedAbility.nextAbility) {
    const nextAbilityResult = completedAbility.nextAbility(convoStorageLayer, state)
    return nextAbilityResult
  }
  return null
}

function isAbilityCompleted(abilityName: string, getState: () => WolfState): boolean {
  const abilityStatus = getAbilityStatus(getState())

  return abilityStatus.some((ability) => ability.abilityName === abilityName && ability.isCompleted)
}

/**
 * Invoke the trace.getValue() passing in the storageLayer object and slot records
 * 
 * @param convoStorageLayer object interfacing with userState
 * @param records slot history records showing all onFill values throughout conversation
 * @param trace trace object to run getValue function on
 * @returns getValue() result
 */
async function runTraceGetValue<G, S>(
  convoStorageLayer: G,
  records: SlotRecord[],
  trace: Trace<G>
): Promise<S | null> {
  if (!trace.getValue) {
    return null
  }
  return await trace.getValue(records, convoStorageLayer)
}
