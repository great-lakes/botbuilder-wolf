import * as wolf from '../..'
import { getInitialWolfState, createStorage, TestCase, runTest } from '../helpers'
import { Ability } from '../../types'

const defaultStore: UserConvoState = {
  animalName: null,
  magicWordStrict: null,
  magicWordStrict2: null
}

interface UserConvoState {
  animalName: string | null,
  magicWordStrict: string | null,
  magicWordStrict2: string | null
}

const abilities: wolf.Ability<UserConvoState>[] = [{
  name: 'magicWord',
  slots: [
    {
      name: 'animalName',
      query: () => 'Please name an animal... if you want.',
    },
    {
      name: 'magicWordStrict',
      query: () => new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve('Please say \'wolf\'... not negotiable.')
        }, 3000)
      }),
      validate: (submittedValue: any) => {
        if (submittedValue !== 'wolf') {
          return { isValid: false, reason: 'Please follow directions.' }
        }
        return { isValid: true, reason: null }
      },
    },
    {
      name: 'magicWordStrict2',
      query: () => 'Please say \'wolf\' one more time.',
      retry: async () => 'You must say \'wolf\' a second time',
      validate: async (submittedValue: any) => {
        if (submittedValue !== 'wolf') {
          await new Promise((resolve) => {
            setTimeout(resolve, 300)
          })
          return { isValid: false, reason: 'Please follow directions.' }
        }
        return { isValid: true, reason: null }
      },
      onFill: async () => {
        await new Promise((resolve) => {
          setTimeout(() => {
            resolve()
          }, 100)
        })
        return 'Submitted to async API! Thank you for saying wolf wolf!'
      }
    }
  ],
  onComplete: (convoState, submittedData: any) => {
    convoState.animalName = submittedData.animalName
    convoState.magicWordStrict = submittedData.magicWordStrict
    convoState.magicWordStrict2 = submittedData.magicWordStrict2
    
    return `You said: '${submittedData.animalName}', \
'${submittedData.magicWordStrict}', \
'${submittedData.magicWordStrict2}'!`
  }
}] as Ability<UserConvoState>[]

const wolfStorage: wolf.WolfStateStorage = createStorage(getInitialWolfState())
const convoStorage = createStorage(defaultStore)

const optionalSlotPropertyTestCase: TestCase<UserConvoState> = {
  description: 'Optional Slot Properties',
  abilities: abilities,
  defaultAbility: 'magicWord',
  wolfStorage,
  convoStorage,
  conversationTurns: [
    {
      input: { message: 'hello', entities: [], intent: 'magicWord' },
      expected: {
        message: ['Please name an animal... if you want.'],
        state: { 'animalName': null, 'magicWordStrict': null, 'magicWordStrict2': null }
      }
    },
    {
      input: { message: 'hippo', entities: [], intent: 'magicWord' },
      expected: {
        message: ['Please say \'wolf\'... not negotiable.'],
        state: { 'animalName': null, 'magicWordStrict': null, 'magicWordStrict2': null }
      }
    },
    {
      input: { message: 'hippo', entities: [], intent: 'magicWord' },
      expected: {
        message: ['Please follow directions.'],
        state: { 'animalName': null, 'magicWordStrict': null, 'magicWordStrict2': null }
      }
    },
    {
      input: { message: 'wolf', entities: [], intent: 'magicWord' },
      expected: {
        message: ['Please say \'wolf\' one more time.'],
        state: { 'animalName': null, 'magicWordStrict': null, 'magicWordStrict2': null }
      }
    },
    {
      input: { message: 'hippo', entities: [], intent: 'magicWord' },
      expected: {
        message: [
          'Please follow directions.',
          'You must say \'wolf\' a second time'
        ],
        state: { 'animalName': null, 'magicWordStrict': null, 'magicWordStrict2': null }
      }
    },
    {
      input: { message: 'wolf', entities: [], intent: 'magicWord' },
      expected: {
        message: [
          'Submitted to async API! Thank you for saying wolf wolf!',
          'You said: \'hippo\', \'wolf\', \'wolf\'!'
        ],
        state: {
          'animalName': 'hippo',
          'magicWordStrict': 'wolf',
          'magicWordStrict2': 'wolf'
        }
      }
    }
  ]
}

describe('Async User Functions', () => {
  runTest(test, optionalSlotPropertyTestCase)
})
