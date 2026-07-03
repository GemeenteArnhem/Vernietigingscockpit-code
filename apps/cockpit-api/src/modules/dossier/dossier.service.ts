import { Injectable } from '@nestjs/common';
import { TaakContext } from '../../common/api-types';
import { DbService } from '../../database/db.service';
import { MarkeerBeoordeeldDto, ReviewregelQueryDto, UpdateReviewregelDto } from './dossier.dto';

type Reviewregel = {
  id: string;
  titel: string;
  omvang: number;
  bewaartermijn: number;
  vernietigingsdatum: string;
  status?: string;
  beoordeeld: boolean;
  uitgesloten: boolean;
  reden?: string;
  toelichting?: string;
  proceseigenaarToelichting?: string;
  archivarisToelichting?: string;
  bron_id?: string;
  code?: string;
  startdatum?: string;
  einddatum?: string;
  selectielijst?: string;
  resultaat?: string;
  grondslag?: string;
  bron_systeem?: string;
};

type ReviewregelListResponse = {
  taakId: string;
  taakuitvoeringId: string;
  filters: ReviewregelQueryDto;
  items: Reviewregel[];
  page: number;
  pageSize: number;
  total: number;
};

type Resultaatregel = {
  id: string;
  titel: string;
  stekker: string;
  vernietigingsstatus: string;
  omvang?: number;
  vernietigingsdatum?: string;
  bron_id?: string;
  code?: string;
  grondslag?: string;
  bron_systeem?: string;
  melding?: string;
};

type ResultaatregelListResponse = TaakContext & {
  items: Resultaatregel[];
  total: number;
};

@Injectable()
export class DossierService {
  constructor(private readonly db: DbService) {}

  async listReviewregels(context: TaakContext, query: ReviewregelQueryDto): Promise<ReviewregelListResponse> {
    const filters: string[] = ['t.id = $1', 'tu.id = $2'];
    const params: unknown[] = [context.taakId, context.taakuitvoeringId];

    if (query.status) {
      params.push(query.status);
      filters.push(`vo.review_status = $${params.length}`);
    }

    if (query.zoekterm) {
      params.push(`%${query.zoekterm}%`);
      filters.push(`(vo.titel ILIKE $${params.length} OR vo.bron_id ILIKE $${params.length})`);
    }

    if (query.alleenUitzonderingen) {
      filters.push('vo.uitgesloten = true');
    }

    const { rows } = await this.db.query<Reviewregel>(
      `
        SELECT
          vo.id,
          vo.titel,
          vo.omvang,
          vo.bewaartermijn,
          vo.vernietigingsdatum,
          vo.review_status AS status,
          vo.beoordeeld,
          vo.uitgesloten,
          vo.reden,
          vo.toelichting,
          vo.proceseigenaar_toelichting AS "proceseigenaarToelichting",
          vo.archivaris_toelichting AS "archivarisToelichting",
          vo.bron_id,
          vo.code,
          vo.startdatum,
          vo.einddatum,
          vo.selectielijst,
          vo.resultaat,
          vo.grondslag,
          vo.bron_systeem
        FROM vernietigingsobjecten vo
        JOIN dossiers d ON d.id = vo.dossier_id
        JOIN taakuitvoeringen tu ON tu.id = d.taakuitvoering_id
        JOIN taken t ON t.id = tu.taak_id
        WHERE ${filters.join(' AND ')}
        ORDER BY vo.id::integer ASC
      `,
      params,
    );

    return {
      taakId: context.taakId,
      taakuitvoeringId: context.taakuitvoeringId,
      filters: query,
      items: rows,
      page: 1,
      pageSize: 25,
      total: rows.length,
    };
  }

  async updateReviewregel(context: TaakContext, reviewregelId: string, dto: UpdateReviewregelDto) {
    const { rows } = await this.db.query(
      `
        UPDATE vernietigingsobjecten vo
        SET review_status = COALESCE($4, vo.review_status),
            reden = COALESCE($5, vo.reden),
            toelichting = COALESCE($6, vo.toelichting),
            updated_at = now()
        FROM dossiers d
        JOIN taakuitvoeringen tu ON tu.id = d.taakuitvoering_id
        WHERE vo.dossier_id = d.id
          AND tu.taak_id = $1
          AND tu.id = $2
          AND vo.id = $3
        RETURNING vo.id
      `,
      [
        context.taakId,
        context.taakuitvoeringId,
        reviewregelId,
        dto.status,
        dto.uitzonderingsreden,
        dto.toelichting,
      ],
    );

    return {
      ...context,
      reviewregelId,
      ...dto,
      gevonden: Boolean(rows.length),
      bijgewerktOp: new Date().toISOString(),
    };
  }

  async markeerBeoordeeld(context: TaakContext, dto: MarkeerBeoordeeldDto) {
    const { rows } = await this.db.query<{ id: string }>(
      `
        UPDATE vernietigingsobjecten vo
        SET beoordeeld = true,
            updated_at = now()
        FROM dossiers d
        JOIN taakuitvoeringen tu ON tu.id = d.taakuitvoering_id
        WHERE vo.dossier_id = d.id
          AND tu.taak_id = $1
          AND tu.id = $2
          AND vo.id = ANY($3::text[])
        RETURNING vo.id
      `,
      [context.taakId, context.taakuitvoeringId, dto.reviewregelIds],
    );

    const updatedIds = new Set(rows.map((row) => row.id));

    return {
      ...context,
      items: dto.reviewregelIds.map((reviewregelId) => ({
        reviewregelId,
        status: updatedIds.has(reviewregelId) ? 'beoordeeld' : 'niet_gevonden',
      })),
    };
  }

  async listResultaatregels(context: TaakContext): Promise<ResultaatregelListResponse> {
    const { rows } = await this.db.query<Resultaatregel>(
      `
        SELECT
          vernietigingsresultaten.id,
          vernietigingsresultaten.titel,
          vernietigingsresultaten.stekker,
          vernietigingsresultaten.vernietigingsstatus,
          vernietigingsresultaten.omvang,
          vernietigingsresultaten.vernietigingsdatum,
          vernietigingsresultaten.bron_id,
          vernietigingsresultaten.code,
          vernietigingsresultaten.grondslag,
          vernietigingsresultaten.bron_systeem,
          vernietigingsresultaten.melding
        FROM vernietigingsresultaten
        JOIN taakuitvoeringen ON taakuitvoeringen.id = vernietigingsresultaten.taakuitvoering_id
        WHERE taakuitvoeringen.taak_id = $1
          AND vernietigingsresultaten.taakuitvoering_id = $2
        ORDER BY vernietigingsresultaten.id ASC
      `,
      [context.taakId, context.taakuitvoeringId],
    );

    return {
      ...context,
      items: rows,
      total: rows.length,
    };
  }

  getVernietigingsverklaring(context: TaakContext) {
    return {
      ...context,
      documentId: `verklaring-${context.taakuitvoeringId}`,
      status: 'beschikbaar',
    };
  }

  exporteerVernietigingsresultaat(context: TaakContext) {
    return {
      ...context,
      exportId: `export-${context.taakuitvoeringId}`,
      status: 'gepland',
    };
  }
}
