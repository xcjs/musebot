import { describe, expect, it } from '@jest/globals';
import { ButtonBuilder } from 'discord.js';

import type { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import { ActionRowBuilderFactory } from './ActionRowBuilderFactory.js';
import { BaseComponent } from './BaseComponent.js';

class StubButton extends BaseComponent<ButtonBuilder> {
  readonly #supported: boolean;

  constructor(supported: boolean) {
    super({} as IBotServiceContainer);
    this.#supported = supported;
  }

  override get isSupported(): boolean {
    return this.#supported;
  }

  override build(): ButtonBuilder {
    return new ButtonBuilder();
  }

  override async buildAsync(): Promise<ButtonBuilder> {
    await Promise.resolve();
    return new ButtonBuilder();
  }
}

describe('ActionRowBuilderFactory.buildActionRows', () => {
  const factory = new ActionRowBuilderFactory();

  it('splits all-supported buttons into rows of at most MaxButtonsPerActionRow', (): void => {
    const buttons = Array.from({ length: 7 }, () => new StubButton(true));

    const rows = factory.buildActionRows(buttons);

    expect(rows).toHaveLength(2);
    expect(rows[0].components).toHaveLength(5);
    expect(rows[1].components).toHaveLength(2);
  });

  it('does not produce an empty trailing row when trailing buttons are unsupported', (): void => {
    const buttons = [
      new StubButton(true),
      new StubButton(true),
      new StubButton(true),
      new StubButton(true),
      new StubButton(true),
      new StubButton(false),
      new StubButton(false)
    ];

    const rows = factory.buildActionRows(buttons);

    expect(rows).toHaveLength(1);
    expect(rows[0].components).toHaveLength(5);
  });

  it('returns zero rows when every button is unsupported', (): void => {
    const buttons = Array.from({ length: 4 }, () => new StubButton(false));

    const rows = factory.buildActionRows(buttons);

    expect(rows).toHaveLength(0);
  });

  it('does not add a duplicate supported button', (): void => {
    const button = new StubButton(true);
    const buttons = [button, button];

    const rows = factory.buildActionRows(buttons);

    expect(rows).toHaveLength(1);
    expect(rows[0].components).toHaveLength(1);
  });
});