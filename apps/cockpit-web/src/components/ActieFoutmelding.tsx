import { TAAK_GEWIJZIGD_MELDING } from "../api/apiClient";

type Props = {
  melding: string | null;
};

// Foutmelding in het actiepaneel. Is de taak intussen door iemand anders gewijzigd
// (409/412), dan staat er een knop bij om de gegevens opnieuw te laden (CC-13).
export default function ActieFoutmelding({ melding }: Props) {
  if (!melding) {
    return null;
  }

  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-5 text-rose-700">
      <p>{melding}</p>
      {melding === TAAK_GEWIJZIGD_MELDING ? (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 rounded-md border border-rose-300 bg-white px-3 py-1 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
        >
          Opnieuw laden
        </button>
      ) : null}
    </div>
  );
}
