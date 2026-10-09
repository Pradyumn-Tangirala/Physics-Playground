import { describe, it, expect } from 'vitest';
import { answerFor, FAQ_RULES, FALLBACK_ANSWER, chatWindowRect, FAB_SIZE, EDGE } from './chatbotLogic';

const greeting = FAQ_RULES.find((r) => r.pattern.test('hello')).answer;
const ruleFor = (word) => FAQ_RULES.find((r) => r.pattern.test(word)).answer;

describe('answerFor (whole-word matching)', () => {
    it.each(['What is this?', 'which one', 'I think so', 'Tell me something'])(
        '"%s" is not treated as a greeting',
        (q) => expect(answerFor(q)).not.toBe(greeting),
    );

    it.each(['hi', 'Hi!', 'hello there', 'hey, quick question'])('"%s" is a greeting', (q) => {
        expect(answerFor(q)).toBe(greeting);
    });

    it('topic words win over greetings', () => {
        expect(answerFor('hi, what is diffraction?')).toBe(ruleFor('diffraction'));
    });

    it('matches word forms', () => {
        expect(answerFor('why do waves interfere')).toBe(ruleFor('interference'));
        expect(answerFor('what do the slits do')).toBe(ruleFor('slit'));
        expect(answerFor('what colour is it')).toBe(ruleFor('color'));
    });

    it('is honest about not being an AI', () => {
        expect(answerFor('Are you an AI?')).toMatch(/not an AI/);
    });

    it('falls back for unknown questions', () => {
        expect(answerFor('what is the airspeed of a swallow')).toBe(FALLBACK_ANSWER);
    });
});

describe('chatWindowRect', () => {
    const inside = (r, vp) =>
        r.left >= EDGE && r.top >= EDGE && r.left + r.width <= vp.width - EDGE && r.top + r.height <= vp.height - EDGE;

    it.each([
        ['bottom-right', { x: 1190, y: 710 }],
        ['top-left', { x: EDGE, y: EDGE }],
        ['top-right', { x: 1190, y: EDGE }],
        ['bottom-left', { x: EDGE, y: 710 }],
        ['middle', { x: 600, y: 370 }],
    ])('stays inside the viewport with the button at %s', (_, fab) => {
        const vp = { width: 1280, height: 800 };
        expect(inside(chatWindowRect(fab, vp), vp)).toBe(true);
    });

    it('shrinks to fit a phone-sized viewport', () => {
        const vp = { width: 320, height: 480 };
        const r = chatWindowRect({ x: 320 - FAB_SIZE - EDGE, y: 480 - FAB_SIZE - EDGE }, vp);
        expect(inside(r, vp)).toBe(true);
        expect(r.width).toBe(300);
    });

    it('opens above the button when there is room', () => {
        const r = chatWindowRect({ x: 1190, y: 710 }, { width: 1280, height: 800 });
        expect(r.top + r.height).toBeLessThanOrEqual(710);
    });
});
