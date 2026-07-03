export interface StekkerClient {
  naam: string;
  fase: 'selectie' | 'uitvoering';
  haalStatusOp(taakuitvoeringId: string): Promise<StekkerStatus>;
}

export interface StekkerStatus {
  stekkerId: string;
  naam: string;
  fase: 'selectie' | 'uitvoering';
  status: 'beschikbaar' | 'bezig' | 'fout';
  laatsteSynchronisatie?: string;
}
