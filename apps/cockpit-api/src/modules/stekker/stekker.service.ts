import { Injectable } from '@nestjs/common';
import { StekkerStatus } from './ports/stekker-client';

@Injectable()
export class StekkerService {
  listStekkers(taakuitvoeringId: string, fase?: 'selectie' | 'uitvoering'): StekkerStatus[] {
    const stekkers: StekkerStatus[] = [
      {
        stekkerId: 'selectie-bron',
        naam: 'Selectiebron',
        fase: 'selectie',
        status: 'beschikbaar',
        laatsteSynchronisatie: new Date().toISOString(),
      },
      {
        stekkerId: 'vernietiging-doel',
        naam: 'Vernietigingsdoel',
        fase: 'uitvoering',
        status: 'beschikbaar',
        laatsteSynchronisatie: new Date().toISOString(),
      },
    ];

    return stekkers
      .filter((stekker) => !fase || stekker.fase === fase)
      .map((stekker) => ({ ...stekker, taakuitvoeringId }) as StekkerStatus);
  }
}
