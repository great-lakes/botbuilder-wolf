// /* global describe, test, expect */
// import { parseRive, runWolfTests, createWolfRunner } from 'botbuilder-wolf-rive'
// import abilities from '../abilities'
// import { NlpResult } from 'botbuilder-wolf';

// function nlpWolf(input: string): NlpResult {
//   const messageData: NlpResult = {
//     message: input,
//     intent: input === 'hi' ? 'greet' : null,
//     entities: []
//   }
//   return messageData
// }

// const wolfRunner = createWolfRunner(
//   nlpWolf,
//   () => abilities,
//   'greet'
// )

// const demo = parseRive('./examples/profileBot/tests/demo.rive')
// describe('Demo Stage', () => {
//   runWolfTests(demo, wolfRunner)
// })
