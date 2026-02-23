import { test as base, createBdd } from 'playwright-bdd';
import { createSession, closeSession } from 'openqa';

type Fixtures = {
  openqaSession: string;
};

export const test = base.extend<Fixtures>({
  openqaSession: async ({}, use) => {
    const session = createSession();
    await use(session);
    await closeSession(session);
  }
});

export const { Step: aistep } = createBdd(test);
