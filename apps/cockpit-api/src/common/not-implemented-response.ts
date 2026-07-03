import { ActieStatus } from './api-types';

export function actieGeaccepteerd(actieId: string, bericht: string): ActieStatus {
  return {
    actieId,
    status: 'geaccepteerd',
    bericht,
  };
}
