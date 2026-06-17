import { extractJsonObject } from '../extract-json';

describe('extractJsonObject', () => {
  const obj = { thesis: 'x', actions: [{ title: 'a', desc: 'b' }] };

  it('parses clean JSON', () => {
    expect(extractJsonObject(JSON.stringify(obj))).toEqual(obj);
  });

  it('parses JSON wrapped in a ```json fence', () => {
    expect(
      extractJsonObject('```json\n' + JSON.stringify(obj) + '\n```'),
    ).toEqual(obj);
  });

  it('parses JSON wrapped in a bare ``` fence', () => {
    expect(extractJsonObject('```\n' + JSON.stringify(obj) + '\n```')).toEqual(
      obj,
    );
  });

  it('parses JSON embedded in surrounding prose', () => {
    expect(
      extractJsonObject('Here you go:\n' + JSON.stringify(obj) + '\nThanks!'),
    ).toEqual(obj);
  });

  it('throws on an empty response', () => {
    expect(() => extractJsonObject('   ')).toThrow();
  });

  it('throws when there is no JSON object', () => {
    expect(() => extractJsonObject('Sorry, I cannot help.')).toThrow();
  });
});
